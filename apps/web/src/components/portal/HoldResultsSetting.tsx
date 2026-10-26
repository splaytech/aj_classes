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
  /** Reloads the page's data. The tick stays as clicked until the reloaded data renders. */
  onChanged: () => void | Promise<void>;
  /** Any value that changes on every reload of the page's data, e.g. the loader data object. */
  revision: unknown;
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
  revision,
}: HoldResultsSettingProps) {
  const action = usePortalAction();
  const hintId = useId();
  // The value just clicked, shown at once while it saves and the page reloads (finding 5).
  const [pending, setPending] = useState<boolean | null>(null);
  // After a save, the clicked value stays until the reloaded data renders, then the box shows
  // whatever came back. Why the revision and not holdResults: if another tab changed it back, the
  // reload brings the same boolean, and waiting for it to change left the box stuck (Tester P4).
  // Why not clear when onChanged resolves: revalidate() can resolve a frame before the new data
  // renders, which flickers (review round 2). Clearing here, in the render that first shows the
  // new data, avoids both. A reload that lands mid-save (action.busy) is ignored: the save's own
  // reload follows it.
  const [lastRevision, setLastRevision] = useState(revision);
  if (revision !== lastRevision) {
    setLastRevision(revision);
    if (!action.busy) setPending(null);
  }

  async function change(event: ChangeEvent<HTMLInputElement>) {
    const hold = event.target.checked;
    setPending(hold);
    let reloaded = false;
    try {
      if (await action.run(() => saveHold(assignmentId, hold))) {
        await onChanged();
        reloaded = true; // the new revision clears pending, with no flicker
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
