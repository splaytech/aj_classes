// "Our Approach": teaching philosophy and the four steps (Assess → Plan → Practise → Review).
// Each step has its own icon, a tint that deepens step by step and a progress bar, so the
// cards are easy to tell apart and read in order (ui-polish.md §3, item 2).

import type { CSSProperties } from 'react';

import { APPROACH_STEP_ICONS } from '@/components/icons/site-icons';
import { Section } from '@/components/ui';
import { APPROACH, SECTION_IDS } from '@/constants';

import styles from './Approach.module.css';

export function Approach() {
  if (APPROACH.paragraphs.length === 0) return null;

  const total = APPROACH.steps.length;

  return (
    <Section id={SECTION_IDS.approach} heading={APPROACH.heading}>
      {APPROACH.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

      <ol className={styles.steps} style={{ '--steps': total } as CSSProperties}>
        {APPROACH.steps.map((step, index) => {
          const Icon = APPROACH_STEP_ICONS[step.id];
          return (
            <li
              key={step.id}
              className={styles.step}
              style={{ '--step': index + 1 } as CSSProperties}
            >
              <div className={styles.top}>
                <span className={styles.icon}>
                  <Icon aria-hidden="true" />
                </span>
                <span className={styles.stepLabel}>{APPROACH.stepLabel(index + 1, total)}</span>
              </div>
              <h3>{step.name}</h3>
              {step.assertion ? <p className={styles.assertion}>{step.assertion}</p> : null}
              <p>{step.text}</p>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
