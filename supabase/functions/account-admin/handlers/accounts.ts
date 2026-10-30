// Helpers shared by the account-admin actions.

import { serviceClient } from '../../_shared/clients.ts';
import { isSafeEmailConfig } from '../../_shared/email/config.ts';
import { pickTransport, sendEmail } from '../../_shared/email/transport.ts';

import { issueInvite } from '../issue-invite.ts';
import type { InviteAccount } from '../issue-invite.ts';

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
 * Creates an invited account without sending anything yet (ADR-0010: the invite email is ours, so
 * Auth's inviteUserByEmail is no longer used). Student and parent roles go in app_metadata, which
 * only the server can set (R3b D2) and the mobile app reads; the database turns it into the
 * profile role (F30), and we check that it did before going on. Staff join as tutors, with no
 * account_role.
 */
export async function createInvitedAccount(
  email: string,
  fullName: string,
  role: 'tutor' | FamilyRole,
): Promise<{ userId: string } | { code: string }> {
  const service = serviceClient();
  const { data, error } = await service.auth.admin.createUser({
    email,
    user_metadata: { full_name: fullName }, // the profile trigger reads only full_name (R2a G2)
    ...(role === 'tutor' ? {} : { app_metadata: { account_role: role } }),
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

/**
 * Emails a new 14-day invite link to an account that hasn't joined yet, and only once the email
 * was accepted replaces its old link (ADR-0010, issue-invite.ts). False when sending is off
 * (EMAIL_TRANSPORT unset: the kill switch, nothing falls back), the send failed, or the store
 * failed. Never logs the token, its hash, the e-mail or the link (AC 8).
 */
export async function sendAccountInvite(account: InviteAccount): Promise<boolean> {
  const transport = pickTransport((name) => Deno.env.get(name));
  const siteUrl = Deno.env.get('SITE_URL') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (transport === null || !isSafeEmailConfig({ transport, siteUrl, supabaseUrl })) {
    console.error('invite email config missing');
    return false;
  }

  return issueInvite(account, siteUrl, {
    // A fresh key per call: nothing retries an invite automatically, so idempotency is moot.
    send: (message) => sendEmail(transport, message, crypto.randomUUID()),
    store: async (tokenHash) => {
      const { data, error } = await serviceClient().rpc('invite_token_store', {
        target: account.id,
        hash: tokenHash,
      });
      if (error) console.error('invite store failed', error.code);
      return !error && data !== null;
    },
  });
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
