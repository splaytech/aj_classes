// notifications: sends queued portal emails (ADR-0004, ADR-0008; design 03 §3.4, 03b §8.4).
// Called only by pg_cron's kick through pg_net, every 5 minutes when rows are waiting, with the
// shared secret header. The gateway doesn't check a token (config.toml); the secret check is here.
//   200 ran (counts) · 405 not POST · 401 wrong or unset secret
//   503 no usable EMAIL_TRANSPORT (checked before the secret: the kill switch), no SITE_URL, or
//       local-only values on the hosted project (config.ts gateRequest): rows are flagged
//       "Set-up error" and nothing is claimed
//   500 anything thrown (claimed rows are reclaimed by the next kicks)

import { serviceClient } from '../_shared/clients.ts';
import { fail, respond, succeed } from '../_shared/responses.ts';

import { processBatch } from './batch.ts';
import { claimRows } from './claim.ts';
import { gateRequest } from './config.ts';
import { renderEmail } from './template.ts';
import { pickTransport, sendEmail } from '../_shared/email/transport.ts';
import type { SendOutcome } from '../_shared/email/transport.ts';

const GAP_BETWEEN_SENDS_MS = 600; // Resend's default limit is 2 requests a second

const env = (name: string) => Deno.env.get(name);
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, GAP_BETWEEN_SENDS_MS));

Deno.serve(async (request) => {
  if (request.method !== 'POST') return respond(fail('method_not_allowed'), null, 405);

  const transport = pickTransport(env);
  const siteUrl = env('SITE_URL') ?? '';
  const gate = gateRequest(
    {
      transport,
      workerSecret: env('NOTIFY_WORKER_SECRET'),
      siteUrl,
      supabaseUrl: env('SUPABASE_URL'),
    },
    request.headers.get('x-notify-secret'),
  );
  if (gate === 'not_allowed') return respond(fail('not_allowed'), null, 401);

  try {
    const service = serviceClient();
    if (gate === 'config_missing' || transport === null) {
      const { error } = await service.rpc('notify_flag_config_missing');
      if (error) throw error;
      console.error('notifications config missing');
      return respond(fail('config_missing'), null, 503);
    }

    // Only the kinds this worker can render (ADR-0008 decision 6). If this function was deployed
    // before migration 20261029100000, claimRows falls back to the old claim (work returned only).
    const { rows, usedOldClaim } = await claimRows((args) =>
      service.rpc('notify_claim_emails', args),
    );
    if (usedOldClaim) console.warn('notifications claim: old database, work returned only');

    const record = async (outboxId: string, outcome: SendOutcome) => {
      const { error: recordError } = await service.rpc('notify_record_result', {
        target: outboxId,
        outcome: outcome.outcome,
        failure_reason: outcome.outcome === 'sent' ? null : outcome.reason,
      });
      if (recordError) throw recordError;
    };

    const counts = await processBatch(rows, {
      render: (row) => renderEmail(row, siteUrl),
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
