// One page per suburb at /tutoring/:slug (local-seo.md). Wording lives in suburbs.constants.ts →
// SUBURBS. Unknown slugs get the 404.

import { useParams } from 'react-router';

import { SiteLayout } from '@/components/layout/SiteLayout';
import { ButtonLink, Section } from '@/components/ui';
import {
  PROGRAMMES,
  ROUTES,
  SECTION_IDS,
  SUBURBS,
  SUBURB_PAGE,
  findSuburb,
  programmePath,
  sectionLink,
  suburbPath,
} from '@/constants';
import type { Suburb } from '@/constants';
import { buildPageMeta, buildSuburbJsonLd } from '@/lib/seo';

import type { Route } from './+types/suburb';
import NotFoundPage, { meta as notFoundMeta } from './not-found';
import styles from './suburb.module.css';

export function meta({ params }: Route.MetaArgs) {
  const suburb = findSuburb(params.slug);
  if (!suburb) return notFoundMeta();
  const path = suburbPath(suburb.slug);
  return [...buildPageMeta(suburb.seo, path), buildSuburbJsonLd({ name: suburb.name, path })];
}

export default function SuburbRoute() {
  const suburb = findSuburb(useParams().slug);
  if (!suburb) return <NotFoundPage />;
  return <SuburbPage suburb={suburb} />;
}

export function SuburbPage({ suburb }: { suburb: Suburb }) {
  const others = SUBURBS.filter((other) => other.slug !== suburb.slug);

  return (
    <SiteLayout>
      <Section>
        <h1>{SUBURB_PAGE.title(suburb.name)}</h1>
        <p className={styles.intro}>{suburb.intro}</p>
        <p>{SUBURB_PAGE.deliveryText}</p>
        <ButtonLink href={sectionLink(SECTION_IDS.contact)}>{SUBURB_PAGE.cta}</ButtonLink>
      </Section>

      <Section heading={suburb.localHeading} tone="subtle">
        {suburb.localParagraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </Section>

      <Section heading={SUBURB_PAGE.programmesHeading}>
        <ul className={styles.links}>
          {PROGRAMMES.items.map((programme) => (
            <li key={programme.slug}>
              <a href={programmePath(programme.slug)}>
                {SUBURB_PAGE.programmeLine(programme.title, programme.years)}
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section heading={SUBURB_PAGE.howHeading} tone="subtle">
        <ul className={styles.points}>
          {SUBURB_PAGE.howPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <ButtonLink href={sectionLink(SECTION_IDS.contact)}>{SUBURB_PAGE.cta}</ButtonLink>
      </Section>

      {SUBURB_PAGE.guidePath && (
        <Section heading={SUBURB_PAGE.guideHeading}>
          <p>{SUBURB_PAGE.guideText}</p>
          <p>
            <a href={SUBURB_PAGE.guidePath}>{SUBURB_PAGE.guideLinkLabel}</a>
          </p>
        </Section>
      )}

      <Section heading={SUBURB_PAGE.otherHeading} tone="subtle">
        <ul className={styles.links}>
          {others.map((other) => (
            <li key={other.slug}>
              <a href={suburbPath(other.slug)}>{SUBURB_PAGE.linkLabel(other.name)}</a>
            </li>
          ))}
        </ul>
        <p className={styles.back}>
          <a href={ROUTES.home}>{SUBURB_PAGE.backHome}</a>
        </p>
      </Section>
    </SiteLayout>
  );
}
