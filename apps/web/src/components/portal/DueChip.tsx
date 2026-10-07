// "Overdue" / "Due today" / "Due soon" / "Due 12 Oct 2026" chip for an assignment.

import Chip from '@mui/material/Chip';

import { DUE_LABELS } from '@/constants';
import { dueState } from '@/lib/assignments';
import type { DueState } from '@/lib/assignments';
import { formatDate } from '@/lib/format';

const DUE_COLOURS = {
  none: 'default',
  overdue: 'error',
  today: 'warning',
  soon: 'warning',
  later: 'default',
} as const;

function dueLabel(dueOn: string | null, state: DueState): string {
  if (state === 'none') return DUE_LABELS.none;
  const date = formatDate(dueOn);
  return state === 'later'
    ? DUE_LABELS.dueOn(date)
    : DUE_LABELS.dueOnWithState(date, DUE_LABELS[state]);
}

export function DueChip({ dueOn }: { dueOn: string | null }) {
  const state = dueState(dueOn, new Date());
  return (
    <Chip
      size="small"
      variant="outlined"
      color={DUE_COLOURS[state]}
      label={dueLabel(dueOn, state)}
    />
  );
}
