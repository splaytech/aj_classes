import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_CONFIG, FOOTER, FOOTER_PORTAL, NAV, RESOURCES, ROUTES } from '@/constants';
import { useHasNews } from '@/lib/use-has-news';
import { renderAt } from '@/test/render';

import { Footer } from './Footer';

vi.mock('@/lib/use-has-news', () => ({ useHasNews: vi.fn(() => false) }));

beforeEach(() => {
  vi.mocked(useHasNews).mockReturnValue(false);
});

describe('footer News link (ADR-0001)', () => {
  it('links to /posts when there is news (AC-1.9)', () => {
    vi.mocked(useHasNews).mockReturnValue(true);
    renderAt(<Footer />);
    expect(screen.getByRole('link', { name: FOOTER.newsLink })).toHaveAttribute(
      'href',
      ROUTES.posts,
    );
  });

  it('is not shown when there is no news, or the check failed (AC-1.6, AC-1.9)', () => {
    renderAt(<Footer />);
    expect(screen.queryByRole('link', { name: FOOTER.newsLink })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: FOOTER.privacyLink })).toBeInTheDocument();
  });
});

describe('footer legal row (we-are-hiring)', () => {
  // The Resources link always shows, so its parent is the legal row whatever the flags are.
  function legalRowLinkTexts(): string[] {
    const row = screen.getByRole('link', { name: RESOURCES.footerLink }).parentElement;
    if (!row) throw new Error('legal row not found');
    return within(row)
      .getAllByRole('link')
      .map((link) => link.textContent ?? '');
  }

  function expectedOrder(hasNews: boolean): string[] {
    return [
      ...(hasNews ? [FOOTER.newsLink] : []),
      RESOURCES.footerLink,
      NAV.careersLink.label,
      FOOTER.privacyLink,
      ...(APP_CONFIG.features.portal ? [FOOTER_PORTAL.signIn] : []),
    ];
  }

  it('links to /careers in the same tab (AC-1, AC-2)', () => {
    renderAt(<Footer />);
    const link = screen.getByRole('link', { name: NAV.careersLink.label });
    expect(link).toHaveAttribute('href', ROUTES.careers);
    expect(NAV.careersLink.href).toBe(ROUTES.careers);
    expect(link).not.toHaveAttribute('target');
  });

  it.each([false, true])(
    'sits between Resources and Privacy Policy (news %s) (AC-3)',
    (hasNews) => {
      vi.mocked(useHasNews).mockReturnValue(hasNews);
      renderAt(<Footer />);
      expect(legalRowLinkTexts()).toEqual(expectedOrder(hasNews));
    },
  );
});
