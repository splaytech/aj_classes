// Whole-page messages for the portal: not configured, no access, not found, loading.

import { ButtonLink } from '@/components/ui';
import {
  PORTAL_COMMON,
  PORTAL_FORBIDDEN,
  PORTAL_NOT_FOUND,
  PORTAL_ROUTES,
  PORTAL_UNAVAILABLE,
} from '@/constants';

import { AuthCard } from './AuthCard';
import styles from './PortalForm.module.css';

export function PortalUnavailable() {
  return <AuthCard heading={PORTAL_UNAVAILABLE.heading} intro={PORTAL_UNAVAILABLE.text} />;
}

export function PortalLoading() {
  return (
    <AuthCard heading={PORTAL_COMMON.loading}>
      <p className={styles.hint} role="status">
        {PORTAL_COMMON.loading}
      </p>
    </AuthCard>
  );
}

/** Shown inside the portal frame when a tutor opens an admin page (US20 AC2). */
export function ForbiddenView() {
  return (
    <section>
      <h1>{PORTAL_FORBIDDEN.heading}</h1>
      <p>{PORTAL_FORBIDDEN.text}</p>
      <ButtonLink href={PORTAL_ROUTES.root}>{PORTAL_FORBIDDEN.backHome}</ButtonLink>
    </section>
  );
}

export function PortalNotFound() {
  return (
    <AuthCard heading={PORTAL_NOT_FOUND.heading} intro={PORTAL_NOT_FOUND.text}>
      <ButtonLink href={PORTAL_ROUTES.root}>{PORTAL_NOT_FOUND.backHome}</ButtonLink>
    </AuthCard>
  );
}
