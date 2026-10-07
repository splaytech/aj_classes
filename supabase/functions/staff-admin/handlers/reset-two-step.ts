// Remove all of someone's authenticators when they've lost them (R2a story US10).
// Not for yourself: use Account → Two-step. Supabase e-mails them that a method was removed.

import type { Caller } from '../../_shared/auth.ts';
import { serviceClient } from '../../_shared/clients.ts';
import { fail, succeed } from '../../_shared/responses.ts';
import type { ActionResult } from '../../_shared/responses.ts';
import { isUuid } from '../../_shared/validation.ts';

import { audit, findStaff } from './staff.ts';

export async function resetTwoStep(
  input: Record<string, unknown>,
  caller: Caller,
): Promise<ActionResult> {
  if (!isUuid(input.userId)) return fail('invalid_request');
  if (input.userId === caller.id) return fail('cannot_reset_self');

  const target = await findStaff(input.userId);
  if (!target) return fail('not_found');

  const service = serviceClient();
  const { data, error } = await service.auth.admin.mfa.listFactors({ userId: target.id });
  if (error) return fail('reset_failed');

  for (const factor of data.factors) {
    const removed = await service.auth.admin.mfa.deleteFactor({ id: factor.id, userId: target.id });
    if (removed.error) return fail('reset_failed');
  }

  await audit(caller.id, 'two_step_reset', target.id, { removed: data.factors.length });
  return succeed({ removed: data.factors.length });
}
