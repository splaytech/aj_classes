import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getChildAssignment,
  getChildTimetable,
  listChildAssignments,
  listMyChildren,
} from './parent.service';
import { getMyAssignment, getMyTimetable, listMyAssignments } from './student.service';

// The real getSignedInSupabase runs against this stand-in client.
const fake = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  rpc: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: fake.session } }) },
    rpc: fake.rpc,
  }),
}));

// Every read a student or parent page's loader makes (BUG-6).
const FAMILY_READS = {
  listMyAssignments: () => listMyAssignments(),
  getMyAssignment: () => getMyAssignment('a1'),
  getMyTimetable: () => getMyTimetable(),
  listMyChildren: () => listMyChildren(),
  listChildAssignments: () => listChildAssignments('s1'),
  getChildAssignment: () => getChildAssignment('s1', 'a1'),
  getChildTimetable: () => getChildTimetable('s1'),
};

beforeEach(() => {
  fake.session = null;
  fake.rpc.mockReset();
  fake.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'not_found' } });
});

describe('family reads while signed out (an email link opened in a new browser)', () => {
  it.each(Object.entries(FAMILY_READS))(
    '%s makes no database call and reports "not allowed"',
    async (_name, read) => {
      expect(await read()).toEqual({ ok: false, error: 'notAllowed' });
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );

  it('calls the database once signed in', async () => {
    fake.session = { user: { id: 'parent-1' } };
    await getChildAssignment('s1', 'a1');
    expect(fake.rpc).toHaveBeenCalledWith('parent_child_assignment', {
      target_student: 's1',
      target_assignment: 'a1',
    });
  });
});
