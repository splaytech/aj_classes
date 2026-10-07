// Application configuration.
// This is the ONLY file allowed to read environment variables (PRP F8.4).

const env = import.meta.env;

export const APP_CONFIG = {
  siteUrl: env.VITE_SITE_URL || 'https://ajclasses.com.au',
  language: 'en-AU',
  dateLocale: 'en-au', // dayjs locale for the staff portal's date and time pickers
  ogLocale: 'en_AU',
  themeColor: '#2563eb', // browser toolbar colour on mobile (matches --color-primary)

  // Turn whole features on or off without touching components.
  features: {
    announcement: true,
    subscribe: true,
    analytics: true,
    // Staff portal (R2a): on only when Supabase and the Turnstile check are configured.
    portal: Boolean(
      env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY && env.VITE_TURNSTILE_SITE_KEY,
    ),
  },

  // Supabase: database and sign-in for the staff portal. Both values are public by design;
  // the database's access rules (RLS) protect the data. Secret keys never go here.
  supabase: {
    url: env.VITE_SUPABASE_URL || '',
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  },

  // Cloudflare Turnstile "I am human" check on staff sign-in and password reset.
  turnstile: {
    siteKey: env.VITE_TURNSTILE_SITE_KEY || '',
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

    // hCaptcha "I am human" check (turned on in the Web3Forms dashboard). This is Web3Forms'
    // shared public sitekey: https://docs.web3forms.com/getting-started/customizations/spam-protection/hcaptcha
    captchaSiteKey: '50b2fe65-b00b-4b9e-ad62-3ba471098be2',
    captchaLanguage: 'en',
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

// Staff roles, as stored in the database (profiles.role).
export const STAFF_ROLES = ['tutor', 'admin'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

// Limits used by form validation.
export const FORM_LIMITS = {
  nameMin: 2,
  nameMax: 100,
  messageMax: 2000,
} as const;

// Year levels offered in the enquiry form (Year 2 – Year 12). A "University / graduate" option
// for UCAT and GAMSAT is added by the form itself (label in content.constants.ts).
export const YEAR_LEVELS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

// Option keys for form dropdowns and radios. Their labels live in content.constants.ts.
export const ENQUIRY_TYPES = ['registerInterest', 'generalQuestion', 'other'] as const;
export const ENQUIRER_ROLES = ['parent', 'student', 'other'] as const;
export const CONTACT_METHODS = ['phone', 'email'] as const;

export type EnquiryType = (typeof ENQUIRY_TYPES)[number];
export type EnquirerRole = (typeof ENQUIRER_ROLES)[number];
export type ContactMethod = (typeof CONTACT_METHODS)[number];

// Static files in /public.
export const ASSETS = {
  logo: '/logo.svg',
  favicon: '/favicon.svg',
  appleTouchIcon: '/apple-touch-icon.png', // icon when a parent adds the site to their phone's home screen
} as const;
