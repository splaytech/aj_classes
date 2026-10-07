import { describe, expect, it } from 'vitest';

import type { FamilyAssignment } from '@/services';

import {
  answeredCount,
  familyProgress,
  groupAssignments,
  isAnswered,
  percentOf,
} from './family-progress';

function assignment(overrides: Partial<FamilyAssignment>): FamilyAssignment {
  return {
    id: 'x',
    title: 'Work',
    className: 'Class',
    subject: 'maths',
    dueOn: null,
    publishedAt: null,
    questionCount: 3,
    answeredCount: 0,
    totalMarks: 10,
    status: 'not_started',
    submittedAt: null,
    returnedAt: null,
    isLate: false,
    mark: null,
    comment: '',
    ...overrides,
  };
}

const list = [
  assignment({ id: 'later', title: 'B', dueOn: '2026-10-20' }),
  assignment({ id: 'none', title: 'A', dueOn: null, status: 'in_progress' }),
  assignment({ id: 'soon', title: 'C', dueOn: '2026-10-09' }),
  assignment({
    id: 'waiting',
    status: 'submitted',
    submittedAt: '2026-10-06T01:00:00Z',
    isLate: true,
  }),
  assignment({
    id: 'back-old',
    status: 'returned',
    submittedAt: '2026-10-01T01:00:00Z',
    returnedAt: '2026-10-02T01:00:00Z',
    mark: 6,
    totalMarks: 8,
  }),
  assignment({
    id: 'back-new',
    status: 'returned',
    submittedAt: '2026-10-03T01:00:00Z',
    returnedAt: '2026-10-04T01:00:00Z',
    mark: 9,
    totalMarks: 10,
  }),
  // Paper homework returned without a mark: counts as done, not in the average.
  assignment({
    id: 'paper',
    status: 'returned',
    returnedAt: '2026-10-03T00:00:00Z',
    totalMarks: null,
  }),
];

describe('groupAssignments (R3b FS1)', () => {
  it('puts to-do work soonest due first, with no due date last', () => {
    expect(groupAssignments(list).toDo.map((item) => item.id)).toEqual(['soon', 'later', 'none']);
  });

  it('shows the latest submitted and returned work first', () => {
    const groups = groupAssignments(list);
    expect(groups.submitted.map((item) => item.id)).toEqual(['waiting']);
    expect(groups.returned.map((item) => item.id)).toEqual(['back-new', 'paper', 'back-old']);
  });
});

describe('familyProgress (R3b FP2)', () => {
  it('counts assigned, completed and to-do work', () => {
    const progress = familyProgress(list);
    expect(progress.assigned).toBe(7);
    expect(progress.completed).toBe(4);
    expect(progress.toDo).toBe(3);
  });

  it('averages the percentages of marked, returned work', () => {
    // 6/8 = 75%, 9/10 = 90% → 83 (rounded)
    expect(familyProgress(list).averagePercent).toBe(83);
    expect(familyProgress([assignment({})]).averagePercent).toBeNull();
  });

  it('counts work handed in on time', () => {
    const progress = familyProgress(list);
    expect(progress.handedIn).toBe(3);
    expect(progress.onTime).toBe(2);
  });
});

describe('answers', () => {
  it('rounds percentages to whole numbers', () => {
    expect(percentOf(6.5, 8)).toBe(81);
  });

  it('counts a chosen option or some written text as answered', () => {
    expect(isAnswered({ selectedOption: 0, response: '' })).toBe(true);
    expect(isAnswered({ selectedOption: null, response: '  ' })).toBe(false);
    expect(
      answeredCount([
        { selectedOption: null, response: 'Because' },
        { selectedOption: null, response: '' },
        { selectedOption: 2, response: '' },
      ]),
    ).toBe(2);
  });
});
