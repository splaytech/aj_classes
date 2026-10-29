import { describe, expect, it } from 'vitest';

import { filterStaff, accountStatus } from './account-status';
import type { StaffMember } from '@/services';

const NOW = new Date('2026-10-08T10:00:00Z');

describe('accountStatus (R2a design §5)', () => {
  it('is active once the invite was accepted', () => {
    expect(
      accountStatus({ isActive: true, joinedAt: '2026-10-01T00:00:00Z', invitedAt: null }, NOW),
    ).toBe('active');
  });

  it('is deactivated whenever the account is inactive', () => {
    expect(
      accountStatus({ isActive: false, joinedAt: '2026-10-01T00:00:00Z', invitedAt: null }, NOW),
    ).toBe('deactivated');
  });

  const invitedAgo = (ms: number) => ({
    isActive: true,
    joinedAt: null,
    invitedAt: new Date(NOW.getTime() - ms).toISOString(),
  });
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  it('is invited 13 days after the send (AC 23)', () => {
    expect(accountStatus(invitedAgo(13 * DAY), NOW)).toBe('invited');
  });

  it('is still invited 13 days 23 hours after the send', () => {
    expect(accountStatus(invitedAgo(13 * DAY + 23 * HOUR), NOW)).toBe('invited');
  });

  it('shows the invite as expired at exactly 336 hours', () => {
    expect(accountStatus(invitedAgo(336 * HOUR), NOW)).toBe('inviteExpired');
  });

  it('shows the invite as expired 14 days 1 minute after the send', () => {
    expect(accountStatus(invitedAgo(14 * DAY + 60 * 1000), NOW)).toBe('inviteExpired');
  });

  it('shows an invite with no send date as expired (AC 25)', () => {
    expect(accountStatus({ isActive: true, joinedAt: null, invitedAt: null }, NOW)).toBe(
      'inviteExpired',
    );
  });
});

describe('filterStaff', () => {
  const base: StaffMember = {
    id: '1',
    email: 'priya@example.com',
    fullName: 'Priya Sharma',
    role: 'tutor',
    isActive: true,
    invitedAt: null,
    joinedAt: '2026-10-01T00:00:00Z',
    lastSignInAt: null,
    hasTwoStep: false,
    phone: null,
    termsAcceptedAt: null,
  };
  const pending: StaffMember = {
    ...base,
    id: '2',
    email: 'new@example.com',
    fullName: 'New Person',
    joinedAt: null,
    invitedAt: '2026-10-01T00:00:00Z',
  };
  const gone: StaffMember = {
    ...base,
    id: '3',
    fullName: 'Old Tutor',
    email: 'old@example.com',
    isActive: false,
  };

  it('searches names and e-mails, ignoring case', () => {
    expect(filterStaff([base, pending, gone], 'SHARMA', 'all', NOW).map((m) => m.id)).toEqual([
      '1',
    ]);
    expect(filterStaff([base, pending, gone], 'new@', 'all', NOW).map((m) => m.id)).toEqual(['2']);
  });

  it('filters by status; "invited" includes expired invites', () => {
    expect(filterStaff([base, pending, gone], '', 'invited', NOW).map((m) => m.id)).toEqual(['2']);
    expect(filterStaff([base, pending, gone], '', 'deactivated', NOW).map((m) => m.id)).toEqual([
      '3',
    ]);
    expect(filterStaff([base, pending, gone], '', 'active', NOW).map((m) => m.id)).toEqual(['1']);
  });
});
