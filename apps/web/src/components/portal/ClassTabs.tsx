// The three tabs of a class page (R3a stories TS2, TS3, AS2, AS4): weekly schedule, students and
// assignments. Admins manage the schedule and students; the class tutor and admins set homework.

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  ASSIGNMENTS_PAGE,
  CLASS_ASSIGNMENTS,
  CLASS_PAGE,
  DAY_NAMES,
  assignmentPath,
} from '@/constants';
import { byDueDate, markingProgress } from '@/lib/assignments';
import { studentYearLabel } from '@/lib/labels';
import { byStartTime, formatTimeRange } from '@/lib/timetable';
import { usePortalAction } from '@/lib/use-portal-action';
import {
  addSession,
  enrolStudent,
  removeEnrolment,
  removeSession,
  saveAssignment,
} from '@/services';
import type { AssignmentSummary, ClassDetail, ClassSession, StudentSummary } from '@/services';

import { AssignmentDialog } from './AssignmentDialog';
import { AssignmentTitleLink } from './AssignmentTitleLink';
import { ConfirmDialog } from './ConfirmDialog';
import { DueChip } from './DueChip';
import { EnrolDialog } from './EnrolDialog';
import { SessionDialog } from './SessionDialog';

type TabProps = { detail: ClassDetail; onChanged: () => void };

function slotText(session: ClassSession): string {
  return `${DAY_NAMES.long[session.dayOfWeek]} ${formatTimeRange(session.startTime, session.endTime)}`;
}

export function ScheduleTab({ detail, onChanged, isAdmin }: TabProps & { isAdmin: boolean }) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ClassSession | null>(null);
  const action = usePortalAction();
  const sessions = [...detail.sessions].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || byStartTime(a, b),
  );

  async function confirmRemove() {
    if (!removing) return;
    const removed = await action.run(() => removeSession(removing.id));
    setRemoving(null);
    if (removed) onChanged();
  }

  return (
    <Stack spacing={3}>
      {sessions.length === 0 ? (
        <Typography color="text.secondary">{CLASS_PAGE.schedule.empty}</Typography>
      ) : (
        <Paper variant="outlined">
          <List disablePadding>
            {sessions.map((session) => (
              <ListItem
                key={session.id}
                divider
                secondaryAction={
                  isAdmin && (
                    <IconButton
                      edge="end"
                      aria-label={CLASS_PAGE.schedule.removeLabel(slotText(session))}
                      onClick={() => setRemoving(session)}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  )
                }
              >
                <ListItemText
                  primary={DAY_NAMES.long[session.dayOfWeek]}
                  secondary={formatTimeRange(session.startTime, session.endTime)}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
      {action.error && <Alert severity="error">{action.error}</Alert>}
      {isAdmin && (
        <div>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
            {CLASS_PAGE.schedule.addTime}
          </Button>
        </div>
      )}

      {adding && (
        <SessionDialog
          open
          classId={detail.id}
          onSave={addSession}
          onSaved={() => {
            setAdding(false);
            onChanged();
          }}
          onClose={() => setAdding(false)}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title={CLASS_PAGE.schedule.confirmRemoveTitle}
        text={removing ? CLASS_PAGE.schedule.confirmRemoveText(slotText(removing)) : ''}
        confirmLabel={CLASS_PAGE.schedule.remove}
        destructive
        busy={action.busy}
        onConfirm={confirmRemove}
        onClose={() => setRemoving(null)}
      />
    </Stack>
  );
}

export function StudentsTab({
  detail,
  onChanged,
  isAdmin,
  roster,
}: TabProps & { isAdmin: boolean; roster: StudentSummary[] }) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<StudentSummary | null>(null);
  const action = usePortalAction();
  const enrolledIds = new Set(detail.students.map((student) => student.id));
  const candidates = roster.filter((student) => student.isActive && !enrolledIds.has(student.id));

  async function confirmRemove() {
    if (!removing) return;
    const removed = await action.run(() => removeEnrolment(detail.id, removing.id));
    setRemoving(null);
    if (removed) onChanged();
  }

  return (
    <Stack spacing={3}>
      {detail.students.length === 0 ? (
        <Typography color="text.secondary">{CLASS_PAGE.students.empty}</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{CLASS_PAGE.students.columns.name}</TableCell>
                <TableCell>{CLASS_PAGE.students.columns.year}</TableCell>
                {isAdmin && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {detail.students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>{student.fullName}</TableCell>
                  <TableCell>{studentYearLabel(student.yearLevel)}</TableCell>
                  {isAdmin && (
                    <TableCell align="right">
                      <Button size="small" color="error" onClick={() => setRemoving(student)}>
                        {CLASS_PAGE.students.remove}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {action.error && <Alert severity="error">{action.error}</Alert>}
      {isAdmin && (
        <div>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
            {CLASS_PAGE.students.add}
          </Button>
        </div>
      )}

      {adding && (
        <EnrolDialog
          open
          candidates={candidates}
          onEnrol={(studentId) => enrolStudent(detail.id, studentId)}
          onEnrolled={() => {
            setAdding(false);
            onChanged();
          }}
          onClose={() => setAdding(false)}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title={CLASS_PAGE.students.confirmRemoveTitle}
        text={removing ? CLASS_PAGE.students.confirmRemoveText(removing.fullName) : ''}
        confirmLabel={CLASS_PAGE.students.remove}
        destructive
        busy={action.busy}
        onConfirm={confirmRemove}
        onClose={() => setRemoving(null)}
      />
    </Stack>
  );
}

export function AssignmentsTab({
  detail,
  assignments,
  canSetWork,
}: {
  detail: ClassDetail;
  assignments: AssignmentSummary[];
  canSetWork: boolean;
}) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const sorted = [...assignments].sort(byDueDate);

  return (
    <Stack spacing={3}>
      {sorted.length === 0 ? (
        <Typography color="text.secondary">{CLASS_ASSIGNMENTS.empty}</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{ASSIGNMENTS_PAGE.columns.title}</TableCell>
                <TableCell>{ASSIGNMENTS_PAGE.columns.due}</TableCell>
                <TableCell>{ASSIGNMENTS_PAGE.columns.progress}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((assignment) => {
                const progress = markingProgress(assignment);
                return (
                  <TableRow key={assignment.id} hover>
                    <TableCell>
                      <AssignmentTitleLink assignment={assignment} />
                    </TableCell>
                    <TableCell>
                      <DueChip dueOn={assignment.dueOn} />
                    </TableCell>
                    <TableCell>
                      {ASSIGNMENTS_PAGE.progress(progress.marked, progress.total)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {canSetWork && (
        <div>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
            {CLASS_ASSIGNMENTS.newAssignment}
          </Button>
        </div>
      )}

      {creating && (
        <AssignmentDialog
          open
          classId={detail.id}
          existing={null}
          onSave={saveAssignment}
          onSaved={(assignmentId) => navigate(assignmentPath(assignmentId))}
          onClose={() => setCreating(false)}
        />
      )}
    </Stack>
  );
}
