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
      'When you visit a page, your browser asks our database provider (Supabase, Sydney) whether there is any news to show.',
    );
    // Supabase does keep request logs for a while, so the policy must not say nothing is stored
    expect(section?.text).toContain('Supabase keeps these in short-lived technical logs');
    expect(section?.text).toContain(
      "We don't save them in our own records or use them to identify you.",
    );
    expect(section?.text).not.toContain("We don't store it");
  });
});
