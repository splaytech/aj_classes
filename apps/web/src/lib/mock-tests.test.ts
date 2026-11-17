import { describe, expect, it } from 'vitest';

import * as constants from '@/constants';
import {
  MOCK_CLOSING,
  MOCK_PASS_LABELS,
  MOCK_RESULTS_PAGE,
  MOCK_TAG_ANY,
  MOCK_TAGS,
  MOCK_TEST_STREAMS,
  MOCK_TEST_SUBJECTS,
  MOCK_TEST_LIMITS,
  MOCK_VALIDATION,
  PORTAL_ROUTES,
  QUESTION_LIMITS,
  adminMockTestPath,
  mockTestPath,
  mockTestsPath,
} from '@/constants';

import { formatDateTime } from './format';
import {
  EMPTY_MOCK_TAGS,
  NO_MOCK_FILTERS,
  applyYearPick,
  filterMockTests,
  closesAtError,
  hasMockErrors,
  missingMockTagFields,
  mockStreamText,
  mockSubjectText,
  mockTagErrors,
  mockTagNamesText,
  mockYearText,
  mockYearsSet,
  setMockTagFields,
  mockClosingState,
  mockClosingText,
  mockPassLabel,
  mockResultName,
  mockResultsTruncated,
  mockScoreText,
  passMarkFromText,
  validatePassMarkText,
  mockTestAreaFromPath,
  unansweredCount,
  validateMockQuestion,
  validateMockTest,
} from './mock-tests';

const GOOD_QUESTION = {
  prompt: 'What is 2 + 2?',
  options: ['3', '4'],
  correctOption: 1,
  explanation: '',
};

describe('validateMockTest', () => {
  it('accepts a title of 2 to 150 characters', () => {
    expect(validateMockTest({ title: 'ab', instructions: '' })).toEqual({});
    expect(validateMockTest({ title: 'a'.repeat(150), instructions: '' })).toEqual({});
  });

  it.each(['', ' ', 'a', '  a  ', 'a'.repeat(151)])('refuses the title %j', (title) => {
    expect(validateMockTest({ title, instructions: '' }).title).toBe(MOCK_VALIDATION.title);
  });

  it('refuses instructions over 4000 characters, and accepts 4000', () => {
    const limit = MOCK_TEST_LIMITS.instructionsMax;
    expect(validateMockTest({ title: 'Maths', instructions: 'a'.repeat(limit) })).toEqual({});
    expect(
      validateMockTest({ title: 'Maths', instructions: 'a'.repeat(limit + 1) }).instructions,
    ).toBe(MOCK_VALIDATION.instructions);
  });
});

describe('validateMockQuestion', () => {
  it('accepts a good question', () => {
    expect(validateMockQuestion(GOOD_QUESTION)).toEqual({});
    expect(hasMockErrors(validateMockQuestion(GOOD_QUESTION))).toBe(false);
  });

  it('accepts a prompt of 2000 characters and refuses 2001', () => {
    const limit = QUESTION_LIMITS.promptMax;
    expect(validateMockQuestion({ ...GOOD_QUESTION, prompt: 'a'.repeat(limit) })).toEqual({});
    expect(validateMockQuestion({ ...GOOD_QUESTION, prompt: 'a'.repeat(limit + 1) }).prompt).toBe(
      MOCK_VALIDATION.prompt,
    );
  });

  it.each(['', '   ', '\n\n', ' \t\r\n '])('treats the prompt %j as empty', (prompt) => {
    expect(validateMockQuestion({ ...GOOD_QUESTION, prompt }).prompt).toBe(MOCK_VALIDATION.prompt);
  });

  it('needs 2 to 6 options', () => {
    const options = (count: number) => Array.from({ length: count }, (_, index) => `o${index}`);
    expect(validateMockQuestion({ ...GOOD_QUESTION, options: options(1) }).options).toBe(
      MOCK_VALIDATION.optionsCount,
    );
    expect(validateMockQuestion({ ...GOOD_QUESTION, options: options(7) }).options).toBe(
      MOCK_VALIDATION.optionsCount,
    );
    expect(validateMockQuestion({ ...GOOD_QUESTION, options: options(6) }).options).toBeUndefined();
  });

  it('refuses a blank option and one over 300 characters, and accepts 300', () => {
    const limit = QUESTION_LIMITS.optionMax;
    expect(validateMockQuestion({ ...GOOD_QUESTION, options: ['a', '  '] }).options).toBe(
      MOCK_VALIDATION.optionLength,
    );
    expect(
      validateMockQuestion({ ...GOOD_QUESTION, options: ['a', 'b'.repeat(limit + 1)] }).options,
    ).toBe(MOCK_VALIDATION.optionLength);
    expect(
      validateMockQuestion({ ...GOOD_QUESTION, options: ['a', 'b'.repeat(limit)] }).options,
    ).toBeUndefined();
  });

  it('needs a correct option that exists', () => {
    for (const correctOption of [null, -1, 2]) {
      expect(validateMockQuestion({ ...GOOD_QUESTION, correctOption }).correctOption).toBe(
        MOCK_VALIDATION.correctOption,
      );
    }
  });

  it('refuses an explanation over 2000 characters, and accepts 2000', () => {
    const limit = QUESTION_LIMITS.explanationMax;
    expect(validateMockQuestion({ ...GOOD_QUESTION, explanation: 'a'.repeat(limit) })).toEqual({});
    expect(
      validateMockQuestion({ ...GOOD_QUESTION, explanation: 'a'.repeat(limit + 1) }).explanation,
    ).toBe(MOCK_VALIDATION.explanation);
  });
});

