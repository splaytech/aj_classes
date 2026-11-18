import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  closeMockTestNow,
  createMockTest,
  deleteMockQuestion,
  deleteMockTest,
  getMockTestForEdit,
  getMockTestResults,
  getMyMockTest,
  listMockTestsAdmin,
  listMyMockTests,
  moveMockQuestion,
  releaseMockTest,
  saveMockAnswer,
  saveMockQuestion,
  setMockTestClosing,
  startMockTest,
  submitMockTest,
  updateMockTest,
  updateMockTestTags,
  withdrawMockTest,
} from './mock-tests.service';

type Reply = { data: unknown; error: unknown };

// A stand-in for a supabase-js query: every method returns the same object, and awaiting it
// gives the next reply. `calls` records each method and its arguments.
const calls: [string, unknown[]][] = [];
const replies: Reply[] = [];

function query() {
  const chain: unknown = new Proxy(
    {},
    {
      get: (_target, method: string) => {
        if (method === 'then') {
          const reply = replies.shift() ?? { data: null, error: null };
          return (resolve: (value: Reply) => void) => resolve(reply);
        }
        return (...args: unknown[]) => {
          calls.push([method, args]);
          return chain;
        };
      },
    },
  );
  return chain;
}

vi.mock('./supabase.client', () => ({
  getSupabase: async () => ({
    from: (table: string) => {
      calls.push(['from', [table]]);
      return query();
    },
    rpc: (name: string, args?: unknown) => {
      calls.push(['rpc', [name, args]]);
      return query();
    },
  }),
}));

// staff-client decides who gets a client (staff-access.test.ts covers it); here the viewer is
// whoever `viewer.allowed` says, so a refused viewer proves no request goes out.
const viewer = { allowed: true };
vi.mock('./staff-client', async () => {
  const { getSupabase } = await import('./supabase.client');
  const client = async () => (viewer.allowed ? getSupabase() : null);
  return { getAdminClient: client, getTakerClient: client };
});

function reply(data: unknown, error: unknown = null) {
  replies.push({ data, error });
}

function called(method: string, ...args: unknown[]) {
  return calls.some(
    ([name, given]) => name === method && JSON.stringify(given) === JSON.stringify(args),
  );
}

beforeEach(() => {
  viewer.allowed = true;
  calls.length = 0;
  replies.length = 0;
});

describe('listMockTestsAdmin', () => {
  it('maps the admin list rows', async () => {
    reply([
      {
        id: 't1',
        title: 'Maths',
        status: 'draft',
        question_count: 2,
        submitted_count: 0,
        created_by_name: 'Ana',
        created_at: 'c',
        updated_at: 'u',
        released_at: null,
        closes_at: '2026-12-01T00:00:00Z',
        subject: 'maths',
        stream: 'vce',
        year_levels: [7, 8],
        any_year: false,
      },
    ]);
    expect(await listMockTestsAdmin()).toEqual({
      ok: true,
      data: [
        {
          id: 't1',
          title: 'Maths',
          status: 'draft',
          questionCount: 2,
          submittedCount: 0,
          createdByName: 'Ana',
          createdAt: 'c',
          updatedAt: 'u',
          releasedAt: null,
          closesAt: '2026-12-01T00:00:00Z',
          tags: { subject: 'maths', stream: 'vce', yearLevels: [7, 8], anyYear: false },
        },
      ],
    });
    expect(called('rpc', 'mock_tests_admin_list', undefined)).toBe(true);
  });

  it('says notAllowed for a non-admin', async () => {
    reply(null, { code: 'P0001', message: 'not_admin' });
    expect(await listMockTestsAdmin()).toEqual({ ok: false, error: 'notAllowed' });
  });
});

