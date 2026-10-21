// Application configuration.
// This is the ONLY file allowed to read environment variables (PRP F8.4).

import { resolveAppEnvironment } from './app-environment.constants';

const env = import.meta.env;

const environment = resolveAppEnvironment(env.VITE_APP_ENV, env.DEV);
const isProduction = environment === 'production';

// Kit (formerly ConvertKit) form that receives newsletter sign-ups. The form ID is public and
// safe in the browser. Until it's set, the footer sign-up form is hidden.
const kitFormId: string = env.VITE_KIT_FORM_ID || '';

export const APP_CONFIG = {
  environment,
  isProduction,
  // Branch and commit of this build, shown on the staging and dev label (set in vite.config.ts).
  build: {
    branch: env.VITE_BUILD_BRANCH || '',
    commit: env.VITE_BUILD_COMMIT || '',
  },
  siteUrl: env.VITE_SITE_URL || 'https://ajclasses.com.au',
  language: 'en-AU',
  ogLocale: 'en_AU',
  themeColor: '#2563eb', // browser toolbar colour on mobile (matches --color-primary)

  // Turn whole features on or off without touching components.
  features: {
    announcement: true,
    subscribe: kitFormId !== '', // footer newsletter sign-up (needs a Kit form ID)
    analytics: isProduction, // staging and dev visits never count (environments.md E4)
  },

  // Hosted form service (Web3Forms). The access key is public by design.
  form: {
    endpoint: 'https://api.web3forms.com/submit',
    accessKey: env.VITE_FORM_ACCESS_KEY || '',
    senderName: 'AJ Classes Website', // shown as the "From" name on notification emails
  },

  // Newsletter sign-ups go to Kit, which emails a confirmation link (double opt-in).
  newsletter: {
    kitFormId,
    kitFormUrl: 'https://app.convertkit.com/forms/{formId}/subscriptions',
  },

  // Hero flyer slideshow: time each slide stays before moving on.
  heroSlideshow: {
    secondsPerSlide: 6,
  },
} as const;

// Limits used by form validation.
export const FORM_LIMITS = {
  nameMin: 2,
  nameMax: 100,
  messageMax: 2000,
} as const;

// Static files in /public.
export const ASSETS = {
  logo: '/logo.svg',
  favicon: '/favicon.svg',
  appleTouchIcon: '/apple-touch-icon.png', // icon when a parent adds the site to their phone's home screen
} as const;
