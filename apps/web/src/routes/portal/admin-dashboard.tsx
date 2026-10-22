// Admin home page (R3a story AS6): counts, shortcuts and recent activity.

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useLoaderData } from 'react-router';

import { PageHeader, SectionCard } from '@/components/portal';
import { ACTIVITY_LABELS, ADMIN_DASHBOARD, PORTAL_ROUTES, PORTAL_SEO } from '@/constants';
import { formatDateTime } from '@/lib/format';
import { buildPortalMeta } from '@/lib/seo';
import { accountStatus } from '@/lib/account-status';
import { listActivity, listClasses, listStaff, listStudents } from '@/services';

const RECENT_ACTIVITY_ROWS = 5;

export function meta() {
  return buildPortalMeta(PORTAL_SEO.admin);
}

// Access (admin) is checked by the admin layout.
export async function clientLoader() {
  const [staff, classes, students, activity] = await Promise.all([
    listStaff(),
    listClasses(false),
    listStudents(false),
    listActivity(RECENT_ACTIVITY_ROWS),
  ]);
  const now = new Date();
  const statuses = staff.ok ? staff.data.map((member) => accountStatus(member, now)) : [];

  return {
    counts: {
      staff: statuses.filter((status) => status === 'active').length,
      invites: statuses.filter((status) => status === 'invited' || status === 'inviteExpired')
        .length,
      classes: classes.ok ? classes.data.length : 0,
      students: students.ok ? students.data.length : 0,
    },
    recent: activity.ok ? activity.data : [],
  };
}

const STAT_LINKS = {
  staff: PORTAL_ROUTES.adminStaff,
  invites: PORTAL_ROUTES.adminStaff,
  classes: PORTAL_ROUTES.classes,
  students: PORTAL_ROUTES.adminStudents,
} as const;

const SHORTCUTS = [
  { key: 'staff', to: PORTAL_ROUTES.adminStaff },
  { key: 'classes', to: PORTAL_ROUTES.classes },
  { key: 'students', to: PORTAL_ROUTES.adminStudents },
  { key: 'timetable', to: PORTAL_ROUTES.timetable },
  { key: 'enquiries', to: PORTAL_ROUTES.adminEnquiries },
  { key: 'activity', to: PORTAL_ROUTES.adminActivity },
] as const;

export default function AdminDashboard() {
  const { counts, recent } = useLoaderData<typeof clientLoader>();
  const statKeys = Object.keys(STAT_LINKS) as (keyof typeof STAT_LINKS)[];

  return (
    <>
      <PageHeader title={ADMIN_DASHBOARD.heading} intro={ADMIN_DASHBOARD.intro} />

      <Box
        component="section"
        aria-label={ADMIN_DASHBOARD.statsLabel}
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          mb: 6,
        }}
      >
        {statKeys.map((key) => (
          <Card key={key} variant="outlined">
            <CardActionArea component={RouterLink} to={STAT_LINKS[key]} sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h4" component="p" sx={{ fontWeight: 700 }}>
                  {counts[key]}
                </Typography>
                <Typography color="text.secondary">{ADMIN_DASHBOARD.stats[key]}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      <Stack spacing={4}>
        <SectionCard title={ADMIN_DASHBOARD.shortcuts.heading}>
          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {SHORTCUTS.map((shortcut) => (
              <Button key={shortcut.key} variant="outlined" component={RouterLink} to={shortcut.to}>
                {ADMIN_DASHBOARD.shortcuts[shortcut.key]}
              </Button>
            ))}
          </Stack>
        </SectionCard>

        <SectionCard
          title={ADMIN_DASHBOARD.recent.heading}
          action={
            <Button component={RouterLink} to={PORTAL_ROUTES.adminActivity} size="small">
              {ADMIN_DASHBOARD.recent.link}
            </Button>
          }
        >
          {recent.length === 0 ? (
            <Typography color="text.secondary">{ADMIN_DASHBOARD.recent.empty}</Typography>
          ) : (
            <List dense disablePadding>
              {recent.map((entry) => (
                <ListItem key={entry.id} disableGutters divider>
                  <ListItemText
                    primary={ADMIN_DASHBOARD.recent.line(
                      entry.actorName,
                      ACTIVITY_LABELS[entry.action] ?? entry.action,
                      entry.targetName,
                    )}
                    secondary={formatDateTime(entry.at)}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </SectionCard>
      </Stack>
    </>
  );
}
