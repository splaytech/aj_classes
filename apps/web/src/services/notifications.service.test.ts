import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getMyNotificationSettings,
  listEmailProblems,
  saveMyNotificationSettings,
} from './notifications.service';

type Reply = { data: unknown; error: unknown };

// A stand-in for the few supabase-js calls the service makes. Each table call records its
// method and payload, and answers with the next queued reply.
const calls: { method: string; payload?: unknown; filters: [string, unknown][] }[] = [];
let replies: Reply[] = [];
const rpc = vi.fn();

function tableCall(method: string, payload?: unknown) {
  const call = { method, payload, filters: [] as [string, unknown][] };
  calls.push(call);
  const chain = {
    eq: (column: string, value: unknown) => {
      call.filters.push([column, value]);
      return chain;
    },
    select: () => chain,
    maybeSingle: async () => replies.shift() ?? { data: null, error: null },
  };
  return chain;
}

vi.mock('./supabase.client', () => ({
  getSupabase: async () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'me' } } } }) },
    from: () => ({
      select: () => tableCall('select'),
      update: (payload: unknown) => tableCall('update', payload),
      insert: (payload: unknown) => tableCall('insert', payload),
      upsert: (payload: unknown) => tableCall('upsert', payload),
    }),
    rpc,
  }),
}));

beforeEach(() => {
  calls.length = 0;
  replies = [];
  rpc.mockReset();
});

describe('getMyNotificationSettings', () => {
  it('treats a missing row as on (AC-3.6 default)', async () => {
    replies = [{ data: null, error: null }];
    expect(await getMyNotificationSettings()).toEqual({ ok: true, data: { workReturned: true } });
    expect(calls[0]?.filters).toEqual([['profile_id', 'me']]);
  });

  it('reads a saved choice', async () => {
    replies = [{ data: { work_returned: false }, error: null }];
    expect(await getMyNotificationSettings()).toEqual({ ok: true, data: { workReturned: false } });
  });
});

describe('saveMyNotificationSettings', () => {
  it('updates an existing row and never upserts (profile_id has no update grant)', async () => {
    replies = [{ data: { profile_id: 'me' }, error: null }];
    expect(await saveMyNotificationSettings({ workReturned: false })).toEqual({ ok: true });
    expect(calls.map((call) => call.method)).toEqual(['update']);
    expect(calls[0]?.payload).toEqual({ work_returned: false });
  });

  it('inserts its own row the first time', async () => {
    replies = [
      { data: null, error: null },
      { data: { profile_id: 'me' }, error: null },
    ];
    expect(await saveMyNotificationSettings({ workReturned: true })).toEqual({ ok: true });
    expect(calls.map((call) => call.method)).toEqual(['update', 'insert']);
    expect(calls[1]?.payload).toEqual({ profile_id: 'me', work_returned: true });
  });

  it('reports "not saved" when the insert comes back empty', async () => {
    replies = [
      { data: null, error: null },
      { data: null, error: null },
    ];
    expect(await saveMyNotificationSettings({ workReturned: true })).toEqual({
      ok: false,
      error: 'notSaved',
    });
  });

  it('maps a refused write to "not allowed"', async () => {
    replies = [{ data: null, error: { code: '42501', message: 'permission denied' } }];
    expect(await saveMyNotificationSettings({ workReturned: true })).toEqual({
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
          recipient_role: 'parent',
          assignment_title: 'Paper one',
          state: 'waiting',
          reason: 'not_attempted',
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
          recipientRole: 'parent',
          assignmentTitle: 'Paper one',
          state: 'waiting',
          reason: 'not_attempted',
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
