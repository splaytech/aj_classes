import { describe, expect, it } from 'vitest';

import { QUESTION_VALIDATION, SUBMISSION_PAGE } from '@/constants';
import type { QuestionInput } from '@/services';

import {
  formatMarks,
  optionLetter,
  parseAnswerMark,
  totalMarks,
  validateQuestion,
} from './questions';

const multipleChoice: QuestionInput = {
  assignmentId: 'a',
  kind: 'multiple_choice',
  prompt: 'What is 2 + 2?',
  options: ['3', '4'],
  correctOption: 1,
  marks: 2,
  explanation: '',
};

const written: QuestionInput = {
  ...multipleChoice,
  kind: 'written',
  prompt: 'Explain why.',
  options: [],
  correctOption: null,
};

describe('validateQuestion (R3b FT1)', () => {
  it('accepts a complete multiple-choice or written question', () => {
    expect(validateQuestion(multipleChoice)).toEqual({});
    expect(validateQuestion(written)).toEqual({});
  });

  it('needs a question', () => {
    expect(validateQuestion({ ...written, prompt: '   ' }).prompt).toBe(
      QUESTION_VALIDATION.promptLength,
    );
  });

  it('needs 2–6 filled-in options for multiple choice', () => {
    expect(validateQuestion({ ...multipleChoice, options: ['4'], correctOption: 0 }).options).toBe(
      QUESTION_VALIDATION.optionsCount,
    );
    expect(
      validateQuestion({ ...multipleChoice, options: ['1', '2', '3', '4', '5', '6', '7'] }).options,
    ).toBe(QUESTION_VALIDATION.optionsCount);
    expect(validateQuestion({ ...multipleChoice, options: ['4', ' '] }).options).toBe(
      QUESTION_VALIDATION.optionLength,
    );
  });

  it('needs the correct option to be one of the options', () => {
    expect(validateQuestion({ ...multipleChoice, correctOption: null }).correctOption).toBe(
      QUESTION_VALIDATION.correctOption,
    );
    expect(validateQuestion({ ...multipleChoice, correctOption: 2 }).correctOption).toBe(
      QUESTION_VALIDATION.correctOption,
    );
  });

  it('needs whole marks from 1 to 100', () => {
    expect(validateQuestion({ ...written, marks: 0 }).marks).toBe(QUESTION_VALIDATION.marksRange);
    expect(validateQuestion({ ...written, marks: 1.5 }).marks).toBe(QUESTION_VALIDATION.marksRange);
    expect(validateQuestion({ ...written, marks: 101 }).marks).toBe(QUESTION_VALIDATION.marksRange);
  });
});

describe('question helpers', () => {
  it('adds up the marks', () => {
    expect(totalMarks([{ marks: 2 }, { marks: 3 }])).toBe(5);
    expect(totalMarks([])).toBe(0);
  });

  it('letters the options', () => {
    expect(optionLetter(0)).toBe('A');
    expect(optionLetter(5)).toBe('F');
  });

  it('shows half marks with one decimal', () => {
    expect(formatMarks(3)).toBe('3');
    expect(formatMarks(2.5)).toBe('2.5');
  });
});

describe('parseAnswerMark (R3b FT3)', () => {
  it('reads empty as not marked yet', () => {
    expect(parseAnswerMark(' ', 3)).toEqual({ value: null, error: '' });
  });

  it('accepts 0 to the question marks, in halves', () => {
    expect(parseAnswerMark('0', 3)).toEqual({ value: 0, error: '' });
    expect(parseAnswerMark('2.5', 3)).toEqual({ value: 2.5, error: '' });
    expect(parseAnswerMark('3', 3)).toEqual({ value: 3, error: '' });
  });

  it('refuses marks out of range or not in halves', () => {
    const error = SUBMISSION_PAGE.markRange(3);
    expect(parseAnswerMark('4', 3)).toEqual({ value: null, error });
    expect(parseAnswerMark('-1', 3)).toEqual({ value: null, error });
    expect(parseAnswerMark('1.25', 3)).toEqual({ value: null, error });
    expect(parseAnswerMark('two', 3)).toEqual({ value: null, error });
  });
});
