// Appearance (system / light / dark) and the Material UI theme and date-picker locale for every
// portal page (R3a design §5.2, R3b §6.5). It sits at the portal root, so the sign-in pages follow
// the choice too. Leaving the portal removes the theme, so the public site is never affected.

import { ThemeProvider } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import 'dayjs/locale/en-au';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { APP_CONFIG } from '@/constants';
import type { ThemeMode } from '@/constants';
import { AppearanceContext } from '@/lib/appearance-context';
import type { Appearance } from '@/lib/appearance-context';
import { applyThemeToPage, createPortalTheme, readThemeVariables } from '@/lib/portal-theme';
import {
  deviceIsDark,
  readThemeMode,
  resolveTheme,
  saveThemeMode,
  watchDeviceTheme,
} from '@/lib/theme-mode';

export function PortalThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readThemeMode);
  const [deviceDark, setDeviceDark] = useState(deviceIsDark);
  const shown = resolveTheme(mode, deviceDark);

  useEffect(() => watchDeviceTheme(setDeviceDark), []);

  // Before paint, so a page never flashes in the other theme.
  useLayoutEffect(() => applyThemeToPage(shown), [shown]);
  useLayoutEffect(() => () => applyThemeToPage(null), []);

  const theme = useMemo(() => createPortalTheme(shown, readThemeVariables(shown)), [shown]);

  const appearance = useMemo<Appearance>(
    () => ({
      mode,
      shown,
      setMode: (next) => {
        saveThemeMode(next);
        setMode(next);
      },
    }),
    [mode, shown],
  );

  return (
    <AppearanceContext.Provider value={appearance}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={APP_CONFIG.dateLocale}>
          {children}
        </LocalizationProvider>
      </ThemeProvider>
    </AppearanceContext.Provider>
  );
}
