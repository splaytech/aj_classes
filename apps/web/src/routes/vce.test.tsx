import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VCE_PAGE } from '@/constants';

import VcePage from './vce';

// Official VCAA study names (vce-page.md §1). Written out here on purpose, so a change to the
// constants can't quietly rename a subject.
const OFFICIAL_NAMES = [
  'Chemistry',
  'General Mathematics',
  'Mathematical Methods',
  'Psychology',
  'Business Management',
];

describe('VCE page', () => {
  it('lists the five subjects by their official VCAA names', () => {
    render(<VcePage />);
    const names = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(OFFICIAL_NAMES);
  });

  it('has one main heading and says who teaches', () => {
    render(<VcePage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: VCE_PAGE.teachersHeading })).toBeInTheDocument();
  });

  it('links to the enquiry form', () => {
    render(<VcePage />);
    for (const link of screen.getAllByRole('link', { name: VCE_PAGE.cta })) {
      expect(link).toHaveAttribute('href', '/#contact');
    }
  });
});
