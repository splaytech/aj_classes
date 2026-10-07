// Questions of online assignments (R3b story FT1). The class tutor or an admin may change them
// while the assignment is a draft; the database refuses once it's published (F9) and puts new
// questions last.

import type { QuestionKind } from '@/constants';

import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type { Question, QuestionInput, Result } from './types';

export const QUESTION_COLUMNS =
  'id, assignment_id, position, kind, prompt, options, correct_option, marks, explanation';

export type QuestionRow = {
  id: string;
  assignment_id: string;
  position: number;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  correct_option: number | null;
  marks: number;
  explanation: string;
};

export function toQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    position: row.position,
    kind: row.kind,
    prompt: row.prompt,
    options: row.options,
    correctOption: row.correct_option,
    marks: row.marks,
    explanation: row.explanation,
  };
}

/** Adds a question (it goes last) or updates one. Written questions have no options. */
export async function saveQuestion(input: QuestionInput): Promise<Result> {
  const isMultipleChoice = input.kind === 'multiple_choice';
  const columns = {
    kind: input.kind,
    prompt: input.prompt.trim(),
    options: isMultipleChoice ? input.options.map((option) => option.trim()) : [],
    correct_option: isMultipleChoice ? input.correctOption : null,
    marks: input.marks,
    explanation: input.explanation.trim(),
  };

  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = input.id
      ? await supabase
          .from('assignment_questions')
          .update(columns)
          .eq('id', input.id)
          .select('id')
          .maybeSingle()
      : await supabase
          .from('assignment_questions')
          .insert({ assignment_id: input.assignmentId, ...columns })
          .select('id')
          .maybeSingle();

    if (error) return fail(toErrorKey(error));
    return data ? succeed() : fail('notAllowed');
  });
}

export async function deleteQuestion(questionId: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('assignment_questions')
      .delete()
      .eq('id', questionId)
      .select('id')
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    return data ? succeed() : fail('notAllowed');
  });
}

/** Swaps a question with the one above (-1) or below (+1). */
export async function moveQuestion(questionId: string, step: -1 | 1): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('move_question', { target: questionId, step });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}
