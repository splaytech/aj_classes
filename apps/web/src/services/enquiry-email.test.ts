import { describe, expect, it } from 'vitest';

import { CONTACT_FORM } from '@/constants';
import type { ContactFormValues } from '@/lib/validation';

import { buildEmailFields, buildEmailSubject } from './enquiry-email';

const values: ContactFormValues = {
  name: '  Priya Sharma ',
  email: 'priya@example.com',
  phone: '0412 345 678',
  message: '',
  updatesConsent: true,
};

describe('buildEmailSubject', () => {
  it('says it is a website enquiry and includes the trimmed name', () => {
    expect(buildEmailSubject(values)).toBe('[AJ Classes] Website enquiry — Priya Sharma');
  });
});

describe('buildEmailFields', () => {
  it('uses readable labels and values', () => {
    const fields = buildEmailFields(values);
    expect(fields[CONTACT_FORM.labels.phone]).toBe('0412 345 678');
    expect(fields[CONTACT_FORM.labels.updatesConsent]).toBe(CONTACT_FORM.yes);
  });
});
