// Tests of the notifications ("work returned" email) edge function (design 03 §3.10).
//   1. Unit checks of the pure modules (transport, template, batch, secret), imported straight
//      from the function folder: Node strips the types, and Deno isn't installed locally.
//   2. End-to-end against the LOCAL stack and its Mailpit, calling the worker directly with the
//      local secret instead of waiting for cron. Nothing here can reach a real inbox.
// Run: pnpm db:start && pnpm test:functions   (or: node supabase/scripts/test-notifications.mjs)

import { check, finish } from './local-test-helpers.mjs';
import { processBatch } from '../functions/notifications/batch.ts';
import { secretMatches } from '../functions/notifications/secret.ts';
import { escapeHtml, renderWorkReturned } from '../functions/notifications/template.ts';
import {
  mailpitRequest,
  outcomeForStatus,
  pickTransport,
  resendRequest,
  sendEmail,
  shouldStopBatch,
} from '../functions/notifications/transport.ts';

const SITE = 'https://ajclasses.com.au';

function claimedRow(overrides = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    recipient_role: 'parent',
    email: 'parent@local.test',
    recipient_first_name: 'Priya',
    child_first_name: 'Aarav',
    assignment_id: '22222222-2222-2222-2222-222222222222',
    student_id: '33333333-3333-3333-3333-333333333333',
    assignment_title: 'Number patterns check',
    class_name: 'Year 7 Maths',
    ...overrides,
  };
}

