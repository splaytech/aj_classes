// Every word on the family pages (R3b): the admin's student page, and later the student and
// parent portals. Error messages live in error.constants.ts.

import type { ConsentSource } from './app.constants';

export const ADMIN_STUDENT_PAGE = {
  back: '← Students',
  archived: 'This student is archived, so they and their parents can’t see their work.',
  consent: {
    heading: 'Parental consent',
    intro: 'A parent or guardian must agree before the student gets their own account.',
    none: 'Not recorded yet.',
    recorded: (date: string, source: string) => `Recorded on ${date} by ${source}.`,
    sources: {
      admin: 'an admin',
      parent: 'a parent in the portal',
    } satisfies Record<ConsentSource, string>,
    record: 'Record consent',
    confirmTitle: 'Record consent?',
    confirmText: (name: string) =>
      `Confirm that a parent or guardian has agreed to ${name} using the AJ Classes portal, for example on the enrolment form. This is recorded with your name.`,
    done: 'Consent recorded.',
  },
  account: {
    heading: 'Student account',
    intro: 'The student signs in to see their classes and do assignments online.',
    emailLabel: 'Student’s e-mail',
    send: 'Send invite',
    sending: 'Sending…',
    needsConsent: 'Record consent first.',
    sent: (email: string) => `Invite sent to ${email}.`,
    email: (email: string) => `E-mail: ${email}`,
    invitedOn: (date: string) => `Invited on ${date}. They haven’t set a password yet.`,
    expired: 'The invite link has expired. Send a new one.',
    lastSignIn: (date: string) => `Last sign-in ${date}`,
    neverSignedIn: 'Not signed in yet.',
    termsAccepted: (date: string) => `Accepted the Terms ${date}.`,
    resend: 'Resend invite',
    resent: 'A new invite link has been sent.',
    cancel: 'Cancel invite',
    confirmCancelTitle: 'Cancel this invite?',
    confirmCancelText: (email: string) =>
      `The pending account for ${email} will be removed. You can invite the student again later.`,
    cancelled: 'Invite cancelled.',
    deactivate: 'Deactivate',
    reactivate: 'Reactivate',
    confirmDeactivateTitle: 'Deactivate this account?',
    confirmDeactivateText: (name: string) =>
      `${name} will be signed out and lose access straight away. Their work and marks are kept.`,
    confirmReactivateTitle: 'Reactivate this account?',
    confirmReactivateText: (name: string) => `${name} will be able to sign in again.`,
    deactivated: 'Deactivated.',
    reactivated: 'Reactivated.',
  },
  parents: {
    heading: 'Parents',
    intro: 'Parents see this student’s assignments, marks, progress and tutor comments.',
    empty: 'No parents linked yet.',
    add: 'Invite or link a parent',
    resend: 'Resend invite',
    resent: 'A new invite link has been sent.',
    remove: 'Remove',
    removeLabel: (name: string) => `Remove ${name}`,
    confirmRemoveTitle: 'Remove this parent?',
    confirmRemoveText: (parent: string, student: string) =>
      `${parent} will no longer see ${student}’s work. Their account stays, so you can link them again.`,
    removed: 'Parent removed.',
    invited: (email: string) => `Invite sent to ${email}.`,
    linked: (email: string) => `${email} already had a parent account and is now linked.`,
    // Each parent's optional permissions (invite-onboarding.md, "Consents"): check before
    // publishing a result or video; if parents differ, ask the family.
    permissionsLabel: (name: string) => `${name}’s permissions`,
    termsAccepted: (date: string) => `Accepted the Terms ${date}`,
    permissionsHint:
      'Check these before sharing a result or video. If parents differ, ask the family.',
  },
  classes: {
    heading: 'Classes',
    empty: 'Not in a class yet.',
  },
} as const;

export const PARENT_INVITE_DIALOG = {
  heading: 'Invite or link a parent',
  intro: (student: string) =>
    `They’ll get an e-mail to set their password, then they can follow ${student}’s work. If the e-mail already has a parent account, it’s linked without a new invite.`,
  nameLabel: 'Parent’s full name',
  nameHint: 'Not needed if they already have a parent account.',
  emailLabel: 'Parent’s e-mail',
  emailRequired: 'Please enter their e-mail address.',
  send: 'Invite or link',
  sending: 'Sending…',
} as const;

// --- Student and parent portals ---------------------------------------------------------------

export const FAMILY_STATUSES = ['not_started', 'in_progress', 'submitted', 'returned'] as const;
export type FamilyStatus = (typeof FAMILY_STATUSES)[number];

export const FAMILY_STATUS_LABELS: Record<FamilyStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Waiting for marking',
  returned: 'Returned',
};

export const STUDENT_HOME = {
  greeting: (firstName: string) => `Hi ${firstName}`,
  intro: 'Your assignments and classes at AJ Classes.',
  timetableLink: 'My timetable',
  toDo: {
    heading: 'To do',
    empty: 'Nothing to do right now. Nice work!',
    start: 'Start',
    continue: 'Continue',
    open: 'Open',
    answered: (answered: number, total: number) => `${answered} of ${total} answered`,
    paper: 'On paper: hand it in to your tutor',
  },
  submitted: {
    heading: 'Waiting for marking',
    handedIn: (date: string) => `Handed in ${date}`,
  },
  returned: {
    heading: 'Marked and returned',
    empty: 'Nothing returned yet.',
    view: 'See results',
  },
} as const;

