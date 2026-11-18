// Admin → who has submitted one mock test (design §6.3, AC 28 to 37). A read-only list of names,
// times and scores, newest first. No answers, no e-mail and no controls (AC 35).

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLoaderData } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import {
  LoadError,
  MockClosedChip,
  MockResultsTable,
  MockTestsErrorBoundary,
  NotFoundPanel,
  PageHeader,
} from '@/components/portal';
import { MOCK_RESULTS_PAGE, MOCK_SCORING, PORTAL_SEO, adminMockTestPath } from '@/constants';
import { mockClosingState, mockResultsTruncated } from '@/lib/mock-tests';
import { buildPortalMeta } from '@/lib/seo';
import { getMockTestResults } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.adminMockTestResults);
}

// The layout refuses non-admins; the service sends no request for them.
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  return getMockTestResults(params.testId ?? '');
}

export function ErrorBoundary() {
  return <MockTestsErrorBoundary />;
}

export default function AdminMockTestResultsPage() {
  const loaded = useLoaderData<typeof clientLoader>();

  if (!loaded.ok) {
    return loaded.error === 'notFound' ? (
      <NotFoundPanel />
    ) : (
      <LoadError error={loaded.error} retry />
    );
  }
  const view = loaded.data;
  const isClosed = mockClosingState(view.closesAt, new Date()) === 'closed';

  return (
    <Stack spacing={3}>
      <PageHeader
        title={MOCK_RESULTS_PAGE.title(view.title)}
        intro={MOCK_RESULTS_PAGE.intro}
        back={{ to: adminMockTestPath(view.testId), label: MOCK_RESULTS_PAGE.back }}
        meta={
          (isClosed || view.passMark !== null) && (
            <>
              {isClosed && <MockClosedChip />}
              {view.passMark !== null && (
                <Typography variant="body2" color="textSecondary">
                  {MOCK_SCORING.passMarkLine(view.passMark)}
                </Typography>
              )}
            </>
          )
        }
      />
      {view.rows.length === 0 ? (
        <Typography color="textSecondary">{MOCK_RESULTS_PAGE.empty}</Typography>
      ) : (
        <>
          {mockResultsTruncated(view) && (
            <Typography color="textSecondary">
              {MOCK_RESULTS_PAGE.showing(view.rows.length, view.totalRows)}
            </Typography>
          )}
          <MockResultsTable rows={view.rows} />
        </>
      )}
    </Stack>
  );
}
