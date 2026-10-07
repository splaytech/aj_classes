// Deactivate or reactivate a staff member (R2a story US17).
// The database function makes the decision (guards + audit) as the caller; the ban stops their
// sessions refreshing. The order means a half-finished action always leaves NO access (R2a G26).

import type { Caller } from '../../_shared/auth.ts';
import { serviceClient } from '../../_shared/clients.ts';
import { fail, succeed } from '../../_shared/responses.ts';
import type { ActionResult } from '../../_shared/responses.ts';
import { isUuid } from '../../_shared/validation.ts';

const BAN_FOREVER = '876000h'; // 100 years; 'infinity' breaks sign-in (R2a review)
const NO_BAN = 'none';
const DATABASE_REFUSALS = ['last_admin', 'cannot_deactivate_self', 'not_joined', 'not_found'];

export async function setActive(
  input: Record<string, unknown>,
  caller: Caller,
): Promise<ActionResult> {
  if (!isUuid(input.userId) || typeof input.active !== 'boolean') return fail('invalid_request');
  const userId = input.userId;
  const active = input.active;

  if (active) {
    const unban = await setBan(userId, NO_BAN);
    if (!unban) return fail('ban_failed');
    return recordActive(caller, userId, true);
  }

  const recorded = await recordActive(caller, userId, false);
  if (!recorded.ok) return recorded;
  return (await setBan(userId, BAN_FOREVER)) ? succeed() : fail('ban_failed');
}

async function recordActive(
  caller: Caller,
  userId: string,
  active: boolean,
): Promise<ActionResult> {
  const { error } = await caller.client.rpc('admin_set_active', { target: userId, active });
  if (!error) return succeed();
  return fail(DATABASE_REFUSALS.includes(error.message) ? error.message : 'not_allowed');
}

async function setBan(userId: string, duration: string): Promise<boolean> {
  const { error } = await serviceClient().auth.admin.updateUserById(userId, {
    ban_duration: duration,
  });
  return !error;
}
