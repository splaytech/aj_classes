// One page per area at /tutoring/:slug (local-seo.md): Melbourne's west and Melbourne's north.
// Wording lives in areas.constants.ts → AREAS. Unknown slugs get the 404; the old per-suburb
// addresses redirect here (vercel.json, serve.railway.json).

import { useParams } from 'react-router';

import { SiteLayout } from '@/components/layout/SiteLayout';
import { ButtonLink, Section } from '@/components/ui';
import {
  AREAS,
  AREA_PAGE,
  PROGRAMMES,
  ROUTES,
  SECTION_IDS,
  areaPath,
  findArea,
  programmePath,
  sectionLink,
} from '@/constants';
import type { Area } from '@/constants';
import { buildAreaJsonLd, buildPageMeta } from '@/lib/seo';

import type { Route } from './+types/area';
import styles from './area.module.css';
import NotFoundPage, { meta as notFoundMeta } from './not-found';

export function meta({ params }: Route.MetaArgs) {
  const area = findArea(params.slug);
  if (!area) return notFoundMeta();
  const path = areaPath(area.slug);
  return [
    ...buildPageMeta(area.seo, path),
    buildAreaJsonLd({ name: area.name, path, suburbs: area.suburbs.map((suburb) => suburb.name) }),
  ];
}

export default function AreaRoute() {
  const area = findArea(useParams().slug);
  if (!area) return <NotFoundPage />;
  return <AreaPage area={area} />;
}

export function AreaPage({ area }: { area: Area }) {
  const others = AREAS.filter((other) => other.slug !== area.slug);

  return (
    <SiteLayout>
      <Section>
        <h1>{AREA_PAGE.title(area.name)}</h1>
        <p className={styles.intro}>{area.intro}</p>
        <p>{AREA_PAGE.deliveryText}</p>
        <ButtonLink href={sectionLink(SECTION_IDS.contact)}>{AREA_PAGE.cta}</ButtonLink>
      </Section>

      <Section heading={area.localHeading} tone="subtle">
        {area.localParagraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </Section>

      <Section heading={AREA_PAGE.suburbsHeading}>
        <p>{AREA_PAGE.suburbsIntro}</p>
        <ul className={styles.suburbs}>
          {area.suburbs.map((suburb) => (
            <li key={suburb.name}>
              <strong>{suburb.name}</strong>
              <span>{suburb.note}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section heading={AREA_PAGE.programmesHeading} tone="subtle">
        <ul className={styles.links}>
          {PROGRAMMES.items.map((programme) => (
            <li key={programme.slug}>
              <a href={programmePath(programme.slug)}>
                {AREA_PAGE.programmeLine(programme.title, programme.years)}
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section heading={AREA_PAGE.howHeading}>
        <ul className={styles.points}>
          {AREA_PAGE.howPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <ButtonLink href={sectionLink(SECTION_IDS.contact)}>{AREA_PAGE.cta}</ButtonLink>
      </Section>

      {AREA_PAGE.guidePath && (
        <Section heading={AREA_PAGE.guideHeading} tone="subtle">
          <p>{AREA_PAGE.guideText}</p>
          <p>
            <a href={AREA_PAGE.guidePath}>{AREA_PAGE.guideLinkLabel}</a>
          </p>
        </Section>
      )}

      <Section heading={AREA_PAGE.otherHeading}>
        <ul className={styles.links}>
          {others.map((other) => (
            <li key={other.slug}>
              <a href={areaPath(other.slug)}>{AREA_PAGE.linkLabel(other.name)}</a>
            </li>
          ))}
        </ul>
        <p className={styles.back}>
          <a href={ROUTES.home}>{AREA_PAGE.backHome}</a>
        </p>
      </Section>
    </SiteLayout>
  );
}
