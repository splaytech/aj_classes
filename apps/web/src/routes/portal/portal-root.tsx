// Wraps every /portal page: switches the portal off when it isn't configured, shows a
// loading card while access is checked, and a friendly error if the server can't be reached.
// The appearance (light / dark) applies from here, sign-in pages included (R3b design §6.5).

import { Outlet } from 'react-router';

import {
  AuthCard,
  PortalLoading,
  PortalThemeProvider,
  PortalUnavailable,
} from '@/components/portal';
import { ButtonLink } from '@/components/ui';
import { APP_CONFIG, PORTAL_ERRORS, PORTAL_COMMON, PORTAL_ROUTES, PORTAL_SEO } from '@/constants';
import { buildPortalMeta } from '@/lib/seo';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.login);
}

export function HydrateFallback() {
  return <PortalLoading />;
}

export function ErrorBoundary() {
  return (
    <AuthCard heading={PORTAL_COMMON.errorHeading} intro={PORTAL_ERRORS.network}>
      <ButtonLink href={PORTAL_ROUTES.root}>{PORTAL_COMMON.tryAgain}</ButtonLink>
    </AuthCard>
  );
}

export default function PortalRoot() {
  if (!APP_CONFIG.features.portal) return <PortalUnavailable />;
  return (
    <PortalThemeProvider>
      <Outlet />
    </PortalThemeProvider>
  );
}
