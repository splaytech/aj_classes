import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PORTAL_COMMON, PORTAL_ROUTES } from '@/constants';
import type { AppRole } from '@/constants';
import { renderAt } from '@/test/render';

import { PortalLayout } from './PortalLayout';

vi.mock('@/services', () => ({
  signOut: vi.fn(),
  watchForSignOut: vi.fn(async () => () => undefined),
}));

function renderLayout(role: AppRole, path: string) {
  const accountRole = role; // a variable: a literal role= reads as an ARIA role to lint
  renderAt(
    <PortalLayout fullName="Sam Person" role={accountRole}>
      <p>page</p>
    </PortalLayout>,
    path,
  );
  return within(screen.getByRole('navigation', { name: PORTAL_COMMON.navLabel }));
}

function navLinks(nav: ReturnType<typeof renderLayout>) {
  return nav.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]);
}

// Mock tests (AC 8) supersede the sign-up AC-22 wording "a signed-up user sees only Latest news,
// Account and Sign out": a user now also has Mock tests.
describe('PortalLayout for a signed-up user', () => {
  it('shows Latest news, Mock tests, Account and Sign out', () => {
    const nav = renderLayout('user', PORTAL_ROUTES.user);

    expect(navLinks(nav)).toEqual([
      [PORTAL_COMMON.nav.userHome, PORTAL_ROUTES.user],
      [PORTAL_COMMON.nav.mockTests, PORTAL_ROUTES.userMockTests],
      [PORTAL_COMMON.nav.account, PORTAL_ROUTES.account],
    ]);
    expect(screen.getByRole('button', { name: PORTAL_COMMON.signOut })).toBeInTheDocument();
    expect(screen.getAllByText(PORTAL_COMMON.areaBadge.user).length).toBeGreaterThan(0);
  });
});

describe('PortalLayout navigation for mock tests (AC 8)', () => {
  it('gives a student a Mock tests link after Timetable', () => {
    const nav = renderLayout('student', PORTAL_ROUTES.student);

    expect(navLinks(nav)).toEqual([
      [PORTAL_COMMON.nav.studentHome, PORTAL_ROUTES.student],
      [PORTAL_COMMON.nav.studentTimetable, PORTAL_ROUTES.studentTimetable],
      [PORTAL_COMMON.nav.mockTests, PORTAL_ROUTES.studentMockTests],
      [PORTAL_COMMON.nav.account, PORTAL_ROUTES.account],
    ]);
  });

  it('gives a parent a Mock tests link', () => {
    const nav = renderLayout('parent', PORTAL_ROUTES.parent);

    expect(navLinks(nav)).toEqual([
      [PORTAL_COMMON.nav.parentHome, PORTAL_ROUTES.parent],
      [PORTAL_COMMON.nav.mockTests, PORTAL_ROUTES.parentMockTests],
      [PORTAL_COMMON.nav.account, PORTAL_ROUTES.account],
    ]);
  });

  it.each<AppRole>(['tutor', 'admin'])('gives a %s no Mock tests link in the top bar', (role) => {
    const nav = renderLayout(role, PORTAL_ROUTES.tutor);

    expect(nav.queryByRole('link', { name: PORTAL_COMMON.nav.mockTests })).toBeNull();
  });

  it.each([
    [
      'student',
      PORTAL_ROUTES.student,
      PORTAL_ROUTES.studentMockTests,
      PORTAL_COMMON.nav.studentHome,
    ],
    ['parent', PORTAL_ROUTES.parent, PORTAL_ROUTES.parentMockTests, PORTAL_COMMON.nav.parentHome],
    ['user', PORTAL_ROUTES.user, PORTAL_ROUTES.userMockTests, PORTAL_COMMON.nav.userHome],
  ] as const)(
    'marks only Mock tests as current on a %s mock test page',
    (role, _home, mockTests, homeLabel) => {
      const nav = renderLayout(role, `${mockTests}/abc`);

      expect(nav.getByRole('link', { name: PORTAL_COMMON.nav.mockTests })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(nav.getByRole('link', { name: homeLabel })).not.toHaveAttribute('aria-current');
    },
  );

  it.each([
    ['student', PORTAL_ROUTES.student, PORTAL_COMMON.nav.studentHome],
    ['parent', PORTAL_ROUTES.parent, PORTAL_COMMON.nav.parentHome],
    ['user', PORTAL_ROUTES.user, PORTAL_COMMON.nav.userHome],
  ] as const)('marks the home link as current on the %s home', (role, home, homeLabel) => {
    const nav = renderLayout(role, home);

    expect(nav.getByRole('link', { name: homeLabel })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: PORTAL_COMMON.nav.mockTests })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('keeps the student Timetable link current on the timetable page, not My work', () => {
    const nav = renderLayout('student', PORTAL_ROUTES.studentTimetable);

    expect(nav.getByRole('link', { name: PORTAL_COMMON.nav.studentTimetable })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(nav.getByRole('link', { name: PORTAL_COMMON.nav.studentHome })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
