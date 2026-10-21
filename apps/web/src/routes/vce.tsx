// VCE tutoring page (Release 1, docs/requirements/release-1/vce-page.md). Wording lives in
// content.constants.ts → VCE_PAGE and VCE_SUBJECTS.

import { SiteLayout } from '@/components/layout/SiteLayout';
import { ButtonLink, Section } from '@/components/ui';
import { ROUTES, SECTION_IDS, SEO, VCE_PAGE, VCE_SUBJECTS, sectionLink } from '@/constants';
import { buildPageMeta } from '@/lib/seo';

import styles from './vce.module.css';

export function meta() {
  return buildPageMeta(SEO.vce, ROUTES.vce);
}

export default function VcePage() {
  return (
    <SiteLayout>
      <Section>
        <h1>{VCE_PAGE.heading}</h1>
        <p className={styles.intro}>{VCE_PAGE.intro}</p>
        <p>{VCE_PAGE.deliveryText}</p>
        <ButtonLink href={sectionLink(SECTION_IDS.contact)}>{VCE_PAGE.cta}</ButtonLink>
      </Section>

      <Section heading={VCE_PAGE.subjectsHeading} tone="subtle">
        <p>{VCE_PAGE.subjectsIntro}</p>
        <ul className={styles.subjects}>
          {VCE_SUBJECTS.map((subject) => (
            <li key={subject.name} className={styles.subject}>
              <span className={styles.tag}>{VCE_PAGE.unitsLabel}</span>
              <h3>{subject.name}</h3>
              <p className={styles.area}>{subject.area}</p>
              <p>{subject.summary}</p>
            </li>
          ))}
        </ul>
        <p>
          <a href={VCE_PAGE.studyDesignsUrl} target="_blank" rel="noopener noreferrer">
            {VCE_PAGE.studyDesignsLink}
          </a>
        </p>
      </Section>

      <Section heading={VCE_PAGE.teachersHeading}>
        {VCE_PAGE.teachersText.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </Section>

      <Section heading={VCE_PAGE.approachHeading} tone="subtle">
        <ul className={styles.points}>
          {VCE_PAGE.approachPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </Section>

      <Section heading={VCE_PAGE.counsellingHeading}>
        <p>{VCE_PAGE.counsellingText}</p>
        <ButtonLink href={sectionLink(SECTION_IDS.contact)}>{VCE_PAGE.cta}</ButtonLink>
        <p className={styles.back}>
          <a href={ROUTES.home}>{VCE_PAGE.backHome}</a>
        </p>
      </Section>
    </SiteLayout>
  );
}
