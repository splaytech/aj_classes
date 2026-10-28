import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BUSINESS, CAREERS, ROUTES } from '@/constants';
import { absoluteUrl, environmentTitle } from '@/lib/seo';
import { renderAt } from '@/test/render';

import routerConfig from '../../react-router.config';
import CareersPage, { ErrorBoundary, meta } from './careers';

vi.mock('@/lib/use-has-news', () => ({ useHasNews: () => false }));

// The footer also has h2s and a mailto link, so page checks look inside <main> only.
function renderPage() {
  renderAt(<CareersPage />, ROUTES.careers);
  return within(screen.getByRole('main'));
}

describe('/careers page (we-are-hiring)', () => {
  it('has a single h1 (AC-8)', () => {
    const main = renderPage();
    const headings = main.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(CAREERS.heading);
  });

  it('shows the blocks in order with no skipped heading level (AC-9, AC-15)', () => {
    const main = renderPage();
    const h2Texts = main.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(h2Texts).toEqual([
      CAREERS.rolesHeading,
      CAREERS.lookingFor.heading,
      CAREERS.needs.heading,
      CAREERS.apply.heading,
    ]);
    for (const level of [3, 4, 5, 6]) {
      expect(main.queryAllByRole('heading', { level })).toHaveLength(0);
    }
  });

  it('applies by email to the public inbox with the subject filled in (AC-10, AC-11)', () => {
    const main = renderPage();
    const applyLink = main.getByRole('link', { name: CAREERS.apply.linkText });
    // Literal on purpose: this is the exact link the owner's inbox filter relies on.
    expect(applyLink).toHaveAttribute(
      'href',
      'mailto:hello@ajclasses.com.au?subject=Tutor%20application',
    );
    expect(applyLink).not.toHaveAttribute('target');
  });

  it('shows the address as text and says what to send and how details are used (AC-11, AC-13)', () => {
    const main = renderPage();
    expect(screen.getByRole('main')).toHaveTextContent(BUSINESS.email);
    expect(main.getByText(CAREERS.apply.text)).toBeInTheDocument();
    expect(CAREERS.apply.text).toContain('attach your CV');
    expect(CAREERS.apply.text).toContain('only use your details');
  });

  it('lists the Working with Children Check or VIT registration (AC-9)', () => {
    const needs = CAREERS.needs.points.join(' ');
    expect(needs).toContain('Working with Children Check');
    expect(needs).toContain('VIT');
    const main = renderPage();
    for (const point of CAREERS.needs.points) {
      expect(main.getByText(point)).toBeInTheDocument();
    }
  });

  it('has one link back to the home page (AC-16)', () => {
    const main = renderPage();
    const backLinks = main.getAllByRole('link', { name: CAREERS.backHome });
    expect(backLinks).toHaveLength(1);
    expect(backLinks[0]).toHaveAttribute('href', ROUTES.home);
  });

  it('promises no pay, hours, dates or results and names no region (AC-12, AC-18)', () => {
    expect(JSON.stringify(CAREERS)).not.toMatch(
      /\$|\bABN\b|per hour|hourly|start date|guarantee|Melbourne's west/i,
    );
  });
});

describe('/careers meta (AC-17 to AC-19, AC-22)', () => {
  const tags = meta();

  it('has the careers title and a short description naming the suburbs', () => {
    // environmentTitle adds the [DEV]/[STAGING] prefix outside production, as on every page.
    expect(tags).toContainEqual({ title: environmentTitle(CAREERS.seo.title) });
    expect(tags).toContainEqual({ name: 'description', content: CAREERS.seo.description });
    expect(CAREERS.seo.description.length).toBeLessThan(160);
    expect(CAREERS.seo.description).toContain(BUSINESS.suburbsText);
  });

  it('has an absolute canonical URL and no structured data', () => {
    const canonical = tags.find((tag) => 'rel' in tag && tag.rel === 'canonical');
    expect(canonical).toHaveProperty('href', absoluteUrl(ROUTES.careers));
    expect(tags.some((tag) => 'script:ld+json' in tag)).toBe(false);
  });
});

describe('/careers error boundary', () => {
  it('keeps the site frame and offers a way home', () => {
    renderAt(<ErrorBoundary />, ROUTES.careers);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      CAREERS.errorBoundary.heading,
    );
    expect(screen.getByRole('link', { name: CAREERS.errorBoundary.backHome })).toHaveAttribute(
      'href',
      ROUTES.home,
    );
    expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // the footer
  });
});

describe('/careers pre-rendering (AC-7)', () => {
  it('is in the prerender list', () => {
    expect(routerConfig.prerender).toContain(ROUTES.careers);
  });
});
