// Top of the home page: announcement pill, headline, supporting line, CTAs and proof points.

import { ButtonLink, Container } from '@/components/ui';
import {
  ANALYTICS_EVENTS,
  ANNOUNCEMENT,
  APP_CONFIG,
  CTA_LOCATIONS,
  ELEMENT_IDS,
  HERO,
  SECTION_IDS,
  sectionLink,
} from '@/constants';
import { trackEvent } from '@/lib/analytics';

import styles from './Hero.module.css';
import { HeroSlideshow } from './HeroSlideshow';

function trackCta(location: string) {
  trackEvent(ANALYTICS_EVENTS.ctaClick, { location });
}

export function Hero() {
  const contactLink = sectionLink(SECTION_IDS.contact);

  return (
    <section id={ELEMENT_IDS.hero} className={styles.hero}>
      <Container>
        <div className={styles.layout}>
          <div>
            {APP_CONFIG.features.announcement && (
              <a
                className={styles.announcement}
                href={contactLink}
                onClick={() => trackCta(CTA_LOCATIONS.announcement)}
              >
                <span aria-hidden="true">{ANNOUNCEMENT.icon}</span>
                <span>{ANNOUNCEMENT.text}</span>
                <strong>{ANNOUNCEMENT.cta}</strong>
              </a>
            )}

            <h1>{HERO.headline}</h1>
            <p className={styles.supporting}>{HERO.supporting}</p>

            <div className={styles.actions}>
              <ButtonLink href={contactLink} onClick={() => trackCta(CTA_LOCATIONS.heroPrimary)}>
                {HERO.primaryCta}
              </ButtonLink>
              <ButtonLink
                href={sectionLink(SECTION_IDS.askQuestion)}
                variant="secondary"
                onClick={() => trackCta(CTA_LOCATIONS.heroSecondary)}
              >
                {HERO.secondaryCta}
              </ButtonLink>
            </div>

            <ul className={styles.proofPoints}>
              {HERO.proofPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>

          <HeroSlideshow />
        </div>
      </Container>
    </section>
  );
}
