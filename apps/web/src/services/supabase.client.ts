// The ONLY place the Supabase client is created (PRP R2 service-layer rule).
//
// The client is created on first use and supabase-js is loaded with a dynamic import, so:
//   - public pages never download it (they only use the Web3Forms services), and
//   - pre-rendering the public site never needs the Supabase settings (design §11.4, G23).

import type { SupabaseClient } from '@supabase/supabase-js';

import { APP_CONFIG } from '@/constants';

import type { Database } from './database.types';

let client: SupabaseClient<Database> | null = null;

/**
 * The key supabase-js keeps the session under. It's the library's own default
 * (`sb-<first part of the host>-auth-token`), pinned here so clearStoredSession can find it, and
 * so a library change can't move it and sign everyone out.
 */
export function sessionStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

export async function getSupabase(): Promise<SupabaseClient<Database>> {
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient<Database>(APP_CONFIG.supabase.url, APP_CONFIG.supabase.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Email links are handled by /portal/auth/confirm with a Continue button (design §9.1).
        detectSessionInUrl: false,
        storageKey: sessionStorageKey(APP_CONFIG.supabase.url),
      },
    });
  }
  return client;
}

export function isPortalConfigured(): boolean {
  return APP_CONFIG.features.portal;
}

/**
 * Removes this device's stored session, and the user and code-verifier copies supabase-js keeps
 * beside it, without calling the server. Only for a session the server already refuses (see
 * forgetDeactivatedSession in auth.service.ts). Returns whether anything was there.
 */
export function clearStoredSession(): boolean {
  const key = sessionStorageKey(APP_CONFIG.supabase.url);
  const stored = Object.keys(window.localStorage).filter((name) => name.startsWith(key));
  for (const name of stored) window.localStorage.removeItem(name);
  return stored.length > 0;
}
