import { describe, expect, it } from 'vitest';

import { afterHop, afterRedeem, inviteTokenFromHash } from './invite-steps';

describe('inviteTokenFromHash', () => {
  it('reads the token from #token=…', () => {
    expect(inviteTokenFromHash(`#token=${'a'.repeat(43)}`)).toBe('a'.repeat(43));
  });

  it('is empty with no fragment, or no token in it', () => {
    expect(inviteTokenFromHash('')).toBe('');
    expect(inviteTokenFromHash('#other=1')).toBe('');
  });
});

// Every row of the 03-design §5.4 table.
describe('afterRedeem', () => {
  it('goes on to the sign-in hop with the returned token', () => {
    expect(afterRedeem({ ok: true, data: { tokenHash: 'hop' } })).toEqual({
      kind: 'hop',
      tokenHash: 'hop',
    });
  });

  it('refuses an expired, used or replaced link', () => {
    expect(afterRedeem({ ok: false, error: 'inviteExpired' })).toEqual({ kind: 'refused' });
  });

  it.each(['serverProblem', 'unknown', 'network', 'notConfigured'] as const)(
    'offers Try again, re-sending the link, after %s',
    (error) => {
      expect(afterRedeem({ ok: false, error })).toEqual({ kind: 'retry', error, tokenHash: null });
    },
  );
});

describe('afterHop', () => {
  it('is signed in when the hop worked', () => {
    expect(afterHop({ ok: true, data: undefined }, 'hop')).toEqual({ kind: 'signedIn' });
  });

  it('refuses when the sign-in token is gone', () => {
    expect(afterHop({ ok: false, error: 'linkExpired' }, 'hop')).toEqual({ kind: 'refused' });
  });

  it.each(['network', 'serverProblem', 'unknown'] as const)(
    'offers Try again with the same sign-in token after %s',
    (error) => {
      expect(afterHop({ ok: false, error }, 'hop')).toEqual({
        kind: 'retry',
        error,
        tokenHash: 'hop',
      });
    },
  );
});
