// Admin-only pages. A tutor sees "You don't have access" instead (US20 AC2).
// The database enforces the same rule; this only decides what to show.

import { Outlet, useLoaderData } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { ForbiddenView } from '@/components/portal';
import { guardPortalPage } from '@/lib/portal-guard';

import { useStaffAccess } from './staff-layout';

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  return guardPortalPage(request, 'admin');
}

export default function AdminLayout() {
  const page = useLoaderData<typeof clientLoader>();
  const access = useStaffAccess();

  if (page?.forbidden) return <ForbiddenView />;
  return <Outlet context={access} />;
}
