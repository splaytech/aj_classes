// Student and parent accounts, for admins (R3b stories FA1–FA3). Reads and consent go to the
// database (it checks the caller is an admin); invites go through the account-admin edge function.
// Resend, cancel and deactivate use the shared account actions in staff.service.ts.

import type { ConsentSource } from '@/constants';
import { CONSENT_COLUMNS, consentsFromColumns } from '@/lib/consents';
import type { ConsentColumns } from '@/lib/consents';

import { toErrorKey } from './auth-errors';
import { callAccountAdmin } from './account-admin.client';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type { FamilyAccount, ParentInviteOutcome, Result, StudentFamily } from './types';

type AccountRow = ConsentColumns & {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  invited_at: string | null;
  joined_at: string | null;
  last_sign_in_at: string | null;
  terms_accepted_at: string | null;
};

type StudentFamilyRow = {
  id: string;
  full_name: string;
  year_level: number | null;
  is_active: boolean;
  consent_recorded_at: string | null;
  consent_source: ConsentSource | null;
  account: AccountRow | null;
  guardians: { parent: AccountRow | null }[];
  enrolments: { class: { id: string; name: string } | null }[];
};

const ACCOUNT_COLUMNS = `id, email, full_name, is_active, invited_at, joined_at, last_sign_in_at, terms_accepted_at, ${CONSENT_COLUMNS}`;

const STUDENT_FAMILY_COLUMNS = `id, full_name, year_level, is_active, consent_recorded_at, consent_source,
  account:profiles!students_profile_id_fkey(${ACCOUNT_COLUMNS}),
  guardians:student_guardians(parent:profiles(${ACCOUNT_COLUMNS})),
  enrolments(class:classes(id, name))`;

function toFamilyAccount(row: AccountRow): FamilyAccount {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    isActive: row.is_active,
    invitedAt: row.invited_at,
    joinedAt: row.joined_at,
    lastSignInAt: row.last_sign_in_at,
    termsAcceptedAt: row.terms_accepted_at,
    consents: consentsFromColumns(row),
  };
}

function byName(first: FamilyAccount, second: FamilyAccount): number {
  return first.fullName.localeCompare(second.fullName);
}

/** A student with their consent, account, parents and classes. */
export async function getStudentFamily(studentId: string): Promise<Result<StudentFamily>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('students')
      .select(STUDENT_FAMILY_COLUMNS)
      .eq('id', studentId)
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    if (!data) return fail('notFound');

    const row = data as unknown as StudentFamilyRow;
    return succeed({
      id: row.id,
      fullName: row.full_name,
      yearLevel: row.year_level,
      isActive: row.is_active,
      consentRecordedAt: row.consent_recorded_at,
      consentSource: row.consent_source,
      account: row.account && toFamilyAccount(row.account),
      parents: row.guardians
        .map((guardian) => guardian.parent)
        .filter((parent): parent is AccountRow => parent !== null)
        .map(toFamilyAccount)
        .sort(byName),
      classes: row.enrolments
        .map((enrolment) => enrolment.class)
        .filter((item): item is { id: string; name: string } => item !== null),
    });
  });
}

/** Records that a parent agreed, e.g. on a paper form (FA1). Recorded once; audited. */
export async function recordConsent(studentId: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('admin_record_consent', { target_student: studentId });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Creates the student's own account and sends the invite (FA3). Needs consent first. */
export async function inviteStudentAccount(
  studentId: string,
  email: string,
): Promise<Result<string>> {
  const result = await callAccountAdmin('invite-student', { studentId, email });
  return result.ok ? succeed(String(result.data.userId)) : result;
}

/** Invites a new parent, or links one who already has an account (FA2). */
export async function inviteParent(
  studentId: string,
  email: string,
  fullName: string,
): Promise<Result<ParentInviteOutcome>> {
  const result = await callAccountAdmin('invite-parent', { studentId, email, fullName });
  if (!result.ok) return result;
  return succeed({ userId: String(result.data.userId), linked: result.data.linked === true });
}

/** Removes a parent's link to this student (F25). Their account stays. */
export async function unlinkParent(studentId: string, parentId: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('admin_unlink_parent', {
      target_student: studentId,
      target_parent: parentId,
    });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}
