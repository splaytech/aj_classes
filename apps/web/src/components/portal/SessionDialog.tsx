// Add a weekly time to a class (R3a story AS2): day, start and end (time pickers).

import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import type { Dayjs } from 'dayjs';
import { useState } from 'react';

import { DAY_NAMES, DAYS_OF_WEEK, SESSION_DIALOG } from '@/constants';
import { validateSessionTimes } from '@/lib/class-validation';
import { usePortalAction } from '@/lib/use-portal-action';
import type { DayOfWeek, Result, SessionInput } from '@/services';

import { FormDialog } from './FormDialog';

const CLOCK_FORMAT = 'HH:mm';
const MINUTE_STEP = 5;

type SessionDialogProps = {
  open: boolean;
  classId: string;
  onSave: (input: SessionInput) => Promise<Result>;
  onSaved: () => void;
  onClose: () => void;
};

function toClock(value: Dayjs | null): string | null {
  return value && value.isValid() ? value.format(CLOCK_FORMAT) : null;
}

export function SessionDialog({ open, classId, onSave, onSaved, onClose }: SessionDialogProps) {
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(1);
  const [start, setStart] = useState<Dayjs | null>(null);
  const [end, setEnd] = useState<Dayjs | null>(null);
  const [timeError, setTimeError] = useState('');
  const action = usePortalAction();

  async function handleSubmit() {
    const startTime = toClock(start);
    const endTime = toClock(end);
    const problem = validateSessionTimes(startTime, endTime);
    setTimeError(problem);
    if (problem || !startTime || !endTime) return;

    const saved = await action.run(() => onSave({ classId, dayOfWeek, startTime, endTime }));
    if (saved) onSaved();
  }

  return (
    <FormDialog
      open={open}
      title={SESSION_DIALOG.heading}
      submitLabel={SESSION_DIALOG.save}
      busyLabel={SESSION_DIALOG.saving}
      busy={action.busy}
      error={action.error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <TextField
        select
        label={SESSION_DIALOG.dayLabel}
        value={dayOfWeek}
        onChange={(event) => setDayOfWeek(Number(event.target.value) as DayOfWeek)}
      >
        {DAYS_OF_WEEK.map((day) => (
          <MenuItem key={day} value={day}>
            {DAY_NAMES.long[day]}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
        <TimePicker
          label={SESSION_DIALOG.startLabel}
          value={start}
          onChange={setStart}
          minutesStep={MINUTE_STEP}
          slotProps={{ textField: { fullWidth: true, required: true } }}
        />
        <TimePicker
          label={SESSION_DIALOG.endLabel}
          value={end}
          onChange={setEnd}
          minutesStep={MINUTE_STEP}
          slotProps={{
            textField: {
              fullWidth: true,
              required: true,
              error: Boolean(timeError),
              helperText: timeError,
            },
          }}
        />
      </Stack>
    </FormDialog>
  );
}
