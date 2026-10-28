import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppRole } from '@/constants';

import { listActivity } from './activity.service';
import { getAssignment } from './assignments.service';
import { listEmailProblems } from './notifications.service';
import { getMyProfile, getProfile } from './profile.service';
import { getStaffMember, listStaff } from './staff.service';
import { getSubmission } from './submissions.service';
import type { AccessState } from './types';

const fake = vi.hoisted(() => ({
  access: null as AccessState | null,
  accessError: null as Error | null, // when set, the access read fails with it
  rpc: vi.fn(),
  from: vi.fn(),
}));

// The layouts' access check, which these reads share (item 4, Tester E-60).
vi.mock('./auth.service', () => ({
  getAccessState: async () => {
    if (fake.accessError) throw fake.accessError;
    return fake.access;
  },
}));
vi.mock('./supabase.client', () => ({
  getSupabase: async () => ({
    rpc: fake.rpc,
    from: fake.from,
    auth: { getSession: async () => ({ data: { session: { user: { id: 'me' } } } }) },
  }),
}));

function signedInAs(role: AppRole | null, aal: 'aal1' | 'aal2' = 'aal1'): AccessState {
  return {
    signedIn: role !== null,
    userId: role ? 'me' : '',
    email: '',
    profile: role ? { fullName: 'Someone', role } : null,
    onboarding: null,
    aal,
    hasVerifiedFactor: aal === 'aal2',
  };
}

/** A profiles query that finds nothing, so a call is visible without a full row. */
function emptyProfileQuery() {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: null, error: null }),
  };
  return query;
}

// Every read the admin staff list, staff page and Activity loaders make.
const ADMIN_READS = [
  ['listStaff', () => listStaff()],
  ['getStaffMember', () => getStaffMember('someone-else')],
  ['listActivity', () => listActivity()],
  ['listEmailProblems', () => listEmailProblems()], // Admin → Emails (item 8 test plan P2)
] as const;

const ROLES: AppRole[] = ['student', 'parent', 'tutor', 'admin'];

function databaseCalls() {
  return fake.rpc.mock.calls.length + fake.from.mock.calls.length;
}

beforeEach(() => {
  fake.accessError = null;
  fake.rpc.mockReset();
  fake.rpc.mockResolvedValue({ data: [], error: null });
  fake.from.mockReset();
  fake.from.mockImplementation(emptyProfileQuery);
});

describe('admin reads ask the database only for an admin with two-step (E-60)', () => {
  it.each(
    ADMIN_READS.flatMap(([name, read]) =>
      ROLES.filter((role) => role !== 'admin').map((role) => [name, role, read] as const),
    ),
  )('%s as a %s → no call, "not allowed"', async (_name, role, read) => {
    fake.access = signedInAs(role, 'aal2');
    expect(await read()).toEqual({ ok: false, error: 'notAllowed' });
    expect(databaseCalls()).toBe(0);
  });

  it.each(ADMIN_READS)('%s: signed out → no call', async (_name, read) => {
    fake.access = signedInAs(null);
    expect(await read()).toEqual({ ok: false, error: 'notAllowed' });
    expect(databaseCalls()).toBe(0);
  });

  it.each(ADMIN_READS)('%s as an admin without two-step → no call', async (_name, read) => {
    fake.access = signedInAs('admin', 'aal1');
    expect(await read()).toEqual({ ok: false, error: 'notAllowed' });
    expect(databaseCalls()).toBe(0);
  });

  it.each(ADMIN_READS)(
    '%s: the access read fails → "network", and no call',
    async (_name, read) => {
      fake.accessError = new TypeError('Failed to fetch');
      expect(await read()).toEqual({ ok: false, error: 'network' });
      expect(databaseCalls()).toBe(0);
    },
  );

  it.each(ADMIN_READS)('%s as an admin with two-step → one call', async (_name, read) => {
    fake.access = signedInAs('admin', 'aal2');
    await read();
    expect(fake.rpc).toHaveBeenCalledTimes(1);
  });
});

describe('staff profile reads ask the database only when the row is theirs to see (E-60)', () => {
  it.each(['student', 'parent'] as const)('My profile as a %s → no call', async (role) => {
    fake.access = signedInAs(role);
    expect(await getMyProfile()).toEqual({ ok: false, error: 'notAllowed' });
    expect(databaseCalls()).toBe(0);
  });

  it.each(['tutor', 'admin'] as const)('My profile as a %s → one read', async (role) => {
    fake.access = signedInAs(role);
    await getMyProfile();
    expect(fake.from).toHaveBeenCalledTimes(1);
  });

  it("someone else's profile as a tutor, or as an admin without two-step → no call", async () => {
    for (const access of [signedInAs('tutor', 'aal2'), signedInAs('admin', 'aal1')]) {
      fake.access = access;
      expect(await getProfile('someone-else')).toEqual({ ok: false, error: 'notAllowed' });
    }
    expect(databaseCalls()).toBe(0);
  });

  it("someone else's profile as an admin with two-step → one read", async () => {
    fake.access = signedInAs('admin', 'aal2');
    await getProfile('someone-else');
    expect(fake.from).toHaveBeenCalledTimes(1);
  });
});

// The assignment and marking page loaders (item 7 test plan, the E-60 pattern).
const STAFF_PAGE_READS = [
  ['getAssignment', () => getAssignment('a1')],
  ['getSubmission', () => getSubmission('a1', 's1')],
] as const;

describe('staff assignment reads ask the database only for a tutor or an admin', () => {
  it.each(
    STAFF_PAGE_READS.flatMap(([name, read]) =>
      (['student', 'parent'] as const).map((role) => [name, role, read] as const),
    ),
  )('%s as a %s → no call, "not allowed"', async (_name, role, read) => {
    fake.access = signedInAs(role);
    expect(await read()).toEqual({ ok: false, error: 'notAllowed' });
    expect(databaseCalls()).toBe(0);
  });

  it.each(STAFF_PAGE_READS)('%s: signed out → no call', async (_name, read) => {
    fake.access = signedInAs(null);
    expect(await read()).toEqual({ ok: false, error: 'notAllowed' });
    expect(databaseCalls()).toBe(0);
  });

  it.each(
    STAFF_PAGE_READS.flatMap(([name, read]) =>
      (['tutor', 'admin'] as const).map((role) => [name, role, read] as const),
    ),
  )('%s as a %s → one read', async (_name, role, read) => {
    fake.access = signedInAs(role);
    await read();
    expect(fake.from).toHaveBeenCalledTimes(1); // the assignment row; not found stops there
  });
});
