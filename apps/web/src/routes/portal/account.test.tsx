import { render, screen } from '@testing-library/react';
import { Outlet, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCOUNT_PAGE, CONSENT_CHOICES, PORTAL_ROUTES, ROLE_LABELS } from '@/constants';
import type { AppRole } from '@/constants';
import { getAccessState, getMyConsents, getMyNotificationSettings, hasPassword } from '@/services';
import type { AccessState } from '@/services';

import AccountPage, { clientLoader } from './account';

vi.mock('@/services', () => ({
  canAddAuthenticator: vi.fn(() => true),
  changePassword: vi.fn(),
  getAccessState: vi.fn(),
  getMyConsents: vi.fn(),
  getMyNotificationSettings: vi.fn(),
  hasPassword: vi.fn(),
  listAuthenticators: vi.fn(async () => ({ ok: true, data: [] })),
  removeAuthenticator: vi.fn(),
  saveMyNotificationSettings: vi.fn(),
  sendReauthCode: vi.fn(),
  setMyConsents: vi.fn(),
}));

function accessFor(role: AppRole): AccessState {
  return {
    signedIn: true,
    userId: 'me',
    email: 'me@example.com',
    profile: { fullName: 'Me', role },
    onboarding: null,
    signUp: null,
    aal: 'aal2',
    hasVerifiedFactor: role === 'admin',
  };
}

function renderFor(role: AppRole, withPassword = true) {
  const access = accessFor(role);
  vi.mocked(getAccessState).mockResolvedValue(access);
  vi.mocked(hasPassword).mockResolvedValue({ ok: true, data: withPassword });
  const Stub = createRoutesStub([
    {
      Component: () => <Outlet context={access} />,
      children: [
        { path: PORTAL_ROUTES.account, Component: AccountPage, loader: () => clientLoader() },
      ],
    },
  ]);
  render(<Stub initialEntries={[PORTAL_ROUTES.account]} />);
}

beforeEach(() => {
  vi.mocked(getMyConsents)
    .mockReset()
    .mockResolvedValue({
      ok: true,
      data: { marketing: false, resultsPublicity: false, videoPublicity: false },
    });
  vi.mocked(getMyNotificationSettings)
    .mockReset()
    .mockResolvedValue({
      ok: true,
      data: { workReturned: true, newAssignment: true, dueTomorrow: true },
    });
});

describe('/portal/account for a signed-up user (AC-23)', () => {
  it('shows the e-mail, User, Appearance and Change password, and nothing else', async () => {
    renderFor('user');

    expect(await screen.findByText('me@example.com')).toBeInTheDocument();
    expect(screen.getByText(ROLE_LABELS.user)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: ACCOUNT_PAGE.appearance.heading }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: ACCOUNT_PAGE.password.heading }),
    ).toBeInTheDocument();
    for (const absent of [
      ACCOUNT_PAGE.notifications.heading,
      ACCOUNT_PAGE.choices.heading,
      ACCOUNT_PAGE.twoStep.heading,
    ]) {
      expect(screen.queryByRole('heading', { name: absent })).not.toBeInTheDocument();
    }
  });

  it("doesn't ask the database for a user's permissions or e-mail settings", async () => {
    renderFor('user');
    await screen.findByText('me@example.com');
    expect(getMyConsents).not.toHaveBeenCalled();
    expect(getMyNotificationSettings).not.toHaveBeenCalled();
  });

  it('hides Change password for a Google-only account with no password', async () => {
    renderFor('user', false);
    await screen.findByText('me@example.com');
    expect(
      screen.queryByRole('heading', { name: ACCOUNT_PAGE.password.heading }),
    ).not.toBeInTheDocument();
  });
});

describe('/portal/account for everyone else is unchanged', () => {
  it('a parent still gets Your choices and Notifications', async () => {
    renderFor('parent');
    expect(
      await screen.findByRole('heading', { name: ACCOUNT_PAGE.choices.heading }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: ACCOUNT_PAGE.notifications.heading }),
    ).toBeInTheDocument();
    expect(screen.getByText(CONSENT_CHOICES.labels.marketing)).toBeInTheDocument();
  });

  it('staff still get Two-step sign-in and no Notifications', async () => {
    renderFor('tutor');
    expect(
      await screen.findByRole('heading', { name: ACCOUNT_PAGE.twoStep.heading }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: ACCOUNT_PAGE.notifications.heading }),
    ).not.toBeInTheDocument();
  });
});
