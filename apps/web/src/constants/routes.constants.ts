// Page paths and on-page section anchors.
// Nav links and section `id`s both read from here, so they can never drift apart.

export const ROUTES = {
  home: '/',
  privacy: '/privacy',
  notFound: '/404',
  sitemap: '/sitemap.xml',
  robots: '/robots.txt',
} as const;

// Staff portal (R2a). Everything private lives under /portal, so each host needs one
// rewrite rule and search engines one Disallow line (design §11.1).
export const PORTAL_ROUTES = {
  root: '/portal',
  login: '/portal/login',
  loginVerify: '/portal/login/verify',
  forgotPassword: '/portal/forgot-password',
  authConfirm: '/portal/auth/confirm',
  setPassword: '/portal/set-password',
  account: '/portal/account',
  twoStepSetup: '/portal/account/two-step/setup',
  tutor: '/portal/tutor',
  admin: '/portal/admin',
} as const;

// Query-string names used by portal pages and email links.
export const PORTAL_QUERY = {
  next: 'next', // where to go after signing in
  reason: 'reason', // why the person was sent to the sign-in page
  tokenHash: 'token_hash', // from invite and reset emails (supabase/templates)
  linkType: 'type',
} as const;

// Values of PORTAL_QUERY.reason.
export const SIGN_IN_REASONS = {
  inactive: 'inactive',
  passwordChanged: 'password-changed',
} as const;

export const SECTION_IDS = {
  main: 'main-content',
  results: 'results',
  programmes: 'programmes',
  approach: 'approach',
  about: 'about',
  ctaBanner: 'get-started',
  faq: 'faq',
  contact: 'contact',
  askQuestion: 'ask-a-question', // same form, with "General question" preselected
} as const;

/** Builds an in-page link such as "/#contact". */
export function sectionLink(sectionId: string): string {
  return `${ROUTES.home}#${sectionId}`;
}

// Other element ids that need to be shared between components (e.g. aria-controls).
export const ELEMENT_IDS = {
  mainNavigation: 'main-navigation',
  hero: 'hero', // the mobile CTA bar appears once this has scrolled out of view
  subscribeEmail: 'subscribe-email',
  contactFieldPrefix: 'contact-',
  contactDetailsHeading: 'contact-details-heading',
} as const;
