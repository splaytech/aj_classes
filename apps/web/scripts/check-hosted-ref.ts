// CLI: node scripts/check-hosted-ref.ts <path> [<path> …]
// Exits 1 if any path contains the hosted Supabase project ref, doesn't exist, or holds no file
// to scan (AC-5.11).

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { hostedRefProblem, scanForHostedRefs } from './hosted-ref.ts';

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('check-hosted-ref: give at least one path, e.g. build/client');
  process.exit(1);
}

let failed = false;
let scanned = 0;
const hits: string[] = [];

for (const path of paths) {
  if (!existsSync(path)) {
    console.error(`check-hosted-ref: no such path: ${path}`);
    failed = true;
    continue;
  }
  const scan = scanForHostedRefs(path);
  scanned += scan.scanned;
  // Hits inside a folder come back relative to it; print them with the folder so they can be opened.
  hits.push(...scan.hits.map((hit) => (hit === path ? hit : join(path, hit))));
  const problem = hostedRefProblem(path, scan);
  if (problem) {
    console.error(`check-hosted-ref: ${problem}`);
    failed = true;
  }
}

process.stdout.write(`check-hosted-ref: ${hits.length} files (of ${scanned} scanned)\n`);
for (const hit of hits) {
  process.stdout.write(`  ${hit}\n`);
}

process.exit(failed ? 1 : 0);
