// "Programmes": what we teach, with the year levels for each (PRP T3–T6). Each card links to
// the programme's own page (programme-pages.md).

import { Section } from '@/components/ui';
import { PROGRAMMES, SECTION_IDS, programmePath } from '@/constants';

import styles from './Programmes.module.css';

export function Programmes() {
  if (PROGRAMMES.items.length === 0) return null;

  return (
    <Section id={SECTION_IDS.programmes} heading={PROGRAMMES.heading} tone="subtle">
      <p>{PROGRAMMES.intro}</p>

      <ul className={styles.cards}>
        {PROGRAMMES.items.map((programme) => (
          <li key={programme.slug} className={styles.card}>
            <div className={styles.tags}>
              {programme.years && <span className={styles.years}>{programme.years}</span>}
              {programme.isNew && <span className={styles.newBadge}>{PROGRAMMES.newBadge}</span>}
            </div>
            <h3>{programme.title}</h3>
            <ul className={styles.points}>
              {programme.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <a
              className={styles.more}
              href={programmePath(programme.slug)}
              aria-label={PROGRAMMES.moreLinkLabel(programme.title)}
            >
              {PROGRAMMES.moreLink}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}