describe('mockTestAreaFromPath', () => {
  it.each([
    [PORTAL_ROUTES.studentMockTests, 'student'],
    [`${PORTAL_ROUTES.parentMockTests}/abc`, 'parent'],
    [PORTAL_ROUTES.userMockTests, 'user'],
  ])('reads the area of %s', (path, area) => {
    expect(mockTestAreaFromPath(path)).toBe(area);
  });

  it('falls back to student for any other path', () => {
    expect(mockTestAreaFromPath('/somewhere')).toBe('student');
  });
});

describe('mock test paths', () => {
  it('builds the list and test paths of each area', () => {
    expect(mockTestsPath('parent')).toBe('/portal/parent/mock-tests');
    expect(mockTestPath('user', 'abc')).toBe('/portal/user/mock-tests/abc');
    expect(adminMockTestPath('abc')).toBe('/portal/admin/mock-tests/abc');
  });
});

describe('unansweredCount', () => {
  const questions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('counts questions with no chosen option, including option 0 as answered', () => {
    expect(unansweredCount(questions, { a: 0, b: null })).toBe(2);
    expect(unansweredCount(questions, { a: 0, b: 1, c: 3 })).toBe(0);
    expect(unansweredCount([], {})).toBe(0);
  });
});

describe('mockScoreText', () => {
  it('reads "N of M marks (P%)" with a percentage', () => {
    expect(mockScoreText(3, 5, 60)).toBe('3 of 5 marks (60%)');
    expect(mockScoreText(2, 3, 66)).toBe('2 of 3 marks (66%)');
  });

  it('reads "N of M marks" without one', () => {
    expect(mockScoreText(3, 5)).toBe('3 of 5 marks');
  });
});

describe('validatePassMarkText', () => {
  it.each(['0', '-1', '60.5', '101', 'abc'])('refuses %s', (text) => {
    expect(validatePassMarkText(text)).toBe(MOCK_VALIDATION.passMark);
  });

  it.each(['1', '100', '60', '', '   '])('accepts %j', (text) => {
    expect(validatePassMarkText(text)).toBeUndefined();
  });
});

describe('passMarkFromText', () => {
  it('gives null for blank and the number otherwise', () => {
    expect(passMarkFromText('')).toBeNull();
    expect(passMarkFromText('  ')).toBeNull();
    expect(passMarkFromText(' 60 ')).toBe(60);
  });
});

describe('validateMockTest pass mark', () => {
  const base = { title: 'Maths', instructions: '' };

  it('checks the pass mark text when present', () => {
    expect(validateMockTest({ ...base, passMarkText: '101' }).passMark).toBe(
      MOCK_VALIDATION.passMark,
    );
    expect(validateMockTest({ ...base, passMarkText: '60' })).toEqual({});
    expect(validateMockTest({ ...base, passMarkText: '' })).toEqual({});
  });

  it('skips the check when the text is absent', () => {
    expect(validateMockTest(base)).toEqual({});
  });
});

