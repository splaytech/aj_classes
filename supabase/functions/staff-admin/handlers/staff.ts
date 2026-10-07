// Helpers shared by the staff-admin actions.

import { serviceClient } from '../../_shared/clients.ts';

export type StaffRecord = {
  id: string;
  email: string;
  joined_at: string | null;
  last_sign_in_at: string | null;
};

/** The staff member's profile (read with the secret key), or null if there isn't one. */
export async function findStaff(userId: string): Promise<StaffRecord | null> {
  const { data } = await serviceClient()
    .from('profiles')
    .select('id, email, joined_at, last_sign_in_at')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

/** Writes an audit entry. Only the secret key may call admin_log (R2a design §6.3). */
export async function audit(
  actorId: string,
  action: string,
  targetId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  await serviceClient().rpc('admin_log', {
    actor: actorId,
    action,
    target: targetId,
    details,
  });
}
