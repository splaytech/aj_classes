// One assignment for a student (R3b stories FS2, FS3): answer it online (autosaved) and hand it
// in; afterwards see what was handed in, and once returned the score, marks, correct answers,
// explanations, feedback and the tutor's comment. Paper homework just says to hand it in.

import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import {
  AnswersList,
  DueChip,
  LoadError,
  NotFoundPanel,
  PageHeader,
  ResultsCard,
  SectionCard,
  SolveForm,
} from '@/components/portal';
import {
  FAMILY_STATUS_LABELS,
  PORTAL_ROUTES,
  PORTAL_SEO,
  RESULTS_TEXT,
  SOLVE_PAGE,
} from '@/constants';
import type { FamilyStatus } from '@/constants';
import { formatDateTime } from '@/lib/format';
import { isToDo } from '@/lib/family-progress';
import { buildPortalMeta } from '@/lib/seo';
import { getMyAssignment } from '@/services';
import type { FamilyAssignmentView } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.studentAssignment);
}

// Access (student) is checked by the student layout; the database only shows their own work.
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  return getMyAssignment(params.assignmentId ?? '');
}

export default function StudentAssignmentPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const [notice, setNotice] = useState('');

  if (!loaded.ok) {
    return loaded.error === 'notFound' ? <NotFoundPanel /> : <LoadError error={loaded.error} />;
  }
  const view = loaded.data;
  const isOnline = view.questions.length > 0;
  const canAnswer = isOnline && (view.status === 'not_started' || view.status === 'in_progress');

  function handleHandedIn(status: FamilyStatus) {
    setNotice(status === 'returned' ? SOLVE_PAGE.autoMarked : SOLVE_PAGE.handedIn);
    void revalidator.revalidate();
  }

  return (
    <>
      <PageHeader
        title={view.title}
        intro={view.className}
        back={{ to: PORTAL_ROUTES.student, label: SOLVE_PAGE.back }}
        meta={
          <>
            {/* While answering, the progress bar shows how far along the work is. */}
            {!canAnswer && (
              <Chip
                size="small"
                variant="outlined"
                color={view.status === 'returned' ? 'success' : 'default'}
                label={FAMILY_STATUS_LABELS[view.status]}
              />
            )}
            {isToDo(view.status) && <DueChip dueOn={view.dueOn} />}
            {view.isLate && <Chip size="small" color="warning" label={SOLVE_PAGE.late} />}
          </>
        }
      />

      <Stack spacing={4}>
        {notice && <Alert severity="success">{notice}</Alert>}

        <SectionCard title={SOLVE_PAGE.instructionsHeading}>
          {/* Plain text only (R3b F16): React escapes it; line breaks are kept. */}
          <Typography sx={{ whiteSpace: 'pre-line' }}>
            {view.instructions || SOLVE_PAGE.noInstructions}
          </Typography>
        </SectionCard>

        {!isOnline && view.status !== 'returned' && (
          <Alert severity="info">{SOLVE_PAGE.paperNote}</Alert>
        )}

        {canAnswer ? (
          <SolveForm view={view} onHandedIn={handleHandedIn} />
        ) : (
          <HandedIn view={view} />
        )}
      </Stack>
    </>
  );
}

/** After handing in: what was handed in; once returned, the results too. */
function HandedIn({ view }: { view: FamilyAssignmentView }) {
  return (
    <>
      {view.status === 'submitted' && view.submittedAt && (
        <Alert severity="info">{SOLVE_PAGE.waiting(formatDateTime(view.submittedAt))}</Alert>
      )}
      {view.status === 'returned' && <ResultsCard view={view} heading={RESULTS_TEXT.heading} />}
      {view.questions.length > 0 && (
        <AnswersList questions={view.questions} answerLabel={RESULTS_TEXT.yourAnswer} />
      )}
    </>
  );
}
