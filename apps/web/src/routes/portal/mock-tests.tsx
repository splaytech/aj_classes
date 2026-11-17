// Mock tests for a student, parent or signed-up user (design §4.3): the released ones, with how
// far this person has got. One page mounted under all three areas; the path says which. It loads
// once per visit, so a mock test released while it is open shows up after a refresh.

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useLoaderData, useLocation } from 'react-router';

import {
  LoadError,
  MockTakeStatusChip,
  MockTestsErrorBoundary,
  PageHeader,
} from '@/components/portal';
import { MOCK_TESTS_LIST, PORTAL_SEO, mockTestPath } from '@/constants';
import { mockScoreText, mockTestAreaFromPath } from '@/lib/mock-tests';
import { buildPortalMeta } from '@/lib/seo';
import { listMyMockTests } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.mockTests);
}

// Access (student, parent or user) is checked by the area's layout; the database checks it again.
export async function clientLoader() {
  return listMyMockTests();
}

export function ErrorBoundary() {
  return <MockTestsErrorBoundary />;
}

export default function MockTestsPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const area = mockTestAreaFromPath(useLocation().pathname);

  if (!loaded.ok) return <LoadError error={loaded.error} />;

  return (
    <>
      <PageHeader title={MOCK_TESTS_LIST.heading} intro={MOCK_TESTS_LIST.intro} />
      <Stack spacing={2}>
        {loaded.data.map((item) => (
          <Paper key={item.id} variant="outlined" sx={{ p: 3 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
            >
              <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <Typography component="h2" sx={{ fontWeight: 700 }}>
                  {item.title}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {MOCK_TESTS_LIST.questions(item.questionCount)}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: 'wrap' }}>
                  <MockTakeStatusChip status={item.status} />
                </Stack>
                {item.status === 'submitted' && item.score !== null && item.total !== null && (
                  <Typography sx={{ mt: 1, fontWeight: 700 }}>
                    {mockScoreText(item.score, item.total)}
                  </Typography>
                )}
              </Box>
              <Button
                variant={item.status === 'submitted' ? 'outlined' : 'contained'}
                component={RouterLink}
                to={mockTestPath(area, item.id)}
              >
                {MOCK_TESTS_LIST.actions[item.status]}
              </Button>
            </Stack>
          </Paper>
        ))}
        {loaded.data.length === 0 && (
          <Typography color="textSecondary">{MOCK_TESTS_LIST.empty}</Typography>
        )}
      </Stack>
    </>
  );
}
