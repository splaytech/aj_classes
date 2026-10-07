// /portal: sends each person to their own home page.

import { redirect } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { homeForRole } from '@/lib/portal-access';
import { guardPortalPage } from '@/lib/portal-guard';

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const page = await guardPortalPage(request, 'member');
  if (page?.access.profile) throw redirect(homeForRole(page.access.profile.role));
  return null;
}

export default function PortalHome() {
  return null;
}
