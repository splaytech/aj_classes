// "Our 2026 results": a few headline numbers as proof (no student names; PRP T14).

import { Section } from '@/components/ui';
import { RESULTS, SECTION_IDS } from '@/constants';

import styles from './Results.module.css';

export function Results() {
  if (RESULTS.items.length === 0) return null;

  return (
    <Section id={SECTION_IDS.results} heading={RESULTS.heading}>
      <ul className={styles.stats}>
        {RESULTS.items.map((item) => (
          <li key={item.label} className={styles.stat}>
            <span className={styles.value}>{item.value}</span>
            <span className={styles.label}>{item.label}</span>
            {item.detail && <span className={styles.detail}>{item.detail}</span>}
          </li>
        ))}
      </ul>
      {RESULTS.note && <p className={styles.note}>{RESULTS.note}</p>}
    </Section>
  );
}
