// Turns Supabase errors into the short list of problems the portal knows how to explain.
// Matches on error codes and on the keys we raise ourselves, never on Supabase's wording
// (R2a design §11.4, G28) — except one captcha case noted below.

import type { ErrorKey } from './types';

type SupabaseLikeError = {
  code?: string;
  status?: number;
  message?: string;
  name?: string;
};

const ERROR_KEYS_BY_CODE: Record<string, ErrorKey> = {
  // Sign-in. A banned (deactivated) user gets the same message as a wrong password, because
  // Supabase reports the ban before it checks the password (R2a review V18).
  invalid_credentials: 'invalidCredentials',
  user_banned: 'invalidCredentials',

  // Limits
  over_request_rate_limit: 'tooManyAttempts',
  over_email_send_rate_limit: 'tooManyAttempts',

  // Captcha
  captcha_failed: 'captchaFailed',

  // Passwords
  weak_password: 'weakPassword',
  same_password: 'samePassword',

  // Email links
  otp_expired: 'linkExpired',
  flow_state_expired: 'linkExpired',
  flow_state_not_found: 'linkExpired',

  // Codes
  mfa_verification_failed: 'wrongCode',
  mfa_challenge_expired: 'wrongCode',
  reauthentication_not_valid: 'wrongEmailCode',
  reauthentication_needed: 'reauthNeeded',
  insufficient_aal: 'needsTwoStep',
  mfa_factor_name_conflict: 'authenticatorNameTaken',
};

// Postgres and PostgREST error codes.
const ERROR_KEYS_BY_DATABASE_CODE: Record<string, ErrorKey> = {
  '42501': 'notAllowed', // permission denied / row-level security
  '23514': 'invalidInput', // check constraint
  '23505': 'duplicate', // unique / primary key
  PGRST116: 'notFound', // .single() found no row
};

// Keys we raise ourselves: database functions ("raise exception 'last_admin'") and the
// account-admin edge function ({ ok: false, code: 'already_exists' }).
const ERROR_KEYS_BY_OWN_KEY: Record<string, ErrorKey> = {
  not_admin: 'notAllowed',
  not_allowed: 'notAllowed',
  not_found: 'notFound',
  last_admin: 'lastAdmin',
  cannot_deactivate_self: 'cannotDeactivateSelf',
  cannot_reset_self: 'cannotResetSelf',
  not_joined: 'notJoined',
  already_joined: 'alreadyJoined',
  already_exists: 'alreadyExists',
  invalid_email: 'invalidEmail',
  invalid_name: 'invalidName',
  invalid_request: 'invalidInput',
  email_failed: 'emailFailed',
  ban_failed: 'banFailed',
  cancel_failed: 'serverProblem',
  reset_failed: 'serverProblem',
  server_error: 'serverProblem',
  not_enrolled: 'notEnrolled',
  mark_too_high: 'markTooHigh',
  no_marks: 'noMarks',
  // Family accounts (R3b)
  not_staff: 'notStaff',
  consent_needed: 'consentNeeded',
  already_has_account: 'alreadyHasAccount',
  already_linked: 'alreadyLinked',
  not_a_student_account: 'serverProblem',
  not_a_parent_account: 'serverProblem',
  not_student: 'notStudent',
  not_parent: 'notParent',
  // Online assignments (R3b)
  not_published: 'notPublished',
  has_submissions: 'hasSubmissions',
  assignment_published: 'assignmentPublished',
  too_many_questions: 'tooManyQuestions',
  invalid_status: 'invalidStatus',
  unmarked_answers: 'unmarkedAnswers',
  not_submitted: 'notSubmitted',
  already_submitted: 'alreadySubmitted',
  invalid_option: 'invalidInput',
  invalid_question: 'notFound',
  answer_too_long: 'answerTooLong',
  not_online: 'notOnline',
  invalid_input: 'invalidInput',
};

/** The portal error to show for anything a Supabase call returned or threw. */
export function toErrorKey(error: unknown): ErrorKey {
  const details = (error ?? {}) as SupabaseLikeError;

  const ownKey =
    ERROR_KEYS_BY_OWN_KEY[details.message ?? ''] ?? ERROR_KEYS_BY_OWN_KEY[details.code ?? ''];
  if (ownKey) return ownKey;

  if (details.code && ERROR_KEYS_BY_CODE[details.code]) {
    return ERROR_KEYS_BY_CODE[details.code] as ErrorKey;
  }
  if (details.code && ERROR_KEYS_BY_DATABASE_CODE[details.code]) {
    return ERROR_KEYS_BY_DATABASE_CODE[details.code] as ErrorKey;
  }

  // A missing captcha token comes back as a generic 500, so this one check uses the wording
  // (R2a design §19, SP7).
  if (details.message?.toLowerCase().includes('captcha')) {
    return 'captchaFailed';
  }
  if (details.status === 429) {
    return 'tooManyAttempts';
  }
  if (details.name === 'AuthRetryableFetchError' || details.name === 'TypeError') {
    return 'network';
  }
  return 'unknown';
}
