import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  completeSignUp,
  getSignUpOptions,
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
  it('reads the status and whether Google is on', async () => {
    rpc.mockResolvedValue({ data: 'busy', error: null });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ external: { google: true } }))),
    );

    expect(await getSignUpOptions()).toEqual({ status: 'busy', google: true });
    expect(rpc).toHaveBeenCalledWith('sign_up_status');
  });

  it('reads a failed status or settings read as closed, with no Google (hidden, never broken)', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '500' } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}')),
    );
    expect(await getSignUpOptions()).toEqual({ status: 'closed', google: false });

    rpc.mockResolvedValue({ data: 'open', error: null });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    expect(await getSignUpOptions()).toEqual({ status: 'closed', google: false });

    rpc.mockResolvedValue({ data: 'open', error: null });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    expect(await getSignUpOptions()).toEqual({ status: 'open', google: false });
  });

  it('is closed when the portal is not configured', async () => {
    configured = false;
    expect(await getSignUpOptions()).toEqual({ status: 'closed', google: false });
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

  it('stops at a refused password (e.g. the same password), without saving', async () => {
    updateUser.mockResolvedValue({ data: {}, error: { code: 'same_password' } });
    expect(
      await completeSignUp({ fullName: 'P S', password: 'x'.repeat(12), acceptsTerms: true }),
    ).toEqual({
      ok: false,
      error: 'samePassword',
    });
    expect(rpc).not.toHaveBeenCalled();
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
