// account-admin: the account actions that need the secret key (R2a design §10, R3b design §5).
// Renamed from staff-admin when student and parent invites were added.
// POST { action, ...input } with the admin's own session token.
//
// Every request: CORS for the site's origins only → POST only → caller must be an active admin
// with two-step (checked by the database) → input checks in each action.

import { requireActiveAdmin } from '../_shared/auth.ts';
import type { Caller } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { fail, respond } from '../_shared/responses.ts';
import type { ActionResult } from '../_shared/responses.ts';

import { cancelInvite } from './handlers/cancel-invite.ts';
import { invite } from './handlers/invite.ts';
import { inviteParent } from './handlers/invite-parent.ts';
import { inviteStudent } from './handlers/invite-student.ts';
import { resendInvite } from './handlers/resend-invite.ts';
import { resetTwoStep } from './handlers/reset-two-step.ts';
import { setActive } from './handlers/set-active.ts';

type Action = (input: Record<string, unknown>, caller: Caller) => Promise<ActionResult>;

const ACTIONS: Record<string, Action> = {
  invite,
  'resend-invite': resendInvite,
  'cancel-invite': cancelInvite,
  'set-active': setActive,
  'reset-two-step': resetTwoStep,
  'invite-student': inviteStudent,
  'invite-parent': inviteParent,
};

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') return respond(fail('method_not_allowed'), origin, 405);

  const caller = await requireActiveAdmin(request);
  if (!caller) return respond(fail('not_admin'), origin, 403);

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return respond(fail('invalid_request'), origin, 400);
  }

  const action = typeof input?.action === 'string' ? ACTIONS[input.action] : undefined;
  if (!action) return respond(fail('invalid_request'), origin, 400);

  try {
    return respond(await action(input, caller), origin);
  } catch (error) {
    console.error(
      'account-admin failed',
      input.action,
      error instanceof Error ? error.name : 'unknown',
    );
    return respond(fail('server_error'), origin, 500);
  }
});