describe('getMockTestForEdit', () => {
  it('reads the test, then its questions in order', async () => {
    reply({
      id: 't1',
      title: 'Maths',
      instructions: 'Go',
      status: 'draft',
      closes_at: null,
      pass_mark: 60,
      subject: null,
      stream: null,
      year_levels: [],
      any_year: true,
    });
    reply([
      {
        id: 'q1',
        position: 1,
        prompt: 'P',
        options: ['a', 'b'],
        marks: 3,
        correct_option: 1,
        explanation: '',
      },
    ]);
    const result = await getMockTestForEdit('t1');
    expect(result).toEqual({
      ok: true,
      data: {
        id: 't1',
        title: 'Maths',
        instructions: 'Go',
        status: 'draft',
        closesAt: null,
        passMark: 60,
        tags: { subject: null, stream: null, yearLevels: [], anyYear: true },
        questions: [
          {
            id: 'q1',
            position: 1,
            prompt: 'P',
            options: ['a', 'b'],
            marks: 3,
            correctOption: 1,
            explanation: '',
          },
        ],
      },
    });
    expect(called('order', 'position')).toBe(true);
  });

  it('says notFound when no row comes back (not an admin, or no such test)', async () => {
    reply(null);
    expect(await getMockTestForEdit('t1')).toEqual({ ok: false, error: 'notFound' });
  });
});

const NO_TAGS = { subject: null, stream: null, yearLevels: [], anyYear: false };

describe('pass mark in createMockTest and updateMockTest', () => {
  it('sends the pass mark on create and on update', async () => {
    reply({ id: 'new' });
    await createMockTest({ title: 'Maths', instructions: '', passMark: 60, tags: NO_TAGS });
    expect(calls.find(([name]) => name === 'insert')?.[1][0]).toMatchObject({ pass_mark: 60 });

    calls.length = 0;
    reply({ id: 't1' });
    await updateMockTest('t1', { title: 'Maths', instructions: '', passMark: 75, tags: NO_TAGS });
    expect(calls.find(([name]) => name === 'update')?.[1][0]).toMatchObject({ pass_mark: 75 });
  });

  it('sends null to clear the pass mark of a draft', async () => {
    reply({ id: 't1' });
    await updateMockTest('t1', { title: 'Maths', instructions: '', passMark: null, tags: NO_TAGS });
    expect(calls.find(([name]) => name === 'update')?.[1][0]).toMatchObject({ pass_mark: null });
  });
});

describe('createMockTest and updateMockTest', () => {
  it('inserts the trimmed title and instructions and the tag columns, never an id', async () => {
    reply({ id: 'new' });
    expect(
      await createMockTest({
        title: '  Maths  ',
        instructions: ' Go ',
        passMark: null,
        tags: NO_TAGS,
      }),
    ).toEqual({
      ok: true,
      data: { id: 'new' },
    });
    expect(
      called('insert', {
        title: 'Maths',
        instructions: 'Go',
        pass_mark: null,
        subject: null,
        stream: null,
        year_levels: [],
        any_year: false,
      }),
    ).toBe(true);
  });

  it('sends the tags of a draft edit, years ascending', async () => {
    reply({ id: 't1' });
    const tags = { subject: 'maths', stream: 'icas', yearLevels: [8, 5], anyYear: false };
    expect(
      await updateMockTest('t1', { title: 'Maths', instructions: '', passMark: null, tags }),
    ).toEqual({
      ok: true,
      data: undefined,
    });
    expect(
      called('update', {
        title: 'Maths',
        instructions: '',
        pass_mark: null,
        subject: 'maths',
        stream: 'icas',
        year_levels: [5, 8],
        any_year: false,
      }),
    ).toBe(true);
  });

  it('maps a check-constraint refusal to invalidInput', async () => {
    reply(null, { code: '23514', message: 'violates check constraint' });
    expect(
      await createMockTest({ title: 'x', instructions: '', passMark: null, tags: NO_TAGS }),
    ).toEqual({
      ok: false,
      error: 'invalidInput',
    });
  });

  it('says mockReleased when a released test is edited', async () => {
    reply(null, { code: 'P0001', message: 'mock_released' });
    expect(
      await updateMockTest('t1', {
        title: 'Maths',
        instructions: '',
        passMark: null,
        tags: NO_TAGS,
      }),
    ).toEqual({
      ok: false,
      error: 'mockReleased',
    });
  });

  it('says notAllowed when the update matched no row', async () => {
    reply(null);
    expect(
      await updateMockTest('t1', {
        title: 'Maths',
        instructions: '',
        passMark: null,
        tags: NO_TAGS,
      }),
    ).toEqual({
      ok: false,
      error: 'notAllowed',
    });
  });
});

