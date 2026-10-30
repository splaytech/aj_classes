// invite-redeem (ADR-0010): the signed-out person on /portal/invite swaps their invite token for a
// one-time Supabase recovery token, which the browser verifies straight away to sign in.
// The gateway doesn't check a token (config.toml); only the site's origins may call, and each
// address gets 10 claims per 15 minutes (counted in SQL).
//   204 OPTIONS · 405 not POST · 403 other origin · 400 body not JSON
//   200 { ok: true, data: { tokenHash } }
//   200 { ok: false, code: 'invite_invalid' } for every refusal, byte for byte the same (AC 11)
//   500 { ok: false, code: 'server_error' } when the database or Auth fails (the claim is released)

import { hashClientAddress } from '../_shared/client-address.ts';
import { serviceClient } from '../_shared/clients.ts';
import { corsHeaders, isAllowedOrigin } from '../_shared/cors.ts';
import { fail, respond, succeed } from '../_shared/responses.ts';

import { logRedeemOutcome, redeemInvite } from './redeem.ts';
import type { RecoveryLink, RedeemSteps } from './redeem.ts';

type AuthError = { status?: number; code?: string } | null;

const isNotFound = (error: AuthError) => error?.status === 404 || error?.code === 'user_not_found';

function realSteps(request: Request): RedeemSteps {
  const service = serviceClient();
  return {
    claim: async (hash) => {
      const { data, error } = await service.rpc('invite_token_claim', {
        hash,
        client_ip_hash: await hashClientAddress(request),
      });
      if (error?.message === 'rate_limited') return 'rate_limited';
      if (error) throw error;
      return data;
    },
    release: async (hash) => {
      const { error } = await service.rpc('invite_token_release', { hash });
      if (error) throw error;
    },
    emailOf: async (profileId) => {
      const { data, error } = await service.auth.admin.getUserById(profileId);
      if (isNotFound(error)) return null;
      if (error) throw error;
      return data.user.email ?? null;
    },
    recoveryLink: async (email): Promise<RecoveryLink | null> => {
      const { data, error } = await service.auth.admin.generateLink({ type: 'recovery', email });
      if (isNotFound(error)) return null;
      if (error) throw error;
      // action_link and email_otp are never read: only the hashed token goes back to the browser.
      return {
        userId: data.user.id,
        verificationType: data.properties.verification_type,
        hashedToken: data.properties.hashed_token,
      };
    },
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') return respond(fail('method_not_allowed'), origin, 405);
  if (!isAllowedOrigin(origin)) return respond(fail('forbidden'), origin, 403);

  let input: Record<string, unknown> | null;
  try {
    input = await request.json();
  } catch {
    return respond(fail('invalid_request'), origin, 400);
  }

  try {
    const outcome = await redeemInvite(input?.token, realSteps(request));
    logRedeemOutcome(outcome);
    if (outcome.kind === 'ok') return respond(succeed({ tokenHash: outcome.tokenHash }), origin);
    return respond(fail('invite_invalid'), origin);
  } catch (error) {
    console.error('invite-redeem failed', error instanceof Error ? error.name : 'unknown');
    return respond(fail('server_error'), origin, 500);
  }
});
