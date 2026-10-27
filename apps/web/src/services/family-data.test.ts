import { describe, expect, it } from 'vitest';

import { toFamilyAssignment, toFamilyAssignmentView } from './family-data';
import type { FamilyAssignmentJson, FamilyAssignmentRow } from './family-data';

const ROW: FamilyAssignmentRow = {
  assignment_id: 'assignment-1',
  title: 'Fractions quiz',
  class_name: 'Year 8 Maths',
  subject: 'maths',
  due_on: '2026-10-20',
  published_at: '2026-10-10T00:00:00Z',
  question_count: 2,
  answered_count: null,
  total_marks: 3,
  status: 'returned',
  submitted_at: '2026-10-12T00:00:00Z',
  returned_at: '2026-10-13T00:00:00Z',
  is_late: false,
  mark: 2,
  comment: 'Nice work',
  is_past_class: true,
};

const JSON_VIEW: FamilyAssignmentJson = {
  id: 'assignment-1',
  title: 'Fractions quiz',
  className: 'Year 8 Maths',
  subject: 'maths',
  dueOn: '2026-10-20',
  status: 'returned',
  submittedAt: '2026-10-12T00:00:00Z',
  returnedAt: '2026-10-13T00:00:00Z',
  isLate: false,
  totalMarks: 3,
  mark: '2.0',
  comment: 'Nice work',
  isPastClass: true,
  instructions: '',
  questions: [],
};

describe('family data mapping (item 7)', () => {
  it('maps is_past_class from the list functions (AC-7.12)', () => {
    expect(toFamilyAssignment(ROW).isPastClass).toBe(true);
    expect(toFamilyAssignment({ ...ROW, is_past_class: false }).isPastClass).toBe(false);
  });

  it('keeps isPastClass from the assignment page JSON, and turns the mark into a number', () => {
    const view = toFamilyAssignmentView(JSON_VIEW);

    expect(view.isPastClass).toBe(true);
    expect(view.mark).toBe(2);
  });
});
