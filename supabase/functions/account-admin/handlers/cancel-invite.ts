// Cancel an invite sent to the wrong address (R2a story US15; students and parents too, R3b FA3).
// Only for people who never finished the setup form, so nobody with history can be deleted
// (R2a G24): until then an account can't see or change anything (invite-onboarding design).
// A student's roster row and a parent's links stay; only the account goes.
//
// Race with the person finishing setup at the same moment: one statement switches off an account
// that is still invited. complete_onboarding() locks the same row and needs it switched on, so
// exactly one of the two wins. If the delete then fails, the account is switched back on.

import type { Caller } from '../../_shared/auth.ts';
import { serviceClient } from '../../_shared/clients.ts';
import { fail, succeed } from '../../_shared/responses.ts';
import type { ActionResult } from '../../_shared/responses.ts';
import { isUuid } from '../../_shared/validation.ts';

import { audit, findAccount } from './accounts.ts';

export async function cancelInvite(
  input: Record<string, unknown>,
  caller: Caller,
): Promise<ActionResult> {
  if (!isUuid(input.userId)) return fail('invalid_request');

  const target = await findAccount(input.userId);
  if (!target) return fail('not_found');
  if (target.status !== 'invited') return fail('already_joined');

  const service = serviceClient();
  const { data: claimed, error: claimError } = await service
    .from('profiles')
    .update({ is_active: false })
    .eq('id', target.id)
    .eq('status', 'invited')
    .select('id');
  if (claimError) return fail('cancel_failed');
  if (!claimed?.length) return fail('already_joined');

  const { error } = await service.auth.admin.deleteUser(target.id);
  if (error) {
    await service.from('profiles').update({ is_active: target.is_active }).eq('id', target.id);
    return fail('cancel_failed');
  }

  // The target row is gone, so keep the e-mail in the details (R2a design §10).
  await audit(caller.id, 'invite_cancelled', null, { email: target.email });
  return succeed();
}
