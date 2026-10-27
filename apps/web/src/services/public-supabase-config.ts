// When this build can read public data (news) from Supabase: it needs both the URL and the
// publishable key. Shared by the news reads and the sitemap so the two can never disagree.
// Not a `.client.ts` file on purpose: the sitemap runs at build time on the server, where
// React Router empties every `.client` module.

import { APP_CONFIG } from '@/constants';

export type PublicSupabaseConfig = { url: string; publishableKey: string };

export function hasPublicSupabaseConfig(config: PublicSupabaseConfig): boolean {
  return config.url !== '' && config.publishableKey !== '';
}

export function publicSupabaseConfig(): PublicSupabaseConfig {
  return { url: APP_CONFIG.supabase.url, publishableKey: APP_CONFIG.supabase.publishableKey };
}

/** True when this build can read news at all (used by the sitemap, AC-1.11). */
export function isPublicSupabaseConfigured(): boolean {
  return hasPublicSupabaseConfig(publicSupabaseConfig());
}
