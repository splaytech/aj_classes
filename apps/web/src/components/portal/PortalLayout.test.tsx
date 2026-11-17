import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PORTAL_COMMON, PORTAL_ROUTES } from '@/constants';
import { renderAt } from '@/test/render';

import { PortalLayout } from './PortalLayout';

vi.mock('@/services', () => ({
  signOut: vi.fn(),
  watchForSignOut: vi.fn(async () => () => undefined),
}));

describe('PortalLayout for a signed-up user (AC-22)', () => {
  it('shows only Latest news, Account and Sign out', () => {
    const accountRole = 'user' as const; // a variable: a literal role= reads as an ARIA role to lint
    renderAt(
      <PortalLayout fullName="New Parent" role={accountRole}>
        <p>page</p>
      </PortalLayout>,
      PORTAL_ROUTES.user,
    );

    const nav = screen.getByRole('navigation', { name: PORTAL_COMMON.navLabel });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      [PORTAL_COMMON.nav.userHome, PORTAL_ROUTES.user],
      [PORTAL_COMMON.nav.account, PORTAL_ROUTES.account],
    ]);
    expect(screen.getByRole('button', { name: PORTAL_COMMON.signOut })).toBeInTheDocument();
    expect(screen.getAllByText(PORTAL_COMMON.areaBadge.user).length).toBeGreaterThan(0);
  });
});
