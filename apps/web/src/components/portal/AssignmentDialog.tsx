// Create or edit an assignment for a class (R3a story TS3). New ones start as drafts (R3b FT2);
// online work (with questions) takes its total from the questions, so "Out of" is hidden.

import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { useState } from 'react';

import { ASSIGNMENT_DIALOG, ASSIGNMENT_LIMITS } from '@/constants';
import { validateAssignment } from '@/lib/assignments';
import type { AssignmentErrors } from '@/lib/assignments';
import { usePortalAction } from '@/lib/use-portal-action';
import type { AssignmentInput, AssignmentSummary, Result } from '@/services';

import { FormDialog } from './FormDialog';

const ISO_DATE = 'YYYY-MM-DD';

type AssignmentDialogProps = {
  open: boolean;
  classId: string;
  existing: AssignmentSummary | null;
  onSave: (input: AssignmentInput) => Promise<Result<string>>;
  onSaved: (assignmentId: string) => void;
  onClose: () => void;
};

export function AssignmentDialog({
  open,
  classId,
  existing,
  onSave,
  onSaved,
  onClose,
}: AssignmentDialogProps) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [dueOn, setDueOn] = useState<string | null>(existing?.dueOn ?? null);
  const [maxMarkText, setMaxMarkText] = useState(existing?.maxMark ? String(existing.maxMark) : '');
  const [errors, setErrors] = useState<AssignmentErrors>({});
  const action = usePortalAction();
  const isOnline = (existing?.questionCount ?? 0) > 0;

  async function handleSubmit() {
    const input: AssignmentInput = {
      id: existing?.id,
      classId,
      title,
      instructions,
      dueOn,
      maxMark: isOnline || maxMarkText.trim() === '' ? null : Number(maxMarkText),
    };
    const found = validateAssignment(input);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    let savedId = '';
    const saved = await action.run(async () => {
      const result = await onSave(input);
      if (result.ok) savedId = result.data;
      return result;
    });
    if (saved) onSaved(savedId);
  }

  return (
    <FormDialog
      open={open}
      title={existing ? ASSIGNMENT_DIALOG.editHeading : ASSIGNMENT_DIALOG.newHeading}
      submitLabel={ASSIGNMENT_DIALOG.save}
      busyLabel={ASSIGNMENT_DIALOG.saving}
      busy={action.busy}
      error={action.error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <TextField
        label={ASSIGNMENT_DIALOG.labels.title}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        error={Boolean(errors.title)}
        helperText={errors.title}
        slotProps={{ htmlInput: { maxLength: ASSIGNMENT_LIMITS.titleMax } }}
        required
      />
      <TextField
        label={ASSIGNMENT_DIALOG.labels.instructions}
        value={instructions}
        onChange={(event) => setInstructions(event.target.value)}
        error={Boolean(errors.instructions)}
        helperText={errors.instructions || ASSIGNMENT_DIALOG.hints.instructions}
        slotProps={{ htmlInput: { maxLength: ASSIGNMENT_LIMITS.instructionsMax } }}
        multiline
        minRows={4}
      />
      <DatePicker
        label={ASSIGNMENT_DIALOG.labels.dueOn}
        value={dueOn ? dayjs(dueOn) : null}
        onChange={(value) => setDueOn(value && value.isValid() ? value.format(ISO_DATE) : null)}
        slotProps={{ textField: { fullWidth: true } }}
      />
      {isOnline ? (
        <Typography variant="body2" color="text.secondary">
          {ASSIGNMENT_DIALOG.hints.onlineMarks}
        </Typography>
      ) : (
        <TextField
          label={ASSIGNMENT_DIALOG.labels.maxMark}
          type="number"
          value={maxMarkText}
          onChange={(event) => setMaxMarkText(event.target.value)}
          error={Boolean(errors.maxMark)}
          helperText={errors.maxMark || ASSIGNMENT_DIALOG.hints.maxMark}
          slotProps={{
            htmlInput: {
              min: ASSIGNMENT_LIMITS.maxMarkMin,
              max: ASSIGNMENT_LIMITS.maxMarkMax,
              step: 1,
            },
          }}
        />
      )}
      {!existing && (
        <Typography variant="body2" color="text.secondary">
          {ASSIGNMENT_DIALOG.newIsDraft}
        </Typography>
      )}
    </FormDialog>
  );
}
