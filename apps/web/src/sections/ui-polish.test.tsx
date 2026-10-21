import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ABOUT, APPROACH, RESULTS } from '@/constants';

import { About, Approach, Results } from '.';

describe('2026 results', () => {
  it('each breakdown adds up to its headline figure', () => {
    for (const item of RESULTS.items) {
      if (item.breakdown.length === 0) continue;
      const sum = item.breakdown.reduce((total, part) => total + Number(part.value), 0);
      expect(sum).toBe(Number(item.value));
    }
  });

  it('shows each figure with its label and breakdown, icons hidden from screen readers', () => {
    const { container } = render(<Results />);
    expect(screen.getByText('Melbourne High School')).toBeInTheDocument();
    for (const item of RESULTS.items) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
    for (const icon of container.querySelectorAll('svg')) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });
});

describe('approach steps', () => {
  it('labels every step "Step n of 4" in order, each with an icon', () => {
    render(<Approach />);
    const steps = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(steps).toHaveLength(APPROACH.steps.length);
    steps.forEach((step, index) => {
      expect(step).toHaveTextContent(APPROACH.stepLabel(index + 1, APPROACH.steps.length));
      expect(step.querySelector('svg')).not.toBeNull();
    });
  });
});

describe('credential badge', () => {
  it('shows the Working With Children Check as a badge with a tick', () => {
    render(<About />);
    const badge = screen.getByText(ABOUT.badge);
    expect(badge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
