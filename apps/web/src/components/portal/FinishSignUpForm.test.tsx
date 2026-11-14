import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FINISH_SIGN_UP,
  LEGAL_LINKS,
  PORTAL_COMMON,
  PORTAL_ERRORS,
  PORTAL_VALIDATION,
} from '@/constants';
import { completeSignUp, sendReauthCode } from '@/services';
import type { SignUpInfo } from '@/services';
import { setupUser } from '@/test/user';

import { FinishSignUpForm } from './FinishSignUpForm';

vi.mock('@/services', () => ({
  completeSignUp: vi.fn(),
  sendReauthCode: vi.fn(),
  signOut: vi.fn(),
}));

const EMAIL_SIGN_UP: SignUpInfo = {
  fullName: 'Priya Shah',
  email: 'priya@example.com',
  signedUpWith: 'email',
  canFinish: true,
};
const PASSWORD = 'a long enough password';

function renderForm(signUp: SignUpInfo = EMAIL_SIGN_UP) {
  const onDone = vi.fn();
  render(
    <MemoryRouter>
      <FinishSignUpForm signUp={signUp} onDone={onDone} />
    </MemoryRouter>,
  );
  return onDone;
}

async function fill(password = PASSWORD, tick = true) {
  const user = setupUser();
  await user.type(screen.getByLabelText(FINISH_SIGN_UP.labels.fullName), 'Priya Shah');
  await user.type(screen.getByLabelText(FINISH_SIGN_UP.labels.password), password);
  await user.type(screen.getByLabelText(FINISH_SIGN_UP.labels.confirm), password);
  if (tick) await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: FINISH_SIGN_UP.submit }));
  return user;
}

beforeEach(() => {
  vi.mocked(completeSignUp).mockReset();
  vi.mocked(sendReauthCode).mockReset();
});

