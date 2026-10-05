// Sticky "Register Interest" bar at the bottom of the screen on phones (PRP F2.6).
// It appears once the hero has scrolled away and hides again when the form comes into view.

import { ButtonLink } from '@/components/ui';
import {
  ANALYTICS_EVENTS,
  CTA_LOCATIONS,
  ELEMENT_IDS,
  MOBILE_CTA_BAR,
  SECTION_IDS,
  sectionLink,
} from '@/constants';
import { trackEvent } from '@/lib/analytics';
import { useElementPosition } from '@/lib/use-element-position';

import styles from './MobileCtaBar.module.css';

function trackClick() {
  trackEvent(ANALYTICS_EVENTS.ctaClick, { location: CTA_LOCATIONS.mobileBar });
}

export function MobileCtaBar() {
  const heroPosition = useElementPosition(ELEMENT_IDS.hero, 'inView');
  const formPosition = useElementPosition(SECTION_IDS.contact, 'below');

  const isVisible = heroPosition === 'above' && formPosition === 'below';
  if (!isVisible) return null;

  return (
    <aside className={styles.bar} aria-label={MOBILE_CTA_BAR.label}>
      <ButtonLink href={sectionLink(SECTION_IDS.contact)} onClick={trackClick}>
        {MOBILE_CTA_BAR.cta}
      </ButtonLink>
    </aside>
  );
}
