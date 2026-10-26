// The CSP sweep (03b §6.5): public pages on the local production mirror, which serves the
// committed headers with the local Supabase origin substituted. It runs in the Lighthouse job,
// where the E2E stack env isn't set, so it has no global setup and imports nothing from src/.

import { defineConfig } from '@playwright/test';

// The mirror listens on 127.0.0.1 only (item 5, security S3), so "localhost" could miss it.
const MIRROR_URL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './csp',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: MIRROR_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm --filter web mirror',
    url: MIRROR_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