describe('FinishSignUpForm', () => {
  it("doesn't pre-fill an e-mail sign-up's name, which a stranger may have typed (security 06 finding 9)", () => {
    renderForm();
    expect(screen.getByLabelText(FINISH_SIGN_UP.labels.fullName)).toHaveValue('');
  });

  it("starts a Google sign-up with the name from the owner's Google account", () => {
    renderForm({ ...EMAIL_SIGN_UP, signedUpWith: 'google' });
    expect(screen.getByLabelText(FINISH_SIGN_UP.labels.fullName)).toHaveValue('Priya Shah');
  });

  it('AC-6: asks an e-mail account for a new password, with autocomplete new-password and show/hide', async () => {
    renderForm();
    const password = screen.getByLabelText(FINISH_SIGN_UP.labels.password);
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    expect(password).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText(FINISH_SIGN_UP.labels.confirm)).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
    const user = setupUser();
    await user.click(screen.getAllByRole('button', { name: PORTAL_COMMON.showPasswordLabel })[0]!);
    expect(password).toHaveAttribute('type', 'text');
  });

  it('AC-6: refuses a short password without calling the server', async () => {
    renderForm();
    await fill('short');
    expect((await screen.findAllByText(PORTAL_VALIDATION.passwordTooShort)).length).toBeGreaterThan(
      0,
    );
    expect(completeSignUp).not.toHaveBeenCalled();
  });

  it("AC-6: shows the server's weak-password and same-password messages", async () => {
    vi.mocked(completeSignUp).mockResolvedValueOnce({ ok: false, error: 'weakPassword' });
    renderForm();
    const user = await fill();
    expect(await screen.findByText(PORTAL_ERRORS.weakPassword)).toBeInTheDocument();

    vi.mocked(completeSignUp).mockResolvedValueOnce({ ok: false, error: 'samePassword' });
    await user.click(screen.getByRole('button', { name: FINISH_SIGN_UP.submit }));
    expect(await screen.findByText(PORTAL_ERRORS.samePassword)).toBeInTheDocument();
  });

  it('AC-7, AC-50: the tick says parent or guardian and links Terms and Privacy in a new tab', () => {
    renderForm();
    expect(screen.getByText(FINISH_SIGN_UP.terms.before, { exact: false })).toBeInTheDocument();
    const terms = screen.getByRole('link', { name: FINISH_SIGN_UP.terms.termsLink });
    const privacy = screen.getByRole('link', { name: FINISH_SIGN_UP.terms.privacyLink });
    expect(terms).toHaveAttribute('href', '/terms');
    expect(privacy).toHaveAttribute('href', LEGAL_LINKS.privacy);
    expect(terms).toHaveAttribute('target', '_blank');
    expect(privacy).toHaveAttribute('target', '_blank');
  });

  it('AC-7: needs the tick', async () => {
    renderForm();
    await fill(PASSWORD, false);
    expect(await screen.findByText(PORTAL_VALIDATION.termsRequired)).toBeInTheDocument();
    expect(completeSignUp).not.toHaveBeenCalled();
  });

  it('saves the name, password and tick, then moves on', async () => {
    vi.mocked(completeSignUp).mockResolvedValue({ ok: true, data: undefined });
    const onDone = renderForm();
    await fill();
    expect(completeSignUp).toHaveBeenCalledWith(
      { fullName: 'Priya Shah', password: PASSWORD, acceptsTerms: true },
      undefined,
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('AC-52: asks a Google account for no password', async () => {
    vi.mocked(completeSignUp).mockResolvedValue({ ok: true, data: undefined });
    renderForm({ ...EMAIL_SIGN_UP, signedUpWith: 'google' });
    expect(screen.queryByLabelText(FINISH_SIGN_UP.labels.password)).not.toBeInTheDocument();
    const user = setupUser();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: FINISH_SIGN_UP.submit }));
    expect(completeSignUp).toHaveBeenCalledWith(
      { fullName: 'Priya Shah', password: null, acceptsTerms: true },
      undefined,
    );
  });

  it('asks for the e-mailed code when Supabase wants it, then sends it', async () => {
    vi.mocked(completeSignUp).mockResolvedValueOnce({ ok: false, error: 'reauthNeeded' });
    vi.mocked(sendReauthCode).mockResolvedValue({ ok: true, data: undefined });
    renderForm();
    const user = await fill();
    expect(await screen.findByText(FINISH_SIGN_UP.codeSent)).toBeInTheDocument();
    vi.mocked(completeSignUp).mockResolvedValueOnce({ ok: true, data: undefined });
    await user.type(screen.getByLabelText(FINISH_SIGN_UP.labels.code), '12345678');
    await user.click(screen.getByRole('button', { name: FINISH_SIGN_UP.submit }));
    expect(completeSignUp).toHaveBeenLastCalledWith(
      { fullName: 'Priya Shah', password: PASSWORD, acceptsTerms: true },
      '12345678',
    );
  });

  it('asks for the 8-digit e-mailed code, not a 6-digit one (security 06 finding 5)', async () => {
    vi.mocked(completeSignUp).mockResolvedValueOnce({ ok: false, error: 'reauthNeeded' });
    vi.mocked(sendReauthCode).mockResolvedValue({ ok: true, data: undefined });
    renderForm();
    const user = await fill();
    const field = await screen.findByLabelText(FINISH_SIGN_UP.labels.code);
    expect(field).toHaveAttribute('maxLength', '8');
    await user.type(field, '123456');
    await user.click(screen.getByRole('button', { name: FINISH_SIGN_UP.submit }));
    expect(await screen.findByText(PORTAL_VALIDATION.emailCodeInvalid)).toBeInTheDocument();
    expect(completeSignUp).toHaveBeenCalledTimes(1);
  });

  it('shows the server refusal when the session can’t finish', async () => {
    vi.mocked(completeSignUp).mockResolvedValue({ ok: false, error: 'signUpLinkNeeded' });
    renderForm();
    await fill();
    expect(await screen.findByText(PORTAL_ERRORS.signUpLinkNeeded)).toBeInTheDocument();
  });
});
