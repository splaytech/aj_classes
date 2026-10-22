// Checks for staff portal forms. Each returns an error message, or '' when the value is fine.

import { AUTH_LIMITS, PORTAL_VALIDATION } from '@/constants';

import { isValidEmail } from './validation';

export function checkEmail(email: string): string {
  if (!email.trim()) return PORTAL_VALIDATION.emailRequired;
  if (!isValidEmail(email)) return PORTAL_VALIDATION.emailInvalid;
  return '';
}

export function checkPasswordEntered(password: string): string {
  return password ? '' : PORTAL_VALIDATION.passwordRequired;
}

/** A new password: long enough (Supabase checks it too). */
export function checkNewPassword(password: string): string {
  return password.length >= AUTH_LIMITS.passwordMin ? '' : PORTAL_VALIDATION.passwordTooShort;
}

export function checkPasswordsMatch(password: string, confirmation: string): string {
  return password === confirmation ? '' : PORTAL_VALIDATION.passwordsDiffer;
}

export function checkCode(code: string): string {
  return /^\d+$/.test(code) && code.length === AUTH_LIMITS.codeLength
    ? ''
    : PORTAL_VALIDATION.codeInvalid;
}
