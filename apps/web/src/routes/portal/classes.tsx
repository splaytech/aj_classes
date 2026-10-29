// Classes (R3a stories TS2, AS1): tutors see the classes they teach; admins see every class,
// create new ones and can show archived ones.

import AddIcon from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useState } from 'react';
import { Link as RouterLink, useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { ClassDialog, LoadError, PageHeader } from '@/components/portal';
import { CLASSES_PAGE, PORTAL_SEO, classPath } from '@/constants';
import { classYearLabel, subjectLabel } from '@/lib/labels';
import { buildPortalMeta } from '@/lib/seo';
import { scheduleSummary } from '@/lib/timetable';
import { activeStaffOptions } from '@/lib/staff-options';
import { getAccessState, listClasses, saveClass } from '@/services';

const ARCHIVED_PARAM = 'archived';
const SHOWN = '1';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.classes);
}

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const includeArchived = new URL(request.url).searchParams.get(ARCHIVED_PARAM) === SHOWN;
  const access = await getAccessState();
  const isAdmin = access.profile?.role === 'admin';

  const [classes, tutors] = await Promise.all([
    listClasses(includeArchived),
    isAdmin ? activeStaffOptions() : Promise.resolve([]),
  ]);
  return { classes, tutors, isAdmin };
}

export default function ClassesPage() {
  const { classes, tutors, isAdmin } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(false);

  if (!classes.ok) return <LoadError error={classes.error} />;

  const showArchived = searchParams.get(ARCHIVED_PARAM) === SHOWN;

  return (
    <>
      <PageHeader
        title={CLASSES_PAGE.heading}
        intro={isAdmin ? CLASSES_PAGE.introAdmin : CLASSES_PAGE.introTutor}
        actions={
          isAdmin && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
              {CLASSES_PAGE.newClass}
            </Button>
          )
        }
      />

      {isAdmin && (
        <FormControlLabel
          sx={{ mb: 3 }}
          control={
            <Switch
              checked={showArchived}
              onChange={(event) =>
                setSearchParams(event.target.checked ? { [ARCHIVED_PARAM]: SHOWN } : {})
              }
            />
          }
          label={CLASSES_PAGE.showArchived}
        />
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={CLASSES_PAGE.heading}>
          <TableHead>
            <TableRow>
              <TableCell>{CLASSES_PAGE.columns.name}</TableCell>
              <TableCell>{CLASSES_PAGE.columns.subject}</TableCell>
              <TableCell>{CLASSES_PAGE.columns.year}</TableCell>
              {isAdmin && <TableCell>{CLASSES_PAGE.columns.tutor}</TableCell>}
              <TableCell>{CLASSES_PAGE.columns.schedule}</TableCell>
              <TableCell align="right">{CLASSES_PAGE.columns.students}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {classes.data.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Link component={RouterLink} to={classPath(item.id)} sx={{ fontWeight: 700 }}>
                      {item.name}
                    </Link>
                    {!item.isActive && <Chip size="small" label={CLASSES_PAGE.archived} />}
                  </Stack>
                </TableCell>
                <TableCell>{subjectLabel(item.subject)}</TableCell>
                <TableCell>{classYearLabel(item.yearLevels)}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
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
                  </TableCell>
                )}
                <TableCell>{scheduleSummary(item.sessions) || CLASSES_PAGE.noSchedule}</TableCell>
                <TableCell align="right">{item.studentCount}</TableCell>
              </TableRow>
            ))}
            {classes.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5}>{CLASSES_PAGE.empty}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {creating && (
        <ClassDialog
          open
          existing={null}
          tutors={tutors}
          onSave={saveClass}
          onSaved={(classId) => navigate(classPath(classId))}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
