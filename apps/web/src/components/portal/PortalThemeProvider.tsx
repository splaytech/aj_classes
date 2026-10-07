// Material UI theme and date-picker locale for the signed-in staff pages (R3a design §5.2).

import { ThemeProvider } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import 'dayjs/locale/en-au';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { APP_CONFIG } from '@/constants';
import { createPortalTheme } from '@/lib/portal-theme';

export function PortalThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useState(createPortalTheme);

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={APP_CONFIG.dateLocale}>
        {children}
      </LocalizationProvider>
    </ThemeProvider>
  );
}
