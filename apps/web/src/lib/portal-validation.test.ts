import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { AUTH_LIMITS, PORTAL_VALIDATION } from '@/constants';

import { checkCode, checkEmailCode } from './portal-validation';

describe('code lengths (security 06 finding 5)', () => {
  it('authenticator (TOTP) codes stay 6 digits', () => {
    expect(AUTH_LIMITS.codeLength).toBe(6);
    expect(checkCode('123456')).toBe('');
    expect(checkCode('12345678')).toBe(PORTAL_VALIDATION.codeInvalid);
  });

  it('e-mailed codes are 8 digits', () => {
    expect(AUTH_LIMITS.emailCodeLength).toBe(8);
    expect(checkEmailCode('12345678')).toBe('');
    expect(checkEmailCode('123456')).toBe(PORTAL_VALIDATION.emailCodeInvalid);
    expect(checkEmailCode('1234567a')).toBe(PORTAL_VALIDATION.emailCodeInvalid);
    expect(PORTAL_VALIDATION.emailCodeInvalid).toContain('8-digit');
  });

  it('matches [auth.email] otp_length in supabase/config.toml', () => {
    const config = readFileSync(
      path.join(import.meta.dirname, '../../../../supabase/config.toml'),
      'utf8',
    );
    const emailSection = config.slice(
      config.indexOf('[auth.email]'),
      config.indexOf('[auth.email.'),
    );
    expect(emailSection).toMatch(new RegExp(`^otp_length = ${AUTH_LIMITS.emailCodeLength}$`, 'm'));
  });
});
