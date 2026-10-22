import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GUIDES, GUIDE_PATHS, PROGRAMMES, RESOURCES, findGuide, resourcePath } from '@/constants';
import { renderAt } from '@/test/render';

import { GuidePage } from './resource';
import ResourcesPage from './resources';

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
    '%s: one main heading, official sources (https, gov or ACER) and an enquiry link',
    (_title, guide) => {
      renderAt(<GuidePage guide={guide} />, resourcePath(guide.slug));
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(guide.sources.length).toBeGreaterThan(0);
      for (const source of guide.sources) {
        expect(source.url).toMatch(/^https:\/\/(www\.vic\.gov\.au|selectiveentry\.acer\.org)\//);
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
});
