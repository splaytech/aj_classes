// Material UI theme for the portal (R3a design §5.2, review H19; light and dark in R3b §6.5).
// Built from the CSS variables in styles/theme.css, so that file stays the only place colours and
// fonts are defined (house rule F1.2). Portal pages only run in the browser, so reading the
// computed variables is safe.

import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

import type { ResolvedTheme } from '@/constants';

const SPACING_PX = 4; // the --space-* scale is 4 px based: spacing(2) = 8 px
const THEME_ATTRIBUTE = 'data-portal-theme';

/** Reads one CSS variable, e.g. read('--color-primary'). Empty when it isn't defined. */
export type ReadVariable = (name: string) => string;

const VARIABLES = [
  '--color-primary',
  '--color-primary-hover',
  '--color-on-primary',
  '--color-secondary',
  '--color-text-emphasis',
  '--color-error',
  '--color-success',
  '--color-warning',
  '--color-text',
  '--color-text-muted',
  '--color-bg',
  '--color-surface',
  '--color-border',
  '--font-body',
  '--radius-md',
] as const;

/**
 * The variables of one theme, read from a hidden element that carries that theme's attribute.
 * Reading from <html> would give the theme showing now, not the one being switched to.
 */
export function readThemeVariables(mode: ResolvedTheme): ReadVariable {
  const probe = document.createElement('div');
  probe.setAttribute(THEME_ATTRIBUTE, mode);
  probe.hidden = true;
  document.body.appendChild(probe);

  const style = getComputedStyle(probe);
  const values = new Map(VARIABLES.map((name) => [name, style.getPropertyValue(name).trim()]));
  probe.remove();

  return (name) => values.get(name as (typeof VARIABLES)[number]) ?? '';
}

/** Shows the chosen theme on the page (portal only; removed when leaving the portal). */
export function applyThemeToPage(mode: ResolvedTheme | null): void {
  if (mode) document.documentElement.setAttribute(THEME_ATTRIBUTE, mode);
  else document.documentElement.removeAttribute(THEME_ATTRIBUTE);
}

export function createPortalTheme(mode: ResolvedTheme, read: ReadVariable): Theme {
  const primary = read('--color-primary');

  // theme.css not loaded (e.g. some tests): fall back to MUI's defaults rather than crash.
  if (!primary) return createTheme({ spacing: SPACING_PX, palette: { mode } });

  return createTheme({
    spacing: SPACING_PX,
    palette: {
      mode,
      primary: {
        main: primary,
        dark: read('--color-primary-hover'),
        contrastText: read('--color-on-primary'),
      },
      secondary: {
        main: read('--color-secondary'),
        contrastText: read('--color-text-emphasis'),
      },
      error: { main: read('--color-error') },
      success: { main: read('--color-success') },
      warning: { main: read('--color-warning') },
      info: { main: read('--color-text-emphasis') },
      text: {
        primary: read('--color-text'),
        secondary: read('--color-text-muted'),
      },
      background: {
        default: read('--color-bg'),
        paper: read('--color-surface'),
      },
      divider: read('--color-border'),
    },
    typography: {
      fontFamily: read('--font-body'),
      button: { textTransform: 'none', fontWeight: 700 },
    },
    shape: { borderRadius: parseInt(read('--radius-md'), 10) },
  });
}
