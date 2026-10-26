import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FAMILY_TAGS } from '@/constants';

import { PastClassChip } from './StatusChips';

describe('PastClassChip (item 7)', () => {
  it('shows the "Past class" tag from constants (AC-7.12)', () => {
    render(<PastClassChip />);

    expect(FAMILY_TAGS.pastClass).toBe('Past class');
    expect(screen.getByText(FAMILY_TAGS.pastClass)).toBeInTheDocument();
  });
});
