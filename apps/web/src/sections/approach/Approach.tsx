// "Our Approach": teaching philosophy and the four steps (Assess → Plan → Practise → Review).

import { Section } from '@/components/ui';
import { APPROACH, SECTION_IDS } from '@/constants';

import styles from './Approach.module.css';

export function Approach() {
  if (APPROACH.paragraphs.length === 0) return null;

  return (
    <Section id={SECTION_IDS.approach} heading={APPROACH.heading} tone="subtle">
      {APPROACH.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

      <ol className={styles.steps}>
        {APPROACH.steps.map((step, index) => (
          <li key={step.name} className={styles.step}>
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <h3>{step.name}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
