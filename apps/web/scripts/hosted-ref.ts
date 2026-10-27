// Finds the hosted Supabase project ref in a folder, so a gate build that was built against the
// hosted project can never be served or tested (AC-5.11, the N-02 method as a committed tool).
// It fails closed: every regular file is read except known binary types, and a scan that read
// nothing counts as a failure, so an empty or mistyped folder can't pass.

import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { HOSTED_PROJECT_REF } from './hosting-constants.ts';

// Images and fonts can't carry a URL that code would call, and are large, so they're skipped.
const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.avif',
]);

const SKIPPED_FOLDERS = new Set(['node_modules', 'playwright-report', 'test-results']);

const REF_BYTES = Buffer.from(HOSTED_PROJECT_REF);

export type HostedRefScan = {
  /** Files read. */
  scanned: number;
  /** Files holding the ref, relative to the root and sorted (the root itself if it's a file). */
  hits: string[];
};

function containsRef(file: string): boolean {
  return readFileSync(file).includes(REF_BYTES);
}

/** Every regular, non-binary file under `folder`. Symlinks are never followed: pnpm links packages in. */
function listScannableFiles(folder: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory() && !SKIPPED_FOLDERS.has(entry.name)) {
      files.push(...listScannableFiles(path));
    } else if (entry.isFile() && !BINARY_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(path);
    }
  }
  return files;
}

/**
 * Scans `root` (a folder, or a single file checked whatever its type) for the hosted project ref.
 * Throws if `root` doesn't exist.
 */
export function scanForHostedRefs(root: string): HostedRefScan {
  if (lstatSync(root).isFile()) {
    return { scanned: 1, hits: containsRef(root) ? [root] : [] };
  }
  const files = listScannableFiles(root);
  const hits = files
    .filter(containsRef)
    .map((file) => relative(root, file))
    .sort();
  return { scanned: files.length, hits };
}

/** Why a scan must fail, or null if it passes. Shared by check-hosted-ref and serve-mirror. */
export function hostedRefProblem(root: string, scan: HostedRefScan): string | null {
  if (scan.scanned === 0) {
    return `scanned 0 files in ${root}; an empty folder can't prove anything`;
  }
  if (scan.hits.length > 0) {
    return `${scan.hits.length} files in ${root} contain the hosted project ref, e.g. ${scan.hits[0]}`;
  }
  return null;
}
