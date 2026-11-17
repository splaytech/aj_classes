import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FINISH_SIGN_UP_HINT,
  PORTAL_ERRORS,
  PORTAL_ROUTES,
  SIGN_UP_PAGE,
  SIGN_UP_RESEND_PAGE,
} from '@/constants';
import { resendSignUpLink } from '@/services';
import { TurnstileStub } from '@/test/turnstile-stub';
import { setupUser } from '@/test/user';

import SignUpResendPage from './sign-up-resend';

vi.mock('@/services', () => ({ getSignUpOptions: vi.fn(), resendSignUpLink: vi.fn() }));
vi.mock('@/components/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/ui')>()),
  TurnstileField: TurnstileStub,
}));

function renderPage(emailOn = true) {
  const Stub = createRoutesStub([
    { path: PORTAL_ROUTES.signUpResend, Component: SignUpResendPage, loader: () => ({ emailOn }) },
  ]);
  render(<Stub initialEntries={[PORTAL_ROUTES.signUpResend]} />);
}

async function send(email = 'priya@example.com') {
  const user = setupUser();
  await user.type(await screen.findByLabelText(SIGN_UP_PAGE.labels.email), email);
  await user.click(screen.getByRole('button', { name: 'Pass the check' }));
  await user.click(screen.getByRole('button', { name: SIGN_UP_RESEND_PAGE.submit }));
}

beforeEach(() => vi.mocked(resendSignUpLink).mockReset());

describe('/portal/sign-up/resend (AC-19)', () => {
  it('Google-only: shows the closed card, with no form, while the e-mail form is off', async () => {
    renderPage(false);
    expect(
      await screen.findByRole('heading', { level: 1, name: SIGN_UP_PAGE.closed.heading }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(SIGN_UP_PAGE.labels.email)).not.toBeInTheDocument();
    expect(resendSignUpLink).not.toHaveBeenCalled();
  });

  it('always answers with the sent card and the finish hint', async () => {
    vi.mocked(resendSignUpLink).mockResolvedValue({ ok: true, data: undefined });
    renderPage();
    await send();

    expect(
      await screen.findByRole('heading', { name: SIGN_UP_PAGE.sent.heading }),
    ).toBeInTheDocument();
    expect(screen.getByText(SIGN_UP_PAGE.sent.text)).toBeInTheDocument();
    expect(screen.getByText(FINISH_SIGN_UP_HINT.before, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: FINISH_SIGN_UP_HINT.link })).toHaveAttribute(
      'href',
      PORTAL_ROUTES.forgotPassword,
    );
  });

  it('reports only captcha, the IP limit and the network', async () => {
    renderPage();
    const user = setupUser();
    await user.type(await screen.findByLabelText(SIGN_UP_PAGE.labels.email), 'priya@example.com');
    for (const error of ['captchaFailed', 'tooManyAttempts', 'network'] as const) {
      vi.mocked(resendSignUpLink).mockResolvedValueOnce({ ok: false, error });
      await user.click(screen.getByRole('button', { name: 'Pass the check' }));
      await user.click(screen.getByRole('button', { name: SIGN_UP_RESEND_PAGE.submit }));
      expect(await screen.findByText(PORTAL_ERRORS[error])).toBeInTheDocument();
    }
  });
});
