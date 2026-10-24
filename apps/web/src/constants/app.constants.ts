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
  dateLocale: 'en-au', // dayjs locale for the staff portal's date and time pickers
  timeZone: 'Australia/Melbourne', // due dates and "late" use the Melbourne calendar (R3b F14)
  ogLocale: 'en_AU',
  themeColor: '#2563eb', // browser toolbar colour on mobile (matches --color-primary)

  // Turn whole features on or off without touching components.
  features: {
    announcement: true,
    subscribe: kitFormId !== '', // footer newsletter sign-up (needs a Kit form ID)
    analytics: isProduction, // staging and dev visits never count (environments.md E4)
    // Staff portal (R2a): on only when Supabase and the Turnstile check are configured.
    portal: Boolean(
      env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY && env.VITE_TURNSTILE_SITE_KEY,
    ),
    // Enquiries also saved in Supabase and sent to Zoho CRM as a lead (leads-and-crm.md). Switch on with
    // VITE_LEAD_CAPTURE=on once the `leads` function is deployed.
    leadCapture: Boolean(env.VITE_SUPABASE_URL && env.VITE_LEAD_CAPTURE === 'on'),
  },

  // Supabase: database and sign-in for the staff portal. Both values are public by design;
  // the database's access rules (RLS) protect the data. Secret keys never go here.
  supabase: {
    url: env.VITE_SUPABASE_URL || '',
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    leadsFunctionPath: '/functions/v1/leads',
  },

  // Cloudflare Turnstile "I am human" check on staff sign-in and password reset.
  turnstile: {
    siteKey: env.VITE_TURNSTILE_SITE_KEY || '',
    language: 'en',
  },

  // LOCAL DEVELOPMENT ONLY (R2a design §16.1): the dev server enters the local admin's two-step
  // code. `import.meta.env.DEV` is replaced with `false` in production builds, so there the key is
  // never read and the shortcut can't run (checked: no key or variable name in build/).
  localDev: {
    isDevServer: import.meta.env.DEV,
    adminTwoStepKey: import.meta.env.DEV ? env.VITE_LOCAL_ADMIN_TWO_STEP_KEY || '' : '',
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

// Staff sign-in rules (R2a design §8). Must match supabase/config.toml.
export const AUTH_LIMITS = {
  passwordMin: 12,
  codeLength: 6, // authenticator and emailed codes
  linkExpiryHours: 1, // invite and password-reset links
  maxAuthenticators: 2, // per admin: phone app + one backup
  authenticatorNameMax: 30,
} as const;

// Staff profile rules (R2a design §5). Must match the checks in the staff_accounts migration.
export const PROFILE_LIMITS = {
  nameMin: 2,
  nameMax: 100,
  bioMax: 1000,
  qualificationsMax: 10,
  qualificationMax: 150,
} as const;

// Profile photos (design §7.3). The browser crops, resizes and re-encodes before upload, which
// also removes location data from phone photos (review V16, V25).
export const PHOTO_LIMITS = {
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxInputBytes: 15 * 1024 * 1024, // bigger files are refused before resizing
  maxDimension: 512, // pixels, square
  outputTypes: ['image/webp', 'image/jpeg'], // first one the browser can encode
  outputQuality: 0.85,
} as const;

// Account roles, as stored in the database (profiles.role). Staff manage classes; families
// (R3b) use the student and parent pages.
export const STAFF_ROLES = ['tutor', 'admin'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const FAMILY_ROLES = ['student', 'parent'] as const;
export type FamilyRole = (typeof FAMILY_ROLES)[number];
export type AppRole = StaffRole | FamilyRole;

// Who recorded parental consent for a student's account (R3b D5): an admin (e.g. a paper
// enrolment form) or a linked parent in the portal.
export const CONSENT_SOURCES = ['admin', 'parent'] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

// Portal appearance (R3b design §6.5). Kept in this browser only.
export const THEME_MODES = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

// Keys for the few things the portal keeps in the browser.
export const STORAGE_KEYS = {
  themeMode: 'aj-classes-portal-theme',
} as const;

// Limits used by form validation.
export const FORM_LIMITS = {
  nameMin: 2,
  nameMax: 100,
  messageMax: 2000,
} as const;

// Admin daily posts (posts.md). Must match the checks in the posts migration, and listCap must
// match posts.service.ts's MAX_ROWS.
export const POST_LIMITS = {
  titleMax: 120,
  bodyMax: 5000,
  listCap: 200,
} as const;

// Static files in /public.
export const ASSETS = {
  logo: '/logo.svg',
  favicon: '/favicon.svg',
  appleTouchIcon: '/apple-touch-icon.png', // icon when a parent adds the site to their phone's home screen
} as const;

// Year levels offered in the portal's class and student forms (Release 2).
export const YEAR_LEVELS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
