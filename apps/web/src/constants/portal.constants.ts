// Every word on the staff portal pages (R2a). Error messages live in error.constants.ts.

import { AUTH_LIMITS } from './app.constants';
import type { StaffRole } from './app.constants';
import { BUSINESS } from './business.constants';

export const PORTAL_SEO = {
  titleSuffix: ' | AJ Classes Staff',
  login: 'Sign in',
  loginVerify: 'Enter your code',
  forgotPassword: 'Forgot password',
  authConfirm: 'Continue',
  setPassword: 'Set your password',
  account: 'Your account',
  twoStepSetup: 'Set up two-step sign-in',
  tutor: 'Dashboard',
  admin: 'Admin',
  notFound: 'Page not found',
} as const;

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  tutor: 'Tutor',
  admin: 'Admin',
};

export const PORTAL_COMMON = {
  loading: 'Loading…',
  errorHeading: 'Something went wrong',
  tryAgain: 'Try again',
  signOut: 'Sign out',
  signingOut: 'Signing out…',
  backToSite: '← Back to the AJ Classes website',
  staffArea: 'Staff',
  navLabel: 'Staff portal',
  nav: {
    tutor: 'Dashboard',
    admin: 'Admin',
    account: 'Account',
  },
  show: 'Show',
  hide: 'Hide',
  showPasswordLabel: 'Show password',
  hidePasswordLabel: 'Hide password',
  space: ' ',
} as const;

export const PORTAL_UNAVAILABLE = {
  heading: "Staff sign-in isn't available right now",
  text: `Please try again later, or email ${BUSINESS.email}.`,
} as const;

export const PORTAL_FORBIDDEN = {
  heading: "You don't have access to this page",
  text: 'This page is for admins only.',
  backHome: 'Go to your dashboard',
} as const;

export const PORTAL_NOT_FOUND = {
  heading: 'Page not found',
  text: "This staff page doesn't exist.",
  backHome: 'Go to your dashboard',
} as const;

export const LOGIN_PAGE = {
  heading: 'Staff sign in',
  intro: 'For AJ Classes tutors and admins.',
  labels: {
    email: 'Email',
    password: 'Password',
  },
  submit: 'Sign in',
  submitting: 'Signing in…',
  forgotPassword: 'Forgot your password?',
  passwordChanged: 'Your password has been changed. Please sign in.',
} as const;

export const LOGIN_VERIFY_PAGE = {
  heading: 'Enter your code',
  intro: 'Open your authenticator app and enter the 6-digit code for AJ Classes.',
  chooseAuthenticator: 'Which authenticator?',
  codeLabel: '6-digit code',
  submit: 'Verify',
  submitting: 'Checking…',
  cancel: 'Cancel and sign out',
  localDevAuto: 'Local development: entering your code automatically…',
} as const;

export const FORGOT_PASSWORD_PAGE = {
  heading: 'Forgot your password?',
  intro: "Enter your email and we'll send you a link to set a new password.",
  emailLabel: 'Email',
  submit: 'Send link',
  submitting: 'Sending…',
  sent: `If that email has an account, we've sent a link. It expires in ${AUTH_LIMITS.linkExpiryHours} hour.`,
  backToLogin: '← Back to sign in',
} as const;

export const AUTH_CONFIRM_PAGE = {
  heading: {
    invite: 'Welcome to AJ Classes',
    recovery: 'Reset your password',
  },
  intro: {
    invite: "You've been invited to the AJ Classes staff portal. Continue to set your password.",
    recovery: 'Continue to choose a new password.',
  },
  continue: 'Continue',
  checking: 'Checking your link…',
  invalidLink: 'This link is incomplete. Please use the button in the email.',
  requestNewLink: 'Request a new link',
} as const;

export const SET_PASSWORD_PAGE = {
  heading: 'Set your password',
  intro: `Use at least ${AUTH_LIMITS.passwordMin} characters. A short sentence is easy to remember and hard to guess.`,
  twoStepIntro:
    'Your account uses two-step sign-in. Enter a code from your authenticator app first.',
  labels: {
    password: 'New password',
    confirm: 'Type it again',
  },
  submit: 'Save password',
  submitting: 'Saving…',
} as const;

export const ACCOUNT_PAGE = {
  heading: 'Your account',
  signedInAs: 'Signed in as',
  role: 'Role',
  password: {
    heading: 'Change password',
    intro: `Use at least ${AUTH_LIMITS.passwordMin} characters. Other devices will be signed out.`,
    codeSent:
      'You signed in more than a day ago, so we emailed you a 6-digit code to confirm it’s you.',
    resendCode: 'Email me a new code',
    codeResent: 'We sent a new code.',
    labels: {
      code: 'Code from the email',
      password: 'New password',
      confirm: 'Type it again',
    },
    submit: 'Change password',
    submitting: 'Saving…',
    done: 'Password changed. Other devices have been signed out.',
  },
  twoStep: {
    heading: 'Two-step sign-in',
    on: 'On. You sign in with your password and a code from your authenticator app.',
    off: 'Not set up.',
    adminRequired: 'Admins must use two-step sign-in.',
    added: (date: string) => `Added ${date}`,
    addBackup: 'Add a backup authenticator',
    setUp: 'Set up two-step sign-in',
    backupHint: 'A backup (for example a password manager) means a lost phone won’t lock you out.',
    remove: 'Remove',
    removing: 'Removing…',
    confirmRemove: (name: string) =>
      `Remove "${name}"? You won't be able to sign in with it any more.`,
    lastOne: 'You need at least one authenticator. Add another before removing this one.',
    maxReached: `You have the maximum of ${AUTH_LIMITS.maxAuthenticators} authenticators.`,
  },
} as const;

export const TWO_STEP_SETUP_PAGE = {
  heading: 'Set up two-step sign-in',
  intro:
    'Admins sign in with a password and a code from an authenticator app (such as Google Authenticator, Microsoft Authenticator or 1Password).',
  nameLabel: 'Name this authenticator',
  nameHint: 'For example "Phone" or "1Password".',
  defaultName: 'Phone',
  start: 'Continue',
  starting: 'Preparing…',
  scanStep: '1. Scan this QR code with your authenticator app.',
  qrAlt: 'QR code for your authenticator app',
  secretStep: "Can't scan it? Enter this key instead:",
  codeStep: '2. Enter the 6-digit code your app shows.',
  codeLabel: '6-digit code',
  submit: 'Turn on two-step sign-in',
  submitting: 'Checking…',
  cancel: 'Cancel',
  done: 'Two-step sign-in is on.',
} as const;

export const TUTOR_DASHBOARD = {
  welcome: (firstName: string) => `Welcome, ${firstName}`,
  intro: 'This is your AJ Classes staff area.',
  comingSoon: 'Coming soon',
  cards: [
    { title: 'My profile', text: 'Your name, subjects, bio, qualifications and photo.' },
    { title: 'Classes', text: 'Your classes and timetable.' },
    { title: 'Assignments', text: 'Set and mark homework.' },
  ],
} as const;

export const ADMIN_DASHBOARD = {
  heading: 'Admin',
  intro: 'Manage AJ Classes staff and access.',
  comingSoon: 'Coming soon',
  cards: [
    { title: 'Staff', text: 'Invite tutors, change roles and deactivate accounts.' },
    { title: 'Activity', text: 'Who changed staff access, and when.' },
  ],
} as const;

export const FOOTER_PORTAL = {
  staffSignIn: 'Staff sign in',
} as const;
