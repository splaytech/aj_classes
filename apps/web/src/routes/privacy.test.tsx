import { describe, expect, it } from 'vitest';

import { PRIVACY } from '@/constants';

describe('Privacy Policy content', () => {
  it('explains the optional permissions and how to withdraw them', () => {
    const section = PRIVACY.sections.find((item) => item.heading === 'Optional permissions');
    expect(section?.text).toContain('Account → Your choices');
    expect(section?.text).toContain('None of these is needed');
  });

  it('has each section once (merges have duplicated sections before)', () => {
    const headings = PRIVACY.sections.map((section) => section.heading);
    expect(new Set(headings).size).toBe(headings.length);
  });

  it('says where enquiries are kept and who invoices', () => {
    const text = PRIVACY.sections.map((section) => section.text).join(' ');
    expect(text).toContain('Zoho CRM');
    expect(text).toContain('Zoho Invoice');
  });

  it('says every page asks the database whether there is news (ADR-0001)', () => {
    const section = PRIVACY.sections.find((item) => item.heading === 'Who handles it');
    expect(section?.text).toContain(
      'When you visit a page, your browser asks our database whether there is any news to show.',
    );
    expect(section?.text).toContain("We don't store it or use it to identify you.");
  });
});