describe('deleteMockTest and deleteMockQuestion', () => {
  it('succeed when a row was deleted', async () => {
    reply({ id: 't1' });
    expect(await deleteMockTest('t1')).toEqual({ ok: true, data: undefined });
    reply({ id: 'q1' });
    expect(await deleteMockQuestion('q1')).toEqual({ ok: true, data: undefined });
  });

  it('say notAllowed when no row matched', async () => {
    reply(null);
    expect(await deleteMockTest('t1')).toEqual({ ok: false, error: 'notAllowed' });
    reply(null);
    expect(await deleteMockQuestion('q1')).toEqual({ ok: false, error: 'notAllowed' });
  });

  it('say mockReleased for a released test', async () => {
    reply(null, { message: 'mock_released' });
    expect(await deleteMockTest('t1')).toEqual({ ok: false, error: 'mockReleased' });
  });
});

describe('release and take back', () => {
  it('call the functions with the test id', async () => {
    reply(null);
    expect(await releaseMockTest('t1', null)).toEqual({ ok: true, data: undefined });
    reply(null);
    expect(await withdrawMockTest('t1')).toEqual({ ok: true, data: undefined });
    // No closing time: the argument is left out, so the database default (never closes) applies.
    expect(called('rpc', 'mock_release', { target: 't1' })).toBe(true);
    expect(called('rpc', 'mock_withdraw', { target: 't1' })).toBe(true);
  });

  it('release sends the closing time when there is one', async () => {
    reply(null);
    expect(await releaseMockTest('t1', '2026-12-01T09:00:00.000Z')).toEqual({
      ok: true,
      data: undefined,
    });
    expect(
      called('rpc', 'mock_release', { target: 't1', closes: '2026-12-01T09:00:00.000Z' }),
    ).toBe(true);
  });

  it.each([
    ['mock_no_questions', 'mockNoQuestions'],
    ['mock_has_attempts', 'mockHasAttempts'],
    ['invalid_status', 'invalidStatus'],
    ['not_found', 'notFound'],
    ['not_admin', 'notAllowed'],
  ])('maps %s to %s', async (raised, key) => {
    reply(null, { message: raised });
    expect(await releaseMockTest('t1', null)).toEqual({ ok: false, error: key });
  });
});

describe('updateMockTestTags', () => {
  it('sends only the four tag columns, years ascending', async () => {
    reply({ id: 't1' });
    expect(
      await updateMockTestTags('t1', {
        subject: 'english',
        stream: 'naplan',
        yearLevels: [9, 7],
        anyYear: false,
      }),
    ).toEqual({ ok: true, data: undefined });
    expect(
      called('update', {
        subject: 'english',
        stream: 'naplan',
        year_levels: [7, 9],
        any_year: false,
      }),
    ).toBe(true);
    expect(called('eq', 'id', 't1')).toBe(true);
  });

  it('says notAllowed when no row came back', async () => {
    reply(null);
    expect(
      await updateMockTestTags('t1', {
        subject: null,
        stream: null,
        yearLevels: [],
        anyYear: true,
      }),
    ).toEqual({ ok: false, error: 'notAllowed' });
  });

  it('names the field the database refused', async () => {
    reply(null, { code: '23514', message: 'invalid_mock_tag', hint: 'stream' });
    expect(
      await updateMockTestTags('t1', { subject: null, stream: 'x', yearLevels: [], anyYear: true }),
    ).toEqual({ ok: false, error: 'mockTagStream' });
  });
});

