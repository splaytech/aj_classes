// Tutor home page (story US11). A shell for the tools that arrive in Release 3.

import { Link, useLoaderData } from 'react-router';

import { FormStatus } from '@/components/portal';
import { PORTAL_ROUTES, PORTAL_SEO, TUTOR_DASHBOARD } from '@/constants';
import { buildPortalMeta } from '@/lib/seo';
import { getMyProfile } from '@/services';

import { useStaffAccess } from './staff-layout';
import styles from './dashboard.module.css';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.tutor);
}

// Access is checked by the staff layout; the profile tells us whether to prompt for details.
export async function clientLoader() {
  const profile = await getMyProfile();
  const isIncomplete = profile.ok && (!profile.data.bio || profile.data.subjects.length === 0);
  return { isIncomplete };
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export default function TutorDashboard() {
  const access = useStaffAccess();
  const { isIncomplete } = useLoaderData<typeof clientLoader>();

  return (
    <section>
      <h1>{TUTOR_DASHBOARD.welcome(firstName(access.profile?.fullName ?? ''))}</h1>
      <p className={styles.intro}>{TUTOR_DASHBOARD.intro}</p>

      {isIncomplete && (
        <div className={styles.prompt}>
          <FormStatus message={TUTOR_DASHBOARD.completeProfile} />
          <Link to={PORTAL_ROUTES.profile}>{TUTOR_DASHBOARD.completeProfileLink}</Link>
        </div>
      )}

      <ul className={styles.cards}>
        <li className={styles.card}>
          <h2 className={styles.cardTitle}>{TUTOR_DASHBOARD.profileCard.title}</h2>
          <p className={styles.cardText}>{TUTOR_DASHBOARD.profileCard.text}</p>
          <Link className={styles.cardLink} to={PORTAL_ROUTES.profile}>
            {TUTOR_DASHBOARD.profileCard.link}
          </Link>
        </li>
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
