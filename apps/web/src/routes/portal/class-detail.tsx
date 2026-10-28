// One class (R3a stories TS2, TS3, AS1, AS2, AS4): facts, then Schedule · Students · Assignments.

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useLoaderData, useRevalidator, useSearchParams } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import {
  ClassDialog,
  ConfirmDialog,
  LoadError,
  NotFoundPanel,
  PageHeader,
} from '@/components/portal';
import { AssignmentsTab, ScheduleTab, StudentsTab } from '@/components/portal/ClassTabs';
import {
  CLASS_PAGE,
  CLASSES_PAGE,
  DELIVERY_WITH_LOCATION,
  PORTAL_ROUTES,
  PORTAL_SEO,
} from '@/constants';
import { formatDate } from '@/lib/format';
import { classYearLabel, deliveryLabel, subjectLabel } from '@/lib/labels';
import { buildPortalMeta } from '@/lib/seo';
import { activeStaffOptions } from '@/lib/staff-options';
import { usePortalAction } from '@/lib/use-portal-action';
import {
  getAccessState,
  getClass,
  listAssignments,
  listStudents,
  saveClass,
  setClassActive,
} from '@/services';
import type { ClassDetail } from '@/services';

const TABS = ['schedule', 'students', 'assignments'] as const;
type ClassTab = (typeof TABS)[number];
const TAB_PARAM = 'tab';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.classDetail);
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const classId = params.classId ?? '';
  const access = await getAccessState();
  const isAdmin = access.profile?.role === 'admin';

  const [detail, assignments, tutors, roster] = await Promise.all([
    getClass(classId),
    listAssignments(classId),
    isAdmin ? activeStaffOptions() : Promise.resolve([]),
    isAdmin ? listStudents(false) : Promise.resolve(null),
  ]);
  const teachesIt = detail.ok && detail.data.tutorId === access.userId;

  return {
    detail,
    assignments: assignments.ok ? assignments.data : [],
    tutors,
    roster: roster?.ok ? roster.data : [],
    isAdmin,
    canSetWork: isAdmin || teachesIt,
  };
}

function termText(detail: ClassDetail): string {
  const from = formatDate(detail.startsOn);
  const to = formatDate(detail.endsOn);
  if (from && to) return CLASS_PAGE.facts.termRange(from, to);
  if (from) return CLASS_PAGE.facts.termFrom(from);
  if (to) return CLASS_PAGE.facts.termUntil(to);
  return CLASS_PAGE.facts.noTerm;
}

export default function ClassDetailPage() {
  const { detail, assignments, tutors, roster, isAdmin, canSetWork } =
    useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const archiveAction = usePortalAction();

  if (!detail.ok)
    return detail.error === 'notFound' ? <NotFoundPanel /> : <LoadError error={detail.error} />;

  const item = detail.data;
  const requestedTab = searchParams.get(TAB_PARAM) as ClassTab | null;
  const tab: ClassTab = requestedTab && TABS.includes(requestedTab) ? requestedTab : 'schedule';
  const refresh = () => revalidator.revalidate();

  async function toggleArchived() {
    const done = await archiveAction.run(() => setClassActive(item.id, !item.isActive));
    setConfirmingArchive(false);
    if (done) refresh();
  }

  return (
    <>
      <PageHeader
        title={item.name}
        back={{ to: PORTAL_ROUTES.classes, label: CLASS_PAGE.back }}
        meta={
          <>
            <Chip size="small" label={subjectLabel(item.subject)} />
            <Chip size="small" variant="outlined" label={classYearLabel(item.yearLevels)} />
            <Chip size="small" variant="outlined" label={deliveryLabel(item.delivery)} />
            {!item.isActive && <Chip size="small" color="warning" label={CLASSES_PAGE.archived} />}
          </>
        }
        actions={
          isAdmin && (
            <>
              <Button variant="outlined" onClick={() => setEditing(true)}>
                {CLASS_PAGE.edit}
              </Button>
              {item.isActive ? (
                <Button color="error" onClick={() => setConfirmingArchive(true)}>
                  {CLASS_PAGE.archive}
                </Button>
              ) : (
                <Button onClick={toggleArchived} disabled={archiveAction.busy}>
                  {CLASS_PAGE.restore}
                </Button>
              )}
            </>
          )
        }
      />

      {!item.isActive && (
        <Alert severity="warning" sx={{ mb: 4 }}>
          {CLASS_PAGE.archived}
        </Alert>
      )}
      {archiveAction.error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {archiveAction.error}
        </Alert>
      )}

      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { sm: 'max-content 1fr' },
          columnGap: 6,
          rowGap: 1,
          m: 0,
          mb: 6,
        }}
      >
        <Typography component="dt" color="text.secondary">
          {CLASS_PAGE.facts.tutor}
        </Typography>
        <Stack component="dd" direction="row" spacing={2} sx={{ m: 0, alignItems: 'center' }}>
          <span>{item.tutorName || CLASSES_PAGE.noTutor}</span>
          {item.tutorId && !item.tutorIsActive && (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={CLASSES_PAGE.tutorInactive}
            />
          )}
        </Stack>
        <Typography component="dt" color="text.secondary">
          {CLASS_PAGE.facts.term}
        </Typography>
        <Typography component="dd" sx={{ m: 0 }}>
          {termText(item)}
        </Typography>
        <Typography component="dt" color="text.secondary">
          {CLASS_PAGE.facts.delivery}
        </Typography>
        <Typography component="dd" sx={{ m: 0 }}>
          {item.location
            ? DELIVERY_WITH_LOCATION(deliveryLabel(item.delivery), item.location)
            : deliveryLabel(item.delivery)}
        </Typography>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, value: ClassTab) =>
          setSearchParams({ [TAB_PARAM]: value }, { replace: true })
        }
        aria-label={CLASS_PAGE.tabsLabel}
        sx={{ mb: 4, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="schedule" label={CLASS_PAGE.tabs.schedule} />
        <Tab value="students" label={CLASS_PAGE.tabs.students} />
        <Tab value="assignments" label={CLASS_PAGE.tabs.assignments} />
      </Tabs>

      {tab === 'schedule' && <ScheduleTab detail={item} isAdmin={isAdmin} onChanged={refresh} />}
      {tab === 'students' && (
        <StudentsTab detail={item} isAdmin={isAdmin} roster={roster} onChanged={refresh} />
      )}
      {tab === 'assignments' && (
        <AssignmentsTab detail={item} assignments={assignments} canSetWork={canSetWork} />
      )}

      {editing && (
        <ClassDialog
          open
          existing={item}
          tutors={tutors}
          onSave={saveClass}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
          onClose={() => setEditing(false)}
        />
      )}
      <ConfirmDialog
        open={confirmingArchive}
        title={CLASS_PAGE.confirmArchiveTitle}
        text={CLASS_PAGE.confirmArchiveText}
        confirmLabel={CLASS_PAGE.archive}
        destructive
        busy={archiveAction.busy}
        onConfirm={toggleArchived}
        onClose={() => setConfirmingArchive(false)}
      />
    </>
  );
}
