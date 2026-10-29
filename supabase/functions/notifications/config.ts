// Refuses local-only settings on the hosted project (Security item 3 finding 2, review-5 R2-1).
// A manual `supabase secrets set` copies config.toml's [edge_runtime.secrets] to hosted: the
// worker secret that is public in the repo, EMAIL_TRANSPORT=mailpit and a localhost SITE_URL.
// On hosted, any one of those is a set-up error: the worker claims and sends nothing, returns 503
// and admins see "Set-up error". Locally, Mailpit, the local secret and http://localhost are fine.
// The email half of the rule is shared with invites (_shared/email/config.ts); the worker secret
// half is the worker's own.

import { isHostedProject, isSafeEmailConfig } from '../_shared/email/config.ts';
import type { EmailConfig } from '../_shared/email/config.ts';
import { secretMatches } from './secret.ts';

// Must match NOTIFY_WORKER_SECRET in supabase/config.toml [edge_runtime.secrets] (local only).
export const LOCAL_WORKER_SECRET = 'local-notify-secret';

export type WorkerConfig = EmailConfig & { workerSecret: string | undefined };

export function isUsableConfig(config: WorkerConfig): boolean {
  return (
    isSafeEmailConfig(config) &&
    (!isHostedProject(config.supabaseUrl) || config.workerSecret !== LOCAL_WORKER_SECRET)
  );
}

export type Gate = 'config_missing' | 'not_allowed' | 'ok';

/**
 * What the worker does with one request, in this order:
 *   1. No usable EMAIL_TRANSPORT (unset, unknown or missing its key/URL): 'config_missing',
 *      before the secret check. This is the README kill switch, so rows always show as
 *      "Set-up error" and never sit as "Not attempted" behind a 401. A caller without the secret
 *      learns only that sending is off, and can't make anything send.
 *   2. Wrong, missing or unset worker secret: 'not_allowed' (401).
 *   3. Local-only values on hosted, or no SITE_URL: 'config_missing' (503).
 */
export function gateRequest(config: WorkerConfig, givenSecret: string | null): Gate {
  if (config.transport === null) return 'config_missing';
  if (!secretMatches(givenSecret, config.workerSecret)) return 'not_allowed';
  return isUsableConfig(config) ? 'ok' : 'config_missing';
}
