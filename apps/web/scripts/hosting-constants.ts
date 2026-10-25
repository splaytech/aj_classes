// Hosting values shared by the mirror and hosted-ref tools and the CSP consistency test
// (ADR-0005, 03b §5.4). Plain constants, so Node can run these scripts without a build step.

/** The hosted Supabase origin. Must match the CSPs in vercel.json and serve.railway.json. */
export const HOSTED_SUPABASE_ORIGIN = 'https://unzjnxctkyahtmrkinyr.supabase.co';

/** The hosted project ref, which no gate build or committed test file may contain (AC-5.11). */
export const HOSTED_PROJECT_REF = new URL(HOSTED_SUPABASE_ORIGIN).hostname.split('.')[0] ?? '';

/** The local Supabase API. Must match the [api] port in supabase/config.toml. */
export const LOCAL_SUPABASE_ORIGIN = 'http://127.0.0.1:55321';

/**
 * Vercel source for the public CSP: every path except the portal and its fallback page. The
 * fallback is matched exactly (`$`): it has its own rule with the portal headers (security S1).
 */
export const PUBLIC_CSP_SOURCE = '/((?!portal(?:/|$)|__spa-fallback$).*)';

/** Port the local production mirror listens on. */
export const MIRROR_PORT = 4173;
