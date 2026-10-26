// The "hold results" switch on an assignment with questions (ADR-0007, item 7 AC-7.1). It saves
// on change, like the question list's other draft actions, and is locked once published: the
// database refuses a change then, and back to draft unlocks it.

import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import type { ChangeEvent } from 'react';

import { HOLD_RESULTS } from '@/constants';
import { usePortalAction } from '@/lib/use-portal-action';
import { setHoldResults } from '@/services';

type HoldResultsSettingProps = {
  assignmentId: string;
  holdResults: boolean;
  isPublished: boolean;
  onChanged: () => void;
};

export function HoldResultsSetting({
  assignmentId,
  holdResults,
  isPublished,
  onChanged,
}: HoldResultsSettingProps) {
  const action = usePortalAction();
  const hintId = useId();

  async function change(event: ChangeEvent<HTMLInputElement>) {
    const hold = event.target.checked;
    if (await action.run(() => setHoldResults(assignmentId, hold))) onChanged();
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={1}>
        <FormControlLabel
          control={
            <Checkbox
              checked={holdResults}
              disabled={isPublished || action.busy}
              onChange={change}
              slotProps={{ input: { 'aria-describedby': hintId } }}
            />
          }
          label={HOLD_RESULTS.label}
        />
        <Typography id={hintId} variant="body2" color="text.secondary">
          {isPublished ? HOLD_RESULTS.lockedNote : HOLD_RESULTS.hint}
        </Typography>
        {action.error && <Alert severity="error">{action.error}</Alert>}
      </Stack>
    </Paper>
  );
}