describe('validateMockQuestion marks', () => {
  it.each([0, -1, 2.5, 101, Number.NaN])('refuses %s', (marks) => {
    expect(validateMockQuestion({ ...GOOD_QUESTION, marks }).marks).toBe(MOCK_VALIDATION.marks);
  });

  it('accepts the limits and skips an absent value', () => {
    expect(validateMockQuestion({ ...GOOD_QUESTION, marks: QUESTION_LIMITS.marksMin })).toEqual({});
    expect(validateMockQuestion({ ...GOOD_QUESTION, marks: QUESTION_LIMITS.marksMax })).toEqual({});
    expect(validateMockQuestion({ ...GOOD_QUESTION, marks: undefined })).toEqual({});
  });
});

describe('mockResultName, mockPassLabel and mockResultsTruncated', () => {
  it('falls back to the not-set text for a null name', () => {
    expect(mockResultName(null)).toBe(MOCK_RESULTS_PAGE.nameNotSet);
    expect(mockResultName('Ana')).toBe('Ana');
  });

  it('labels a pass mark result and gives nothing without one', () => {
    expect(mockPassLabel(null)).toBe('');
    expect(mockPassLabel(true)).toBe(MOCK_PASS_LABELS.pass);
    expect(mockPassLabel(false)).toBe(MOCK_PASS_LABELS.notYet);
  });

  it('is truncated only when fewer rows came back than exist', () => {
    expect(mockResultsTruncated({ rows: [], totalRows: 0 })).toBe(false);
    const rows = [{}, {}] as never[];
    expect(mockResultsTruncated({ rows, totalRows: 1500 })).toBe(true);
    expect(mockResultsTruncated({ rows, totalRows: 2 })).toBe(false);
  });
});

// AC 9: no mock test text mentions price. AC 41: "mock test", never "test" alone.
const PRICE_WORDS = /\$|\b(price|prices|pay|paid|payment|upgrade|subscribe|subscription|cost)\b/i;

function textsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function')
    return textsOf((value as (...args: unknown[]) => unknown)(1, 2, 'x'));
  if (value && typeof value === 'object') return Object.values(value).flatMap(textsOf);
  return [];
}

describe('mock test wording', () => {
  const mockConstants = Object.entries(constants)
    .filter(([name]) => name.startsWith('MOCK_') && name !== 'MOCK_TAKER_AREAS')
    .map(([, value]) => value);

  it('finds the mock test constants', () => {
    expect(mockConstants.length).toBeGreaterThan(8);
  });

  it('never mentions price, payment or upgrades', () => {
    const offending = mockConstants
      .flatMap(textsOf)
      .filter((text) => PRICE_WORDS.test(text.replace('free of cost', '')));
    expect(offending).toEqual([]);
  });
});

describe('closing (docs/delivery/2026-11-18-mock-test-closing)', () => {
  const now = new Date('2026-11-18T10:00:00.000Z');

  it('is never, open or closed, with the closing time itself counting as closed (AC 8)', () => {
    expect(mockClosingState(null, now)).toBe('never');
    expect(mockClosingState('2026-11-18T10:00:01.000Z', now)).toBe('open');
    expect(mockClosingState('2026-11-18T10:00:00.000Z', now)).toBe('closed');
    expect(mockClosingState('2026-11-17T10:00:00.000Z', now)).toBe('closed');
  });

  it('says Closes or Closed with the date and time, or nothing (AC 6, 9)', () => {
    const later = '2026-11-20T01:30:00.000Z';
    const earlier = '2026-11-01T01:30:00.000Z';
    expect(mockClosingText(null, now)).toBe('');
    expect(mockClosingText(later, now)).toBe(MOCK_CLOSING.closes(formatDateTime(later)));
    expect(mockClosingText(earlier, now)).toBe(MOCK_CLOSING.closed(formatDateTime(earlier)));
  });

  it('accepts empty or a future time, and refuses now, the past and an invalid date', () => {
    expect(closesAtError(null, now)).toBeUndefined();
    expect(closesAtError(new Date('2026-11-18T10:01:00.000Z'), now)).toBeUndefined();
    expect(closesAtError(new Date(now), now)).toBe(MOCK_VALIDATION.closesInPast);
    expect(closesAtError(new Date('2026-01-01T00:00:00.000Z'), now)).toBe(
      MOCK_VALIDATION.closesInPast,
    );
    expect(closesAtError(new Date('nonsense'), now)).toBe(MOCK_VALIDATION.closesInvalid);
  });
});

