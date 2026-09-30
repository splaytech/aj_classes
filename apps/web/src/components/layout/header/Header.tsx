// Sticky site header: logo, section links and the "Register Interest" button.
// On small screens the links fold into a menu button (PRP F2 section 1).

import { useState } from 'react';

import { ButtonLink, Container, Logo } from '@/components/ui';
import {
  A11Y,
  ANALYTICS_EVENTS,
  CTA_LOCATIONS,
  ELEMENT_IDS,
  NAV,
  ROUTES,
  SECTION_IDS,
  sectionLink,
} from '@/constants';
import { trackEvent } from '@/lib/analytics';

import styles from './Header.module.css';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
                <li key={link.sectionId}>
                  <a href={sectionLink(link.sectionId)} onClick={closeMenu}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <ButtonLink href={sectionLink(SECTION_IDS.contact)} onClick={handleCtaClick}>
              {NAV.cta}
            </ButtonLink>
          </nav>
        </div>
      </Container>
    </header>
  );
}
