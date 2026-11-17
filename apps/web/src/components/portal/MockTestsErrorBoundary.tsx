// What a mock test page shows when it can't be shown: plain words, never the raw error, and a
// Try again button. Each mock test route module exports its own ErrorBoundary that renders this
// (AC 39); the portal root's boundary stays as the outer net.

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useNavigate, useRouteError } from 'react-router';

import { MOCK_TESTS_ERROR_BOUNDARY, PORTAL_ERRORS } from '@/constants';
import { isConnectionFailure } from '@/lib/connection-errors';

export function MockTestsErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  // "Check your connection" only when that's the cause, as portal-root's boundary does.
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const text =
    offline || isConnectionFailure(error) ? PORTAL_ERRORS.network : MOCK_TESTS_ERROR_BOUNDARY.text;

  return (
    <Stack spacing={2} role="alert">
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {MOCK_TESTS_ERROR_BOUNDARY.heading}
      </Typography>
      <Typography color="textSecondary">{text}</Typography>
      <Box>
        {/* 0 reloads the page: a route that failed to render needs a fresh start. */}
        <Button variant="contained" onClick={() => void navigate(0)}>
          {MOCK_TESTS_ERROR_BOUNDARY.tryAgain}
        </Button>
      </Box>
    </Stack>
  );
}
