// A page section with a background tone and an optional heading.
// Tones alternate down the page so sections are easy to tell apart (PRP F2.4).

import type { ReactNode } from 'react';

import { Container } from './Container';
import styles from './Section.module.css';

type Tone = 'default' | 'subtle' | 'inverse';

type SectionProps = {
  id?: string;
  heading?: string;
  tone?: Tone;
  children: ReactNode;
};

export function Section({ id, heading, tone = 'default', children }: SectionProps) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <section id={id} className={`${styles.section} ${styles[tone]}`} aria-labelledby={headingId}>
      <Container>
        {heading && <h2 id={headingId}>{heading}</h2>}
        {children}
      </Container>
    </section>
  );
}
