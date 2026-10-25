import { test as base, type Page } from '@playwright/test';
import { query } from '../db/pg-client.js';
import { anon } from '../db/anon-client.js';
import * as mailpit from '../mail/mailpit.js';
import { loginAsAdmin } from '../auth/login.js';
import { newMarker, type Marker } from './markers.js';

export type CleanupFn = () => Promise<void>;

export interface CleanupStack {
  register(fn: CleanupFn): void;
}

interface Fixtures {
  db: { query: typeof query };
  anonDb: typeof anon;
  mail: typeof mailpit;
  authedAdminPage: Page;
  marker: (kind: string) => Marker;
  cleanup: CleanupStack;
}

export const test = base.extend<Fixtures>({
  db: async ({}, use) => {
    await use({ query });
  },

  anonDb: async ({}, use) => {
    await use(anon);
  },

  mail: async ({}, use) => {
    await use(mailpit);
  },

  authedAdminPage: async ({ page }, use) => {
    await loginAsAdmin(page);
    await use(page);
  },

  marker: async ({}, use) => {
    await use(newMarker);
  },

  cleanup: async ({}, use) => {
    const callbacks: CleanupFn[] = [];
    await use({
      register(fn: CleanupFn) {
        callbacks.push(fn);
      },
    });
    // LIFO: last created is first removed, so FK-dependent rows (e.g.
    // audit_log before profiles before auth.users) unwind safely.
    for (const fn of callbacks.reverse()) {
      await fn().catch((error) => {
        console.warn('Cleanup callback failed (continuing):', error);
      });
    }
  },
});

export { expect } from '@playwright/test';
