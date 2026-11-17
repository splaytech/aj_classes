import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMockTest,
  deleteMockQuestion,
  deleteMockTest,
  getMockTestForEdit,
  getMyMockTest,
  listMockTestsAdmin,
  listMyMockTests,
  moveMockQuestion,
  releaseMockTest,
  saveMockAnswer,
  saveMockQuestion,
  startMockTest,
  submitMockTest,
  updateMockTest,
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

function reply(data: unknown, error: unknown = null) {
  replies.push({ data, error });
}

function called(method: string, ...args: unknown[]) {
  return calls.some(
    ([name, given]) => name === method && JSON.stringify(given) === JSON.stringify(args),
  );
}

beforeEach(() => {
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
    reply({ id: 't1', title: 'Maths', instructions: 'Go', status: 'draft' });
    reply([
      {
        id: 'q1',
        position: 1,
        prompt: 'P',
        options: ['a', 'b'],
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
        questions: [
          {
            id: 'q1',
            position: 1,
            prompt: 'P',
            options: ['a', 'b'],
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

describe('createMockTest and updateMockTest', () => {
  it('inserts only the trimmed title and instructions, never an id', async () => {
    reply({ id: 'new' });
    expect(await createMockTest({ title: '  Maths  ', instructions: ' Go ' })).toEqual({
      ok: true,
      data: { id: 'new' },
    });
    expect(called('insert', { title: 'Maths', instructions: 'Go' })).toBe(true);
  });

  it('maps a check-constraint refusal to invalidInput', async () => {
    reply(null, { code: '23514', message: 'violates check constraint' });
    expect(await createMockTest({ title: 'x', instructions: '' })).toEqual({
      ok: false,
      error: 'invalidInput',
    });
  });

  it('says mockReleased when a released test is edited', async () => {
    reply(null, { code: 'P0001', message: 'mock_released' });
    expect(await updateMockTest('t1', { title: 'Maths', instructions: '' })).toEqual({
      ok: false,
      error: 'mockReleased',
    });
  });

  it('says notAllowed when the update matched no row', async () => {
    reply(null);
    expect(await updateMockTest('t1', { title: 'Maths', instructions: '' })).toEqual({
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
    expect(await releaseMockTest('t1')).toEqual({ ok: true, data: undefined });
    reply(null);
    expect(await withdrawMockTest('t1')).toEqual({ ok: true, data: undefined });
    expect(called('rpc', 'mock_release', { target: 't1' })).toBe(true);
    expect(called('rpc', 'mock_withdraw', { target: 't1' })).toBe(true);
  });

  it.each([
    ['mock_no_questions', 'mockNoQuestions'],
    ['mock_has_attempts', 'mockHasAttempts'],
    ['invalid_status', 'invalidStatus'],
    ['not_found', 'notFound'],
    ['not_admin', 'notAllowed'],
  ])('maps %s to %s', async (raised, key) => {
    reply(null, { message: raised });
    expect(await releaseMockTest('t1')).toEqual({ ok: false, error: key });
  });
});

describe('saveMockQuestion', () => {
  const input = {
    testId: 't1',
    prompt: '  What?  ',
    options: [' a ', 'b'],
    correctOption: 1,
    explanation: ' ',
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
      }),
    ).toBe(true);
    expect(called('eq', 'id', 'q1')).toBe(true);
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
    score: null,
    total: null,
    submitted_at: null,
  };

  it('keeps the keys out while in progress', async () => {
    reply({
      ...base,
      status: 'in_progress',
      questions: [{ id: 'q1', position: 4, prompt: 'P', options: ['a', 'b'], selected_option: 0 }],
    });
    const result = await getMyMockTest('t1');
    expect(result.ok && result.data.questions[0]).toEqual({
      id: 'q1',
      position: 4,
      prompt: 'P',
      options: ['a', 'b'],
      selectedOption: 0,
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
          selected_option: 1,
          correct_option: 1,
          explanation: 'Because.',
        },
      ],
    });
    const result = await getMyMockTest('t1');
    expect(result.ok && result.data.questions[0]).toMatchObject({
      correctOption: 1,
      explanation: 'Because.',
    });
    expect(result.ok && result.data.score).toBe(1);
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
    reply({ score: 2, total: 3 });
    expect(await submitMockTest('t1')).toEqual({ ok: true, data: { score: 2, total: 3 } });
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