describe('tags (docs/delivery/2026-11-18-mock-test-closing)', () => {
  const tagged = { subject: 'maths', stream: 'naplan', yearLevels: [5, 6], anyYear: false };

  it('offers seven subjects without interview preparation, and six streams with menu labels (AC 10, 11)', () => {
    expect(MOCK_TEST_SUBJECTS.map((s) => s.key)).not.toContain('interview-preparation');
    expect(MOCK_TEST_SUBJECTS).toHaveLength(7);
    expect(MOCK_TEST_STREAMS.map((s) => s.label)).toEqual([
      'VCE Tutoring',
      'NAPLAN',
      'Selective Entry Exam',
      'SEAL and Scholarships',
      'ICAS',
      'Maths, Science and English',
    ]);
    for (const left of ['interviews', 'vce-subject-selection', 'ucat-and-gamsat']) {
      expect(MOCK_TEST_STREAMS.map((s) => s.key)).not.toContain(left);
    }
  });

  it('knows which tags are set, with Any year counting as set (AC 14)', () => {
    expect(mockYearsSet(EMPTY_MOCK_TAGS)).toBe(false);
    expect(mockYearsSet({ ...EMPTY_MOCK_TAGS, anyYear: true })).toBe(true);
    expect(missingMockTagFields(EMPTY_MOCK_TAGS)).toEqual(['subject', 'stream', 'yearLevels']);
    expect(missingMockTagFields({ ...EMPTY_MOCK_TAGS, stream: 'icas' })).toEqual([
      'subject',
      'yearLevels',
    ]);
    expect(missingMockTagFields(tagged)).toEqual([]);
    expect(setMockTagFields({ ...EMPTY_MOCK_TAGS, subject: 'maths' })).toEqual(['subject']);
  });

  it('gives each required unset field its message, or the keep message', () => {
    expect(mockTagErrors(EMPTY_MOCK_TAGS, ['subject', 'stream', 'yearLevels'])).toEqual({
      subject: MOCK_VALIDATION.tagSubject,
      stream: MOCK_VALIDATION.tagStream,
      yearLevels: MOCK_VALIDATION.tagYears,
    });
    expect(mockTagErrors(tagged, ['subject', 'stream', 'yearLevels'])).toEqual({});
    expect(mockTagErrors({ ...tagged, subject: null }, ['subject', 'stream'], true)).toEqual({
      subject: MOCK_VALIDATION.tagKeep,
    });
    expect(mockTagErrors(EMPTY_MOCK_TAGS, [])).toEqual({});
  });

  it('applies a year pick: Any year clears years, a year clears Any year, Any off is nothing (AC 12)', () => {
    const withYears = { ...EMPTY_MOCK_TAGS, yearLevels: [5] };
    expect(applyYearPick(withYears, [5, MOCK_TAG_ANY])).toEqual({
      ...EMPTY_MOCK_TAGS,
      anyYear: true,
      yearLevels: [],
    });
    const any = { ...EMPTY_MOCK_TAGS, anyYear: true };
    expect(applyYearPick(any, [MOCK_TAG_ANY, 9, 7])).toEqual({
      ...EMPTY_MOCK_TAGS,
      anyYear: false,
      yearLevels: [7, 9],
    });
    expect(applyYearPick(any, [])).toEqual({ ...EMPTY_MOCK_TAGS, anyYear: false });
    expect(applyYearPick(withYears, [])).toEqual(EMPTY_MOCK_TAGS);
  });

  it('names tags by label, keeps removed or unknown ones, and says Not set (AC 23, 27)', () => {
    expect(mockSubjectText('maths')).toBe('Maths');
    expect(mockSubjectText('interview-preparation')).toBe('Interview preparation');
    expect(mockSubjectText('chemistry')).toBe('chemistry');
    expect(mockSubjectText(null)).toBe(MOCK_TAGS.notSet);
    expect(mockStreamText('vce')).toBe('VCE Tutoring');
    expect(mockStreamText('ucat-and-gamsat')).toBe('UCAT and GAMSAT');
    expect(mockStreamText('old-stream')).toBe('old-stream');
    expect(mockStreamText(null)).toBe(MOCK_TAGS.notSet);
    expect(mockYearText({ ...EMPTY_MOCK_TAGS, anyYear: true })).toBe('Any year');
    expect(mockYearText({ ...EMPTY_MOCK_TAGS, yearLevels: [7, 8, 9] })).toBe('Years 7–9');
    expect(mockYearText(EMPTY_MOCK_TAGS)).toBe(MOCK_TAGS.notSet);
  });

  it('joins the missing field names in plain English', () => {
    expect(mockTagNamesText(['subject', 'stream', 'yearLevels'])).toBe(
      'subject, stream and year level',
    );
    expect(mockTagNamesText(['subject', 'yearLevels'])).toBe('subject and year level');
    expect(mockTagNamesText(['stream'])).toBe('stream');
    expect(MOCK_TAGS.releaseNeedsTags(mockTagNamesText(['subject', 'stream', 'yearLevels']))).toBe(
      'Set the subject, stream and year level to release this mock test.',
    );
  });
});

