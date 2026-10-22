// Small page-level messages and the card used to group sections on staff pages.

import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

import { NOT_FOUND_PANEL, PORTAL_ERRORS } from '@/constants';
import type { ErrorKey } from '@/services';

/** RLS hides rows people may not see, so "not found" also covers "no access" (R3a review H9). */
export function NotFoundPanel() {
  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {NOT_FOUND_PANEL.heading}
      </Typography>
      <Typography color="text.secondary">{NOT_FOUND_PANEL.text}</Typography>
    </Stack>
  );
}

export function LoadError({ error }: { error: ErrorKey }) {
  return <Alert severity="error">{PORTAL_ERRORS[error]}</Alert>;
}

type SectionCardProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

export function SectionCard({ title, action, children }: SectionCardProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}
        >
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {action}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}
