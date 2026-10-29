// Calls the account-admin edge function (R2a design §10, R3b §5; was staff-admin), the admin
// actions of the leads function, and invite-redeem (ADR-0010). The signed-in person's session
// token is sent automatically; account-admin checks they are an active admin with two-step.

import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type { Result } from './types';

const ACCOUNT_ADMIN = 'account-admin';

type FunctionReply = { ok: true; data: Record<string, unknown> } | { ok: false; code: string };

export async function callAccountAdmin(
  action: string,
  input: Record<string, unknown>,
): Promise<Result<Record<string, unknown>>> {
  return callEdgeFunction(ACCOUNT_ADMIN, action, input);
}

/** Calls one action of one of our edge functions; they all reply { ok, data | code }. */
export async function callEdgeFunction(
  functionName: string,
  action: string,
  input: Record<string, unknown>,
): Promise<Result<Record<string, unknown>>> {
  return invokeEdgeFunction(functionName, { action, ...input });
}

/** POSTs a body to one of our edge functions (signed in or not) and reads its { ok } reply. */
export async function invokeEdgeFunction(
  functionName: string,
  body: Record<string, unknown>,
): Promise<Result<Record<string, unknown>>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.functions.invoke<FunctionReply>(functionName, { body });

    // Non-2xx replies (403, 400…) come back as an error whose response holds our JSON body.
    const reply = data ?? (await replyFromError(error));
    if (!reply) return fail(toErrorKey(error));
    return reply.ok ? succeed(reply.data) : fail(toErrorKey({ code: reply.code }));
  });
}

async function replyFromError(error: unknown): Promise<FunctionReply | null> {
  const response = (error as { context?: Response } | null)?.context;
  if (!response || typeof response.json !== 'function') return null;
  try {
    return (await response.json()) as FunctionReply;
  } catch {
    return null;
  }
}
