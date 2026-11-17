// Mock test rules (docs/delivery/2026-11-17-mock-tests, design §6): form checks, which area a page
// is in, the counts the take form shows, and whether a released test has closed
// (docs/delivery/2026-11-18-mock-test-closing). The database enforces the same rules.

import {
  MOCK_CLOSING,
  MOCK_RESULT,
  MOCK_TAKER_AREAS,
  MOCK_TEST_LIMITS,
  MOCK_VALIDATION,
  QUESTION_LIMITS,
} from '@/constants';
import type { MockTakerArea } from '@/constants';
import { formatDateTime } from '@/lib/format';
import type { MockQuestionInput, MockTestInput } from '@/services';

/** A released test with no closing time never closes; from its closing time on it is closed. */
export type MockClosingState = 'never' | 'open' | 'closed';

export type MockTestErrors = Partial<Record<'title' | 'instructions', string>>;

export type MockQuestionErrors = Partial<
  Record<'prompt' | 'options' | 'correctOption' | 'explanation', string>
>;

export function validateMockTest(input: MockTestInput): MockTestErrors {
  const errors: MockTestErrors = {};
  const title = input.title.trim();
  if (title.length < MOCK_TEST_LIMITS.titleMin || title.length > MOCK_TEST_LIMITS.titleMax) {
    errors.title = MOCK_VALIDATION.title;
  }
  if (input.instructions.length > MOCK_TEST_LIMITS.instructionsMax) {
    errors.instructions = MOCK_VALIDATION.instructions;
  }
  return errors;
}

/** `trim()` also removes tabs and line breaks, so a prompt of only those counts as empty. */
export function validateMockQuestion(
  input: Pick<MockQuestionInput, 'prompt' | 'options' | 'correctOption' | 'explanation'>,
): MockQuestionErrors {
  const errors: MockQuestionErrors = {};
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > QUESTION_LIMITS.promptMax) {
    errors.prompt = MOCK_VALIDATION.prompt;
  }

  const options = input.options.map((option) => option.trim());
  if (options.length < QUESTION_LIMITS.optionsMin || options.length > QUESTION_LIMITS.optionsMax) {
    errors.options = MOCK_VALIDATION.optionsCount;
  } else if (options.some((option) => !option || option.length > QUESTION_LIMITS.optionMax)) {
    errors.options = MOCK_VALIDATION.optionLength;
  }

  const correct = input.correctOption;
  if (correct === null || correct < 0 || correct >= options.length) {
    errors.correctOption = MOCK_VALIDATION.correctOption;
  }
  if (input.explanation.length > QUESTION_LIMITS.explanationMax) {
    errors.explanation = MOCK_VALIDATION.explanation;
  }
  return errors;
}

export function hasMockErrors(errors: MockTestErrors | MockQuestionErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The area is the second part of the path: /portal/<area>/mock-tests/... */
export function mockTestAreaFromPath(pathname: string): MockTakerArea {
  const segment = pathname.split('/')[2];
  return MOCK_TAKER_AREAS.find((area) => area === segment) ?? 'student';
}

/** Questions with no chosen option yet. `answers` maps a question id to its chosen option. */
export function unansweredCount(
  questions: { id: string }[],
  answers: Record<string, number | null>,
): number {
  return questions.filter((question) => answers[question.id] == null).length;
}

export function mockScoreText(score: number, total: number): string {
  return MOCK_RESULT.score(score, total);
}

/** The same rule as the database: closes_at at or before now counts as closed (AC 8). */
export function mockClosingState(closesAt: string | null, now: Date): MockClosingState {
  if (!closesAt) return 'never';
  return new Date(closesAt).getTime() <= now.getTime() ? 'closed' : 'open';
}

/** The reason a closing time can't be saved, or undefined. Empty is fine: it never closes. */
export function closesAtError(value: Date | null, now: Date): string | undefined {
  if (value === null) return undefined;
  if (Number.isNaN(value.getTime())) return MOCK_VALIDATION.closesInvalid;
  if (value.getTime() <= now.getTime()) return MOCK_VALIDATION.closesInPast;
  return undefined;
}

/** "Closes 8 Oct 2026, 4:05 pm", "Closed …", or empty when it never closes (AC 6, 9). */
export function mockClosingText(closesAt: string | null, now: Date): string {
  const state = mockClosingState(closesAt, now);
  if (state === 'never') return '';
  const when = formatDateTime(closesAt);
  return state === 'closed' ? MOCK_CLOSING.closed(when) : MOCK_CLOSING.closes(when);
}
