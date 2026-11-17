// Admin → Mock tests (design §4.3): every mock test, draft or released, with its counts, and a
// button to start a new one. Counts and the creator's name only: no taker names or scores (AC 24).

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Link as RouterLink, useLoaderData, useNavigate } from 'react-router';

import {
  LoadError,
  MockTestDialog,
  MockTestStatusChip,
  MockTestsErrorBoundary,
  PageHeader,
} from '@/components/portal';
import { MOCK_TESTS_ADMIN_PAGE, PORTAL_COMMON, PORTAL_SEO, adminMockTestPath } from '@/constants';
import { formatDateTime } from '@/lib/format';
import { buildPortalMeta } from '@/lib/seo';
import { listMockTestsAdmin } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.adminMockTests);
}

// Access (admin) is checked by the admin layout; the database refuses anyone else.
export async function clientLoader() {
  return listMockTestsAdmin();
}

export function ErrorBoundary() {
  return <MockTestsErrorBoundary />;
}

export default function AdminMockTestsPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  if (!loaded.ok) return <LoadError error={loaded.error} retry />;
  const columns = MOCK_TESTS_ADMIN_PAGE.columns;

  return (
    <>
      <PageHeader
        title={MOCK_TESTS_ADMIN_PAGE.heading}
        intro={MOCK_TESTS_ADMIN_PAGE.intro}
        actions={
          <Button variant="contained" onClick={() => setCreating(true)}>
            {MOCK_TESTS_ADMIN_PAGE.newButton}
          </Button>
        }
      />

      {loaded.data.length === 0 ? (
        <Typography color="textSecondary">{MOCK_TESTS_ADMIN_PAGE.empty}</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label={MOCK_TESTS_ADMIN_PAGE.tableLabel}>
            <TableHead>
              <TableRow>
                <TableCell>{columns.title}</TableCell>
                <TableCell>{columns.status}</TableCell>
                <TableCell align="right">{columns.questions}</TableCell>
                <TableCell align="right">{columns.submitted}</TableCell>
                <TableCell>{columns.createdBy}</TableCell>
                <TableCell>{columns.changed}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loaded.data.map((test) => (
                <TableRow key={test.id} hover>
                  <TableCell sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                    <Link component={RouterLink} to={adminMockTestPath(test.id)}>
                      {test.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <MockTestStatusChip status={test.status} />
                  </TableCell>
                  <TableCell align="right">{test.questionCount}</TableCell>
                  <TableCell align="right">{test.submittedCount}</TableCell>
                  <TableCell>{test.createdByName ?? PORTAL_COMMON.none}</TableCell>
                  <TableCell>
                    <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(test.updatedAt)}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {creating && (
        <MockTestDialog
          open
          existing={null}
          onSaved={(testId) => void navigate(adminMockTestPath(testId))}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
