import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_CONFIRM_PAGE,
  AUTH_LINK_ERRORS,
  PORTAL_ERRORS,
  PORTAL_QUERY,
  PORTAL_ROUTES,
  PORTAL_SEO,
} from '@/constants';
import { confirmRecoveryLink, confirmSignUpLink } from '@/services';
import { setupUser } from '@/test/user';

import AuthConfirmPage from './auth-confirm';

vi.mock('@/services', () => ({ confirmRecoveryLink: vi.fn(), confirmSignUpLink: vi.fn() }));

function renderPage(search: string) {
  const Stub = createRoutesStub([
    { path: PORTAL_ROUTES.authConfirm, Component: AuthConfirmPage },
    { path: PORTAL_ROUTES.setPassword, Component: () => <h1>{PORTAL_SEO.setPassword}</h1> },
    { path: PORTAL_ROUTES.join, Component: () => <h1>{PORTAL_SEO.join}</h1> },
  ]);
  render(<Stub initialEntries={[`${PORTAL_ROUTES.authConfirm}${search}`]} />);
}

const link = (type: string) => `?${PORTAL_QUERY.tokenHash}=abc123&${PORTAL_QUERY.linkType}=${type}`;
const continueButton = () => screen.getByRole('button', { name: AUTH_CONFIRM_PAGE.continue });

beforeEach(() => {
  vi.mocked(confirmRecoveryLink).mockReset();
  vi.mocked(confirmSignUpLink).mockReset();
});

describe('email link page', () => {
  it('says the link is incomplete when a parameter is missing', () => {
    renderPage(`?${PORTAL_QUERY.tokenHash}=abc123`);

    expect(screen.getByRole('heading', { name: PORTAL_ERRORS.linkExpired })).toBeInTheDocument();
    expect(screen.getByText(AUTH_CONFIRM_PAGE.invalidLink)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('refuses an old-format invite link without any request (AC 38)', async () => {
    const user = setupUser();
    renderPage(link('invite'));

    expect(
      screen.getByRole('heading', { name: AUTH_CONFIRM_PAGE.heading.invite }),
    ).toBeInTheDocument();
    await user.click(continueButton());

    expect(await screen.findByText(PORTAL_ERRORS.inviteExpired)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: AUTH_CONFIRM_PAGE.alreadySetUp })).toHaveAttribute(
      'href',
      PORTAL_ROUTES.login,
    );
    expect(confirmRecoveryLink).not.toHaveBeenCalled();
  });

  it('opens Set your password after a good reset link', async () => {
    vi.mocked(confirmRecoveryLink).mockResolvedValue({ ok: true, data: undefined });
    const user = setupUser();
    renderPage(link('recovery'));

    await user.click(continueButton());

    expect(
      await screen.findByRole('heading', { name: PORTAL_SEO.setPassword }),
    ).toBeInTheDocument();
    expect(confirmRecoveryLink).toHaveBeenCalledWith('abc123');
  });

  it('offers a new reset link when the reset link has expired', async () => {
    vi.mocked(confirmRecoveryLink).mockResolvedValue({ ok: false, error: 'linkExpired' });
    const user = setupUser();
    renderPage(link('recovery'));

    await user.click(continueButton());

    expect(
      await screen.findByText(`${PORTAL_ERRORS.linkExpired} ${AUTH_LINK_ERRORS.recovery}`),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: AUTH_CONFIRM_PAGE.requestNewLink })).toHaveAttribute(
      'href',
      PORTAL_ROUTES.forgotPassword,
    );
  });
});

describe('sign-up confirmation link, type=email (open sign-up AC-16, AC-18)', () => {
  it('uses nothing until Continue, then confirms, wipes the address and goes to the finish step', async () => {
    const user = setupUser();
    const replaceState = vi.spyOn(window.history, 'replaceState');
    vi.mocked(confirmSignUpLink).mockResolvedValue({ ok: true, data: undefined });
    renderPage(link('email'));

    expect(
      screen.getByRole('heading', { name: AUTH_CONFIRM_PAGE.heading.email }),
    ).toBeInTheDocument();
    expect(screen.getByText(AUTH_CONFIRM_PAGE.intro.email)).toBeInTheDocument();
    expect(confirmSignUpLink).not.toHaveBeenCalled();

    await user.click(continueButton());

    expect(confirmSignUpLink).toHaveBeenCalledWith('abc123');
    expect(confirmRecoveryLink).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledWith(null, '', PORTAL_ROUTES.authConfirm);
    expect(await screen.findByRole('heading', { name: PORTAL_SEO.join })).toBeInTheDocument();
    replaceState.mockRestore();
  });

  it('shows one message and a "Send the link again" link when the link has expired', async () => {
    const user = setupUser();
    vi.mocked(confirmSignUpLink).mockResolvedValue({ ok: false, error: 'linkExpired' });
    renderPage(link('email'));
    await user.click(continueButton());

    expect(await screen.findByText(PORTAL_ERRORS.linkExpired)).toBeInTheDocument();
    expect(screen.queryByText(AUTH_LINK_ERRORS.recovery, { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: AUTH_CONFIRM_PAGE.sendAgain })).toHaveAttribute(
      'href',
      PORTAL_ROUTES.signUpResend,
    );
  });
});
