// "About Us": the AJ Classes story and a team description (no individual profiles in R1).

import { CredentialBadge, Section } from '@/components/ui';
import { ABOUT, SECTION_IDS } from '@/constants';

import styles from './About.module.css';

export function About() {
  return (
    <Section id={SECTION_IDS.about} heading={ABOUT.heading} tone="subtle">
      <p>{ABOUT.story}</p>

      <div className={styles.team}>
        <h3>{ABOUT.teamHeading}</h3>
        <p>{ABOUT.team}</p>
        <CredentialBadge>{ABOUT.badge}</CredentialBadge>
      </div>
    </Section>
  );
}
