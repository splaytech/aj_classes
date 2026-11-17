// Admin → one mock test (design §4.3). A draft: edit the details, add, change, delete and move
// questions, release it, or delete it. A released test is read-only, and can go back to draft only
// while nobody has submitted it (in-progress attempts are deleted). The database enforces every one of these rules; this page just
// shows the controls that can work and the plain reason when one is refused.

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useLoaderData, useNavigate, useRevalidator } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import {
  ConfirmDialog,
  LoadError,
  MockQuestionList,
  MockTestDialog,
  MockTestStatusChip,
  MockTestsErrorBoundary,
  NotFoundPanel,
  PageHeader,
  SectionCard,
} from '@/components/portal';
import { MOCK_TEST_EDIT_PAGE, PORTAL_ROUTES, PORTAL_SEO } from '@/constants';
import { buildPortalMeta } from '@/lib/seo';
import { usePortalAction } from '@/lib/use-portal-action';
import { deleteMockTest, getMockTestForEdit, releaseMockTest, withdrawMockTest } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.adminMockTest);
}

// Access (admin) is checked by the admin layout; the database shows rows to admins only.
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  return getMockTestForEdit(params.testId ?? '');
}

export function ErrorBoundary() {
  return <MockTestsErrorBoundary />;
}

type Confirming = 'release' | 'takeBack' | 'delete' | null;

export default function AdminMockTestPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const action = usePortalAction();
  const [editingDetails, setEditingDetails] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);

  if (!loaded.ok) {
    return loaded.error === 'notFound' ? <NotFoundPanel /> : <LoadError error={loaded.error} />;
  }
  const test = loaded.data;
  const isDraft = test.status === 'draft';
  const canRelease = test.questions.length > 0;

  function reload() {
    void revalidator.revalidate();
  }

  async function confirmRelease() {
    const worked = await action.run(() => releaseMockTest(test.id), MOCK_TEST_EDIT_PAGE.released);
    setConfirming(null);
    if (worked) reload();
  }

  async function confirmTakeBack() {
    const worked = await action.run(() => withdrawMockTest(test.id), MOCK_TEST_EDIT_PAGE.takenBack);
    setConfirming(null);
    if (worked) reload();
  }

  async function confirmDelete() {
    const worked = await action.run(() => deleteMockTest(test.id));
    setConfirming(null);
    if (worked) void navigate(PORTAL_ROUTES.adminMockTests);
  }

  return (
    <>
      <PageHeader
        title={test.title}
        back={{ to: PORTAL_ROUTES.adminMockTests, label: MOCK_TEST_EDIT_PAGE.back }}
        meta={<MockTestStatusChip status={test.status} />}
        actions={
          isDraft ? (
            <>
              <Button variant="outlined" onClick={() => setEditingDetails(true)}>
                {MOCK_TEST_EDIT_PAGE.editDetails}
              </Button>
              <Button
                variant="contained"
                disabled={!canRelease || action.busy}
                onClick={() => setConfirming('release')}
              >
                {MOCK_TEST_EDIT_PAGE.release}
              </Button>
              <Button
                color="error"
                variant="outlined"
                disabled={action.busy}
                onClick={() => setConfirming('delete')}
              >
                {MOCK_TEST_EDIT_PAGE.deleteDraft}
              </Button>
            </>
          ) : (
            <Button
              variant="outlined"
              disabled={action.busy}
              onClick={() => setConfirming('takeBack')}
            >
              {MOCK_TEST_EDIT_PAGE.takeBack}
            </Button>
          )
        }
      />

      <Stack spacing={4}>
        {action.notice && <Alert severity="success">{action.notice}</Alert>}
        {action.error && <Alert severity="error">{action.error}</Alert>}
        <Alert severity="info">
          {isDraft ? MOCK_TEST_EDIT_PAGE.draftNote : MOCK_TEST_EDIT_PAGE.releasedNote}
        </Alert>
        {isDraft && !canRelease && (
          <Typography color="textSecondary">{MOCK_TEST_EDIT_PAGE.releaseNeedsQuestions}</Typography>
        )}

        <SectionCard title={MOCK_TEST_EDIT_PAGE.instructionsHeading}>
          {/* Plain text only: React escapes it; line breaks are kept. */}
          <Typography sx={{ whiteSpace: 'pre-line' }}>
            {test.instructions || MOCK_TEST_EDIT_PAGE.noInstructions}
          </Typography>
        </SectionCard>

        <MockQuestionList
          testId={test.id}
          questions={test.questions}
          editable={isDraft}
          onChanged={reload}
        />
      </Stack>

      {editingDetails && (
        <MockTestDialog
          open
          existing={test}
          onSaved={() => {
            setEditingDetails(false);
            action.announce(MOCK_TEST_EDIT_PAGE.detailsSaved);
            reload();
          }}
          onClose={() => setEditingDetails(false)}
        />
      )}
      <ConfirmDialog
        open={confirming === 'release'}
        title={MOCK_TEST_EDIT_PAGE.confirmReleaseTitle}
        text={MOCK_TEST_EDIT_PAGE.confirmReleaseText}
        confirmLabel={MOCK_TEST_EDIT_PAGE.release}
        busy={action.busy}
        onConfirm={confirmRelease}
        onClose={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === 'takeBack'}
        title={MOCK_TEST_EDIT_PAGE.confirmTakeBackTitle}
        text={MOCK_TEST_EDIT_PAGE.confirmTakeBackText}
        confirmLabel={MOCK_TEST_EDIT_PAGE.takeBack}
        busy={action.busy}
        onConfirm={confirmTakeBack}
        onClose={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === 'delete'}
        title={MOCK_TEST_EDIT_PAGE.confirmDeleteTitle}
        text={MOCK_TEST_EDIT_PAGE.confirmDeleteText(test.title)}
        confirmLabel={MOCK_TEST_EDIT_PAGE.deleteDraft}
        destructive
        busy={action.busy}
        onConfirm={confirmDelete}
        onClose={() => setConfirming(null)}
      />
    </>
  );
}
