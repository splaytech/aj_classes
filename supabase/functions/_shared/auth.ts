// Who is calling? Only an active admin with a two-step session gets through (R2a design §10).
// The database decides (am_i_admin checks active + admin + aal2), so the rule lives in one place.

import { callerClient } from './clients.ts';
import type { SupabaseClient } from './clients.ts';

export type Caller = {
  id: string;
  client: SupabaseClient; // acts as the caller
};

export async function requireActiveAdmin(request: Request): Promise<Caller | null> {
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return null;

  const client = callerClient(authorization);
  const { data: claimsData, error: claimsError } = await client.auth.getClaims(
    authorization.slice('Bearer '.length),
  );
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return null;

  const { data: isAdmin, error } = await client.rpc('am_i_admin');
  if (error || isAdmin !== true) return null;

  return { id: userId, client };
}
