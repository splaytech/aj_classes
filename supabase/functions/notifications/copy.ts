// Every word in the portal emails: "work returned" (ADR-0004; design 03 §3.4.5), "new assignment"
// and "due tomorrow" (ADR-0008; design 03b §8.5). The edge runtime can't import
// apps/web/src/constants, so the wording lives here. No mark, score, feedback, instructions,
// question or attachment name ever goes in (AC-3.3, AC-8.2, AC-8.9): a forwarded email shouldn't
// reveal a child's result or the work itself.

export type RecipientRole = 'student' | 'parent';

// Must match the email_outbox.kind check (migration 20261029100000) and EmailKind in
// apps/web/src/services/types.ts.
export const EMAIL_KINDS = ['work_returned', 'new_assignment', 'due_tomorrow'] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export type WorkReturnedWords = {
  childFirstName: string;
  assignmentTitle: string;
  className: string;
};

export type AssignmentWords = WorkReturnedWords & { dueDate: string }; // '' when there's no due date

// Sender on the verified ajclasses.com.au domain, the same as the sign-in emails (config.toml).
export const SENDER = {
  name: 'AJ Classes',
  email: 'hello@ajclasses.com.au',
  replyTo: 'hello@ajclasses.com.au',
} as const;

const dueSentence = (dueDate: string) => (dueDate === '' ? '' : ` It's due ${dueDate}.`);

export const COPY = {
  from: `${SENDER.name} <${SENDER.email}>`,
  brandLabel: { student: 'Students', parent: 'Parents' },
  greeting: (firstName: string) => (firstName === '' ? 'Hi,' : `Hi ${firstName},`),
  footerReason: "You're getting this because you have an AJ Classes portal account.",
  footerStop: 'To stop these emails, go to Account → Notifications:',

  // "Work returned" (item 3). These top-level keys are kept as they were.
  subject: {
    student: (words: WorkReturnedWords) => `Your work has been marked: ${words.assignmentTitle}`,
    parent: (words: WorkReturnedWords) =>
      `${words.childFirstName}'s work has been marked: ${words.assignmentTitle}`,
  },
  body: {
    student: (words: WorkReturnedWords) =>
      `Your tutor has marked "${words.assignmentTitle}" for ${words.className} and returned it to you.`,
    parent: (words: WorkReturnedWords) =>
      `${words.childFirstName}'s tutor has marked "${words.assignmentTitle}" for ${words.className} and returned it.`,
  },
  button: 'View feedback',

  newAssignment: {
    subject: {
      student: (words: AssignmentWords) => `New work set: ${words.assignmentTitle}`,
      parent: (words: AssignmentWords) =>
        `New work for ${words.childFirstName}: ${words.assignmentTitle}`,
    },
    body: {
      student: (words: AssignmentWords) =>
        `Your tutor has set "${words.assignmentTitle}" for ${words.className}.${dueSentence(words.dueDate)}`,
      parent: (words: AssignmentWords) =>
        `${words.childFirstName}'s tutor has set "${words.assignmentTitle}" for ${words.className}.${dueSentence(words.dueDate)}`,
    },
    button: 'View assignment',
  },

  dueTomorrow: {
    subject: {
      student: (words: AssignmentWords) => `Due tomorrow: ${words.assignmentTitle}`,
      parent: (words: AssignmentWords) =>
        `${words.childFirstName}'s work is due tomorrow: ${words.assignmentTitle}`,
    },
    body: {
      student: (words: AssignmentWords) =>
        `"${words.assignmentTitle}" for ${words.className} is due tomorrow (${words.dueDate}) and hasn't been handed in yet.`,
      parent: (words: AssignmentWords) =>
        `${words.childFirstName}'s "${words.assignmentTitle}" for ${words.className} is due tomorrow (${words.dueDate}) and hasn't been handed in yet.`,
    },
    button: 'View assignment',
  },
} as const;

// Must match apps/web/src/constants/routes.constants.ts (PORTAL_ROUTE_PATTERNS.studentAssignment,
// .parentChildAssignment and PORTAL_ROUTES.account) and the Notifications section id on the
// Account page. A signed-out person lands on sign-in and comes back through the `next` rule.
// All three emails link to the same assignment pages.
export const PATHS = {
  studentAssignment: (assignmentId: string) => `/portal/student/assignments/${assignmentId}`,
  parentChildAssignment: (studentId: string, assignmentId: string) =>
    `/portal/parent/children/${studentId}/assignments/${assignmentId}`,
  accountNotifications: '/portal/account#notifications',
} as const;
