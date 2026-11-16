import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BUSINESS, CENTRES, areaPath } from '@/constants';

import { CentreLinks } from './CentreLinks';

describe('CentreLinks', () => {
  it('reads exactly like BUSINESS.suburbsText, with each suburb linking to its centre page', () => {
    const { container } = render(
      <p>
        <CentreLinks />
      </p>,
    );
    expect(container.textContent).toBe(BUSINESS.suburbsText);
    for (const centre of CENTRES) {
      expect(screen.getByRole('link', { name: centre.name })).toHaveAttribute(
        'href',
        areaPath(centre.slug),
      );
    }
  });
});
