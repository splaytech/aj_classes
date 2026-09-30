// Form validation. Each check is a small, separate function so the rules are easy to read.
// Every message comes from error.constants.ts.

import { FORM_LIMITS, VALIDATION } from '@/constants';
import type { ContactMethod } from '@/constants';

export type ContactFormValues = {
  name: string;
  email: string;
  phone: string;
  contactMethod: ContactMethod | '';
  role: string;
  enquiryType: string;
  yearLevel: string;
  message: string;
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

function validatePhone(phone: string, contactMethod: string): string | undefined {
  const isEmpty = phone.trim() === '';
  if (isEmpty && contactMethod === 'phone') return VALIDATION.phoneRequiredForCall;
  if (!isEmpty && !isValidAustralianPhone(phone)) return VALIDATION.phoneInvalid;
  return undefined;
}

function validateMessage(message: string, enquiryType: string): string | undefined {
  // A message is optional when registering interest, required for questions.
  const isRequired = enquiryType !== 'registerInterest';
  if (isRequired && message.trim() === '') return VALIDATION.messageRequired;
  if (message.length > FORM_LIMITS.messageMax) return VALIDATION.messageTooLong;
  return undefined;
}

export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {
    name: validateName(values.name),
    email: validateEmail(values.email),
    phone: validatePhone(values.phone, values.contactMethod),
    contactMethod: values.contactMethod === '' ? VALIDATION.contactMethodRequired : undefined,
    message: validateMessage(values.message, values.enquiryType),
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
