// Claims the rows this worker will send (ADR-0008 decision 6, Security item 8 S2). The claim call
// is passed in, so the Node test script can run it without Deno or a database.
//   * Normal: notify_claim_emails(supported_kinds) with every kind this worker can render.
//   * The function was deployed before migration 20261029100000 (the unsafe order): that call
//     gets PGRST202. Retry once with no argument, the old database's claim, so "work returned"
//     keeps sending. That claim only knows work_returned and returns no kind or due date, so each
//     row is marked work_returned and rendered as such.

import { EMAIL_KINDS } from './copy.ts';
import type { ClaimedRow } from './template.ts';

type RpcError = { code?: string };
type RpcReply = { data: unknown; error: RpcError | null };
export type ClaimCall = (args?: { supported_kinds: string[] }) => PromiseLike<RpcReply>;

const FUNCTION_NOT_FOUND = 'PGRST202'; // PostgREST: no function with these argument names

export type ClaimResult = { rows: ClaimedRow[]; usedOldClaim: boolean };

export async function claimRows(claim: ClaimCall): Promise<ClaimResult> {
  const reply = await claim({ supported_kinds: [...EMAIL_KINDS] });
  if (reply.error?.code !== FUNCTION_NOT_FOUND) {
    if (reply.error) throw reply.error;
    return { rows: (reply.data ?? []) as ClaimedRow[], usedOldClaim: false };
  }

  const old = await claim();
  if (old.error) throw old.error;
  const rows = ((old.data ?? []) as Omit<ClaimedRow, 'kind' | 'due_on'>[]).map(
    (row): ClaimedRow => ({ ...row, kind: 'work_returned', due_on: null }),
  );
  return { rows, usedOldClaim: true };
}
