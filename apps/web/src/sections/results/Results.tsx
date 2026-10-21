// "Our 2026 results": headline numbers as proof (no student names; PRP T14). Each card shows
// an icon, the figure, what it's for and what it's made of, so it reads at a glance
// (ui-polish.md §3, item 1).

import { TrendingUp } from 'lucide-react';

import { RESULT_ICONS } from '@/components/icons/site-icons';
import { Section } from '@/components/ui';
import { RESULTS, SECTION_IDS } from '@/constants';

import styles from './Results.module.css';

export function Results() {
  if (RESULTS.items.length === 0) return null;

  return (
    <Section id={SECTION_IDS.results} heading={RESULTS.heading}>
      <ul className={styles.stats}>
        {RESULTS.items.map((item) => {
          const Icon = RESULT_ICONS[item.id];
          return (
            <li key={item.id} className={styles.stat}>
              <div className={styles.headline}>
                <span className={styles.icon}>
                  <Icon aria-hidden="true" />
                </span>
                <span className={styles.value}>{item.value}</span>
              </div>
              <span className={styles.label}>{item.label}</span>
              {item.breakdown.length > 0 && (
                <ul className={styles.breakdown}>
                  {item.breakdown.map((part) => (
                    <li key={part.label}>
                      <span>{part.label}</span>
                      <span className={styles.count}>{part.value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {RESULTS.note && (
        <p className={styles.note}>
          <TrendingUp className={styles.noteIcon} aria-hidden="true" />
          {RESULTS.note}
        </p>
      )}
    </Section>
  );
}
