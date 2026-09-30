import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContactFormValues } from '@/lib/validation';

const values: ContactFormValues = {
  name: 'Priya Sharma',
  email: ' priya@example.com ',
  phone: '',
  contactMethod: 'email',
  role: 'parent',
  enquiryType: 'registerInterest',
  yearLevel: 'Year 6',
  message: '',
  updatesConsent: false,
};

/** Loads the service fresh, so it picks up the test access key from the environment. */
async function loadService() {
  vi.resetModules();
  return import('./enquiry.service');
}

/** The JSON body of the (mocked) request sent to Web3Forms. */
function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
  const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(request.body as string);
}

describe('submitEnquiry', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('VITE_FORM_ACCESS_KEY', 'test-key');
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sets Reply-To to the family, so replying from our inbox reaches them', async () => {
    const { submitEnquiry } = await loadService();
    await submitEnquiry(values, 'captcha-token');

    expect(sentBody(fetchMock).replyto).toBe('priya@example.com');
  });

  it('sends the access key, subject and sender name', async () => {
    const { submitEnquiry } = await loadService();
    await submitEnquiry(values, 'captcha-token');

    const body = sentBody(fetchMock);
    expect(body.access_key).toBe('test-key');
    expect(body.subject).toBe('[AJ Classes] Register interest for enrolment — Priya Sharma');
    expect(body.from_name).toBe('AJ Classes Website');
  });

  it('sends the hCaptcha token in the field Web3Forms expects', async () => {
    const { submitEnquiry } = await loadService();
    await submitEnquiry(values, 'captcha-token');

    expect(sentBody(fetchMock)['h-captcha-response']).toBe('captcha-token');
  });

  it('reports "error" when the form service is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const { submitEnquiry } = await loadService();

    expect(await submitEnquiry(values, 'captcha-token')).toBe('error');
  });

  it('reports "not-configured" when there is no access key', async () => {
    vi.stubEnv('VITE_FORM_ACCESS_KEY', '');
    const { submitEnquiry } = await loadService();

    expect(await submitEnquiry(values, 'captcha-token')).toBe('not-configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
