// Every error and validation message shown to users.

import { BUSINESS } from './business.constants';
import { FORM_LIMITS } from './app.constants';

export const VALIDATION = {
  nameRequired: 'Please enter your name.',
  nameLength: `Your name should be ${FORM_LIMITS.nameMin}–${FORM_LIMITS.nameMax} characters.`,
  emailRequired: 'Please enter your email address.',
  emailInvalid: 'Please enter a valid email address, like name@example.com.',
  phoneRequiredForCall: 'Please enter a phone number so we can call you, or choose email instead.',
  phoneInvalid: 'Please enter a valid Australian phone number.',
  contactMethodRequired: 'Please choose how we should contact you.',
  messageRequired: 'Please add a short message so we know how to help.',
  messageTooLong: `Please keep your message under ${FORM_LIMITS.messageMax} characters.`,
  consentRequired: 'Please tick the box to subscribe.',
  captchaRequired: 'Please complete the "I am human" check.',
} as const;

export const FORM_ERRORS = {
  summary: 'Please fix the highlighted fields.',
  network: `Sorry, something went wrong sending your details. Please try again, or email us at ${BUSINESS.email}.`,
  notConfigured: `Our form is being set up. Please email us at ${BUSINESS.email}.`,
} as const;

export const NOT_FOUND = {
  heading: 'Page not found',
  text: "Sorry, we couldn't find that page. It may have moved, or the link may be wrong.",
  backHome: 'Go to the home page',
} as const;
