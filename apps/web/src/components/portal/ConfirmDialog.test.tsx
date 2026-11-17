import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('wraps a long unbroken text so it cannot widen the page (BUG-5)', () => {
    const long = 'w'.repeat(150);
    render(
      <ConfirmDialog
        open
        title="Delete?"
        text={long}
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(long)).toHaveStyle({ overflowWrap: 'anywhere' });
  });
});
