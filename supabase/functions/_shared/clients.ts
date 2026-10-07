// Supabase clients for edge functions.
//   callerClient: acts as the signed-in person (their JWT), so the database's own rules apply.
//   serviceClient: the secret key, for the few things only the server may do (invites, bans).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const PUBLIC_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SECRET_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const NO_SESSION = { persistSession: false, autoRefreshToken: false };

export function callerClient(authorization: string): SupabaseClient {
  return createClient(SUPABASE_URL, PUBLIC_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: NO_SESSION,
  });
}

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SECRET_KEY, { auth: NO_SESSION });
}

export type { SupabaseClient };