describe('closing date and close now', () => {
  it('sets, clears and closes through the functions', async () => {
    reply(null);
    expect(await setMockTestClosing('t1', '2026-12-01T09:00:00.000Z')).toEqual({
      ok: true,
      data: undefined,
    });
    reply(null);
    expect(await setMockTestClosing('t1', null)).toEqual({ ok: true, data: undefined });
    reply(null);
    expect(await closeMockTestNow('t1')).toEqual({ ok: true, data: undefined });
    expect(
      called('rpc', 'mock_set_closing', { target: 't1', closes: '2026-12-01T09:00:00.000Z' }),
    ).toBe(true);
    // Null is sent, not left out: the function has no default, and null clears the date.
    expect(called('rpc', 'mock_set_closing', { target: 't1', closes: null })).toBe(true);
    expect(called('rpc', 'mock_close_now', { target: 't1' })).toBe(true);
  });

  it.each([
    ['mock_closes_in_past', 'mockClosesInPast'],
    ['invalid_status', 'invalidStatus'],
    ['not_admin', 'notAllowed'],
  ])('maps %s to %s', async (raised, key) => {
    reply(null, { message: raised });
    expect(await setMockTestClosing('t1', null)).toEqual({ ok: false, error: key });
    reply(null, { message: raised });
    expect(await closeMockTestNow('t1')).toEqual({ ok: false, error: key });
  });

  it('maps the 404 not_found body to notFound', async () => {
    reply(null, { code: 'P0002', message: 'not_found' });
    expect(await closeMockTestNow('t1')).toEqual({ ok: false, error: 'notFound' });
  });
});

describe('saveMockQuestion', () => {
  const input = {
    testId: 't1',
    prompt: '  What?  ',
    options: [' a ', 'b'],
    correctOption: 1,
    explanation: ' ',
    marks: 1,
  };

  it('inserts a trimmed question without an id or position', async () => {
    reply({ id: 'q1' });
    expect(await saveMockQuestion(input)).toEqual({ ok: true, data: undefined });
    expect(
      called('insert', {
        test_id: 't1',
        prompt: 'What?',
        options: ['a', 'b'],
        correct_option: 1,
        explanation: '',
        marks: 1,
      }),
    ).toBe(true);
  });

  it('updates by id and never moves the question to another test', async () => {
    reply({ id: 'q1' });
    await saveMockQuestion({ ...input, id: 'q1' });
    expect(
      called('update', {
        prompt: 'What?',
        options: ['a', 'b'],
        correct_option: 1,
        explanation: '',
        marks: 1,
      }),
    ).toBe(true);
    expect(called('eq', 'id', 'q1')).toBe(true);
  });

  it('sends marks on insert and on update', async () => {
    reply({ id: 'q1' });
    await saveMockQuestion({ ...input, marks: 3 });
    expect(calls.find(([name]) => name === 'insert')?.[1][0]).toMatchObject({ marks: 3 });

    calls.length = 0;
    reply({ id: 'q1' });
    await saveMockQuestion({ ...input, id: 'q1', marks: 5 });
    expect(calls.find(([name]) => name === 'update')?.[1][0]).toMatchObject({ marks: 5 });
  });

  it('refuses a missing correct option without calling the database', async () => {
    expect(await saveMockQuestion({ ...input, correctOption: null })).toEqual({
      ok: false,
      error: 'invalidInput',
    });
    expect(calls).toEqual([]);
  });

  it.each([
    ['mock_too_many_questions', 'mockTooManyQuestions'],
    ['mock_released', 'mockReleased'],
  ])('maps %s to %s', async (raised, key) => {
    reply(null, { message: raised });
    expect(await saveMockQuestion(input)).toEqual({ ok: false, error: key });
  });
});

describe('moveMockQuestion', () => {
  it('calls mock_move_question with the step', async () => {
    reply(null);
    expect(await moveMockQuestion('q1', 1)).toEqual({ ok: true, data: undefined });
    expect(called('rpc', 'mock_move_question', { target: 'q1', step: 1 })).toBe(true);
  });

  it('maps invalid_input to invalidInput', async () => {
    reply(null, { code: '22023', message: 'invalid_input' });
    expect(await moveMockQuestion('q1', -1)).toEqual({ ok: false, error: 'invalidInput' });
  });
});

describe('listMyMockTests', () => {
  it('maps the taker list rows', async () => {
    reply([
      {
        id: 't1',
        title: 'Maths',
        question_count: 3,
        status: 'submitted',
        score: 2,
        total: 3,
        submitted_at: 's',
        released_at: 'r',
        closes_at: 'x',
        percentage: 67,
        passed: true,
        subject: 'maths',
        stream: 'vce',
        year_levels: [7, 8],
        any_year: false,
      },
    ]);
    expect(await listMyMockTests()).toEqual({
      ok: true,
      data: [
        {
          id: 't1',
          title: 'Maths',
          questionCount: 3,
          status: 'submitted',
          score: 2,
          total: 3,
          submittedAt: 's',
          closesAt: 'x',
          percentage: 67,
          passed: true,
          tags: { subject: 'maths', stream: 'vce', yearLevels: [7, 8], anyYear: false },
        },
      ],
    });
  });

  it('says notAllowed for someone who cannot take mock tests', async () => {
    reply(null, { code: '42501', message: 'not_taker' });
    expect(await listMyMockTests()).toEqual({ ok: false, error: 'notAllowed' });
  });
});

