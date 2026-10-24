import { describe, expect, it } from 'vitest';

import { PROGRAMMES, ROUTES, SEO, programmePath } from '@/constants';
import { meta as notFoundMeta } from '@/routes/not-found';
import { meta as subscribedMeta } from '@/routes/subscribed';

import { buildPageMeta, buildProgrammeJsonLd } from './seo';

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
