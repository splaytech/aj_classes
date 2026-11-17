// Guards for the scoring migration (docs/delivery/2026-11-18-mock-test-scoring 03-design §8):
// its limits equal the web constants, it writes mock_test_attempts only in mock_submit, and it
// leaves the functions it does not change alone.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MOCK_TEST_LIMITS, QUESTION_LIMITS } from '@/constants';

const MIGRATION = path.join(
  import.meta.dirname,
  '../../../../supabase/migrations/20261121100000_mock_test_scoring.sql',
);
const sql = readFileSync(MIGRATION, 'utf8');

/** The two numbers of `<column> between A and B` in the migration. */
function rangeOf(column: string): [number, number] {
  const match = new RegExp(`${column} between (\\d+) and (\\d+)`).exec(sql);
  if (!match) throw new Error(`no range for ${column}`);
  return [Number(match[1]), Number(match[2])];
}

function statementsOn(table: string, verb: RegExp): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .filter((line) => verb.test(line) && line.includes(table));
}

describe('mock test scoring migration', () => {
  it('has the same limits as the web constants', () => {
    expect(rangeOf('marks')).toEqual([QUESTION_LIMITS.marksMin, QUESTION_LIMITS.marksMax]);
    expect(rangeOf('pass_mark')).toEqual([
      MOCK_TEST_LIMITS.passMarkMin,
      MOCK_TEST_LIMITS.passMarkMax,
    ]);
  });

  it('updates mock_test_attempts exactly once, inside mock_submit (AC 41)', () => {
    const table = 'public.mock_test_attempts';
    expect(statementsOn(table, /\bupdate\b/i)).toHaveLength(1);

    const submitStart = sql.indexOf('create or replace function public.mock_submit');
    const submitEnd = sql.indexOf('create or replace function', submitStart + 1);
    const updateAt = sql.indexOf(`update ${table}`);
    expect(submitStart).toBeGreaterThan(-1);
    expect(updateAt).toBeGreaterThan(submitStart);
    expect(updateAt).toBeLessThan(submitEnd);
  });

  it('never inserts into, deletes from or alters mock_test_attempts (AC 41)', () => {
    const table = 'public.mock_test_attempts';
    expect(statementsOn(table, /\binsert\s+into\b/i)).toEqual([]);
    expect(statementsOn(table, /\bdelete\s+from\b/i)).toEqual([]);
    expect(statementsOn(table, /\balter\s+table\b/i)).toEqual([]);
  });

  it.each(['mock_release', 'mock_start', 'mock_save_answer'])('does not replace %s', (name) => {
    expect(sql).not.toMatch(new RegExp(`create or replace function public\\.${name}\\b`, 'i'));
  });
});
