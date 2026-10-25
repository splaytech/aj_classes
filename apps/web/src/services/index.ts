// The service layer: the ONLY part of the app that talks to a backend.
//
// Components and sections import from '@/services' and call plain functions
// such as `submitEnquiry()`. Only files inside this folder may import backend
// clients (Web3Forms and Kit today; Supabase for the portal from Release 2). ESLint enforces this.
//
// Supabase is created in `supabase.client.ts` and loaded only when a portal function runs,
// so the public pages never download it.

export { submitEnquiry } from './enquiry.service';
export { subscribe } from './subscription.service';
export {
  changePassword,
  confirmEmailLink,
  getAccessState,
  requestPasswordReset,
  sendReauthCode,
  setNewPassword,
  signIn,
  signOut,
  watchForSignOut,
} from './auth.service';
export { completeOnboarding } from './onboarding.service';
export { getMyConsents, setMyConsents } from './consents.service';
export {
  getMyNotificationSettings,
  listEmailProblems,
  saveMyNotificationSettings,
} from './notifications.service';
export { listActivity } from './activity.service';
export { deleteEnquiry, listEnquiries, resyncEnquiry } from './enquiries.service';
export { createPost, deletePost, listPosts, updatePost } from './posts.service';
export { hasPublishedPosts, listPublicPosts } from './public-posts.client';
export { isPublicSupabaseConfigured } from './public-supabase-config';
export {
  deleteAssignment,
  getAssignment,
  listAssignments,
  saveAssignment,
  saveResult,
  setAssignmentPublished,
} from './assignments.service';
export { deleteQuestion, moveQuestion, saveQuestion } from './questions.service';
export { getSubmission, saveSubmission } from './submissions.service';
export {
  getMyAssignment,
  getMyTimetable,
  listMyAssignments,
  saveMyAnswer,
  submitMyAssignment,
} from './student.service';
export type { AnswerChange } from './student.service';
export {
  getChildAssignment,
  getChildTimetable,
  giveConsent,
  listChildAssignments,
  listMyChildren,
} from './parent.service';
export {
  addSession,
  enrolStudent,
  getClass,
  listClasses,
  listTimetable,
  removeEnrolment,
  removeSession,
  saveClass,
  setClassActive,
} from './classes.service';
export { listStudents, saveStudent, setStudentActive } from './students.service';
export {
  getStudentFamily,
  inviteParent,
  inviteStudentAccount,
  recordConsent,
  unlinkParent,
} from './families.service';
export {
  getMyProfile,
  getProfile,
  removeMyPhoto,
  removePhoto,
  updateMyProfile,
  updateProfile,
  uploadMyPhoto,
  uploadPhoto,
} from './profile.service';
export {
  cancelInvite,
  getStaffMember,
  inviteStaff,
  listStaff,
  resendInvite,
  resetStaffTwoStep,
  setAccountActive,
  setStaffRole,
} from './staff.service';
export {
  canAddAuthenticator,
  listAuthenticators,
  removeAuthenticator,
  startTwoStepSetup,
  verifyTwoStepCode,
} from './two-step.service';
export type {
  AccessState,
  AnswerMark,
  AssignmentDetail,
  AssignmentInput,
  AssignmentResult,
  AssignmentSummary,
  Child,
  ChildAccountStatus,
  ResultInput,
  ResultStatus,
  ActivityAction,
  ActivityEntry,
  Enquiry,
  ResyncOutcome,
  Authenticator,
  ClassDetail,
  ClassInput,
  ClassSession,
  ClassSummary,
  Consents,
  DayOfWeek,
  Delivery,
  EmailProblem,
  EmailProblemReason,
  EmailProblemState,
  RosterStudent,
  SessionInput,
  StudentInput,
  StudentSummary,
  TimetableEntry,
  EmailLinkType,
  ErrorKey,
  FamilyAccount,
  FamilyAssignment,
  FamilyAssignmentView,
  FamilyQuestion,
  NotificationSettings,
  OnboardingInfo,
  OnboardingInput,
  ParentInviteOutcome,
  Post,
  PostInput,
  PublicPost,
  ProfileChanges,
  Question,
  QuestionInput,
  Result,
  StaffMember,
  StaffProfile,
  StudentFamily,
  Submission,
  SubmissionAnswer,
  SubmitResult,
  TwoStepEnrolment,
} from './types';
