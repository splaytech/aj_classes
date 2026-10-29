// What /portal/invite shows next after each request (ADR-0010; 03-design §5.4). Pure, so every
// row of the table is a unit test. Only a refused invite link, or a sign-in token that is gone,
// ends in the refused message; anything else can be tried again. Try again after a failed sign-in
// keeps the hop token, because the invite link itself is already used up.

import { PORTAL_FRAGMENT } from '@/constants';
import type { ErrorKey, Result } from '@/services';

/** The invite token from the address fragment (`#token=…`), or '' when there isn't one. */
export function inviteTokenFromHash(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, '')).get(PORTAL_FRAGMENT.inviteToken) ?? '';
}

export type InviteStep =
  | { kind: 'ready' }
  | { kind: 'checking' }
  | { kind: 'refused' }
  | { kind: 'retry'; error: ErrorKey; tokenHash: string | null };

export function afterRedeem(
  result: Result<{ tokenHash: string }>,
): { kind: 'hop'; tokenHash: string } | InviteStep {
  if (result.ok) return { kind: 'hop', tokenHash: result.data.tokenHash };
  if (result.error === 'inviteExpired') return { kind: 'refused' };
  return { kind: 'retry', error: result.error, tokenHash: null };
}

export function afterHop(result: Result, tokenHash: string): { kind: 'signedIn' } | InviteStep {
  if (result.ok) return { kind: 'signedIn' };
  // The recovery token is gone: the account was deleted, or more than an hour passed.
  if (result.error === 'linkExpired') return { kind: 'refused' };
  return { kind: 'retry', error: result.error, tokenHash };
}
