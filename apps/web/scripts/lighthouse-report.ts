// Lighthouse CI results → the two checks the Lighthouse job adds after `lhci autorun` (03b §6.6):
//   1. no request to any supabase.co host (AC-6.14): neither one made (network-requests) nor one
//      the mirror's CSP blocked before it reached the network (inspector-issues). The mirror's
//      CSP names only the local origin, so a build pointed at a hosted project shows up only in
//      the second list;
//   2. the JavaScript transferred per page, as a median over the runs (AC-6.8, reported only).
// Pure: the CLI (check-lighthouse-report.ts) reads the files.

export type PageReport = { url: string; supabaseRequests: string[]; scriptTransferBytes: number };

const HOSTED_SUPABASE_HOST = 'supabase.co';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The `details.items` array of one audit, or null if the result doesn't have it. */
function auditItemsOrNull(
  lhr: Record<string, unknown>,
  auditId: string,
): Record<string, unknown>[] | null {
  const audits = lhr.audits;
  if (!isRecord(audits)) return null;
  const audit = audits[auditId];
  if (!isRecord(audit) || !isRecord(audit.details) || !Array.isArray(audit.details.items)) {
    return null;
  }
  return audit.details.items.filter(isRecord);
}

/** The `details.items` array of an optional audit, or [] if the result doesn't have it. */
function auditItems(lhr: Record<string, unknown>, auditId: string): Record<string, unknown>[] {
  return auditItemsOrNull(lhr, auditId) ?? [];
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
 * resource-summary "script" transferSize. Throws if it isn't an LHR, or if it has no
 * network-requests list (an errored audit would otherwise count zero requests and pass unseen).
 */
export function reportFor(lhr: unknown): PageReport {
  if (!isRecord(lhr) || typeof lhr.requestedUrl !== 'string') {
    throw new Error('not a Lighthouse result: no requestedUrl');
  }
  const requests = auditItemsOrNull(lhr, 'network-requests');
  if (requests === null) {
    throw new Error(`no network-requests list for ${lhr.requestedUrl}; the audit may have errored`);
  }
  const attempted = [...requests.map((item) => item.url), ...cspBlockedUrls(lhr)];
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
