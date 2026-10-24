// Helpers shared by the account-admin actions.

import { serviceClient } from '../../_shared/clients.ts';

export type AccountRecord = {
  id: string;
  email: string;
  role: string;
  status: 'invited' | 'active';
  is_active: boolean;
  joined_at: string | null;
  last_sign_in_at: string | null;
};

export type FamilyRole = 'student' | 'parent';

export type StudentRecord = {
  id: string;
  full_name: string;
  is_active: boolean;
  profile_id: string | null;
  consent_recorded_at: string | null;
};

const ACCOUNT_COLUMNS = 'id, email, role, status, is_active, joined_at, last_sign_in_at';

/** Anyone's profile (read with the secret key), or null if there isn't one. */
export async function findAccount(userId: string): Promise<AccountRecord | null> {
  const { data } = await serviceClient()
    .from('profiles')
    .select(ACCOUNT_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  return data;
}

/** The profile using this e-mail (already lower-case), or null. */
export async function findAccountByEmail(email: string): Promise<AccountRecord | null> {
  const { data } = await serviceClient()
    .from('profiles')
    .select(ACCOUNT_COLUMNS)
    .eq('email', email)
    .maybeSingle();
  return data;
}

/** A roster row, or null. */
export async function findStudent(studentId: string): Promise<StudentRecord | null> {
  const { data } = await serviceClient()
    .from('students')
    .select('id, full_name, is_active, profile_id, consent_recorded_at')
    .eq('id', studentId)
    .maybeSingle();
  return data;
}

/**
 * Creates a student or parent account without sending anything yet. The role goes in
 * app_metadata, which only the server can set (R3b D2); the database turns it into the profile
 * role (F30), and we check that it did before going on.
 */
export async function createFamilyAccount(
  email: string,
  fullName: string,
  role: FamilyRole,
): Promise<{ userId: string } | { code: string }> {
  const service = serviceClient();
  const { data, error } = await service.auth.admin.createUser({
    email,
    user_metadata: { full_name: fullName, account_role: role }, // only words the invite e-mail
    app_metadata: { account_role: role },
  });
  if (error || !data.user) {
    return { code: error?.code === 'email_exists' ? 'already_exists' : 'server_error' };
  }

  const created = await findAccount(data.user.id);
  if (created?.role !== role) {
    await deleteAccount(data.user.id);
    return { code: 'server_error' };
  }
  return { userId: data.user.id };
}

/** Sends the invite e-mail to an account that hasn't joined yet. */
export async function sendInvite(email: string): Promise<boolean> {
  const { error } = await serviceClient().auth.admin.inviteUserByEmail(email);
  return !error;
}

/**
 * A new link for someone who opened their invite but didn't finish the setup form.
 * Supabase won't send an invite to a confirmed e-mail, so this sends a password-reset link
 * instead; it lands on the same setup form, because the account is still invited.
 */
export async function sendSetupLink(userId: string, email: string): Promise<boolean> {
  const service = serviceClient();
  const { data, error } = await service.auth.admin.getUserById(userId);
  if (error || !data.user) return false;

  const { error: sendError } = data.user.email_confirmed_at
    ? await service.auth.resetPasswordForEmail(email)
    : await service.auth.admin.inviteUserByEmail(email);
  return !sendError;
}

/** Removes an account that was only just created (undo). Its links go with it. */
export async function deleteAccount(userId: string): Promise<void> {
  await serviceClient().auth.admin.deleteUser(userId);
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
