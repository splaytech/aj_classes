import { act, render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_CALLBACK_PAGE, PORTAL_ERRORS, PORTAL_ROUTES } from '@/constants';
import { finishGoogleSignIn } from '@/services';

import AuthCallbackPage, { callbackErrorKey, readCallbackParams } from './auth-callback';

vi.mock('@/services', () => ({ finishGoogleSignIn: vi.fn() }));

// The shapes Supabase sends back (05-dev-notes, slice 0 S3): the query, repeated in the fragment.
const SHAPES = {
  triggerRefused:
    '?error=server_error&error_code=unexpected_failure&error_description=Error+creating+identity#error=server_error&error_code=unexpected_failure&error_description=Error+creating+identity&sb=',
  unverified:
    '?error=server_error&error_code=&error_description=google_email_unverified#error=server_error&error_description=google_email_unverified&sb=',
  closed:
    '?error=server_error&error_code=&error_description=sign_up_closed#error=server_error&error_description=sign_up_closed&sb=',
  refused: '?error=server_error&error_code=&error_description=sign_up_refused',
  signupDisabled:
    '?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance',
  banned:
    '?error=access_denied&error_code=user_banned&error_description=User+is+banned#error=access_denied&error_code=user_banned&error_description=User+is+banned&sb=',
};

function renderAt(urlTail: string) {
  window.history.replaceState(null, '', `${PORTAL_ROUTES.authCallback}${urlTail}`);
  const Stub = createRoutesStub([
    { path: PORTAL_ROUTES.authCallback, Component: AuthCallbackPage },
    { path: PORTAL_ROUTES.root, Component: () => <h1>Portal home</h1> },
  ]);
  return render(<Stub initialEntries={[PORTAL_ROUTES.authCallback]} />);
}

beforeEach(() => vi.mocked(finishGoogleSignIn).mockReset());
afterEach(() => window.history.replaceState(null, '', '/'));

describe('callbackErrorKey (S3 shapes)', () => {
  const key = (tail: string) => {
    const [search = '', hash = ''] = tail.split('#');
    return callbackErrorKey(readCallbackParams(search, hash ? `#${hash}` : ''));
  };

  it('maps each recorded shape', () => {
    expect(key(SHAPES.unverified)).toBe('googleEmailUnverified'); // AC-53
    expect(key(SHAPES.closed)).toBe('signUpClosed'); // AC-48
    expect(key(SHAPES.refused)).toBe('signUpClosed');
    expect(key(SHAPES.signupDisabled)).toBe('signUpClosed');
    expect(key(SHAPES.banned)).toBe('notActive'); // AC-32
    expect(key(SHAPES.triggerRefused)).toBe('googleAccountExists'); // AC-54, message M
    expect(key('?error=anything_else')).toBe('googleAccountExists');
  });

  it('reads the fragment when the query is missing', () => {
    expect(key('#error=server_error&error_description=google_email_unverified')).toBe(
      'googleEmailUnverified',
    );
  });
});

describe('/portal/auth/callback', () => {
  it('shows message M for the linking refusal, with a way back, and wipes the address', async () => {
    renderAt(SHAPES.triggerRefused);
    expect(await screen.findByText(PORTAL_ERRORS.googleAccountExists)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: AUTH_CALLBACK_PAGE.backToSignIn })).toHaveAttribute(
      'href',
      PORTAL_ROUTES.login,
    );
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      PORTAL_ROUTES.authCallback,
    );
    expect(finishGoogleSignIn).not.toHaveBeenCalled();
  });

  it('shows the AC-53 message for an unverified Google e-mail', async () => {
    renderAt(SHAPES.unverified);
    expect(await screen.findByText(PORTAL_ERRORS.googleEmailUnverified)).toBeInTheDocument();
  });

  it('swaps a code for a session once, wipes the address, and goes to /portal', async () => {
    vi.mocked(finishGoogleSignIn).mockResolvedValue({ ok: true, data: undefined });
    renderAt('?code=one-time-code-1');
    expect(await screen.findByRole('heading', { name: 'Portal home' })).toBeInTheDocument();
    expect(finishGoogleSignIn).toHaveBeenCalledTimes(1);
    expect(finishGoogleSignIn).toHaveBeenCalledWith('one-time-code-1');
    expect(window.location.search).toBe('');
  });

  it('drops a result that arrives after the page has gone', async () => {
    let answer: (value: { ok: true; data: undefined }) => void = () => undefined;
    vi.mocked(finishGoogleSignIn).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const view = renderAt('?code=one-time-code-2');
    expect(screen.getByText(AUTH_CALLBACK_PAGE.checking)).toBeInTheDocument();
    view.unmount();
    await act(async () => answer({ ok: true, data: undefined }));
    expect(screen.queryByRole('heading', { name: 'Portal home' })).not.toBeInTheDocument();
  });
});
