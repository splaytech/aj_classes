// The database's copy of the mock test subjects and streams (private.mock_test_options) must equal
// the web constants (docs/delivery/2026-11-18-mock-test-closing 02-architecture §5, 03-design §7).
//
// It reads every migration in filename order and every block between `-- mock-test-options:begin`
// and `-- mock-test-options:end`, and replays the rows, last write winning per (kind, key):
//   ('kind','key')         switches a value on;
//   ('kind','key', false)  switches it off.
// Remove a value with a block of its own in a new migration, never by editing the seed block:
//   -- mock-test-options:begin
//   insert into private.mock_test_options (kind, key, active) values ('subject','writing', false)
//   on conflict (kind, key) do update set active = excluded.active;
//   -- mock-test-options:end

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  MOCK_TEST_STREAMS,
  MOCK_TEST_SUBJECTS,
  PROGRAMMES,
  PROGRAMME_SLUGS,
  SUBJECTS,
  YEAR_LEVELS,
} from '@/constants';

const MIGRATIONS = path.join(import.meta.dirname, '../../../../supabase/migrations');
const BLOCK = /-- mock-test-options:begin([\s\S]*?)-- mock-test-options:end/g;
const ROW = /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*(?:,\s*(true|false)\s*)?\)/g;

type Options = Map<string, boolean>; // "kind:key" → active

/** Replays the marked blocks of each migration text, in the order given. */
function replayOptions(migrations: readonly string[]): Options {
  const options: Options = new Map();
  for (const text of migrations) {
    for (const block of text.matchAll(BLOCK)) {
      for (const [, kind, key, active] of (block[1] ?? '').matchAll(ROW)) {
        options.set(`${kind}:${key}`, active !== 'false');
      }
    }
  }
  return options;
}

function activeKeys(options: Options, kind: string): string[] {
  return [...options]
    .filter(([id, active]) => active && id.startsWith(`${kind}:`))
    .map(([id]) => id.slice(kind.length + 1))
    .sort();
}

function migrationTexts(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(path.join(MIGRATIONS, name), 'utf8'));
}

describe('mock test options: database and web in step', () => {
  const options = replayOptions(migrationTexts());

  it('has the same active subjects as MOCK_TEST_SUBJECTS', () => {
    expect(activeKeys(options, 'subject')).toEqual(MOCK_TEST_SUBJECTS.map((s) => s.key).sort());
  });

  it('has the same active streams as MOCK_TEST_STREAMS', () => {
    expect(activeKeys(options, 'stream')).toEqual(MOCK_TEST_STREAMS.map((s) => s.key).sort());
  });

  it('uses only real subject keys and programme slugs', () => {
    const subjectKeys: string[] = SUBJECTS.map((subject) => subject.key);
    const slugs: string[] = Object.values(PROGRAMME_SLUGS);
    for (const key of activeKeys(options, 'subject')) expect(subjectKeys).toContain(key);
    for (const key of activeKeys(options, 'stream')) expect(slugs).toContain(key);
  });

  it('labels each stream with its programme menu label', () => {
    for (const stream of MOCK_TEST_STREAMS) {
      const programme = PROGRAMMES.items.find((item) => item.slug === stream.key);
      expect(stream.label).toBe(programme?.menuLabel);
    }
  });

  it('allows the same years as YEAR_LEVELS', () => {
    const all = migrationTexts().join('\n');
    const literal = /mock_tests_year_levels_valid check \(\s*year_levels <@ '\{([\d,]+)\}'/.exec(
      all,
    );
    expect(literal?.[1]?.split(',').map(Number)).toEqual([...YEAR_LEVELS]);
  });

  it('switches a key off when a later block says false', () => {
    const replayed = replayOptions([
      "-- mock-test-options:begin\nvalues ('subject','maths'), ('subject','writing')\n-- mock-test-options:end",
      "-- mock-test-options:begin\nvalues ('subject','writing', false)\n-- mock-test-options:end",
    ]);
    expect(activeKeys(replayed, 'subject')).toEqual(['maths']);
  });
});
