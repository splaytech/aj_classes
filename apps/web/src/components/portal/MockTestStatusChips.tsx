// Small labelled chips for mock tests. Each always shows text, never colour alone.

import Chip from '@mui/material/Chip';

import { MOCK_TAKE_STATUS_LABELS, MOCK_TEST_STATUS_LABELS } from '@/constants';
import type { MockTakeStatus, MockTestStatus } from '@/services';

const TEST_STATUS_COLOURS = { draft: 'default', released: 'success' } as const;

const TAKE_STATUS_COLOURS = {
  not_started: 'default',
  in_progress: 'info',
  submitted: 'success',
} as const;

/** Whether an admin's mock test is still a draft or has been released. */
export function MockTestStatusChip({ status }: { status: MockTestStatus }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      color={TEST_STATUS_COLOURS[status]}
      label={MOCK_TEST_STATUS_LABELS[status]}
    />
  );
}

/** How far a person has got with a mock test. */
export function MockTakeStatusChip({ status }: { status: MockTakeStatus }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      color={TAKE_STATUS_COLOURS[status]}
      label={MOCK_TAKE_STATUS_LABELS[status]}
    />
  );
}
