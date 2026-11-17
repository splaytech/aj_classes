// One mock test for a student, parent or signed-up user (design §4.3). Not started: the
// instructions and a Start button. In progress: the take form. Submitted: the result. One page
// mounted under all three areas; the path says which. The database only returns the answer keys
// once this person has submitted, and only for released tests.

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLoaderData, useLocation, useRevalidator } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import {
  LoadError,
  MockTakeStatusChip,
  MockTestResult,
  MockTestsErrorBoundary,
  MockTestTakeForm,
  NotFoundPanel,
  PageHeader,
  SectionCard,
} from '@/components/portal';
import { MOCK_TAKE_PAGE, PORTAL_SEO, mockTestsPath } from '@/constants';
import { mockTestAreaFromPath } from '@/lib/mock-tests';
import { buildPortalMeta } from '@/lib/seo';
import { usePortalAction } from '@/lib/use-portal-action';
import { getMyMockTest, startMockTest } from '@/services';
import type { MockTestView } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.mockTest);
}

// The layout refuses staff and signed-out visitors; the service sends no request for them (BUG-2).
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  return getMyMockTest(params.testId ?? '');
}

export function ErrorBoundary() {
  return <MockTestsErrorBoundary />;
}

export default function MockTestPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const area = mockTestAreaFromPath(useLocation().pathname);

  if (!loaded.ok) {
    return loaded.error === 'notFound' ? (
      <NotFoundPanel />
    ) : (
      <LoadError error={loaded.error} retry />
    );
  }
  const test = loaded.data;

  return (
    <>
      <PageHeader
        title={test.title}
        back={{ to: mockTestsPath(area), label: MOCK_TAKE_PAGE.back }}
        meta={<MockTakeStatusChip status={test.status} />}
      />
      {test.status === 'not_started' && (
        <Intro test={test} onStarted={() => void revalidator.revalidate()} />
      )}
      {test.status === 'in_progress' && (
        <MockTestTakeForm test={test} onSubmitted={() => void revalidator.revalidate()} />
      )}
      {test.status === 'submitted' && <MockTestResult test={test} />}
    </>
  );
}

function Intro({ test, onStarted }: { test: MockTestView; onStarted: () => void }) {
  const action = usePortalAction();

  async function start() {
    if (await action.run(() => startMockTest(test.id))) onStarted();
  }

  return (
    <Stack spacing={4}>
      <SectionCard title={MOCK_TAKE_PAGE.instructionsHeading}>
        <Stack spacing={2}>
          {/* Plain text only: React escapes it; line breaks are kept. */}
          <Typography sx={{ whiteSpace: 'pre-line' }}>
            {test.instructions || MOCK_TAKE_PAGE.noInstructions}
          </Typography>
          <Typography color="textSecondary">
            {MOCK_TAKE_PAGE.questions(test.questionCount)}
          </Typography>
        </Stack>
      </SectionCard>
      {action.error && <Alert severity="error">{action.error}</Alert>}
      <Stack direction="row">
        <Button variant="contained" size="large" disabled={action.busy} onClick={start}>
          {action.busy ? MOCK_TAKE_PAGE.starting : MOCK_TAKE_PAGE.start}
        </Button>
      </Stack>
    </Stack>
  );
}
