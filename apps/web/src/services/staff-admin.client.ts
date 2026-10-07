// Calls the staff-admin edge function (R2a design §10). The signed-in admin's session token is
// sent automatically; the function checks they are an active admin with two-step.

import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { getSupabase } from './supabase.client';
import type { Result } from './types';

const FUNCTION_NAME = 'staff-admin';

type FunctionReply = { ok: true; data: Record<string, unknown> } | { ok: false; code: string };

export async function callStaffAdmin(
  action: string,
  input: Record<string, unknown>,
): Promise<Result<Record<string, unknown>>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.functions.invoke<FunctionReply>(FUNCTION_NAME, {
      body: { action, ...input },
    });

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
