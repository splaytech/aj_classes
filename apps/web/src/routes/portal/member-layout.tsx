// Every signed-in portal page: checks the person may use the portal, then shows the portal frame
// with the navigation for their role (R3b design §6.1). The area layouts inside it (staff, admin,
// student, parent) each check the role for their pages.

import { Outlet, useLoaderData, useOutletContext } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { ForbiddenView, PortalLayout } from '@/components/portal';
import { guardPortalPage } from '@/lib/portal-guard';
import type { AccessState } from '@/services';

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  return guardPortalPage(request, 'member');
}

export default function MemberLayout() {
  const page = useLoaderData<typeof clientLoader>();
  if (!page?.access.profile) return null;

  const { fullName, role } = page.access.profile;
  return (
    <PortalLayout fullName={fullName} role={role}>
      <Outlet context={page.access} />
    </PortalLayout>
  );
}

/** The signed-in person, for any page inside the portal frame. */
export function usePortalAccess(): AccessState {
  return useOutletContext<AccessState>();
}

/** An area's pages, or "You don't have access" for people with another role. */
export function AreaOutlet({ forbidden }: { forbidden: boolean | undefined }) {
  const access = usePortalAccess();
  if (forbidden) return <ForbiddenView />;
  return <Outlet context={access} />;
}
