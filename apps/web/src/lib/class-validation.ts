// Checks for the class, weekly time and student forms (R3a). The database enforces the same rules.

import { CLASS_VALIDATION } from '@/constants';
import type { ClassInput } from '@/services';

import { minutesOfDay } from './timetable';

const NAME_MIN = 2;
const NAME_MAX = 100;
const LOCATION_MAX = 100;

export type ClassErrors = Partial<Record<'name' | 'subject' | 'location' | 'term', string>>;

function isNameLength(value: string): boolean {
  const length = value.trim().length;
  return length >= NAME_MIN && length <= NAME_MAX;
}

export function validateClass(input: ClassInput): ClassErrors {
  const errors: ClassErrors = {};
  if (!isNameLength(input.name)) errors.name = CLASS_VALIDATION.nameLength;
  if (!input.subject) errors.subject = CLASS_VALIDATION.subjectRequired;
  if (input.location.trim().length > LOCATION_MAX)
    errors.location = CLASS_VALIDATION.locationLength;
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) {
    errors.term = CLASS_VALIDATION.termOrder;
  }
  return errors;
}

/** '' when the weekly time is fine; times are "HH:MM". */
export function validateSessionTimes(start: string | null, end: string | null): string {
  if (!start || !end) return CLASS_VALIDATION.timeRequired;
  return minutesOfDay(end) > minutesOfDay(start) ? '' : CLASS_VALIDATION.timeOrder;
}

export function validateStudentName(name: string): string {
  return isNameLength(name) ? '' : CLASS_VALIDATION.studentNameLength;
}
