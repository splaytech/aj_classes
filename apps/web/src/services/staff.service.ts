// Staff management for admins (R2a stories US1, US10, US14–US17).
// Reads and role changes go straight to the database (it checks the caller is an admin);
// invites, deactivation and two-step resets go through the account-admin edge function.

import type { StaffRole } from '@/constants';

import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { callAccountAdmin } from './account-admin.client';
import { getSupabase } from './supabase.client';
import type { Result, StaffMember } from './types';

type StaffRow = {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  invited_at: string | null;
  joined_at: string | null;
  last_sign_in_at: string | null;
  has_two_step: boolean;
};

function toStaffMember(row: StaffRow): StaffMember {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    invitedAt: row.invited_at,
    joinedAt: row.joined_at,
    lastSignInAt: row.last_sign_in_at,
    hasTwoStep: row.has_two_step,
  };
}

export async function listStaff(): Promise<Result<StaffMember[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('admin_list_staff');
    if (error) return fail(toErrorKey(error));
    return succeed((data as StaffRow[]).map(toStaffMember));
  });
}

export async function getStaffMember(userId: string): Promise<Result<StaffMember>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('admin_list_staff', { target: userId });
    if (error) return fail(toErrorKey(error));
    const row = (data as StaffRow[])[0];
    return row ? succeed(toStaffMember(row)) : fail('notFound');
  });
}

export async function setStaffRole(userId: string, role: StaffRole): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('admin_set_role', { target: userId, new_role: role });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Sends an invite e-mail; returns the new person's id. */
export async function inviteStaff(email: string, fullName: string): Promise<Result<string>> {
  const result = await callAccountAdmin('invite', { email, fullName });
  return result.ok ? succeed(String(result.data.userId)) : result;
}

export async function resendInvite(userId: string): Promise<Result> {
  const result = await callAccountAdmin('resend-invite', { userId });
  return result.ok ? succeed() : result;
}

export async function cancelInvite(userId: string): Promise<Result> {
  const result = await callAccountAdmin('cancel-invite', { userId });
  return result.ok ? succeed() : result;
}

/** Deactivates or reactivates any account: staff, students and parents (R3b FA3). */
export async function setAccountActive(userId: string, active: boolean): Promise<Result> {
  const result = await callAccountAdmin('set-active', { userId, active });
  return result.ok ? succeed() : result;
}

export async function resetStaffTwoStep(userId: string): Promise<Result> {
  const result = await callAccountAdmin('reset-two-step', { userId });
  return result.ok ? succeed() : result;
}
