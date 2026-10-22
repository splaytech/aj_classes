// Send a fresh invite link to someone who hasn't joined yet (R2a story US15; any role, R3b).
// The e-mail keeps its staff / student / parent wording: it comes from the stored user metadata.

import type { Caller } from '../../_shared/auth.ts';
import { serviceClient } from '../../_shared/clients.ts';
import { fail, succeed } from '../../_shared/responses.ts';
import type { ActionResult } from '../../_shared/responses.ts';
import { isUuid } from '../../_shared/validation.ts';

import { audit, findAccount } from './accounts.ts';

export async function resendInvite(
  input: Record<string, unknown>,
  caller: Caller,
): Promise<ActionResult> {
  if (!isUuid(input.userId)) return fail('invalid_request');

  const target = await findAccount(input.userId);
  if (!target) return fail('not_found');
  if (target.joined_at) return fail('already_joined');

  const { error } = await serviceClient().auth.admin.inviteUserByEmail(target.email);
  if (error) return fail('email_failed');

  await audit(caller.id, 'invite_resent', target.id, { email: target.email });
  return succeed();
}
