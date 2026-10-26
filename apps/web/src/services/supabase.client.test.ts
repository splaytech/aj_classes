import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearStoredSession, sessionStorageKey } from './supabase.client';

vi.mock('@/constants', () => ({
  APP_CONFIG: { supabase: { url: 'http://127.0.0.1:55321', publishableKey: 'local' } },
}));

beforeEach(() => window.localStorage.clear());

describe('the stored session (BUG-15)', () => {
  it("uses supabase-js's own default key, so nobody is signed out by pinning it", () => {
    expect(sessionStorageKey('http://127.0.0.1:55321')).toBe('sb-127-auth-token');
    expect(sessionStorageKey('https://abcdefgh.supabase.co')).toBe('sb-abcdefgh-auth-token');
  });

  it('clears the session and its user and code-verifier copies, and nothing else', () => {
    window.localStorage.setItem('sb-127-auth-token', '{}');
    window.localStorage.setItem('sb-127-auth-token-user', '{}');
    window.localStorage.setItem('sb-127-auth-token-code-verifier', 'x');
    window.localStorage.setItem('portal-theme', 'dark');

    expect(clearStoredSession()).toBe(true);

    expect(Object.keys(window.localStorage)).toEqual(['portal-theme']);
  });

  it('finds nothing the second time, so parallel page loaders can all call it', () => {
    window.localStorage.setItem('sb-127-auth-token', '{}');

    expect(clearStoredSession()).toBe(true);
    expect(clearStoredSession()).toBe(false);
  });
});
