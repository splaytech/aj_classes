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

  it('is invited while the link is still valid (1 hour)', () => {
    expect(
      accountStatus({ isActive: true, joinedAt: null, invitedAt: '2026-10-08T09:30:00Z' }, NOW),
    ).toBe('invited');
  });

  it('shows the invite as expired after an hour', () => {
    expect(
      accountStatus({ isActive: true, joinedAt: null, invitedAt: '2026-10-08T08:59:00Z' }, NOW),
    ).toBe('inviteExpired');
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
