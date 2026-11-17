// Mock test rules (docs/delivery/2026-11-17-mock-tests, design §6): form checks, which area a page
// is in, the counts the take form shows, and whether a released test has closed
// (docs/delivery/2026-11-18-mock-test-closing). The database enforces the same rules.

import {
  MOCK_CLOSING,
  MOCK_PASS_LABELS,
  MOCK_RESULT,
  MOCK_RESULTS_PAGE,
  MOCK_TAG_ANY,
  MOCK_TAGS,
  PROGRAMMES,
  YEAR_LEVEL_TEXT,
  MOCK_TAKER_AREAS,
  MOCK_TEST_LIMITS,
  MOCK_VALIDATION,
  QUESTION_LIMITS,
} from '@/constants';
import type { MockTakerArea } from '@/constants';
import { formatDateTime } from '@/lib/format';
import { classYearLabel, subjectLabel } from '@/lib/labels';
import type { MockQuestionInput, MockTags, MockTestInput, MockTestResultsView } from '@/services';

/** A released test with no closing time never closes; from its closing time on it is closed. */
export type MockClosingState = 'never' | 'open' | 'closed';

export type MockTestErrors = Partial<Record<'title' | 'instructions' | 'passMark', string>>;

export type MockQuestionErrors = Partial<
  Record<'prompt' | 'options' | 'correctOption' | 'explanation' | 'marks', string>
>;

/** A blank pass mark is fine (no pass mark); otherwise a whole number in the database's range. */
export function validatePassMarkText(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed);
  const inRange = value >= MOCK_TEST_LIMITS.passMarkMin && value <= MOCK_TEST_LIMITS.passMarkMax;
  return Number.isInteger(value) && inRange ? undefined : MOCK_VALIDATION.passMark;
}

/** Blank gives null (no pass mark). Call it only after validatePassMarkText accepted the text. */
export function passMarkFromText(text: string): number | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : Number(trimmed);
}

export function validateMockTest(
  input: Pick<MockTestInput, 'title' | 'instructions'> & { passMarkText: string },
): MockTestErrors {
  const errors: MockTestErrors = {};
  const title = input.title.trim();
  if (title.length < MOCK_TEST_LIMITS.titleMin || title.length > MOCK_TEST_LIMITS.titleMax) {
    errors.title = MOCK_VALIDATION.title;
  }
  if (input.instructions.length > MOCK_TEST_LIMITS.instructionsMax) {
    errors.instructions = MOCK_VALIDATION.instructions;
  }
  const passMarkError = validatePassMarkText(input.passMarkText);
  if (passMarkError) errors.passMark = passMarkError;
  return errors;
}

/** `trim()` also removes tabs and line breaks, so a prompt of only those counts as empty. */
export function validateMockQuestion(
  input: Pick<MockQuestionInput, 'prompt' | 'options' | 'correctOption' | 'explanation' | 'marks'>,
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
  // The same rule as lib/questions.ts.
  const marks = input.marks;
  if (
    !Number.isInteger(marks) ||
    marks < QUESTION_LIMITS.marksMin ||
    marks > QUESTION_LIMITS.marksMax
  ) {
    errors.marks = MOCK_VALIDATION.marks;
  }
  return errors;
}

