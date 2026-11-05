import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AREAS,
  AREA_PAGE,
  AREA_PATHS,
  BUSINESS,
  LEGACY_SUBURB_REDIRECTS,
  PROGRAMMES,
  areaPath,
  findArea,
  programmePath,
} from '@/constants';
import { renderAt } from '@/test/render';

import { AreaPage } from './area';

const TITLE_MAX = 60; // Google cuts longer titles
const DESCRIPTION_MAX = 160;
const DESCRIPTION_MIN = 70;

describe('area data', () => {
  it('has one page for the west and one for the north, under /tutoring', () => {
    expect(AREA_PATHS).toEqual(['/tutoring/melbourne-west', '/tutoring/melbourne-north']);
  });

  it('finds an area by slug, and nothing for an unknown one', () => {
    for (const area of AREAS) expect(findArea(area.slug)).toBe(area);
    expect(findArea('tarneit')).toBeUndefined();
  });

  it.each(AREAS.map((area) => [area.name, area] as const))(
    '%s: title and description fit a search result',
    (_name, area) => {
      expect(area.seo.title.length).toBeLessThanOrEqual(TITLE_MAX);
      expect(area.seo.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(area.seo.description.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
    },
  );

  it('names every suburb in the page text, which visitors can see', () => {
    for (const area of AREAS) {
      for (const suburb of area.suburbs) {
        expect(area.seo.description + area.intro + suburb.note + suburb.name).toContain(
          suburb.name,
        );
      }
    }
  });

  it('lists each suburb once across the site', () => {
    const names = AREAS.flatMap((area) => area.suburbs.map((suburb) => suburb.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('marks exactly the suburbs in BUSINESS.suburbs as in-person', () => {
    const inPerson = AREAS.flatMap((area) => area.suburbs)
      .filter((suburb) => suburb.teachesHere)
      .map((suburb) => suburb.name);
    expect([...inPerson].sort()).toEqual([...BUSINESS.suburbs].sort());
  });

  it('never says "we teach in person" about a suburb we do not teach in', () => {
    for (const area of AREAS) {
      for (const suburb of area.suburbs.filter((item) => !item.teachesHere)) {
        expect(suburb.note).not.toMatch(/in-person|in person/i);
        expect(suburb.note).not.toMatch(new RegExp(`classes (run |are )?in ${suburb.name}`, 'i'));
      }
    }
  });

  it('uses different wording on every page and in every suburb note', () => {
    const notes = AREAS.flatMap((area) =>
      area.suburbs.filter((s) => !s.teachesHere).map((s) => s.note),
    );
    expect(new Set(notes).size).toBe(notes.length);
    const paragraphs = AREAS.flatMap((area) => area.localParagraphs);
    expect(new Set(paragraphs).size).toBe(paragraphs.length);
  });

  it('never promises results (consumer law)', () => {
    const text = AREAS.map((area) => [area.intro, ...area.localParagraphs].join(' ')).join(' ');
    expect(text).not.toMatch(/guarantee|100%|get your child in|top results/i);
  });
});

describe('old suburb addresses', () => {
  const vercel = JSON.parse(readFileSync(join(import.meta.dirname, '../../vercel.json'), 'utf8'));
  const railway = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../serve.railway.json'), 'utf8'),
  );

  it('every old suburb page points at an area that exists', () => {
    for (const area of Object.values(LEGACY_SUBURB_REDIRECTS)) expect(findArea(area)).toBeDefined();
  });

  it.each(Object.entries(LEGACY_SUBURB_REDIRECTS))(
    '/tutoring/%s redirects for good to its area on Vercel and Railway',
    (old, area) => {
      const source = `/tutoring/${old}`;
      expect(vercel.redirects).toContainEqual({
        source,
        destination: areaPath(area),
        permanent: true,
      });
      expect(railway.redirects).toContainEqual({
        source,
        destination: areaPath(area),
        type: 301,
      });
    },
  );
});

describe('area pages', () => {
  it.each(AREAS.map((area) => [area.name, area] as const))(
    '%s: one heading, every suburb, every programme, the guide and the enquiry link',
    (_name, area) => {
      renderAt(<AreaPage area={area} />, areaPath(area.slug));
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        AREA_PAGE.title(area.name),
      );
      expect(screen.getByText(area.intro)).toBeInTheDocument();

      const suburbsHeading = screen.getByRole('heading', { name: AREA_PAGE.suburbsHeading });
      const list = within(suburbsHeading.parentElement as HTMLElement).getByRole('list');
      expect(within(list).getAllByRole('listitem')).toHaveLength(area.suburbs.length);
      for (const suburb of area.suburbs) {
        expect(within(list).getByText(suburb.name)).toBeVisible();
        expect(within(list).getAllByText(suburb.note)[0]).toBeVisible();
      }

      for (const programme of PROGRAMMES.items) {
        expect(
          screen.getByRole('link', {
            name: AREA_PAGE.programmeLine(programme.title, programme.years),
          }),
        ).toHaveAttribute('href', programmePath(programme.slug));
      }
      expect(screen.getByRole('link', { name: AREA_PAGE.guideLinkLabel })).toHaveAttribute(
        'href',
        AREA_PAGE.guidePath,
      );
      for (const link of screen.getAllByRole('link', { name: AREA_PAGE.cta })) {
        expect(link).toHaveAttribute('href', '/#contact');
      }
    },
  );

  it('links each area to the other one', () => {
    const [west, north] = AREAS;
    if (!west || !north) throw new Error('areas missing');
    renderAt(<AreaPage area={west} />, areaPath(west.slug));
    const heading = screen.getByRole('heading', { name: AREA_PAGE.otherHeading });
    expect(
      within(heading.parentElement as HTMLElement).getByRole('link', {
        name: AREA_PAGE.linkLabel(north.name),
      }),
    ).toHaveAttribute('href', areaPath(north.slug));
  });
});
