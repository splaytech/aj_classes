// Send a fresh invite link to someone who hasn't joined yet (R2a story US15; any role, R3b).
// "Joined" means they finished the setup form (invite-onboarding design). A re-send always emails
// a new 14-day invite link, never a password reset, even to someone who opened their old link
// (ADR-0010, AC 14). The old link is switched off only once the new email was accepted: a failed
// re-send changes nothing (AC 39).

import type { Caller } from '../../_shared/auth.ts';
import { fail, succeed } from '../../_shared/responses.ts';
import type { ActionResult } from '../../_shared/responses.ts';
import { isUuid } from '../../_shared/validation.ts';

import { audit, findAccount, sendAccountInvite } from './accounts.ts';

export async function resendInvite(
  input: Record<string, unknown>,
  caller: Caller,
): Promise<ActionResult> {
  if (!isUuid(input.userId)) return fail('invalid_request');

  const target = await findAccount(input.userId);
  if (!target) return fail('not_found');
  if (target.status !== 'invited') return fail('already_joined');

  if (!(await sendAccountInvite(target))) return fail('email_failed');

  await audit(caller.id, 'invite_resent', target.id, { email: target.email });
  return succeed();
}
