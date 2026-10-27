// Small labelled chips. Each always shows text, never colour alone (R3a review H22).

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import {
  ACCOUNT_STATUS_LABELS,
  CONSENT_CHOICES,
  CONSENT_KINDS,
  CRM_STATUS_LABELS,
  FAMILY_TAGS,
  ROLE_LABELS,
} from '@/constants';
import type { CrmStatus, StaffRole } from '@/constants';
import type { AccountStatus } from '@/lib/account-status';
import type { Consents } from '@/services';

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

const CRM_STATUS_COLOURS = {
  pending: 'info',
  synced: 'success',
  failed: 'warning',
  off: 'default',
} as const;

/** Whether an enquiry reached Zoho CRM (leads-and-crm.md §5). */
export function CrmStatusChip({ status }: { status: CrmStatus }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      color={CRM_STATUS_COLOURS[status]}
      label={CRM_STATUS_LABELS[status]}
    />
  );
}

/** A parent's optional permissions, e.g. "Name and results: yes" (invite-onboarding.md, "Consents"). */
export function PermissionChips({ consents, label }: { consents: Consents; label: string }) {
  return (
    <Stack
      component="ul"
      direction="row"
      spacing={1}
      useFlexGap
      aria-label={label}
      sx={{ flexWrap: 'wrap', listStyle: 'none', m: 0, p: 0 }}
    >
      {CONSENT_KINDS.map((kind) => (
        <li key={kind}>
          <Chip
            size="small"
            variant="outlined"
            color={consents[kind] ? 'success' : 'default'}
            label={`${CONSENT_CHOICES.short[kind]}: ${consents[kind] ? CONSENT_CHOICES.yes : CONSENT_CHOICES.no}`}
          />
        </li>
      ))}
    </Stack>
  );
}

/** Returned work from a class the student has left or that has ended (ADR-0007, AC-7.12). */
export function PastClassChip() {
  return <Chip size="small" variant="outlined" label={FAMILY_TAGS.pastClass} />;
}
