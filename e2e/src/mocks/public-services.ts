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

// The local stack's API, which the mirror's CSP allows (apps/web/scripts/hosting-constants.ts
// LOCAL_SUPABASE_ORIGIN; e2e imports nothing from apps/web). Only this origin is mocked: a page
// route wins over the hosted guard's context route, so a wildcard would hide a hosted call.
const LOCAL_LEADS_URL = 'http://127.0.0.1:55321/functions/v1/leads';

/** The enquiry form also posts to the local `leads` function when lead capture is on. */
export function mockLeads(page: Page): Promise<MockCapture> {
  return fulfilWithJson(page, LOCAL_LEADS_URL, { ok: true });
}
