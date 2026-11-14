// Every word on the open sign-up pages (ADR-0011; docs/delivery/2026-11-13-open-sign-up 03 §7.1).
// Sign-up is for parents and guardians; the account sees only the latest news until AJ Classes
// links it to a student.

import { AUTH_LIMITS } from './app.constants';
import { JOIN_PAGE } from './portal.constants';

/** How long the confirmation link lasts (Supabase otp_expiry, 3600 s). */
export const SIGN_UP_HOURS = AUTH_LIMITS.linkExpiryHours;
const hours = (n: number) => `${n} hour${n === 1 ? '' : 's'}`;

// AC-19 and AC-20 share one wording.
export const FINISH_SIGN_UP_HINT = {
  before: 'To finish signing up, use the link we e-mailed you, or ',
  link: 'Forgot password',
  after: '.',
} as const;

export const SIGN_UP_PAGE = {
  heading: 'Create an account',
  intro: 'For parents and guardians. Students get their accounts from AJ Classes.',
  labels: { fullName: 'Full name', email: 'Email' },
  submit: 'Create account',
  submitting: 'Creating…',
  notice: {
    before: 'We use your name and e-mail to run your account. See our ',
    link: 'Privacy Policy',
    after: '.',
  },
  or: 'or',
  google: 'Continue with Google',
  haveAccount: 'Already have an account? ',
  signIn: 'Sign in',
  sent: {
    heading: 'Check your e-mail',
    text: `We've sent a link to confirm your address. It expires in ${hours(SIGN_UP_HOURS)}.`,
    help: {
      before: 'Already have an account? ',
      signIn: 'Sign in',
      between: ' or ',
      reset: 'reset your password',
      after: '.',
    },
    sendAgain: 'Send the link again',
  },
  busy: 'Sign-up is busy right now. Please try again tomorrow.',
  closed: {
    heading: 'Sign-up is closed',
    text: 'New accounts are closed at the moment. If you already have an account, please sign in.',
  },
} as const;

// The reply reuses SIGN_UP_PAGE.sent plus FINISH_SIGN_UP_HINT.
export const SIGN_UP_RESEND_PAGE = {
  heading: 'Send the link again',
  intro: 'Enter the e-mail you signed up with.',
  submit: 'Send link',
  submitting: 'Sending…',
} as const;

export const FINISH_SIGN_UP = {
  heading: 'Finish creating your account',
  intro: (email: string) => `You're signing up as ${email}.`,
  labels: {
    fullName: 'Full name',
    password: 'Create password',
    confirm: 'Confirm password',
    code: 'Code from the email',
  },
  hints: { password: JOIN_PAGE.hints.password },
  terms: {
    before: "I'm a parent or guardian, and I agree to the ",
    termsLink: 'Terms & Conditions',
    between: ' and ',
    privacyLink: 'Privacy Policy',
    after: '.',
  },
  submit: 'Finish',
  submitting: 'Finishing…',
  codeSent: "For your security, we've emailed you a code. Enter it below, then press Finish again.",
  signOut: 'Not you? Sign out',
} as const;

export const AUTH_CALLBACK_PAGE = {
  checking: 'Signing you in…',
  backToSignIn: 'Back to sign in',
} as const;
