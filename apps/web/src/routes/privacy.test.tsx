import { describe, expect, it } from 'vitest';

import { PRIVACY } from '@/constants';

const PORTAL_HEADING = 'Portal accounts';

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

  it('names all three portal emails and where to turn each off (ADR-0004, ADR-0008)', () => {
    const section = PRIVACY.sections.find((item) => item.heading === PORTAL_HEADING);
    expect(section?.text).toContain(
      "We email you and your child (if they have their own account) when new work is set, the day before online work is due if it hasn't been handed in yet, and when work is marked and returned.",
    );
    expect(section?.text).toContain(
      'These are service emails; you can turn each one off in Account → Notifications.',
    );
    expect(section?.text).not.toContain("When your child's work is marked and returned");
  });

  it('names Resend as the overseas service that sends portal emails (APP 1.4)', () => {
    const section = PRIVACY.sections.find((item) => item.heading === PORTAL_HEADING);
    expect(section?.text).toContain(
      'Resend (United States) sends our sign-in and portal emails; all of these may process data outside Australia.',
    );
  });

  it('says staff phone numbers are kept, why, and who can see them (item 4, AC-4.9)', () => {
    const section = PRIVACY.sections.find((item) => item.heading === PORTAL_HEADING);
    expect(section?.text).toContain('For tutors and other staff we also keep a phone number');
    expect(section?.text).toContain('given at account setup or added later on My profile');
    expect(section?.text).toContain('kept up to date by them or an admin');
    expect(section?.text).toContain('We use it to contact them about classes');
    expect(section?.text).toContain(
      'only they and AJ Classes admins can see it, and it is never published',
    );
  });

  it('no longer calls the portal section student and parent only', () => {
    const headings = PRIVACY.sections.map((section) => section.heading);
    expect(headings).not.toContain('Student and parent portal accounts');
  });
});
