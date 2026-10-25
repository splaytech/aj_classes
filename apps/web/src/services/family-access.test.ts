import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppRole } from '@/constants';

import {
  getChildAssignment,
  getChildTimetable,
  listChildAssignments,
  listMyChildren,
} from './parent.service';
import { getMyAssignment, getMyTimetable, listMyAssignments } from './student.service';
import type { AccessState } from './types';

const fake = vi.hoisted(() => ({
  access: null as AccessState | null,
  accessError: null as Error | null, // when set, the access read fails with it
  rpc: vi.fn(),
}));

// The layouts' access check, which the family reads share (BUG-9).
vi.mock('./auth.service', () => ({
  getAccessState: async () => {
    if (fake.accessError) throw fake.accessError;
    return fake.access;
  },
}));
vi.mock('./supabase.client', () => ({
  getSupabase: async () => ({ rpc: fake.rpc }),
}));

function signedInAs(role: AppRole | null): AccessState {
  return {
    signedIn: role !== null,
    userId: role ? 'u1' : '',
    email: '',
    profile: role ? { fullName: 'Someone', role } : null,
    onboarding: null,
    aal: 'aal1',
    hasVerifiedFactor: false,
  };
}

// Every read a student or parent page's loader makes, with the role it belongs to.
const FAMILY_READS = [
  ['listMyAssignments', 'student', 'student_assignments', () => listMyAssignments()],
  ['getMyAssignment', 'student', 'student_assignment', () => getMyAssignment('a1')],
  ['getMyTimetable', 'student', 'student_timetable', () => getMyTimetable()],
  ['listMyChildren', 'parent', 'parent_children', () => listMyChildren()],
  ['listChildAssignments', 'parent', 'parent_child_assignments', () => listChildAssignments('s1')],
  ['getChildAssignment', 'parent', 'parent_child_assignment', () => getChildAssignment('s1', 'a1')],
  ['getChildTimetable', 'parent', 'parent_child_timetable', () => getChildTimetable('s1')],
] as const;

const ROLES: AppRole[] = ['student', 'parent', 'tutor', 'admin'];

beforeEach(() => {
  fake.accessError = null;
  fake.rpc.mockReset();
  fake.rpc.mockResolvedValue({ data: [], error: null });
});

describe('family reads ask the database only for the right role (BUG-6, BUG-9)', () => {
  it.each(FAMILY_READS)(
    '%s: signed out → no call, "not allowed"',
    async (_name, _role, _rpc, read) => {
      fake.access = signedInAs(null);
      expect(await read()).toEqual({ ok: false, error: 'notAllowed' });
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );

  it.each(
    FAMILY_READS.flatMap(([name, role, rpc, read]) =>
      ROLES.filter((other) => other !== role).map((other) => [name, other, rpc, read] as const),
    ),
  )('%s as a %s → no call, "not allowed"', async (_name, wrongRole, _rpc, read) => {
    fake.access = signedInAs(wrongRole);
    expect(await read()).toEqual({ ok: false, error: 'notAllowed' });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it.each(FAMILY_READS)(
    '%s: the access read fails (no connection) → "network", not "not allowed", and no call',
    async (_name, _role, _rpc, read) => {
      fake.accessError = new TypeError('Failed to fetch');
      expect(await read()).toEqual({ ok: false, error: 'network' });
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );

  it.each(FAMILY_READS)('%s as a %s → calls %s once', async (_name, role, rpc, read) => {
    fake.access = signedInAs(role);
    await read();
    expect(fake.rpc).toHaveBeenCalledTimes(1);
    expect(fake.rpc.mock.calls[0]?.[0]).toBe(rpc);
  });
});
