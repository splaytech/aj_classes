import { describe, expect, it } from 'vitest';

import { PRIVACY } from '@/constants';

describe('Privacy Policy content', () => {
  it('has each section once (merges have duplicated sections before)', () => {
    const headings = PRIVACY.sections.map((section) => section.heading);
    expect(new Set(headings).size).toBe(headings.length);
  });

  it('says where enquiries are kept and who invoices', () => {
    const text = PRIVACY.sections.map((section) => section.text).join(' ');
    expect(text).toContain('Zoho CRM');
    expect(text).toContain('Zoho Invoice');
  });
});
