import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Loads the service fresh, so it picks up the test form ID from the environment. */
async function loadService() {
  vi.resetModules();
  return import('./subscription.service');
}

describe('subscribe', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('VITE_KIT_FORM_ID', '1234567');
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('posts the trimmed email to our Kit form', async () => {
    const { subscribe } = await loadService();
    const result = await subscribe('  parent@example.com ');

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://app.convertkit.com/forms/1234567/subscriptions');
    expect((request.body as FormData).get('email_address')).toBe('parent@example.com');
    expect(result).toBe('success');
  });

  it('reports "error" when Kit rejects the sign-up', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const { subscribe } = await loadService();

    expect(await subscribe('parent@example.com')).toBe('error');
  });

  it('reports "error" when Kit is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const { subscribe } = await loadService();

    expect(await subscribe('parent@example.com')).toBe('error');
  });

  it('reports "not-configured" and sends nothing without a form ID', async () => {
    vi.stubEnv('VITE_KIT_FORM_ID', '');
    const { subscribe } = await loadService();

    expect(await subscribe('parent@example.com')).toBe('not-configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
