// A coloured strip across the top and a small label ("STAGING · develop · a847dd0"), so staging
// and dev are never mistaken for the live site. Renders nothing on production (environments.md).
// On portal pages the label sits bottom right: under the header, top left, it covered the
// signed-in name on phones, where the portal header wraps onto two rows (actionItems 27a).

import { useSyncExternalStore } from 'react';

import { APP_CONFIG, CURRENT_MARKER } from '@/constants';

import styles from './EnvironmentMarker.module.css';

const SEPARATOR = ' · ';

export function EnvironmentMarker({ inPortal = false }: { inPortal?: boolean }) {
  const atBottom = useIsHydrated() && inPortal;
  if (!CURRENT_MARKER) return null;

  const { branch, commit } = APP_CONFIG.build;
  const label = [CURRENT_MARKER.label, branch, commit].filter(Boolean).join(SEPARATOR);
  const className = `${styles.marker} ${styles[APP_CONFIG.environment]}`;
  const labelClassName = atBottom ? `${styles.label} ${styles.labelBottom}` : styles.label;

  // Decoration only: hidden from screen readers and never in the way of a click (G4).
  return (
    <div className={className} aria-hidden="true">
      <span className={labelClassName}>{label}</span>
    </div>
  );
}

/**
 * Portal pages are served from one pre-rendered fallback page, and React keeps a pre-rendered
 * class name that differs on hydration. So this is false while hydrating (matching that page)
 * and true straight after, as in use-prefers-reduced-motion.ts.
 */
function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, isInBrowser, isPrerendering);
}

const subscribeToNothing = () => () => {};
const isInBrowser = () => true;
const isPrerendering = () => false;
