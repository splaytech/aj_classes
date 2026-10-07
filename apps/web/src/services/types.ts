// Result types shared by all services. Components only ever see these, never backend details.

import type { AUTH_ERRORS, StaffRole } from '@/constants';

/** Outcome of sending something to the backend. */
export type SubmitResult = 'success' | 'error' | 'not-configured';

// --- Staff portal (R2a) -------------------------------------------------------

/** A problem the portal can show to the user. The text for each key is in AUTH_ERRORS. */
export type ErrorKey = keyof typeof AUTH_ERRORS;

/** Outcome of a portal action: either it worked (with optional data) or an error to show. */
export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: ErrorKey };

/** Who is using the portal right now. Built fresh by `getAccessState()` on every private page. */
export type AccessState = {
  signedIn: boolean;
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
