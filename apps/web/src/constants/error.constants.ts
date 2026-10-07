// Every error and validation message shown to users.

import { BUSINESS } from './business.constants';
import { AUTH_LIMITS, FORM_LIMITS, PHOTO_LIMITS, PROFILE_LIMITS } from './app.constants';

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

// Every problem the staff portal can show (R2a, R3a). Keys match ErrorKey in src/services/types.ts.
export const PORTAL_ERRORS = {
  // Same message for a wrong email, wrong password or a deactivated account (design §11.4).
  invalidCredentials: 'Email or password is incorrect.',
  notActive: `Your account is not active. Please contact ${BUSINESS.email}.`,
  tooManyAttempts: 'Too many attempts. Please wait a few minutes and try again.',
  captchaFailed: 'Please complete the "I am human" check and try again.',
  weakPassword: `Please use at least ${AUTH_LIMITS.passwordMin} characters, and avoid common passwords.`,
  samePassword: 'Your new password must be different from your current one.',
  linkExpired: 'This link has expired or has already been used.',
  wrongCode: "That code didn't work. Check your device's time is correct and try again.",
  wrongEmailCode: "That code didn't work or has expired. Try again, or ask for a new code.",
  reauthNeeded: 'Please enter the code we emailed you.',
  needsTwoStep: 'Please enter a code from your authenticator app first.',
  lastAuthenticator: 'You need at least one authenticator.',
  authenticatorNameTaken: 'You already have an authenticator with that name. Choose another.',
  notSaved: "Your changes weren't saved. Please try again.",
  photoNotSaved: "Your photo couldn't be saved. Please try again.",
  network: "We couldn't reach the server. Check your connection and try again.",
  notFound: "We couldn't find that. It may have been removed, or you may not have access.",
  notAllowed: "You don't have permission to do that.",
  invalidInput: "Some details aren't valid. Please check them and try again.",
  duplicate: "That's already there.",
  serverProblem: 'Something went wrong on our side. Please try again.',
  lastAdmin: 'There must be at least one active admin.',
  cannotDeactivateSelf: "You can't deactivate your own account.",
  cannotResetSelf: 'To change your own authenticators, use Account → Two-step sign-in.',
  notJoined: "They haven't accepted their invite yet.",
  alreadyJoined: 'They have already joined.',
  alreadyExists: 'This e-mail already has an account.',
  invalidEmail: 'Please enter a valid e-mail address, like name@example.com.',
  invalidName: `Please enter their full name (${PROFILE_LIMITS.nameMin}–${PROFILE_LIMITS.nameMax} characters).`,
  emailFailed: "The invite e-mail couldn't be sent. Please try again.",
  banFailed:
    "Their access was changed, but their current session couldn't be ended. Please try again.",
  notEnrolled: "That student isn't in this class.",
  markTooHigh: "The mark can't be more than the maximum.",
  noMarks: 'This assignment is feedback only, so it has no marks.',
  notConfigured: "Staff sign-in isn't available right now.",
  unknown: 'Something went wrong. Please try again.',
} as const;

export const PORTAL_VALIDATION = {
  emailRequired: 'Please enter your email address.',
  emailInvalid: 'Please enter a valid email address, like name@example.com.',
  passwordRequired: 'Please enter your password.',
  passwordTooShort: `Please use at least ${AUTH_LIMITS.passwordMin} characters.`,
  passwordsDiffer: "The two passwords don't match.",
  codeInvalid: `Please enter the ${AUTH_LIMITS.codeLength}-digit code.`,
  nameRequired: 'Please enter a name.',
  captchaRequired: 'Please complete the "I am human" check.',
} as const;

export const AUTH_LINK_ERRORS = {
  invite: 'Please ask AJ Classes to send you a new invite.',
  recovery: 'Request a new link below.',
} as const;

export const PROFILE_VALIDATION = {
  nameLength: `Please enter your full name (${PROFILE_LIMITS.nameMin}–${PROFILE_LIMITS.nameMax} characters).`,
  bioTooLong: `Please keep your bio under ${PROFILE_LIMITS.bioMax} characters.`,
  qualificationTooLong: `Please keep each qualification under ${PROFILE_LIMITS.qualificationMax} characters.`,
  tooManyQualifications: `Please list at most ${PROFILE_LIMITS.qualificationsMax} qualifications.`,
  photoType: 'Please choose a JPEG, PNG or WebP image.',
  photoTooLarge: `That file is too large. Please choose one under ${PHOTO_LIMITS.maxInputBytes / 1024 / 1024} MB.`,
  photoUnreadable: "That image couldn't be opened. Please try another one.",
} as const;
