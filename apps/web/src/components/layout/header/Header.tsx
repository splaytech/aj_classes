// Sticky site header: logo, section links, "We're hiring", Sign in (portal flag) and the
// "Register Interest" button. FAQ and News are in the footer. On small screens the links and actions fold
// into a menu button (PRP F2 section 1).

import { ChevronRight, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router';

import { PROGRAMME_ICONS } from '@/components/icons/site-icons';
import { ButtonLink, Container, Logo } from '@/components/ui';
import {
  A11Y,
  ANALYTICS_EVENTS,
  APP_CONFIG,
  CTA_LOCATIONS,
  ELEMENT_IDS,
  NAV,
  PORTAL_ROUTES,
  PROGRAMMES,
  ROUTES,
  SECTION_IDS,
  sectionLink,
} from '@/constants';
import { trackEvent } from '@/lib/analytics';

import styles from './Header.module.css';

/** True when a link points at the page being shown (ignores a trailing slash). */
function isCurrentPage(pathname: string, href: string): boolean {
  return pathname.replace(/\/$/, '') === href;
}

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();

  function closeMenu() {
    setIsMenuOpen(false);
  }

  function toggleMenu() {
    setIsMenuOpen(!isMenuOpen);
  }

  function handleCtaClick() {
    closeMenu();
    trackEvent(ANALYTICS_EVENTS.ctaClick, { location: CTA_LOCATIONS.header });
  }

  const navClassName = isMenuOpen ? `${styles.nav} ${styles.navOpen}` : styles.nav;

  return (
    <header className={styles.header}>
      <Container>
        <div className={styles.bar}>
          <a href={ROUTES.home} aria-label={A11Y.homeLink} className={styles.logoLink}>
            <Logo />
          </a>

          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={isMenuOpen}
            aria-controls={ELEMENT_IDS.mainNavigation}
            onClick={toggleMenu}
          >
            {isMenuOpen ? A11Y.closeMenu : A11Y.openMenu}
          </button>

          <nav
            id={ELEMENT_IDS.mainNavigation}
            aria-label={A11Y.mainNavigation}
            className={navClassName}
          >
            <ul className={styles.links}>
              {NAV.links.map((link) => (
                <li key={link.sectionId} className={link.subLinks ? styles.hasSubLinks : undefined}>
                  <a href={sectionLink(link.sectionId)} onClick={closeMenu}>
                    {link.label}
                  </a>
                  {link.subLinks && (
                    <ul className={styles.subLinks}>
                      {link.subLinks.map((subLink) => {
                        const Icon = PROGRAMME_ICONS[subLink.id];
                        const isCurrent = isCurrentPage(pathname, subLink.href);
                        // Three slots: icon, name, then a "New" tag or a chevron. The whole
                        // row is the link (ui-polish.md §3, item 3).
                        return (
                          <li key={subLink.href}>
                            <a
                              href={subLink.href}
                              onClick={closeMenu}
                              aria-current={isCurrent ? 'page' : undefined}
                            >
                              <Icon className={styles.subIcon} aria-hidden="true" />
                              <span>{subLink.label}</span>
                              {subLink.isNew ? (
                                <span className={styles.newTag}>{PROGRAMMES.newBadge}</span>
                              ) : (
                                <ChevronRight className={styles.chevron} aria-hidden="true" />
                              )}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
              <li key={NAV.careersLink.href}>
                <a
                  href={NAV.careersLink.href}
                  onClick={closeMenu}
                  aria-current={isCurrentPage(pathname, NAV.careersLink.href) ? 'page' : undefined}
                >
                  {NAV.careersLink.label}
                </a>
              </li>
            </ul>
            <div className={styles.actions}>
              {APP_CONFIG.features.portal && (
                <a
                  className={styles.signIn}
                  href={PORTAL_ROUTES.login}
                  aria-label={NAV.signInLabel}
                  onClick={closeMenu}
                >
                  <LogIn aria-hidden="true" />
                  {NAV.signIn}
                </a>
              )}
              <ButtonLink href={sectionLink(SECTION_IDS.contact)} onClick={handleCtaClick}>
                {NAV.cta}
              </ButtonLink>
            </div>
          </nav>
        </div>
      </Container>
    </header>
  );
}
