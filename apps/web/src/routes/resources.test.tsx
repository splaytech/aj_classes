import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GUIDES, GUIDE_PATHS, PROGRAMMES, RESOURCES, findGuide, resourcePath } from '@/constants';
import { renderAt } from '@/test/render';

import { GuidePage } from './resource';
import ResourcesPage from './resources';

// Government, ACER and ACARA pages, and the schools' own pages (never third-party summaries).
const OFFICIAL_SOURCE =
  /^https:\/\/(www\.vic\.gov\.au|selectiveentry\.acer\.org|www\.nap\.edu\.au|www\.mgs\.vic\.edu\.au|westbournegrammar\.com)\//;
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

describe('parent guides', () => {
  it('lists every guide with a link to its page', () => {
    renderAt(<ResourcesPage />, '/resources');
    for (const guide of GUIDES) {
      expect(
        screen.getByRole('link', { name: RESOURCES.readGuideLabel(guide.title) }),
      ).toHaveAttribute('href', resourcePath(guide.slug));
    }
    expect(GUIDE_PATHS).toHaveLength(GUIDES.length);
  });

  it('finds guides by slug, and nothing for an unknown one', () => {
    for (const guide of GUIDES) expect(findGuide(guide.slug)).toBe(guide);
    expect(findGuide('not-a-guide')).toBeUndefined();
  });

  it.each(GUIDES.map((guide) => [guide.title, guide] as const))(
    '%s: one main heading, official sources and an enquiry link',
    (_title, guide) => {
      renderAt(<GuidePage guide={guide} />, resourcePath(guide.slug));
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(guide.sources.length).toBeGreaterThan(0);
      for (const source of guide.sources) {
        expect(source.url).toMatch(OFFICIAL_SOURCE);
        expect(screen.getByRole('link', { name: source.label })).toHaveAttribute(
          'target',
          '_blank',
        );
      }
      expect(screen.getByRole('link', { name: RESOURCES.ctaContact })).toHaveAttribute(
        'href',
        '/#contact',
      );
      expect(PROGRAMMES.items.some((programme) => programme.slug === guide.programme)).toBe(true);
    },
  );

  it('never promises results', () => {
    const text = JSON.stringify(GUIDES).toLowerCase();
    for (const promise of ['guarantee', 'guaranteed', 'will get in', '100%']) {
      expect(text).not.toContain(promise);
    }
  });

  it.each(GUIDES.map((guide) => [guide.title, guide] as const))(
    '%s: search text fits, dates are in order and related guides exist',
    (_title, guide) => {
      expect(guide.seo.title.length).toBeLessThanOrEqual(TITLE_MAX);
      expect(guide.seo.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(guide.modified >= guide.published).toBe(true);
      for (const slug of guide.relatedGuides ?? []) {
        expect(findGuide(slug)).toBeDefined();
        expect(slug).not.toBe(guide.slug);
      }
    },
  );

  it('lists the related guides at the end of its page', () => {
    const naplan = findGuide('naplan-for-parents');
    if (!naplan) throw new Error('no naplan guide');
    renderAt(<GuidePage guide={naplan} />, resourcePath(naplan.slug));
    expect(screen.getByRole('heading', { name: RESOURCES.relatedHeading })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: findGuide('victorian-school-scholarships')?.title }),
    ).toHaveAttribute('href', resourcePath('victorian-school-scholarships'));
  });

  it('gives every guide a different link label and search title', () => {
    expect(new Set(GUIDES.map((guide) => guide.linkLabel)).size).toBe(GUIDES.length);
    expect(new Set(GUIDES.map((guide) => guide.seo.title)).size).toBe(GUIDES.length);
  });
});
