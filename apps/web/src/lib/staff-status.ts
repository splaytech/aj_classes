// A staff member's status, worked out from their dates (R2a design §5). Not stored anywhere.

import { AUTH_LIMITS } from '@/constants';
import type { StaffMember } from '@/services';

export type StaffStatus = 'invited' | 'inviteExpired' | 'active' | 'deactivated';

const HOUR_MS = 60 * 60 * 1000;

export function staffStatus(
  member: Pick<StaffMember, 'isActive' | 'joinedAt' | 'invitedAt'>,
  now: Date,
): StaffStatus {
  if (!member.isActive) return 'deactivated';
  if (member.joinedAt) return 'active';

  const invitedAt = member.invitedAt ? new Date(member.invitedAt).getTime() : 0;
  const linkStillValid = now.getTime() - invitedAt < AUTH_LIMITS.linkExpiryHours * HOUR_MS;
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
    const status = staffStatus(member, now);
    const matchesFilter =
      filter === 'all' || status === filter || (filter === 'invited' && status === 'inviteExpired');
    return matchesSearch && matchesFilter;
  });
}
