// CORS for browser calls (R2a design §10). Only the site's own origins get CORS headers; other
// sites' pages can't read responses. Set ALLOWED_ORIGINS per environment (comma-separated):
// locally in supabase/config.toml [edge_runtime.secrets], hosted with `supabase secrets set`.

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin !== '');

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
