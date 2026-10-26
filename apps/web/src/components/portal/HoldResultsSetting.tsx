// The "hold results" switch on an assignment with questions (ADR-0007, item 7 AC-7.1). It saves
// on change, like the question list's other draft actions, and is locked once published: the
// database refuses a change then, and back to draft unlocks it.

import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';
import type { ChangeEvent } from 'react';

import { HOLD_RESULTS } from '@/constants';
import { usePortalAction } from '@/lib/use-portal-action';
import { setHoldResults } from '@/services';
import type { Result } from '@/services';

type HoldResultsSettingProps = {
  assignmentId: string;
  holdResults: boolean;
  isPublished: boolean;
  /** Reloads the page's data. The tick stays as clicked until this finishes. */
  onChanged: () => void | Promise<void>;
};

/**
 * Saves the switch. Here "assignment_published" means it was published elsewhere (another tab),
 * so it gets its own message: the generic one is about questions (review 5 item 7, finding 4).
 */
async function saveHold(assignmentId: string, hold: boolean): Promise<Result> {
  const result = await setHoldResults(assignmentId, hold);
  if (!result.ok && result.error === 'assignmentPublished') {
    return { ok: false, error: 'holdLocked' };
  }
  return result;
}

export function HoldResultsSetting({
  assignmentId,
  holdResults,
  isPublished,
  onChanged,
}: HoldResultsSettingProps) {
  const action = usePortalAction();
  const hintId = useId();
  // The value just clicked, shown at once while it saves and the page reloads (finding 5).
  const [pending, setPending] = useState<boolean | null>(null);
  // After a save, the clicked value stays until the reloaded value arrives. revalidate() can
  // resolve a frame before the new data renders, so clearing earlier would flicker (round 2).
  const [lastHoldResults, setLastHoldResults] = useState(holdResults);
  if (holdResults !== lastHoldResults) {
    setLastHoldResults(holdResults);
    setPending(null);
  }

  async function change(event: ChangeEvent<HTMLInputElement>) {
    const hold = event.target.checked;
    setPending(hold);
    let reloaded = false;
    try {
      if (await action.run(() => saveHold(assignmentId, hold))) {
        await onChanged();
        reloaded = true; // the new holdResults prop clears pending, with no flicker
      }
    } finally {
      if (!reloaded) setPending(null); // refused, or the save or reload threw: show the saved value
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={1}>
        <FormControlLabel
          control={
            <Checkbox
              checked={pending ?? holdResults}
              disabled={isPublished || pending !== null}
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
