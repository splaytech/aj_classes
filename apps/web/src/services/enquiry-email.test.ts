import { describe, expect, it } from 'vitest';

import { CONTACT_FORM } from '@/constants';
import type { ContactFormValues } from '@/lib/validation';

import { buildEmailFields, buildEmailSubject } from './enquiry-email';

const values: ContactFormValues = {
  name: '  Priya Sharma ',
  email: 'priya@example.com',
  phone: '0412 345 678',
  contactMethod: 'phone',
  role: 'parent',
  enquiryType: 'registerInterest',
  yearLevel: 'Year 6',
  message: '',
  updatesConsent: true,
};

describe('buildEmailSubject', () => {
  it('includes the enquiry type and the trimmed name', () => {
    expect(buildEmailSubject(values)).toBe(
      '[AJ Classes] Register interest for enrolment — Priya Sharma',
    );
  });
});

describe('buildEmailFields', () => {
  it('uses readable labels and values', () => {
    const fields = buildEmailFields(values);
    expect(fields[CONTACT_FORM.labels.contactMethod]).toBe('Phone call');
    expect(fields[CONTACT_FORM.labels.updatesConsent]).toBe(CONTACT_FORM.yes);
  });
});
