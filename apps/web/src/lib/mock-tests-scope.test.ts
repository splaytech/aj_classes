// AC 29 (docs/delivery/2026-11-18-mock-test-closing): tags and filters appear on no public page,
// in no sitemap entry and in no e-mail. The tag components, MOCK_TAGS, MOCK_TEST_FILTERS and the
// mock test helpers may be used only by portal routes and components (and their own files).
// Scoring (docs/delivery/2026-11-18-mock-test-scoring AC 50): the same for the pass mark, the
// Pass / Not yet words and the admin Results page.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = path.join(import.meta.dirname, '..');
const NOTIFICATIONS = path.join(
  import.meta.dirname,
  '../../../../supabase/functions/notifications',
);

const TAG_NAMES =
  /\b(MockTagLine|MockTagFields|MockTagsDialog|MockTestFilters|MOCK_TAGS|MOCK_TEST_FILTERS|MOCK_SCORING|MOCK_RESULTS_PAGE|MOCK_PASS_LABELS|MockResultsTable|MockPassChip)\b/;
const MOCK_HELPERS = /from '@\/lib\/mock-tests'/;

// Where the names are defined or re-exported, besides the portal folders.
const OWN_FILES = [
  'constants/mock-tests.constants.ts',
  'components/portal/index.ts',
  'lib/mock-tests.ts',
  'lib/mock-tests.test.ts',
  'lib/mock-tests-scope.test.ts',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

function relative(file: string): string {
  return path.relative(SRC, file).split(path.sep).join('/');
}

function isPortal(file: string): boolean {
  const rel = relative(file);
  return (
    rel.startsWith('routes/portal/') ||
    rel.startsWith('components/portal/') ||
    OWN_FILES.includes(rel)
  );
}

describe('mock test tags stay in the portal (AC 29)', () => {
  const files = sourceFiles(SRC);

  it('are used only by portal routes and components', () => {
    const outside = files
      .filter((file) => !isPortal(file))
      .filter((file) => {
        const text = readFileSync(file, 'utf8');
        return TAG_NAMES.test(text) || MOCK_HELPERS.test(text);
      })
      .map(relative);
    expect(outside).toEqual([]);
  });

  it('are not in the sitemap source', () => {
    const routes = readFileSync(path.join(SRC, 'routes.ts'), 'utf8');
    expect(routes).not.toMatch(TAG_NAMES);
    expect(routes).not.toMatch(/mock_test|subject|stream/i);
  });

  it('are not in the e-mail templates', () => {
    for (const name of ['template.ts', 'copy.ts']) {
      const text = readFileSync(path.join(NOTIFICATIONS, name), 'utf8');
      expect(text).not.toMatch(TAG_NAMES);
      expect(text).not.toMatch(/mock_test|year_levels|any_year/);
    }
  });
});
