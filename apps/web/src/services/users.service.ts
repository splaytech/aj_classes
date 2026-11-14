// Admin → Users (open sign-up, ADR-0011; 03 §7.2): people who signed up on the website, and the
// sign-up switch. Deactivate and reactivate reuse staff.service setAccountActive.

import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { getAdminClient } from './staff-client';
import type { Result, SignedUpUser } from './types';

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  signed_up_at: string;
  signed_up_with: string;
  finished: boolean;
  is_active: boolean;
};

function toSignedUpUser(row: UserRow): SignedUpUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    signedUpAt: row.signed_up_at,
    signedUpWith: row.signed_up_with === 'google' ? 'google' : 'email',
    finished: row.finished,
    isActive: row.is_active,
  };
}

export async function listUsers(): Promise<Result<SignedUpUser[]>> {
  return attempt(async () => {
    const supabase = await getAdminClient();
    if (!supabase) return fail('notAllowed'); // not an admin with two-step: the layout shows the right page
    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) return fail(toErrorKey(error));
    return succeed((data as UserRow[]).map(toSignedUpUser));
  });
}

/** Admin → Users → Close / Open sign-up (AC-48). */
export async function setSignUpOpen(isOpen: boolean): Promise<Result> {
  return attempt(async () => {
    const supabase = await getAdminClient();
    if (!supabase) return fail('notAllowed');
    const { error } = await supabase.rpc('admin_set_sign_up_open', { is_open: isOpen });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}
