// Assignment page (R3a stories TS3, TS4, AS7; R3b FT1–FT3): the assignment and its questions,
// publishing, then the students' work: online submissions, or one card per student for paper
// homework.

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
  HoldResultsSetting,
  LoadError,
  NotFoundPanel,
  PageHeader,
  QuestionList,
  SectionCard,
  SubmissionsTable,
} from '@/components/portal';
import { ResultCard } from '@/components/portal/ResultCard';
import {
  ASSIGNMENT_STATE_LABELS,
  MARKING_PAGE,
  PORTAL_COMMON,
  PORTAL_ROUTES,
  PORTAL_SEO,
  PUBLISHING,
  SUBMISSIONS,
  classPath,
} from '@/constants';
import { markingProgress } from '@/lib/assignments';
import { buildPortalMeta } from '@/lib/seo';
import { usePortalAction } from '@/lib/use-portal-action';
import {
  deleteAssignment,
  getAssignment,
  saveAssignment,
  setAssignmentPublished,
} from '@/services';
import type { AssignmentDetail } from '@/services';

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
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const deleteAction = usePortalAction();
  const publishAction = usePortalAction();

  if (!loaded.ok)
    return loaded.error === 'notFound' ? <NotFoundPanel /> : <LoadError error={loaded.error} />;

  const assignment = loaded.data;
  const progress = markingProgress(assignment);
  const isOnline = assignment.questionCount > 0;
  const refresh = () => revalidator.revalidate();

  async function confirmPublishChange() {
    const publish = !assignment.isPublished;
    const changed = await publishAction.run(
      () => setAssignmentPublished(assignment.id, publish),
      publish ? PUBLISHING.published : PUBLISHING.unpublished,
    );
    setConfirmingPublish(false);
    if (changed) refresh();
  }

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
            <Chip
              size="small"
              color={assignment.isPublished ? 'success' : 'default'}
              variant={assignment.isPublished ? 'outlined' : 'filled'}
              label={ASSIGNMENT_STATE_LABELS[assignment.isPublished ? 'published' : 'draft']}
            />
            <DueChip dueOn={assignment.dueOn} />
            <Chip
              size="small"
              variant="outlined"
              label={
                assignment.totalMarks === null
                  ? MARKING_PAGE.feedbackOnly
                  : MARKING_PAGE.outOf(assignment.totalMarks)
              }
            />
            {assignment.isPublished && (
              <Typography variant="body2" color="textSecondary">
                {isOnline
                  ? SUBMISSIONS.progress(progress.returned, progress.total)
                  : MARKING_PAGE.progress(progress.marked, progress.total)}
              </Typography>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant={assignment.isPublished ? 'outlined' : 'contained'}
              onClick={() => setConfirmingPublish(true)}
            >
              {assignment.isPublished ? PUBLISHING.unpublish : PUBLISHING.publish}
            </Button>
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
      {publishAction.error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {publishAction.error}
        </Alert>
      )}
      {publishAction.notice && (
        <Alert severity="success" sx={{ mb: 4 }}>
          {publishAction.notice}
        </Alert>
      )}
      {!assignment.isPublished && (
        <Alert severity="info" sx={{ mb: 4 }}>
          {PUBLISHING.draftNote}
        </Alert>
      )}

      <Stack spacing={4}>
        <SectionCard title={MARKING_PAGE.instructionsHeading}>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
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

        {(isOnline || !assignment.isPublished) && (
          <>
            <QuestionList
              assignmentId={assignment.id}
              questions={assignment.questions}
              editable={!assignment.isPublished}
              onChanged={refresh}
            />
            {/* Paper homework has no questions, so it never auto-returns and never shows this. */}
            {isOnline && (
              <HoldResultsSetting
                assignmentId={assignment.id}
                holdResults={assignment.holdResults}
                isPublished={assignment.isPublished}
                onChanged={refresh}
                revision={assignment}
              />
            )}
          </>
        )}

        <StudentWork assignment={assignment} isOnline={isOnline} onChanged={refresh} />
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
        open={confirmingPublish}
        title={
          assignment.isPublished ? PUBLISHING.confirmUnpublishTitle : PUBLISHING.confirmPublishTitle
        }
        text={
          assignment.isPublished
            ? PUBLISHING.confirmUnpublishText
            : PUBLISHING.confirmPublishText(assignment.className, isOnline)
        }
        confirmLabel={assignment.isPublished ? PUBLISHING.unpublish : PUBLISHING.publish}
        busy={publishAction.busy}
        onConfirm={confirmPublishChange}
        onClose={() => setConfirmingPublish(false)}
      />
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

type StudentWorkProps = { assignment: AssignmentDetail; isOnline: boolean; onChanged: () => void };

/** Drafts collect nothing yet; online work is marked per submission; paper homework per card. */
function StudentWork({ assignment, isOnline, onChanged }: StudentWorkProps) {
  if (!assignment.isPublished) {
    return <Typography color="textSecondary">{SUBMISSIONS.draftNote}</Typography>;
  }
  if (isOnline) return <SubmissionsTable assignment={assignment} />;
  if (assignment.students.length === 0) {
    return <Typography color="textSecondary">{MARKING_PAGE.noStudents}</Typography>;
  }
  return (
    <>
      <Typography variant="body2" color="textSecondary">
        {MARKING_PAGE.returnedNote}
      </Typography>
      {assignment.students.map((student) => (
        <ResultCard
          key={student.id}
          assignmentId={assignment.id}
          maxMark={assignment.maxMark}
          student={student}
          result={assignment.results.find((result) => result.studentId === student.id) ?? null}
          onSaved={onChanged}
        />
      ))}
    </>
  );
}
