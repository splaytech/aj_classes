// Page paths and on-page section anchors.
// Nav links and section `id`s both read from here, so they can never drift apart.

export const ROUTES = {
  home: '/',
  privacy: '/privacy',
  notFound: '/404',
  sitemap: '/sitemap.xml',
  robots: '/robots.txt',
  subscribed: '/subscribed', // Kit sends people here after they confirm their subscription
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
