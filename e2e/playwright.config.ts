import { defineConfig } from '@playwright/test';
import { config } from './src/config.js';

export default defineConfig({
  testDir: './tests',
  globalSetup: './setup/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  // No retries, so a flaky spec shows as a failure instead of hiding (02b §6.5 risk 1).
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  expect: { timeout: 10000 },
  use: {
    baseURL: config.web.baseUrl,
    // With retries at 0, 'on-first-retry' would never record; keep traces of failures for the
    // CI artifact instead (AC-6.5).
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
