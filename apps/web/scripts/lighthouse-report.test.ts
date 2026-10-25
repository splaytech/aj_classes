import { describe, expect, it } from 'vitest';

import { medianScriptBytes, reportFor, summaryTable } from './lighthouse-report.ts';

/** A Lighthouse result trimmed to the fields the report reads. */
function lhr(url: string, requestUrls: string[], scriptBytes: number) {
  return {
    requestedUrl: url,
    audits: {
      'network-requests': {
        details: { items: requestUrls.map((requestUrl) => ({ url: requestUrl })) },
      },
      'resource-summary': {
        details: {
          items: [
            { resourceType: 'total', transferSize: scriptBytes + 5000 },
            { resourceType: 'script', transferSize: scriptBytes },
          ],
        },
      },
    },
  };
}

const PAGE = 'http://127.0.0.1:4173/';

describe('reportFor', () => {
  it('finds a request to a supabase.co host', () => {
    const report = reportFor(
      lhr(PAGE, [PAGE, 'https://x.supabase.co/rest/v1/posts', `${PAGE}assets/a.js`], 1000),
    );
    expect(report.supabaseRequests).toEqual(['https://x.supabase.co/rest/v1/posts']);
  });

  it('finds none on a clean run, and reads the script transfer size', () => {
    const report = reportFor(lhr(PAGE, [PAGE, 'http://127.0.0.1:55321/rest/v1/posts'], 1234));
    expect(report).toEqual({ url: PAGE, supabaseRequests: [], scriptTransferBytes: 1234 });
  });

  it('copes with a result that has no audits', () => {
    expect(reportFor({ requestedUrl: PAGE })).toEqual({
      url: PAGE,
      supabaseRequests: [],
      scriptTransferBytes: 0,
    });
  });

  it('rejects something that is not a Lighthouse result', () => {
    expect(() => reportFor({ audits: {} })).toThrow('not a Lighthouse result');
    expect(() => reportFor(null)).toThrow('not a Lighthouse result');
  });
});

describe('medianScriptBytes', () => {
  it('takes the median of the runs for each page', () => {
    const other = 'http://127.0.0.1:4173/privacy';
    const reports = [
      reportFor(lhr(PAGE, [], 300)),
      reportFor(lhr(PAGE, [], 100)),
      reportFor(lhr(PAGE, [], 200)),
      reportFor(lhr(other, [], 10)),
      reportFor(lhr(other, [], 30)),
    ];
    expect(medianScriptBytes(reports)).toEqual({ [PAGE]: 200, [other]: 20 });
  });
});

describe('summaryTable', () => {
  it('shows each page by path, in KB', () => {
    expect(summaryTable({ [`${PAGE}programmes/vce`]: 2048 })).toContain(
      '| /programmes/vce | 2.0 |',
    );
  });
});
