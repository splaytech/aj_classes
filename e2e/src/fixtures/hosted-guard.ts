// The hosted-request guard every spec runs under (AC-6.14, 03b §6.4). It imports only
// @playwright/test on purpose: the CSP sweep runs where the E2E stack env isn't set, and
// src/config.ts throws at import time without it.

import { expect, test as base } from '@playwright/test';

// Any *.supabase.co host: staging and prod share one hosted project, so no test may reach it.
const HOSTED_SUPABASE = /^https:\/\/[^/]+\.supabase\.co\//;

export const test = base.extend<{ hostedSupabaseGuard: void }>({
  /** Aborts every request to a *.supabase.co host and fails the test if any was attempted. */
  hostedSupabaseGuard: [
    async ({ context }, use) => {
      const attempted: string[] = [];
      await context.route(HOSTED_SUPABASE, (route) => {
        attempted.push(route.request().url());
        return route.abort();
      });
      await use();
      expect(attempted, 'requests to a hosted Supabase project').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
