// Signed-in staff pages: checks access, then shows the staff header around the page.
// Pages read the current person with `useStaffAccess()`.

import { Outlet, useLoaderData, useOutletContext } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { PortalLayout, PortalThemeProvider } from '@/components/portal';
import { guardPortalPage } from '@/lib/portal-guard';
import type { AccessState } from '@/services';

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  return guardPortalPage(request, 'staff');
}

export default function StaffLayout() {
  const page = useLoaderData<typeof clientLoader>();
  if (!page?.access.profile) return null;

  const { fullName, role } = page.access.profile;
  return (
    <PortalThemeProvider>
      <PortalLayout fullName={fullName} role={role}>
        <Outlet context={page.access} />
      </PortalLayout>
    </PortalThemeProvider>
  );
}

/** The signed-in person, for pages inside the staff layout. */
export function useStaffAccess(): AccessState {
  return useOutletContext<AccessState>();
}
