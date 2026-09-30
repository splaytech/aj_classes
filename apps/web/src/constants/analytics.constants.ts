// Analytics event and property names. Never include personal details in events.

export const ANALYTICS_EVENTS = {
  ctaClick: 'cta_click',
  formSubmitSuccess: 'form_submit_success',
  formSubmitError: 'form_submit_error',
  subscribeSuccess: 'subscribe_success',
} as const;

// Where on the page a CTA was clicked (sent with ANALYTICS_EVENTS.ctaClick).
export const CTA_LOCATIONS = {
  header: 'header',
  announcement: 'announcement',
  heroPrimary: 'hero_primary',
  heroSecondary: 'hero_secondary',
} as const;
