import type { Page } from '@playwright/test';
import { config } from '../config.js';
import { totp } from './totp.js';

const TWO_STEP_FALLBACK_GRACE_MS = 3000;

/**
 * Drives the full UI login flow for the local admin account, including the
 * 2FA step. Primary path relies on the dev server's auto-entered TOTP code;
 * falls back to deriving the code in-harness if the field isn't auto-filled.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/portal/login');
  await page.locator('#login-email').fill(config.auth.adminEmail);
  await page.locator('#login-password').fill(config.auth.adminPassword);

  // The Turnstile widget resolves its (always-pass, local-only) challenge asynchronously; clicking
  // Sign in before it settles is a silent no-op. Wait for its "Success!" state first.
  await page
    .getByText('Success!', { exact: true })
    .waitFor({ state: 'visible', timeout: TWO_STEP_FALLBACK_GRACE_MS })
    .catch(() => {});

  const signInButton = page.getByRole('button', { name: /sign in/i });
  await signInButton.click();
  await page
    .waitForURL((url) => url.pathname !== '/portal/login', { timeout: TWO_STEP_FALLBACK_GRACE_MS })
    .catch(() => signInButton.click());

  await handleTwoStepIfPresented(page);

  // Note: `/portal/login` and `/portal/login/verify` are themselves prefixed by `/portal`, so a
  // naive startsWith(expectedLandingPath) would match before 2FA actually completes. Require the
  // landing path and explicitly rule out still being on a login/verify page.
  await page.waitForURL(
    (url) =>
      url.pathname.startsWith(config.auth.expectedLandingPath) &&
      !url.pathname.startsWith('/portal/login'),
    { timeout: config.budgets.pollTimeoutMs },
  );
}

async function handleTwoStepIfPresented(page: Page): Promise<void> {
  const codeField = page.locator('#two-step-code');

  try {
    await page.waitForURL(/\/portal\/login\/verify/, { timeout: TWO_STEP_FALLBACK_GRACE_MS });
  } catch {
    // Either already past the verify step, or it never appears for this account.
    return;
  }

  const appeared = await codeField
    .waitFor({ state: 'visible', timeout: TWO_STEP_FALLBACK_GRACE_MS })
    .then(() => true)
    .catch(() => false);

  if (!appeared) {
    // Dev-server auto-entry handled it (status message shown instead of the form).
    return;
  }

  const autoFilled = await codeField
    .inputValue()
    .then((value) => value.length === 6)
    .catch(() => false);

  if (!autoFilled) {
    await codeField.fill(totp(config.auth.totpSeed));
    await page.getByRole('button', { name: /verify|continue|submit/i }).click();
  }
}
