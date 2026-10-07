// Assignments and marking (R3a stories TS3–TS5, AS7). The class tutor or an admin may set
// homework and record marks; the database checks enrolment and mark limits (design §3–§4).

import { toErrorKey } from './auth-errors';
import { toStudentSummary } from './classes.service';
import type { StudentRow } from './classes.service';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type {
  AssignmentDetail,
  AssignmentInput,
  AssignmentResult,
  AssignmentSummary,
  Result,
  ResultInput,
  ResultStatus,
} from './types';

const ASSIGNMENT_COLUMNS = `
  id, class_id, title, instructions, due_on, max_mark,
  class:classes!inner(name, is_active, enrolments(student_id)),
  assignment_results(student_id, status)
`;

type AssignmentRow = {
  id: string;
  class_id: string;
  title: string;
  instructions: string;
  due_on: string | null;
  max_mark: number | null;
  class: { name: string; is_active: boolean; enrolments: { student_id: string }[] };
  assignment_results: { student_id: string; status: ResultStatus }[];
};

type ResultRow = {
  student_id: string;
  status: ResultStatus;
  mark: number | null;
  feedback: string;
  marked_at: string | null;
  marker: { full_name: string } | null;
};

function toAssignmentSummary(row: AssignmentRow): AssignmentSummary {
  return {
    id: row.id,
    classId: row.class_id,
    className: row.class.name,
    title: row.title,
    instructions: row.instructions,
    dueOn: row.due_on,
    maxMark: row.max_mark,
    enrolledStudentIds: row.class.enrolments.map((enrolment) => enrolment.student_id),
    statuses: row.assignment_results.map((result) => ({
      studentId: result.student_id,
      status: result.status,
    })),
  };
}

function toResult(row: ResultRow): AssignmentResult {
  return {
    studentId: row.student_id,
    status: row.status,
    mark: row.mark === null ? null : Number(row.mark),
    feedback: row.feedback,
    markedAt: row.marked_at,
    markedByName: row.marker?.full_name ?? '',
  };
}

/**
 * Assignments the person may see: across active classes, or for one class (archived included,
 * so admins can look back) when `classId` is given.
 */
export async function listAssignments(classId?: string): Promise<Result<AssignmentSummary[]>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const query = classId
      ? supabase.from('assignments').select(ASSIGNMENT_COLUMNS).eq('class_id', classId)
      : supabase.from('assignments').select(ASSIGNMENT_COLUMNS).eq('class.is_active', true);

    const { data, error } = await query;
    if (error) return fail(toErrorKey(error));
    return succeed((data as unknown as AssignmentRow[]).map(toAssignmentSummary));
  });
}

export async function getAssignment(assignmentId: string): Promise<Result<AssignmentDetail>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('assignments')
      .select(ASSIGNMENT_COLUMNS)
      .eq('id', assignmentId)
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    if (!data) return fail('notFound');

    const assignment = toAssignmentSummary(data as unknown as AssignmentRow);
    const [students, results] = await Promise.all([
      supabase
        .from('enrolments')
        .select('student:students(id, full_name, year_level, is_active)')
        .eq('class_id', assignment.classId),
      supabase
        .from('assignment_results')
        .select('student_id, status, mark, feedback, marked_at, marker:profiles(full_name)')
        .eq('assignment_id', assignmentId),
    ]);
    if (students.error) return fail(toErrorKey(students.error));
    if (results.error) return fail(toErrorKey(results.error));

    return succeed({
      ...assignment,
      students: (students.data as unknown as { student: StudentRow | null }[])
        .map((row) => row.student)
        .filter((student): student is StudentRow => student !== null)
        .map(toStudentSummary)
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
      results: (results.data as unknown as ResultRow[]).map(toResult),
    });
  });
}

/** Creates or updates an assignment. Returns its id. */
export async function saveAssignment(input: AssignmentInput): Promise<Result<string>> {
  const columns = {
    class_id: input.classId,
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    due_on: input.dueOn,
    max_mark: input.maxMark,
  };

  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = input.id
      ? await supabase
          .from('assignments')
          .update(columns)
          .eq('id', input.id)
          .select('id')
          .maybeSingle()
      : await supabase.from('assignments').insert(columns).select('id').maybeSingle();

    if (error) return fail(toErrorKey(error));
    return data ? succeed(data.id) : fail('notAllowed');
  });
}

/** Deletes an assignment and all its marks (R3a review H16). */
export async function deleteAssignment(assignmentId: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', assignmentId)
      .select('id')
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    return data ? succeed() : fail('notAllowed');
  });
}

/**
 * Saves one student's status, mark and feedback. Updates the existing row, or creates it the
 * first time. Who marked it, and when, is filled in by the database (review H6).
 */
export async function saveResult(input: ResultInput): Promise<Result<AssignmentResult>> {
  const columns = { status: input.status, mark: input.mark, feedback: input.feedback.trim() };
  const resultColumns = 'student_id, status, mark, feedback, marked_at, marker:profiles(full_name)';

  return attempt(async () => {
    const supabase = await getSupabase();
    const updated = await supabase
      .from('assignment_results')
      .update(columns)
      .eq('assignment_id', input.assignmentId)
      .eq('student_id', input.studentId)
      .select(resultColumns)
      .maybeSingle();
    if (updated.error) return fail(toErrorKey(updated.error));
    if (updated.data) return succeed(toResult(updated.data as unknown as ResultRow));

    const inserted = await supabase
      .from('assignment_results')
      .insert({ assignment_id: input.assignmentId, student_id: input.studentId, ...columns })
      .select(resultColumns)
      .maybeSingle();
    if (inserted.error) return fail(toErrorKey(inserted.error));
    return inserted.data
      ? succeed(toResult(inserted.data as unknown as ResultRow))
      : fail('notAllowed');
  });
}
