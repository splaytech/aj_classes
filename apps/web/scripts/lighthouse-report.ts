// Lighthouse CI results → the two checks the Lighthouse job adds after `lhci autorun` (03b §6.6):
//   1. no request to any supabase.co host (AC-6.14): neither one made (network-requests) nor one
//      the mirror's CSP blocked before it reached the network (inspector-issues). The mirror's
//      CSP names only the local origin, so a build pointed at a hosted project shows up only in
//      the second list;
//   2. the JavaScript transferred per page, as a median over the runs (AC-6.8, reported only).
// CLI: node scripts/lighthouse-report.ts <.lighthouseci folder>
// Writes a Markdown table to $GITHUB_STEP_SUMMARY when set, else stdout. Exits 1 on any
// supabase.co request, or when the folder holds no result (an empty folder can't pass).

import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type PageReport = { url: string; supabaseRequests: string[]; scriptTransferBytes: number };

const HOSTED_SUPABASE_HOST = 'supabase.co';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The `details.items` array of one audit, or [] if the result doesn't have it. */
function auditItems(lhr: Record<string, unknown>, auditId: string): Record<string, unknown>[] {
  const audits = lhr.audits;
  if (!isRecord(audits)) return [];
  const audit = audits[auditId];
  if (!isRecord(audit) || !isRecord(audit.details) || !Array.isArray(audit.details.items)) {
    return [];
  }
  return audit.details.items.filter(isRecord);
}

/** URLs the page tried to reach that its CSP blocked, from the inspector-issues audit. */
function cspBlockedUrls(lhr: Record<string, unknown>): unknown[] {
  return auditItems(lhr, 'inspector-issues').flatMap((issue) => {
    const subItems = issue.subItems;
    if (!isRecord(subItems) || !Array.isArray(subItems.items)) return [];
    return subItems.items.filter(isRecord).map((item) => item.url);
  });
}

/**
 * One LHR (Lighthouse result JSON) → its page report: every URL containing "supabase.co" that
 * the page requested or tried to (network-requests, plus CSP-blocked inspector-issues), and the
 * resource-summary "script" transferSize. Throws if it isn't an LHR.
 */
export function reportFor(lhr: unknown): PageReport {
  if (!isRecord(lhr) || typeof lhr.requestedUrl !== 'string') {
    throw new Error('not a Lighthouse result: no requestedUrl');
  }
  const attempted = [
    ...auditItems(lhr, 'network-requests').map((item) => item.url),
    ...cspBlockedUrls(lhr),
  ];
  const supabaseRequests = [
    ...new Set(
      attempted.filter(
        (url): url is string => typeof url === 'string' && url.includes(HOSTED_SUPABASE_HOST),
      ),
    ),
  ];
  const script = auditItems(lhr, 'resource-summary').find((item) => item.resourceType === 'script');
  const scriptTransferBytes = typeof script?.transferSize === 'number' ? script.transferSize : 0;
  return { url: lhr.requestedUrl, supabaseRequests, scriptTransferBytes };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

/** Median script bytes per URL across runs, for the step summary. */
export function medianScriptBytes(reports: PageReport[]): Record<string, number> {
  const bytesByUrl = new Map<string, number[]>();
  for (const report of reports) {
    bytesByUrl.set(report.url, [...(bytesByUrl.get(report.url) ?? []), report.scriptTransferBytes]);
  }
  return Object.fromEntries([...bytesByUrl].map(([url, bytes]) => [url, median(bytes)]));
}

/** The step summary: one row per page with its median JS in KB. */
export function summaryTable(medians: Record<string, number>): string {
  const rows = Object.entries(medians).map(
    ([url, bytes]) => `| ${new URL(url).pathname} | ${(bytes / 1024).toFixed(1)} |`,
  );
  return [
    '### JavaScript transferred per page (median)',
    '',
    '| Page | JS (KB) |',
    '| --- | ---: |',
    ...rows,
    '',
  ].join('\n');
}

function readReports(folder: string): PageReport[] {
  return readdirSync(folder)
    .filter((name) => /^lhr-.*\.json$/.test(name))
    .map((name) => reportFor(JSON.parse(readFileSync(join(folder, name), 'utf8'))));
}

function runCli(folder: string | undefined): number {
  if (!folder) {
    console.error('lighthouse-report: give the .lighthouseci folder');
    return 1;
  }
  const reports = readReports(folder);
  if (reports.length === 0) {
    console.error(`lighthouse-report: no lhr-*.json in ${folder}; run lhci autorun first`);
    return 1;
  }

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
  return supabaseRequests.length > 0 ? 1 : 0;
}

// Run only as a script, so the unit tests can import the functions above without side effects.
if (import.meta.main) {
  process.exit(runCli(process.argv[2]));
}
