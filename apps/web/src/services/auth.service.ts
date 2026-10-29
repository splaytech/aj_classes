// Staff sign-in: passwords, email links, sessions (R2a design §11.4).
// Pages call these plain functions and get back a Result; they never see Supabase.

import { clearStoredSession, getSupabase, isPortalConfigured } from './supabase.client';
import { attempt, fail, succeed } from './result';
import { toErrorKey } from './auth-errors';
import type { AccessState, OnboardingInfo, Result } from './types';

const SIGNED_OUT: AccessState = {
  signedIn: false,
  userId: '',
  email: '',
  profile: null,
  onboarding: null,
  aal: 'aal1',
  hasVerifiedFactor: false,
};

export async function signIn(
  email: string,
  password: string,
  captchaToken: string,
): Promise<Result> {
  if (!isPortalConfigured()) return fail('notConfigured');

  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      options: { captchaToken },
    });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Signs out on this device only. */
export async function signOut(): Promise<void> {
  if (!isPortalConfigured()) return;
  const supabase = await getSupabase();
  await supabase.auth.signOut({ scope: 'local' });
}

/**
 * Ends the session of an account that was deactivated while signed in (the page guard's
 * sign-out, BUG-15). Why not signOut(): supabase-js's 'local' sign-out still POSTs /logout, to
 * revoke this session's refresh token on the server. Deactivation bans the account, and for a
 * banned account GoTrue refuses that call (403 user_banned) and revokes nothing; it already
 * refuses the refresh token (400 user_banned). So the call could only add a console error, once
 * per parallel page loader, and clearing this device's copy is all there is to do. It sends no
 * request, so the parallel loaders can all call it: only the first finds a session to remove.
 */
export function forgetDeactivatedSession(): void {
  if (!isPortalConfigured()) return;
  clearStoredSession();
}

/**
 * Sends a reset link. Succeeds whether or not the email has an account, so the page can't
 * reveal who has one (design §11.4, G17).
 */
export async function requestPasswordReset(email: string, captchaToken: string): Promise<Result> {
  if (!isPortalConfigured()) return fail('notConfigured');

  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { captchaToken });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/**
 * Signs the person in with a one-time recovery token: from a reset email (design §9.1), or the
 * one invite-redeem hands back (ADR-0010). Always type 'recovery', so no code path can verify a
 * Supabase invite token any more (AC 38).
 */
export async function confirmRecoveryLink(tokenHash: string): Promise<Result> {
  if (!isPortalConfigured()) return fail('notConfigured');

  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Sets a new password after an invite or reset link, then signs out every other device. */
export async function setNewPassword(password: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return fail(toErrorKey(error));

    await supabase.auth.signOut({ scope: 'others' });
    return succeed();
  });
}

/**
 * Emails a 6-digit code that proves it's really the account owner changing the password.
 * Supabase asks for it when the session is more than a day old (R2a review V19, V21).
 */
export async function sendReauthCode(): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.reauthenticate();
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/**
 * Changes the password, then signs out every other device.
 * Fails with 'reauthNeeded' when Supabase wants an emailed code first (session over a day old):
 * call `sendReauthCode()` and try again with the code.
 */
export async function changePassword(newPassword: string, emailedCode?: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      nonce: emailedCode?.trim() || undefined,
    });
    if (error) return fail(toErrorKey(error));

    await supabase.auth.signOut({ scope: 'others' });
    return succeed();
  });
}

// The member layout, the area layout and the page's own loader all ask at once (React Router runs
// a page's loaders in parallel), so a read still in progress is shared: one profile read per page
// instead of one per loader, and family reads can check the role for free (BUG-9). Only an
// unfinished read is shared, and only for the same access token, so anything that asks after it
// finishes (the next page, or straight after finishing setup) always reads afresh.
let readInProgress: { token: string; state: Promise<AccessState> } | null = null;

/**
 * Who is signed in, their role, and how strongly (password only, or password + code).
 * Read fresh on every private page (only a read in progress is shared, above), so a role change
 * or deactivation applies straight away.
 * Throws if the server can't be reached, so a network blip shows an error rather than
 * signing the person out.
 */
export async function getAccessState(): Promise<AccessState> {
  if (!isPortalConfigured()) return SIGNED_OUT;

  const supabase = await getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return SIGNED_OUT;

  if (readInProgress?.token === session.access_token) return readInProgress.state;

  const state = readAccessState(session.user.id, session.user.email ?? '');
  const current = { token: session.access_token, state };
  readInProgress = current;
  const finished = () => {
    if (readInProgress === current) readInProgress = null;
  };
  state.then(finished, finished);
  return state;
}

async function readAccessState(userId: string, email: string): Promise<AccessState> {
  const supabase = await getSupabase();
  const [profileResult, levelResult] = await Promise.all([
    supabase.from('profiles').select('full_name, role, is_active').eq('id', userId).maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (profileResult.error) throw profileResult.error;

  // Only active accounts can read their own row (RLS), so `data` is null for someone deactivated
  // or still invited. An invited person gets their setup details instead (invite-onboarding).
  const row = profileResult.data;
  const profile = row?.is_active ? { fullName: row.full_name, role: row.role } : null;
  const onboarding = profile ? null : await readOnboarding();

  return {
    signedIn: true,
    userId,
    email,
    profile,
    onboarding,
    aal: levelResult.data?.currentLevel === 'aal2' ? 'aal2' : 'aal1',
    hasVerifiedFactor: levelResult.data?.nextLevel === 'aal2',
  };
}

/** The setup form's details, or null unless the signed-in account is invited and not deactivated. */
async function readOnboarding(): Promise<OnboardingInfo | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('my_onboarding');
  if (error) throw error;

  const row = data?.[0];
  if (!row) return null;
  return {
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    yearLevel: row.year_level ?? null,
  };
}

/**
 * Calls `onSignedOut` when the session ends: signing out in another tab, or a refresh that
 * fails because the account was deactivated (design §11.3). Returns a function to stop listening.
 */
export async function watchForSignOut(onSignedOut: () => void): Promise<() => void> {
  if (!isPortalConfigured()) return () => {};

  const supabase = await getSupabase();
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') onSignedOut();
  });
  return () => data.subscription.unsubscribe();
}
