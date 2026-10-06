// Runs the access rules before a portal page loads (in each route's clientLoader).
// Redirects, signs out, or hands the page the current AccessState (R2a design §11.3).

import { redirect } from 'react-router';

import { APP_CONFIG } from '@/constants';
import { getAccessState, signOut } from '@/services';
import type { AccessState } from '@/services';

import { decidePortalAccess } from './portal-access';
import type { PortalArea } from './portal-access';

export type PortalPageAccess = {
  access: AccessState;
  forbidden: boolean;
};

/** Returns null when the portal isn't configured (the portal root shows a notice instead). */
export async function guardPortalPage(
  request: Request,
  area: PortalArea,
): Promise<PortalPageAccess | null> {
  if (!APP_CONFIG.features.portal) return null;

  const access = await getAccessState();
  const url = new URL(request.url);
  const decision = decidePortalAccess(access, area, url.pathname + url.search);

  switch (decision.kind) {
    case 'redirect':
      throw redirect(decision.to);
    case 'signOut':
      await signOut();
      throw redirect(decision.to);
    case 'forbidden':
      return { access, forbidden: true };
    default:
      return { access, forbidden: false };
  }
}
