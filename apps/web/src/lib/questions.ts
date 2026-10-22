// Question rules for online assignments (R3b stories FT1, FT3): form checks, totals, option
// letters and marking input. The database enforces the same limits (R3b design §3).

import { OPTION_LETTERS, QUESTION_LIMITS, QUESTION_VALIDATION, SUBMISSION_PAGE } from '@/constants';
import type { Question, QuestionInput } from '@/services';

export type QuestionErrors = Partial<
  Record<'prompt' | 'options' | 'correctOption' | 'marks' | 'explanation', string>
>;

export function validateQuestion(input: QuestionInput): QuestionErrors {
  const errors: QuestionErrors = {};
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > QUESTION_LIMITS.promptMax) {
    errors.prompt = QUESTION_VALIDATION.promptLength;
  }

  if (input.kind === 'multiple_choice') {
    const options = input.options.map((option) => option.trim());
    if (
      options.length < QUESTION_LIMITS.optionsMin ||
      options.length > QUESTION_LIMITS.optionsMax
    ) {
      errors.options = QUESTION_VALIDATION.optionsCount;
    } else if (options.some((option) => !option || option.length > QUESTION_LIMITS.optionMax)) {
      errors.options = QUESTION_VALIDATION.optionLength;
    }
    const correct = input.correctOption;
    if (correct === null || correct < 0 || correct >= options.length) {
      errors.correctOption = QUESTION_VALIDATION.correctOption;
    }
  }

  if (
    !Number.isInteger(input.marks) ||
    input.marks < QUESTION_LIMITS.marksMin ||
    input.marks > QUESTION_LIMITS.marksMax
  ) {
    errors.marks = QUESTION_VALIDATION.marksRange;
  }
  if (input.explanation.length > QUESTION_LIMITS.explanationMax) {
    errors.explanation = QUESTION_VALIDATION.explanationLength;
  }
  return errors;
}

export function totalMarks(questions: Pick<Question, 'marks'>[]): number {
  return questions.reduce((sum, question) => sum + question.marks, 0);
}

/** "A" for the first option, "B" for the second… */
export function optionLetter(index: number): string {
  return OPTION_LETTERS[index] ?? String(index + 1);
}

/** Marks such as 2.5 show without a trailing ".0". */
export function formatMarks(marks: number): string {
  return Number.isInteger(marks) ? String(marks) : marks.toFixed(1);
}

export type ParsedMark = { value: number | null; error: string };

/**
 * A tutor's mark for one answer, from the text box: empty means "not marked yet"; otherwise a
 * number from 0 to the question's marks, in halves.
 */
export function parseAnswerMark(text: string, outOf: number): ParsedMark {
  const trimmed = text.trim();
  if (!trimmed) return { value: null, error: '' };

  const value = Number(trimmed);
  const inHalves = Number.isInteger(value * 2);
  if (Number.isNaN(value) || value < 0 || value > outOf || !inHalves) {
    return { value: null, error: SUBMISSION_PAGE.markRange(outOf) };
  }
  return { value, error: '' };
}
