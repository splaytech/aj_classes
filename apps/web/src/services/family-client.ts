// The client for a student or parent read, or null when the signed-in person doesn't have that
// role (or nobody is signed in). Page loaders run alongside the layouts' access check, so without
// this a signed-out visitor or the wrong role (a parent opening the student's email link, a tutor
// opening a parent's) sends an RPC the database is bound to refuse (BUG-6, BUG-9). The role
// comes from getAccessState, which the layouts are reading at the same moment, so the right role
// pays no extra request.

import type { AppRole } from '@/constants';

import { getAccessState } from './auth.service';
import { getSupabase } from './supabase.client';

export async function getFamilyClient(role: Extract<AppRole, 'student' | 'parent'>) {
  const access = await getAccessState();
  if (access.profile?.role !== role) return null;
  return getSupabase();
}
