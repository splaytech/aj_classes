// Finds the hosted Supabase project ref in a folder, so a gate build that was built against the
// hosted project can never be served or tested (AC-5.11, the N-02 method as a committed tool).

import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { HOSTED_PROJECT_REF } from './hosting-constants.ts';

const TEXT_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.html',
  '.json',
  '.yml',
  '.yaml',
  '.md',
  '.toml',
  '.txt',
  '.map',
]);

const SKIPPED_FOLDERS = new Set(['node_modules', 'playwright-report', 'test-results']);

function containsRef(file: string): boolean {
  return readFileSync(file, 'utf8').includes(HOSTED_PROJECT_REF);
}

/** Every text file under `folder`. Symlinks are never followed: pnpm links packages in. */
function listTextFiles(folder: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory() && !SKIPPED_FOLDERS.has(entry.name)) {
      files.push(...listTextFiles(path));
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

/**
 * Files under `root` whose text contains the hosted project ref, relative to `root` and sorted.
 * `root` may also be a single file, which is checked whatever its extension. Throws if `root`
 * doesn't exist, so a mistyped path can't pass.
 */
export function findHostedRefs(root: string): string[] {
  if (lstatSync(root).isFile()) {
    return containsRef(root) ? [root] : [];
  }
  return listTextFiles(root)
    .filter(containsRef)
    .map((file) => relative(root, file))
    .sort();
}
