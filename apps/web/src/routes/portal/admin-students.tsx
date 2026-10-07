// Admin → Students (R3a story AS3): the roster. Name and year level only (review H10).

import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
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
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { Link as RouterLink, useLoaderData, useRevalidator, useSearchParams } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { ConfirmDialog, LoadError, PageHeader, StudentDialog } from '@/components/portal';
import { PORTAL_SEO, STUDENTS_PAGE, classPath } from '@/constants';
import { studentYearLabel } from '@/lib/labels';
import { buildPortalMeta } from '@/lib/seo';
import { usePortalAction } from '@/lib/use-portal-action';
import { listStudents, saveStudent, setStudentActive } from '@/services';
import type { RosterStudent } from '@/services';

const ARCHIVED_PARAM = 'archived';
const SHOWN = '1';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.adminStudents);
}

// Access (admin) is checked by the admin layout.
export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const includeArchived = new URL(request.url).searchParams.get(ARCHIVED_PARAM) === SHOWN;
  return listStudents(includeArchived);
}

export default function AdminStudentsPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<RosterStudent | 'new' | null>(null);
  const [archiving, setArchiving] = useState<RosterStudent | null>(null);
  const action = usePortalAction();

  if (!loaded.ok) return <LoadError error={loaded.error} />;

  const needle = search.trim().toLowerCase();
  const rows = loaded.data.filter((student) => student.fullName.toLowerCase().includes(needle));
  const refresh = () => revalidator.revalidate();

  async function confirmArchive() {
    if (!archiving) return;
    const done = await action.run(() => setStudentActive(archiving.id, false));
    setArchiving(null);
    if (done) refresh();
  }

  async function restore(student: RosterStudent) {
    if (await action.run(() => setStudentActive(student.id, true))) refresh();
  }

  return (
    <>
      <PageHeader
        title={STUDENTS_PAGE.heading}
        intro={STUDENTS_PAGE.intro}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
            {STUDENTS_PAGE.add}
          </Button>
        }
      />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={3}
        sx={{ mb: 4, alignItems: { sm: 'center' } }}
      >
        <TextField
          size="small"
          label={STUDENTS_PAGE.searchLabel}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ minWidth: { sm: 280 } }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={searchParams.get(ARCHIVED_PARAM) === SHOWN}
              onChange={(event) =>
                setSearchParams(event.target.checked ? { [ARCHIVED_PARAM]: SHOWN } : {})
              }
            />
          }
          label={STUDENTS_PAGE.showArchived}
        />
      </Stack>
      {action.error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {action.error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={STUDENTS_PAGE.heading}>
          <TableHead>
            <TableRow>
              <TableCell>{STUDENTS_PAGE.columns.name}</TableCell>
              <TableCell>{STUDENTS_PAGE.columns.year}</TableCell>
              <TableCell>{STUDENTS_PAGE.columns.classes}</TableCell>
              <TableCell>{STUDENTS_PAGE.columns.status}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((student) => (
              <TableRow key={student.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{student.fullName}</TableCell>
                <TableCell>{studentYearLabel(student.yearLevel)}</TableCell>
                <TableCell>
                  {student.classes.length === 0 ? (
                    STUDENTS_PAGE.noClasses
                  ) : (
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      {student.classes.map((item) => (
                        <Link
                          key={item.id}
                          component={RouterLink}
                          to={classPath(item.id)}
                          variant="body2"
                        >
                          {item.name}
                        </Link>
                      ))}
                    </Stack>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={student.isActive ? 'success' : 'default'}
                    label={student.isActive ? STUDENTS_PAGE.active : STUDENTS_PAGE.archived}
                  />
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Button size="small" onClick={() => setEditing(student)}>
                    {STUDENTS_PAGE.edit}
                  </Button>
                  {student.isActive ? (
                    <Button size="small" color="error" onClick={() => setArchiving(student)}>
                      {STUDENTS_PAGE.archive}
                    </Button>
                  ) : (
                    <Button size="small" onClick={() => restore(student)} disabled={action.busy}>
                      {STUDENTS_PAGE.restore}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>{STUDENTS_PAGE.empty}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {editing && (
        <StudentDialog
          open
          existing={editing === 'new' ? null : editing}
          onSave={saveStudent}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={archiving !== null}
        title={STUDENTS_PAGE.confirmArchiveTitle}
        text={archiving ? STUDENTS_PAGE.confirmArchiveText(archiving.fullName) : ''}
        confirmLabel={STUDENTS_PAGE.archive}
        destructive
        busy={action.busy}
        onConfirm={confirmArchive}
        onClose={() => setArchiving(null)}
      />
    </>
  );
}
