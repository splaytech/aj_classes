import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PORTAL_ERRORS,
  PORTAL_ROUTES,
  PORTAL_SEO,
  PORTAL_VALIDATION,
  SIGN_UP_PAGE,
  PROFILE_VALIDATION,
} from '@/constants';
import { getSignUpOptions, signUpWithEmail } from '@/services';
import type { SignUpOptions } from '@/services';
import { TurnstileStub, turnstileResets } from '@/test/turnstile-stub';
import { setupUser } from '@/test/user';

import routes from '../../routes';
import SignUpPage, { meta } from './sign-up';

vi.mock('@/services', () => ({
  getSignUpOptions: vi.fn(),
  signUpWithEmail: vi.fn(),
  startGoogleSignIn: vi.fn(),
}));
vi.mock('@/components/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/ui')>()),
  TurnstileField: TurnstileStub,
}));

function renderWith(options: SignUpOptions) {
  const Stub = createRoutesStub([
    { path: PORTAL_ROUTES.signUp, Component: SignUpPage, loader: () => options },
  ]);
  render(<Stub initialEntries={[PORTAL_ROUTES.signUp]} />);
}

async function fillAndSubmit(name = 'Priya Shah', email = 'priya@example.com', passCheck = true) {
  const user = setupUser();
  await user.type(await screen.findByLabelText(SIGN_UP_PAGE.labels.fullName), name);
  await user.type(screen.getByLabelText(SIGN_UP_PAGE.labels.email), email);
  if (passCheck) await user.click(screen.getByRole('button', { name: 'Pass the check' }));
  await user.click(screen.getByRole('button', { name: SIGN_UP_PAGE.submit }));
}

beforeEach(() => {
  vi.mocked(signUpWithEmail).mockReset();
  // What the page reads again just before sending (review-5 finding 2): still open by default.
  vi.mocked(getSignUpOptions).mockReset().mockResolvedValue({ status: 'open', google: false });
  turnstileResets.count = 0;
});

