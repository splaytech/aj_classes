// Builds the <head> tags for each page and the structured data Google reads (JSON-LD).

import type { MetaDescriptor } from 'react-router';

import {
  APP_CONFIG,
  BUSINESS,
  CURRENT_MARKER,
  FAQ,
  PORTAL_SEO,
  ROUTES,
  SECTION_IDS,
  SOCIAL_PREVIEW,
  STRUCTURED_DATA,
} from '@/constants';
import type { EnvironmentMarker } from '@/constants';
import { getVisibleSocialLinks } from './social';

type PageSeo = {
  title: string;
  description: string;
};

/** Turns a site path such as "/privacy" into a full URL. */
export function absoluteUrl(path: string): string {
  return new URL(path, APP_CONFIG.siteUrl).toString();
}

/** Page title as shown in the tab: "[STAGING] …" or "[DEV] …" outside production. */
export function environmentTitle(
  title: string,
  marker: EnvironmentMarker | null = CURRENT_MARKER,
): string {
  return marker ? `${marker.titlePrefix}${title}` : title;
}

/**
 * Standard tags for a page: title, description, canonical URL and social previews.
 * Outside production every page is also kept out of search results (environments.md G6).
 * Pass `noIndex` to keep a page out in production too; the tag is emitted once either way.
 */
export function buildPageMeta(
  page: PageSeo,
  path: string,
  { noIndex = false }: { noIndex?: boolean } = {},
): MetaDescriptor[] {
  const title = environmentTitle(page.title);
  const url = absoluteUrl(path);
  const imageUrl = absoluteUrl(SOCIAL_PREVIEW.imagePath);
  const searchTags = noIndex || !APP_CONFIG.isProduction ? [noIndexMeta()] : [];

  return [
    ...searchTags,
    { title },
    { name: 'description', content: page.description },
    { tagName: 'link', rel: 'canonical', href: url },

    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: BUSINESS.name },
    { property: 'og:locale', content: APP_CONFIG.ogLocale },
    { property: 'og:title', content: title },
    { property: 'og:description', content: SOCIAL_PREVIEW.shortDescription },
    { property: 'og:url', content: url },
    { property: 'og:image', content: imageUrl },
    { property: 'og:image:width', content: SOCIAL_PREVIEW.imageWidth },
    { property: 'og:image:height', content: SOCIAL_PREVIEW.imageHeight },
    { property: 'og:image:alt', content: SOCIAL_PREVIEW.imageAlt },

    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: SOCIAL_PREVIEW.shortDescription },
    { name: 'twitter:image', content: imageUrl },
  ];
}

/** Tag that keeps a page out of search results (404 page, staff portal). */
export function noIndexMeta(): MetaDescriptor {
  return { name: 'robots', content: 'noindex' };
}

/** Head tags for a staff portal page: a title, and never indexed (R2a design §13). */
export function buildPortalMeta(pageTitle: string): MetaDescriptor[] {
  return [{ title: pageTitle + PORTAL_SEO.titleSuffix }, noIndexMeta()];
}

/** Structured data for the home page: the business, the website and the FAQ. */
export function buildHomeJsonLd(): MetaDescriptor {
  const organizationId = absoluteUrl('/#organization');

  const organization = {
    '@type': ['EducationalOrganization', 'LocalBusiness'],
    '@id': organizationId,
    name: BUSINESS.name,
    url: absoluteUrl(ROUTES.home),
    logo: absoluteUrl(STRUCTURED_DATA.logoPath),
    image: absoluteUrl(SOCIAL_PREVIEW.imagePath),
    description: STRUCTURED_DATA.description,
    email: BUSINESS.email,
    ...(BUSINESS.phone ? { telephone: BUSINESS.phone } : {}),
    address: {
      '@type': 'PostalAddress',
      addressRegion: BUSINESS.state,
      addressCountry: BUSINESS.country,
    },
    areaServed: [
      ...BUSINESS.suburbs.map((suburb) => ({
        '@type': 'Place',
        name: `${suburb} ${BUSINESS.state}`,
      })),
      { '@type': 'City', name: BUSINESS.city },
      { '@type': 'Country', name: BUSINESS.countryName },
    ],
    knowsAbout: STRUCTURED_DATA.knowsAbout,
    sameAs: getVisibleSocialLinks().map((link) => link.url),
  };

  const website = {
    '@type': 'WebSite',
    url: absoluteUrl(ROUTES.home),
    name: BUSINESS.name,
    inLanguage: APP_CONFIG.language,
    publisher: { '@id': organizationId },
  };

  const faqPage = {
    '@type': 'FAQPage',
    mainEntity: FAQ.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return {
    'script:ld+json': {
      '@context': 'https://schema.org',
      '@graph': [organization, website, faqPage],
    },
  };
}

type Crumb = { name: string; path: string };

function breadcrumbList(crumbs: Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/** Structured data for a programme page: the course (by AJ Classes) and its breadcrumb trail. */
export function buildProgrammeJsonLd(programme: {
  title: string;
  description: string;
  path: string;
}): MetaDescriptor {
  const course = {
    '@type': 'Course',
    name: programme.title,
    description: programme.description,
    url: absoluteUrl(programme.path),
    inLanguage: APP_CONFIG.language,
    provider: {
      '@type': 'EducationalOrganization',
      '@id': absoluteUrl('/#organization'),
      name: BUSINESS.name,
      url: absoluteUrl(ROUTES.home),
    },
  };
  const trail = breadcrumbList([
    { name: STRUCTURED_DATA.breadcrumbs.home, path: ROUTES.home },
    {
      name: STRUCTURED_DATA.breadcrumbs.programmes,
      path: `${ROUTES.home}#${SECTION_IDS.programmes}`,
    },
    { name: programme.title, path: programme.path },
  ]);

  return { 'script:ld+json': { '@context': 'https://schema.org', '@graph': [course, trail] } };
}

/** Structured data for a parent guide: an article by AJ Classes and its breadcrumb trail. */
export function buildGuideJsonLd(guide: {
  title: string;
  description: string;
  path: string;
}): MetaDescriptor {
  const organization = { '@id': absoluteUrl('/#organization'), name: BUSINESS.name };
  const article = {
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    url: absoluteUrl(guide.path),
    inLanguage: APP_CONFIG.language,
    author: { '@type': 'EducationalOrganization', ...organization },
    publisher: { '@type': 'EducationalOrganization', ...organization },
  };
  const trail = breadcrumbList([
    { name: STRUCTURED_DATA.breadcrumbs.home, path: ROUTES.home },
    { name: STRUCTURED_DATA.breadcrumbs.resources, path: ROUTES.resources },
    { name: guide.title, path: guide.path },
  ]);

  return { 'script:ld+json': { '@context': 'https://schema.org', '@graph': [article, trail] } };
}
