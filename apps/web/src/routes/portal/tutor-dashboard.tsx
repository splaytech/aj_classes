// Tutor home page (R3a story TS6, R2a US11): next classes, my classes, assignments, profile.
// Admins who teach (e.g. Ajay) see their own classes here too.

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link as RouterLink, useLoaderData } from 'react-router';

import { PageHeader } from '@/components/portal';
import { DAY_NAMES, PORTAL_ROUTES, PORTAL_SEO, TUTOR_DASHBOARD, classPath } from '@/constants';
import { summariseWork } from '@/lib/assignments';
import { formatDate } from '@/lib/format';
import { firstName } from '@/lib/labels';
import { buildPortalMeta } from '@/lib/seo';
import { formatTimeRange, isoDayOfWeek, relativeDay, upcomingSessions } from '@/lib/timetable';
import type { UpcomingSession } from '@/lib/timetable';
import {
  getAccessState,
  getMyProfile,
  listAssignments,
  listClasses,
  listTimetable,
} from '@/services';

import { useStaffAccess } from './staff-layout';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.tutor);
}

// Access is checked by the staff layout. Everything is filtered to the classes this person
// teaches, because admins can read every class.
export async function clientLoader() {
  const access = await getAccessState();
  const [profile, timetable, classes, assignments] = await Promise.all([
    getMyProfile(),
    listTimetable(),
    listClasses(false),
    listAssignments(),
  ]);

  const myClasses = classes.ok ? classes.data.filter((item) => item.tutorId === access.userId) : [];
  const myClassIds = new Set(myClasses.map((item) => item.id));
  const mySessions = timetable.ok
    ? timetable.data.filter((entry) => entry.tutorId === access.userId)
    : [];
  const myAssignments = assignments.ok
    ? assignments.data.filter((assignment) => myClassIds.has(assignment.classId))
    : [];
  const now = new Date();

  return {
    isIncomplete: profile.ok && (!profile.data.bio || profile.data.subjects.length === 0),
    myClasses,
    upcoming: upcomingSessions(mySessions, now),
    work: summariseWork(myAssignments, now),
  };
}

function whenText(session: UpcomingSession, now: Date): string {
  const day = relativeDay(session.startsAt, now);
  const prefix =
    day === 'today'
      ? TUTOR_DASHBOARD.nextSessions.today
      : day === 'tomorrow'
        ? TUTOR_DASHBOARD.nextSessions.tomorrow
        : TUTOR_DASHBOARD.nextSessions.dayAndDate(
            DAY_NAMES.short[isoDayOfWeek(session.startsAt)],
            formatDate(session.startsAt.toISOString()),
          );
  return TUTOR_DASHBOARD.nextSessions.when(
    prefix,
    formatTimeRange(session.entry.startTime, session.entry.endTime),
  );
}

function DashboardCard({
  title,
  link,
  children,
}: {
  title: string;
  link?: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
      {link && (
        <CardActions sx={{ px: 4, pb: 4 }}>
          <Button component={RouterLink} to={link.to} size="small">
            {link.label}
          </Button>
        </CardActions>
      )}
    </Card>
  );
}

export default function TutorDashboard() {
  const access = useStaffAccess();
  const { isIncomplete, myClasses, upcoming, work } = useLoaderData<typeof clientLoader>();
  const now = new Date();
  const nothingWaiting = work.toMark === 0 && work.dueSoon === 0 && work.overdue === 0;

  return (
    <>
      <PageHeader
        title={TUTOR_DASHBOARD.welcome(firstName(access.profile?.fullName ?? ''))}
        intro={TUTOR_DASHBOARD.intro}
      />

      {isIncomplete && (
        <Alert
          severity="info"
          sx={{ mb: 4 }}
          action={
            <Button component={RouterLink} to={PORTAL_ROUTES.profile} size="small">
              {TUTOR_DASHBOARD.completeProfileLink}
            </Button>
          }
        >
          {TUTOR_DASHBOARD.completeProfile}
        </Alert>
      )}

      <Box
        sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}
      >
        <DashboardCard
          title={TUTOR_DASHBOARD.nextSessions.heading}
          link={{ to: PORTAL_ROUTES.timetable, label: TUTOR_DASHBOARD.nextSessions.link }}
        >
          {upcoming.length === 0 ? (
            <Typography color="text.secondary">{TUTOR_DASHBOARD.nextSessions.empty}</Typography>
          ) : (
            <List dense disablePadding>
              {upcoming.map((session) => (
                <ListItem key={`${session.entry.id}-${session.startsAt.getTime()}`} disableGutters>
                  <ListItemText
                    primary={
                      <Link component={RouterLink} to={classPath(session.entry.classId)}>
                        {session.entry.className}
                      </Link>
                    }
                    secondary={whenText(session, now)}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DashboardCard>

        <DashboardCard
          title={TUTOR_DASHBOARD.assignments.heading}
          link={{ to: PORTAL_ROUTES.assignments, label: TUTOR_DASHBOARD.assignments.link }}
        >
          {nothingWaiting ? (
            <Typography color="text.secondary">{TUTOR_DASHBOARD.assignments.allClear}</Typography>
          ) : (
            <List dense disablePadding>
              {work.toMark > 0 && (
                <ListItem disableGutters>
                  <ListItemText primary={TUTOR_DASHBOARD.assignments.toMark(work.toMark)} />
                </ListItem>
              )}
              {work.overdue > 0 && (
                <ListItem disableGutters>
                  <ListItemText primary={TUTOR_DASHBOARD.assignments.overdue(work.overdue)} />
                </ListItem>
              )}
              {work.dueSoon > 0 && (
                <ListItem disableGutters>
                  <ListItemText primary={TUTOR_DASHBOARD.assignments.dueSoon(work.dueSoon)} />
                </ListItem>
              )}
            </List>
          )}
        </DashboardCard>

        <DashboardCard
          title={TUTOR_DASHBOARD.classes.heading}
          link={{ to: PORTAL_ROUTES.classes, label: TUTOR_DASHBOARD.classes.link }}
        >
          {myClasses.length === 0 ? (
            <Typography color="text.secondary">{TUTOR_DASHBOARD.classes.empty}</Typography>
          ) : (
            <>
              <Typography color="text.secondary" sx={{ mb: 1 }}>
                {TUTOR_DASHBOARD.classes.count(myClasses.length)}
              </Typography>
              <List dense disablePadding>
                {myClasses.map((item) => (
                  <ListItem key={item.id} disableGutters>
                    <Link component={RouterLink} to={classPath(item.id)}>
                      {item.name}
                    </Link>
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DashboardCard>

        <DashboardCard
          title={TUTOR_DASHBOARD.profileCard.title}
          link={{ to: PORTAL_ROUTES.profile, label: TUTOR_DASHBOARD.profileCard.link }}
        >
          <Typography color="text.secondary">{TUTOR_DASHBOARD.profileCard.text}</Typography>
        </DashboardCard>
      </Box>
    </>
  );
}
