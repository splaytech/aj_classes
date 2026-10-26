import type { Page } from '@playwright/test';

const WEB3FORMS_URL = 'https://api.web3forms.com/submit';

export interface Web3FormsRequest {
  body: Record<string, unknown>;
}

export interface MockWeb3FormsOptions {
  response?: { success: boolean; message: string };
}

export interface Web3FormsCapture {
  requests: Web3FormsRequest[];
}

/**
 * Intercepts the outbound Web3Forms submission so no real third-party call
 * or email is ever sent. Captures each request body so specs can assert what
 * the UI would have sent.
 */
export async function mockWeb3Forms(
  page: Page,
  options: MockWeb3FormsOptions = {},
): Promise<Web3FormsCapture> {
  const capture: Web3FormsCapture = { requests: [] };
  const response = options.response ?? { success: true, message: 'Email sent successfully' };

  await page.route(WEB3FORMS_URL, async (route) => {
    const request = route.request();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(request.postData() ?? '{}');
    } catch {
      body = {};
    }
    capture.requests.push({ body });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });

  return capture;
}