describe('/portal/sign-up', () => {
  it('AC-2: asks for a name and an e-mail, never a password, with the Privacy notice and Sign in', async () => {
    renderWith({ status: 'open', google: false });

    expect(
      await screen.findByRole('heading', { level: 1, name: SIGN_UP_PAGE.heading }),
    ).toBeInTheDocument();
    expect(screen.getByText(SIGN_UP_PAGE.intro)).toBeInTheDocument();
    expect(screen.getByLabelText(SIGN_UP_PAGE.labels.fullName)).toBeInTheDocument();
    expect(screen.getByLabelText(SIGN_UP_PAGE.labels.email)).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByRole('link', { name: SIGN_UP_PAGE.notice.link })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByRole('link', { name: SIGN_UP_PAGE.signIn })).toHaveAttribute(
      'href',
      PORTAL_ROUTES.login,
    );
  });

  it('AC-51: shows Continue with Google only when Google is on', async () => {
    renderWith({ status: 'open', google: true });
    expect(await screen.findByRole('button', { name: SIGN_UP_PAGE.google })).toBeInTheDocument();
  });

  it('AC-51: hides Continue with Google when it is off (or the settings read failed)', async () => {
    renderWith({ status: 'open', google: false });
    await screen.findByRole('heading', { level: 1, name: SIGN_UP_PAGE.heading });
    expect(screen.queryByRole('button', { name: SIGN_UP_PAGE.google })).not.toBeInTheDocument();
  });

  it('AC-10: shows the same "check your e-mail" card for any accepted sign-up', async () => {
    vi.mocked(signUpWithEmail).mockResolvedValue({ ok: true, data: undefined });
    renderWith({ status: 'open', google: false });
    await fillAndSubmit();

    expect(
      await screen.findByRole('heading', { name: SIGN_UP_PAGE.sent.heading }),
    ).toBeInTheDocument();
    expect(screen.getByText(SIGN_UP_PAGE.sent.text)).toBeInTheDocument();
    expect(SIGN_UP_PAGE.sent.text).toContain('1 hour');
    expect(screen.getByRole('link', { name: SIGN_UP_PAGE.sent.help.reset })).toHaveAttribute(
      'href',
      PORTAL_ROUTES.forgotPassword,
    );
    expect(screen.getByRole('link', { name: SIGN_UP_PAGE.sent.sendAgain })).toHaveAttribute(
      'href',
      PORTAL_ROUTES.signUpResend,
    );
    expect(signUpWithEmail).toHaveBeenCalledWith('Priya Shah', 'priya@example.com', 'test-token');
  });

  it('AC-4/5: checks the name and e-mail before sending anything', async () => {
    renderWith({ status: 'open', google: false });
    await fillAndSubmit('P', 'nope');
    expect(await screen.findByText(PORTAL_VALIDATION.emailInvalid)).toBeInTheDocument();
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });

  it('AC-8: asks for the "I am human" check first', async () => {
    renderWith({ status: 'open', google: false });
    await fillAndSubmit('Priya Shah', 'priya@example.com', false);
    expect(await screen.findByText(PORTAL_VALIDATION.captchaRequired)).toBeInTheDocument();
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });

  it('AC-46: when busy, says so for any e-mail and never calls sign-up', async () => {
    renderWith({ status: 'busy', google: false });
    await fillAndSubmit();
    expect(await screen.findByText(SIGN_UP_PAGE.busy)).toBeInTheDocument();
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });

  it.each([
    ['a new e-mail', 'new-parent@example.com'],
    ['an e-mail that already has an account', 'parent@local.test'],
  ])(
    'AC-46: open when the page loaded but busy at submit: %s gets the busy message, and nothing is sent',
    async (_kind, email) => {
      renderWith({ status: 'open', google: false });
      vi.mocked(getSignUpOptions).mockResolvedValue({ status: 'busy', google: false });
      await fillAndSubmit('Priya Shah', email);
      expect(await screen.findByText(SIGN_UP_PAGE.busy)).toBeInTheDocument();
      expect(signUpWithEmail).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['a new e-mail', 'new-parent@example.com'],
    ['an e-mail that already has an account', 'parent@local.test'],
  ])(
    'AC-48: open when the page loaded but closed at submit: %s gets the closed card',
    async (_kind, email) => {
      renderWith({ status: 'open', google: false });
      vi.mocked(getSignUpOptions).mockResolvedValue({ status: 'closed', google: false });
      await fillAndSubmit('Priya Shah', email);
      expect(
        await screen.findByRole('heading', { name: SIGN_UP_PAGE.closed.heading }),
      ).toBeInTheDocument();
      expect(signUpWithEmail).not.toHaveBeenCalled();
    },
  );

  it("shows a server-side name refusal in the page's own words (Tester 6a bug 3)", async () => {
    vi.mocked(signUpWithEmail).mockResolvedValueOnce({ ok: false, error: 'invalidName' });
    renderWith({ status: 'open', google: false });
    await fillAndSubmit();
    expect(await screen.findByText(PROFILE_VALIDATION.nameLength)).toBeInTheDocument();
    expect(screen.queryByText(PORTAL_ERRORS.invalidName)).not.toBeInTheDocument();
  });

  it('AC-48: shows the closed card, with a Sign in link, when sign-up is closed', async () => {
    renderWith({ status: 'closed', google: false });
    expect(
      await screen.findByRole('heading', { name: SIGN_UP_PAGE.closed.heading }),
    ).toBeInTheDocument();
    expect(screen.getByText(SIGN_UP_PAGE.closed.text)).toBeInTheDocument();
    expect(screen.queryByLabelText(SIGN_UP_PAGE.labels.email)).not.toBeInTheDocument();
  });

  it('switches to the closed card when the server says closed, and to busy when it says busy', async () => {
    vi.mocked(signUpWithEmail).mockResolvedValueOnce({ ok: false, error: 'signUpBusy' });
    renderWith({ status: 'open', google: false });
    await fillAndSubmit();
    expect(await screen.findByText(PORTAL_ERRORS.signUpBusy)).toBeInTheDocument();
    expect(turnstileResets.count).toBe(1);

    vi.mocked(signUpWithEmail).mockResolvedValueOnce({ ok: false, error: 'signUpClosed' });
    const user = setupUser();
    await user.click(screen.getByRole('button', { name: 'Pass the check' }));
    await user.click(screen.getByRole('button', { name: SIGN_UP_PAGE.submit }));
    expect(
      await screen.findByRole('heading', { name: SIGN_UP_PAGE.closed.heading }),
    ).toBeInTheDocument();
  });

  it('shows captcha, rate-limit and network problems, and resets the check after each', async () => {
    renderWith({ status: 'open', google: false });
    const user = setupUser();
    await user.type(await screen.findByLabelText(SIGN_UP_PAGE.labels.fullName), 'Priya Shah');
    await user.type(screen.getByLabelText(SIGN_UP_PAGE.labels.email), 'priya@example.com');
    for (const error of ['captchaFailed', 'tooManyAttempts', 'network'] as const) {
      vi.mocked(signUpWithEmail).mockResolvedValueOnce({ ok: false, error });
      await user.click(screen.getByRole('button', { name: 'Pass the check' }));
      await user.click(screen.getByRole('button', { name: SIGN_UP_PAGE.submit }));
      expect(await screen.findByText(PORTAL_ERRORS[error])).toBeInTheDocument();
    }
    expect(turnstileResets.count).toBe(3);
  });

  it('AC-11: is noindex, and sits under the portal root (its ErrorBoundary)', () => {
    expect(meta()).toEqual(expect.arrayContaining([{ name: 'robots', content: 'noindex' }]));
    expect(meta()[0]).toEqual({ title: `${PORTAL_SEO.signUp} | AJ Classes Portal` });
    type RouteNode = { file: string; path?: string; children?: RouteNode[] };
    const portalRoot = (routes as RouteNode[]).find(
      (node) => node.file === 'routes/portal/portal-root.tsx',
    );
    const files = portalRoot?.children?.map((node) => node.file) ?? [];
    expect(files).toContain('routes/portal/sign-up.tsx');
    expect(files).toContain('routes/portal/sign-up-resend.tsx');
  });
});
