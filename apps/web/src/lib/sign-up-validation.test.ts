import { describe, expect, it } from 'vitest';

import { PORTAL_VALIDATION, PROFILE_VALIDATION } from '@/constants';

import { checkFullName, validateFinishSignUp, validateSignUp } from './sign-up-validation';

describe('checkFullName (AC-4)', () => {
  it('takes 2 to 100 characters after trimming', () => {
    expect(checkFullName('  Al  ')).toBe('');
    expect(checkFullName('A')).toBe(PROFILE_VALIDATION.nameLength);
    expect(checkFullName('   ')).toBe(PROFILE_VALIDATION.nameLength);
    expect(checkFullName('a'.repeat(100))).toBe('');
    expect(checkFullName('a'.repeat(101))).toBe(PROFILE_VALIDATION.nameLength);
  });

  it('refuses control characters and text-direction overrides, as the database does', () => {
    for (const bad of ['Line\nBreak', 'Tab\tName', 'Evil‮Name', 'Iso⁦late', 'Del\u007fete']) {
      expect(checkFullName(bad)).toBe(PORTAL_VALIDATION.nameCharacters);
    }
    expect(checkFullName('Zoë O’Brien-Smith')).toBe('');
  });
});

describe('validateSignUp (AC-4, AC-5)', () => {
  it('checks the name and the e-mail', () => {
    expect(validateSignUp('Priya Shah', 'priya@example.com')).toEqual({});
    expect(validateSignUp('P', 'not-an-email')).toEqual({
      fullName: PROFILE_VALIDATION.nameLength,
      email: PORTAL_VALIDATION.emailInvalid,
    });
  });
});

describe('validateFinishSignUp (AC-6, AC-7)', () => {
  const good = {
    fullName: 'Priya Shah',
    password: 'a long password!',
    confirmation: 'a long password!',
    acceptsTerms: true,
  };

  it('passes a complete e-mail finish step', () => {
    expect(validateFinishSignUp(good, true)).toEqual({});
  });

  it('asks for a long, matching password from an e-mail account', () => {
    expect(
      validateFinishSignUp({ ...good, password: 'short', confirmation: 'short' }, true).password,
    ).toBe(PORTAL_VALIDATION.passwordTooShort);
    expect(validateFinishSignUp({ ...good, confirmation: 'something else' }, true).confirm).toBe(
      PORTAL_VALIDATION.passwordsDiffer,
    );
  });

  it('asks a Google account for no password', () => {
    expect(validateFinishSignUp({ ...good, password: '', confirmation: '' }, false)).toEqual({});
  });

  it('needs the tick', () => {
    expect(validateFinishSignUp({ ...good, acceptsTerms: false }, true).terms).toBe(
      PORTAL_VALIDATION.termsRequired,
    );
  });
});
