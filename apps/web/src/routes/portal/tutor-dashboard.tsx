// Tutor home page (story US11). A shell for the tools that arrive in Release 3.

import { PORTAL_SEO, TUTOR_DASHBOARD } from '@/constants';
import { buildPortalMeta } from '@/lib/seo';

import { useStaffAccess } from './staff-layout';
import styles from './dashboard.module.css';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.tutor);
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export default function TutorDashboard() {
  const access = useStaffAccess();

  return (
    <section>
      <h1>{TUTOR_DASHBOARD.welcome(firstName(access.profile?.fullName ?? ''))}</h1>
      <p className={styles.intro}>{TUTOR_DASHBOARD.intro}</p>
      <ul className={styles.cards}>
        {TUTOR_DASHBOARD.cards.map((card) => (
          <li key={card.title} className={styles.card}>
            <h2 className={styles.cardTitle}>{card.title}</h2>
            <p className={styles.cardText}>{card.text}</p>
            <span className={styles.soon}>{TUTOR_DASHBOARD.comingSoon}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
