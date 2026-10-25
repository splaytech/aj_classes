// The ONLY place the Supabase client is created (PRP R2 service-layer rule).
//
// The client is created on first use and supabase-js is loaded with a dynamic import, so:
//   - public pages never download it (they only use the Web3Forms services), and
//   - pre-rendering the public site never needs the Supabase settings (design §11.4, G23).

import type { SupabaseClient } from '@supabase/supabase-js';

import { APP_CONFIG } from '@/constants';

import type { Database } from './database.types';

let client: SupabaseClient<Database> | null = null;

export async function getSupabase(): Promise<SupabaseClient<Database>> {
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient<Database>(APP_CONFIG.supabase.url, APP_CONFIG.supabase.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Email links are handled by /portal/auth/confirm with a Continue button (design §9.1).
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/**
 * The client, or null when nobody is signed in. It reads the stored session only (no request).
 * Page loaders run alongside the layout's sign-in check, so the family reads use this: a
 * signed-out email link then makes no database call before the redirect to sign-in (BUG-6).
 */
export async function getSignedInSupabase(): Promise<SupabaseClient<Database> | null> {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session ? supabase : null;
}

export function isPortalConfigured(): boolean {
  return APP_CONFIG.features.portal;
}
