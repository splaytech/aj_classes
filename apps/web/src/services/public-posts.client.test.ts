import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkPublishedPosts, fetchPublicPosts } from './public-posts.client';
import { hasPublicSupabaseConfig } from './public-supabase-config';
import type { PublicSupabaseConfig } from './public-supabase-config';

const CONFIG: PublicSupabaseConfig = { url: 'http://db.test', publishableKey: 'sb_publishable_x' };
const UNCONFIGURED: PublicSupabaseConfig = { url: '', publishableKey: '' };

const ROW = {
  id: 'p1',
  created_at: '2026-10-20T01:00:00Z',
  title: 'Term 4 starts',
  body: 'Classes resume on Monday.',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** A fetch that never answers on its own; it only rejects when its signal aborts. */
function hangingFetch(): typeof fetch {
  return vi.fn(
    (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      }),
  ) as unknown as typeof fetch;
}

/** Fake timers don't reach the browser's own AbortSignal.timeout, so swap in one built on
 *  setTimeout (which they do reach) and check the code asks for 5 seconds. */
function useFakeTimeoutSignal() {
  vi.useFakeTimers();
  return vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms);
    return controller.signal;
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('hasPublicSupabaseConfig (shared with the sitemap)', () => {
  it('needs both the URL and the publishable key', () => {
    expect(hasPublicSupabaseConfig(CONFIG)).toBe(true);
    expect(hasPublicSupabaseConfig({ ...CONFIG, publishableKey: '' })).toBe(false);
    expect(hasPublicSupabaseConfig({ ...CONFIG, url: '' })).toBe(false);
    expect(hasPublicSupabaseConfig(UNCONFIGURED)).toBe(false);
  });
});

describe('checkPublishedPosts', () => {
  it('is true when at least one post exists', async () => {
    const fetcher = vi.fn(async () => jsonResponse([{ id: 'p1' }]));
    expect(await checkPublishedPosts(CONFIG, fetcher)).toBe(true);
  });

  it('asks for one id only, with the publishable key and no Authorization header', async () => {
    const fetcher = vi.fn(async () => jsonResponse([{ id: 'p1' }]));
    await checkPublishedPosts(CONFIG, fetcher);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://db.test/rest/v1/posts?select=id&limit=1');
    expect(init.headers).toEqual({ apikey: CONFIG.publishableKey });
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('is false when there are no posts', async () => {
    const fetcher = vi.fn(async () => jsonResponse([]));
    expect(await checkPublishedPosts(CONFIG, fetcher)).toBe(false);
  });

  it('is false when the request fails (AC-1.7)', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await checkPublishedPosts(CONFIG, fetcher)).toBe(false);
  });

  it('is false on a server error (AC-1.7)', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ message: 'down' }, 500));
    expect(await checkPublishedPosts(CONFIG, fetcher)).toBe(false);
  });

  it('is false on a reply that is not JSON', async () => {
    const fetcher = vi.fn(async () => new Response('<html>', { status: 200 }));
    expect(await checkPublishedPosts(CONFIG, fetcher)).toBe(false);
  });

  it('gives up after 5 seconds and is false (AC-1.7)', async () => {
    const timeout = useFakeTimeoutSignal();
    const pending = checkPublishedPosts(CONFIG, hangingFetch());
    await vi.advanceTimersByTimeAsync(5001);
    expect(timeout).toHaveBeenCalledWith(5000);
    expect(await pending).toBe(false);
  });

  it('makes no request when only the URL is set', async () => {
    const fetcher = vi.fn(async () => jsonResponse([{ id: 'p1' }]));
    expect(await checkPublishedPosts({ ...CONFIG, publishableKey: '' }, fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('makes no request when Supabase is not configured (AC-1.11)', async () => {
    const fetcher = vi.fn(async () => jsonResponse([{ id: 'p1' }]));
    expect(await checkPublishedPosts(UNCONFIGURED, fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('fetchPublicPosts', () => {
  it('returns posts newest first, mapped to Post', async () => {
    const fetcher = vi.fn(async () => jsonResponse([ROW]));
    const result = await fetchPublicPosts(CONFIG, fetcher);
    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'p1',
          publishedAt: ROW.created_at,
          title: ROW.title,
          body: ROW.body,
        },
      ],
    });
    const [url] = fetcher.mock.calls[0] as unknown as [string];
    expect(url).toBe(
      'http://db.test/rest/v1/posts?select=id,created_at,title,body&order=created_at.desc&limit=200',
    );
  });

  it('fails with network when the request fails (AC-1.7)', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await fetchPublicPosts(CONFIG, fetcher)).toEqual({ ok: false, error: 'network' });
  });

  it('fails with network on a server error (AC-1.7)', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ message: 'down' }, 500));
    expect(await fetchPublicPosts(CONFIG, fetcher)).toEqual({ ok: false, error: 'network' });
  });

  it('fails with network after the 5 second timeout (AC-1.7)', async () => {
    const timeout = useFakeTimeoutSignal();
    const pending = fetchPublicPosts(CONFIG, hangingFetch());
    await vi.advanceTimersByTimeAsync(5001);
    expect(timeout).toHaveBeenCalledWith(5000);
    expect(await pending).toEqual({ ok: false, error: 'network' });
  });

  it('fails with notConfigured and makes no request without Supabase', async () => {
    const fetcher = vi.fn(async () => jsonResponse([ROW]));
    expect(await fetchPublicPosts(UNCONFIGURED, fetcher)).toEqual({
      ok: false,
      error: 'notConfigured',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('hasPublishedPosts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('@/constants');
    vi.resetModules();
  });

  it('shares one request between every caller on a page load (AC-1.10)', async () => {
    vi.resetModules();
    vi.doMock('@/constants', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/constants')>();
      return {
        ...actual,
        APP_CONFIG: {
          ...actual.APP_CONFIG,
          supabase: { ...actual.APP_CONFIG.supabase, ...CONFIG },
        },
      };
    });
    const fetcher = vi.fn(async () => jsonResponse([{ id: 'p1' }]));
    vi.stubGlobal('fetch', fetcher);

    const { hasPublishedPosts } = await import('./public-posts.client');
    const [first, second] = await Promise.all([hasPublishedPosts(), hasPublishedPosts()]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
