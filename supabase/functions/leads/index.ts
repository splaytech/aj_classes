// leads: website enquiries → database → Zoho CRM leads (leads-and-crm.md §3).
//   submit  — the public enquiry form (no sign-in). Only the site's own pages may call it.
//   resync  — an active admin with two-step retries Zoho CRM for one enquiry.
// The gateway doesn't check a token for this function (config.toml); resync checks it here.

import { isAllowedOrigin, corsHeaders } from '../_shared/cors.ts';
import { fail, respond } from '../_shared/responses.ts';

import { resync } from './resync.ts';
import { submit } from './submit.ts';

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') return respond(fail('method_not_allowed'), origin, 405);

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return respond(fail('invalid_request'), origin, 400);
  }

  try {
    if (input?.action === 'submit') {
      if (!isAllowedOrigin(origin)) return respond(fail('forbidden'), origin, 403);
      const { result, status } = await submit(input, request);
      return respond(result, origin, status);
    }
    if (input?.action === 'resync') {
      const { result, status } = await resync(input, request);
      return respond(result, origin, status);
    }
    return respond(fail('invalid_request'), origin, 400);
  } catch (error) {
    console.error('leads failed', input?.action, error instanceof Error ? error.name : 'unknown');
    return respond(fail('server_error'), origin, 500);
  }
});
