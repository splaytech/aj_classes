// Form validation. Each check is a small, separate function so the rules are easy to read.
// Every message comes from error.constants.ts.

import { FORM_LIMITS, VALIDATION } from '@/constants';

export type ContactFormValues = {
  name: string;
  email: string;
  phone: string; // optional
  message: string; // optional
  updatesConsent: boolean;
};

export type ContactFormErrors = Partial<Record<keyof ContactFormValues, string>>;

// A simple email shape check: something@something.something
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Australian numbers: 04xx xxx xxx, 03 xxxx xxxx, or the same with +61 instead of the leading 0.
const AUSTRALIAN_PHONE_PATTERN = /^(\+61|0)[2-478]\d{8}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function isValidAustralianPhone(phone: string): boolean {
  const digitsOnly = phone.replace(/[\s()-]/g, '');
  return AUSTRALIAN_PHONE_PATTERN.test(digitsOnly);
}

function validateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed === '') return VALIDATION.nameRequired;
  if (trimmed.length < FORM_LIMITS.nameMin || trimmed.length > FORM_LIMITS.nameMax) {
    return VALIDATION.nameLength;
  }
  return undefined;
}

function validateEmail(email: string): string | undefined {
  if (email.trim() === '') return VALIDATION.emailRequired;
  if (!isValidEmail(email)) return VALIDATION.emailInvalid;
  return undefined;
}

/** Optional, but if given it must look like an Australian number. */
function validatePhone(phone: string): string | undefined {
  if (phone.trim() === '') return undefined;
  return isValidAustralianPhone(phone) ? undefined : VALIDATION.phoneInvalid;
}

/** Optional, up to the maximum length. */
function validateMessage(message: string): string | undefined {
  return message.length > FORM_LIMITS.messageMax ? VALIDATION.messageTooLong : undefined;
}

export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {
    name: validateName(values.name),
    email: validateEmail(values.email),
    phone: validatePhone(values.phone),
    message: validateMessage(values.message),
  };

  return removeEmptyErrors(errors);
}

export function hasErrors(errors: ContactFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

function removeEmptyErrors(errors: ContactFormErrors): ContactFormErrors {
  const cleaned: ContactFormErrors = {};
  for (const [field, message] of Object.entries(errors)) {
    if (message) {
      cleaned[field as keyof ContactFormValues] = message;
    }
  }
  return cleaned;
}
