// Marking page (R3a stories TS3, TS4, AS7): the assignment, then one card per enrolled student.

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Link as RouterLink, useLoaderData, useNavigate, useRevalidator } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import {
  AssignmentDialog,
  ConfirmDialog,
  DueChip,
  LoadError,
  NotFoundPanel,
  PageHeader,
  SectionCard,
} from '@/components/portal';
import { ResultCard } from '@/components/portal/ResultCard';
import { MARKING_PAGE, PORTAL_COMMON, PORTAL_ROUTES, PORTAL_SEO, classPath } from '@/constants';
import { markingProgress } from '@/lib/assignments';
import { buildPortalMeta } from '@/lib/seo';
import { usePortalAction } from '@/lib/use-portal-action';
import { deleteAssignment, getAssignment, saveAssignment } from '@/services';

const ASSIGNMENTS_TAB = '?tab=assignments';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.assignmentDetail);
}

// Access is checked by the staff layout; the database only returns assignments this person
// may see (the class tutor or an admin), so anything else shows "Not found".
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  return getAssignment(params.assignmentId ?? '');
}

export default function AssignmentDetailPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteAction = usePortalAction();

  if (!loaded.ok)
    return loaded.error === 'notFound' ? <NotFoundPanel /> : <LoadError error={loaded.error} />;

  const assignment = loaded.data;
  const progress = markingProgress(assignment);
  const refresh = () => revalidator.revalidate();

  async function confirmDelete() {
    const deleted = await deleteAction.run(() => deleteAssignment(assignment.id));
    setConfirmingDelete(false);
    if (deleted) navigate(`${classPath(assignment.classId)}${ASSIGNMENTS_TAB}`, { replace: true });
  }

  return (
    <>
      <PageHeader
        title={assignment.title}
        back={{ to: PORTAL_ROUTES.assignments, label: MARKING_PAGE.back }}
        meta={
          <>
            <DueChip dueOn={assignment.dueOn} />
            <Chip
              size="small"
              variant="outlined"
              label={
                assignment.maxMark === null
                  ? MARKING_PAGE.feedbackOnly
                  : MARKING_PAGE.outOf(assignment.maxMark)
              }
            />
            <Typography variant="body2" color="text.secondary">
              {MARKING_PAGE.progress(progress.marked, progress.total)}
            </Typography>
          </>
        }
        actions={
          <>
            <Button variant="outlined" onClick={() => setEditing(true)}>
              {MARKING_PAGE.edit}
            </Button>
            <Button color="error" onClick={() => setConfirmingDelete(true)}>
              {MARKING_PAGE.delete}
            </Button>
          </>
        }
      />
      {deleteAction.error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {deleteAction.error}
        </Alert>
      )}

      <Stack spacing={4}>
        <SectionCard title={MARKING_PAGE.instructionsHeading}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {MARKING_PAGE.className}
            {PORTAL_COMMON.space}
            <Link component={RouterLink} to={classPath(assignment.classId)}>
              {assignment.className}
            </Link>
          </Typography>
          {/* Plain text only (R3a review H11): React escapes it; line breaks are kept. */}
          <Typography sx={{ whiteSpace: 'pre-line' }}>
            {assignment.instructions || MARKING_PAGE.noInstructions}
          </Typography>
        </SectionCard>

        {assignment.students.length === 0 ? (
          <Typography color="text.secondary">{MARKING_PAGE.noStudents}</Typography>
        ) : (
          assignment.students.map((student) => (
            <ResultCard
              key={student.id}
              assignmentId={assignment.id}
              maxMark={assignment.maxMark}
              student={student}
              result={assignment.results.find((result) => result.studentId === student.id) ?? null}
              onSaved={refresh}
            />
          ))
        )}
      </Stack>

      {editing && (
        <AssignmentDialog
          open
          classId={assignment.classId}
          existing={assignment}
          onSave={saveAssignment}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
          onClose={() => setEditing(false)}
        />
      )}
      <ConfirmDialog
        open={confirmingDelete}
        title={MARKING_PAGE.confirmDeleteTitle}
        text={MARKING_PAGE.confirmDeleteText}
        confirmLabel={MARKING_PAGE.delete}
        destructive
        busy={deleteAction.busy}
        onConfirm={confirmDelete}
        onClose={() => setConfirmingDelete(false)}
      />
    </>
  );
}