async function unitChecks() {
  console.log('notifications: unit checks\n');

  // pickTransport: no default (AC-3.11, design §0.3)
  const envOf = (values) => (name) => values[name];
  check('EMAIL_TRANSPORT unset → no transport', pickTransport(envOf({})) === null);
  check(
    "EMAIL_TRANSPORT '' → no transport",
    pickTransport(envOf({ EMAIL_TRANSPORT: '' })) === null,
  );
  check(
    "EMAIL_TRANSPORT 'smtp' → no transport",
    pickTransport(envOf({ EMAIL_TRANSPORT: 'smtp' })) === null,
  );
  check(
    "EMAIL_TRANSPORT 'Resend' (wrong case) → no transport",
    pickTransport(envOf({ EMAIL_TRANSPORT: 'Resend', RESEND_API_KEY: 're_x' })) === null,
  );
  check(
    'resend without RESEND_API_KEY → no transport',
    pickTransport(envOf({ EMAIL_TRANSPORT: 'resend' })) === null,
  );
  check(
    'mailpit without MAILPIT_URL → no transport',
    pickTransport(envOf({ EMAIL_TRANSPORT: 'mailpit' })) === null,
  );
  check(
    'resend with a key → resend',
    pickTransport(envOf({ EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 're_x' }))?.kind === 'resend',
  );
  check(
    'mailpit with a URL → mailpit',
    pickTransport(envOf({ EMAIL_TRANSPORT: 'mailpit', MAILPIT_URL: 'http://mailpit:8025' }))
      ?.kind === 'mailpit',
  );

  // Request builders
  const message = { to: 'a@local.test', subject: 'S', html: '<p>H</p>', text: 'T' };
  const resend = resendRequest(message, 'outbox-id-1', 'test-key');
  const resendBody = JSON.parse(resend.init.body);
  check('Resend: POST to api.resend.com/emails', resend.url === 'https://api.resend.com/emails');
  check(
    'Resend: Idempotency-Key is the outbox id',
    resend.init.headers['Idempotency-Key'] === 'outbox-id-1',
  );
  check(
    'Resend: Authorization is Bearer <key>',
    resend.init.headers.Authorization === 'Bearer test-key',
  );
  check(
    'Resend: from AJ Classes on ajclasses.com.au, to the one recipient (AC-3.9)',
    resendBody.from === 'AJ Classes <hello@ajclasses.com.au>' &&
      resendBody.to.length === 1 &&
      resendBody.to[0] === 'a@local.test' &&
      resendBody.reply_to === 'hello@ajclasses.com.au',
  );
  const mailpit = mailpitRequest(message, 'outbox-id-1', 'http://mailpit:8025/');
  check('Mailpit: POST to /api/v1/send', mailpit.url === 'http://mailpit:8025/api/v1/send');
  check(
    'Mailpit: carries the outbox id as a header',
    JSON.parse(mailpit.init.body).Headers['Idempotency-Key'] === 'outbox-id-1',
  );

  // Outcomes
  check('200 → sent', outcomeForStatus(200).outcome === 'sent');
  check('429 → retry rate_limited', outcomeForStatus(429).reason === 'rate_limited');
  check('409 → retry server_error', outcomeForStatus(409).reason === 'server_error');
  check(
    '500 → retry server_error',
    outcomeForStatus(500).outcome === 'retry' && outcomeForStatus(500).reason === 'server_error',
  );
  check(
    '422 → failed rejected',
    outcomeForStatus(422).outcome === 'failed' && outcomeForStatus(422).reason === 'rejected',
  );
  check('Only rate_limited stops the batch', shouldStopBatch(outcomeForStatus(429)));
  check(
    'Other outcomes don’t stop the batch',
    ![200, 409, 500, 422].some((status) => shouldStopBatch(outcomeForStatus(status))),
  );

  // sendEmail: a thrown fetch is a network retry
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed');
  };
  const networkOutcome = await sendEmail({ kind: 'mailpit', baseUrl: 'http://x' }, message, 'id');
  globalThis.fetch = realFetch;
  check(
    'A fetch that throws → retry network',
    networkOutcome.outcome === 'retry' && networkOutcome.reason === 'network',
  );

  // Template (AC-3.3, AC-3.4, AC-3.6)
  const parentEmail = renderWorkReturned(claimedRow(), SITE);
  const studentEmail = renderWorkReturned(
    claimedRow({
      recipient_role: 'student',
      email: 'student@local.test',
      recipient_first_name: 'Aarav',
    }),
    `${SITE}/`,
  );
  check(
    "Parent subject: the child's first name and the title",
    parentEmail.subject === "Aarav's work has been marked: Number patterns check",
  );
  check(
    'Student subject: "Your work" and the title',
    studentEmail.subject === 'Your work has been marked: Number patterns check',
  );
  for (const [who, email] of [
    ['Parent', parentEmail],
    ['Student', studentEmail],
  ]) {
    check(
      `${who} email names the child, the title and the class, says marked, and has View feedback (AC-3.3)`,
      [email.text, email.html].every(
        (body) =>
          body.includes('Aarav') &&
          body.includes('Number patterns check') &&
          body.includes('Year 7 Maths') &&
          body.includes('marked') &&
          body.includes('View feedback'),
      ),
    );
    check(
      `${who} email links to Account → Notifications (AC-3.6)`,
      email.text.includes(`${SITE}/portal/account#notifications`) &&
        email.html.includes(`href="${SITE}/portal/account#notifications"`),
    );
    check(
      `${who} email has the AJ Classes header block and colours (AC-3.9)`,
      email.html.includes('background: #172554') &&
        email.html.includes('<strong>AJ</strong> Classes'),
    );
  }
  check(
    "Student's View feedback goes to their assignment page (AC-3.4)",
    studentEmail.html.includes(
      `href="${SITE}/portal/student/assignments/22222222-2222-2222-2222-222222222222"`,
    ),
  );
  check(
    "Parent's View feedback goes to the child's assignment page (AC-3.4)",
    parentEmail.html.includes(
      `href="${SITE}/portal/parent/children/33333333-3333-3333-3333-333333333333/assignments/22222222-2222-2222-2222-222222222222"`,
    ),
  );
  check(
    'Header label: Parents / Students',
    parentEmail.html.includes('Parents') && studentEmail.html.includes('Students'),
  );
  check('Greeting uses the first name', parentEmail.text.startsWith('Hi Priya,'));
  check(
    'No first name → "Hi,"',
    renderWorkReturned(claimedRow({ recipient_first_name: '' }), SITE).text.startsWith('Hi,\n'),
  );
  const hostile = renderWorkReturned(
    claimedRow({ assignment_title: '<script>alert(1)</script>', class_name: 'A & "B"' }),
    SITE,
  );
  check(
    'Every value is escaped in the HTML',
    !hostile.html.includes('<script>') &&
      hostile.html.includes('&lt;script&gt;') &&
      hostile.html.includes('A &amp; &quot;B&quot;'),
  );
  check('escapeHtml escapes quotes', escapeHtml(`'"`) === '&#39;&quot;');

  // Batch loop: record each row straight after its send; a 429 stops the batch
  const rows = ['r1', 'r2', 'r3', 'r4'].map((id) => claimedRow({ id }));
  const log = [];
  const replies = { r1: 200, r2: 429, r3: 200, r4: 200 };
  const counts = await processBatch(rows, {
    render: (row) => ({ ...message, to: row.id }),
    send: async (_message, id) => {
      log.push(`send ${id}`);
      return outcomeForStatus(replies[id]);
    },
    record: async (id, outcome) => {
      log.push(`record ${id} ${outcome.outcome}${outcome.reason ? ` ${outcome.reason}` : ''}`);
    },
    pause: async () => log.push('pause'),
  });
  check(
    'Each row is recorded before the next send, with a pause between sends',
    log.slice(0, 5).join(',') ===
      'send r1,record r1 sent,pause,send r2,record r2 retry rate_limited',
    log.join(','),
  );
  check(
    'A 429 stops the batch: the rest go back unsent as rate_limited retries',
    log.slice(5).join(',') === 'record r3 retry rate_limited,record r4 retry rate_limited' &&
      !log.includes('send r3'),
    log.join(','),
  );
  check(
    'Counts: 4 claimed, 1 sent, 3 retrying, 0 failed',
    JSON.stringify(counts) === JSON.stringify({ claimed: 4, sent: 1, retrying: 3, failed: 0 }),
    JSON.stringify(counts),
  );

  // Worker secret: no default
  check('Unset NOTIFY_WORKER_SECRET refuses', !secretMatches('anything', undefined));
  check('Empty NOTIFY_WORKER_SECRET refuses even an empty header', !secretMatches('', ''));
  check('Missing header refuses', !secretMatches(null, 'local-notify-secret'));
  check('Wrong secret refuses', !secretMatches('local-notify-secreT', 'local-notify-secret'));
  check('Different length refuses', !secretMatches('local', 'local-notify-secret'));
  check('Right secret passes', secretMatches('local-notify-secret', 'local-notify-secret'));
}

await unitChecks();
finish();
