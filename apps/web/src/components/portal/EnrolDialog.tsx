// Add a student from the roster to a class (R3a story AS4).

import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { useState } from 'react';

import { CLASS_VALIDATION, ENROL_DIALOG } from '@/constants';
import { studentYearLabel } from '@/lib/labels';
import { usePortalAction } from '@/lib/use-portal-action';
import type { Result, StudentSummary } from '@/services';

import { FormDialog } from './FormDialog';

type EnrolDialogProps = {
  open: boolean;
  /** Active students not already in the class. */
  candidates: StudentSummary[];
  onEnrol: (studentId: string) => Promise<Result>;
  onEnrolled: () => void;
  onClose: () => void;
};

export function EnrolDialog({ open, candidates, onEnrol, onEnrolled, onClose }: EnrolDialogProps) {
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [fieldError, setFieldError] = useState('');
  const action = usePortalAction();

  async function handleSubmit() {
    if (!student) {
      setFieldError(CLASS_VALIDATION.studentRequired);
      return;
    }
    setFieldError('');
    const enrolled = await action.run(() => onEnrol(student.id));
    if (enrolled) {
      setStudent(null);
      onEnrolled();
    }
  }

  return (
    <FormDialog
      open={open}
      title={ENROL_DIALOG.heading}
      submitLabel={ENROL_DIALOG.save}
      busyLabel={ENROL_DIALOG.saving}
      busy={action.busy}
      error={action.error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <Autocomplete
        options={candidates}
        value={student}
        onChange={(_, value) => setStudent(value)}
        getOptionLabel={(option) =>
          ENROL_DIALOG.optionLabel(option.fullName, studentYearLabel(option.yearLevel))
        }
        isOptionEqualToValue={(option, value) => option.id === value.id}
        noOptionsText={ENROL_DIALOG.noOptions}
        renderInput={(params) => (
          <TextField
            {...params}
            label={ENROL_DIALOG.studentLabel}
            error={Boolean(fieldError)}
            helperText={fieldError}
            required
          />
        )}
      />
    </FormDialog>
  );
}
