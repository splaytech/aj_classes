// Builds the <head> tags for each page and the structured data Google reads (JSON-LD).

import type { MetaDescriptor } from 'react-router';

import { APP_CONFIG, BUSINESS, FAQ, ROUTES, SOCIAL_PREVIEW, STRUCTURED_DATA } from '@/constants';
import { getVisibleSocialLinks } from './social';

type PageSeo = {
  title: string;
  description: string;
};

/** Turns a site path such as "/privacy" into a full URL. */
export function absoluteUrl(path: string): string {
  return new URL(path, APP_CONFIG.siteUrl).toString();
}

/** Standard tags for a page: title, description, canonical URL and social previews. */
export function buildPageMeta(page: PageSeo, path: string): MetaDescriptor[] {
  const url = absoluteUrl(path);
  const imageUrl = absoluteUrl(SOCIAL_PREVIEW.imagePath);

  return [
    { title: page.title },
    { name: 'description', content: page.description },
    { tagName: 'link', rel: 'canonical', href: url },

    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: BUSINESS.name },
    { property: 'og:locale', content: APP_CONFIG.ogLocale },
    { property: 'og:title', content: page.title },
    { property: 'og:description', content: SOCIAL_PREVIEW.shortDescription },
    { property: 'og:url', content: url },
    { property: 'og:image', content: imageUrl },
    { property: 'og:image:width', content: SOCIAL_PREVIEW.imageWidth },
    { property: 'og:image:height', content: SOCIAL_PREVIEW.imageHeight },
    { property: 'og:image:alt', content: SOCIAL_PREVIEW.imageAlt },

    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: page.title },
    { name: 'twitter:description', content: SOCIAL_PREVIEW.shortDescription },
    { name: 'twitter:image', content: imageUrl },
  ];
}

/** Tag that keeps a page out of search results (used for the 404 page). */
export function noIndexMeta(): MetaDescriptor {
  return { name: 'robots', content: 'noindex' };
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
