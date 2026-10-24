import { describe, expect, it } from 'vitest';

import { toErrorKey } from './auth-errors';

describe('toErrorKey', () => {
  it('gives a wrong password and a deactivated account the same message (no account hints)', () => {
    expect(toErrorKey({ code: 'invalid_credentials', status: 400 })).toBe('invalidCredentials');
    expect(toErrorKey({ code: 'user_banned', status: 400 })).toBe('invalidCredentials');
  });

  it('maps codes, not wording', () => {
    expect(toErrorKey({ code: 'weak_password' })).toBe('weakPassword');
    expect(toErrorKey({ code: 'mfa_verification_failed' })).toBe('wrongCode');
    expect(toErrorKey({ code: 'otp_expired' })).toBe('linkExpired');
    expect(toErrorKey({ code: 'insufficient_aal' })).toBe('needsTwoStep');
  });

  it('recognises a missing captcha, which Supabase reports as a generic 500', () => {
    expect(
      toErrorKey({
        code: 'unexpected_failure',
        status: 500,
        message: 'captcha verification process failed',
      }),
    ).toBe('captchaFailed');
  });

  it('treats 429 as too many attempts and fetch failures as network problems', () => {
    expect(toErrorKey({ status: 429 })).toBe('tooManyAttempts');
    expect(toErrorKey({ name: 'AuthRetryableFetchError' })).toBe('network');
    expect(toErrorKey(new TypeError('Failed to fetch'))).toBe('network');
  });

  it('does not blame the connection for a bug', () => {
    expect(toErrorKey(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(
      'unknown',
    );
  });

  it('maps database codes and the keys our own functions raise', () => {
    expect(toErrorKey({ code: '42501', message: 'permission denied for table classes' })).toBe(
      'notAllowed',
    );
    expect(toErrorKey({ code: '23514', message: 'new row violates check constraint' })).toBe(
      'invalidInput',
    );
    expect(toErrorKey({ code: 'P0001', message: 'last_admin' })).toBe('lastAdmin');
    expect(toErrorKey({ code: 'P0001', message: 'mark_too_high' })).toBe('markTooHigh');
    expect(toErrorKey({ code: '42501', message: 'not_admin' })).toBe('notAllowed');
    expect(toErrorKey({ code: 'already_exists' })).toBe('alreadyExists');
  });

  it('falls back to a generic message', () => {
    expect(toErrorKey(undefined)).toBe('unknown');
    expect(toErrorKey({ code: 'something_new' })).toBe('unknown');
  });
});
