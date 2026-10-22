// One child's progress for a parent (R3b story FP2): a summary, every assignment with its status,
// and the mark and tutor comment once returned, then the child's weekly timetable.

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useLoaderData } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import {
  DueChip,
  LoadError,
  NotFoundPanel,
  PageHeader,
  ProgressSummary,
  SectionCard,
  WeekTimetable,
  scoreText,
} from '@/components/portal';
import {
  CLOCK,
  FAMILY_STATUS_LABELS,
  PARENT_CHILD_PAGE,
  PORTAL_ROUTES,
  PORTAL_SEO,
  SOLVE_PAGE,
  parentChildAssignmentPath,
} from '@/constants';
import { familyProgress, groupAssignments, isToDo } from '@/lib/family-progress';
import { studentYearLabel } from '@/lib/labels';
import { buildPortalMeta } from '@/lib/seo';
import { isoDayOfWeek } from '@/lib/timetable';
import { getChildTimetable, listChildAssignments, listMyChildren } from '@/services';
import type { FamilyAssignment, Result, TimetableEntry } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.parentChild);
}

// Access (parent) is checked by the parent layout; the database refuses anyone else's child (F6).
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const studentId = params.studentId ?? '';
  const [children, assignments, timetable] = await Promise.all([
    listMyChildren(),
    listChildAssignments(studentId),
    getChildTimetable(studentId),
  ]);
  return { studentId, children, assignments, timetable };
}

export default function ParentChildPage() {
  const { studentId, children, assignments, timetable } = useLoaderData<typeof clientLoader>();

  if (!children.ok) return <LoadError error={children.error} />;
  if (!assignments.ok && assignments.error !== 'notFound') {
    return <LoadError error={assignments.error} />;
  }
  const child = children.data.find((item) => item.id === studentId);
  if (!child || !assignments.ok) return <NotFoundPanel />;

  const groups = groupAssignments(assignments.data);
  const ordered = [...groups.toDo, ...groups.submitted, ...groups.returned];

  return (
    <>
      <PageHeader
        title={child.fullName}
        intro={[studentYearLabel(child.yearLevel), ...child.classNames].join(CLOCK.listSeparator)}
        back={{ to: PORTAL_ROUTES.parent, label: PARENT_CHILD_PAGE.back }}
      />
      <Stack spacing={4}>
        <ProgressSummary progress={familyProgress(assignments.data)} />

        <SectionCard title={PARENT_CHILD_PAGE.assignmentsHeading}>
          {ordered.length === 0 ? (
            <Typography color="text.secondary">{PARENT_CHILD_PAGE.empty}</Typography>
          ) : (
            <Stack spacing={2}>
              {ordered.map((item) => (
                <AssignmentRow key={item.id} studentId={child.id} item={item} />
              ))}
            </Stack>
          )}
        </SectionCard>

        <SectionCard title={PARENT_CHILD_PAGE.timetableHeading}>
          <ChildTimetable timetable={timetable} />
        </SectionCard>
      </Stack>
    </>
  );
}

function ChildTimetable({ timetable }: { timetable: Result<TimetableEntry[]> }) {
  if (!timetable.ok) return <LoadError error={timetable.error} />;
  if (timetable.data.length === 0) {
    return <Typography color="text.secondary">{PARENT_CHILD_PAGE.timetableEmpty}</Typography>;
  }
  return (
    <WeekTimetable
      entries={timetable.data}
      today={isoDayOfWeek(new Date())}
      showTutor
      linkToClass={false}
    />
  );
}

function AssignmentRow({ studentId, item }: { studentId: string; item: FamilyAssignment }) {
  const isReturned = item.status === 'returned';

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={1}>
        <Link
          component={RouterLink}
          to={parentChildAssignmentPath(studentId, item.id)}
          sx={{ fontWeight: 700 }}
        >
          {item.title}
        </Link>
        <Typography variant="body2" color="text.secondary">
          {item.className}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Chip
            size="small"
            variant="outlined"
            color={isReturned ? 'success' : 'default'}
            label={FAMILY_STATUS_LABELS[item.status]}
          />
          {isToDo(item.status) && <DueChip dueOn={item.dueOn} />}
          {item.isLate && <Chip size="small" color="warning" label={SOLVE_PAGE.late} />}
        </Stack>
        {isReturned && <Typography sx={{ fontWeight: 700 }}>{scoreText(item)}</Typography>}
        {isReturned && item.comment && (
          <Box>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {PARENT_CHILD_PAGE.comment(item.comment)}
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
