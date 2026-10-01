// True when the visitor has asked their device to reduce motion (an accessibility setting).
// Uses React's useSyncExternalStore, which keeps the value in sync with the browser setting.

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Tells React to re-check whenever the visitor changes the setting. */
function subscribe(onChange: () => void) {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

/** The current setting in the browser. */
function getBrowserValue(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** During pre-rendering there is no browser, so assume motion is fine. */
function getPrerenderValue(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getBrowserValue, getPrerenderValue);
}
