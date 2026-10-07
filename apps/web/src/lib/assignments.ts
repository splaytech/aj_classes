// Assignment rules (R3a stories TS3–TS5): due labels, marking progress and form checks.
// The database enforces the same limits (design §3).

import { ASSIGNMENT_LIMITS, ASSIGNMENT_VALIDATION } from '@/constants';
import type { AssignmentInput, AssignmentSummary, ResultInput } from '@/services';

import { toIsoDate } from './timetable';

const DAY_MS = 24 * 60 * 60 * 1000;

export type DueState = 'none' | 'overdue' | 'today' | 'soon' | 'later';

/** How urgent an assignment is, compared with today's date. */
export function dueState(dueOn: string | null, today: Date): DueState {
  if (!dueOn) return 'none';
  const todayIso = toIsoDate(today);
  if (dueOn < todayIso) return 'overdue';
  if (dueOn === todayIso) return 'today';

  const daysAway = Math.round(
    (new Date(`${dueOn}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime()) / DAY_MS,
  );
  return daysAway <= ASSIGNMENT_LIMITS.dueSoonDays ? 'soon' : 'later';
}

export type MarkingProgress = { marked: number; submitted: number; total: number };

/** Counts only students still in the class (removed students' marks are kept but not counted). */
export function markingProgress(
  assignment: Pick<AssignmentSummary, 'enrolledStudentIds' | 'statuses'>,
): MarkingProgress {
  const enrolled = new Set(assignment.enrolledStudentIds);
  const current = assignment.statuses.filter((result) => enrolled.has(result.studentId));
  return {
    marked: current.filter((result) => result.status === 'marked').length,
    submitted: current.filter((result) => result.status === 'submitted').length,
    total: enrolled.size,
  };
}

/** Soonest due first; no due date last; then by title. */
export function byDueDate(a: AssignmentSummary, b: AssignmentSummary): number {
  if (a.dueOn !== b.dueOn) {
    if (!a.dueOn) return 1;
    if (!b.dueOn) return -1;
    return a.dueOn < b.dueOn ? -1 : 1;
  }
  return a.title.localeCompare(b.title);
}

export type AssignmentErrors = Partial<Record<'title' | 'instructions' | 'maxMark', string>>;

export function validateAssignment(input: AssignmentInput): AssignmentErrors {
  const errors: AssignmentErrors = {};
  const title = input.title.trim();
  if (title.length < ASSIGNMENT_LIMITS.titleMin || title.length > ASSIGNMENT_LIMITS.titleMax) {
    errors.title = ASSIGNMENT_VALIDATION.titleLength;
  }
  if (input.instructions.length > ASSIGNMENT_LIMITS.instructionsMax) {
    errors.instructions = ASSIGNMENT_VALIDATION.instructionsLength;
  }
  if (
    input.maxMark !== null &&
    (!Number.isInteger(input.maxMark) ||
      input.maxMark < ASSIGNMENT_LIMITS.maxMarkMin ||
      input.maxMark > ASSIGNMENT_LIMITS.maxMarkMax)
  ) {
    errors.maxMark = ASSIGNMENT_VALIDATION.maxMarkRange;
  }
  return errors;
}

/** '' when a student's result can be saved. */
export function validateResult(
  input: Pick<ResultInput, 'mark' | 'feedback'>,
  maxMark: number | null,
): string {
  if (input.mark !== null) {
    if (maxMark === null) return ASSIGNMENT_VALIDATION.markNotAllowed;
    if (Number.isNaN(input.mark) || input.mark < 0 || input.mark > maxMark) {
      return ASSIGNMENT_VALIDATION.markRange(maxMark);
    }
  }
  return input.feedback.length > ASSIGNMENT_LIMITS.feedbackMax
    ? ASSIGNMENT_VALIDATION.feedbackLength
    : '';
}

export type WorkSummary = { toMark: number; dueSoon: number; overdue: number };

/**
 * For the tutor dashboard: submitted work waiting for a mark, assignments due in the next few
 * days, and overdue assignments that still have unmarked students.
 */
export function summariseWork(assignments: AssignmentSummary[], today: Date): WorkSummary {
  let toMark = 0;
  let dueSoon = 0;
  let overdue = 0;

  for (const assignment of assignments) {
    const progress = markingProgress(assignment);
    const state = dueState(assignment.dueOn, today);
    toMark += progress.submitted;
    if (state === 'today' || state === 'soon') dueSoon += 1;
    if (state === 'overdue' && progress.marked < progress.total) overdue += 1;
  }
  return { toMark, dueSoon, overdue };
}
