import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MOCK_PASS_LABELS } from '@/constants';

import { MockPassChip } from './MockTestStatusChips';

describe('MockPassChip', () => {
  it('renders nothing without a pass mark (AC 8)', () => {
    const { container } = render(<MockPassChip passed={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    [true, MOCK_PASS_LABELS.pass],
    [false, MOCK_PASS_LABELS.notYet],
  ])('shows %s as "%s" with no colour class (AC 16)', (passed, label) => {
    render(<MockPassChip passed={passed} />);
    const chip = screen.getByText(label).closest('.MuiChip-root');
    expect(chip).not.toBeNull();
    expect(chip?.className).not.toMatch(/MuiChip-color(?!Default)/);
    expect(chip?.className).not.toMatch(
      /MuiChip-outlined(Primary|Secondary|Success|Error|Warning|Info)/,
    );
  });
});
