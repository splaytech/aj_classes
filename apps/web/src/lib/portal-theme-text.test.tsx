// Muted portal text really is muted (item 27b). MUI 9 removed system props, so
// `<Typography color="text.secondary">` silently rendered in the body colour; the palette key
// that still works is `textSecondary`. These tests pin both the working form and the guard.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import Typography from '@mui/material/Typography';
import { ThemeProvider } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';

import { createPortalTheme } from './portal-theme';

const MUTED = '#4b5563';
const BODY = '#172033';

const VARIABLES: Record<string, string> = {
  '--color-primary': '#2563eb',
  '--color-primary-hover': '#1d4ed8',
  '--color-on-primary': '#ffffff',
  '--color-secondary': '#f9c62b',
  '--color-text-emphasis': '#172554',
  '--color-error': '#b91c1c',
  '--color-success': '#15803d',
  '--color-warning': '#b45309',
  '--color-text': BODY,
  '--color-text-muted': MUTED,
  '--color-bg': '#ffffff',
  '--color-surface': '#ffffff',
  '--color-border': '#d6deeb',
  '--font-body': 'Inter, system-ui, sans-serif',
  '--radius-md': '8px',
};

const theme = createPortalTheme('light', (name) => VARIABLES[name] ?? '');

/** '#4b5563' → 'rgb(75, 85, 99)', the form getComputedStyle returns. */
function rgb(hex: string): string {
  const [red, green, blue] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return `rgb(${red}, ${green}, ${blue})`;
}

/** Every .tsx file under `directory`, recursively. */
function tsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : [];
  });
}

describe('muted text in the portal theme', () => {
  it('renders color="textSecondary" in the muted colour', () => {
    render(
      <ThemeProvider theme={theme}>
        <Typography color="textSecondary">hint</Typography>
      </ThemeProvider>,
    );

    expect(getComputedStyle(screen.getByText('hint')).color).toBe(rgb(MUTED));
  });

  it('shows why: color="text.secondary" falls back to the body colour', () => {
    render(
      <ThemeProvider theme={theme}>
        <Typography color="text.secondary">old form</Typography>
      </ThemeProvider>,
    );

    expect(getComputedStyle(screen.getByText('old form')).color).not.toBe(rgb(MUTED));
  });

  it('no component uses the color="text.*" form MUI 9 ignores', () => {
    const sourceRoot = join(import.meta.dirname, '..');
    const offenders = tsxFiles(sourceRoot).filter((file) =>
      /color="text\./.test(readFileSync(file, 'utf8')),
    );

    expect(offenders).toEqual([]);
  });
});
