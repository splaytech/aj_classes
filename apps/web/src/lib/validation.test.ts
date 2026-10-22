import { describe, expect, it } from 'vitest';

import { VALIDATION } from '@/constants';

import { isValidAustralianPhone, isValidEmail, validateContactForm } from './validation';
import type { ContactFormValues } from './validation';

const validForm: ContactFormValues = {
  name: 'Priya Sharma',
  email: 'priya@example.com',
  phone: '',
  message: '',
  updatesConsent: false,
};

describe('isValidEmail', () => {
  it('accepts a normal email address', () => {
    expect(isValidEmail('parent@example.com')).toBe(true);
  });

  it('rejects text without an @', () => {
    expect(isValidEmail('parent.example.com')).toBe(false);
  });
});

describe('isValidAustralianPhone', () => {
  it('accepts mobile and landline formats, with or without spaces', () => {
    expect(isValidAustralianPhone('0412 345 678')).toBe(true);
    expect(isValidAustralianPhone('+61412345678')).toBe(true);
    expect(isValidAustralianPhone('(03) 9123 4567')).toBe(true);
  });

  it('rejects numbers that are too short', () => {
    expect(isValidAustralianPhone('0412 345')).toBe(false);
  });
});

describe('validateContactForm', () => {
  it('needs only a name and an email', () => {
    expect(validateContactForm(validForm)).toEqual({});
  });

  it('requires a name and an email', () => {
    const errors = validateContactForm({ ...validForm, name: ' ', email: '' });
    expect(errors.name).toBe(VALIDATION.nameRequired);
    expect(errors.email).toBe(VALIDATION.emailRequired);
  });

  it('accepts a missing phone number, but checks one that is given', () => {
    expect(validateContactForm({ ...validForm, phone: '' }).phone).toBeUndefined();
    expect(validateContactForm({ ...validForm, phone: '12345' }).phone).toBe(
      VALIDATION.phoneInvalid,
    );
  });

  it('accepts an empty message, but not one over the limit', () => {
    expect(validateContactForm({ ...validForm, message: '' }).message).toBeUndefined();
    expect(validateContactForm({ ...validForm, message: 'x'.repeat(2001) }).message).toBe(
      VALIDATION.messageTooLong,
    );
  });
});
