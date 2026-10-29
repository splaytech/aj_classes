import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CURRENT_MARKER } from '@/constants';

import { EnvironmentMarker } from './EnvironmentMarker';
import styles from './EnvironmentMarker.module.css';

/** The label, found by its text: the marker is aria-hidden, so it has no role to query. */
function renderedLabel(inPortal?: boolean): HTMLElement {
  render(<EnvironmentMarker inPortal={inPortal} />);
  return screen.getByText(CURRENT_MARKER?.label ?? '', { exact: false });
}

// Unit tests run as "development", so the DEV marker shows.
describe('environment marker', () => {
  it('shows the environment label', () => {
    expect(CURRENT_MARKER).not.toBeNull();
    expect(styles.labelBottom).toBeTruthy();
    expect(renderedLabel()).toBeInTheDocument();
  });

  it('keeps the label under the header on public pages', () => {
    expect(renderedLabel().className).not.toContain(styles.labelBottom);
  });

  it('moves the label to the bottom on portal pages, clear of the signed-in name (27a)', () => {
    expect(renderedLabel(true).className).toContain(styles.labelBottom);
  });
});
