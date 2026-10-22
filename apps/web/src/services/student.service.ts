// The student portal (R3b stories FS1–FS5). Everything goes through the student functions, which
// only ever return the signed-in student's own work and hide marks until it's returned (D4, F12).

import type { FamilyStatus } from '@/constants';

import { toErrorKey } from './auth-errors';
import { toFamilyAssignment, toFamilyAssignmentView, toTimetableEntry } from './family-data';
import type { FamilyAssignmentJson, FamilyAssignmentRow, FamilyTimetableRow } from './family-data';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type { FamilyAssignment, FamilyAssignmentView, Result, TimetableEntry } from './types';

export async function listMyAssignments(): Promise<Result<FamilyAssignment[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('student_assignments');
    if (error) return fail(toErrorKey(error));
    return succeed((data as unknown as FamilyAssignmentRow[]).map(toFamilyAssignment));
  });
}

export async function getMyAssignment(assignmentId: string): Promise<Result<FamilyAssignmentView>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('student_assignment', { target: assignmentId });
    if (error) return fail(toErrorKey(error));
    return succeed(toFamilyAssignmentView(data as unknown as FamilyAssignmentJson));
  });
}

/** What the student picked (multiple choice) or wrote (written answer). */
export type AnswerChange = { option: number | null } | { text: string };

/** Saves one answer while the work isn't submitted yet (autosave, F10). */
export async function saveMyAnswer(
  assignmentId: string,
  questionId: string,
  change: AnswerChange,
): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('student_save_answer', {
      target_assignment: assignmentId,
      target_question: questionId,
      ...('option' in change ? { chosen_option: change.option ?? undefined } : {}),
      ...('text' in change ? { answer_text: change.text } : {}),
    });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Hands the work in. Returns "returned" when it was all multiple choice (marked straight away). */
export async function submitMyAssignment(assignmentId: string): Promise<Result<FamilyStatus>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('student_submit', {
      target_assignment: assignmentId,
    });
    if (error) return fail(toErrorKey(error));
    return succeed(data as FamilyStatus);
  });
}

export async function getMyTimetable(): Promise<Result<TimetableEntry[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('student_timetable');
    if (error) return fail(toErrorKey(error));
    return succeed((data as unknown as FamilyTimetableRow[]).map(toTimetableEntry));
  });
}
