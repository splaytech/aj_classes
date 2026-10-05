// Application configuration.
// This is the ONLY file allowed to read environment variables (PRP F8.4).

const env = import.meta.env;

// Kit (formerly ConvertKit) form that receives newsletter sign-ups. The form ID is public and
// safe in the browser. Until it's set, the footer sign-up form is hidden.
const kitFormId: string = env.VITE_KIT_FORM_ID || '';

export const APP_CONFIG = {
  siteUrl: env.VITE_SITE_URL || 'https://ajclasses.com.au',
  language: 'en-AU',
  ogLocale: 'en_AU',
  themeColor: '#2563eb', // browser toolbar colour on mobile (matches --color-primary)

  // Turn whole features on or off without touching components.
  features: {
    announcement: true,
    subscribe: kitFormId !== '', // footer newsletter sign-up (needs a Kit form ID)
    analytics: true,
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
