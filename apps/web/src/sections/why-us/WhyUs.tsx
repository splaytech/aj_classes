// "Why AJ Classes": 3–4 short value cards on the navy band.

import { Section } from '@/components/ui';
import { WHY_US } from '@/constants';

import styles from './WhyUs.module.css';

export function WhyUs() {
  if (WHY_US.cards.length === 0) return null;

  return (
    <Section heading={WHY_US.heading} tone="inverse">
      <ul className={styles.cards}>
        {WHY_US.cards.map((card) => (
          <li key={card.title} className={styles.card}>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
