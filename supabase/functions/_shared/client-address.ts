// A salted SHA-256 of the caller's address, for rate limits (leads, invite-redeem). Only the hash
// is ever stored. The key is the leftmost x-forwarded-for entry, which a caller can spoof; that
// trust caveat is accepted (02-architecture §3.3 of the invite delivery). Deno only (Deno.env).

import { sha256Hex } from './sha256.ts';

const SALT = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''; // secret, never stored with the hash

export function hashClientAddress(request: Request): Promise<string> {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const address = forwarded.split(',')[0].trim() || 'unknown';
  return sha256Hex(`${SALT}:${address}`);
}
