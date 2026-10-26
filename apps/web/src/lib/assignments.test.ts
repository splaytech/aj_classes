import { describe, expect, it } from 'vitest';

import { ASSIGNMENT_VALIDATION } from '@/constants';
import type { AssignmentSummary } from '@/services';

import {
  byDueDate,
  dueState,
  isLate,
  markingProgress,
  melbourneDate,
  summariseWork,
  validateAssignment,
  validateResult,
} from './assignments';

const today = new Date(2026, 9, 7); // Wednesday 7 Oct 2026

describe('dueState', () => {
  it('labels how urgent a due date is', () => {
    expect(dueState(null, today)).toBe('none');
    expect(dueState('2026-10-06', today)).toBe('overdue');
    expect(dueState('2026-10-07', today)).toBe('today');
    expect(dueState('2026-10-10', today)).toBe('soon'); // 3 days
    expect(dueState('2026-10-11', today)).toBe('later');
  });
});

describe('markingProgress', () => {
  it('counts only students still in the class', () => {
    expect(
      markingProgress({
        enrolledStudentIds: ['a', 'b', 'c'],
        statuses: [
          { studentId: 'a', status: 'marked' },
          { studentId: 'b', status: 'submitted' },
          { studentId: 'gone', status: 'marked' },
        ],
      }),
    ).toEqual({ marked: 1, submitted: 1, returned: 0, total: 3 });
  });

  it('counts returned work as done (R3b)', () => {
    expect(
      markingProgress({
        enrolledStudentIds: ['a', 'b', 'c'],
        statuses: [
          { studentId: 'a', status: 'returned' },
          { studentId: 'b', status: 'in_progress' },
        ],
      }),
    ).toEqual({ marked: 1, submitted: 0, returned: 1, total: 3 });
  });
});

describe('late work (R3b F14)', () => {
  it('uses the Melbourne calendar date', () => {
    // 13:30 UTC on 7 Oct is 00:30 on 8 Oct in Melbourne (AEDT, UTC+11).
    expect(melbourneDate('2026-10-07T13:30:00Z')).toBe('2026-10-08');
    expect(isLate('2026-10-07T13:30:00Z', '2026-10-07')).toBe(true);
    expect(isLate('2026-10-07T12:30:00Z', '2026-10-07')).toBe(false);
  });

  it('is never late without a hand-in time or a due date', () => {
    expect(isLate(null, '2026-10-07')).toBe(false);
    expect(isLate('2026-10-09T00:00:00Z', null)).toBe(false);
  });
});

describe('byDueDate', () => {
  const item = (title: string, dueOn: string | null) => ({ title, dueOn }) as AssignmentSummary;

  it('sorts soonest first, undated last', () => {
    const sorted = [item('c', null), item('b', '2026-10-09'), item('a', '2026-10-08')].sort(
      byDueDate,
    );
    expect(sorted.map((a) => a.title)).toEqual(['a', 'b', 'c']);
  });
});

describe('validateAssignment', () => {
  const valid = { classId: 'c', title: 'Fractions', instructions: '', dueOn: null, maxMark: 20 };

  it('accepts a normal assignment, with or without marks', () => {
    expect(validateAssignment(valid)).toEqual({});
    expect(validateAssignment({ ...valid, maxMark: null })).toEqual({});
  });

  it('checks title length and the maximum mark', () => {
    expect(validateAssignment({ ...valid, title: 'x' }).title).toBe(
      ASSIGNMENT_VALIDATION.titleLength,
    );
    expect(validateAssignment({ ...valid, maxMark: 0 }).maxMark).toBe(
      ASSIGNMENT_VALIDATION.maxMarkRange,
    );
    expect(validateAssignment({ ...valid, maxMark: 2.5 }).maxMark).toBe(
      ASSIGNMENT_VALIDATION.maxMarkRange,
    );
  });
});

describe('validateResult', () => {
  it('keeps marks between 0 and the maximum', () => {
    expect(validateResult({ mark: 20, feedback: '' }, 20)).toBe('');
    expect(validateResult({ mark: 21, feedback: '' }, 20)).toBe(
      ASSIGNMENT_VALIDATION.markRange(20),
    );
    expect(validateResult({ mark: -1, feedback: '' }, 20)).toBe(
      ASSIGNMENT_VALIDATION.markRange(20),
    );
  });

  it('refuses marks on feedback-only work', () => {
    expect(validateResult({ mark: 5, feedback: '' }, null)).toBe(
      ASSIGNMENT_VALIDATION.markNotAllowed,
    );
    expect(validateResult({ mark: null, feedback: 'Great work' }, null)).toBe('');
  });
});

describe('summariseWork', () => {
  const base = {
    id: 'x',
    classId: 'c',
    className: 'C',
    title: 'T',
    instructions: '',
    maxMark: 10,
    isPublished: true,
    holdResults: false,
    questionCount: 0,
    totalMarks: 10,
  };

  it('counts work to mark, due soon and overdue-with-unmarked', () => {
    const summary = summariseWork(
      [
        {
          ...base,
          dueOn: '2026-10-08',
          enrolledStudentIds: ['a', 'b'],
          statuses: [{ studentId: 'a', status: 'submitted' }],
        },
        { ...base, dueOn: '2026-10-01', enrolledStudentIds: ['a'], statuses: [] },
        {
          ...base,
          dueOn: '2026-10-02',
          enrolledStudentIds: ['a'],
          statuses: [{ studentId: 'a', status: 'marked' }],
        },
      ],
      today,
    );
    expect(summary).toEqual({ toMark: 1, dueSoon: 1, overdue: 1 });
  });
});
