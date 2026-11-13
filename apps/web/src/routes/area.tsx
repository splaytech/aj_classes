// Pages at /tutoring/:slug (local-seo.md): one per area (Melbourne's west and north, wording in
// areas.constants.ts → AREAS) and one per in-person centre (CENTRES, rendered by centre.tsx).
// Unknown slugs get the 404; the other old per-suburb addresses redirect to their area
// (vercel.json, serve.railway.json).

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
  centrePathFor,
  findArea,
  findCentre,
  programmePath,
  sectionLink,
} from '@/constants';
import type { Area } from '@/constants';
import { buildAreaJsonLd, buildPageMeta } from '@/lib/seo';

import type { Route } from './+types/area';
import styles from './area.module.css';
import { CentrePage, centreMeta } from './centre';
import NotFoundPage, { meta as notFoundMeta } from './not-found';

export function meta({ params }: Route.MetaArgs) {
  const centre = findCentre(params.slug);
  if (centre) return centreMeta(centre);
  const area = findArea(params.slug);
  if (!area) return notFoundMeta();
  const path = areaPath(area.slug);
  return [
    ...buildPageMeta(area.seo, path),
    buildAreaJsonLd({ name: area.name, path, suburbs: area.suburbs.map((suburb) => suburb.name) }),
  ];
}

export default function AreaRoute() {
  const { slug } = useParams();
  const centre = findCentre(slug);
  if (centre) return <CentrePage centre={centre} />;
  const area = findArea(slug);
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
        <ButtonLink href={sectionLink(SECTION_IDS.contact)}>{AREA_PAGE.cta}</ButtonLink>
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

      <Section heading={AREA_PAGE.suburbsHeading}>
        <ul className={styles.tags}>
          {area.suburbs.map((suburb) => {
            // A centre suburb opens its own page; the others open Google Maps (owner's choice).
            const centrePath = centrePathFor(suburb.name);
            return (
              <li key={suburb.name}>
                {centrePath ? (
                  <a href={centrePath}>{AREA_PAGE.hashtag(suburb.name)}</a>
                ) : (
                  <a
                    href={AREA_PAGE.mapsUrl(suburb.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {AREA_PAGE.hashtag(suburb.name)}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section heading={AREA_PAGE.otherHeading} tone="subtle">
        <ul className={styles.links}>
          {others.map((other) => (
            <li key={other.slug}>
              <a href={areaPath(other.slug)}>{other.name}</a>
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
