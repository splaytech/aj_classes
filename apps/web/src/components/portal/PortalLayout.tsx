// The frame for signed-in portal pages: header with navigation for the person's role, the
// light/dark switch and Sign out, then the page. Not the marketing header and footer
// (R2a design §11.5, R3b §6.1).

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { Container, Logo } from '@/components/ui';
import { A11Y, PORTAL_COMMON, PORTAL_ROUTES, ROLE_LABELS, SECTION_IDS } from '@/constants';
import type { AppRole } from '@/constants';
import { signOut, watchForSignOut } from '@/services';

import styles from './PortalLayout.module.css';
import { ThemeToggle } from './ThemeToggle';

type PortalLayoutProps = {
  fullName: string;
  role: AppRole;
  children: ReactNode;
};

/** `notUnder`: a sub-path that has its own link (e.g. the student timetable under "My work"). */
type NavItem = { to: string; label: string; notUnder?: string };

const { nav } = PORTAL_COMMON;
const STAFF_NAV: NavItem[] = [
  { to: PORTAL_ROUTES.tutor, label: nav.tutor },
  { to: PORTAL_ROUTES.timetable, label: nav.timetable },
  { to: PORTAL_ROUTES.classes, label: nav.classes },
  { to: PORTAL_ROUTES.assignments, label: nav.assignments },
  { to: PORTAL_ROUTES.profile, label: nav.profile },
];
const ADMIN_LINK: NavItem = { to: PORTAL_ROUTES.admin, label: nav.admin };
const ACCOUNT_LINK: NavItem = { to: PORTAL_ROUTES.account, label: nav.account };

const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  tutor: [...STAFF_NAV, ACCOUNT_LINK],
  admin: [...STAFF_NAV, ADMIN_LINK, ACCOUNT_LINK],
  student: [
    { to: PORTAL_ROUTES.student, label: nav.studentHome, notUnder: PORTAL_ROUTES.studentTimetable },
    { to: PORTAL_ROUTES.studentTimetable, label: nav.studentTimetable },
    ACCOUNT_LINK,
  ],
  parent: [{ to: PORTAL_ROUTES.parent, label: nav.parentHome }, ACCOUNT_LINK],
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
              <span className={styles.badge}>{PORTAL_COMMON.areaBadge[role]}</span>
            </a>
            <div className={styles.user}>
              <span className={styles.name}>
                {fullName}
                <span className={styles.role}>{ROLE_LABELS[role]}</span>
              </span>
              <ThemeToggle />
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
            {NAV_BY_ROLE[role].map((item) => (
              <PortalNavLink key={item.to} item={item} />
            ))}
          </nav>
        </Container>
      </header>
      <main id={SECTION_IDS.main} className={styles.main}>
        <Container>{children}</Container>
      </main>
    </>
  );
}

/** Active on its own page and the pages under it, except a sub-path with its own link. */
function isActiveLink(item: NavItem, pathname: string): boolean {
  const underItem = pathname === item.to || pathname.startsWith(`${item.to}/`);
  const underOther = item.notUnder !== undefined && pathname.startsWith(item.notUnder);
  return underItem && !underOther;
}

function PortalNavLink({ item }: { item: NavItem }) {
  const { pathname } = useLocation();
  const active = isActiveLink(item, pathname);

  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={active ? `${styles.navLink} ${styles.active}` : styles.navLink}
    >
      {item.label}
    </Link>
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
