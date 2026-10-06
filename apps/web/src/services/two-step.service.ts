// Two-step sign-in with an authenticator app (TOTP). Required for admins (R2a design §4.2).

import { AUTH_LIMITS } from '@/constants';

import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type { Authenticator, Result, TwoStepEnrolment } from './types';

/** The person's confirmed authenticators, oldest first. */
export async function listAuthenticators(): Promise<Result<Authenticator[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return fail(toErrorKey(error));

    const authenticators = data.totp
      .filter((factor) => factor.status === 'verified')
      .map((factor) => ({
        id: factor.id,
        name: factor.friendly_name ?? '',
        addedAt: factor.created_at,
      }));
    return succeed(authenticators);
  });
}

/** Starts linking a new authenticator: returns the QR code and key to show. */
export async function startTwoStepSetup(name: string): Promise<Result<TwoStepEnrolment>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    await removeUnfinishedSetups();

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: name.trim(),
    });
    if (error) return fail(toErrorKey(error));

    return succeed({ factorId: data.id, qrCodeSvg: data.totp.qr_code, secret: data.totp.secret });
  });
}

/**
 * Checks a 6-digit code. Used both to finish setup and to sign in.
 * On success the session is upgraded to two-step (aal2).
 */
export async function verifyTwoStepCode(factorId: string, code: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Removes an authenticator. Admins must keep at least one (R2a story US9 AC3). */
export async function removeAuthenticator(factorId: string, isAdmin: boolean): Promise<Result> {
  const current = await listAuthenticators();
  if (!current.ok) return current;
  if (isAdmin && current.data.length <= 1) return fail('lastAuthenticator');

  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

export function canAddAuthenticator(current: Authenticator[]): boolean {
  return current.length < AUTH_LIMITS.maxAuthenticators;
}

/** A setup that was started but never confirmed would block a new one with the same name. */
async function removeUnfinishedSetups(): Promise<void> {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.mfa.listFactors();
  const unfinished = (data?.all ?? []).filter((factor) => factor.status === 'unverified');
  for (const factor of unfinished) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
}
