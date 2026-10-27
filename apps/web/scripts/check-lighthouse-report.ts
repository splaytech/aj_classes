// CLI: node scripts/check-lighthouse-report.ts <.lighthouseci folder>
// Writes the median-JS table (lighthouse-report.ts) to $GITHUB_STEP_SUMMARY when set, and to
// stdout. Exits 1 on any supabase.co request, on a result it can't read, or when the folder
// holds no result (an empty folder can't pass).

import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { medianScriptBytes, reportFor, summaryTable } from './lighthouse-report.ts';

function fail(message: string): never {
  console.error(`lighthouse-report: ${message}`);
  process.exit(1);
}

const folder = process.argv[2];
if (!folder || !existsSync(folder)) {
  fail(`no such folder: ${folder ?? '(none given)'}; give the .lighthouseci folder`);
}

const files = readdirSync(folder).filter((name) => /^lhr-.*\.json$/.test(name));
if (files.length === 0) {
  fail(`no lhr-*.json in ${folder}; run lhci autorun first`);
}

const reports = files.map((name) => {
  try {
    return reportFor(JSON.parse(readFileSync(join(folder, name), 'utf8')));
  } catch (error) {
    fail(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
});

const table = summaryTable(medianScriptBytes(reports));
const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) {
  appendFileSync(summaryFile, `${table}\n`);
}
process.stdout.write(`${table}\n`);

const supabaseRequests = reports.flatMap((report) => report.supabaseRequests);
process.stdout.write(
  `lighthouse-report: ${reports.length} runs, ${supabaseRequests.length} supabase.co requests\n`,
);
for (const url of supabaseRequests) {
  console.error(`  supabase.co request: ${url}`);
}
process.exit(supabaseRequests.length > 0 ? 1 : 0);
