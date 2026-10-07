// The service layer: the ONLY part of the app that talks to a backend.
//
// Components and sections import from '@/services' and call plain functions
// such as `submitEnquiry()`. Only files inside this folder may import backend
// clients (Web3Forms today; Supabase for the staff portal from Release 2). ESLint enforces this.
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
export { listActivity } from './activity.service';
export {
  deleteAssignment,
  getAssignment,
  listAssignments,
  saveAssignment,
  saveResult,
} from './assignments.service';
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
  setStaffActive,
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
  AssignmentDetail,
  AssignmentInput,
  AssignmentResult,
  AssignmentSummary,
  ResultInput,
  ResultStatus,
  ActivityAction,
  ActivityEntry,
  Authenticator,
  ClassDetail,
  ClassInput,
  ClassSession,
  ClassSummary,
  DayOfWeek,
  Delivery,
  RosterStudent,
  SessionInput,
  StudentInput,
  StudentSummary,
  TimetableEntry,
  EmailLinkType,
  ErrorKey,
  ProfileChanges,
  Result,
  StaffMember,
  StaffProfile,
  SubmitResult,
  TwoStepEnrolment,
} from './types';
