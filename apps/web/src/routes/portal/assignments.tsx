// Assignments (R3a story TS5): homework across your classes, soonest due first, with marking
// progress. Admins see every active class's assignments.

import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Link as RouterLink, useLoaderData } from 'react-router';

import { DueChip, LoadError, PageHeader } from '@/components/portal';
import { ASSIGNMENTS_PAGE, PORTAL_SEO, assignmentPath, classPath } from '@/constants';
import { byDueDate, markingProgress } from '@/lib/assignments';
import { buildPortalMeta } from '@/lib/seo';
import { listAssignments } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.assignments);
}

// Access is checked by the staff layout; the database returns only what this person may see.
export async function clientLoader() {
  return listAssignments();
}

export default function AssignmentsPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  if (!loaded.ok) return <LoadError error={loaded.error} />;

  const assignments = [...loaded.data].sort(byDueDate);

  return (
    <>
      <PageHeader title={ASSIGNMENTS_PAGE.heading} intro={ASSIGNMENTS_PAGE.intro} />
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={ASSIGNMENTS_PAGE.heading}>
          <TableHead>
            <TableRow>
              <TableCell>{ASSIGNMENTS_PAGE.columns.title}</TableCell>
              <TableCell>{ASSIGNMENTS_PAGE.columns.class}</TableCell>
              <TableCell>{ASSIGNMENTS_PAGE.columns.due}</TableCell>
              <TableCell>{ASSIGNMENTS_PAGE.columns.progress}</TableCell>
              <TableCell>{ASSIGNMENTS_PAGE.columns.toMark}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assignments.map((assignment) => {
              const progress = markingProgress(assignment);
              return (
                <TableRow key={assignment.id} hover>
                  <TableCell>
                    <Link
                      component={RouterLink}
                      to={assignmentPath(assignment.id)}
                      sx={{ fontWeight: 700 }}
                    >
                      {assignment.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link component={RouterLink} to={classPath(assignment.classId)}>
                      {assignment.className}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <DueChip dueOn={assignment.dueOn} />
                  </TableCell>
                  <TableCell>
                    {ASSIGNMENTS_PAGE.progress(progress.marked, progress.total)}
                  </TableCell>
                  <TableCell>
                    {progress.submitted > 0 && (
                      <Chip size="small" color="primary" label={progress.submitted} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {assignments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>{ASSIGNMENTS_PAGE.empty}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
