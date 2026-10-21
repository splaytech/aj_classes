// One page per programme at /programmes/:slug (Release 1, programme-pages.md). Wording lives in
// programmes.constants.ts → PROGRAMMES. VCE has its own page (vce.tsx); unknown slugs get the 404.

import { useParams } from 'react-router';

import { SiteLayout } from '@/components/layout/SiteLayout';
import { ButtonLink, Section } from '@/components/ui';
import {
  PROGRAMMES,
  PROGRAMME_PAGE,
  ROUTES,
  SECTION_IDS,
  findProgramme,
  programmePath,
  sectionLink,
} from '@/constants';
import type { Programme } from '@/constants';
import { buildPageMeta } from '@/lib/seo';

import type { Route } from './+types/programme';
import NotFoundPage, { meta as notFoundMeta } from './not-found';
import styles from './programme.module.css';

export function meta({ params }: Route.MetaArgs) {
  const programme = findProgramme(params.slug);
  if (!programme) return notFoundMeta();
  return buildPageMeta(programme.seo, programmePath(programme.slug));
}

export default function ProgrammeRoute() {
  const programme = findProgramme(useParams().slug);
  if (!programme) return <NotFoundPage />;
  return <ProgrammePage programme={programme} />;
}

export function ProgrammePage({ programme }: { programme: Programme }) {
  const others = PROGRAMMES.items.filter((other) => other.slug !== programme.slug);

  return (
    <SiteLayout>
      <Section>
        <div className={styles.tags}>
          <span className={styles.years}>{programme.years}</span>
          {programme.isNew && <span className={styles.newBadge}>{PROGRAMMES.newBadge}</span>}
        </div>
        <h1>{programme.title}</h1>
        <p className={styles.intro}>{programme.intro}</p>
        <p>{PROGRAMME_PAGE.deliveryText}</p>
        <ButtonLink href={sectionLink(SECTION_IDS.contact)}>{PROGRAMME_PAGE.cta}</ButtonLink>
      </Section>

      {programme.about && (
        <Section heading={programme.about.heading} tone="subtle">
          {programme.about.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </Section>
      )}

      <Section heading={PROGRAMME_PAGE.helpHeading} tone={programme.about ? 'default' : 'subtle'}>
        <ul className={styles.points}>
          {programme.help.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <ButtonLink href={sectionLink(SECTION_IDS.contact)}>{PROGRAMME_PAGE.cta}</ButtonLink>
      </Section>

      <Section heading={PROGRAMME_PAGE.otherHeading} tone={programme.about ? 'subtle' : 'default'}>
        <ul className={styles.others}>
          {others.map((other) => (
            <li key={other.slug}>
              <a href={programmePath(other.slug)}>{other.title}</a>
            </li>
          ))}
        </ul>
        <p className={styles.back}>
          <a href={ROUTES.home}>{PROGRAMME_PAGE.backHome}</a>
        </p>
      </Section>
    </SiteLayout>
  );
}
