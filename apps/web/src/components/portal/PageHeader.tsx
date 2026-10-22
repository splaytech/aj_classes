// Title row for staff pages: optional back link, heading, short intro and action buttons.

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';

type PageHeaderProps = {
  title: string;
  intro?: string;
  back?: { to: string; label: string };
  /** Chips or other small facts shown under the title. */
  meta?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, intro, back, meta, actions }: PageHeaderProps) {
  return (
    <Box component="header" sx={{ mb: 6 }}>
      {back && (
        <Link component={RouterLink} to={back.to} underline="hover" variant="body2">
          {back.label}
        </Link>
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={3}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' }, mt: back ? 2 : 0 }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {intro && (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {intro}
            </Typography>
          )}
          {meta && (
            <Stack direction="row" spacing={2} useFlexGap sx={{ mt: 2, flexWrap: 'wrap' }}>
              {meta}
            </Stack>
          )}
        </Box>
        {actions && (
          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', flexShrink: 0 }}>
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
