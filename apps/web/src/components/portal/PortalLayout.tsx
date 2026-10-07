// The frame for signed-in staff pages: header with navigation and Sign out, then the page.
// Not the marketing header and footer (R2a design §11.5).

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';

import { Container, Logo } from '@/components/ui';
import { A11Y, PORTAL_COMMON, PORTAL_ROUTES, SECTION_IDS, STAFF_ROLE_LABELS } from '@/constants';
import type { StaffRole } from '@/constants';
import { signOut, watchForSignOut } from '@/services';

import styles from './PortalLayout.module.css';

type PortalLayoutProps = {
  fullName: string;
  role: StaffRole;
  children: ReactNode;
};

export function PortalLayout({ fullName, role, children }: PortalLayoutProps) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  useSendToLoginWhenSignedOut();
  const navRef = useActiveLinkInView();

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    navigate(PORTAL_ROUTES.login, { replace: true });
  }

  return (
    <>
      <header className={styles.header}>
        <Container>
          <div className={styles.bar}>
            <a href={PORTAL_ROUTES.root} className={styles.logoLink} aria-label={A11Y.homeLink}>
              <Logo />
              <span className={styles.badge}>{PORTAL_COMMON.staffArea}</span>
            </a>
            <div className={styles.user}>
              <span className={styles.name}>
                {fullName}
                <span className={styles.role}>{STAFF_ROLE_LABELS[role]}</span>
              </span>
              <button
                type="button"
                className={styles.signOut}
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? PORTAL_COMMON.signingOut : PORTAL_COMMON.signOut}
              </button>
            </div>
          </div>
          <nav ref={navRef} className={styles.nav} aria-label={PORTAL_COMMON.navLabel}>
            <PortalNavLink to={PORTAL_ROUTES.tutor}>{PORTAL_COMMON.nav.tutor}</PortalNavLink>
            <PortalNavLink to={PORTAL_ROUTES.timetable}>
              {PORTAL_COMMON.nav.timetable}
            </PortalNavLink>
            <PortalNavLink to={PORTAL_ROUTES.classes}>{PORTAL_COMMON.nav.classes}</PortalNavLink>
            <PortalNavLink to={PORTAL_ROUTES.assignments}>
              {PORTAL_COMMON.nav.assignments}
            </PortalNavLink>
            <PortalNavLink to={PORTAL_ROUTES.profile}>{PORTAL_COMMON.nav.profile}</PortalNavLink>
            {role === 'admin' && (
              <PortalNavLink to={PORTAL_ROUTES.admin}>{PORTAL_COMMON.nav.admin}</PortalNavLink>
            )}
            <PortalNavLink to={PORTAL_ROUTES.account}>{PORTAL_COMMON.nav.account}</PortalNavLink>
          </nav>
        </Container>
      </header>
      <main id={SECTION_IDS.main} className={styles.main}>
        <Container>{children}</Container>
      </main>
    </>
  );
}

function PortalNavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
      }
    >
      {children}
    </NavLink>
  );
}

/** Signing out in another tab, or being deactivated, ends this tab's session too (US4 AC3). */
function useSendToLoginWhenSignedOut() {
  const navigate = useNavigate();

  useEffect(() => {
    let stopWatching = () => {};
    let cancelled = false;

    watchForSignOut(() => navigate(PORTAL_ROUTES.login, { replace: true })).then((stop) => {
      if (cancelled) stop();
      else stopWatching = stop;
    });

    return () => {
      cancelled = true;
      stopWatching();
    };
  }, [navigate]);
}

/** On phones the nav scrolls sideways; keep the current page's link visible. */
function useActiveLinkInView() {
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);

  return navRef;
}
