// Material UI theme for the staff portal (R3a design §5.2, review H19).
// Built from the CSS variables in styles/theme.css, so that file stays the only place colours and
// fonts are defined (house rule F1.2). Portal pages only run in the browser, so reading the
// computed variables here is safe.

import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

const SPACING_PX = 4; // the --space-* scale is 4 px based: spacing(2) = 8 px

function cssVariable(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function createPortalTheme(): Theme {
  const primary = cssVariable('--color-primary');

  // theme.css not loaded (e.g. some tests): fall back to MUI's defaults rather than crash.
  if (!primary) return createTheme({ spacing: SPACING_PX });

  return createTheme({
    spacing: SPACING_PX,
    palette: {
      primary: {
        main: primary,
        dark: cssVariable('--color-primary-hover'),
        contrastText: cssVariable('--color-on-primary'),
      },
      secondary: {
        main: cssVariable('--color-secondary'),
        contrastText: cssVariable('--color-text-emphasis'),
      },
      error: { main: cssVariable('--color-error') },
      success: { main: cssVariable('--color-success') },
      warning: { main: cssVariable('--color-warning') },
      info: { main: cssVariable('--color-text-emphasis') },
      text: {
        primary: cssVariable('--color-text'),
        secondary: cssVariable('--color-text-muted'),
      },
      background: {
        default: cssVariable('--color-bg'),
        paper: cssVariable('--color-bg'),
      },
      divider: cssVariable('--color-border'),
    },
    typography: {
      fontFamily: cssVariable('--font-body'),
      button: { textTransform: 'none', fontWeight: 700 },
    },
    shape: { borderRadius: parseInt(cssVariable('--radius-md'), 10) },
  });
}
