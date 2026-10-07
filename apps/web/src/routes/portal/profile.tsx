// My profile (stories US12, US13): photo, name, subjects, bio and qualifications.

import { useLoaderData, useRevalidator } from 'react-router';

import { FormAlert, PhotoEditor, ProfileForm } from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import { AUTH_ERRORS, PORTAL_SEO, PROFILE_PAGE } from '@/constants';
import { buildPortalMeta } from '@/lib/seo';
import { getMyProfile, removeMyPhoto, updateMyProfile, uploadMyPhoto } from '@/services';

import styles from './profile.module.css';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.profile);
}

// Access is checked by the staff layout; this only loads the profile.
export async function clientLoader() {
  return getMyProfile();
}

export default function ProfilePage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();

  if (!loaded.ok) return <FormAlert message={AUTH_ERRORS[loaded.error]} />;
  const profile = loaded.data;

  // Reload the page data (and the header's name) after any save (review V30).
  function refresh() {
    revalidator.revalidate();
  }

  return (
    <div className={styles.page}>
      <div>
        <h1>{PROFILE_PAGE.heading}</h1>
        <p className={formStyles.hint}>{PROFILE_PAGE.intro}</p>
      </div>

      <dl className={styles.facts}>
        <dt>{PROFILE_PAGE.email}</dt>
        <dd>
          {profile.email}
          <span className={formStyles.hint}>{PROFILE_PAGE.emailHint}</span>
        </dd>
      </dl>

      <PhotoEditor
        profile={profile}
        onUpload={uploadMyPhoto}
        onRemove={removeMyPhoto}
        onChanged={refresh}
      />

      <section className={styles.section}>
        <ProfileForm profile={profile} onSave={updateMyProfile} onSaved={refresh} />
      </section>
    </div>
  );
}
