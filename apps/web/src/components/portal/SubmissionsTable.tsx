// Online work for one assignment, per student (R3b story FT3): status, when it was handed in
// (with "Late"), the score so far, and a link to mark it.

import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';

import { ONLINE_STATUS_LABELS, SUBMISSIONS, submissionPath } from '@/constants';
import { isLate } from '@/lib/assignments';
import { formatDateTime } from '@/lib/format';
import { formatMarks } from '@/lib/questions';
import type { AssignmentDetail, ResultStatus } from '@/services';

import { SectionCard } from './Panels';

const STATUS_COLOURS: Record<ResultStatus, 'default' | 'info' | 'warning' | 'success'> = {
  not_submitted: 'default',
  in_progress: 'info',
  submitted: 'warning',
  marked: 'warning',
  returned: 'success',
};

const NEEDS_MARKING = new Set<ResultStatus>(['submitted', 'marked']);

export function SubmissionsTable({ assignment }: { assignment: AssignmentDetail }) {
  if (assignment.students.length === 0) {
    return (
      <SectionCard title={SUBMISSIONS.heading}>
        <Typography color="textSecondary">{SUBMISSIONS.noStudents}</Typography>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={SUBMISSIONS.heading}>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={SUBMISSIONS.heading}>
          <TableHead>
            <TableRow>
              <TableCell>{SUBMISSIONS.columns.student}</TableCell>
              <TableCell>{SUBMISSIONS.columns.status}</TableCell>
              <TableCell>{SUBMISSIONS.columns.submitted}</TableCell>
              <TableCell align="right">{SUBMISSIONS.columns.score}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {assignment.students.map((student) => {
              const result = assignment.results.find((item) => item.studentId === student.id);
              const status = result?.status ?? 'not_submitted';
              const late = isLate(result?.submittedAt ?? null, assignment.dueOn);
              const mark = result?.mark ?? null;

              return (
                <TableRow key={student.id} hover>
                  <TableCell sx={{ fontWeight: 700 }}>{student.fullName}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={STATUS_COLOURS[status]}
                      label={ONLINE_STATUS_LABELS[status]}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="body2">
                        {formatDateTime(result?.submittedAt ?? null)}
                      </Typography>
                      {late && <Chip size="small" color="warning" label={SUBMISSIONS.late} />}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    {mark !== null && assignment.totalMarks !== null
                      ? SUBMISSIONS.score(formatMarks(mark), assignment.totalMarks)
                      : ''}
                  </TableCell>
                  <TableCell align="right">
                    {result?.submittedAt && (
                      <Button
                        size="small"
                        variant={NEEDS_MARKING.has(status) ? 'contained' : 'text'}
                        component={RouterLink}
                        to={submissionPath(assignment.id, student.id)}
                      >
                        {NEEDS_MARKING.has(status) ? SUBMISSIONS.open : SUBMISSIONS.view}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </SectionCard>
  );
}
