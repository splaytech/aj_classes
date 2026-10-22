// The parent portal (R3b stories FP1–FP3). Everything goes through the parent functions, which
// only return the signed-in parent's own linked children (F6) and keep draft answers private (FP2).

import { toErrorKey } from './auth-errors';
import { toFamilyAssignment, toFamilyAssignmentView, toTimetableEntry } from './family-data';
import type { FamilyAssignmentJson, FamilyAssignmentRow, FamilyTimetableRow } from './family-data';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type {
  Child,
  ChildAccountStatus,
  FamilyAssignment,
  FamilyAssignmentView,
  Result,
  TimetableEntry,
} from './types';

type ChildRow = {
  student_id: string;
  full_name: string;
  year_level: number | null;
  consent_recorded_at: string | null;
  account_status: ChildAccountStatus;
  class_names: string[];
};

function toChild(row: ChildRow): Child {
  return {
    id: row.student_id,
    fullName: row.full_name,
    yearLevel: row.year_level,
    consentRecordedAt: row.consent_recorded_at,
    accountStatus: row.account_status,
    classNames: row.class_names,
  };
}

export async function listMyChildren(): Promise<Result<Child[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('parent_children');
    if (error) return fail(toErrorKey(error));
    return succeed((data as unknown as ChildRow[]).map(toChild));
  });
}

export async function listChildAssignments(studentId: string): Promise<Result<FamilyAssignment[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('parent_child_assignments', {
      target_student: studentId,
    });
    if (error) return fail(toErrorKey(error));
    return succeed((data as unknown as FamilyAssignmentRow[]).map(toFamilyAssignment));
  });
}

export async function getChildAssignment(
  studentId: string,
  assignmentId: string,
): Promise<Result<FamilyAssignmentView>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('parent_child_assignment', {
      target_student: studentId,
      target_assignment: assignmentId,
    });
    if (error) return fail(toErrorKey(error));
    return succeed(toFamilyAssignmentView(data as unknown as FamilyAssignmentJson));
  });
}

export async function getChildTimetable(studentId: string): Promise<Result<TimetableEntry[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('parent_child_timetable', {
      target_student: studentId,
    });
    if (error) return fail(toErrorKey(error));
    return succeed((data as unknown as FamilyTimetableRow[]).map(toTimetableEntry));
  });
}

/** Allows the child to have their own account (FP3). Recorded once; audited. */
export async function giveConsent(studentId: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('parent_give_consent', { target_student: studentId });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}
