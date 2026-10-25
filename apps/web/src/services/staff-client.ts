// The client for an admin or staff-profile read, or null when the signed-in person isn't allowed
// it. Same reason as family-client.ts (BUG-6, BUG-9): page loaders run alongside the layouts'
// access check, so without this a tutor, parent or student opening an admin page, or a family
// member opening My profile, sends a request the database is bound to refuse or answer empty
// (item 4, Tester E-60). The role comes from getAccessState, which the layouts are reading at the
// same moment, so the right person pays no extra request.

import { isStaffRole } from '@/lib/portal-access';

import { getAccessState } from './auth.service';
import { getSupabase } from './supabase.client';

/** Admin pages need an admin with two-step, as the admin layout does. */
export async function getAdminClient() {
  const access = await getAccessState();
  if (access.profile?.role !== 'admin' || access.aal !== 'aal2') return null;
  return getSupabase();
}

/** A staff profile: your own as active staff (My profile), or anyone's as an admin with two-step. */
export async function getProfileClient(userId: string) {
  const access = await getAccessState();
  const role = access.profile?.role;
  if (!role || !isStaffRole(role)) return null;
  if (userId !== access.userId && !(role === 'admin' && access.aal === 'aal2')) return null;
  return getSupabase();
}
