import { describe, expect, it } from 'vitest';

import * as constants from '@/constants';
import {
  MOCK_TEST_LIMITS,
  MOCK_VALIDATION,
  PORTAL_ROUTES,
  QUESTION_LIMITS,
  adminMockTestPath,
  mockTestPath,
  mockTestsPath,
} from '@/constants';

import {
  hasMockErrors,
  mockScoreText,
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
  it('reads "N of M correct"', () => {
    expect(mockScoreText(3, 5)).toBe('3 of 5 correct');
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
