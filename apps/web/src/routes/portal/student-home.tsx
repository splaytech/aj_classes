// Student home (R3b story FS1): progress, work to do (soonest due first), work waiting for
// marking, and work that has been returned with its score and the tutor's comment.

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useLoaderData } from 'react-router';

import {
  DueChip,
  LoadError,
  PageHeader,
  PastClassChip,
  ProgressSummary,
  SectionCard,
  scoreText,
} from '@/components/portal';
import {
  PORTAL_ROUTES,
  PORTAL_SEO,
  SOLVE_PAGE,
  STUDENT_HOME,
  studentAssignmentPath,
} from '@/constants';
import { familyProgress, groupAssignments } from '@/lib/family-progress';
import { formatDateTime } from '@/lib/format';
import { firstName } from '@/lib/labels';
import { buildPortalMeta } from '@/lib/seo';
import { listMyAssignments } from '@/services';
import type { FamilyAssignment } from '@/services';

import { usePortalAccess } from './member-layout';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.student);
}

// Access (student) is checked by the student layout; the database returns only their own work.
export async function clientLoader() {
  return listMyAssignments();
}

export default function StudentHomePage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const access = usePortalAccess();

  if (!loaded.ok) return <LoadError error={loaded.error} />;
  const groups = groupAssignments(loaded.data);

  return (
    <>
      <PageHeader
        title={STUDENT_HOME.greeting(firstName(access.profile?.fullName ?? ''))}
        intro={STUDENT_HOME.intro}
        actions={
          <Button variant="outlined" component={RouterLink} to={PORTAL_ROUTES.studentTimetable}>
            {STUDENT_HOME.timetableLink}
          </Button>
        }
      />
      <Stack spacing={4}>
        <ProgressSummary progress={familyProgress(loaded.data)} />

        <SectionCard title={STUDENT_HOME.toDo.heading}>
          {groups.toDo.length === 0 ? (
            <Typography color="textSecondary">{STUDENT_HOME.toDo.empty}</Typography>
          ) : (
            <Stack spacing={2}>
              {groups.toDo.map((item) => (
                <ToDoItem key={item.id} item={item} />
              ))}
            </Stack>
          )}
        </SectionCard>

        {groups.submitted.length > 0 && (
          <SectionCard title={STUDENT_HOME.submitted.heading}>
            <Stack spacing={2}>
              {groups.submitted.map((item) => (
                <Stack
                  key={item.id}
                  direction="row"
                  spacing={1}
                  useFlexGap
                  sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <Link
                    component={RouterLink}
                    to={studentAssignmentPath(item.id)}
                    sx={{ fontWeight: 700 }}
                  >
                    {item.title}
                  </Link>
                  {item.submittedAt && (
                    <Typography variant="body2" color="textSecondary">
                      {STUDENT_HOME.submitted.handedIn(formatDateTime(item.submittedAt))}
                    </Typography>
                  )}
                  {item.isLate && <Chip size="small" color="warning" label={SOLVE_PAGE.late} />}
                </Stack>
              ))}
            </Stack>
          </SectionCard>
        )}

        <SectionCard title={STUDENT_HOME.returned.heading}>
          {groups.returned.length === 0 ? (
            <Typography color="textSecondary">{STUDENT_HOME.returned.empty}</Typography>
          ) : (
            <Stack spacing={2}>
              {groups.returned.map((item) => (
                <ReturnedItem key={item.id} item={item} />
              ))}
            </Stack>
          )}
        </SectionCard>
      </Stack>
    </>
  );
}

/** Open (paper homework), Start, or Continue. */
function actionLabel(item: FamilyAssignment): string {
  if (item.questionCount === 0) return STUDENT_HOME.toDo.open;
  return item.status === 'in_progress' ? STUDENT_HOME.toDo.continue : STUDENT_HOME.toDo.start;
}

function ToDoItem({ item }: { item: FamilyAssignment }) {
  const isOnline = item.questionCount > 0;

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
      >
        <Box>
          <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
          <Typography variant="body2" color="textSecondary">
            {item.className}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: 'wrap' }}>
            <DueChip dueOn={item.dueOn} />
            {isOnline && item.status === 'in_progress' && item.answeredCount !== null && (
              <Chip
                size="small"
                color="info"
                variant="outlined"
                label={STUDENT_HOME.toDo.answered(item.answeredCount, item.questionCount)}
              />
            )}
            {!isOnline && <Chip size="small" variant="outlined" label={STUDENT_HOME.toDo.paper} />}
          </Stack>
        </Box>
        <Button variant="contained" component={RouterLink} to={studentAssignmentPath(item.id)}>
          {actionLabel(item)}
        </Button>
      </Stack>
    </Paper>
  );
}

function ReturnedItem({ item }: { item: FamilyAssignment }) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
          <Typography variant="body2" color="textSecondary">
            {item.className}
          </Typography>
          {item.isPastClass && (
            <Box sx={{ mt: 1 }}>
              <PastClassChip />
            </Box>
          )}
          <Typography sx={{ mt: 1, fontWeight: 700 }}>{scoreText(item)}</Typography>
          {item.comment && (
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.comment}
            </Typography>
          )}
        </Box>
        <Button variant="outlined" component={RouterLink} to={studentAssignmentPath(item.id)}>
          {STUDENT_HOME.returned.view}
        </Button>
      </Stack>
    </Paper>
  );
}
