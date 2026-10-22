// Admin-only pages. A tutor sees "You don't have access" instead (US20 AC2).
// The database enforces the same rule; this only decides what to show.

import { useLoaderData } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { guardPortalPage } from '@/lib/portal-guard';

import { AreaOutlet } from './member-layout';

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  return guardPortalPage(request, 'admin');
}

export default function AdminLayout() {
  const page = useLoaderData<typeof clientLoader>();
  return <AreaOutlet forbidden={page?.forbidden} />;
}
