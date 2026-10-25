// The worker's send loop (design 03 §3.4.2), with its I/O passed in so the Node test script can
// run it without Deno or a network.
//   * One row at a time, recorded straight after its own send (review-2 round 2, finding 1b), so a
//     reclaimed row is never sent twice.
//   * A pause between sends keeps under Resend's default 2 requests a second.
//   * A rate_limited reply stops the batch: the rest go back to pending unsent, for the next kick
//     (review-3 finding 9).

import { shouldStopBatch } from './transport.ts';
import type { EmailMessage, SendOutcome } from './transport.ts';
import type { ClaimedRow } from './template.ts';

export type BatchCounts = { claimed: number; sent: number; retrying: number; failed: number };

export type BatchSteps = {
  render: (row: ClaimedRow) => EmailMessage;
  send: (message: EmailMessage, outboxId: string) => Promise<SendOutcome>;
  record: (outboxId: string, outcome: SendOutcome) => Promise<void>;
  pause: () => Promise<void>;
};

const RELEASED_UNSENT: SendOutcome = { outcome: 'retry', reason: 'rate_limited' };

function count(counts: BatchCounts, outcome: SendOutcome): void {
  if (outcome.outcome === 'sent') counts.sent += 1;
  else if (outcome.outcome === 'retry') counts.retrying += 1;
  else counts.failed += 1;
}

export async function processBatch(rows: ClaimedRow[], steps: BatchSteps): Promise<BatchCounts> {
  const counts: BatchCounts = { claimed: rows.length, sent: 0, retrying: 0, failed: 0 };
  for (const [index, row] of rows.entries()) {
    if (index > 0) await steps.pause();
    const outcome = await steps.send(steps.render(row), row.id);
    await steps.record(row.id, outcome);
    count(counts, outcome);

    if (shouldStopBatch(outcome)) {
      for (const unsent of rows.slice(index + 1)) {
        await steps.record(unsent.id, RELEASED_UNSENT);
        count(counts, RELEASED_UNSENT);
      }
      break;
    }
  }
  return counts;
}