export function hasMockErrors(
  errors: MockTestErrors | MockQuestionErrors | MockTagErrors,
): boolean {
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

export function mockScoreText(score: number, total: number, percentage: number): string {
  return MOCK_RESULT.score(score, total, percentage);
}

export function mockResultName(name: string | null): string {
  return name ?? MOCK_RESULTS_PAGE.nameNotSet;
}

/** Null (no pass mark) gives no label at all. */
export function mockPassLabel(passed: boolean | null): string {
  if (passed === null) return '';
  return passed ? MOCK_PASS_LABELS.pass : MOCK_PASS_LABELS.notYet;
}

/** True when the 1000-row limit cut the list short. */
export function mockResultsTruncated(
  view: Pick<MockTestResultsView, 'rows' | 'totalRows'>,
): boolean {
  return view.rows.length < view.totalRows;
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

// --- Tags (docs/delivery/2026-11-18-mock-test-closing ACs 10 to 28, design §4) ---------------

export type MockTagField = 'subject' | 'stream' | 'yearLevels';
export type MockTagErrors = Partial<Record<MockTagField, string>>;

export const MOCK_TAG_FIELDS: readonly MockTagField[] = ['subject', 'stream', 'yearLevels'];

export const EMPTY_MOCK_TAGS: MockTags = {
  subject: null,
  stream: null,
  yearLevels: [],
  anyYear: false,
};

/** The database's rule, written the same way: Any year, or at least one year. */
export function mockYearsSet(tags: MockTags): boolean {
  return tags.anyYear || tags.yearLevels.length > 0;
}

function isTagSet(tags: MockTags, field: MockTagField): boolean {
  if (field === 'yearLevels') return mockYearsSet(tags);
  return tags[field] !== null;
}

export function missingMockTagFields(tags: MockTags): MockTagField[] {
  return MOCK_TAG_FIELDS.filter((field) => !isTagSet(tags, field));
}

export function setMockTagFields(tags: MockTags): MockTagField[] {
  return MOCK_TAG_FIELDS.filter((field) => isTagSet(tags, field));
}

const TAG_REQUIRED_TEXT: Record<MockTagField, string> = {
  subject: MOCK_VALIDATION.tagSubject,
  stream: MOCK_VALIDATION.tagStream,
  yearLevels: MOCK_VALIDATION.tagYears,
};

/**
 * An error per required field that isn't set. The release dialog requires all three and gets
 * the field's own message; the released-test dialog requires the fields that were already set,
 * where an unset one means it was cleared, so `kept` gives the "can't be cleared" message.
 */
export function mockTagErrors(
  tags: MockTags,
  required: readonly MockTagField[],
  kept = false,
): MockTagErrors {
  const errors: MockTagErrors = {};
  for (const field of required) {
    if (!isTagSet(tags, field))
      errors[field] = kept ? MOCK_VALIDATION.tagKeep : TAG_REQUIRED_TEXT[field];
  }
  return errors;
}

/**
 * The year select reports its whole new selection; the previous tags tell which item was clicked
 * (AC 12): choosing Any year clears the years, choosing a year clears Any year.
 */
export function applyYearPick(
  tags: MockTags,
  picked: readonly (number | typeof MOCK_TAG_ANY)[],
): MockTags {
  const hasAny = picked.includes(MOCK_TAG_ANY);
  if (hasAny && !tags.anyYear) return { ...tags, anyYear: true, yearLevels: [] };
  const years = picked.filter((item): item is number => typeof item === 'number');
  if (years.length > 0)
    return { ...tags, anyYear: false, yearLevels: [...years].sort((a, b) => a - b) };
  return { ...tags, anyYear: hasAny, yearLevels: [] };
}

/** The full SUBJECTS list, so a subject later removed from mock tests keeps its label (AC 27). */
export function mockSubjectText(key: string | null): string {
  return key === null ? MOCK_TAGS.notSet : subjectLabel(key);
}

// PROGRAMMES.items, not findProgramme, which leaves out VCE. Unknown slugs show as stored (AC 27).
export function mockStreamText(slug: string | null): string {
  if (slug === null) return MOCK_TAGS.notSet;
  return PROGRAMMES.items.find((programme) => programme.slug === slug)?.menuLabel ?? slug;
}

export function mockYearText(tags: MockTags): string {
  if (tags.anyYear) return YEAR_LEVEL_TEXT.any;
  // classYearLabel([]) says "Any year", so the empty case is handled first.
  if (tags.yearLevels.length === 0) return MOCK_TAGS.notSet;
  return classYearLabel(tags.yearLevels);
}

/** "subject, stream and year level", "subject and year level", "stream". */
export function mockTagNamesText(fields: readonly MockTagField[]): string {
  const names = fields.map((field) => MOCK_TAGS.fieldNames[field]);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(MOCK_TAGS.listSeparator)}${MOCK_TAGS.listAnd}${names.at(-1)}`;
}

/** Whether two sets of tags would save the same columns (years in any order). */
export function sameMockTags(a: MockTags, b: MockTags): boolean {
  const years = (tags: MockTags) => [...tags.yearLevels].sort((x, y) => x - y).join(',');
  return (
    a.subject === b.subject &&
    a.stream === b.stream &&
    a.anyYear === b.anyYear &&
    years(a) === years(b)
  );
}

// --- Taker filters (ACs 19 to 25) -------------------------------------------------------------

/** '' and null mean All. Kept in page state only: a reload resets them (AC 24). */
export type MockFilters = { stream: string; subject: string; year: number | null };

export const NO_MOCK_FILTERS: MockFilters = { stream: '', subject: '', year: null };

/**
 * AND across the three filters (AC 20). A year matches a test with that year or Any year. An
 * untagged test fails every filter that is set and shows only with all on All (AC 18, 21). Closed
 * tests the person submitted are filtered like any other.
 */
export function filterMockTests<T extends { tags: MockTags }>(
  items: readonly T[],
  filters: MockFilters,
): T[] {
  return items.filter(
    ({ tags }) =>
      (filters.stream === '' || tags.stream === filters.stream) &&
      (filters.subject === '' || tags.subject === filters.subject) &&
      (filters.year === null || tags.anyYear || tags.yearLevels.includes(filters.year)),
  );
}
