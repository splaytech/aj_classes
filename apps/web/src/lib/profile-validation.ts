// Checks for the staff profile form (R2a story US12). The database enforces the same limits.

import { PROFILE_LIMITS, PROFILE_VALIDATION } from '@/constants';
import type { ProfileChanges } from '@/services';

export type ProfileErrors = Partial<Record<'fullName' | 'bio' | 'qualifications', string>>;

/** Trims each qualification and drops empty lines (the database refuses blank ones, V27). */
export function cleanQualifications(lines: string[]): string[] {
  return lines.map((line) => line.trim()).filter((line) => line !== '');
}

export function validateProfile(values: ProfileChanges): ProfileErrors {
  const errors: ProfileErrors = {};
  const name = values.fullName.trim();
  const qualifications = cleanQualifications(values.qualifications);

  if (name.length < PROFILE_LIMITS.nameMin || name.length > PROFILE_LIMITS.nameMax) {
    errors.fullName = PROFILE_VALIDATION.nameLength;
  }
  if (values.bio.trim().length > PROFILE_LIMITS.bioMax) {
    errors.bio = PROFILE_VALIDATION.bioTooLong;
  }
  if (qualifications.length > PROFILE_LIMITS.qualificationsMax) {
    errors.qualifications = PROFILE_VALIDATION.tooManyQualifications;
  } else if (qualifications.some((line) => line.length > PROFILE_LIMITS.qualificationMax)) {
    errors.qualifications = PROFILE_VALIDATION.qualificationTooLong;
  }
  return errors;
}

/**
 * The subjects to save: the ticked ones, plus any saved subjects that are no longer offered,
 * so removing a subject from the list never deletes it from someone's profile (G9, V28).
 */
export function subjectsToSave(
  ticked: string[],
  saved: string[],
  offered: readonly string[],
): string[] {
  const noLongerOffered = saved.filter((key) => !offered.includes(key));
  return [...new Set([...ticked, ...noLongerOffered])];
}
