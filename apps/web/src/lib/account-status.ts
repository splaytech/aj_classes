// An account's status, worked out from its dates (R2a design §5): staff, and since R3b students
// and parents. Not stored anywhere. An invite link lasts 14 days from its latest send (ADR-0010);
// an invite with no send date (sent before ADR-0010) counts as expired.

import { INVITE_LIMITS } from '@/constants';
import type { StaffMember } from '@/services';

export type AccountStatus = 'invited' | 'inviteExpired' | 'active' | 'deactivated';

const HOUR_MS = 60 * 60 * 1000;

export function accountStatus(
  member: Pick<StaffMember, 'isActive' | 'joinedAt' | 'invitedAt'>,
  now: Date,
): AccountStatus {
  if (!member.isActive) return 'deactivated';
  if (member.joinedAt) return 'active';

  const invitedAt = member.invitedAt ? new Date(member.invitedAt).getTime() : 0;
  const linkStillValid = now.getTime() - invitedAt < INVITE_LIMITS.linkLifetimeHours * HOUR_MS;
  return linkStillValid ? 'invited' : 'inviteExpired';
}

export function hasJoined(member: Pick<StaffMember, 'joinedAt'>): boolean {
  return Boolean(member.joinedAt);
}

export type StaffFilter = 'all' | 'active' | 'invited' | 'deactivated';

/** Staff matching a search (name or e-mail) and a status filter; "invited" includes expired. */
export function filterStaff(
  members: StaffMember[],
  search: string,
  filter: StaffFilter,
  now: Date,
): StaffMember[] {
  const needle = search.trim().toLowerCase();

  return members.filter((member) => {
    const matchesSearch =
      !needle ||
      member.fullName.toLowerCase().includes(needle) ||
      member.email.toLowerCase().includes(needle);
    const status = accountStatus(member, now);
    const matchesFilter =
      filter === 'all' || status === filter || (filter === 'invited' && status === 'inviteExpired');
    return matchesSearch && matchesFilter;
  });
}
