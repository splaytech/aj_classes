// Checks for the setup form at /portal/join (invite-onboarding design). The database function
// complete_onboarding() enforces the same rules; these only give quick, friendly messages.
// Which fields exist depends on the role, which comes from the server (my_onboarding), never
// from the link or the browser.

import { PORTAL_VALIDATION, PROFILE_LIMITS, PROFILE_VALIDATION, YEAR_LEVELS } from '@/constants';
import type { AppRole } from '@/constants';
import type { Consents, OnboardingInput } from '@/services';

import { NO_CONSENTS, asksForConsents } from './consents';

import { checkNewPassword, checkPasswordsMatch } from './portal-validation';
import { isValidAustralianPhone } from './validation';

/** The year-level choice for students who aren't at school (e.g. UCAT, GAMSAT). */
export const OTHER_YEAR_LEVEL = 'other';

export type OnboardingValues = {
  fullName: string;
  phone: string;
  yearLevel: string; // '' until chosen
  password: string;
  confirmation: string;
  acceptsTerms: boolean;
  /** Optional, parents only (invite-onboarding.md, "Consents"). Never required. */
  consents: Consents;
};

export type OnboardingField = 'fullName' | 'phone' | 'yearLevel' | 'password' | 'confirm' | 'terms';
export type OnboardingErrors = Partial<Record<OnboardingField, string>>;

/** Staff give a phone number. */
export function asksForPhone(role: AppRole): boolean {
  return role === 'tutor' || role === 'admin';
}

/** Students give their year level. */
export function asksForYearLevel(role: AppRole): boolean {
  return role === 'student';
}

export function isYearLevelChoice(value: string): boolean {
  return value === OTHER_YEAR_LEVEL || YEAR_LEVELS.some((year) => String(year) === value);
}

/** The form's starting year level: the roster's, when it has one. */
export function initialYearLevel(rosterYearLevel: number | null): string {
  return rosterYearLevel === null ? '' : String(rosterYearLevel);
}

export function validateOnboarding(values: OnboardingValues, role: AppRole): OnboardingErrors {
  const errors: OnboardingErrors = {};
  const name = values.fullName.trim();

  if (name.length < PROFILE_LIMITS.nameMin || name.length > PROFILE_LIMITS.nameMax) {
    errors.fullName = PROFILE_VALIDATION.nameLength;
  }
  if (asksForPhone(role) && !isValidAustralianPhone(values.phone)) {
    errors.phone = PORTAL_VALIDATION.phoneInvalid;
  }
  if (asksForYearLevel(role) && !isYearLevelChoice(values.yearLevel)) {
    errors.yearLevel = PORTAL_VALIDATION.yearLevelRequired;
  }

  const password = checkNewPassword(values.password);
  if (password) errors.password = password;
  const confirm = checkPasswordsMatch(values.password, values.confirmation);
  if (confirm) errors.confirm = confirm;

  if (!values.acceptsTerms) errors.terms = PORTAL_VALIDATION.termsRequired;
  return errors;
}

/** What gets sent: fields the role doesn't have are left out (null), never sent empty. */
export function toOnboardingInput(values: OnboardingValues, role: AppRole): OnboardingInput {
  return {
    fullName: values.fullName.trim(),
    password: values.password,
    phone: asksForPhone(role) ? values.phone.trim() : null,
    yearLevel: asksForYearLevel(role) ? values.yearLevel : null,
    acceptsTerms: values.acceptsTerms,
    consents: asksForConsents(role) ? values.consents : NO_CONSENTS,
  };
}
