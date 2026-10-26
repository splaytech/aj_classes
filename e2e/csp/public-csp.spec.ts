// CSP sweep (item 5 AC-5.3 and AC-5.8, automated in item 6, 03b §6.5). Every public page, at a
// phone and a desktop width, must load and be used with 0 Content-Security-Policy violations.
// Imports follow the CSP-path rule (03b §6.4): the guard and mocks only, never the stack config.

import type { Page } from '@playwright/test';
import { test, expect } from '../src/fixtures/hosted-guard.js';
import { mockKit, mockLeads } from '../src/mocks/public-services.js';
import { mockWeb3Forms } from '../src/mocks/web3forms.js';

interface CspViolation {
  directive: string;
  blockedURI: string;
}

declare global {
  interface Window {
    __cspViolations: CspViolation[];
  }
}

// The Lighthouse page set (lighthouserc.json) plus the other public page types.
const PAGES = [
  '/',
  '/programmes/vce',
  '/programmes/selective-entry',
  '/resources',
  '/resources/victorian-selective-entry-exam',
  '/privacy',
  '/posts',
  '/subscribed',
  '/nope',
];

const VIEWPORTS = [
  { name: 'phone', width: 360, height: 740 },
  { name: 'desktop', width: 1280, height: 800 },
];

/** Records every violation from before the first page script runs. */
async function listenForViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push({
        directive: event.effectiveDirective,
        blockedURI: event.blockedURI,
      });
    });
  });
}

function violations(page: Page): Promise<CspViolation[]> {
  return page.evaluate(() => window.__cspViolations);
}

async function toggleTheMenu(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: /open menu/i });
  await button.click();
  await expect(page.getByRole('button', { name: /close menu/i })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByRole('button', { name: /close menu/i }).click();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
}

// The contact form's change handler can drop a value typed too quickly after another (see
// tests/register-interest.spec.ts), so fill until all three stick.
async function sendEnquiry(page: Page): Promise<void> {
  const values = { name: 'CSP sweep', email: 'csp-sweep@example.test', message: 'CSP sweep.' };
  await expect(async () => {
    for (const [field, value] of Object.entries(values)) {
      await page.locator(`#contact-${field}`).fill(value);
    }
    for (const [field, value] of Object.entries(values)) {
      await expect(page.locator(`#contact-${field}`)).toHaveValue(value, { timeout: 500 });
    }
  }).toPass({ timeout: 10_000 });
  await page.getByRole('button', { name: /register interest/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /thank you/i })).toBeVisible();
}

async function subscribe(page: Page): Promise<void> {
  await page.getByLabel(/parent or guardian email/i).fill('csp-sweep@example.test');
  await page.getByRole('button', { name: /^subscribe$/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /almost done/i })).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test.describe(`Public CSP at ${viewport.width}px (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const path of PAGES) {
      test(`${path} loads and is used with no CSP violations`, async ({ page }) => {
        await listenForViolations(page);
        const web3forms = await mockWeb3Forms(page);
        const kit = await mockKit(page);
        await mockLeads(page);

        await page.goto(path);
        await page.waitForLoadState('networkidle');

        if (viewport.name === 'phone') {
          await toggleTheMenu(page);
        }
        if (path === '/') {
          await sendEnquiry(page);
          expect(web3forms.requests).toHaveLength(1);
        }
        // The gate build sets a placeholder Kit form, so the footer form shows on every page.
        await subscribe(page);
        expect(kit.requests).toHaveLength(1);

        expect(await violations(page)).toEqual([]);
      });
    }
  });
}

test('a script from an origin outside the policy is blocked and reported (AC-5.8)', async ({
  page,
}) => {
  await listenForViolations(page);
  const reachedNetwork: string[] = [];
  await page.route('https://example.com/**', (route) => {
    reachedNetwork.push(route.request().url());
    return route.abort();
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.addScriptTag({ url: 'https://example.com/x.js' })).rejects.toThrow();

  await expect.poll(() => violations(page)).toHaveLength(1);
  expect((await violations(page))[0]?.directive).toBe('script-src-elem');
  expect(reachedNetwork).toEqual([]);
});
