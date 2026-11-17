import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  completeSignUp,
  getSignUpOptions,
  getSignUpStatus,
  resendSignUpLink,
  signUpWithEmail,
} from './sign-up.service';

// Stand-ins for the supabase-js calls the sign-up pages make.
type SignUpCall = { email: string; password: string; options: unknown };
const signUp = vi.fn<(call: SignUpCall) => Promise<unknown>>();
const resend = vi.fn();
const rpc = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
let configured = true;

vi.mock('@/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/constants')>();
  return {
    ...actual,
    APP_CONFIG: {
      ...actual.APP_CONFIG,
      supabase: {
        ...actual.APP_CONFIG.supabase,
        url: 'http://127.0.0.1:55321',
        publishableKey: 'local',
      },
    },
  };
});

vi.mock('./supabase.client', () => ({
  getSupabase: async () => ({ auth: { signUp, resend, updateUser, signOut }, rpc }),
  isPortalConfigured: () => configured,
  clearStoredSession: () => undefined,
}));

beforeEach(() => {
  for (const mock of [signUp, resend, rpc, updateUser, signOut]) mock.mockReset();
  configured = true;
});
afterEach(() => vi.unstubAllGlobals());

describe('signUpWithEmail', () => {
  it('sends a lower-cased e-mail, only full_name in data, and a long throwaway password', async () => {
    signUp.mockResolvedValue({ data: {}, error: null });

    const result = await signUpWithEmail('  Priya Shah ', '  Priya@Example.COM ', 'token');

    expect(result).toEqual({ ok: true, data: undefined });
    const [sent] = signUp.mock.lastCall ?? [];
    if (!sent) throw new Error('signUp was not called');
    expect(sent.email).toBe('priya@example.com');
    expect(sent.options).toEqual({ captchaToken: 'token', data: { full_name: 'Priya Shah' } });
    expect(sent.password.length).toBeGreaterThanOrEqual(12);
    expect(JSON.stringify(result)).not.toContain(sent.password);
  });

  it('makes a new throwaway password every time', async () => {
    signUp.mockResolvedValue({ data: {}, error: null });
    await signUpWithEmail('A Parent', 'a@example.com', 't');
    await signUpWithEmail('A Parent', 'a@example.com', 't');
    const [first, second] = signUp.mock.calls.map(([call]) => call.password);
    expect(first).not.toBe(second);
  });

  it('answers an existing or recently e-mailed address exactly like a new one (AC-10, AC-12)', async () => {
    for (const code of ['user_already_exists', 'over_email_send_rate_limit']) {
      signUp.mockResolvedValueOnce({
        data: {},
        error: { code, status: code === 'user_already_exists' ? 422 : 429 },
      });
      expect(await signUpWithEmail('A Parent', 'a@example.com', 't')).toEqual({
        ok: true,
        data: undefined,
      });
    }
  });

  it("maps the sign-up hook's refusals by message", async () => {
    const cases = [
      ['sign_up_busy', 'signUpBusy'],
      ['sign_up_closed', 'signUpClosed'],
      ['sign_up_refused', 'signUpClosed'],
      ['invalid_name', 'invalidName'],
    ];
    for (const [message, key] of cases) {
      signUp.mockResolvedValueOnce({ data: {}, error: { status: 429, code: 'unknown', message } });
      expect(await signUpWithEmail('A Parent', 'a@example.com', 't')).toEqual({
        ok: false,
        error: key,
      });
    }
  });

  it('reports captcha, the IP limit and the network', async () => {
    signUp.mockResolvedValueOnce({ data: {}, error: { code: 'captcha_failed', status: 400 } });
    expect(await signUpWithEmail('A Parent', 'a@example.com', 't')).toEqual({
      ok: false,
      error: 'captchaFailed',
    });
    signUp.mockResolvedValueOnce({
      data: {},
      error: { code: 'over_request_rate_limit', status: 429 },
    });
    expect(await signUpWithEmail('A Parent', 'a@example.com', 't')).toEqual({
      ok: false,
      error: 'tooManyAttempts',
    });
    signUp.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await signUpWithEmail('A Parent', 'a@example.com', 't')).toEqual({
      ok: false,
      error: 'network',
    });
  });

  it('does nothing when the portal is not configured', async () => {
    configured = false;
    expect(await signUpWithEmail('A Parent', 'a@example.com', 't')).toEqual({
      ok: false,
      error: 'notConfigured',
    });
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe('resendSignUpLink', () => {
  it('answers "sent" for anything but captcha, the IP limit and the network (AC-19)', async () => {
    resend.mockResolvedValueOnce({ data: {}, error: null });
    expect((await resendSignUpLink('a@example.com', 't')).ok).toBe(true);
    resend.mockResolvedValueOnce({
      data: {},
      error: { code: 'over_email_send_rate_limit', status: 429 },
    });
    expect((await resendSignUpLink('a@example.com', 't')).ok).toBe(true);
    resend.mockResolvedValueOnce({ data: {}, error: { code: 'validation_failed', status: 400 } });
    expect((await resendSignUpLink('a@example.com', 't')).ok).toBe(true);
    resend.mockResolvedValueOnce({ data: {}, error: { code: 'captcha_failed', status: 400 } });
    expect(await resendSignUpLink('a@example.com', 't')).toEqual({
      ok: false,
      error: 'captchaFailed',
    });
    resend.mockResolvedValueOnce({
      data: {},
      error: { code: 'over_request_rate_limit', status: 429 },
    });
    expect(await resendSignUpLink('a@example.com', 't')).toEqual({
      ok: false,
      error: 'tooManyAttempts',
    });
  });
});

describe('getSignUpOptions', () => {
  // The page reads two RPCs: the status and whether the e-mail form is on.
  function replies(status: unknown, emailOpen: unknown) {
    rpc.mockImplementation(async (name: string) =>
      name === 'sign_up_email_open' ? emailOpen : status,
    );
  }
  const googleOn = () =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ external: { google: true } }))),
    );

  it('reads the status, whether the e-mail form is on and whether Google is on', async () => {
    replies({ data: 'busy', error: null }, { data: true, error: null });
    googleOn();

    expect(await getSignUpOptions()).toEqual({ status: 'busy', email: true, google: true });
    expect(rpc).toHaveBeenCalledWith('sign_up_status');
    expect(rpc).toHaveBeenCalledWith('sign_up_email_open');
  });

  it('Google-only: e-mail off (or its read failed) and Google on', async () => {
    replies({ data: 'open', error: null }, { data: false, error: null });
    googleOn();
    expect(await getSignUpOptions()).toEqual({ status: 'open', email: false, google: true });

    replies({ data: 'open', error: null }, { data: null, error: { code: 'PGRST202' } });
    expect(await getSignUpOptions()).toEqual({ status: 'open', email: false, google: true });
  });

  it('reads no way in (e-mail and Google both off) as closed', async () => {
    replies({ data: 'open', error: null }, { data: false, error: null });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ external: { google: false } }))),
    );
    expect(await getSignUpOptions()).toEqual({ status: 'closed', email: false, google: false });
  });

  it('reads a failed status or settings read as closed, with no Google (hidden, never broken)', async () => {
    replies({ data: null, error: { code: '500' } }, { data: true, error: null });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}')),
    );
    expect(await getSignUpOptions()).toEqual({ status: 'closed', email: false, google: false });

    replies({ data: 'open', error: null }, { data: true, error: null });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    expect(await getSignUpOptions()).toEqual({ status: 'closed', email: false, google: false });

    replies({ data: 'open', error: null }, { data: true, error: null });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    expect(await getSignUpOptions()).toEqual({ status: 'open', email: true, google: false });
  });

  it('is closed when the portal is not configured', async () => {
    configured = false;
    expect(await getSignUpOptions()).toEqual({ status: 'closed', email: false, google: false });
  });
});

