import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BUSINESS,
  GUIDES,
  NEARBY_SUBURB_NAMES,
  PROGRAMMES,
  ROUTES,
  SEO,
  SOCIAL_LINKS,
  SOCIAL_PREVIEW,
  programmePath,
} from '@/constants';
import { meta as notFoundMeta } from '@/routes/not-found';
import { meta as subscribedMeta } from '@/routes/subscribed';

import {
  buildGuideJsonLd,
  buildHomeJsonLd,
  buildPageMeta,
  buildProgrammeJsonLd,
  buildAreaJsonLd,
} from './seo';

type Graph = { '@graph': Record<string, unknown>[] };

describe('programme structured data', () => {
  const naplan = PROGRAMMES.items.find((programme) => programme.slug === 'naplan');
  const data = buildProgrammeJsonLd({
    title: naplan?.title ?? '',
    description: naplan?.seo.description ?? '',
    path: programmePath('naplan'),
  }) as { 'script:ld+json': Graph };
  const [course = {}, trail = {}] = data['script:ld+json']['@graph'];

  it('describes the course, provided by AJ Classes', () => {
    expect(course['@type']).toBe('Course');
    expect(course.name).toBe(naplan?.title);
    expect(course.url).toBe('https://ajclasses.com.au/programmes/naplan');
    expect(course.provider).toMatchObject({ name: 'AJ Classes' });
  });

  it('gives Google the trail Home › Programmes › page', () => {
    const items = trail.itemListElement as { position: number; name: string; item: string }[];
    expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(items[0]?.item).toBe('https://ajclasses.com.au/');
    expect(items[2]?.name).toBe(naplan?.title);
  });
});

describe('home page business data (Google Business Profile match)', () => {
  const data = buildHomeJsonLd() as { 'script:ld+json': Graph };
  const [business = {}] = data['script:ld+json']['@graph'];

  it('gives the same street address as the Business Profile', () => {
    expect(business.address).toMatchObject({
      streetAddress: BUSINESS.streetAddress,
      addressLocality: BUSINESS.locality,
      postalCode: BUSINESS.postcode,
      addressRegion: BUSINESS.state,
    });
  });

  it('links the Maps profile and every live social profile, but not the WhatsApp chat', () => {
    const profiles = SOCIAL_LINKS.filter((link) => link.url && link.platform !== 'whatsapp').map(
      (link) => link.url,
    );
    expect(business.hasMap).toBe(BUSINESS.googleMapsUrl);
    expect(business.sameAs).toEqual([...profiles, BUSINESS.googleMapsUrl]);
    expect(profiles.length).toBeGreaterThanOrEqual(3); // Facebook, Instagram, YouTube
  });
});

describe('home page search result', () => {
  it('has a description Google will not cut off, naming where classes run', () => {
    expect(SEO.home.description.length).toBeLessThanOrEqual(160);
    expect(SEO.home.description).toContain(BUSINESS.suburbsText);
    expect(SEO.home.title.length).toBeLessThanOrEqual(60);
  });

  it('lists the suburbs we teach in and the nearby ones as the service area', () => {
    const home = buildHomeJsonLd() as { 'script:ld+json': Graph };
    const [business = {}] = home['script:ld+json']['@graph'];
    const names = ((business.areaServed as { name: string }[]) ?? []).map((place) => place.name);
    for (const suburb of [...BUSINESS.suburbs, ...NEARBY_SUBURB_NAMES]) {
      expect(names).toContain(`${suburb} ${BUSINESS.state}`);
    }
  });
});

describe('area structured data', () => {
  const suburbs = ['Truganina', 'Tarneit', 'Werribee'];
  const data = buildAreaJsonLd({
    name: "Melbourne's West",
    path: '/tutoring/melbourne-west',
    suburbs,
  }) as { 'script:ld+json': Graph };
  const [service = {}, trail = {}] = data['script:ld+json']['@graph'];

  it('describes tutoring for every suburb in the area, provided by the AJ Classes business', () => {
    expect(service['@type']).toBe('Service');
    expect((service.areaServed as { name: string }[]).map((place) => place.name)).toEqual(
      suburbs.map((suburb) => `${suburb} VIC`),
    );
    expect(service.provider).toMatchObject({ '@id': 'https://ajclasses.com.au/#organization' });
    expect(trail['@type']).toBe('BreadcrumbList');
  });
});

describe('guide structured data', () => {
  it('carries the dates and image Google uses to judge an article', () => {
    const [guide] = GUIDES;
    if (!guide) throw new Error('no guide');
    const data = buildGuideJsonLd({
      title: guide.title,
      description: guide.seo.description,
      path: '/resources/x',
      published: guide.published,
      modified: guide.modified,
    }) as { 'script:ld+json': Graph };
    const [article = {}] = data['script:ld+json']['@graph'];
    expect(article.datePublished).toBe(guide.published);
    expect(article.dateModified).toBe(guide.modified);
    expect(article.image).toBe('https://ajclasses.com.au/og-image.png');
    expect(guide.modified >= guide.published).toBe(true);
  });
});

describe('programme descriptions', () => {
  it('stay near the length Google shows and name where classes run', () => {
    for (const programme of PROGRAMMES.items) {
      expect(programme.seo.description.length).toBeLessThanOrEqual(165);
    }
    const withSuburbs = PROGRAMMES.items.filter((programme) =>
      programme.seo.description.includes('Truganina'),
    );
    expect(withSuburbs.length).toBeGreaterThanOrEqual(8);
  });
});

describe('search engine exclusion', () => {
  const robotsTags = (tags: ReturnType<typeof buildPageMeta>) =>
    tags.filter((tag) => 'name' in tag && tag.name === 'robots');

  // Two identical robots tags made React log a duplicate-key error (BUG-1, 2026-10-25).
  it('emits a single robots tag on pages that are always excluded', () => {
    expect(robotsTags(notFoundMeta())).toHaveLength(1);
    expect(robotsTags(subscribedMeta())).toHaveLength(1);
  });

  it('adds the robots tag when a page asks to be excluded', () => {
    expect(robotsTags(buildPageMeta(SEO.privacy, ROUTES.privacy, { noIndex: true }))).toEqual([
      { name: 'robots', content: 'noindex' },
    ]);
  });
});

describe('social preview image', () => {
  // Every page's og:image points here; it was missing from the live site for weeks (404).
  // join, not new URL(): Vite rewrites `new URL(…, import.meta.url)` as an asset reference.
  const imageFile = join(import.meta.dirname, '../../public', SOCIAL_PREVIEW.imagePath);

  it('exists in public/ at the size the og:image tags promise', () => {
    const png = readFileSync(imageFile);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(Number(SOCIAL_PREVIEW.imageWidth));
    expect(png.readUInt32BE(20)).toBe(Number(SOCIAL_PREVIEW.imageHeight));
  });
});
