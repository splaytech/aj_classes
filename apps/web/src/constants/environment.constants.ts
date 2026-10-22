// How staging and dev mark themselves so they're never mistaken for the live site
// (docs/requirements/release-1/environments.md). Production has no marker and looks unchanged.

import { APP_CONFIG } from './app.constants';
import type { AppEnvironment } from './app-environment.constants';

export type EnvironmentMarker = {
  label: string;
  titlePrefix: string;
  favicon: string;
  /** Phone browser bar colour. Matches --color-env-* in theme.css. */
  themeColor: string;
};

export const ENVIRONMENT_MARKERS: Record<AppEnvironment, EnvironmentMarker | null> = {
  production: null,
  staging: {
    label: 'STAGING',
    titlePrefix: '[STAGING] ',
    favicon: '/favicon-staging.svg',
    themeColor: '#f59e0b',
  },
  development: {
    label: 'DEV',
    titlePrefix: '[DEV] ',
    favicon: '/favicon-dev.svg',
    themeColor: '#dc2626',
  },
};

/** This build's marker, or null on production. */
export const CURRENT_MARKER = ENVIRONMENT_MARKERS[APP_CONFIG.environment];