describe('filterMockTests (ACs 18, 20, 21)', () => {
  const item = (id: string, tags: Partial<typeof EMPTY_MOCK_TAGS>, closed = false) => ({
    id,
    closed,
    tags: { ...EMPTY_MOCK_TAGS, ...tags },
  });
  const items = [
    item('naplan-maths-5', { stream: 'naplan', subject: 'maths', yearLevels: [5] }),
    item('naplan-english-any', { stream: 'naplan', subject: 'english', anyYear: true }),
    item('vce-maths-11-12', { stream: 'vce', subject: 'maths', yearLevels: [11, 12] }),
    item('closed-icas-maths-5', { stream: 'icas', subject: 'maths', yearLevels: [5] }, true),
    item('untagged', {}),
  ];
  const ids = (filters: typeof NO_MOCK_FILTERS) => filterMockTests(items, filters).map((i) => i.id);

  it.each([
    [
      {},
      [
        'naplan-maths-5',
        'naplan-english-any',
        'vce-maths-11-12',
        'closed-icas-maths-5',
        'untagged',
      ],
    ],
    [{ stream: 'naplan' }, ['naplan-maths-5', 'naplan-english-any']],
    [{ subject: 'maths' }, ['naplan-maths-5', 'vce-maths-11-12', 'closed-icas-maths-5']],
    [{ year: 5 }, ['naplan-maths-5', 'naplan-english-any', 'closed-icas-maths-5']],
    [{ year: 12 }, ['naplan-english-any', 'vce-maths-11-12']],
    [{ stream: 'naplan', subject: 'maths' }, ['naplan-maths-5']],
    [{ stream: 'naplan', year: 7 }, ['naplan-english-any']],
    [{ stream: 'icas', subject: 'maths', year: 5 }, ['closed-icas-maths-5']],
    [{ stream: 'vce', year: 5 }, []],
  ])('filters %j', (set, expected) => {
    expect(ids({ ...NO_MOCK_FILTERS, ...set })).toEqual(expected);
  });

  it('keeps the input untouched', () => {
    const copy = structuredClone(items);
    filterMockTests(items, { ...NO_MOCK_FILTERS, stream: 'vce' });
    expect(items).toEqual(copy);
  });
});

describe('closing copy follows ruling S-1 (Test Manager F-1)', () => {
  it.each([MOCK_CLOSING.setClosingText, MOCK_CLOSING.confirmCloseNowText, MOCK_CLOSING.closedNow])(
    'says submitters keep their result: %s',
    (text) => {
      expect(text).toMatch(/submitted it (still see|can still see) their result/);
      expect(text).not.toMatch(/including their results|can’t see this mock test or their results/);
    },
  );

  it('says people without a submitted attempt lose access', () => {
    expect(MOCK_CLOSING.setClosingText).toMatch(/haven’t submitted it can’t see or take/);
    expect(MOCK_CLOSING.confirmCloseNowText).toMatch(/haven’t submitted it won’t see it/);
  });
});
