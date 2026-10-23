// Result types shared by all services. Components only ever see these, never backend details.

import type {
  AppRole,
  ConsentKind,
  ConsentSource,
  CrmStatus,
  FamilyStatus,
  PORTAL_ERRORS,
  QuestionKind,
  StaffRole,
} from '@/constants';

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
  /** null when signed out, or when the profile can't be read (deactivated, or still invited). */
  profile: { fullName: string; role: AppRole } | null;
  /** Set only for an invited account that hasn't finished the setup form (/portal/join). */
  onboarding: OnboardingInfo | null;
  /** aal2 = password and authenticator code; aal1 = password (or email link) only. */
  aal: 'aal1' | 'aal2';
  hasVerifiedFactor: boolean;
};

/** What the setup form needs: the role (read on the server) decides which fields it shows. */
export type OnboardingInfo = {
  role: AppRole;
  fullName: string;
  email: string;
  /** Students: their roster year level, as a starting value (null: not set, or not at school). */
  yearLevel: number | null;
};

/** The setup form's answers. phone: staff only. yearLevel: students only ('other' = not at school). */
export type OnboardingInput = {
  fullName: string;
  password: string;
  phone: string | null;
  yearLevel: string | null;
  acceptsTerms: boolean;
  /** Parents only; everyone else sends all false. */
  consents: Consents;
};

/** A parent's optional permissions (invite-onboarding.md, "Consents"). true = agreed. */
export type Consents = Record<ConsentKind, boolean>;

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

/** A website enquiry, as admins see it (leads-and-crm.md §5). */
export type Enquiry = {
  id: string;
  receivedAt: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  wantsUpdates: boolean;
  crmStatus: CrmStatus;
  crmError: string | null;
};

/** What happened when an admin retried sending an enquiry to Zoho CRM. */
export type ResyncOutcome = { crmStatus: CrmStatus; crmError: string | null };

export type ActivityAction =
  | 'invite_sent'
  | 'invite_resent'
  | 'invite_cancelled'
  | 'role_changed'
  | 'deactivated'
  | 'reactivated'
  | 'two_step_reset'
  | 'profile_edited_by_admin'
  | 'student_invited'
  | 'parent_invited'
  | 'parent_linked'
  | 'parent_unlinked'
  | 'consent_recorded'
  | 'account_activated'
  | 'consent_changed';

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

/** A student with the classes they're in (admin roster), their account and parents (R3b FA4). */
export type RosterStudent = StudentSummary & {
  classes: { id: string; name: string }[];
  account: Pick<FamilyAccount, 'isActive' | 'invitedAt' | 'joinedAt'> | null;
  parentCount: number;
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

/**
 * Paper homework: not_submitted → submitted → marked → returned (staff set each step).
 * Online work (R3b): not_submitted → in_progress → submitted (the student) → returned (staff).
 */
export type ResultStatus = 'not_submitted' | 'in_progress' | 'submitted' | 'marked' | 'returned';

export type AssignmentSummary = {
  id: string;
  classId: string;
  className: string;
  title: string;
  instructions: string;
  dueOn: string | null; // "YYYY-MM-DD"
  maxMark: number | null; // null: feedback only
  /** Drafts are visible to staff only (R3b FT2). */
  isPublished: boolean;
  /** Online work has questions; paper homework has none (R3b D6). */
  questionCount: number;
  /** Sum of the question marks, or maxMark for paper homework; null: feedback only. */
  totalMarks: number | null;
  /** Ids of students currently in the class. */
  enrolledStudentIds: string[];
  /** Status per student who has a result row. */
  statuses: { studentId: string; status: ResultStatus }[];
};

export type AssignmentResult = {
  studentId: string;
  status: ResultStatus;
  mark: number | null;
  feedback: string; // the overall comment
  markedAt: string | null;
  markedByName: string;
  submittedAt: string | null;
  returnedAt: string | null;
};

export type AssignmentDetail = AssignmentSummary & {
  students: StudentSummary[];
  results: AssignmentResult[];
  questions: Question[];
};

/** One question of an online assignment (R3b FT1). Options are numbered from 0. */
export type Question = {
  id: string;
  assignmentId: string;
  position: number;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  correctOption: number | null;
  marks: number;
  explanation: string;
};

export type QuestionInput = Omit<Question, 'id' | 'position'> & { id?: string };

/** A student's answer to one question, with the marking. */
export type SubmissionAnswer = {
  questionId: string;
  selectedOption: number | null;
  response: string;
  awardedMarks: number | null;
  feedback: string;
};

/** One student's online work, as staff see it on the marking page (R3b FT3). */
export type Submission = {
  assignment: Pick<
    AssignmentSummary,
    'id' | 'title' | 'dueOn' | 'classId' | 'className' | 'totalMarks'
  > & { questions: Question[] };
  student: StudentSummary;
  result: AssignmentResult | null;
  answers: SubmissionAnswer[];
};

/** The marks and feedback a tutor gives one answer. */
export type AnswerMark = { questionId: string; awardedMarks: number | null; feedback: string };

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

// --- Family accounts (R3b) ---------------------------------------------------------

/** A student's or parent's sign-in account, as admins see it. */
export type FamilyAccount = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  invitedAt: string | null;
  joinedAt: string | null;
  lastSignInAt: string | null;
  /** Optional permissions; only parents are offered them, so a student's are all false. */
  consents: Consents;
};

/** Everything on an admin's student page (R3b stories FA1–FA3). */
export type StudentFamily = StudentSummary & {
  consentRecordedAt: string | null;
  consentSource: ConsentSource | null;
  account: FamilyAccount | null;
  parents: FamilyAccount[];
  classes: { id: string; name: string }[];
};

/** What happened when a parent was invited: a new account, or an existing one linked. */
export type ParentInviteOutcome = { userId: string; linked: boolean };

// --- Student and parent portals (R3b) -------------------------------------------------

/** One assignment in a student's list (their own, or their child's for a parent). */
export type FamilyAssignment = {
  id: string;
  title: string;
  className: string;
  subject: string;
  dueOn: string | null;
  publishedAt: string | null;
  questionCount: number; // 0: paper homework
  /** Questions answered so far; null for parents (draft work stays private, FP2). */
  answeredCount: number | null;
  totalMarks: number | null;
  status: FamilyStatus;
  submittedAt: string | null;
  returnedAt: string | null;
  isLate: boolean;
  /** Only once returned (F12). */
  mark: number | null;
  comment: string;
};

/** A question as a student (or parent) sees it. Marking fields are empty until returned. */
export type FamilyQuestion = {
  id: string;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  marks: number;
  selectedOption: number | null;
  response: string;
  correctOption: number | null;
  explanation: string;
  awardedMarks: number | null;
  feedback: string;
};

/** One assignment with its questions, for the solve and results pages. */
export type FamilyAssignmentView = Pick<
  FamilyAssignment,
  | 'id'
  | 'title'
  | 'className'
  | 'subject'
  | 'dueOn'
  | 'status'
  | 'submittedAt'
  | 'returnedAt'
  | 'isLate'
  | 'totalMarks'
  | 'mark'
  | 'comment'
> & { instructions: string; questions: FamilyQuestion[] };

export type ChildAccountStatus = 'none' | 'invited' | 'active' | 'deactivated';

/** A parent's linked child (FP1). */
export type Child = {
  id: string;
  fullName: string;
  yearLevel: number | null;
  consentRecordedAt: string | null;
  accountStatus: ChildAccountStatus;
  classNames: string[];
};
