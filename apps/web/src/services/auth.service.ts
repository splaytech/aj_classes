// Staff sign-in: passwords, email links, sessions (R2a design §11.4).
// Pages call these plain functions and get back a Result; they never see Supabase.

import { getSupabase, isPortalConfigured } from './supabase.client';
import { attempt, fail, succeed } from './result';
import { toErrorKey } from './auth-errors';
import type { AccessState, EmailLinkType, OnboardingInfo, Result } from './types';

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

/** Uses the token from an invite or reset email to sign the person in (design §9.1). */
export async function confirmEmailLink(tokenHash: string, type: EmailLinkType): Promise<Result> {
  if (!isPortalConfigured()) return fail('notConfigured');

  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
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
// a page's loaders in parallel), so one answer is shared for a moment: one profile read per page
// instead of one per loader, and family reads can check the role for free (BUG-9). Keyed on the
// access token, so signing in or out, or finishing two-step, always reads afresh.
const ACCESS_REUSE_MS = 1000;
let recentAccess: { token: string; readAt: number; state: Promise<AccessState> } | null = null;

/**
 * Who is signed in, their role, and how strongly (password only, or password + code).
 * Read fresh on every private page (shared only by that page's loaders, above), so a role change
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

  const reusable =
    recentAccess?.token === session.access_token &&
    Date.now() - recentAccess.readAt < ACCESS_REUSE_MS;
  if (reusable && recentAccess) return recentAccess.state;

  const state = readAccessState(session.user.id, session.user.email ?? '');
  recentAccess = { token: session.access_token, readAt: Date.now(), state };
  state.catch(() => {
    if (recentAccess?.state === state) recentAccess = null; // don't share a failed read
  });
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
