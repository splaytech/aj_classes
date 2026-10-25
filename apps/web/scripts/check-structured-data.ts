// CLI: node scripts/check-structured-data.ts <build/client>
// Checks the JSON-LD on every pre-rendered page (AC-6.9). Exits 1 on any problem, or if there's
// no home page, so an empty or wrong folder can't pass.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { checkPage, pageKindFor } from './structured-data.ts';

function htmlFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.isFile() && entry.name.endsWith('.html') ? [path] : [];
  });
}

const root = process.argv[2];
if (!root || !existsSync(root)) {
  console.error(`check-structured-data: no such folder: ${root ?? '(none given)'}`);
  process.exit(1);
}

const files = htmlFiles(root).map((file) => relative(root, file).split(sep).join('/'));
const problems = files.flatMap((file) => checkPage(file, readFileSync(join(root, file), 'utf8')));
const hasHome = files.some((file) => pageKindFor(file) === 'home');

process.stdout.write(`check-structured-data: ${files.length} pages, ${problems.length} problems\n`);
for (const problem of problems) {
  console.error(`  ${problem.file}: ${problem.message}`);
}
if (!hasHome) {
  console.error(`check-structured-data: no index.html in ${root}; is it a build?`);
}
process.exit(problems.length > 0 || !hasHome ? 1 : 0);
