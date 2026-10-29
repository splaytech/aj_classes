import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getMyNotificationSettings,
  listEmailProblems,
  saveMyNotificationSettings,
} from './notifications.service';

type Reply = { data: unknown; error: unknown };

// A stand-in for the few supabase-js calls the service makes. Each table call records its
// method and payload, and answers with the next queued reply.
const calls: {
  method: string;
  payload?: unknown;
  columns?: string;
  filters: [string, unknown][];
}[] = [];
let replies: Reply[] = [];
const rpc = vi.fn();

function tableCall(method: string, payload?: unknown) {
  const call: (typeof calls)[number] = { method, payload, filters: [] };
  calls.push(call);
  const chain = {
    eq: (column: string, value: unknown) => {
      call.filters.push([column, value]);
      return chain;
    },
    select: (columns?: string) => {
      if (method === 'select') call.columns = columns;
      return chain;
    },
    maybeSingle: async () => replies.shift() ?? { data: null, error: null },
  };
  return chain;
}

vi.mock('./supabase.client', () => ({
  getSupabase: async () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'me' } } } }) },
    from: () => ({
      select: (columns: string) => tableCall('select').select(columns),
      update: (payload: unknown) => tableCall('update', payload),
      insert: (payload: unknown) => tableCall('insert', payload),
      upsert: (payload: unknown) => tableCall('upsert', payload),
    }),
    rpc,
  }),
}));

// The admin list asks staff-client for its client (E-60 pattern); staff-access.test.ts covers who
// gets one. Here every caller is treated as an admin with two-step.
vi.mock('./staff-client', async () => {
  const { getSupabase } = await import('./supabase.client');
  return { getAdminClient: getSupabase };
});

beforeEach(() => {
  calls.length = 0;
  replies = [];
  rpc.mockReset();
});

const ALL_ON = { workReturned: true, newAssignment: true, dueTomorrow: true };
const ALL_COLUMNS_ON = { work_returned: true, new_assignment: true, due_tomorrow: true };

describe('getMyNotificationSettings', () => {
  it('reads all three switches for the signed-in person', async () => {
    replies = [{ data: null, error: null }];
    await getMyNotificationSettings();
    expect(calls[0]?.columns).toBe('work_returned, new_assignment, due_tomorrow');
    expect(calls[0]?.filters).toEqual([['profile_id', 'me']]);
  });

  it('treats a missing row as every email on (AC-3.6, AC-8.10 default)', async () => {
    replies = [{ data: null, error: null }];
    expect(await getMyNotificationSettings()).toEqual({ ok: true, data: ALL_ON });
  });

  it('reads each saved choice into its own switch', async () => {
    replies = [
      { data: { work_returned: false, new_assignment: true, due_tomorrow: false }, error: null },
    ];
    expect(await getMyNotificationSettings()).toEqual({
      ok: true,
      data: { workReturned: false, newAssignment: true, dueTomorrow: false },
    });
  });
});

describe('saveMyNotificationSettings', () => {
  it('updates an existing row and never upserts (profile_id has no update grant)', async () => {
    replies = [{ data: { profile_id: 'me' }, error: null }];
    expect(
      await saveMyNotificationSettings({
        workReturned: false,
        newAssignment: true,
        dueTomorrow: false,
      }),
    ).toEqual({ ok: true });
    expect(calls.map((call) => call.method)).toEqual(['update']);
    expect(calls[0]?.payload).toEqual({
      work_returned: false,
      new_assignment: true,
      due_tomorrow: false,
    });
  });

  it('inserts its own row the first time', async () => {
    replies = [
      { data: null, error: null },
      { data: { profile_id: 'me' }, error: null },
    ];
    expect(await saveMyNotificationSettings(ALL_ON)).toEqual({ ok: true });
    expect(calls.map((call) => call.method)).toEqual(['update', 'insert']);
    expect(calls[1]?.payload).toEqual({ profile_id: 'me', ...ALL_COLUMNS_ON });
  });

  it('reports "not saved" when the insert comes back empty', async () => {
    replies = [
      { data: null, error: null },
      { data: null, error: null },
    ];
    expect(await saveMyNotificationSettings(ALL_ON)).toEqual({
      ok: false,
      error: 'notSaved',
    });
  });

  it('maps a refused write to "not allowed"', async () => {
    replies = [{ data: null, error: { code: '42501', message: 'permission denied' } }];
    expect(await saveMyNotificationSettings(ALL_ON)).toEqual({
      ok: false,
      error: 'notAllowed',
    });
  });
});

describe('listEmailProblems', () => {
  it('maps the admin RPC rows', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: 'r1',
          created_at: '2026-10-25T01:00:00Z',
          kind: 'due_tomorrow',
          recipient_role: 'parent',
          assignment_title: 'Paper one',
          state: 'failed',
          reason: 'too_late',
        },
      ],
      error: null,
    });
    expect(await listEmailProblems()).toEqual({
      ok: true,
      data: [
        {
          id: 'r1',
          at: '2026-10-25T01:00:00Z',
          kind: 'due_tomorrow',
          recipientRole: 'parent',
          assignmentTitle: 'Paper one',
          state: 'failed',
          reason: 'too_late',
        },
      ],
    });
    expect(rpc).toHaveBeenCalledWith('admin_email_problems', { max_rows: 100 });
  });

  it('maps "not_admin" to "not allowed"', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'not_admin' } });
    expect(await listEmailProblems()).toEqual({ ok: false, error: 'notAllowed' });
  });
});
