// One student's result on the marking page (R3a story TS4): status, mark, feedback, Save.
// Keeps its own unsaved edits, so saving one student never clears another's.

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { ASSIGNMENT_LIMITS, MARKING_PAGE, RESULT_STATUS_LABELS } from '@/constants';
import { validateResult } from '@/lib/assignments';
import { formatDateTime } from '@/lib/format';
import { studentYearLabel } from '@/lib/labels';
import { usePortalAction } from '@/lib/use-portal-action';
import { saveResult } from '@/services';
import type { AssignmentResult, ResultStatus, StudentSummary } from '@/services';

const STATUSES: ResultStatus[] = ['not_submitted', 'submitted', 'marked'];

type ResultCardProps = {
  assignmentId: string;
  maxMark: number | null;
  student: StudentSummary;
  result: AssignmentResult | null;
  onSaved: () => void;
};

export function ResultCard({ assignmentId, maxMark, student, result, onSaved }: ResultCardProps) {
  const [status, setStatus] = useState<ResultStatus>(result?.status ?? 'not_submitted');
  const [markText, setMarkText] = useState(
    result?.mark === null || !result ? '' : String(result.mark),
  );
  const [feedback, setFeedback] = useState(result?.feedback ?? '');
  const [saved, setSaved] = useState<AssignmentResult | null>(result);
  const [fieldError, setFieldError] = useState('');
  const action = usePortalAction();

  async function handleSave() {
    const mark = markText.trim() === '' ? null : Number(markText);
    const problem = validateResult({ mark, feedback }, maxMark);
    setFieldError(problem);
    if (problem) return;

    let latest: AssignmentResult | null = null;
    const done = await action.run(async () => {
      const outcome = await saveResult({
        assignmentId,
        studentId: student.id,
        status,
        mark,
        feedback,
      });
      if (outcome.ok) latest = outcome.data;
      return outcome;
    }, MARKING_PAGE.saved);
    if (done) {
      setSaved(latest);
      onSaved();
    }
  }

  return (
    <Paper variant="outlined" component="section" aria-label={student.fullName} sx={{ p: 4 }}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>
            {student.fullName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {studentYearLabel(student.yearLevel)}
          </Typography>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <TextField
            select
            size="small"
            label={MARKING_PAGE.columns.status}
            value={status}
            onChange={(event) => setStatus(event.target.value as ResultStatus)}
            sx={{ minWidth: 170 }}
            slotProps={{ htmlInput: { 'aria-label': MARKING_PAGE.statusLabel(student.fullName) } }}
          >
            {STATUSES.map((option) => (
              <MenuItem key={option} value={option}>
                {RESULT_STATUS_LABELS[option]}
              </MenuItem>
            ))}
          </TextField>
          {maxMark !== null && (
            <TextField
              size="small"
              type="number"
              label={MARKING_PAGE.columns.mark}
              value={markText}
              onChange={(event) => setMarkText(event.target.value)}
              helperText={MARKING_PAGE.outOf(maxMark)}
              sx={{ maxWidth: { md: 140 } }}
              slotProps={{
                htmlInput: {
                  min: 0,
                  max: maxMark,
                  step: 0.5,
                  'aria-label': MARKING_PAGE.markLabel(student.fullName),
                },
              }}
            />
          )}
          <TextField
            size="small"
            label={MARKING_PAGE.columns.feedback}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            multiline
            minRows={2}
            fullWidth
            slotProps={{
              htmlInput: {
                maxLength: ASSIGNMENT_LIMITS.feedbackMax,
                'aria-label': MARKING_PAGE.feedbackLabel(student.fullName),
              },
            }}
          />
        </Stack>

        {fieldError && <Alert severity="error">{fieldError}</Alert>}
        {action.error && <Alert severity="error">{action.error}</Alert>}

        <Stack direction="row" spacing={3} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="contained" size="small" onClick={handleSave} disabled={action.busy}>
            {action.busy ? MARKING_PAGE.saving : MARKING_PAGE.save}
          </Button>
          {action.notice && (
            <Typography variant="body2" color="success.main" role="status">
              {action.notice}
            </Typography>
          )}
          {saved?.status === 'marked' && saved.markedAt && (
            <Typography variant="body2" color="text.secondary">
              {MARKING_PAGE.markedBy(saved.markedByName, formatDateTime(saved.markedAt))}
            </Typography>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
