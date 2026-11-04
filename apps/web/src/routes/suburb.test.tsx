import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  BUSINESS,
  PROGRAMMES,
  SUBURBS,
  SUBURB_PAGE,
  SUBURB_PATHS,
  findSuburb,
  programmePath,
  suburbPath,
} from '@/constants';
import { renderAt } from '@/test/render';

import { SuburbPage } from './suburb';

const TITLE_MAX = 60; // Google cuts longer titles
const DESCRIPTION_MAX = 160;
const DESCRIPTION_MIN = 70;

describe('suburb data', () => {
  it('gives every suburb its own path under /tutoring', () => {
    expect(SUBURB_PATHS).toHaveLength(SUBURBS.length);
    expect(new Set(SUBURB_PATHS).size).toBe(SUBURBS.length);
    expect(SUBURB_PATHS).toContain('/tutoring/tarneit');
  });

  it('finds a suburb by slug, and nothing for an unknown one', () => {
    for (const suburb of SUBURBS) expect(findSuburb(suburb.slug)).toBe(suburb);
    expect(findSuburb('not-a-suburb')).toBeUndefined();
  });

  it.each(SUBURBS.map((suburb) => [suburb.name, suburb] as const))(
    '%s: title and description fit a search result, and name the suburb',
    (_name, suburb) => {
      expect(suburb.seo.title.length).toBeLessThanOrEqual(TITLE_MAX);
      expect(suburb.seo.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(suburb.seo.description.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
      expect(suburb.seo.title).toContain(suburb.name);
      expect(suburb.seo.description).toContain(suburb.name);
    },
  );

  it('uses different wording on every page (no name-swapped copy)', () => {
    const paragraphs = SUBURBS.flatMap((suburb) => suburb.localParagraphs);
    expect(new Set(paragraphs).size).toBe(paragraphs.length);
    const intros = SUBURBS.map((suburb) => suburb.intro);
    expect(new Set(intros).size).toBe(intros.length);
  });

  it('says "we teach in person" only for suburbs in BUSINESS.suburbs', () => {
    for (const suburb of SUBURBS) {
      const listed = (BUSINESS.suburbs as readonly string[]).includes(suburb.name);
      expect(suburb.teachesHere).toBe(listed);
      if (suburb.teachesHere) continue;
      const text = [suburb.intro, ...suburb.localParagraphs, suburb.seo.description].join(' ');
      expect(text).not.toMatch(new RegExp(`in person in ${suburb.name}`, 'i'));
      expect(text).not.toMatch(new RegExp(`classes (run |are )?in ${suburb.name}`, 'i'));
    }
  });

  it('never promises results (consumer law)', () => {
    const text = SUBURBS.map((suburb) => [suburb.intro, ...suburb.localParagraphs].join(' ')).join(
      ' ',
    );
    expect(text).not.toMatch(/guarantee|100%|get your child in|top results/i);
  });
});

describe('suburb pages', () => {
  it.each(SUBURBS.map((suburb) => [suburb.name, suburb] as const))(
    '%s: one heading, every programme, the other areas, the guide and the enquiry link',
    (_name, suburb) => {
      renderAt(<SuburbPage suburb={suburb} />, suburbPath(suburb.slug));
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        SUBURB_PAGE.title(suburb.name),
      );
      expect(screen.getByText(suburb.intro)).toBeInTheDocument();

      for (const programme of PROGRAMMES.items) {
        expect(
          screen.getByRole('link', {
            name: SUBURB_PAGE.programmeLine(programme.title, programme.years),
          }),
        ).toHaveAttribute('href', programmePath(programme.slug));
      }

      const others = screen.getByRole('heading', { name: SUBURB_PAGE.otherHeading });
      const list = within(others.parentElement as HTMLElement).getAllByRole('listitem');
      expect(list).toHaveLength(SUBURBS.length - 1);

      expect(screen.getByRole('link', { name: SUBURB_PAGE.guideLinkLabel })).toHaveAttribute(
        'href',
        SUBURB_PAGE.guidePath,
      );
      for (const link of screen.getAllByRole('link', { name: SUBURB_PAGE.cta })) {
        expect(link).toHaveAttribute('href', '/#contact');
      }
    },
  );
});
