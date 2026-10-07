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
export { getMyProfile, removeMyPhoto, updateMyProfile, uploadMyPhoto } from './profile.service';
export {
  canAddAuthenticator,
  listAuthenticators,
  removeAuthenticator,
  startTwoStepSetup,
  verifyTwoStepCode,
} from './two-step.service';
export type {
  AccessState,
  Authenticator,
  EmailLinkType,
  ErrorKey,
  ProfileChanges,
  Result,
  StaffProfile,
  SubmitResult,
  TwoStepEnrolment,
} from './types';
