// Open sign-up for parents and guardians (ADR-0011; 03 §7.2): the sign-up page, the resend page,
// the confirmation link, "Continue with Google" and the finish step. Pages call these and get a
// Result; they never see Supabase.

import { APP_CONFIG, PORTAL_ROUTES, SIGN_UP_STATUSES } from '@/constants';
import type { SignUpStatus } from '@/constants';

import { changePassword } from './auth.service';
import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { getSupabase, isPortalConfigured } from './supabase.client';
import type { ErrorKey, Result } from './types';

export type SignUpOptions = { status: SignUpStatus; google: boolean };

const HIDDEN: SignUpOptions = { status: 'closed', google: false };

/**
 * Whether sign-up is open and whether Google is switched on. Any failure reads as closed and no
 * Google: the link and the button are hidden, never broken (AC-1, AC-51).
 */
export async function getSignUpOptions(): Promise<SignUpOptions> {
  if (!isPortalConfigured()) return HIDDEN;
  try {
    const supabase = await getSupabase();
    const [statusReply, settings] = await Promise.all([
      supabase.rpc('sign_up_status'),
      fetch(`${APP_CONFIG.supabase.url}/auth/v1/settings`, {
        headers: { apikey: APP_CONFIG.supabase.publishableKey },
      }),
    ]);
    const status = statusReply.data;
    if (statusReply.error || !SIGN_UP_STATUSES.includes(status as SignUpStatus)) return HIDDEN;
    const body = settings.ok
      ? ((await settings.json()) as { external?: { google?: boolean } })
      : {};
    return { status: status as SignUpStatus, google: body.external?.google === true };
  } catch {
    return HIDDEN;
  }
}

/**
 * Just the status, for Admin → Users: unlike getSignUpOptions, a failed read is reported as a
 * failure, so the page never claims a state it doesn't know (Tester 6a bug 2).
 */
export async function getSignUpStatus(): Promise<Result<SignUpStatus>> {
  if (!isPortalConfigured()) return fail('notConfigured');
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('sign_up_status');
    if (error) return fail(toErrorKey(error));
    return SIGN_UP_STATUSES.includes(data as SignUpStatus)
      ? succeed(data as SignUpStatus)
      : fail('unknown');
  });
}

/**
 * Supabase needs a password at sign-up; this one is random, never shown, stored or returned, and
 * the confirm-time wipe clears it (03 §3.6). The person chooses their own on the finish step.
 */
function throwawayPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Replies that must look like a normal sign-up, so the page never tells anyone whether an e-mail
// already has an account (AC-10, AC-12; R1): Auth's wait between e-mails, and its answer for an
// address that is already confirmed (05-dev-notes, slice 17).
const QUIET_SIGN_UP_CODES = new Set(['over_email_send_rate_limit', 'user_already_exists']);

export async function signUpWithEmail(
  fullName: string,
  email: string,
  captchaToken: string,
): Promise<Result> {
  if (!isPortalConfigured()) return fail('notConfigured');
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: throwawayPassword(),
      options: { captchaToken, data: { full_name: fullName.trim() } },
    });
    if (!error || QUIET_SIGN_UP_CODES.has(error.code ?? '')) return succeed();
    return fail(toErrorKey(error));
  });
}

// The resend page always answers "sent" (AC-19), except for these.
const RESEND_PROBLEMS: ErrorKey[] = ['captchaFailed', 'network'];

export async function resendSignUpLink(email: string, captchaToken: string): Promise<Result> {
  if (!isPortalConfigured()) return fail('notConfigured');
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: { captchaToken },
    });
    if (!error) return succeed();
    if (error.code === 'over_request_rate_limit') return fail('tooManyAttempts');
    const key = toErrorKey(error);
    return RESEND_PROBLEMS.includes(key) ? fail(key) : succeed();
  });
}

/** Opens the sign-up confirmation link (after the person clicks Continue). */
export async function confirmSignUpLink(tokenHash: string): Promise<Result> {
  if (!isPortalConfigured()) return fail('notConfigured');
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Sends the browser to Google; it comes back to /portal/auth/callback with a one-time code. */
export async function startGoogleSignIn(): Promise<Result> {
  if (!isPortalConfigured()) return fail('notConfigured');
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${PORTAL_ROUTES.authCallback}` },
    });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Swaps Google's one-time code for a session (PKCE, S7). */
export async function finishGoogleSignIn(code: string): Promise<Result> {
  if (!isPortalConfigured()) return fail('notConfigured');
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

export type FinishSignUpInput = {
  fullName: string;
  /** null for a Google account, which needs no password. */
  password: string | null;
  acceptsTerms: boolean;
};

/**
 * Saves the finish step: the password first (e-mail accounts), in this same link session, then
 * the name and the Terms tick (complete_sign_up). A 'reauthNeeded' result means Supabase wants
 * the emailed code: call again with it.
 */
export async function completeSignUp(
  input: FinishSignUpInput,
  emailedCode?: string,
): Promise<Result> {
  if (input.password !== null) {
    const saved = await changePassword(input.password, emailedCode);
    // "Same password" on a retry means an earlier press already saved this password and only the
    // second step failed (Tester 6a bug 1). Go on: complete_sign_up still checks the password was
    // set in this session (password_not_set otherwise).
    if (!saved.ok && saved.error !== 'samePassword') return saved;
  }
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('complete_sign_up', {
      new_full_name: input.fullName.trim(),
      accepts_terms: input.acceptsTerms,
    });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Whether the signed-in account has a password (Account → Change password shows only then). */
export async function hasPassword(): Promise<Result<boolean>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('my_has_password');
    return error ? fail(toErrorKey(error)) : succeed(data === true);
  });
}
