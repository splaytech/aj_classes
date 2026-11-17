// Mock tests for a student, parent or signed-up user (design §4.3): the released ones, with how
// far this person has got. One page mounted under all three areas; the path says which. It loads
// once per visit, so a mock test released while it is open shows up after a refresh. A closed test
// is listed only for someone who submitted it, marked Closed (ruling S-1). Stream, Subject and
// Year level filters narrow the list on the page only: they don't change who sees what, and a
// reload resets them (categories ACs 19 to 25).

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Link as RouterLink, useLoaderData, useLocation } from 'react-router';

import {
  LoadError,
  MockClosedChip,
  MockTagLine,
  MockTakeStatusChip,
  MockTestFilters,
  MockTestsErrorBoundary,
  PageHeader,
} from '@/components/portal';
import { MOCK_TEST_FILTERS, MOCK_TESTS_LIST, PORTAL_SEO, mockTestPath } from '@/constants';
import {
  NO_MOCK_FILTERS,
  filterMockTests,
  mockClosingState,
  mockScoreText,
  mockTestAreaFromPath,
} from '@/lib/mock-tests';
import { buildPortalMeta } from '@/lib/seo';
import { listMyMockTests } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.mockTests);
}

// The layout refuses staff and signed-out visitors; the service sends no request for them (BUG-2).
export async function clientLoader() {
  return listMyMockTests();
}

export function ErrorBoundary() {
  return <MockTestsErrorBoundary />;
}

export default function MockTestsPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const area = mockTestAreaFromPath(useLocation().pathname);
  // Above the early return: hooks must run on every render.
  const [filters, setFilters] = useState(NO_MOCK_FILTERS);
  const now = new Date();

  if (!loaded.ok) return <LoadError error={loaded.error} retry />;
  const visible = filterMockTests(loaded.data, filters);

  return (
    <>
      <PageHeader title={MOCK_TESTS_LIST.heading} intro={MOCK_TESTS_LIST.intro} />
      <Stack spacing={2}>
        {/* Nothing to see at all: the plain empty text and no filters (AC 22a). */}
        {loaded.data.length === 0 && (
          <Typography color="textSecondary">{MOCK_TESTS_LIST.empty}</Typography>
        )}
        {loaded.data.length > 0 && <MockTestFilters value={filters} onChange={setFilters} />}
        {/* Filters set and nothing matches: say so, and offer to clear them (AC 22b). */}
        {loaded.data.length > 0 && visible.length === 0 && (
          <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Typography color="textSecondary">{MOCK_TEST_FILTERS.noMatch}</Typography>
            <Button variant="outlined" onClick={() => setFilters(NO_MOCK_FILTERS)}>
              {MOCK_TEST_FILTERS.clear}
            </Button>
          </Stack>
        )}
        {visible.map((item) => (
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
                <MockTagLine tags={item.tags} />
                <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: 'wrap' }}>
                  <MockTakeStatusChip status={item.status} />
                  {mockClosingState(item.closesAt, now) === 'closed' && <MockClosedChip />}
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
      </Stack>
    </>
  );
}
