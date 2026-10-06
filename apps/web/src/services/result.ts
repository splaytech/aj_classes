// Small helpers so every portal service builds its Result the same way.

import { toErrorKey } from './auth-errors';
import type { ErrorKey, Result } from './types';

export function succeed(): Result;
export function succeed<T>(data: T): Result<T>;
export function succeed<T>(data?: T): Result<T | undefined> {
  return { ok: true, data };
}

export function fail(error: ErrorKey): { ok: false; error: ErrorKey } {
  return { ok: false, error };
}

/** Runs a backend call and turns anything it throws (e.g. no network) into an error Result. */
export async function attempt<T>(action: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await action();
  } catch (error) {
    const key = toErrorKey(error);
    return fail(key === 'unknown' ? 'network' : key); // a thrown error is almost always the network
  }
}
