import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FINISH_SIGN_UP_HINT, LOGIN_PAGE, PORTAL_ROUTES } from '@/constants';
import { getSignUpOptions } from '@/services';
import type { SignUpOptions } from '@/services';

import LoginPage, { clientLoader } from './login';

vi.mock('@/services', () => ({ getSignUpOptions: vi.fn(), signIn: vi.fn() }));
vi.mock('@/lib/portal-guard', () => ({ guardPortalPage: vi.fn(async () => null) }));

function renderAt(path: string, options: SignUpOptions) {
  vi.mocked(getSignUpOptions).mockResolvedValue(options);
  const Stub = createRoutesStub([
    {
      path: PORTAL_ROUTES.login,
      Component: LoginPage,
      loader: ({ request }) => clientLoader({ request } as ClientLoaderFunctionArgs),
    },
  ]);
  render(<Stub initialEntries={[path]} />);
}

beforeEach(() => vi.mocked(getSignUpOptions).mockReset());

describe('/portal/login and sign-up (AC-1, AC-48)', () => {
  it.each(['open', 'busy'] as const)(
    'shows "New to AJ Classes? Create an account" when %s',
    async (status) => {
      renderAt(PORTAL_ROUTES.login, { status, google: false });
      expect(await screen.findByRole('link', { name: LOGIN_PAGE.signUpLink })).toHaveAttribute(
        'href',
        PORTAL_ROUTES.signUp,
      );
      expect(
        screen.getByText(LOGIN_PAGE.signUpPrompt.trim(), { exact: false }),
      ).toBeInTheDocument();
    },
  );

  it('hides the link when sign-up is closed, the read failed or the portal is not configured', async () => {
    // getSignUpOptions turns a failed read and an unconfigured portal into closed (its own test).
    renderAt(PORTAL_ROUTES.login, { status: 'closed', google: false });
    expect(await screen.findByRole('heading', { name: LOGIN_PAGE.heading })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: LOGIN_PAGE.signUpLink })).not.toBeInTheDocument();
  });

  it('AC-20: after a password sign-in to an unfinished sign-up, shows the finish hint', async () => {
    renderAt(`${PORTAL_ROUTES.login}?reason=finish-sign-up`, { status: 'open', google: false });
    expect(
      await screen.findByText(FINISH_SIGN_UP_HINT.before, { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: FINISH_SIGN_UP_HINT.link })).toHaveAttribute(
      'href',
      PORTAL_ROUTES.forgotPassword,
    );
  });
});
