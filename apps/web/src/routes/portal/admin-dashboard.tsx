// Admin home page. Staff management arrives in build step 7 (R2a design §18).

import { ADMIN_DASHBOARD, PORTAL_SEO } from '@/constants';
import { buildPortalMeta } from '@/lib/seo';

import styles from './dashboard.module.css';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.admin);
}

export default function AdminDashboard() {
  return (
    <section>
      <h1>{ADMIN_DASHBOARD.heading}</h1>
      <p className={styles.intro}>{ADMIN_DASHBOARD.intro}</p>
      <ul className={styles.cards}>
        {ADMIN_DASHBOARD.cards.map((card) => (
          <li key={card.title} className={styles.card}>
            <h2 className={styles.cardTitle}>{card.title}</h2>
            <p className={styles.cardText}>{card.text}</p>
            <span className={styles.soon}>{ADMIN_DASHBOARD.comingSoon}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
