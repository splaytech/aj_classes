// Refuses local-only email settings on the hosted project (Security item 3 finding 2, review-5
// R2-1), for every function that sends email (notifications, and account-admin's invites).
// A manual `supabase secrets set` copies config.toml's [edge_runtime.secrets] to hosted:
// EMAIL_TRANSPORT=mailpit and a localhost SITE_URL. On hosted, either is a set-up error and
// nothing is sent. Locally, Mailpit and http://localhost are fine.
// Hosted vs local comes from the built-in SUPABASE_URL: hosted is https://<ref>.supabase.co, the
// local edge runtime gets http://kong:8000.

import type { Transport } from './transport.ts';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'kong']);

export type EmailConfig = {
  transport: Transport | null;
  siteUrl: string;
  supabaseUrl: string | undefined;
};

/** True unless SUPABASE_URL is a local address. Anything unreadable counts as hosted (fail safe). */
export function isHostedProject(supabaseUrl: string | undefined): boolean {
  try {
    const url = new URL(supabaseUrl ?? '');
    return url.protocol === 'https:' || !LOCAL_HOSTS.has(url.hostname);
  } catch {
    return true;
  }
}

/** False with no transport or no SITE_URL (the kill switch). Locally anything else is fine; on
 * hosted only a non-Mailpit transport with an https:// SITE_URL. */
export function isSafeEmailConfig(config: EmailConfig): boolean {
  if (config.transport === null || config.siteUrl === '') return false;
  if (!isHostedProject(config.supabaseUrl)) return true;
  return config.transport.kind !== 'mailpit' && config.siteUrl.startsWith('https://');
}
