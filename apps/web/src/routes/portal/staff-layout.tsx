// Staff pages (tutors and admins). Students and parents see "You don't have access" (R3b F2).
// Pages read the current person with `useStaffAccess()`.

import { useLoaderData, useOutletContext } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { guardPortalPage } from '@/lib/portal-guard';
import type { AccessState } from '@/services';

import { AreaOutlet } from './member-layout';

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  return guardPortalPage(request, 'staff');
}

export default function StaffLayout() {
  const page = useLoaderData<typeof clientLoader>();
  return <AreaOutlet forbidden={page?.forbidden} />;
}

/** The signed-in person, for pages inside the staff area. */
export function useStaffAccess(): AccessState {
  return useOutletContext<AccessState>();
}
