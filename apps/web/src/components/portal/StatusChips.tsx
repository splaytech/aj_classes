// Small labelled chips. Each always shows text, never colour alone (R3a review H22).

import Chip from '@mui/material/Chip';

import { ROLE_LABELS, ACCOUNT_STATUS_LABELS } from '@/constants';
import type { StaffRole } from '@/constants';
import type { AccountStatus } from '@/lib/account-status';

const ACCOUNT_STATUS_COLOURS = {
  none: 'default',
  active: 'success',
  invited: 'info',
  inviteExpired: 'warning',
  deactivated: 'default',
} as const;

/** An account's status; "none" for a student who has no account yet (R3b FA3). */
export function AccountStatusChip({ status }: { status: AccountStatus | 'none' }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      color={ACCOUNT_STATUS_COLOURS[status]}
      label={ACCOUNT_STATUS_LABELS[status]}
    />
  );
}

export function RoleChip({ role }: { role: StaffRole }) {
  return (
    <Chip
      size="small"
      color={role === 'admin' ? 'primary' : 'default'}
      variant={role === 'admin' ? 'filled' : 'outlined'}
      label={ROLE_LABELS[role]}
    />
  );
}
