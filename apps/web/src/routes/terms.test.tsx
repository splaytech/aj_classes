import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BUSINESS, PRIVACY, ROUTES, SEO, TERMS } from '@/constants';
import { renderAt } from '@/test/render';

import TermsPage, { ErrorBoundary, meta } from './terms';

vi.mock('@/lib/use-has-news', () => ({ useHasNews: () => false }));

describe('/terms (open sign-up AC-50)', () => {
  it('has one h1, the date, the intro and every section', () => {
    renderAt(<TermsPage />, ROUTES.terms);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(TERMS.heading);
    expect(screen.getByText(TERMS.lastUpdated)).toBeInTheDocument();
    expect(screen.getByText(TERMS.intro)).toBeInTheDocument();
    for (const section of TERMS.sections) {
      expect(screen.getByRole('heading', { level: 2, name: section.heading })).toBeInTheDocument();
    }
  });

  it('links to the Privacy Policy', () => {
    renderAt(<TermsPage />, ROUTES.terms);
    // The footer links Privacy too; this is the page's own link, in its "Your information" part.
    const section = screen.getByRole('heading', {
      level: 2,
      name: 'Your information',
    }).parentElement;
    if (!section) throw new Error('no Your information section');
    expect(within(section).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      ROUTES.privacy,
    );
  });

  it('has its own meta and ErrorBoundary', () => {
    const tags = meta() as { title?: string; content?: string }[];
    expect(tags.some((tag) => tag.title?.includes(SEO.terms.title))).toBe(true);
    expect(tags.some((tag) => tag.content === SEO.terms.description)).toBe(true);
    renderAt(<ErrorBoundary />, ROUTES.terms);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      TERMS.errorBoundary.heading,
    );
  });

  it('has each section once', () => {
    const headings = TERMS.sections.map((section) => section.heading);
    expect(new Set(headings).size).toBe(headings.length);
  });

  it('says only true things: no unbuilt features, and the contact e-mail is the business one', () => {
    const all = JSON.stringify(TERMS).toLowerCase();
    expect(all).not.toContain('mock test');
    expect(all).toContain(BUSINESS.email.toLowerCase());
  });

  it('agrees with the Privacy Policy that service e-mails are part of the service', () => {
    const emails = TERMS.sections.find((section) => section.heading === 'E-mails from us');
    const permissions = PRIVACY.sections.find(
      (section) => section.heading === 'Optional permissions',
    );
    expect(emails?.text).toContain('part of our service');
    expect(permissions?.text).toContain('part of our service');
  });
});
