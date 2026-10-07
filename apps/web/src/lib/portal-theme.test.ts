import { afterEach, describe, expect, it } from 'vitest';

import { createPortalTheme } from './portal-theme';

const VARIABLES: Record<string, string> = {
  '--color-primary': 'rgb(37, 99, 235)',
  '--color-primary-hover': 'rgb(29, 78, 216)',
  '--color-on-primary': 'rgb(255, 255, 255)',
  '--color-secondary': 'rgb(249, 198, 43)',
  '--color-text-emphasis': 'rgb(23, 37, 84)',
  '--color-error': 'rgb(185, 28, 28)',
  '--color-success': 'rgb(21, 128, 61)',
  '--color-warning': 'rgb(180, 83, 9)',
  '--color-text': 'rgb(23, 32, 51)',
  '--color-text-muted': 'rgb(75, 85, 99)',
  '--color-bg': 'rgb(255, 255, 255)',
  '--color-border': 'rgb(214, 222, 235)',
  '--font-body': 'Inter, system-ui, sans-serif',
  '--radius-md': '8px',
};

describe('createPortalTheme', () => {
  afterEach(() => {
    Object.keys(VARIABLES).forEach((name) => document.documentElement.style.removeProperty(name));
  });

  it('takes colours, font and radius from the theme.css variables', () => {
    Object.entries(VARIABLES).forEach(([name, value]) =>
      document.documentElement.style.setProperty(name, value),
    );
    const theme = createPortalTheme();

    expect(theme.palette.primary.main).toBe('rgb(37, 99, 235)');
    expect(theme.palette.warning.main).toBe('rgb(180, 83, 9)');
    expect(theme.typography.fontFamily).toBe('Inter, system-ui, sans-serif');
    expect(theme.shape.borderRadius).toBe(8);
    expect(theme.spacing(2)).toBe('8px');
  });

  it("falls back to MUI's defaults when theme.css isn't loaded", () => {
    expect(() => createPortalTheme()).not.toThrow();
  });
});
