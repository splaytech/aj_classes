import { render, screen, waitFor } from '@testing-library/react';
import { Outlet, createRoutesStub, useLocation, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_CONFIRM_PAGE,
  PORTAL_COMMON,
  PORTAL_ERRORS,
  PORTAL_FRAGMENT,
  PORTAL_ROUTES,
  PORTAL_SEO,
} from '@/constants';
import { redeemInvite, signInWithInviteHop } from '@/services';
import { setupUser } from '@/test/user';

import InvitePage from './invite';

vi.mock('@/services', () => ({ redeemInvite: vi.fn(), signInWithInviteHop: vi.fn() }));

const TOKEN = 'a'.repeat(43);
const NEWER_TOKEN = 'b'.repeat(43);
const withToken = `#${PORTAL_FRAGMENT.inviteToken}=${TOKEN}`;

/** Shows the router's address, and re-opens a newer link in the same tab (a fragment change). */
function AddressProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="address">{`${location.pathname}${location.search}${location.hash}`}</output>
      <button
        onClick={() =>
          navigate(`${PORTAL_ROUTES.invite}#${PORTAL_FRAGMENT.inviteToken}=${NEWER_TOKEN}`)
        }
      >
        reopen
      </button>
      <Outlet />
    </>
  );
}

function renderPage(search: string) {
  const Stub = createRoutesStub([
    {
      Component: AddressProbe,
      children: [
        { path: PORTAL_ROUTES.invite, Component: InvitePage },
        { path: PORTAL_ROUTES.join, Component: () => <h1>{PORTAL_SEO.join}</h1> },
      ],
    },
  ]);
  render(<Stub initialEntries={[`${PORTAL_ROUTES.invite}${search}`]} />);
}

const address = () => screen.getByRole('status', { name: 'address' });
const continueButton = () => screen.getByRole('button', { name: AUTH_CONFIRM_PAGE.continue });

beforeEach(() => {
  vi.mocked(redeemInvite).mockReset();
  vi.mocked(signInWithInviteHop).mockReset();
  vi.mocked(redeemInvite).mockResolvedValue({ ok: true, data: { tokenHash: 'hop' } });
  vi.mocked(signInWithInviteHop).mockResolvedValue({ ok: true, data: undefined });
});

describe('invite page (ADR-0010)', () => {
  it('says the link is incomplete, with no Continue, when there is no token (AC 10)', () => {
    renderPage('');

    expect(screen.getByRole('heading', { name: PORTAL_ERRORS.linkExpired })).toBeInTheDocument();
    expect(screen.getByText(AUTH_CONFIRM_PAGE.invalidLink)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: AUTH_CONFIRM_PAGE.continue }),
    ).not.toBeInTheDocument();
  });

  it('wipes the token from the address bar as soon as the page loads (AC 8)', async () => {
    renderPage(withToken);

    await waitFor(() =>
      expect(address()).toHaveTextContent(new RegExp(`^${PORTAL_ROUTES.invite}$`)),
    );
    expect(continueButton()).toBeInTheDocument();
    expect(redeemInvite).not.toHaveBeenCalled();
  });

  it('a newer link opened in the same tab is wiped again, and Continue sends it (review-5 round 2)', async () => {
    const user = setupUser();
    renderPage(withToken);
    await waitFor(() =>
      expect(address()).toHaveTextContent(new RegExp(`^${PORTAL_ROUTES.invite}$`)),
    );

    await user.click(screen.getByRole('button', { name: 'reopen' }));

    await waitFor(() =>
      expect(address()).toHaveTextContent(new RegExp(`^${PORTAL_ROUTES.invite}$`)),
    );
    await user.click(continueButton());
    expect(await screen.findByRole('heading', { name: PORTAL_SEO.join })).toBeInTheDocument();
    expect(redeemInvite).toHaveBeenCalledTimes(1);
    expect(redeemInvite).toHaveBeenCalledWith(NEWER_TOKEN);
  });

  it("a late result for the first link never overwrites a re-opened link's screen (review-5 round 3)", async () => {
    let answerFirst: (result: Awaited<ReturnType<typeof redeemInvite>>) => void = () => {};
    vi.mocked(redeemInvite)
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockReturnValueOnce(new Promise(() => {}));
    const user = setupUser();
    renderPage(withToken);

    await user.click(continueButton());
    expect(screen.getByRole('button', { name: AUTH_CONFIRM_PAGE.checking })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'reopen' }));
    await user.click(continueButton());
    expect(redeemInvite).toHaveBeenLastCalledWith(NEWER_TOKEN);

    answerFirst({ ok: false, error: 'inviteExpired' });

    // B is still checking; A's refusal is dropped.
    expect(await screen.findByRole('button', { name: AUTH_CONFIRM_PAGE.checking })).toBeDisabled();
    await waitFor(() => expect(screen.queryByText(PORTAL_ERRORS.inviteExpired)).toBeNull());
    expect(signInWithInviteHop).not.toHaveBeenCalled();
  });

  it('ignores a token in the query string: links carry it in the fragment', () => {
    renderPage(`?${PORTAL_FRAGMENT.inviteToken}=${TOKEN}`);

    expect(screen.getByText(AUTH_CONFIRM_PAGE.invalidLink)).toBeInTheDocument();
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
    renderPage(`#${PORTAL_FRAGMENT.inviteToken}=abc`);

    expect(continueButton()).toBeInTheDocument();
  });

  it('signs in and opens the setup form, with the address bar already cleared (AC 1, 8)', async () => {
    const user = setupUser();
    renderPage(withToken);
    // The address is clean before the token is sent anywhere.
    await waitFor(() =>
      expect(address()).toHaveTextContent(new RegExp(`^${PORTAL_ROUTES.invite}$`)),
    );

    await user.click(continueButton());

    expect(await screen.findByRole('heading', { name: PORTAL_SEO.join })).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /continue|try again/i })).not.toBeInTheDocument();
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
