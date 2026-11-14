// Checks for the sign-up and finish-step forms (open sign-up, ADR-0011). The database (the
// before-user-created hook and complete_sign_up) enforces the same rules; these only give quick,
// friendly messages.

import { PORTAL_VALIDATION, PROFILE_LIMITS, PROFILE_VALIDATION } from '@/constants';

import { checkEmail, checkNewPassword, checkPasswordsMatch } from './portal-validation';

// Control characters (line breaks, tabs) and text-direction overrides, as the database refuses
// (private.is_valid_full_name): they could make a name display misleadingly on admin pages.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const NAME_CHARACTERS_REFUSED = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/;

/** The full name rule (AC-4): 2–100 characters after trimming, on one plain line. */
export function checkFullName(fullName: string): string {
  const name = fullName.trim();
  if (name.length < PROFILE_LIMITS.nameMin || name.length > PROFILE_LIMITS.nameMax) {
    return PROFILE_VALIDATION.nameLength;
  }
  if (NAME_CHARACTERS_REFUSED.test(name)) return PORTAL_VALIDATION.nameCharacters;
  return '';
}

export type SignUpErrors = Partial<Record<'fullName' | 'email', string>>;

/** The sign-up page: name and e-mail (AC-4, AC-5). */
export function validateSignUp(fullName: string, email: string): SignUpErrors {
  const errors: SignUpErrors = {};
  const name = checkFullName(fullName);
  if (name) errors.fullName = name;
  const address = checkEmail(email);
  if (address) errors.email = address;
  return errors;
}

export type FinishSignUpValues = {
  fullName: string;
  password: string;
  confirmation: string;
  acceptsTerms: boolean;
};

export type FinishSignUpErrors = Partial<
  Record<'fullName' | 'password' | 'confirm' | 'terms', string>
>;

/** The finish step (AC-6, AC-7). A Google account is asked for no password. */
export function validateFinishSignUp(
  values: FinishSignUpValues,
  asksForPassword: boolean,
): FinishSignUpErrors {
  const errors: FinishSignUpErrors = {};
  const name = checkFullName(values.fullName);
  if (name) errors.fullName = name;
  if (asksForPassword) {
    const password = checkNewPassword(values.password);
    if (password) errors.password = password;
    const confirm = checkPasswordsMatch(values.password, values.confirmation);
    if (confirm) errors.confirm = confirm;
  }
  if (!values.acceptsTerms) errors.terms = PORTAL_VALIDATION.termsRequired;
  return errors;
}
