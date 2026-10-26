import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearStoredSession, getSupabase, sessionStorageKey } from './supabase.client';

const LOCAL_URL = 'http://127.0.0.1:55321';

vi.mock('@/constants', () => ({
  APP_CONFIG: { supabase: { url: 'http://127.0.0.1:55321', publishableKey: 'local' } },
}));

/** The key a client made with supabase-js's defaults (no storageKey) stores its session under. */
function defaultKeyOf(url: string): string {
  const client = createClient(url, 'any-key', { auth: { autoRefreshToken: false } });
  // storageKey is protected in the types, but it's what auth-js reads and writes.
  return (client.auth as unknown as { storageKey: string }).storageKey;
}

/** A session that won't expire during the test, so reading it never asks the server. */
function storedSession() {
  const inAnHour = Math.floor(Date.now() / 1000) + 3600;
  return JSON.stringify({
    access_token: 'header.payload.signature',
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: inAnHour,
    user: { id: 'u1', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' },
  });
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('the stored session (BUG-15)', () => {
  it.each([LOCAL_URL, 'https://abcdefgh.supabase.co'])(
    "pins supabase-js's own default key for %s, so nobody is signed out by pinning it",
    (url) => {
      expect(sessionStorageKey(url)).toBe(defaultKeyOf(url));
    },
  );

  it('clears the session and its user and code-verifier copies, and nothing else', () => {
    const key = sessionStorageKey(LOCAL_URL);
    window.localStorage.setItem(key, '{}');
    window.localStorage.setItem(`${key}-user`, '{}');
    window.localStorage.setItem(`${key}-code-verifier`, 'x');
    window.localStorage.setItem('portal-theme', 'dark');

    expect(clearStoredSession()).toBe(true);

    expect(Object.keys(window.localStorage)).toEqual(['portal-theme']);
  });

  it('finds nothing the second time, so parallel page loaders can all call it', () => {
    window.localStorage.setItem(sessionStorageKey(LOCAL_URL), '{}');

    expect(clearStoredSession()).toBe(true);
    expect(clearStoredSession()).toBe(false);
  });

  it("leaves the app's client with no session, without asking the server", async () => {
    const network = vi.fn(() => Promise.reject(new Error('no network in this test')));
    vi.stubGlobal('fetch', network);
    window.localStorage.setItem(sessionStorageKey(LOCAL_URL), storedSession());
    const supabase = await getSupabase();
    await supabase.auth.stopAutoRefresh();

    expect((await supabase.auth.getSession()).data.session).not.toBeNull();
    clearStoredSession();
    expect((await supabase.auth.getSession()).data.session).toBeNull();
    expect(network).not.toHaveBeenCalled();
  });
});
