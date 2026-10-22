import { describe, expect, it } from 'vitest';

import {
  asksForPhone,
  asksForYearLevel,
  initialYearLevel,
  isYearLevelChoice,
  toOnboardingInput,
  validateOnboarding,
} from './onboarding-validation';
import type { OnboardingValues } from './onboarding-validation';

const valid: OnboardingValues = {
  fullName: '  Priya Shah ',
  phone: '0412 345 678',
  yearLevel: '9',
  password: 'a long enough password',
  confirmation: 'a long enough password',
  acceptsTerms: true,
};

describe('which fields each role gets', () => {
  it('asks staff for a phone, students for a year level, parents for neither', () => {
    expect([asksForPhone('tutor'), asksForYearLevel('tutor')]).toEqual([true, false]);
    expect([asksForPhone('admin'), asksForYearLevel('admin')]).toEqual([true, false]);
    expect([asksForPhone('student'), asksForYearLevel('student')]).toEqual([false, true]);
    expect([asksForPhone('parent'), asksForYearLevel('parent')]).toEqual([false, false]);
  });
});

describe('validateOnboarding', () => {
  it('accepts a complete form for every role', () => {
    expect(validateOnboarding(valid, 'tutor')).toEqual({});
    expect(validateOnboarding(valid, 'student')).toEqual({});
    expect(validateOnboarding(valid, 'parent')).toEqual({});
  });

  it('needs a 2–100 character name', () => {
    expect(validateOnboarding({ ...valid, fullName: ' A ' }, 'parent').fullName).toBeTruthy();
    expect(
      validateOnboarding({ ...valid, fullName: 'x'.repeat(101) }, 'parent').fullName,
    ).toBeTruthy();
  });

  it('needs an Australian phone number from staff only', () => {
    expect(validateOnboarding({ ...valid, phone: '' }, 'tutor').phone).toBeTruthy();
    expect(validateOnboarding({ ...valid, phone: '12345' }, 'tutor').phone).toBeTruthy();
    expect(
      validateOnboarding({ ...valid, phone: '(03) 9123 4567' }, 'tutor').phone,
    ).toBeUndefined();
    expect(validateOnboarding({ ...valid, phone: '' }, 'student').phone).toBeUndefined();
  });

  it('needs a year level from students only', () => {
    expect(validateOnboarding({ ...valid, yearLevel: '' }, 'student').yearLevel).toBeTruthy();
    expect(validateOnboarding({ ...valid, yearLevel: '13' }, 'student').yearLevel).toBeTruthy();
    expect(
      validateOnboarding({ ...valid, yearLevel: 'other' }, 'student').yearLevel,
    ).toBeUndefined();
    expect(validateOnboarding({ ...valid, yearLevel: '' }, 'tutor').yearLevel).toBeUndefined();
  });

  it('checks the password length and that both passwords match', () => {
    const short = validateOnboarding(
      { ...valid, password: 'short', confirmation: 'short' },
      'parent',
    );
    expect(short.password).toBeTruthy();
    expect(
      validateOnboarding({ ...valid, confirmation: 'different' }, 'parent').confirm,
    ).toBeTruthy();
  });

  it('needs the terms box ticked', () => {
    expect(validateOnboarding({ ...valid, acceptsTerms: false }, 'parent').terms).toBeTruthy();
  });
});

describe('toOnboardingInput', () => {
  it('sends only the fields the role has', () => {
    expect(toOnboardingInput(valid, 'tutor')).toEqual({
      fullName: 'Priya Shah',
      password: valid.password,
      phone: '0412 345 678',
      yearLevel: null,
      acceptsTerms: true,
    });
    expect(toOnboardingInput(valid, 'student')).toMatchObject({ phone: null, yearLevel: '9' });
    expect(toOnboardingInput(valid, 'parent')).toMatchObject({ phone: null, yearLevel: null });
  });
});

describe('year level choices', () => {
  it('allows Years 2–12 and other', () => {
    expect(['2', '12', 'other'].every(isYearLevelChoice)).toBe(true);
    expect(['', '1', '13', 'Year 9'].some(isYearLevelChoice)).toBe(false);
  });

  it('starts from the roster year level when there is one', () => {
    expect(initialYearLevel(7)).toBe('7');
    expect(initialYearLevel(null)).toBe('');
  });
});
