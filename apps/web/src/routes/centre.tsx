// One page per in-person centre at /tutoring/:slug (local-seo.md): Truganina, Williams Landing and
// Craigieburn. Wording lives in areas.constants.ts → CENTRES. area.tsx owns the route and hands a
// centre slug to this page; it shares the area page's styles.

import type { MetaDescriptor } from 'react-router';

import { SiteLayout } from '@/components/layout/SiteLayout';
import { ButtonLink, Section } from '@/components/ui';
import {
  AREA_PAGE,
  BUSINESS,
  CENTRES,
  CENTRE_PAGE,
  PROGRAMMES,
  ROUTES,
  SECTION_IDS,
  areaPath,
  findArea,
  programmePath,
  sectionLink,
} from '@/constants';
import type { Centre } from '@/constants';
import { buildAreaJsonLd, buildPageMeta } from '@/lib/seo';

import styles from './area.module.css';

export function centreMeta(centre: Centre): MetaDescriptor[] {
  const path = areaPath(centre.slug);
  const area = findArea(centre.areaSlug);
  return [
    ...buildPageMeta(centre.seo, path),
    buildAreaJsonLd({
      name: centre.name,
      path,
      suburbs: [centre.name, ...centre.nearby],
      ...(area ? { parent: { name: AREA_PAGE.title(area.name), path: areaPath(area.slug) } } : {}),
    }),
  ];
}

export function CentrePage({ centre }: { centre: Centre }) {
  const others = CENTRES.filter((other) => other.slug !== centre.slug);
  const area = findArea(centre.areaSlug);

  return (
    <SiteLayout>
      <Section>
        <h1>{AREA_PAGE.title(centre.name)}</h1>
        <p className={styles.intro}>{centre.intro}</p>
        <ButtonLink href={sectionLink(SECTION_IDS.contact)}>{AREA_PAGE.cta}</ButtonLink>
      </Section>

      <Section heading={centre.localHeading} tone="subtle">
        {centre.localParagraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p>
          <a href={BUSINESS.googleMapsUrl} target="_blank" rel="noopener noreferrer">
            {CENTRE_PAGE.reviewsLabel}
          </a>
        </p>
      </Section>

      <Section heading={CENTRE_PAGE.helpfulHeading(centre.name)}>
        <ul className={styles.links}>
          {centre.links.map((link) => (
            <li key={link.href}>
              <a href={link.href}>{link.label}</a>
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

      <Section heading={CENTRE_PAGE.questionsHeading} tone="subtle">
        {centre.questions.map((item) => (
          <div key={item.question} className={styles.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </Section>

      <Section heading={CENTRE_PAGE.otherHeading}>
        <ul className={styles.links}>
          {others.map((other) => (
            <li key={other.slug}>
              <a href={areaPath(other.slug)}>{AREA_PAGE.title(other.name)}</a>
            </li>
          ))}
          {area && (
            <li>
              <a href={areaPath(area.slug)}>{CENTRE_PAGE.areaLinkLabel(area.name)}</a>
            </li>
          )}
        </ul>
        <p className={styles.back}>
          <a href={ROUTES.home}>{AREA_PAGE.backHome}</a>
        </p>
      </Section>
    </SiteLayout>
  );
}
