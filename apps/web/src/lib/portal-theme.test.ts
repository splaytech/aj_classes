import { describe, expect, it } from 'vitest';

import { createPortalTheme } from './portal-theme';

const LIGHT: Record<string, string> = {
  '--color-primary': '#2563eb',
  '--color-primary-hover': '#1d4ed8',
  '--color-on-primary': '#ffffff',
  '--color-secondary': '#f9c62b',
  '--color-text-emphasis': '#172554',
  '--color-error': '#b91c1c',
  '--color-success': '#15803d',
  '--color-warning': '#b45309',
  '--color-text': '#172033',
  '--color-text-muted': '#4b5563',
  '--color-bg': '#ffffff',
  '--color-surface': '#ffffff',
  '--color-border': '#d6deeb',
  '--font-body': 'Inter, system-ui, sans-serif',
  '--radius-md': '8px',
};

const DARK: Record<string, string> = {
  ...LIGHT,
  '--color-primary': '#60a5fa',
  '--color-on-primary': '#0b1220',
  '--color-bg': '#0b1220',
  '--color-surface': '#131c31',
  '--color-text': '#e2e8f0',
};

const reader = (variables: Record<string, string>) => (name: string) => variables[name] ?? '';

describe('createPortalTheme', () => {
  it('takes colours, font and radius from the theme.css variables', () => {
    const theme = createPortalTheme('light', reader(LIGHT));

    expect(theme.palette.mode).toBe('light');
    expect(theme.palette.primary.main).toBe('#2563eb');
    expect(theme.palette.warning.main).toBe('#b45309');
    expect(theme.typography.fontFamily).toBe('Inter, system-ui, sans-serif');
    expect(theme.shape.borderRadius).toBe(8);
    expect(theme.spacing(2)).toBe('8px');
  });

  it('builds the dark theme from the dark variables (R3b FS4)', () => {
    const theme = createPortalTheme('dark', reader(DARK));

    expect(theme.palette.mode).toBe('dark');
    expect(theme.palette.primary.main).toBe('#60a5fa');
    expect(theme.palette.primary.contrastText).toBe('#0b1220');
    expect(theme.palette.background.default).toBe('#0b1220');
    expect(theme.palette.background.paper).toBe('#131c31');
    expect(theme.palette.text.primary).toBe('#e2e8f0');
  });

  it("falls back to MUI's defaults when theme.css isn't loaded", () => {
    expect(createPortalTheme('dark', reader({})).palette.mode).toBe('dark');
  });
});
