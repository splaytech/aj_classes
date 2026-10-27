// "We're hiring" page (/careers, we-are-hiring 03 §3). Static and pre-rendered like /privacy;
// applying is a mailto link, so the page makes no requests and stores nothing (DEC-WH-1).
// Wording lives in careers.constants.ts → CAREERS.

import { SiteLayout } from '@/components/layout/SiteLayout';
import { ButtonLink, Section } from '@/components/ui';
import { CAREERS, ROUTES, careersApplyHref } from '@/constants';
import { buildPageMeta } from '@/lib/seo';

import styles from './careers.module.css';

export function meta() {
  return buildPageMeta(CAREERS.seo, ROUTES.careers);
}

export default function CareersPage() {
  return (
    <SiteLayout>
      <Section>
        <h1>{CAREERS.heading}</h1>
        <p>{CAREERS.intro}</p>

        <h2>{CAREERS.rolesHeading}</h2>
        <ul className={styles.list}>
          {CAREERS.roles.map((role) => (
            <li key={role}>{role}</li>
          ))}
        </ul>

        <h2>{CAREERS.lookingFor.heading}</h2>
        <ul className={styles.list}>
          {CAREERS.lookingFor.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        <h2>{CAREERS.needs.heading}</h2>
        <ul className={styles.list}>
          {CAREERS.needs.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        <h2>{CAREERS.apply.heading}</h2>
        <p>{CAREERS.apply.text}</p>
        <p className={styles.apply}>
          <ButtonLink href={careersApplyHref()}>{CAREERS.apply.linkText}</ButtonLink>
        </p>

        <p>
          <a href={ROUTES.home}>{CAREERS.backHome}</a>
        </p>
      </Section>
    </SiteLayout>
  );
}

// Anything unexpected while showing the page: keep the site's header and footer, never a blank page.
export function ErrorBoundary() {
  return (
    <SiteLayout>
      <Section>
        <h1>{CAREERS.errorBoundary.heading}</h1>
        <p>{CAREERS.errorBoundary.text}</p>
        <ButtonLink href={ROUTES.home}>{CAREERS.errorBoundary.backHome}</ButtonLink>
      </Section>
    </SiteLayout>
  );
}
