// The way into mock tests from a student's, parent's or signed-up user's home page (AC 8). It is
// on those three homes only; admins reach mock tests from their dashboard.

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';

import { MOCK_TESTS_LINK_CARD, mockTestsPath } from '@/constants';
import type { MockTakerArea } from '@/constants';

import { SectionCard } from './Panels';

export function MockTestsLinkCard({ area }: { area: MockTakerArea }) {
  return (
    <SectionCard title={MOCK_TESTS_LINK_CARD.heading}>
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Typography>{MOCK_TESTS_LINK_CARD.text}</Typography>
        <Button variant="outlined" component={RouterLink} to={mockTestsPath(area)}>
          {MOCK_TESTS_LINK_CARD.link}
        </Button>
      </Stack>
    </SectionCard>
  );
}
