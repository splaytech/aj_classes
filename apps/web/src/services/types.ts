// Result types shared by all services. Components only ever see these, never backend details.

import type { PORTAL_ERRORS, StaffRole } from '@/constants';

/** Outcome of sending something to the backend. */
export type SubmitResult = 'success' | 'error' | 'not-configured';

// --- Staff portal (R2a) -------------------------------------------------------

/** A problem the portal can show to the user. The text for each key is in PORTAL_ERRORS. */
export type ErrorKey = keyof typeof PORTAL_ERRORS;

/** Outcome of a portal action: either it worked (with optional data) or an error to show. */
export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: ErrorKey };

/** Who is using the portal right now. Built fresh by `getAccessState()` on every private page. */
export type AccessState = {
  signedIn: boolean;
  userId: string;
  email: string;
  /** null when signed out, or when the profile can't be read (e.g. deactivated). */
  profile: { fullName: string; role: StaffRole } | null;
  /** aal2 = password and authenticator code; aal1 = password (or email link) only. */
  aal: 'aal1' | 'aal2';
  hasVerifiedFactor: boolean;
};

/** An authenticator app linked to the account (two-step sign-in). */
export type Authenticator = {
  id: string;
  name: string;
  addedAt: string; // ISO date
};

/** What the two-step setup page needs to show after starting. */
export type TwoStepEnrolment = {
  factorId: string;
  qrCodeSvg: string; // data: URL of an SVG image
  secret: string; // the same key as text, for people who can't scan
};

/** Which email link was opened: an invite or a password reset. */
export type EmailLinkType = 'invite' | 'recovery';

/** A staff member's profile, as shown and edited on the profile page. */
export type StaffProfile = {
  id: string;
  email: string;
  fullName: string;
  bio: string;
  qualifications: string[];
  subjects: string[]; // keys, see SUBJECTS
  photoPath: string | null;
  photoUrl: string | null;
};

/** The text parts of a profile a person can change themselves. */
export type ProfileChanges = Pick<StaffProfile, 'fullName' | 'bio' | 'qualifications' | 'subjects'>;

// --- Staff management (R2a step 7) -----------------------------------------------

/** A staff member as admins see them in the staff list. */
export type StaffMember = {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  invitedAt: string | null;
  joinedAt: string | null;
  lastSignInAt: string | null;
  hasTwoStep: boolean;
};

/** One entry in the activity (audit) list. */
export type ActivityEntry = {
  id: number;
  at: string;
  action: ActivityAction;
  actorName: string;
  targetName: string;
  details: Record<string, unknown>;
};

export type ActivityAction =
  | 'invite_sent'
  | 'invite_resent'
  | 'invite_cancelled'
  | 'role_changed'
  | 'deactivated'
  | 'reactivated'
  | 'two_step_reset'
  | 'profile_edited_by_admin';

// --- Classes, timetable, students, assignments (R3a) ------------------------------

/** ISO day of the week: 1 = Monday … 7 = Sunday. */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Delivery = 'in_person' | 'online';

/** A weekly time slot. Times are "HH:MM:SS", Melbourne wall-clock (R3a design D5). */
export type ClassSession = {
  id: string;
  classId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
};

export type ClassSummary = {
  id: string;
  name: string;
  subject: string;
  yearLevel: number | null;
  delivery: Delivery;
  location: string;
  tutorId: string | null;
  tutorName: string;
  tutorIsActive: boolean;
  startsOn: string | null; // "YYYY-MM-DD"
  endsOn: string | null;
  isActive: boolean;
  sessions: ClassSession[];
  studentCount: number;
};

export type StudentSummary = {
  id: string;
  fullName: string;
  yearLevel: number | null;
  isActive: boolean;
};

/** A student with the classes they're in (admin roster). */
export type RosterStudent = StudentSummary & {
  classes: { id: string; name: string }[];
};

export type ClassDetail = ClassSummary & {
  students: StudentSummary[];
};

/** A timetable slot with what's needed to show it on its own. */
export type TimetableEntry = ClassSession & {
  className: string;
  subject: string;
  delivery: Delivery;
  location: string;
  tutorId: string | null;
  tutorName: string;
  startsOn: string | null;
  endsOn: string | null;
};

export type ClassInput = {
  id?: string;
  name: string;
  subject: string;
  yearLevel: number | null;
  delivery: Delivery;
  location: string;
  tutorId: string | null;
  startsOn: string | null;
  endsOn: string | null;
};

export type SessionInput = {
  classId: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:MM"
  endTime: string;
};

export type StudentInput = {
  id?: string;
  fullName: string;
  yearLevel: number | null;
};

export type ResultStatus = 'not_submitted' | 'submitted' | 'marked';

export type AssignmentSummary = {
  id: string;
  classId: string;
  className: string;
  title: string;
  instructions: string;
  dueOn: string | null; // "YYYY-MM-DD"
  maxMark: number | null; // null: feedback only
  /** Ids of students currently in the class. */
  enrolledStudentIds: string[];
  /** Status per student who has a result row. */
  statuses: { studentId: string; status: ResultStatus }[];
};

export type AssignmentResult = {
  studentId: string;
  status: ResultStatus;
  mark: number | null;
  feedback: string;
  markedAt: string | null;
  markedByName: string;
};

export type AssignmentDetail = AssignmentSummary & {
  students: StudentSummary[];
  results: AssignmentResult[];
};

export type AssignmentInput = {
  id?: string;
  classId: string;
  title: string;
  instructions: string;
  dueOn: string | null;
  maxMark: number | null;
};

export type ResultInput = {
  assignmentId: string;
  studentId: string;
  status: ResultStatus;
  mark: number | null;
  feedback: string;
};
