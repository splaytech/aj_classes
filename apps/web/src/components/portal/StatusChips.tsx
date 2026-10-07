// Small labelled chips. Each always shows text, never colour alone (R3a review H22).

import Chip from '@mui/material/Chip';

import { STAFF_ROLE_LABELS, STAFF_STATUS_LABELS } from '@/constants';
import type { StaffRole } from '@/constants';
import type { StaffStatus } from '@/lib/staff-status';

const STAFF_STATUS_COLOURS = {
  active: 'success',
  invited: 'info',
  inviteExpired: 'warning',
  deactivated: 'default',
} as const;

export function StaffStatusChip({ status }: { status: StaffStatus }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      color={STAFF_STATUS_COLOURS[status]}
      label={STAFF_STATUS_LABELS[status]}
    />
  );
}

export function RoleChip({ role }: { role: StaffRole }) {
  return (
    <Chip
      size="small"
      color={role === 'admin' ? 'primary' : 'default'}
      variant={role === 'admin' ? 'filled' : 'outlined'}
      label={STAFF_ROLE_LABELS[role]}
    />
  );
}
