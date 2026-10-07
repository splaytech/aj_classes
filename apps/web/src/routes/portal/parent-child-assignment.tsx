// One of a child's assignments, read-only, for a parent (R3b story FP2): the questions, the
// child's answers once handed in, and the marks, feedback and comment once returned. Draft
// answers stay private to the child (the database doesn't send them).

import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLoaderData } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import {
  AnswersList,
  DueChip,
  LoadError,
  NotFoundPanel,
  PageHeader,
  ResultsCard,
  SectionCard,
} from '@/components/portal';
import {
  FAMILY_STATUS_LABELS,
  PARENT_ASSIGNMENT_PAGE,
  PORTAL_SEO,
  RESULTS_TEXT,
  SOLVE_PAGE,
  parentChildPath,
} from '@/constants';
import { formatDateTime } from '@/lib/format';
import { firstName } from '@/lib/labels';
import { isToDo } from '@/lib/family-progress';
import { buildPortalMeta } from '@/lib/seo';
import { getChildAssignment, listMyChildren } from '@/services';
import type { FamilyAssignmentView } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.parentChildAssignment);
}

// Access (parent) is checked by the parent layout; the database refuses anyone else's child (F6).
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const studentId = params.studentId ?? '';
  const [children, view] = await Promise.all([
    listMyChildren(),
    getChildAssignment(studentId, params.assignmentId ?? ''),
  ]);
  return { studentId, children, view };
}

export default function ParentChildAssignmentPage() {
  const { studentId, children, view } = useLoaderData<typeof clientLoader>();

  if (!view.ok) {
    return view.error === 'notFound' ? <NotFoundPanel /> : <LoadError error={view.error} />;
  }
  const childName =
    (children.ok && children.data.find((child) => child.id === studentId)?.fullName) || '';
  const work = view.data;

  return (
    <>
      <PageHeader
        title={work.title}
        intro={work.className}
        back={{ to: parentChildPath(studentId), label: PARENT_ASSIGNMENT_PAGE.back(childName) }}
        meta={
          <>
            <Chip
              size="small"
              variant="outlined"
              color={work.status === 'returned' ? 'success' : 'default'}
              label={FAMILY_STATUS_LABELS[work.status]}
            />
            {isToDo(work.status) && <DueChip dueOn={work.dueOn} />}
            {work.isLate && <Chip size="small" color="warning" label={SOLVE_PAGE.late} />}
          </>
        }
      />
      <Stack spacing={4}>
        <StatusNote work={work} childName={childName} />
        <SectionCard title={SOLVE_PAGE.instructionsHeading}>
          <Typography sx={{ whiteSpace: 'pre-line' }}>
            {work.instructions || SOLVE_PAGE.noInstructions}
          </Typography>
        </SectionCard>
        {work.status === 'returned' && (
          <ResultsCard view={work} heading={RESULTS_TEXT.headingFor(firstName(childName))} />
        )}
        {(work.status === 'submitted' || work.status === 'returned') &&
          work.questions.length > 0 && (
            <AnswersList questions={work.questions} answerLabel={RESULTS_TEXT.theirAnswer} />
          )}
      </Stack>
    </>
  );
}

function StatusNote({ work, childName }: { work: FamilyAssignmentView; childName: string }) {
  if (work.status === 'not_started') {
    return <Alert severity="info">{PARENT_ASSIGNMENT_PAGE.notStarted(childName)}</Alert>;
  }
  if (work.status === 'in_progress') {
    return <Alert severity="info">{PARENT_ASSIGNMENT_PAGE.inProgress(childName)}</Alert>;
  }
  if (work.status === 'submitted' && work.submittedAt) {
    return (
      <Alert severity="info">
        {PARENT_ASSIGNMENT_PAGE.waiting(formatDateTime(work.submittedAt))}
      </Alert>
    );
  }
  return null;
}