describe('getSignUpStatus (Admin → Users)', () => {
  it('reports a failed read as a failure, not as closed (Tester 6a bug 2)', async () => {
    rpc.mockResolvedValueOnce({ data: 'closed', error: null });
    expect(await getSignUpStatus()).toEqual({ ok: true, data: 'closed' });
    rpc.mockResolvedValueOnce({ data: null, error: { code: '500', message: 'boom' } });
    expect((await getSignUpStatus()).ok).toBe(false);
  });
});

describe('completeSignUp', () => {
  it('sets the password first, then saves the name and the tick', async () => {
    updateUser.mockResolvedValue({ data: {}, error: null });
    rpc.mockResolvedValue({ data: null, error: null });

    const result = await completeSignUp({
      fullName: ' Priya Shah ',
      password: 'a long password',
      acceptsTerms: true,
    });

    expect(result.ok).toBe(true);
    expect(updateUser).toHaveBeenCalledWith({ password: 'a long password', nonce: undefined });
    expect(rpc).toHaveBeenCalledWith('complete_sign_up', {
      new_full_name: 'Priya Shah',
      accepts_terms: true,
    });
  });

  it('asks a Google account for no password', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await completeSignUp({ fullName: 'Priya Shah', password: null, acceptsTerms: true });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('stops at a refused password (e.g. a weak one), without saving', async () => {
    updateUser.mockResolvedValue({ data: {}, error: { code: 'weak_password' } });
    expect(
      await completeSignUp({ fullName: 'P S', password: 'x'.repeat(12), acceptsTerms: true }),
    ).toEqual({ ok: false, error: 'weakPassword' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('on a retry after a failed save, the "same password" reply goes on to save (Tester 6a bug 1)', async () => {
    updateUser.mockResolvedValue({ data: {}, error: { code: 'same_password' } });
    rpc.mockResolvedValue({ data: null, error: null });
    const result = await completeSignUp({
      fullName: 'P S',
      password: 'x'.repeat(12),
      acceptsTerms: true,
    });
    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith('complete_sign_up', {
      new_full_name: 'P S',
      accepts_terms: true,
    });
  });

  it('maps the server refusals', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'sign_up_link_needed' },
    });
    expect(await completeSignUp({ fullName: 'P S', password: null, acceptsTerms: true })).toEqual({
      ok: false,
      error: 'signUpLinkNeeded',
    });
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'terms_required' } });
    expect(await completeSignUp({ fullName: 'P S', password: null, acceptsTerms: false })).toEqual({
      ok: false,
      error: 'termsRequired',
    });
  });
});
