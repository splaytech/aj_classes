// Invite links (ADR-0010). /portal/invite sends the emailed token to invite-redeem, which swaps it
// once for a one-time Supabase recovery token; the browser then verifies that token to sign in
// and goes on to the setup form.

import { invokeEdgeFunction } from './account-admin.client';
import { confirmRecoveryLink } from './auth.service';
import { fail, succeed } from './result';
import { isPortalConfigured } from './supabase.client';
import type { Result } from './types';

const INVITE_REDEEM = 'invite-redeem';

/** Uses up the invite link. A refused link of any kind comes back as 'inviteExpired'. */
export async function redeemInvite(token: string): Promise<Result<{ tokenHash: string }>> {
  if (!isPortalConfigured()) return fail('notConfigured');

  const result = await invokeEdgeFunction(INVITE_REDEEM, { token });
  if (!result.ok) return result;

  const { tokenHash } = result.data;
  return typeof tokenHash === 'string' && tokenHash !== ''
    ? succeed({ tokenHash })
    : fail('unknown');
}

/**
 * Signs in with the token invite-redeem returned. The invite link is already used up by then, so
 * a dropped connection gets one automatic retry before the page offers Try again (02 §4).
 */
export async function signInWithInviteHop(tokenHash: string): Promise<Result> {
  const first = await confirmRecoveryLink(tokenHash);
  if (first.ok || first.error !== 'network') return first;
  return confirmRecoveryLink(tokenHash);
}
