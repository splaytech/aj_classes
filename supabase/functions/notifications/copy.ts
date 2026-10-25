// Every word in the "work returned" email (ADR-0004; design 03 §3.4.5). The edge runtime can't
// import apps/web/src/constants, so the wording lives here. No mark, score or feedback text ever
// goes in (AC-3.3): a forwarded email shouldn't reveal a child's result.

export type RecipientRole = 'student' | 'parent';

export type WorkReturnedWords = {
  childFirstName: string;
  assignmentTitle: string;
  className: string;
};

// Sender on the verified ajclasses.com.au domain, the same as the sign-in emails (config.toml).
export const SENDER = {
  name: 'AJ Classes',
  email: 'hello@ajclasses.com.au',
  replyTo: 'hello@ajclasses.com.au',
} as const;

export const COPY = {
  from: `${SENDER.name} <${SENDER.email}>`,
  brandLabel: { student: 'Students', parent: 'Parents' },
  subject: {
    student: (words: WorkReturnedWords) => `Your work has been marked: ${words.assignmentTitle}`,
    parent: (words: WorkReturnedWords) =>
      `${words.childFirstName}'s work has been marked: ${words.assignmentTitle}`,
  },
  greeting: (firstName: string) => (firstName === '' ? 'Hi,' : `Hi ${firstName},`),
  body: {
    student: (words: WorkReturnedWords) =>
      `Your tutor has marked "${words.assignmentTitle}" for ${words.className} and returned it to you.`,
    parent: (words: WorkReturnedWords) =>
      `${words.childFirstName}'s tutor has marked "${words.assignmentTitle}" for ${words.className} and returned it.`,
  },
  button: 'View feedback',
  footerReason: "You're getting this because you have an AJ Classes portal account.",
  footerStop: 'To stop these emails, go to Account → Notifications:',
} as const;

// Must match apps/web/src/constants/routes.constants.ts (PORTAL_ROUTE_PATTERNS.studentAssignment,
// .parentChildAssignment and PORTAL_ROUTES.account) and the Notifications section id on the
// Account page. A signed-out person lands on sign-in and comes back through the `next` rule.
export const PATHS = {
  studentAssignment: (assignmentId: string) => `/portal/student/assignments/${assignmentId}`,
  parentChildAssignment: (studentId: string, assignmentId: string) =>
    `/portal/parent/children/${studentId}/assignments/${assignmentId}`,
  accountNotifications: '/portal/account#notifications',
} as const;
