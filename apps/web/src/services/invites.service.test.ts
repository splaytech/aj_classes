import { beforeEach, describe, expect, it, vi } from 'vitest';

import { redeemInvite, signInWithInviteHop } from './invites.service';

// A stand-in for the two supabase-js calls: functions.invoke (invite-redeem) and auth.verifyOtp.
const invoke = vi.fn();
const verifyOtp = vi.fn();
let configured = true;

vi.mock('./supabase.client', () => ({
  getSupabase: async () => ({ functions: { invoke }, auth: { verifyOtp } }),
  isPortalConfigured: () => configured,
  clearStoredSession: () => undefined,
}));

const TOKEN = 'a'.repeat(43);
const NETWORK_ERROR = { name: 'AuthRetryableFetchError', message: 'Failed to fetch' };

beforeEach(() => {
  invoke.mockReset();
  verifyOtp.mockReset();
  configured = true;
});

describe('redeemInvite', () => {
  it('sends only the token to invite-redeem and returns the hop token', async () => {
    invoke.mockResolvedValue({ data: { ok: true, data: { tokenHash: 'hop' } }, error: null });

    expect(await redeemInvite(TOKEN)).toEqual({ ok: true, data: { tokenHash: 'hop' } });
    expect(invoke).toHaveBeenCalledWith('invite-redeem', { body: { token: TOKEN } });
  });

  it('turns every refused link into inviteExpired', async () => {
    invoke.mockResolvedValue({ data: { ok: false, code: 'invite_invalid' }, error: null });

    expect(await redeemInvite(TOKEN)).toEqual({ ok: false, error: 'inviteExpired' });
  });

  it('treats a reply without a hop token as unknown', async () => {
    invoke.mockResolvedValue({ data: { ok: true, data: {} }, error: null });

    expect(await redeemInvite(TOKEN)).toEqual({ ok: false, error: 'unknown' });
  });

  it('maps a server error to serverProblem', async () => {
    const context = new Response(JSON.stringify({ ok: false, code: 'server_error' }), {
      status: 500,
    });
    invoke.mockResolvedValue({ data: null, error: { context } });

    expect(await redeemInvite(TOKEN)).toEqual({ ok: false, error: 'serverProblem' });
  });

  it('calls nothing when the portal is switched off', async () => {
    configured = false;

    expect(await redeemInvite(TOKEN)).toEqual({ ok: false, error: 'notConfigured' });
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('signInWithInviteHop', () => {
  it('verifies the token as a recovery token', async () => {
    verifyOtp.mockResolvedValue({ error: null });

    expect(await signInWithInviteHop('hop')).toEqual({ ok: true, data: undefined });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'hop', type: 'recovery' });
  });

  it('retries exactly once when the connection dropped', async () => {
    verifyOtp
      .mockResolvedValueOnce({ error: NETWORK_ERROR })
      .mockResolvedValueOnce({ error: null });

    expect((await signInWithInviteHop('hop')).ok).toBe(true);
    expect(verifyOtp).toHaveBeenCalledTimes(2);
  });

  it('gives up after the one retry', async () => {
    verifyOtp.mockResolvedValue({ error: NETWORK_ERROR });

    expect(await signInWithInviteHop('hop')).toEqual({ ok: false, error: 'network' });
    expect(verifyOtp).toHaveBeenCalledTimes(2);
  });

  it('does not retry an expired hop token', async () => {
    verifyOtp.mockResolvedValue({ error: { code: 'otp_expired', message: 'expired' } });

    expect(await signInWithInviteHop('hop')).toEqual({ ok: false, error: 'linkExpired' });
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });
});
