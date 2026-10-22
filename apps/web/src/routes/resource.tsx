// One parent guide at /resources/:slug, pre-rendered. Unknown slugs get the 404 page.
// Content: constants/resources.constants.ts.

import { useParams } from 'react-router';

import { SiteLayout } from '@/components/layout/SiteLayout';
import { ButtonLink, Section } from '@/components/ui';
import {
  PROGRAMMES,
  RESOURCES,
  ROUTES,
  SECTION_IDS,
  findGuide,
  programmePath,
  resourcePath,
  sectionLink,
} from '@/constants';
import type { Guide } from '@/constants';
import { buildGuideJsonLd, buildPageMeta } from '@/lib/seo';

import type { Route } from './+types/resource';
import NotFoundPage, { meta as notFoundMeta } from './not-found';
import styles from './resources.module.css';

export function meta({ params }: Route.MetaArgs) {
  const guide = findGuide(params.slug);
  if (!guide) return notFoundMeta();
  const path = resourcePath(guide.slug);
  return [
    ...buildPageMeta(guide.seo, path),
    buildGuideJsonLd({ title: guide.title, description: guide.seo.description, path }),
  ];
}

export default function ResourceRoute() {
  const guide = findGuide(useParams().slug);
  if (!guide) return <NotFoundPage />;
  return <GuidePage guide={guide} />;
}

export function GuidePage({ guide }: { guide: Guide }) {
  const programme = PROGRAMMES.items.find((item) => item.slug === guide.programme);

  return (
    <SiteLayout>
      <Section>
        <p className={styles.back}>
          <a href={ROUTES.resources}>{RESOURCES.backToGuides}</a>
        </p>
        <h1>{guide.title}</h1>
        <p className={styles.intro}>{guide.summary}</p>
        <p className={styles.checked}>{RESOURCES.checkedOn(guide.checkedOn)}</p>

        <div className={styles.article}>
          {guide.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.points && (
                <ul className={styles.points}>
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section>
            <h2>{RESOURCES.sourcesHeading}</h2>
            <p>{RESOURCES.disclaimer}</p>
            <ul>
              {guide.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Section>

      <Section heading={RESOURCES.ctaHeading} tone="subtle">
        <p>{RESOURCES.ctaText}</p>
        <div className={styles.actions}>
          <ButtonLink href={sectionLink(SECTION_IDS.contact)}>{RESOURCES.ctaContact}</ButtonLink>
          {programme && (
            <a href={programmePath(programme.slug)}>{RESOURCES.ctaProgramme(programme.title)}</a>
          )}
        </div>
      </Section>
    </SiteLayout>
  );
}