describe('getMyMockTest', () => {
  const base = {
    id: 't1',
    title: 'Maths',
    instructions: '',
    question_count: 1,
    total_marks: 3,
    pass_mark: 60,
    score: null,
    total: null,
    percentage: null,
    passed: null,
    submitted_at: null,
    tags: { subject: 'maths', stream: 'vce', year_levels: [7, 8], any_year: false },
  };

  it('returns the tags with the test', async () => {
    reply({ ...base, status: 'not_started', questions: [] });
    const result = await getMyMockTest('t1');
    expect(result.ok && result.data.tags).toEqual({
      subject: 'maths',
      stream: 'vce',
      yearLevels: [7, 8],
      anyYear: false,
    });
  });

  it('keeps the keys out while in progress', async () => {
    reply({
      ...base,
      status: 'in_progress',
      questions: [
        { id: 'q1', position: 4, prompt: 'P', options: ['a', 'b'], marks: 3, selected_option: 0 },
      ],
    });
    const result = await getMyMockTest('t1');
    expect(result.ok && result.data.questions[0]).toEqual({
      id: 'q1',
      position: 4,
      prompt: 'P',
      options: ['a', 'b'],
      selectedOption: 0,
      marks: 3,
    });
    expect(result.ok && 'correctOption' in result.data.questions[0]!).toBe(false);
  });

  it('carries the key and explanation after submit', async () => {
    reply({
      ...base,
      status: 'submitted',
      score: 1,
      total: 1,
      questions: [
        {
          id: 'q1',
          position: 1,
          prompt: 'P',
          options: ['a', 'b'],
          marks: 3,
          selected_option: 1,
          correct_option: 1,
          explanation: 'Because.',
          marks_earned: 3,
        },
      ],
    });
    const result = await getMyMockTest('t1');
    expect(result.ok && result.data.questions[0]).toMatchObject({
      correctOption: 1,
      explanation: 'Because.',
      marks: 3,
      marksEarned: 3,
    });
    expect(result.ok && result.data.score).toBe(1);
  });

  it('carries the test facts before submit, and no marksEarned', async () => {
    reply({
      ...base,
      status: 'in_progress',
      questions: [
        {
          id: 'q1',
          position: 1,
          prompt: 'P',
          options: ['a', 'b'],
          marks: 3,
          selected_option: null,
        },
      ],
    });
    const result = await getMyMockTest('t1');
    expect(result.ok && result.data).toMatchObject({
      totalMarks: 3,
      passMark: 60,
      percentage: null,
      passed: null,
    });
    expect(result.ok && 'marksEarned' in result.data.questions[0]!).toBe(false);
  });

  it('says notFound for a draft or unknown test', async () => {
    reply(null, { code: 'P0002', message: 'not_found' });
    expect(await getMyMockTest('t1')).toEqual({ ok: false, error: 'notFound' });
  });
});

describe('start, save and submit', () => {
  it('start calls mock_start', async () => {
    reply(null);
    expect(await startMockTest('t1')).toEqual({ ok: true, data: undefined });
    expect(called('rpc', 'mock_start', { target: 't1' })).toBe(true);
  });

  it('save sends the test, question and option', async () => {
    reply(null);
    expect(await saveMockAnswer('t1', 'q1', 0)).toEqual({ ok: true, data: undefined });
    expect(
      called('rpc', 'mock_save_answer', {
        target_test: 't1',
        target_question: 'q1',
        chosen_option: 0,
      }),
    ).toBe(true);
  });

  it.each([
    ['mock_not_started', 'mockNotStarted'],
    ['already_submitted', 'alreadySubmitted'],
    ['invalid_option', 'invalidInput'],
    ['invalid_question', 'notFound'],
  ])('save maps %s to %s', async (raised, key) => {
    reply(null, { message: raised });
    expect(await saveMockAnswer('t1', 'q1', 9)).toEqual({ ok: false, error: key });
  });

  it('submit returns the score and total', async () => {
    reply({ score: 2, total: 3, percentage: 67, passed: true });
    expect(await submitMockTest('t1')).toEqual({
      ok: true,
      data: { score: 2, total: 3, percentage: 67, passed: true },
    });
  });

  it('submit says mockNotStarted before a start', async () => {
    reply(null, { message: 'mock_not_started' });
    expect(await submitMockTest('t1')).toEqual({ ok: false, error: 'mockNotStarted' });
  });

  it('reports a dropped connection as network', async () => {
    reply(null, { name: 'AuthRetryableFetchError', message: 'Failed to fetch' });
    expect(await submitMockTest('t1')).toEqual({ ok: false, error: 'network' });
  });
});

