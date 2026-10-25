import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { A11Y, APP_CONFIG, NAV, PORTAL_ROUTES, ROUTES } from '@/constants';
import { homeForRole } from '@/lib/portal-access';
import { useHasNews } from '@/lib/use-has-news';
import { renderAt } from '@/test/render';

import { Header } from './Header';

vi.mock('@/lib/use-has-news', () => ({ useHasNews: vi.fn(() => false) }));

beforeEach(() => {
  vi.mocked(useHasNews).mockReturnValue(false);
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

describe('header News link (ADR-0001)', () => {
  it('is not shown when there is no news, or the check failed (AC-1.6, AC-1.7)', () => {
    renderAt(<Header />);
    expect(screen.queryByRole('link', { name: NAV.newsLink.label })).not.toBeInTheDocument();
    expect(topLevelNavItems()).toHaveLength(NAV.links.length);
  });

  it('is the last of 6 nav items, linking to /posts, when there is news (AC-1.8)', () => {
    vi.mocked(useHasNews).mockReturnValue(true);
    renderAt(<Header />);
    const items = topLevelNavItems();
    expect(items).toHaveLength(6); // ≤ 6 nav items; Sign in and Register Interest are actions
    const link = within(items[items.length - 1] as HTMLElement).getByRole('link');
    expect(link).toHaveTextContent(NAV.newsLink.label);
    expect(link).toHaveAttribute('href', ROUTES.posts);
  });

  it('is marked as the current page only on /posts (AC-1.8)', () => {
    vi.mocked(useHasNews).mockReturnValue(true);
    const { unmount } = renderAt(<Header />, ROUTES.posts);
    expect(screen.getByRole('link', { name: NAV.newsLink.label })).toHaveAttribute(
      'aria-current',
      'page',
    );
    unmount();

    renderAt(<Header />, ROUTES.privacy);
    expect(screen.getByRole('link', { name: NAV.newsLink.label })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
