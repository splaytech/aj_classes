// One flyer in the hero slideshow. The whole flyer is a link to the contact form.

import { SECTION_IDS, sectionLink } from '@/constants';
import type { HeroSlide } from '@/constants';

import { FlyerArt } from './FlyerArt';
import styles from './HeroSlideshow.module.css';

type FlyerSlideProps = {
  slide: HeroSlide;
  isActive: boolean;
  label: string; // e.g. "Slide 2 of 4", read out by screen readers
};

export function FlyerSlide({ slide, isActive, label }: FlyerSlideProps) {
  return (
    <div
      className={styles.slide}
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      inert={!isActive} // hidden slides can't be tabbed into or read out
    >
      <a
        className={`${styles.flyer} ${styles[slide.tone]}`}
        href={sectionLink(SECTION_IDS.contact)}
      >
        <span className={styles.eyebrow}>{slide.eyebrow}</span>
        <span className={styles.title}>{slide.title}</span>
        <span className={styles.art}>
          <FlyerArt art={slide.art} />
        </span>
        <ul className={styles.points}>
          {slide.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <span className={styles.cta}>{slide.cta}</span>
      </a>
    </div>
  );
}
