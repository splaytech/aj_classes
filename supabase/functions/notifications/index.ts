// notifications: sends queued "work returned" emails (ADR-0004; design 03 §3.4).
// Called only by pg_cron's kick through pg_net, every 5 minutes when rows are waiting, with the
// shared secret header. The gateway doesn't check a token (config.toml); the secret check is here.
//   200 ran (counts) · 401 wrong or unset secret · 405 not POST
//   503 no usable EMAIL_TRANSPORT or SITE_URL, or local-only values on a non-Mailpit transport:
//       rows are flagged "Set-up error" and nothing is claimed
//   500 anything thrown (claimed rows are reclaimed by the next kicks)

import { serviceClient } from '../_shared/clients.ts';
import { fail, respond, succeed } from '../_shared/responses.ts';

import { processBatch } from './batch.ts';
import { isUsableConfig } from './config.ts';
import { secretMatches } from './secret.ts';
import { renderWorkReturned } from './template.ts';
import type { ClaimedRow } from './template.ts';
import { pickTransport, sendEmail } from './transport.ts';
import type { SendOutcome } from './transport.ts';

const GAP_BETWEEN_SENDS_MS = 600; // Resend's default limit is 2 requests a second

const env = (name: string) => Deno.env.get(name);
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, GAP_BETWEEN_SENDS_MS));

Deno.serve(async (request) => {
  if (request.method !== 'POST') return respond(fail('method_not_allowed'), null, 405);
  if (!secretMatches(request.headers.get('x-notify-secret'), env('NOTIFY_WORKER_SECRET'))) {
    return respond(fail('not_allowed'), null, 401);
  }

  try {
    const service = serviceClient();
    const transport = pickTransport(env);
    const siteUrl = env('SITE_URL') ?? '';
    if (!isUsableConfig(transport, env('NOTIFY_WORKER_SECRET'), siteUrl)) {
      const { error } = await service.rpc('notify_flag_config_missing');
      if (error) throw error;
      console.error('notifications config missing');
      return respond(fail('config_missing'), null, 503);
    }

    const { data, error } = await service.rpc('notify_claim_emails');
    if (error) throw error;

    const record = async (outboxId: string, outcome: SendOutcome) => {
      const { error: recordError } = await service.rpc('notify_record_result', {
        target: outboxId,
        outcome: outcome.outcome,
        failure_reason: outcome.outcome === 'sent' ? null : outcome.reason,
      });
      if (recordError) throw recordError;
    };

    const counts = await processBatch((data ?? []) as ClaimedRow[], {
      render: (row) => renderWorkReturned(row, siteUrl),
      send: (message, outboxId) => sendEmail(transport, message, outboxId),
      record,
      pause,
    });
    console.info('notifications batch', JSON.stringify(counts));
    return respond(succeed(counts), null);
  } catch (error) {
    console.error('notifications failed', error instanceof Error ? error.name : 'unknown');
    return respond(fail('server_error'), null, 500);
  }
});
