import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_CONFIRM_PAGE,
  PORTAL_COMMON,
  PORTAL_ERRORS,
  PORTAL_QUERY,
  PORTAL_ROUTES,
  PORTAL_SEO,
} from '@/constants';
import { redeemInvite, signInWithInviteHop } from '@/services';
import { setupUser } from '@/test/user';

import InvitePage from './invite';

vi.mock('@/services', () => ({ redeemInvite: vi.fn(), signInWithInviteHop: vi.fn() }));

const TOKEN = 'a'.repeat(43);

function renderPage(search: string) {
  const Stub = createRoutesStub([
    { path: PORTAL_ROUTES.invite, Component: InvitePage },
    { path: PORTAL_ROUTES.join, Component: () => <h1>{PORTAL_SEO.join}</h1> },
  ]);
  render(<Stub initialEntries={[`${PORTAL_ROUTES.invite}${search}`]} />);
}

const withToken = `?${PORTAL_QUERY.inviteToken}=${TOKEN}`;
const continueButton = () => screen.getByRole('button', { name: AUTH_CONFIRM_PAGE.continue });

let replaceState: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(redeemInvite).mockReset();
  vi.mocked(signInWithInviteHop).mockReset();
  vi.mocked(redeemInvite).mockResolvedValue({ ok: true, data: { tokenHash: 'hop' } });
  vi.mocked(signInWithInviteHop).mockResolvedValue({ ok: true, data: undefined });
  replaceState = vi.spyOn(window.history, 'replaceState');
});

afterEach(() => {
  replaceState.mockRestore();
});

describe('invite page (ADR-0010)', () => {
  it('says the link is incomplete, with no Continue, when there is no token (AC 10)', () => {
    renderPage('');

    expect(screen.getByRole('heading', { name: PORTAL_ERRORS.linkExpired })).toBeInTheDocument();
    expect(screen.getByText(AUTH_CONFIRM_PAGE.invalidLink)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('waits for Continue: opening the page uses nothing up (AC 6)', () => {
    renderPage(withToken);

    expect(
      screen.getByRole('heading', { name: AUTH_CONFIRM_PAGE.heading.invite }),
    ).toBeInTheDocument();
    expect(screen.getByText(AUTH_CONFIRM_PAGE.intro.invite)).toBeInTheDocument();
    expect(continueButton()).toBeEnabled();
    expect(redeemInvite).not.toHaveBeenCalled();
    expect(signInWithInviteHop).not.toHaveBeenCalled();
  });

  it('shows Continue for a garbled token too; the server refuses it (AC 10)', () => {
    renderPage(`?${PORTAL_QUERY.inviteToken}=abc`);

    expect(continueButton()).toBeInTheDocument();
  });

  it('clears the address bar before the redeem, signs in and opens the setup form (AC 1, 8)', async () => {
    const user = setupUser();
    renderPage(withToken);

    await user.click(continueButton());

    expect(await screen.findByRole('heading', { name: PORTAL_SEO.join })).toBeInTheDocument();
    expect(replaceState).toHaveBeenCalledWith(null, '', PORTAL_ROUTES.invite);
    // The address bar is cleared before the token is sent anywhere.
    expect(Math.min(...replaceState.mock.invocationCallOrder)).toBeLessThan(
      Math.min(...vi.mocked(redeemInvite).mock.invocationCallOrder),
    );
    expect(redeemInvite).toHaveBeenCalledWith(TOKEN);
    expect(signInWithInviteHop).toHaveBeenCalledWith('hop');
  });

  it('shows "Checking your link…" on a disabled button while it works', async () => {
    vi.mocked(redeemInvite).mockReturnValue(new Promise(() => {}));
    const user = setupUser();
    renderPage(withToken);

    await user.click(continueButton());

    expect(screen.getByRole('button', { name: AUTH_CONFIRM_PAGE.checking })).toBeDisabled();
  });

  it('refuses an expired or used link with the sign-in way out (AC 9)', async () => {
    vi.mocked(redeemInvite).mockResolvedValue({ ok: false, error: 'inviteExpired' });
    const user = setupUser();
    renderPage(withToken);

    await user.click(continueButton());

    expect(await screen.findByText(PORTAL_ERRORS.inviteExpired)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: AUTH_CONFIRM_PAGE.heading.invite }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: AUTH_CONFIRM_PAGE.alreadySetUp })).toHaveAttribute(
      'href',
      PORTAL_ROUTES.login,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(AUTH_CONFIRM_PAGE.intro.invite)).not.toBeInTheDocument();
    expect(signInWithInviteHop).not.toHaveBeenCalled();
  });

  it('refuses when the sign-in token is gone', async () => {
    vi.mocked(signInWithInviteHop).mockResolvedValue({ ok: false, error: 'linkExpired' });
    const user = setupUser();
    renderPage(withToken);

    await user.click(continueButton());

    expect(await screen.findByText(PORTAL_ERRORS.inviteExpired)).toBeInTheDocument();
  });

  it('Try again after a failed redeem sends the same link again', async () => {
    vi.mocked(redeemInvite).mockResolvedValueOnce({ ok: false, error: 'serverProblem' });
    const user = setupUser();
    renderPage(withToken);

    await user.click(continueButton());
    expect(await screen.findByText(PORTAL_ERRORS.serverProblem)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: PORTAL_COMMON.tryAgain }));

    expect(await screen.findByRole('heading', { name: PORTAL_SEO.join })).toBeInTheDocument();
    expect(redeemInvite).toHaveBeenCalledTimes(2);
    expect(vi.mocked(redeemInvite).mock.calls[1]).toEqual([TOKEN]);
  });

  it('Try again after a failed sign-in only signs in again, with the same token', async () => {
    vi.mocked(signInWithInviteHop).mockResolvedValueOnce({ ok: false, error: 'network' });
    const user = setupUser();
    renderPage(withToken);

    await user.click(continueButton());
    expect(await screen.findByText(PORTAL_ERRORS.network)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: PORTAL_COMMON.tryAgain }));

    expect(await screen.findByRole('heading', { name: PORTAL_SEO.join })).toBeInTheDocument();
    expect(redeemInvite).toHaveBeenCalledTimes(1);
    expect(signInWithInviteHop).toHaveBeenCalledTimes(2);
    expect(vi.mocked(signInWithInviteHop).mock.calls[1]).toEqual(['hop']);
  });
});
