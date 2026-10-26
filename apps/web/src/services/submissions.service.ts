// One student's online work, for staff (R3b story FT3): their answers, the marking, the overall
// comment and returning it. The database checks the work was submitted, marks are within each
// question's marks, and every answer has a mark before it's returned (F11–F13).

import { getAssignment } from './assignments.service';
import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type { AnswerMark, Result, Submission, SubmissionAnswer } from './types';

type AnswerRow = {
  question_id: string;
  selected_option: number | null;
  response: string;
  awarded_marks: number | null;
  feedback: string;
};

function toAnswer(row: AnswerRow): SubmissionAnswer {
  return {
    questionId: row.question_id,
    selectedOption: row.selected_option,
    response: row.response,
    awardedMarks: row.awarded_marks === null ? null : Number(row.awarded_marks),
    feedback: row.feedback,
  };
}

export async function getSubmission(
  assignmentId: string,
  studentId: string,
): Promise<Result<Submission>> {
  const assignment = await getAssignment(assignmentId);
  if (!assignment.ok) return assignment;

  const student = assignment.data.students.find((item) => item.id === studentId);
  if (!student) return fail('notFound');

  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('assignment_answers')
      .select('question_id, selected_option, response, awarded_marks, feedback')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId);
    if (error) return fail(toErrorKey(error));

    const { id, title, dueOn, classId, className, totalMarks, questions } = assignment.data;
    return succeed({
      assignment: { id, title, dueOn, classId, className, totalMarks, questions },
      student,
      result: assignment.data.results.find((result) => result.studentId === studentId) ?? null,
      answers: (data as AnswerRow[]).map(toAnswer),
    });
  });
}

/** The columns to write for one answer: multiple choice keeps its automatic mark. */
function answerColumns(mark: AnswerMark): { awarded_marks?: number | null; feedback: string } {
  const feedback = mark.feedback.trim();
  return mark.awardedMarks === undefined
    ? { feedback }
    : { awarded_marks: mark.awardedMarks, feedback };
}

/**
 * Saves the marks and feedback (feedback only for multiple choice) and the overall comment, then returns
 * the work to the student when `returnWork` is set. Saving again is safe if one step fails.
 */
export async function saveSubmission(
  assignmentId: string,
  studentId: string,
  marks: AnswerMark[],
  comment: string,
  returnWork: boolean,
): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();

    for (const mark of marks) {
      const { error } = await supabase
        .from('assignment_answers')
        .update(answerColumns(mark))
        .eq('question_id', mark.questionId)
        .eq('student_id', studentId);
      if (error) return fail(toErrorKey(error));
    }

    const { data, error } = await supabase
      .from('assignment_results')
      .update({ feedback: comment.trim(), ...(returnWork ? { status: 'returned' } : {}) })
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .select('student_id')
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    return data ? succeed() : fail('notAllowed');
  });
}
