import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderAt } from '@/test/render';

import { Header } from '@/components/layout/header/Header';
import {
  PROGRAMMES,
  PROGRAMME_PAGE,
  GUIDES,
  PROGRAMME_PATHS,
  TEMPLATE_PROGRAMMES,
  findProgramme,
  programmePath,
  resourcePath,
} from '@/constants';
import { Programmes } from '@/sections';

import { ProgrammePage } from './programme';

describe('programme pages', () => {
  it('gives every programme its own path under /programmes, VCE included', () => {
    expect(PROGRAMME_PATHS).toHaveLength(PROGRAMMES.items.length);
    expect(new Set(PROGRAMME_PATHS).size).toBe(PROGRAMME_PATHS.length);
    expect(PROGRAMME_PATHS).toContain('/programmes/vce');
  });

  it('finds template programmes by slug, and nothing for an unknown slug', () => {
    for (const programme of TEMPLATE_PROGRAMMES) {
      expect(findProgramme(programme.slug)).toBe(programme);
    }
    expect(findProgramme('not-a-programme')).toBeUndefined();
    expect(findProgramme('vce')).toBeUndefined(); // VCE has its own page
  });

  it.each(TEMPLATE_PROGRAMMES.map((programme) => [programme.title, programme] as const))(
    '%s: one heading, how we help, enquiry link and links to the others',
    (_title, programme) => {
      renderAt(<ProgrammePage programme={programme} />, programmePath(programme.slug));
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(programme.title);
      expect(screen.getByRole('heading', { name: PROGRAMME_PAGE.helpHeading })).toBeInTheDocument();
      expect(programme.help.length).toBeGreaterThan(0);
      for (const link of screen.getAllByRole('link', { name: PROGRAMME_PAGE.cta })) {
        expect(link).toHaveAttribute('href', '/#contact');
      }
      const others = screen.getByRole('heading', { name: PROGRAMME_PAGE.otherHeading });
      const list = within(others.parentElement as HTMLElement).getAllByRole('listitem');
      expect(list).toHaveLength(PROGRAMMES.items.length - 1);
    },
  );
});

describe('parent guide links', () => {
  function guideLinkHrefs(slug: string): string[] {
    const programme = findProgramme(slug);
    if (!programme) throw new Error(`no programme ${slug}`);
    const { unmount } = renderAt(<ProgrammePage programme={programme} />, programmePath(slug));
    const hrefs = GUIDES.filter((guide) =>
      screen.queryByRole('link', { name: guide.linkLabel }),
    ).map(
      (guide) => screen.getByRole('link', { name: guide.linkLabel }).getAttribute('href') ?? '',
    );
    unmount();
    return hrefs;
  }

  it('shows the selective entry guide on the selective, interview and SEAL pages', () => {
    for (const slug of ['selective-entry', 'interviews', 'seal-and-scholarships']) {
      expect(guideLinkHrefs(slug)).toContain(resourcePath('victorian-selective-entry-exam'));
    }
  });

  it('shows each programme its own guide: NAPLAN and scholarships', () => {
    expect(guideLinkHrefs('naplan')).toEqual([resourcePath('naplan-for-parents')]);
    expect(guideLinkHrefs('seal-and-scholarships')).toContain(
      resourcePath('victorian-school-scholarships'),
    );
  });

  it('shows no guide link where there is no guide (ICAS)', () => {
    expect(guideLinkHrefs('icas')).toEqual([]);
  });

  it('lists every guide on the home page Programmes section', () => {
    renderAt(<Programmes />);
    for (const guide of GUIDES) {
      expect(screen.getByRole('link', { name: guide.linkLabel })).toHaveAttribute(
        'href',
        resourcePath(guide.slug),
      );
    }
  });
});

describe('home page cards', () => {
  // Card points stay short (one line on desktop); the details live on each programme page.
  const CARD_POINT_MAX = 32; // fits one line on the narrowest desktop card (1024px)

  it.each(PROGRAMMES.items.map((programme) => [programme.title, programme] as const))(
    '%s: three short points',
    (_title, programme) => {
      expect(programme.points).toHaveLength(3);
      for (const point of programme.points) {
        expect(point.length).toBeLessThanOrEqual(CARD_POINT_MAX);
      }
    },
  );
});

describe('links to programme pages', () => {
  it('every home page card links to its page', () => {
    renderAt(<Programmes />);
    for (const programme of PROGRAMMES.items) {
      const link = screen.getByRole('link', { name: PROGRAMMES.moreLinkLabel(programme.title) });
      expect(link).toHaveAttribute('href', programmePath(programme.slug));
    }
  });

  it('marks the current programme in the menu', () => {
    renderAt(<Header />, '/programmes/naplan/');
    expect(screen.getByRole('link', { name: 'NAPLAN' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'ICAS' })).not.toHaveAttribute('aria-current');
  });

  it('the Programmes menu lists every programme page', () => {
    renderAt(<Header />);
    for (const programme of PROGRAMMES.items) {
      // A "New" tag follows the name (jsdom joins them without a space).
      const name = programme.isNew ? new RegExp(`^${programme.menuLabel}`) : programme.menuLabel;
      expect(screen.getByRole('link', { name })).toHaveAttribute(
        'href',
        programmePath(programme.slug),
      );
    }
  });
});
