// Navy band halfway down the page that sends parents to the form (one CTA label everywhere, F2.2).

import { ButtonLink, Section } from '@/components/ui';
import { ANALYTICS_EVENTS, CTA_BANNER, CTA_LOCATIONS, SECTION_IDS, sectionLink } from '@/constants';
import { trackEvent } from '@/lib/analytics';

import styles from './CtaBanner.module.css';

function trackClick() {
  trackEvent(ANALYTICS_EVENTS.ctaClick, { location: CTA_LOCATIONS.ctaBanner });
}

export function CtaBanner() {
  return (
    <Section id={SECTION_IDS.ctaBanner} heading={CTA_BANNER.heading} tone="inverse">
      <div className={styles.body}>
        <p className={styles.text}>{CTA_BANNER.text}</p>
        <ButtonLink href={sectionLink(SECTION_IDS.contact)} onClick={trackClick}>
          {CTA_BANNER.cta}
        </ButtonLink>
      </div>
    </Section>
  );
}
