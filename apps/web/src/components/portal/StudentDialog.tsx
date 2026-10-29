// Add or edit a student on the roster (R3a story AS3). Name and year level only (review H10).

import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { STUDENT_DIALOG, YEAR_LEVEL_TEXT, YEAR_LEVELS } from '@/constants';
import { validateStudentName } from '@/lib/class-validation';
import { usePortalAction } from '@/lib/use-portal-action';
import type { Result, StudentInput, StudentSummary } from '@/services';

import { FormDialog } from './FormDialog';

const OTHER_YEAR = 'other';

type StudentDialogProps = {
  open: boolean;
  existing: StudentSummary | null;
  onSave: (input: StudentInput) => Promise<Result<string>>;
  onSaved: () => void;
  onClose: () => void;
};

export function StudentDialog({ open, existing, onSave, onSaved, onClose }: StudentDialogProps) {
  const [fullName, setFullName] = useState(existing?.fullName ?? '');
  const [yearLevel, setYearLevel] = useState<number | null>(
    existing ? existing.yearLevel : YEAR_LEVELS[0],
  );
  const [nameError, setNameError] = useState('');
  const action = usePortalAction();

  async function handleSubmit() {
    const problem = validateStudentName(fullName);
    setNameError(problem);
    if (problem) return;

    const saved = await action.run(() => onSave({ id: existing?.id, fullName, yearLevel }));
    if (saved) onSaved();
  }

  return (
    <FormDialog
      open={open}
      title={existing ? STUDENT_DIALOG.editHeading : STUDENT_DIALOG.newHeading}
      submitLabel={STUDENT_DIALOG.save}
      busyLabel={STUDENT_DIALOG.saving}
      busy={action.busy}
      error={action.error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <TextField
        label={STUDENT_DIALOG.nameLabel}
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        error={Boolean(nameError)}
        helperText={nameError}
        autoComplete="off"
        required
      />
      <TextField
        select
        label={STUDENT_DIALOG.yearLabel}
        value={yearLevel === null ? OTHER_YEAR : String(yearLevel)}
        onChange={(event) =>
          setYearLevel(event.target.value === OTHER_YEAR ? null : Number(event.target.value))
        }
      >
        {YEAR_LEVELS.map((year) => (
          <MenuItem key={year} value={String(year)}>
            {YEAR_LEVEL_TEXT.label(year)}
          </MenuItem>
        ))}
        <MenuItem value={OTHER_YEAR}>{YEAR_LEVEL_TEXT.other}</MenuItem>
      </TextField>
      <Typography variant="body2" color="textSecondary">
        {STUDENT_DIALOG.privacyNote}
      </Typography>
    </FormDialog>
  );
}
