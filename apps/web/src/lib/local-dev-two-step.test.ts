import { describe, expect, it } from 'vitest';

import { totpCode } from './local-dev-two-step';

// RFC 6238 appendix B test key: the ASCII text "12345678901234567890", in base32.
const RFC_KEY = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totpCode (local development helper)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1234567890, '005924'],
  ])('matches the RFC 6238 test vector at %i seconds', async (seconds, expected) => {
    expect(await totpCode(RFC_KEY, seconds * 1000)).toBe(expected);
  });
});
