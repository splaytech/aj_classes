import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertLocalDevServerEnv, assertLocalUrl } from './local-hosts.ts';

const LOCAL_API = 'http://127.0.0.1:55321';

describe('assertLocalUrl', () => {
  it('accepts localhost and 127.0.0.1', () => {
    assertLocalUrl('X', LOCAL_API);
    assertLocalUrl('X', 'http://localhost:5173');
  });

  it('refuses a hosted Supabase URL and a URL that does not parse', () => {
    assert.throws(() => assertLocalUrl('X', 'https://abc.supabase.co'), /not "abc.supabase.co"/);
    assert.throws(() => assertLocalUrl('X', 'not a url'), /is not a valid URL/);
  });
});

describe('assertLocalDevServerEnv', () => {
  it('accepts the local stack URL', () => {
    assertLocalDevServerEnv({ VITE_SUPABASE_URL: LOCAL_API, VITE_SUPABASE_PUBLISHABLE_KEY: 'k' });
  });

  it('refuses a hosted VITE_SUPABASE_URL before the dev server starts', () => {
    assert.throws(
      () => assertLocalDevServerEnv({ VITE_SUPABASE_URL: 'https://abc.supabase.co' }),
      /VITE_SUPABASE_URL must be localhost or 127.0.0.1/,
    );
  });

  it('refuses an unset or blank VITE_SUPABASE_URL, which would fall back to the app env files', () => {
    assert.throws(() => assertLocalDevServerEnv({}), /VITE_SUPABASE_URL is not set/);
    assert.throws(
      () => assertLocalDevServerEnv({ VITE_SUPABASE_URL: ' ' }),
      /VITE_SUPABASE_URL is not set/,
    );
  });

  it('refuses any other hosted VITE_SUPABASE_*_URL', () => {
    assert.throws(
      () =>
        assertLocalDevServerEnv({
          VITE_SUPABASE_URL: LOCAL_API,
          VITE_SUPABASE_FUNCTIONS_URL: 'https://abc.supabase.co/functions/v1',
        }),
      /VITE_SUPABASE_FUNCTIONS_URL must be localhost/,
    );
  });
});
