// The centred card used by sign-in, password and two-step pages.

import type { ReactNode } from 'react';

import { Logo } from '@/components/ui';
import { A11Y, PORTAL_COMMON, ROUTES, SECTION_IDS } from '@/constants';

import styles from './AuthCard.module.css';

type AuthCardProps = {
  heading: string;
  intro?: string;
  children?: ReactNode;
};

export function AuthCard({ heading, intro, children }: AuthCardProps) {
  return (
    <div className={styles.page}>
      <main id={SECTION_IDS.main} className={styles.card}>
        <a href={ROUTES.home} className={styles.logoLink} aria-label={A11Y.homeLink}>
          <Logo />
        </a>
        <h1 className={styles.heading}>{heading}</h1>
        {intro && <p className={styles.intro}>{intro}</p>}
        {children}
      </main>
      <a href={ROUTES.home} className={styles.backLink}>
        {PORTAL_COMMON.backToSite}
      </a>
    </div>
  );
}
