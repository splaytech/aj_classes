// The decision logic of invite-redeem (ADR-0010 decision 4; 03-design §4.3), with every bit of I/O
// passed in so the Node test script can check each branch with fakes.
// Order: shape → claim (rate limit + single use, in SQL) → the account's e-mail → a one-time
// Supabase recovery token → identity check. After a successful claim, every refusal and every
// throw first releases the claim, so a failed sign-in hop never uses up the link.

import { hashInviteToken, isInviteToken } from '../_shared/invite-token.ts';

export type RecoveryLink = {
  userId: string;
  verificationType: string;
  hashedToken: string;
};

export type RedeemSteps = {
  claim: (hash: string) => Promise<string | null | 'rate_limited'>; // invite_token_claim
  release: (hash: string) => Promise<void>; // invite_token_release
  emailOf: (profileId: string) => Promise<string | null>; // null: no such auth user
  recoveryLink: (email: string) => Promise<RecoveryLink | null>; // null: 404 user_not_found
};

export type RefusalReason =
  'shape' | 'claim' | 'rate_limited' | 'no_user' | 'not_found' | 'mismatch';

export type RedeemOutcome =
  { kind: 'ok'; tokenHash: string } | { kind: 'refused'; reason: RefusalReason };

const refused = (reason: RefusalReason): RedeemOutcome => ({ kind: 'refused', reason });

export async function redeemInvite(token: unknown, steps: RedeemSteps): Promise<RedeemOutcome> {
  if (!isInviteToken(token)) return refused('shape'); // no database call for a garbled token

  const hash = await hashInviteToken(token);
  const claimed = await steps.claim(hash); // a throw here claimed nothing (one SQL transaction)
  if (claimed === 'rate_limited') return refused('rate_limited');
  if (claimed === null) return refused('claim');

  let outcome: RedeemOutcome;
  try {
    outcome = await signInHop(claimed, steps);
  } catch (error) {
    await steps.release(hash);
    throw error;
  }
  if (outcome.kind === 'refused') await steps.release(hash);
  return outcome;
}

async function signInHop(profileId: string, steps: RedeemSteps): Promise<RedeemOutcome> {
  const email = await steps.emailOf(profileId);
  if (email === null) return refused('no_user');

  const link = await steps.recoveryLink(email);
  if (link === null) return refused('not_found'); // deleted between the claim and now

  // A link for any other account, or of any other type, is refused and nothing is deleted: this
  // signed-out endpoint never removes a user (06-security finding 2). The claim is released.
  if (link.userId !== profileId || link.verificationType !== 'recovery') return refused('mismatch');
  return { kind: 'ok', tokenHash: link.hashedToken };
}

const WARN_REASONS: ReadonlySet<RefusalReason> = new Set(['rate_limited', 'mismatch']);

/** Logs the outcome by name only: never the token, a hash, an e-mail or a user id (AC 8). */
export function logRedeemOutcome(outcome: RedeemOutcome): void {
  if (outcome.kind === 'ok') {
    console.info('invite-redeem', 'ok');
  } else if (WARN_REASONS.has(outcome.reason)) {
    console.warn('invite-redeem', outcome.reason);
  } else {
    console.info('invite-redeem', outcome.reason);
  }
}
