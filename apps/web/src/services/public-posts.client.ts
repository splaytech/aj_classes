// Public news reads (/posts and the News link, ADR-0001). Plain fetch to the database's REST API
// with the publishable key, like leads.client.ts, so public pages never load supabase-js (AC-1.12).
// The publishable key isn't a JWT, so only the `apikey` header is sent, never `Authorization`.

import { APP_CONFIG } from '@/constants';

import { POST_COLUMNS, POSTS_MAX_ROWS, toPost } from './post-rows';
import type { PostRow } from './post-rows';
import { fail, succeed } from './result';
import type { Post, Result } from './types';

export type PublicSupabaseConfig = { url: string; publishableKey: string };

type Fetcher = typeof fetch;

/** Public reads need both the URL and the publishable key. The sitemap uses the same rule. */
export function hasPublicSupabaseConfig(config: PublicSupabaseConfig): boolean {
  return config.url !== '' && config.publishableKey !== '';
}

function getPublic(config: PublicSupabaseConfig, query: string, fetcher: Fetcher) {
  return fetcher(`${config.url}${APP_CONFIG.supabase.postsRestPath}?${query}`, {
    headers: { apikey: config.publishableKey },
    signal: AbortSignal.timeout(APP_CONFIG.supabase.publicReadTimeoutMs),
    cache: 'no-store', // a post published a minute ago must show on the next page load
  });
}

/** True only when at least one post exists. Any failure, timeout or missing config → false. */
export async function checkPublishedPosts(
  config: PublicSupabaseConfig,
  fetcher: Fetcher = fetch,
): Promise<boolean> {
  if (!hasPublicSupabaseConfig(config)) return false;
  try {
    const response = await getPublic(config, 'select=id&limit=1', fetcher);
    if (!response.ok) return false;
    const rows: unknown = await response.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false; // offline, timed out or bad JSON: the link stays hidden (AC-1.7)
  }
}

/** Newest first, at most POSTS_MAX_ROWS. Never throws. */
export async function fetchPublicPosts(
  config: PublicSupabaseConfig,
  fetcher: Fetcher = fetch,
): Promise<Result<Post[]>> {
  if (!hasPublicSupabaseConfig(config)) return fail('notConfigured');
  const columns = POST_COLUMNS.replace(/\s/g, '');
  const query = `select=${columns}&order=created_at.desc&limit=${POSTS_MAX_ROWS}`;
  try {
    const response = await getPublic(config, query, fetcher);
    if (!response.ok) return fail('network');
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return fail('network');
    return succeed((rows as PostRow[]).map(toPost));
  } catch {
    return fail('network');
  }
}

function publicConfig(): PublicSupabaseConfig {
  return { url: APP_CONFIG.supabase.url, publishableKey: APP_CONFIG.supabase.publishableKey };
}

/** True when this build can read news at all (used by the sitemap, AC-1.11). */
export function isPublicSupabaseConfigured(): boolean {
  return hasPublicSupabaseConfig(publicConfig());
}

// One check per page load, shared by the header and the footer. A full page load starts a new
// module, so deleting or publishing a post shows on the next load with no rebuild (AC-1.10).
let newsCheck: Promise<boolean> | null = null;

export function hasPublishedPosts(): Promise<boolean> {
  newsCheck ??= checkPublishedPosts(publicConfig());
  return newsCheck;
}

export function listPublicPosts(): Promise<Result<Post[]>> {
  return fetchPublicPosts(publicConfig());
}
