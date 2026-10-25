// CLI: node scripts/check-hosted-ref.ts <path> [<path> …]
// Exits 1 if any path contains the hosted Supabase project ref, or doesn't exist (AC-5.11).

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { findHostedRefs } from './hosted-ref.ts';

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('check-hosted-ref: give at least one path, e.g. build/client');
  process.exit(1);
}

const missing = paths.filter((path) => !existsSync(path));
for (const path of missing) {
  console.error(`check-hosted-ref: no such path: ${path}`);
}

// Hits inside a folder come back relative to it; print them with the folder so they can be opened.
const hits = paths
  .filter((path) => existsSync(path))
  .flatMap((path) => findHostedRefs(path).map((hit) => (hit === path ? hit : join(path, hit))));
process.stdout.write(`check-hosted-ref: ${hits.length} files\n`);
for (const hit of hits) {
  process.stdout.write(`  ${hit}\n`);
}

process.exit(hits.length > 0 || missing.length > 0 ? 1 : 0);
