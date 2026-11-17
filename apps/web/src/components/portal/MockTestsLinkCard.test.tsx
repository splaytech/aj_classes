import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MOCK_TESTS_LINK_CARD, mockTestsPath } from '@/constants';
import type { MockTakerArea } from '@/constants';
import { renderAt } from '@/test/render';

import { MockTestsLinkCard } from './MockTestsLinkCard';

describe('MockTestsLinkCard', () => {
  it.each<MockTakerArea>(['student', 'parent', 'user'])('links to the %s list', (area) => {
    renderAt(<MockTestsLinkCard area={area} />);

    expect(screen.getByRole('heading', { name: MOCK_TESTS_LINK_CARD.heading })).toBeVisible();
    expect(screen.getByRole('link', { name: MOCK_TESTS_LINK_CARD.link })).toHaveAttribute(
      'href',
      mockTestsPath(area),
    );
  });
});
