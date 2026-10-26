// Admin → Emails (AC-3.8, AC-8.13; ADR-0004, ADR-0008): portal emails of every type that failed,
// or are still waiting about 2 hours after they were queued (a missing cron job, Vault secret or
// transport shows up here). Newest first. No address or email body is ever shown.

import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useLoaderData } from 'react-router';

import { LoadError, PageHeader } from '@/components/portal';
import { EMAILS_PAGE, PORTAL_SEO } from '@/constants';
import { describeEmailProblem } from '@/lib/email-problems';
import { formatDateTime } from '@/lib/format';
import { buildPortalMeta } from '@/lib/seo';
import { listEmailProblems } from '@/services';
import type { EmailProblemState } from '@/services';

const STATE_COLOURS: Record<EmailProblemState, 'error' | 'warning'> = {
  failed: 'error',
  waiting: 'warning',
};

export function meta() {
  return buildPortalMeta(PORTAL_SEO.adminEmails);
}

// Access (admin with two-step) is checked by the admin layout, and again by the database.
export async function clientLoader() {
  return listEmailProblems();
}

export default function AdminEmailsPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  if (!loaded.ok) return <LoadError error={loaded.error} />;

  return (
    <>
      <PageHeader title={EMAILS_PAGE.heading} intro={EMAILS_PAGE.intro} />
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={EMAILS_PAGE.heading}>
          <TableHead>
            <TableRow>
              <TableCell>{EMAILS_PAGE.columns.when}</TableCell>
              <TableCell>{EMAILS_PAGE.columns.type}</TableCell>
              <TableCell>{EMAILS_PAGE.columns.recipient}</TableCell>
              <TableCell>{EMAILS_PAGE.columns.assignment}</TableCell>
              <TableCell>{EMAILS_PAGE.columns.state}</TableCell>
              <TableCell>{EMAILS_PAGE.columns.reason}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loaded.data.map((problem) => {
              const labels = describeEmailProblem(problem);
              return (
                <TableRow key={problem.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(problem.at)}</TableCell>
                  <TableCell>{labels.type}</TableCell>
                  <TableCell>{labels.role}</TableCell>
                  <TableCell sx={{ overflowWrap: 'anywhere' }}>{problem.assignmentTitle}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={STATE_COLOURS[problem.state]}
                      label={labels.state}
                    />
                  </TableCell>
                  <TableCell>{labels.reason}</TableCell>
                </TableRow>
              );
            })}
            {loaded.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>{EMAILS_PAGE.empty}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
