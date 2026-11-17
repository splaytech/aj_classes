// Mock tests (docs/delivery/2026-11-17-mock-tests). Admins write them as drafts and release them;
// students, parents and signed-up users take them once. The database is the gate: this module
// only calls it and names the problem when it refuses (design §3).

import { toErrorKey } from './auth-errors';
import {
  MOCK_QUESTION_COLUMNS,
  toMockAdminQuestion,
  toMockTestListItem,
  toMockTestSummary,
  toMockTestView,
} from './mock-tests-data';
import type { MockListRow, MockOpenJson, MockQuestionRow, MockSummaryRow } from './mock-tests-data';
import { attempt, fail, succeed } from './result';
import { getAdminClient, getTakerClient } from './staff-client';
import { getSupabase } from './supabase.client';
import type {
  MockQuestionInput,
  MockResult,
  MockTestDraftView,
  MockTestInput,
  MockTestListItem,
  MockTestStatus,
  MockTestSummary,
  MockTestView,
  Result,
} from './types';

// --- Admin --------------------------------------------------------------------------

export async function listMockTestsAdmin(): Promise<Result<MockTestSummary[]>> {
  return attempt(async () => {
    const supabase = await getAdminClient();
    if (!supabase) return fail('notAllowed'); // the layout shows the refusal; no request goes out
    const { data, error } = await supabase.rpc('mock_tests_admin_list');
    if (error) return fail(toErrorKey(error));
    return succeed((data as unknown as MockSummaryRow[]).map(toMockTestSummary));
  });
}

/** The test and its questions, with the correct options. Only admins get rows (RLS). */
export async function getMockTestForEdit(testId: string): Promise<Result<MockTestDraftView>> {
  return attempt(async () => {
    const supabase = await getAdminClient();
    if (!supabase) return fail('notAllowed'); // the layout shows the refusal; no request goes out
    const test = await supabase
      .from('mock_tests')
      .select('id, title, instructions, status')
      .eq('id', testId)
      .maybeSingle();
    if (test.error) return fail(toErrorKey(test.error));
    // No row is either no such test or not an admin (RLS): notFound's text covers both, neutrally.
    if (!test.data) return fail('notFound');

    const questions = await supabase
      .from('mock_test_questions')
      .select(MOCK_QUESTION_COLUMNS)
      .eq('test_id', testId)
      .order('position');
    if (questions.error) return fail(toErrorKey(questions.error));

    return succeed({
      id: test.data.id,
      title: test.data.title,
      instructions: test.data.instructions,
      status: test.data.status as MockTestStatus,
      questions: (questions.data as MockQuestionRow[]).map(toMockAdminQuestion),
    });
  });
}

export async function createMockTest(input: MockTestInput): Promise<Result<{ id: string }>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('mock_tests')
      .insert({ title: input.title.trim(), instructions: input.instructions.trim() })
      .select('id')
      .single();
    if (error) return fail(toErrorKey(error));
    return succeed({ id: data.id });
  });
}

export async function updateMockTest(testId: string, input: MockTestInput): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('mock_tests')
      .update({ title: input.title.trim(), instructions: input.instructions.trim() })
      .eq('id', testId)
      .select('id')
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    return data ? succeed() : fail('notAllowed');
  });
}

/** Drafts only: the database refuses a released test. */
export async function deleteMockTest(testId: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('mock_tests')
      .delete()
      .eq('id', testId)
      .select('id')
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    return data ? succeed() : fail('notAllowed');
  });
}

export async function releaseMockTest(testId: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('mock_release', { target: testId });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Back to draft; the database refuses once anyone has submitted (in-progress attempts are deleted). */
export async function withdrawMockTest(testId: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('mock_withdraw', { target: testId });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Adds a question (it goes last) or updates one. */
export async function saveMockQuestion(input: MockQuestionInput): Promise<Result> {
  if (input.correctOption === null) return fail('invalidInput');
  const columns = {
    prompt: input.prompt.trim(),
    options: input.options.map((option) => option.trim()),
    correct_option: input.correctOption,
    explanation: input.explanation.trim(),
  };

  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = input.id
      ? await supabase
          .from('mock_test_questions')
          .update(columns)
          .eq('id', input.id)
          .select('id')
          .maybeSingle()
      : await supabase
          .from('mock_test_questions')
          .insert({ test_id: input.testId, ...columns })
          .select('id')
          .maybeSingle();
    if (error) return fail(toErrorKey(error));
    return data ? succeed() : fail('notAllowed');
  });
}

export async function deleteMockQuestion(questionId: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('mock_test_questions')
      .delete()
      .eq('id', questionId)
      .select('id')
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    return data ? succeed() : fail('notAllowed');
  });
}

/** Swaps a question with the one above (-1) or below (+1). */
export async function moveMockQuestion(questionId: string, step: -1 | 1): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('mock_move_question', { target: questionId, step });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

// --- Takers: students, parents and signed-up users --------------------------------------

export async function listMyMockTests(): Promise<Result<MockTestListItem[]>> {
  return attempt(async () => {
    const supabase = await getTakerClient();
    if (!supabase) return fail('notAllowed'); // the layout shows the refusal; no request goes out
    const { data, error } = await supabase.rpc('mock_tests_for_me');
    if (error) return fail(toErrorKey(error));
    return succeed((data as unknown as MockListRow[]).map(toMockTestListItem));
  });
}

/** The answer keys are in the reply only after the person has submitted. */
export async function getMyMockTest(testId: string): Promise<Result<MockTestView>> {
  return attempt(async () => {
    const supabase = await getTakerClient();
    if (!supabase) return fail('notAllowed'); // the layout shows the refusal; no request goes out
    const { data, error } = await supabase.rpc('mock_test_open', { target: testId });
    if (error) return fail(toErrorKey(error));
    return succeed(toMockTestView(data as unknown as MockOpenJson));
  });
}

export async function startMockTest(testId: string): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('mock_start', { target: testId });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Saves one chosen option while the mock test isn't submitted yet (autosave). */
export async function saveMockAnswer(
  testId: string,
  questionId: string,
  option: number,
): Promise<Result> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('mock_save_answer', {
      target_test: testId,
      target_question: questionId,
      chosen_option: option,
    });
    return error ? fail(toErrorKey(error)) : succeed();
  });
}

/** Hands the mock test in. Questions left blank count as incorrect. */
export async function submitMockTest(testId: string): Promise<Result<MockResult>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('mock_submit', { target: testId });
    if (error) return fail(toErrorKey(error));
    return succeed(data as unknown as MockResult);
  });
}
