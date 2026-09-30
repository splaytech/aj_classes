// Frequently asked questions as an accordion. <details>/<summary> gives us keyboard
// and screen-reader support for free, with no JavaScript (PRP F2.9).

import { Section } from '@/components/ui';
import { FAQ, SECTION_IDS } from '@/constants';

import styles from './Faq.module.css';

export function Faq() {
  if (FAQ.items.length === 0) return null;

  return (
    <Section id={SECTION_IDS.faq} heading={FAQ.heading} tone="subtle">
      <div className={styles.list}>
        {FAQ.items.map((item) => (
          <details key={item.question} className={styles.item}>
            <summary className={styles.question}>{item.question}</summary>
            <p className={styles.answer}>{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
