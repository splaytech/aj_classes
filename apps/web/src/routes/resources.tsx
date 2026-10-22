// Parent guides: the list (/resources). Content: constants/resources.constants.ts.

import { SiteLayout } from '@/components/layout/SiteLayout';
import { Section } from '@/components/ui';
import { GUIDES, RESOURCES, ROUTES, resourcePath } from '@/constants';
import { buildPageMeta } from '@/lib/seo';

import styles from './resources.module.css';

export function meta() {
  return buildPageMeta(RESOURCES.seo, ROUTES.resources);
}

export default function ResourcesPage() {
  return (
    <SiteLayout>
      <Section>
        <h1>{RESOURCES.heading}</h1>
        <p className={styles.intro}>{RESOURCES.intro}</p>
        <ul className={styles.guides}>
          {GUIDES.map((guide) => (
            <li key={guide.slug} className={styles.guide}>
              <h2>{guide.title}</h2>
              <p>{guide.summary}</p>
              <a
                className={styles.more}
                href={resourcePath(guide.slug)}
                aria-label={RESOURCES.readGuideLabel(guide.title)}
              >
                {RESOURCES.readGuide}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </SiteLayout>
  );
}
