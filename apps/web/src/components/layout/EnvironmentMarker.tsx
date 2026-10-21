// A coloured strip across the top and a small label ("STAGING · develop · a847dd0"), so staging
// and dev are never mistaken for the live site. Renders nothing on production (environments.md).

import { APP_CONFIG, CURRENT_MARKER } from '@/constants';

import styles from './EnvironmentMarker.module.css';

const SEPARATOR = ' · ';

export function EnvironmentMarker() {
  if (!CURRENT_MARKER) return null;

  const { branch, commit } = APP_CONFIG.build;
  const label = [CURRENT_MARKER.label, branch, commit].filter(Boolean).join(SEPARATOR);
  const className = `${styles.marker} ${styles[APP_CONFIG.environment]}`;

  // Decoration only: hidden from screen readers and never in the way of a click (G4).
  return (
    <div className={className} aria-hidden="true">
      <span className={styles.label}>{label}</span>
    </div>
  );
}
