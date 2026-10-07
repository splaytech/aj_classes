// Create or edit a class (R3a story AS1): name, subject, year, delivery, location, tutor, term.

import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useState } from 'react';

import { CLASS_DIALOG, DELIVERY_LABELS, SUBJECTS, YEAR_LEVEL_TEXT, YEAR_LEVELS } from '@/constants';
import { validateClass } from '@/lib/class-validation';
import type { TutorOption } from '@/lib/staff-options';
import type { ClassErrors } from '@/lib/class-validation';
import { usePortalAction } from '@/lib/use-portal-action';
import type { ClassInput, ClassSummary, Delivery, Result } from '@/services';

import { FormDialog } from './FormDialog';

const ANY_YEAR = 'any';
const NO_TUTOR = 'none';
const ISO_DATE = 'YYYY-MM-DD';
const DELIVERIES: Delivery[] = ['in_person', 'online'];

type ClassDialogProps = {
  open: boolean;
  /** The class being edited, or null for a new one. */
  existing: ClassSummary | null;
  tutors: TutorOption[];
  onSave: (input: ClassInput) => Promise<Result<string>>;
  onSaved: (classId: string) => void;
  onClose: () => void;
};

function emptyInput(): ClassInput {
  return {
    name: '',
    subject: '',
    yearLevel: null,
    delivery: 'in_person',
    location: '',
    tutorId: null,
    startsOn: null,
    endsOn: null,
  };
}

function inputFrom(existing: ClassSummary): ClassInput {
  return {
    id: existing.id,
    name: existing.name,
    subject: existing.subject,
    yearLevel: existing.yearLevel,
    delivery: existing.delivery,
    location: existing.location,
    tutorId: existing.tutorId,
    startsOn: existing.startsOn,
    endsOn: existing.endsOn,
  };
}

function toIso(value: Dayjs | null): string | null {
  return value && value.isValid() ? value.format(ISO_DATE) : null;
}

export function ClassDialog({
  open,
  existing,
  tutors,
  onSave,
  onSaved,
  onClose,
}: ClassDialogProps) {
  const [input, setInput] = useState<ClassInput>(existing ? inputFrom(existing) : emptyInput());
  const [errors, setErrors] = useState<ClassErrors>({});
  const action = usePortalAction();

  // A tutor who has since been deactivated stays selectable on their own class (review H26).
  const tutorOptions =
    existing?.tutorId && !tutors.some((tutor) => tutor.id === existing.tutorId)
      ? [...tutors, { id: existing.tutorId, name: existing.tutorName }]
      : tutors;

  function update(changes: Partial<ClassInput>) {
    setInput({ ...input, ...changes });
  }

  async function handleSubmit() {
    const found = validateClass(input);
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
      title={existing ? CLASS_DIALOG.editHeading : CLASS_DIALOG.newHeading}
      submitLabel={CLASS_DIALOG.save}
      busyLabel={CLASS_DIALOG.saving}
      busy={action.busy}
      error={action.error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <TextField
        label={CLASS_DIALOG.labels.name}
        value={input.name}
        onChange={(event) => update({ name: event.target.value })}
        error={Boolean(errors.name)}
        helperText={errors.name}
        required
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
        <TextField
          select
          fullWidth
          label={CLASS_DIALOG.labels.subject}
          value={input.subject}
          onChange={(event) => update({ subject: event.target.value })}
          error={Boolean(errors.subject)}
          helperText={errors.subject}
          required
        >
          {SUBJECTS.map((subject) => (
            <MenuItem key={subject.key} value={subject.key}>
              {subject.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          fullWidth
          label={CLASS_DIALOG.labels.yearLevel}
          value={input.yearLevel === null ? ANY_YEAR : String(input.yearLevel)}
          onChange={(event) =>
            update({
              yearLevel: event.target.value === ANY_YEAR ? null : Number(event.target.value),
            })
          }
        >
          <MenuItem value={ANY_YEAR}>{YEAR_LEVEL_TEXT.any}</MenuItem>
          {YEAR_LEVELS.map((year) => (
            <MenuItem key={year} value={String(year)}>
              {YEAR_LEVEL_TEXT.label(year)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
        <TextField
          select
          fullWidth
          label={CLASS_DIALOG.labels.delivery}
          value={input.delivery}
          onChange={(event) => update({ delivery: event.target.value as Delivery })}
        >
          {DELIVERIES.map((delivery) => (
            <MenuItem key={delivery} value={delivery}>
              {DELIVERY_LABELS[delivery]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          label={CLASS_DIALOG.labels.location}
          value={input.location}
          onChange={(event) => update({ location: event.target.value })}
          error={Boolean(errors.location)}
          helperText={errors.location || CLASS_DIALOG.hints.location}
        />
      </Stack>
      <TextField
        select
        label={CLASS_DIALOG.labels.tutor}
        value={input.tutorId ?? NO_TUTOR}
        onChange={(event) =>
          update({ tutorId: event.target.value === NO_TUTOR ? null : event.target.value })
        }
      >
        <MenuItem value={NO_TUTOR}>{CLASS_DIALOG.noTutor}</MenuItem>
        {tutorOptions.map((tutor) => (
          <MenuItem key={tutor.id} value={tutor.id}>
            {tutor.name}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
        <DatePicker
          label={CLASS_DIALOG.labels.startsOn}
          value={input.startsOn ? dayjs(input.startsOn) : null}
          onChange={(value) => update({ startsOn: toIso(value) })}
          slotProps={{ textField: { fullWidth: true, helperText: CLASS_DIALOG.hints.term } }}
        />
        <DatePicker
          label={CLASS_DIALOG.labels.endsOn}
          value={input.endsOn ? dayjs(input.endsOn) : null}
          onChange={(value) => update({ endsOn: toIso(value) })}
          slotProps={{
            textField: { fullWidth: true, error: Boolean(errors.term), helperText: errors.term },
          }}
        />
      </Stack>
    </FormDialog>
  );
}
