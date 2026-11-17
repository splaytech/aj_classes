// The rows of the admin Results page (design §6.3): name, when, score, percentage, pass label.
// Read-only on purpose: no button, no link to an answer, no e-mail (AC 35).

import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import { MOCK_RESULTS_PAGE } from '@/constants';
import { formatDateTime } from '@/lib/format';
import { mockPassLabel, mockResultName } from '@/lib/mock-tests';
import type { MockResultRow } from '@/services';

export function MockResultsTable({ rows }: { rows: MockResultRow[] }) {
  const columns = MOCK_RESULTS_PAGE.columns;
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label={MOCK_RESULTS_PAGE.tableLabel}>
        <TableHead>
          <TableRow>
            <TableCell>{columns.name}</TableCell>
            <TableCell>{columns.submitted}</TableCell>
            <TableCell>{columns.score}</TableCell>
            <TableCell>{columns.percentage}</TableCell>
            <TableCell>{columns.result}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.attemptId}>
              <TableCell sx={{ overflowWrap: 'anywhere' }}>
                {mockResultName(row.takerName)}
              </TableCell>
              <TableCell>{formatDateTime(row.submittedAt)}</TableCell>
              <TableCell>{MOCK_RESULTS_PAGE.score(row.score, row.total)}</TableCell>
              <TableCell>{MOCK_RESULTS_PAGE.percent(row.percentage)}</TableCell>
              <TableCell>{mockPassLabel(row.passed)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
