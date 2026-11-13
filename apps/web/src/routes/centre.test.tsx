import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AREAS,
  AREA_PAGE,
  BUSINESS,
  CENTRES,
  CENTRE_PAGE,
  CENTRE_PATHS,
  LEGACY_SUBURB_REDIRECTS,
  PROGRAMMES,
  areaPath,
  centrePathFor,
  findArea,
  findCentre,
  programmePath,
} from '@/constants';
import { absoluteUrl, environmentTitle } from '@/lib/seo';
import { renderAt } from '@/test/render';

import { CentrePage, centreMeta } from './centre';

const TITLE_MAX = 60; // Google cuts longer titles
const DESCRIPTION_MAX = 160;
const DESCRIPTION_MIN = 70;

const centreTexts = (centre: (typeof CENTRES)[number]) => [
  centre.intro,
  ...centre.localParagraphs,
  ...centre.questions.flatMap((item) => [item.question, item.answer]),
];

describe('centre data', () => {
  it('has one page for each suburb where in-person classes run, under /tutoring', () => {
    expect(CENTRES.map((centre) => centre.name).sort()).toEqual([...BUSINESS.suburbs].sort());
    expect(CENTRE_PATHS).toEqual([
      '/tutoring/truganina',
      '/tutoring/williams-landing',
      '/tutoring/craigieburn',
    ]);
  });

  it('finds a centre by slug or suburb name, and nothing for other suburbs', () => {
    for (const centre of CENTRES) {
      expect(findCentre(centre.slug)).toBe(centre);
      expect(centrePathFor(centre.name)).toBe(areaPath(centre.slug));
    }
    expect(findCentre('tarneit')).toBeUndefined();
    expect(centrePathFor('Tarneit')).toBeUndefined();
  });

  it('never shares a slug with an area page', () => {
    for (const centre of CENTRES) expect(findArea(centre.slug)).toBeUndefined();
  });

  it.each(CENTRES.map((centre) => [centre.name, centre] as const))(
    '%s: belongs to an area that marks it as in-person',
    (_name, centre) => {
      const area = findArea(centre.areaSlug);
      expect(area?.suburbs).toContainEqual({ name: centre.name, teachesHere: true });
    },
  );

  it.each(CENTRES.map((centre) => [centre.name, centre] as const))(
    '%s: the title leads with "Tutoring in <suburb>" and both fit a search result',
    (_name, centre) => {
      expect(centre.seo.title.startsWith(AREA_PAGE.title(centre.name))).toBe(true);
      expect(centre.seo.title.length).toBeLessThanOrEqual(TITLE_MAX);
      expect(centre.seo.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(centre.seo.description.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
      expect(centre.seo.description).toContain(centre.name);
    },
  );

  it('gives every centre its own wording, even with the suburb names taken out', () => {
    // Name-swapped copy is a doorway pattern Google ranks down (local-seo.md, honesty rule 2).
    const names = AREAS.flatMap((area) => area.suburbs.map((suburb) => suburb.name));
    const neutral = (text: string) =>
      names.reduce((result, name) => result.replaceAll(name, 'X'), text);
    const texts = CENTRES.flatMap((centre) => centreTexts(centre).map(neutral));
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('only claims in-person classes in the three centre suburbs', () => {
    const others = AREAS.flatMap((area) => area.suburbs)
      .filter((suburb) => !suburb.teachesHere)
      .map((suburb) => suburb.name);
    for (const text of CENTRES.flatMap(centreTexts)) {
      for (const name of others) {
        expect(text).not.toMatch(new RegExp(`(teach|classes|in person) in ${name}`, 'i'));
      }
    }
  });

  it('keeps every centre address live: no old redirect points it elsewhere', () => {
    const vercel = JSON.parse(readFileSync(join(import.meta.dirname, '../../vercel.json'), 'utf8'));
    const railway = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../serve.railway.json'), 'utf8'),
    );
    const sources = [...vercel.redirects, ...railway.redirects].map(
      (redirect: { source: string }) => redirect.source,
    );
    for (const centre of CENTRES) {
      expect(Object.keys(LEGACY_SUBURB_REDIRECTS)).not.toContain(centre.slug);
      expect(sources).not.toContain(areaPath(centre.slug));
    }
  });
});

describe('centre pages', () => {
  it.each(CENTRES.map((centre) => [centre.name, centre] as const))(
    '%s: heading, local text, questions, reviews, programmes and links onward',
    (_name, centre) => {
      renderAt(<CentrePage centre={centre} />, areaPath(centre.slug));

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        AREA_PAGE.title(centre.name),
      );
      expect(screen.getByText(centre.intro)).toBeInTheDocument();
      for (const paragraph of centre.localParagraphs) {
        expect(screen.getByText(paragraph)).toBeVisible();
      }
      for (const item of centre.questions) {
        expect(screen.getByRole('heading', { level: 3, name: item.question })).toBeVisible();
        expect(screen.getByText(item.answer)).toBeVisible();
      }
      expect(screen.getByRole('link', { name: CENTRE_PAGE.reviewsLabel })).toHaveAttribute(
        'href',
        BUSINESS.googleMapsUrl,
      );

      const helpful = screen.getByRole('heading', {
        name: CENTRE_PAGE.helpfulHeading(centre.name),
      });
      for (const link of centre.links) {
        expect(
          within(helpful.parentElement as HTMLElement).getByRole('link', { name: link.label }),
        ).toHaveAttribute('href', link.href);
      }
      for (const programme of PROGRAMMES.items) {
        expect(
          screen.getByRole('link', {
            name: AREA_PAGE.programmeLine(programme.title, programme.years),
          }),
        ).toHaveAttribute('href', programmePath(programme.slug));
      }

      const others = within(
        screen.getByRole('heading', { name: CENTRE_PAGE.otherHeading })
          .parentElement as HTMLElement,
      );
      for (const other of CENTRES.filter((item) => item.slug !== centre.slug)) {
        expect(others.getByRole('link', { name: AREA_PAGE.title(other.name) })).toHaveAttribute(
          'href',
          areaPath(other.slug),
        );
      }
      const area = findArea(centre.areaSlug);
      if (!area) throw new Error('area missing');
      expect(
        others.getByRole('link', { name: CENTRE_PAGE.areaLinkLabel(area.name) }),
      ).toHaveAttribute('href', areaPath(area.slug));

      for (const link of screen.getAllByRole('link', { name: AREA_PAGE.cta })) {
        expect(link).toHaveAttribute('href', '/#contact');
      }
    },
  );

  it.each(CENTRES.map((centre) => [centre.name, centre] as const))(
    '%s: head tags carry the title, the canonical URL and a Home › area › centre breadcrumb',
    (_name, centre) => {
      const tags = centreMeta(centre);
      // environmentTitle adds the [DEV]/[STAGING] prefix outside production, as on every page.
      expect(tags).toContainEqual({ title: environmentTitle(centre.seo.title) });
      expect(tags).toContainEqual({
        tagName: 'link',
        rel: 'canonical',
        href: absoluteUrl(areaPath(centre.slug)),
      });

      type Node = {
        '@type': string;
        areaServed?: { name: string }[];
        itemListElement?: { name: string }[];
      };
      const data = tags.find((tag) => 'script:ld+json' in tag) as {
        'script:ld+json': { '@graph': Node[] };
      };
      const jsonLd = data['script:ld+json'];
      const service = jsonLd['@graph'].find((node) => node['@type'] === 'Service');
      expect(service?.areaServed?.map((place) => place.name)).toEqual(
        [centre.name, ...centre.nearby].map((name) => `${name} ${BUSINESS.state}`),
      );
      const trail = jsonLd['@graph'].find((node) => node['@type'] === 'BreadcrumbList');
      const area = findArea(centre.areaSlug);
      expect(trail?.itemListElement?.map((item) => item.name)).toEqual([
        'Home',
        AREA_PAGE.title(area?.name ?? ''),
        AREA_PAGE.title(centre.name),
      ]);
    },
  );
});
