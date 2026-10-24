import { describe, expect, it } from 'vitest';

import { isConnectionFailure } from './connection-errors';

describe('isConnectionFailure', () => {
  it('recognises failed downloads in each browser', () => {
    expect(isConnectionFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(
      isConnectionFailure(new TypeError('Failed to fetch dynamically imported module: /x.js')),
    ).toBe(true);
    expect(isConnectionFailure(new TypeError('Load failed'))).toBe(true);
    expect(isConnectionFailure(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(
      isConnectionFailure(new TypeError('NetworkError when attempting to fetch resource.')),
    ).toBe(true);
  });

  it('treats a bug as a bug, even when it is a TypeError', () => {
    expect(
      isConnectionFailure(new TypeError("Cannot read properties of undefined (reading 'map')")),
    ).toBe(false);
    expect(isConnectionFailure(new Error('boom'))).toBe(false);
  });

  it('copes with things that are not errors', () => {
    expect(isConnectionFailure(null)).toBe(false);
    expect(isConnectionFailure('Failed to fetch')).toBe(false);
    expect(isConnectionFailure({ message: 'Failed to fetch' })).toBe(true);
  });
});
