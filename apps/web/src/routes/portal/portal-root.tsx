// Wraps every /portal page: switches the portal off when it isn't configured, shows a
// loading card while access is checked, and a friendly error if a page can't be shown.
// The appearance (light / dark) applies from here, sign-in pages included (R3b design §6.5).

import { Outlet, useRouteError } from 'react-router';

import {
  AuthCard,
  PortalLoading,
  PortalThemeProvider,
  PortalUnavailable,
} from '@/components/portal';
import { ButtonLink } from '@/components/ui';
import { APP_CONFIG, PORTAL_ERRORS, PORTAL_COMMON, PORTAL_ROUTES, PORTAL_SEO } from '@/constants';
import { isConnectionFailure } from '@/lib/connection-errors';
import { buildPortalMeta } from '@/lib/seo';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.login);
}

export function HydrateFallback() {
  return <PortalLoading />;
}

// "Check your connection" only when that's the cause (offline, or the page couldn't download);
// anything else is a bug, so it doesn't blame the person's internet.
export function ErrorBoundary() {
  const error = useRouteError();
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const intro =
    offline || isConnectionFailure(error) ? PORTAL_ERRORS.network : PORTAL_COMMON.errorIntro;

  return (
    <AuthCard heading={PORTAL_COMMON.errorHeading} intro={intro}>
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
