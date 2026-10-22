import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContactFormValues } from '@/lib/validation';

const values: ContactFormValues = {
  name: 'Priya Sharma',
  email: ' priya@example.com ',
  phone: '',
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
    await submitEnquiry(values, false);

    expect(sentBody(fetchMock).replyto).toBe('priya@example.com');
  });

  it('sends the access key, subject and sender name', async () => {
    const { submitEnquiry } = await loadService();
    await submitEnquiry(values, false);

    const body = sentBody(fetchMock);
    expect(body.access_key).toBe('test-key');
    expect(body.subject).toBe('[AJ Classes] Website enquiry — Priya Sharma');
    expect(body.from_name).toBe('AJ Classes Website');
  });

  it('sends the spam-trap field Web3Forms checks (botcheck), unticked for people', async () => {
    const { submitEnquiry } = await loadService();
    await submitEnquiry(values, false);

    expect(sentBody(fetchMock).botcheck).toBe(false);
  });

  it('reports "error" when the form service is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const { submitEnquiry } = await loadService();

    expect(await submitEnquiry(values, false)).toBe('error');
  });

  it('reports "not-configured" when there is no access key', async () => {
    vi.stubEnv('VITE_FORM_ACCESS_KEY', '');
    const { submitEnquiry } = await loadService();

    expect(await submitEnquiry(values, false)).toBe('not-configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('submitEnquiry with lead capture (leads-and-crm.md §1)', () => {
  const LEADS_URL = 'https://project.supabase.co/functions/v1/leads';
  let fetchMock: ReturnType<typeof vi.fn>;

  const callTo = (url: string) =>
    fetchMock.mock.calls.find(([calledUrl]) => String(calledUrl).startsWith(url)) as
      [string, RequestInit] | undefined;

  beforeEach(() => {
    vi.stubEnv('VITE_FORM_ACCESS_KEY', 'test-key');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends only the email while lead capture is off', async () => {
    vi.stubEnv('VITE_LEAD_CAPTURE', '');
    const { submitEnquiry } = await loadService();
    await submitEnquiry(values, false);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(callTo(LEADS_URL)).toBeUndefined();
  });

  it('also sends the enquiry to the leads function when switched on', async () => {
    vi.stubEnv('VITE_LEAD_CAPTURE', 'on');
    const { submitEnquiry } = await loadService();
    await submitEnquiry({ ...values, phone: '0400 123 456', updatesConsent: true }, false);

    const call = callTo(LEADS_URL);
    expect(call).toBeDefined();
    const body = JSON.parse(call?.[1].body as string);
    expect(body).toMatchObject({
      action: 'submit',
      name: 'Priya Sharma',
      phone: '0400 123 456',
      wantsUpdates: true,
      botcheck: '',
    });
    expect((call?.[1].headers as Record<string, string>).apikey).toBe('sb_publishable_test');
  });

  it('passes a ticked spam trap on, so the function can drop it', async () => {
    vi.stubEnv('VITE_LEAD_CAPTURE', 'on');
    const { submitEnquiry } = await loadService();
    await submitEnquiry(values, true);

    expect(JSON.parse(callTo(LEADS_URL)?.[1].body as string).botcheck).not.toBe('');
  });

  it("never changes the parent's result when the leads call fails", async () => {
    vi.stubEnv('VITE_LEAD_CAPTURE', 'on');
    fetchMock.mockImplementation((url: string) =>
      url.startsWith(LEADS_URL)
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({ ok: true }),
    );
    const { submitEnquiry } = await loadService();

    expect(await submitEnquiry(values, false)).toBe('success');
  });
});