describe('loaders for a viewer who may not use the page (BUG-2)', () => {
  it.each([
    ['listMockTestsAdmin', () => listMockTestsAdmin()],
    ['getMockTestForEdit', () => getMockTestForEdit('t1')],
    ['listMyMockTests', () => listMyMockTests()],
    ['getMyMockTest', () => getMyMockTest('t1')],
    ['getMockTestResults', () => getMockTestResults('t1')],
  ])('%s sends no request and says notAllowed', async (_name, load) => {
    viewer.allowed = false;

    expect(await load()).toEqual({ ok: false, error: 'notAllowed' });
    expect(calls).toEqual([]);
  });
});

describe('getMockTestResults', () => {
  const header = {
    id: 't1',
    title: 'Maths',
    status: 'released',
    closes_at: null,
    pass_mark: 60,
  };
  const row = (id: string, total_rows: number) => ({
    attempt_id: id,
    taker_name: id === 'a2' ? null : 'Ana',
    submitted_at: '2026-11-18T01:00:00Z',
    score: 3,
    total: 5,
    percentage: 60,
    passed: true,
    total_rows,
  });

  it('reads the header, then the function, and maps the rows', async () => {
    reply(header);
    reply([row('a1', 2), row('a2', 2)]);
    const result = await getMockTestResults('t1');
    expect(result).toEqual({
      ok: true,
      data: {
        testId: 't1',
        title: 'Maths',
        status: 'released',
        closesAt: null,
        passMark: 60,
        rows: [
          {
            attemptId: 'a1',
            takerName: 'Ana',
            submittedAt: '2026-11-18T01:00:00Z',
            score: 3,
            total: 5,
            percentage: 60,
            passed: true,
          },
          {
            attemptId: 'a2',
            takerName: null,
            submittedAt: '2026-11-18T01:00:00Z',
            score: 3,
            total: 5,
            percentage: 60,
            passed: true,
          },
        ],
        totalRows: 2,
      },
    });
    expect(called('rpc', 'mock_test_results', { target: 't1' })).toBe(true);
  });

  it('takes totalRows from the first row, which can exceed the rows returned', async () => {
    reply(header);
    reply([row('a1', 1500)]);
    const result = await getMockTestResults('t1');
    expect(result.ok && result.data.totalRows).toBe(1500);
  });

  it('gives 0 totalRows for zero rows', async () => {
    reply(header);
    reply([]);
    const result = await getMockTestResults('t1');
    expect(result.ok && result.data.rows).toEqual([]);
    expect(result.ok && result.data.totalRows).toBe(0);
  });

  it('says notFound when no header row comes back, without calling the function', async () => {
    reply(null);
    expect(await getMockTestResults('t1')).toEqual({ ok: false, error: 'notFound' });
    expect(calls.some(([name]) => name === 'rpc')).toBe(false);
  });

  it('maps a not_admin refusal from the function to notAllowed', async () => {
    reply(header);
    reply(null, { code: '42501', message: 'not_admin' });
    expect(await getMockTestResults('t1')).toEqual({ ok: false, error: 'notAllowed' });
  });

  it('maps a not_found refusal from the function to notFound', async () => {
    reply(header);
    reply(null, { code: 'P0002', message: 'not_found' });
    expect(await getMockTestResults('t1')).toEqual({ ok: false, error: 'notFound' });
  });
});
