// Progress for students and parents (R3b stories FS1, FP1, FP2): what's to do, waiting for
// marking and returned; average mark and handing in on time. Pure, so every rule is unit tested.

import type { FamilyAssignment, FamilyQuestion } from '@/services';

export type FamilyGroups = {
  toDo: FamilyAssignment[];
  submitted: FamilyAssignment[];
  returned: FamilyAssignment[];
};

export type FamilyProgress = {
  assigned: number;
  completed: number; // submitted or returned
  toDo: number;
  averagePercent: number | null; // returned work that has a mark and a total
  handedIn: number; // work with a hand-in time
  onTime: number; // of those, handed in by the due date
};

/** Not handed in yet: the due date still matters. */
export function isToDo(status: FamilyAssignment['status']): boolean {
  return status === 'not_started' || status === 'in_progress';
}

/** Soonest due first; no due date last; then by title. */
function bySoonestDue(first: FamilyAssignment, second: FamilyAssignment): number {
  if (first.dueOn !== second.dueOn) {
    if (!first.dueOn) return 1;
    if (!second.dueOn) return -1;
    return first.dueOn < second.dueOn ? -1 : 1;
  }
  return first.title.localeCompare(second.title);
}

/** Most recent first, by the given timestamp. */
function byNewest(key: 'submittedAt' | 'returnedAt') {
  return (first: FamilyAssignment, second: FamilyAssignment) =>
    (second[key] ?? '').localeCompare(first[key] ?? '');
}

export function groupAssignments(assignments: FamilyAssignment[]): FamilyGroups {
  return {
    toDo: assignments.filter((item) => isToDo(item.status)).sort(bySoonestDue),
    submitted: assignments
      .filter((item) => item.status === 'submitted')
      .sort(byNewest('submittedAt')),
    returned: assignments.filter((item) => item.status === 'returned').sort(byNewest('returnedAt')),
  };
}

/** A whole-number percentage, e.g. 6.5 out of 8 → 81. */
export function percentOf(mark: number, total: number): number {
  return Math.round((mark / total) * 100);
}

export function familyProgress(assignments: FamilyAssignment[]): FamilyProgress {
  const groups = groupAssignments(assignments);
  const scored = groups.returned.filter(
    (item) => item.mark !== null && item.totalMarks !== null && item.totalMarks > 0,
  );
  const percents = scored.map((item) => percentOf(item.mark ?? 0, item.totalMarks ?? 1));
  const handedIn = assignments.filter(
    (item) =>
      item.submittedAt !== null && (item.status === 'submitted' || item.status === 'returned'),
  );

  return {
    assigned: assignments.length,
    completed: groups.submitted.length + groups.returned.length,
    toDo: groups.toDo.length,
    averagePercent:
      percents.length === 0
        ? null
        : Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length),
    handedIn: handedIn.length,
    onTime: handedIn.filter((item) => !item.isLate).length,
  };
}

/** A multiple-choice option is chosen, or a written answer has some text. */
export function isAnswered(question: Pick<FamilyQuestion, 'selectedOption' | 'response'>): boolean {
  return question.selectedOption !== null || question.response.trim() !== '';
}

export function answeredCount(
  questions: Pick<FamilyQuestion, 'selectedOption' | 'response'>[],
): number {
  return questions.filter(isAnswered).length;
}
