// Send a fresh invite link to someone who hasn't joined yet (R2a story US15; any role, R3b).
// "Joined" now means they finished the setup form (invite-onboarding design): someone who only
// clicked their old link gets a new link to the same form.

import type { Caller } from '../../_shared/auth.ts';
import { fail, succeed } from '../../_shared/responses.ts';
import type { ActionResult } from '../../_shared/responses.ts';
import { isUuid } from '../../_shared/validation.ts';

import { audit, findAccount, sendSetupLink } from './accounts.ts';

export async function resendInvite(
  input: Record<string, unknown>,
  caller: Caller,
): Promise<ActionResult> {
  if (!isUuid(input.userId)) return fail('invalid_request');

  const target = await findAccount(input.userId);
  if (!target) return fail('not_found');
  if (target.status !== 'invited') return fail('already_joined');

  if (!(await sendSetupLink(target.id, target.email))) return fail('email_failed');

  await audit(caller.id, 'invite_resent', target.id, { email: target.email });
  return succeed();
}
