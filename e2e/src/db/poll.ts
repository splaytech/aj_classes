import { config } from '../config.js';

export interface PollOptions {
  timeoutMs?: number;
  intervalMs?: number;
  description?: string;
}

/**
 * Polls `fn` until `predicate` holds for its result, or `timeoutMs` elapses.
 * Used for fire-and-forget writes (lead capture, invite email delivery) where
 * asserting once-and-immediately would flake.
 */
export async function pollForRow<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  options: PollOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? config.budgets.pollTimeoutMs;
  const intervalMs = options.intervalMs ?? config.budgets.pollIntervalMs;
  const start = Date.now();
  let lastValue: T | undefined;
  let attempts = 0;

  while (Date.now() - start < timeoutMs) {
    attempts += 1;
    lastValue = await fn();
    if (predicate(lastValue)) {
      return lastValue;
    }
    await sleep(intervalMs);
  }

  const elapsed = Date.now() - start;
  const label = options.description ? ` (${options.description})` : '';
  throw new Error(
    `pollForRow timed out${label} after ${elapsed}ms across ${attempts} attempt(s).\n` +
      `Last seen value: ${JSON.stringify(lastValue)}`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