export const PROGRESS_TEXT = {
  heading: 'Progress',
  done: 'Done',
  doneValue: (done: number, total: number) => `${done} of ${total}`,
  average: 'Average mark',
  averageValue: (percent: number) => `${percent}%`,
  noMarks: 'No marks yet',
  onTime: 'Handed in on time',
  onTimeValue: (onTime: number, total: number) => `${onTime} of ${total}`,
  nothingHandedIn: 'Nothing handed in yet',
} as const;

export const SCORE_TEXT = {
  score: (mark: string, total: number) => `${mark} / ${total}`,
  scoreWithPercent: (mark: string, total: number, percent: number) =>
    `${mark} / ${total} (${percent}%)`,
  noMark: 'No mark',
} as const;

export const SOLVE_PAGE = {
  back: '← My work',
  instructionsHeading: 'Instructions',
  noInstructions: 'No instructions.',
  paperNote: 'This one is done on paper. Hand it in to your tutor.',
  progress: (answered: number, total: number) => `${answered} of ${total} answered`,
  questionNumber: (position: number) => `Question ${position}`,
  marks: (marks: number) => (marks === 1 ? '1 mark' : `${marks} marks`),
  optionsLabel: (position: number) => `Answer for question ${position}`,
  writtenLabel: 'Your answer',
  characters: (used: number, max: number) => `${used} / ${max}`,
  saving: 'Saving…',
  saved: 'Saved',
  notSaved: 'Not saved',
  saveFailed: 'Not saved. Check your connection, then change your answer to try again.',
  submit: 'Hand in',
  submitting: 'Handing in…',
  confirmSubmitTitle: 'Hand in your work?',
  confirmSubmitText: (unanswered: number) =>
    unanswered === 0
      ? 'You’ve answered every question. You can’t change your answers after this.'
      : `${unanswered === 1 ? '1 question isn’t' : `${unanswered} questions aren’t`} answered yet. You can’t change your answers after this.`,
  handedIn: 'Handed in! Your tutor will mark it soon.',
  autoMarked: 'Handed in and marked. Here are your results.',
  waiting: (date: string) => `Handed in ${date}. Waiting for your tutor to mark it.`,
  late: 'Late',
  due: (date: string) => `Due ${date}`,
} as const;

export const RESULTS_TEXT = {
  heading: 'Your results',
  headingFor: (name: string) => `${name}’s results`,
  commentHeading: 'Comment from the tutor',
  yourAnswer: 'Your answer',
  theirAnswer: 'Their answer',
  correctAnswer: 'Correct answer',
  noAnswer: 'No answer.',
  awarded: (awarded: string, marks: number) => `${awarded} / ${marks}`,
  feedback: (text: string) => `Tutor feedback: ${text}`,
  explanation: (text: string) => `Explanation: ${text}`,
} as const;

export const STUDENT_TIMETABLE_PAGE = {
  heading: 'My timetable',
  intro: 'Your weekly classes. Times are Melbourne time.',
  empty: 'You’re not in any classes yet.',
} as const;

export const PARENT_HOME = {
  invoices: {
    heading: 'Fees and invoices',
    text: 'See and pay your invoices online, and download receipts, in our secure billing portal (Zoho Invoice).',
    open: 'Open billing portal',
    newTab: '(opens in a new tab)',
  },
  greeting: (firstName: string) => `Hi ${firstName}`,
  intro: 'Follow your children’s work at AJ Classes.',
  empty: 'No children are linked to your account yet. Please contact AJ Classes.',
  notInClass: 'Not in a class yet',
  toDo: (count: number) => (count === 1 ? '1 to do' : `${count} to do`),
  average: (percent: number) => `Average ${percent}%`,
  view: 'View progress',
  accountStatus: {
    none: 'No student account yet',
    invited: 'Student account invite sent',
    active: 'Has a student account',
    deactivated: 'Student account deactivated',
  },
  consent: {
    heading: (name: string) => `Can ${name} use the portal?`,
    text: (name: string) =>
      `With your permission, AJ Classes can give ${name} their own sign-in to see their classes and do assignments online.`,
    allow: 'Allow',
    confirmTitle: (name: string) => `Allow ${name} to use the portal?`,
    confirmText: (name: string) =>
      `AJ Classes will invite ${name} to their own account. Their work, marks and tutor comments stay visible to you.`,
    done: 'Thank you. AJ Classes can now invite them.',
  },
} as const;

export const PARENT_CHILD_PAGE = {
  back: '← My children',
  assignmentsHeading: 'Assignments',
  empty: 'Nothing has been set yet.',
  columns: { title: 'Assignment', class: 'Class', due: 'Due', status: 'Status', mark: 'Mark' },
  comment: (text: string) => `Tutor: ${text}`,
  timetableHeading: 'Timetable',
  timetableEmpty: 'Not in any classes yet.',
} as const;

export const PARENT_ASSIGNMENT_PAGE = {
  back: (name: string) => `← ${name}`,
  notStarted: (name: string) => `${name} hasn’t started this yet.`,
  inProgress: (name: string) =>
    `${name} has started. You’ll see their answers once they hand it in.`,
  waiting: (date: string) => `Handed in ${date}. Waiting for the tutor to mark it.`,
} as const;
