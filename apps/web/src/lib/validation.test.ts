import { describe, expect, it } from 'vitest';

import { VALIDATION } from '@/constants';

import { isValidAustralianPhone, isValidEmail, validateContactForm } from './validation';
import type { ContactFormValues } from './validation';

const validForm: ContactFormValues = {
  name: 'Priya Sharma',
  email: 'priya@example.com',
  phone: '',
  contactMethod: 'email',
  role: 'parent',
  enquiryType: 'registerInterest',
  yearLevel: 'Year 6',
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
  it('returns no errors for a valid "register interest" form', () => {
    expect(validateContactForm(validForm)).toEqual({});
  });

  it('requires a phone number when the family asks for a call', () => {
    const errors = validateContactForm({ ...validForm, contactMethod: 'phone' });
    expect(errors.phone).toBe(VALIDATION.phoneRequiredForCall);
  });

  it('requires a message for general questions', () => {
    const errors = validateContactForm({ ...validForm, enquiryType: 'generalQuestion' });
    expect(errors.message).toBe(VALIDATION.messageRequired);
  });

  it('requires a contact method', () => {
    const errors = validateContactForm({ ...validForm, contactMethod: '' });
    expect(errors.contactMethod).toBe(VALIDATION.contactMethodRequired);
  });
});
