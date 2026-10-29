// The order every invite and re-send follows (ADR-0010 decision 3): make a token, send the email,
// and only once the provider accepted it store the token's hash (which replaces the old link and
// sets invited_at). A failed send has written nothing, so a re-send that fails leaves the previous
// link working (AC 39). The I/O is passed in, as in notifications/batch.ts, so the Node test
// script can check the order with fakes.

import type { EmailMessage, SendOutcome } from '../_shared/email/transport.ts';
import { hashInviteToken, newInviteToken } from '../_shared/invite-token.ts';

import { inviteLink, renderInviteEmail } from './invite-email.ts';

export type InviteAccount = { id: string; email: string; role: string };

export type IssueSteps = {
  send: (message: EmailMessage) => Promise<SendOutcome>;
  /** True when invite_token_store returned a time (the account is still invited). */
  store: (tokenHash: string) => Promise<boolean>;
};

export async function issueInvite(
  account: InviteAccount,
  siteUrl: string,
  steps: IssueSteps,
): Promise<boolean> {
  const token = newInviteToken();
  const tokenHash = await hashInviteToken(token);
  const message = renderInviteEmail({
    to: account.email,
    role: account.role,
    link: inviteLink(siteUrl, token),
  });

  const outcome = await steps.send(message);
  if (outcome.outcome !== 'sent') return false;

  // False if the account joined meanwhile or the store failed: the email just sent then holds a
  // link that was never stored, so it is refused (fail safe).
  return steps.store(tokenHash);
}
