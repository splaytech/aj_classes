import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Header } from '@/components/layout/header/Header';
import {
  PROGRAMMES,
  PROGRAMME_PAGE,
  PROGRAMME_PATHS,
  TEMPLATE_PROGRAMMES,
  findProgramme,
  programmePath,
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
      render(<ProgrammePage programme={programme} />);
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

describe('links to programme pages', () => {
  it('every home page card links to its page', () => {
    render(<Programmes />);
    for (const programme of PROGRAMMES.items) {
      const link = screen.getByRole('link', { name: PROGRAMMES.moreLinkLabel(programme.title) });
      expect(link).toHaveAttribute('href', programmePath(programme.slug));
    }
  });

  it('the Programmes menu lists every programme page', () => {
    render(<Header />);
    for (const programme of PROGRAMMES.items) {
      expect(screen.getByRole('link', { name: programme.menuLabel })).toHaveAttribute(
        'href',
        programmePath(programme.slug),
      );
    }
  });
});
