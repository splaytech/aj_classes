// Mocks for the public pages' other outbound services, used by the CSP sweep (03b §6.4), so no
// real Kit subscription or Zoho lead is ever created. Imports only Playwright types: the sweep
// runs without the E2E stack env.

import type { Page } from '@playwright/test';

export interface MockCapture {
  /** URLs the page sent to the mocked service. */
  requests: string[];
}

async function fulfilWithJson(page: Page, url: string, body: unknown): Promise<MockCapture> {
  const capture: MockCapture = { requests: [] };
  await page.route(url, async (route) => {
    capture.requests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  return capture;
}

/** The footer newsletter form posts to Kit (formerly ConvertKit). */
export function mockKit(page: Page): Promise<MockCapture> {
  return fulfilWithJson(page, 'https://app.convertkit.com/**', { status: 'success' });
}

/** The enquiry form also posts to the `leads` function when lead capture is on. */
export function mockLeads(page: Page): Promise<MockCapture> {
  return fulfilWithJson(page, '**/functions/v1/leads', { ok: true });
}
