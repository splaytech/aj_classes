// At most 5 enquiries an hour from one address (leads-and-crm.md G1). Only a salted SHA-256 of
// the address is stored, and only for an hour.

import { serviceClient } from '../_shared/clients.ts';

const MAX_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
const SALT = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''; // secret, never stored with the hash

async function hashAddress(request: Request): Promise<string> {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const address = forwarded.split(',')[0].trim() || 'unknown';
  const bytes = new TextEncoder().encode(`${SALT}:${address}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Records this request; false if the address has already sent too many this hour. */
export async function allowEnquiry(request: Request): Promise<boolean> {
  const service = serviceClient();
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const ipHash = await hashAddress(request);

  await service.from('enquiry_rate_limits').delete().lt('created_at', since);
  const { count, error } = await service
    .from('enquiry_rate_limits')
    .select('ip_hash', { count: 'exact', head: true })
    .eq('ip_hash', ipHash);
  if (error) throw error;
  if ((count ?? 0) >= MAX_PER_HOUR) return false;

  const { error: insertError } = await service
    .from('enquiry_rate_limits')
    .insert({ ip_hash: ipHash });
  if (insertError) throw insertError;
  return true;
}
