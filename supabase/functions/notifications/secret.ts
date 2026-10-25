// The shared-secret check for pg_cron's call (design 03 §3.4.1). No default secret: if
// NOTIFY_WORKER_SECRET is unset or empty, every request is refused (§0.3). Constant-time compare,
// so response timing doesn't reveal how much of a guess was right.

import { timingSafeEqual } from 'node:crypto';

export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!expected || !given) return false;
  const givenBytes = new TextEncoder().encode(given);
  const expectedBytes = new TextEncoder().encode(expected);
  if (givenBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(givenBytes, expectedBytes);
}
