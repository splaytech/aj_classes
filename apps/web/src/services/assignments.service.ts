// Assignments and marking (R3a stories TS3–TS5, AS7; R3b FT1–FT3). The class tutor or an admin
// may set homework, publish it and record marks; the database checks enrolment, publishing and
// mark limits (R3a design §3–§4, R3b §3). Questions and online submissions are in
// questions.service.ts and submissions.service.ts.

import { toErrorKey } from './auth-errors';
import { toStudentSummary } from './classes.service';
import type { StudentRow } from './classes.service';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import { QUESTION_COLUMNS, toQuestion } from './questions.service';
import type { QuestionRow } from './questions.service';
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
  id, class_id, title, instructions, due_on, max_mark, status,
  class:classes!inner(name, is_active, enrolments(student_id)),
  assignment_questions(marks),
  assignment_results(student_id, status)
`;

export const RESULT_COLUMNS =
  'student_id, status, mark, feedback, marked_at, submitted_at, returned_at, marker:profiles(full_name)';

type AssignmentRow = {
  id: string;
  class_id: string;
  title: string;
  instructions: string;
  due_on: string | null;
  max_mark: number | null;
  status: 'draft' | 'published';
  class: { name: string; is_active: boolean; enrolments: { student_id: string }[] };
  assignment_questions: { marks: number }[];
  assignment_results: { student_id: string; status: ResultStatus }[];
};

export type ResultRow = {
  student_id: string;
  status: ResultStatus;
  mark: number | null;
  feedback: string;
  marked_at: string | null;
  submitted_at: string | null;
  returned_at: string | null;
  marker: { full_name: string } | null;
};

function toAssignmentSummary(row: AssignmentRow): AssignmentSummary {
  const questionMarks = row.assignment_questions.map((question) => question.marks);
  return {
    id: row.id,
    classId: row.class_id,
    className: row.class.name,
    title: row.title,
    instructions: row.instructions,
    dueOn: row.due_on,
    maxMark: row.max_mark,
    isPublished: row.status === 'published',
    questionCount: questionMarks.length,
    totalMarks:
      questionMarks.length > 0
        ? questionMarks.reduce((sum, marks) => sum + marks, 0)
        : row.max_mark,
    enrolledStudentIds: row.class.enrolments.map((enrolment) => enrolment.student_id),
    statuses: row.assignment_results.map((result) => ({
      studentId: result.student_id,
      status: result.status,
    })),
  };
}

export function toResult(row: ResultRow): AssignmentResult {
  return {
    studentId: row.student_id,
    status: row.status,
    mark: row.mark === null ? null : Number(row.mark),
    feedback: row.feedback,
    markedAt: row.marked_at,
    markedByName: row.marker?.full_name ?? '',
    submittedAt: row.submitted_at,
    returnedAt: row.returned_at,
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
    const [students, results, questions] = await Promise.all([
      supabase
        .from('enrolments')
        .select('student:students(id, full_name, year_level, is_active)')
        .eq('class_id', assignment.classId),
      supabase.from('assignment_results').select(RESULT_COLUMNS).eq('assignment_id', assignmentId),
      supabase
        .from('assignment_questions')
        .select(QUESTION_COLUMNS)
        .eq('assignment_id', assignmentId)
        .order('position'),
    ]);
    if (students.error) return fail(toErrorKey(students.error));
    if (results.error) return fail(toErrorKey(results.error));
    if (questions.error) return fail(toErrorKey(questions.error));

    return succeed({
      ...assignment,
      students: (students.data as unknown as { student: StudentRow | null }[])
        .map((row) => row.student)
        .filter((student): student is StudentRow => student !== null)
        .map(toStudentSummary)
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
      results: (results.data as unknown as ResultRow[]).map(toResult),
      questions: (questions.data as unknown as QuestionRow[]).map(toQuestion),
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

/** Publishes an assignment to its class, or moves it back to draft (R3b FT2). */
export async function setAssignmentPublished(
  assignmentId: string,
  published: boolean,
): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('assignments')
      .update({ status: published ? 'published' : 'draft' })
      .eq('id', assignmentId)
      .select('id')
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    return data ? succeed() : fail('notAllowed');
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
  const resultColumns = RESULT_COLUMNS;

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
