// Refuses hosted settings that only make sense locally (Security item 3, finding 2). A manual
// `supabase secrets set` copies config.toml's local values to the hosted project, including the
// worker secret that is public in the repo. Outside Mailpit, that secret or a non-https SITE_URL
// counts as a set-up error: nothing is claimed or sent, and admins see "Set-up error".

import type { Transport } from './transport.ts';

// Must match NOTIFY_WORKER_SECRET in supabase/config.toml [edge_runtime.secrets] (local only).
export const LOCAL_WORKER_SECRET = 'local-notify-secret';

export function isUsableConfig(
  transport: Transport | null,
  workerSecret: string | undefined,
  siteUrl: string,
): transport is Transport {
  if (transport === null || siteUrl === '') return false;
  if (transport.kind === 'mailpit') return true;
  return workerSecret !== LOCAL_WORKER_SECRET && siteUrl.startsWith('https://');
}
