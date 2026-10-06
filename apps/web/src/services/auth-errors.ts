// Turns Supabase errors into the short list of problems the portal knows how to explain.
// Matches on Supabase's error `code`, not its wording (design §11.4, G28).

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

/** The portal error to show for anything a Supabase call returned or threw. */
export function toErrorKey(error: unknown): ErrorKey {
  const details = (error ?? {}) as SupabaseLikeError;

  if (details.code && ERROR_KEYS_BY_CODE[details.code]) {
    return ERROR_KEYS_BY_CODE[details.code] as ErrorKey;
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
