import { test, expect } from '../src/fixtures/test-fixtures.js';
import { loginAsAdmin } from '../src/auth/login.js';
import { config } from '../src/config.js';

test.describe('Staff/admin login', () => {
  test('admin signs in through 2FA and lands on the portal', async ({ page }) => {
    await loginAsAdmin(page);
    expect(new URL(page.url()).pathname.startsWith(config.auth.expectedLandingPath)).toBe(true);
  });
});
