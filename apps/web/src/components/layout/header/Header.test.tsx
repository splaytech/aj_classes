import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  A11Y,
  ANALYTICS_EVENTS,
  APP_CONFIG,
  CAREERS,
  CTA_LOCATIONS,
  FOOTER,
  NAV,
  PORTAL_ROUTES,
  ROUTES,
} from '@/constants';
import { trackEvent } from '@/lib/analytics';
import { homeForRole } from '@/lib/portal-access';
import { renderAt } from '@/test/render';
import { setupUser } from '@/test/user';

import { Header } from './Header';

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

beforeEach(() => {
  vi.mocked(trackEvent).mockClear();
});

/** The top-level items of the section links list (sub-links are nested, so not counted). */
function topLevelNavItems(): HTMLElement[] {
  const nav = screen.getByRole('navigation', { name: A11Y.mainNavigation });
  const list = within(nav).getAllByRole('list')[0];
  if (!list) throw new Error('The header has no links list');
  return Array.from(list.children) as HTMLElement[];
}

describe('header sign-in link', () => {
  it('has one Sign in link to the portal when the portal is on', () => {
    renderAt(<Header />);
    const links = screen.queryAllByRole('link', { name: NAV.signInLabel });
    if (APP_CONFIG.features.portal) {
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute('href', PORTAL_ROUTES.login);
      expect(links[0]).toHaveTextContent(NAV.signIn); // the visible text starts the spoken name
    } else {
      expect(links).toHaveLength(0);
    }
  });

  it('after sign-in, each role lands on its own home page', () => {
    expect(homeForRole('admin')).toBe(PORTAL_ROUTES.admin);
    expect(homeForRole('tutor')).toBe(PORTAL_ROUTES.tutor);
    expect(homeForRole('student')).toBe(PORTAL_ROUTES.student);
    expect(homeForRole('parent')).toBe(PORTAL_ROUTES.parent);
  });
});

describe('header FAQ and News (2026-10-30 tidy)', () => {
  it('shows neither, so the bar holds the five links only', () => {
    renderAt(<Header />);
    const nav = screen.getByRole('navigation', { name: A11Y.mainNavigation });
    expect(within(nav).queryByRole('link', { name: FOOTER.faqLink })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: FOOTER.newsLink })).not.toBeInTheDocument();
    // + 1: "We're hiring" always shows (DEC-HL-5).
    expect(topLevelNavItems()).toHaveLength(NAV.links.length + 1);
  });
});

describe("header We're hiring link (2026-10-30-header-hiring-link)", () => {
  function careersLink(): HTMLElement {
    return screen.getByRole('link', { name: NAV.careersLink.label });
  }

  // jsdom can't navigate, so stop the browser default; React's onClick still runs.
  function preventNavigation(link: HTMLElement): void {
    link.addEventListener('click', (event) => event.preventDefault());
  }

  it('is always the last nav item (AC-1, AC-3, AC-4)', () => {
    renderAt(<Header />);
    const items = topLevelNavItems();
    const last = within(items[items.length - 1] as HTMLElement).getByRole('link');
    expect(last).toHaveTextContent(NAV.careersLink.label);
    expect(last).toHaveAttribute('href', ROUTES.careers);
  });

  it('uses the shared careers label and path (AC-1, AC-2)', () => {
    expect(NAV.careersLink.label).toBe(CAREERS.linkLabel);
    expect(NAV.careersLink.href).toBe(ROUTES.careers);
    renderAt(<Header />);
    expect(careersLink().textContent).toBe(CAREERS.linkLabel);
  });

  it('comes before Sign in and Register Interest (AC-3, AC-8)', () => {
    renderAt(<Header />);
    const link = careersLink();
    const cta = screen.getByRole('link', { name: NAV.cta });
    expect(link.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    if (APP_CONFIG.features.portal) {
      const signIn = screen.getByRole('link', { name: NAV.signInLabel });
      expect(link.compareDocumentPosition(signIn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('is marked as the current page only on /careers (AC-9)', () => {
    for (const path of [ROUTES.careers, `${ROUTES.careers}/`]) {
      const { unmount } = renderAt(<Header />, path);
      expect(careersLink()).toHaveAttribute('aria-current', 'page');
      unmount();
    }

    for (const path of [ROUTES.home, ROUTES.posts]) {
      const { unmount } = renderAt(<Header />, path);
      expect(careersLink()).not.toHaveAttribute('aria-current');
      unmount();
    }
  });

  it('closes the phone menu when tapped (AC-6)', async () => {
    const user = setupUser();
    renderAt(<Header />);
    await user.click(screen.getByRole('button', { name: A11Y.openMenu }));
    expect(screen.getByRole('button', { name: A11Y.closeMenu })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    const link = careersLink();
    preventNavigation(link);
    await user.click(link);
    expect(screen.getByRole('button', { name: A11Y.openMenu })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('does not send cta_click; Register Interest still does (AC-11)', async () => {
    const user = setupUser();
    renderAt(<Header />);
    const link = careersLink();
    preventNavigation(link);
    await user.click(link);
    expect(trackEvent).not.toHaveBeenCalled();

    const cta = screen.getByRole('link', { name: NAV.cta });
    preventNavigation(cta);
    await user.click(cta);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.ctaClick, {
      location: CTA_LOCATIONS.header,
    });
  });

  it('has no class of its own (AC-7)', () => {
    renderAt(<Header />);
    const link = careersLink();
    expect(link).not.toHaveAttribute('class');
    expect(link.parentElement).not.toHaveAttribute('class');
  });
});
