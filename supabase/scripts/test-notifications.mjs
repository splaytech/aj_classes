// Tests of the notifications edge function: "work returned" (design 03 §3.10), "new assignment"
// and "due tomorrow" (design 03b §8.10).
//   1. Unit checks of the pure modules (transport, template, batch, secret), imported straight
//      from the function folder: Node strips the types, and Deno isn't installed locally.
//   2. End-to-end against the LOCAL stack and its Mailpit, calling the worker directly with the
//      local secret instead of waiting for cron. Nothing here can reach a real inbox.
// Run: pnpm db:start && pnpm test:functions   (or: node supabase/scripts/test-notifications.mjs)

import { API, MAILPIT, api, check, finish, signIn, sql } from './local-test-helpers.mjs';
import { processBatch } from '../functions/notifications/batch.ts';
import { secretMatches } from '../functions/notifications/secret.ts';
import {
  LOCAL_WORKER_SECRET,
  gateRequest,
  isHostedProject,
  isUsableConfig,
} from '../functions/notifications/config.ts';
import { claimRows } from '../functions/notifications/claim.ts';
import { EMAIL_KINDS } from '../functions/notifications/copy.ts';
import {
  escapeHtml,
  formatDueDate,
  oneLine,
  renderDueTomorrow,
  renderEmail,
  renderNewAssignment,
  renderWorkReturned,
} from '../functions/notifications/template.ts';
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
    kind: 'work_returned',
    recipient_role: 'parent',
    email: 'parent@local.test',
    recipient_first_name: 'Priya',
    child_first_name: 'Aarav',
    assignment_id: '22222222-2222-2222-2222-222222222222',
    student_id: '33333333-3333-3333-3333-333333333333',
    assignment_title: 'Number patterns check',
    class_name: 'Year 7 Maths',
    due_on: '2026-10-30',
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
  check('rate_limited stops the batch', shouldStopBatch(outcomeForStatus(429)));
  check(
    'network stops the batch (a hanging provider would hit the 150 s limit)',
    shouldStopBatch({ outcome: 'retry', reason: 'network' }),
  );
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

  // A network error also stops the batch, releasing the rest as network retries
  const networkLog = [];
  const networkCounts = await processBatch(
    ['n1', 'n2', 'n3'].map((id) => claimedRow({ id })),
    {
      render: (row) => ({ ...message, to: row.id }),
      send: async (_message, id) => {
        networkLog.push(`send ${id}`);
        return { outcome: 'retry', reason: 'network' };
      },
      record: async (id, outcome) => networkLog.push(`record ${id} ${outcome.reason}`),
      pause: async () => networkLog.push('pause'),
    },
  );
  check(
    'A network error stops the batch after one send; the rest go back as network retries',
    networkLog.join(',') === 'send n1,record n1 network,record n2 network,record n3 network' &&
      networkCounts.retrying === 3,
    networkLog.join(','),
  );

  // Control characters can't reach the subject or body (Security finding 1)
  const injected = renderWorkReturned(
    claimedRow({
      assignment_title: 'Fractions\r\nBcc: x@y',
      child_first_name: 'Aa\nrav',
      class_name: 'Year\t7\u0085Maths',
      recipient_first_name: 'Pri\u0000ya',
    }),
    SITE,
  );
  check(
    'CR/LF in a title becomes a space in the subject: "…Fractions Bcc: x@y"',
    injected.subject === "Aa rav's work has been marked: Fractions Bcc: x@y",
    JSON.stringify(injected.subject),
  );
  check(
    'No control characters in the subject, and none in the text body apart from line breaks',
    !/[\u0000-\u001f\u007f-\u009f]/.test(injected.subject) &&
      !/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(injected.text) &&
      injected.text.includes('"Fractions Bcc: x@y" for Year 7 Maths') &&
      injected.text.startsWith('Hi Pri ya,'),
    JSON.stringify(injected.text.slice(0, 120)),
  );
  check(
    'oneLine leaves ordinary text alone',
    oneLine('Number patterns check') === 'Number patterns check',
  );

  // Local-only settings are refused on hosted, allowed locally (Security finding 2, review-5 R2-1)
  const HOSTED = 'https://unzjnxctkyahtmrkinyr.supabase.co';
  const LOCAL = 'http://kong:8000'; // what the local edge runtime gets as SUPABASE_URL
  const resendTransport = { kind: 'resend', apiKey: 're_x' };
  const mailpitTransport = { kind: 'mailpit', baseUrl: 'http://mailpit:8025' };
  const config = (overrides) => ({
    transport: resendTransport,
    workerSecret: 'a-long-random-secret',
    siteUrl: SITE,
    supabaseUrl: HOSTED,
    ...overrides,
  });
  check('https://<ref>.supabase.co is hosted', isHostedProject(HOSTED));
  check('http://kong:8000 is local', !isHostedProject(LOCAL));
  check('http://127.0.0.1:55321 is local', !isHostedProject('http://127.0.0.1:55321'));
  check('A missing SUPABASE_URL counts as hosted (fail safe)', isHostedProject(undefined));
  check('Hosted settings are usable', isUsableConfig(config({})));
  check(
    'Hosted + EMAIL_TRANSPORT=mailpit → set-up error',
    !isUsableConfig(config({ transport: mailpitTransport })),
  );
  check(
    'Hosted + the committed local worker secret → set-up error',
    !isUsableConfig(config({ workerSecret: LOCAL_WORKER_SECRET })),
  );
  check(
    'Hosted + an http SITE_URL → set-up error',
    !isUsableConfig(config({ siteUrl: 'http://localhost:5173' })),
  );
  check('Empty SITE_URL → set-up error', !isUsableConfig(config({ siteUrl: '' })));
  check(
    'Local Mailpit with the local secret and http://localhost is fine',
    isUsableConfig(
      config({
        transport: mailpitTransport,
        workerSecret: LOCAL_WORKER_SECRET,
        siteUrl: 'http://localhost:5173',
        supabaseUrl: LOCAL,
      }),
    ),
  );

  // Request order: an unset transport is the kill switch and wins over the secret check
  for (const where of [HOSTED, LOCAL]) {
    const place = where === HOSTED ? 'hosted' : 'local';
    check(
      `${place}: EMAIL_TRANSPORT unset → config_missing (503), even with no or a wrong secret`,
      gateRequest(config({ transport: null, supabaseUrl: where }), null) === 'config_missing' &&
        gateRequest(config({ transport: null, supabaseUrl: where }), 'wrong') ===
          'config_missing' &&
        gateRequest(config({ transport: null, supabaseUrl: where }), 'a-long-random-secret') ===
          'config_missing',
    );
  }
  check(
    'With a transport, a wrong secret → not_allowed (401)',
    gateRequest(config({}), 'wrong') === 'not_allowed',
  );
  check(
    'With a transport, no secret configured → not_allowed (401)',
    gateRequest(config({ workerSecret: undefined }), '') === 'not_allowed',
  );
  check(
    'Right secret but local values on hosted → config_missing (503)',
    gateRequest(
      config({ transport: mailpitTransport, workerSecret: LOCAL_WORKER_SECRET }),
      LOCAL_WORKER_SECRET,
    ) === 'config_missing',
  );
  check(
    'Right secret and hosted settings → ok',
    gateRequest(config({}), 'a-long-random-secret') === 'ok',
  );

  // Worker secret: no default
  check('Unset NOTIFY_WORKER_SECRET refuses', !secretMatches('anything', undefined));
  check('Empty NOTIFY_WORKER_SECRET refuses even an empty header', !secretMatches('', ''));
  check('Missing header refuses', !secretMatches(null, 'local-notify-secret'));
  check('Wrong secret refuses', !secretMatches('local-notify-secreT', 'local-notify-secret'));
  check('Different length refuses', !secretMatches('local', 'local-notify-secret'));
  check('Right secret passes', secretMatches('local-notify-secret', 'local-notify-secret'));
}

// "New assignment" and "due tomorrow" templates (AC-8.2, AC-8.9, AC-8.16)
const INSTRUCTIONS = 'Show your working zebra'; // never returned by the claim, so never in an email

function newKindUnitChecks() {
  console.log('\nnotifications: "new assignment" and "due tomorrow" unit checks\n');

  check(
    'formatDueDate: 2026-10-30 → "Friday 30 October"',
    formatDueDate('2026-10-30') === 'Friday 30 October',
    formatDueDate('2026-10-30'),
  );
  check(
    'formatDueDate: 2027-04-04 (a DST change) → "Sunday 4 April"',
    formatDueDate('2027-04-04') === 'Sunday 4 April',
    formatDueDate('2027-04-04'),
  );
  check('formatDueDate: no date → ""', formatDueDate(null) === '');
  check(
    'The claim offers every kind the worker can render',
    JSON.stringify(EMAIL_KINDS) ===
      JSON.stringify(['work_returned', 'new_assignment', 'due_tomorrow']),
  );

  const row = (overrides) => claimedRow({ instructions: INSTRUCTIONS, ...overrides });
  const student = {
    recipient_role: 'student',
    email: 'student@local.test',
    recipient_first_name: 'Aarav',
  };

  const parentNew = renderNewAssignment(row({ kind: 'new_assignment' }), SITE);
  const studentNew = renderNewAssignment(row({ kind: 'new_assignment', ...student }), SITE);
  check(
    'New assignment, parent subject: "New work for Aarav: <title>"',
    parentNew.subject === 'New work for Aarav: Number patterns check',
    parentNew.subject,
  );
  check(
    'New assignment, student subject: "New work set: <title>"',
    studentNew.subject === 'New work set: Number patterns check',
    studentNew.subject,
  );
  const parentNewBody = `Aarav's tutor has set "Number patterns check" for Year 7 Maths. It's due Friday 30 October.`;
  check(
    'New assignment, parent body names the child, title, class and due date (AC-8.2)',
    parentNew.text.includes(parentNewBody) && parentNew.html.includes(escapeHtml(parentNewBody)),
    parentNew.text,
  );
  check(
    'New assignment, student body (AC-8.2)',
    studentNew.text.includes(
      `Your tutor has set "Number patterns check" for Year 7 Maths. It's due Friday 30 October.`,
    ) && studentNew.text.startsWith('Hi Aarav,'),
    studentNew.text,
  );
  const noDue = renderNewAssignment(row({ kind: 'new_assignment', due_on: null }), SITE);
  check(
    'New assignment with no due date: no "It\'s due" sentence',
    !noDue.text.includes("It's due") &&
      noDue.text.includes(`Aarav's tutor has set "Number patterns check" for Year 7 Maths.\n`),
    noDue.text,
  );

  const parentDue = renderDueTomorrow(row({ kind: 'due_tomorrow' }), SITE);
  const studentDue = renderDueTomorrow(row({ kind: 'due_tomorrow', ...student }), SITE);
  check(
    'Due tomorrow, parent subject: "Aarav\'s work is due tomorrow: <title>"',
    parentDue.subject === "Aarav's work is due tomorrow: Number patterns check",
    parentDue.subject,
  );
  check(
    'Due tomorrow, student subject: "Due tomorrow: <title>"',
    studentDue.subject === 'Due tomorrow: Number patterns check',
    studentDue.subject,
  );
  check(
    'Due tomorrow, parent body: "is due tomorrow (Friday 30 October)" (AC-8.9)',
    parentDue.text.includes(
      `Aarav's "Number patterns check" for Year 7 Maths is due tomorrow (Friday 30 October) and hasn't been handed in yet.`,
    ),
    parentDue.text,
  );
  check(
    'Due tomorrow, student body (AC-8.9)',
    studentDue.text.includes(
      `"Number patterns check" for Year 7 Maths is due tomorrow (Friday 30 October) and hasn't been handed in yet.`,
    ),
    studentDue.text,
  );

  for (const [who, email, link] of [
    [
      'New assignment, parent',
      parentNew,
      `${SITE}/portal/parent/children/33333333-3333-3333-3333-333333333333/assignments/22222222-2222-2222-2222-222222222222`,
    ],
    [
      'New assignment, student',
      studentNew,
      `${SITE}/portal/student/assignments/22222222-2222-2222-2222-222222222222`,
    ],
    [
      'Due tomorrow, parent',
      parentDue,
      `${SITE}/portal/parent/children/33333333-3333-3333-3333-333333333333/assignments/22222222-2222-2222-2222-222222222222`,
    ],
    [
      'Due tomorrow, student',
      studentDue,
      `${SITE}/portal/student/assignments/22222222-2222-2222-2222-222222222222`,
    ],
  ]) {
    check(
      `${who}: "View assignment" button to the right page (AC-8.2)`,
      email.html.includes(`href="${link}"`) &&
        email.html.includes('>View assignment</a>') &&
        email.text.includes(`View assignment: ${link}`),
    );
    check(
      `${who}: footer links to Account → Notifications (AC-8.10)`,
      email.text.includes(`${SITE}/portal/account#notifications`),
    );
    check(
      `${who}: AJ Classes header block and colours (AC-8.16)`,
      email.html.includes('background: #172554') &&
        email.html.includes('<strong>AJ</strong> Classes'),
    );
    check(
      `${who}: no instructions, marks or "View feedback" (AC-8.2, AC-8.9)`,
      [email.text, email.html].every(
        (body) =>
          !body.includes(INSTRUCTIONS) &&
          !body.includes('marked') &&
          !body.includes('View feedback'),
      ),
    );
  }

  for (const kind of EMAIL_KINDS) {
    const expected = {
      work_returned: renderWorkReturned,
      new_assignment: renderNewAssignment,
      due_tomorrow: renderDueTomorrow,
    }[kind];
    const picked = renderEmail(row({ kind }), SITE);
    check(
      `renderEmail picks the ${kind} template`,
      picked.subject === expected(row({ kind }), SITE).subject,
    );
  }
  check(
    'renderEmail on a work_returned row is the item 3 email, unchanged',
    JSON.stringify(renderEmail(claimedRow(), SITE)) ===
      JSON.stringify(renderWorkReturned(claimedRow(), SITE)),
  );

  for (const kind of ['new_assignment', 'due_tomorrow']) {
    const hostile = renderEmail(
      row({
        kind,
        assignment_title: '<script>alert(1)</script>',
        class_name: 'A & "B"',
        child_first_name: 'Aa\r\nrav',
      }),
      SITE,
    );
    check(
      `${kind}: every value is escaped in the HTML, and line breaks can't reach the subject`,
      !hostile.html.includes('<script>') &&
        hostile.html.includes('&lt;script&gt;') &&
        hostile.html.includes('A &amp; &quot;B&quot;') &&
        !/[\r\n]/.test(hostile.subject),
      hostile.subject,
    );
  }
}

// ---------------------------------------------------------------------------
// End-to-end (local stack + Mailpit)
// ---------------------------------------------------------------------------

// No SQL passed to sql() may contain a dollar-quote: the helper wraps the query in double quotes
// for /bin/sh, which would expand it to its process id (design 03 §3.10).
// Both jobs that add or send rows: the 5-minute kick, and item 8's hourly reminder queue (whose
// 15:10 Melbourne run could otherwise add rows mid-test).
const CRON_JOB = "from cron.job where jobname in ('email-worker-kick', 'due-tomorrow-reminders')";
const setCronActive = (active) =>
  sql(`select cron.alter_job(jobid, active := ${active}) ${CRON_JOB}`);
const RECOVERY_COMMAND = `docker exec supabase_db_aj_classes psql -U postgres -c "select cron.alter_job(jobid, active := true) ${CRON_JOB}"`;

const LOCAL_SECRET = 'local-notify-secret'; // config.toml [edge_runtime.secrets], local only
const STUDENT = 'student@local.test';
const PARENT = 'parent@local.test';
const ANSWER_FEEDBACK = 'E2E answer feedback zebra';
const OVERALL_COMMENT = 'E2E overall comment quokka';

const callWorker = (secret = LOCAL_SECRET) =>
  api('/functions/v1/notifications', {
    body: {},
    headers: secret === null ? {} : { 'x-notify-secret': secret },
  });

async function mailpit(path, { method = 'GET' } = {}) {
  const response = await fetch(`${MAILPIT}${path}`, { method });
  const isJson = response.headers.get('content-type')?.includes('application/json');
  return isJson ? response.json() : response.text(); // DELETE answers a plain "ok"
}
const messagesTo = async (address) =>
  (await mailpit(`/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`)).messages;

// Aarav's seeded "Word problems set 1" (seed.sql v_word): handed in, waiting for marking.
function seededIds() {
  const [assignment, student] = sql(
    "select a.id || '|' || s.id from public.assignments a, public.students s where a.title = 'Word problems set 1' and s.full_name = 'Aarav Demo'",
  ).split('|');
  if (!assignment || !student)
    throw new Error('Seeded "Word problems set 1" for Aarav Demo not found');
  return { assignment, student };
}

// Puts v_word back as the seed left it, so the script can run again. As postgres with no session,
// the marking trigger treats this as a system change, not a staff one.
function restoreSeededWork({ assignment, student }) {
  const where = `assignment_id = '${assignment}' and student_id = '${student}'`;
  sql(`update public.assignment_results set status = 'submitted', feedback = '' where ${where}`);
  sql(
    `update public.assignment_answers set awarded_marks = null, feedback = '' where ${where} and question_id in (select id from public.assignment_questions where kind = 'written')`,
  );
  sql(`delete from public.email_outbox where assignment_id = '${assignment}'`);
}

const outboxFor = (assignment) =>
  sql(
    `select id || ':' || status from public.email_outbox where assignment_id = '${assignment}' order by id`,
  )
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, status] = line.split(':');
      return { id, status };
    });

async function returnAsTutor({ assignment, student }) {
  const tutor = await signIn('tutor@local.test');
  const written = sql(
    `select string_agg(id::text, ',' order by position) from public.assignment_questions where assignment_id = '${assignment}' and kind = 'written'`,
  ).split(',');
  const marks = [2.5, 1.5];
  for (const [index, question] of written.entries()) {
    await api(
      `/rest/v1/assignment_answers?assignment_id=eq.${assignment}&student_id=eq.${student}&question_id=eq.${question}`,
      {
        method: 'PATCH',
        token: tutor.access_token,
        body: { awarded_marks: marks[index], feedback: ANSWER_FEEDBACK },
      },
    );
  }
  return api(
    `/rest/v1/assignment_results?assignment_id=eq.${assignment}&student_id=eq.${student}`,
    {
      method: 'PATCH',
      token: tutor.access_token,
      headers: { Prefer: 'return=representation' },
      body: { status: 'returned', feedback: OVERALL_COMMENT },
    },
  );
}

async function endToEndChecks(ids) {
  console.log('\nnotifications: end-to-end (local stack, Mailpit)\n');

  // Drain what the seed queued (Aarav's returned "patterns" work), then start with an empty inbox.
  await callWorker();
  await mailpit('/api/v1/messages', { method: 'DELETE' });

  const returned = await returnAsTutor(ids);
  check(
    'The tutor returns Aarav’s online work through the API',
    returned.status === 200 && returned.json?.[0]?.status === 'returned',
    JSON.stringify(returned.json),
  );
  const queued = outboxFor(ids.assignment);
  check(
    'Two emails are queued: Aarav and his parent (AC-3.1)',
    queued.length === 2 && queued.every((row) => row.status === 'pending'),
    JSON.stringify(queued),
  );

  // AC-3.7: a wrong or missing secret sends nothing and loses nothing
  check('Worker with a wrong secret → 401', (await callWorker('wrong-secret')).status === 401);
  check('Worker with no secret header → 401', (await callWorker(null)).status === 401);
  check(
    'and the rows are still pending, nothing in Mailpit',
    outboxFor(ids.assignment).every((row) => row.status === 'pending') &&
      (await mailpit('/api/v1/messages')).total === 0,
  );
  check(
    'Worker refuses GET → 405',
    (await api('/functions/v1/notifications', { method: 'GET' })).status === 405,
  );

  const run = await callWorker();
  check(
    'The worker sends both',
    run.status === 200 && run.json?.data?.sent === 2 && run.json?.data?.failed === 0,
    JSON.stringify(run.json),
  );
  const sent = outboxFor(ids.assignment);
  check(
    'Each row is marked sent',
    sent.every((row) => row.status === 'sent'),
    JSON.stringify(sent),
  );

  const toStudent = await messagesTo(STUDENT);
  const toParent = await messagesTo(PARENT);
  check(`Exactly one email to ${STUDENT} (AC-3.1)`, toStudent.length === 1, `${toStudent.length}`);
  check(`Exactly one email to ${PARENT} (AC-3.1)`, toParent.length === 1, `${toParent.length}`);
  check('No other emails were sent', (await mailpit('/api/v1/messages')).total === 2);

  const sentIds = new Set(sent.map((row) => row.id));
  for (const [who, summary] of [
    ['student', toStudent[0]],
    ['parent', toParent[0]],
  ]) {
    if (!summary) continue;
    const message = await mailpit(`/api/v1/message/${summary.ID}`);
    const headers = await mailpit(`/api/v1/message/${summary.ID}/headers`);
    check(
      `The ${who} email is from AJ Classes <hello@ajclasses.com.au> (AC-3.9)`,
      message.From.Address === 'hello@ajclasses.com.au' && message.From.Name === 'AJ Classes',
    );
    check(
      `The ${who} email has the AJ Classes header and brand colours (AC-3.9)`,
      message.HTML.includes('<strong>AJ</strong> Classes') && message.HTML.includes('#172554'),
    );
    check(
      `The ${who} email's Idempotency-Key is its outbox row id`,
      sentIds.has(headers['Idempotency-Key']?.[0]),
      JSON.stringify(headers['Idempotency-Key']),
    );
    // What a reader sees: the text version, and the HTML without tags (styles) or entities. Once
    // the links and the title are taken out, no number is left, so no mark appears (AC-3.3).
    const visibleHtml = message.HTML.replaceAll(/<[^>]*>/g, ' ').replaceAll(/&#?\w+;/g, ' ');
    const readable = [message.Text, visibleHtml].map((body) =>
      body.replaceAll(/https?:\/\/[^\s"<]+/g, '').replaceAll('Word problems set 1', ''),
    );
    check(
      `The ${who} email has no mark and no feedback text (AC-3.3)`,
      readable.every(
        (body) =>
          !/\d/.test(body) && !body.includes(ANSWER_FEEDBACK) && !body.includes(OVERALL_COMMENT),
      ),
      readable.map((body) => body.match(/.{0,20}\d.{0,20}/)?.[0]).join(' | '),
    );
  }
  check(
    "The student's link opens their assignment page (AC-3.4)",
    toStudent[0] &&
      (await mailpit(`/api/v1/message/${toStudent[0].ID}`)).Text.includes(
        `/portal/student/assignments/${ids.assignment}`,
      ),
  );
  check(
    "The parent's link opens the child's assignment page (AC-3.4)",
    toParent[0] &&
      (await mailpit(`/api/v1/message/${toParent[0].ID}`)).Text.includes(
        `/portal/parent/children/${ids.student}/assignments/${ids.assignment}`,
      ),
  );

  // AC-3.5: calling the worker again sends nothing
  const again = await callWorker();
  check(
    'A second worker call sends nothing (AC-3.5)',
    again.status === 200 &&
      again.json?.data?.claimed === 0 &&
      (await mailpit('/api/v1/messages')).total === 2,
    JSON.stringify(again.json),
  );
}

// AC-8.1, AC-8.2: the tutor publishes the seeded "Ratio worksheet" draft, and Aarav and his parent
// get "new work" emails. Put back as a draft afterwards, with its outbox rows deleted.
const RATIO = "from public.assignments where title = 'Ratio worksheet'";
function restoreRatio() {
  sql(`update public.assignments set status = 'draft' where id = (select id ${RATIO})`);
  sql(`delete from public.email_outbox where assignment_id = (select id ${RATIO})`);
}

async function newAssignmentRoundTrip() {
  console.log('\nnotifications: "new assignment" round trip (local stack, Mailpit)\n');
  const [assignment, dueOn] = sql(`select id || '|' || due_on ${RATIO} and status = 'draft'`).split(
    '|',
  );
  if (!assignment) throw new Error('Seeded draft "Ratio worksheet" not found');
  await mailpit('/api/v1/messages', { method: 'DELETE' });

  const tutor = await signIn('tutor@local.test');
  const published = await api(`/rest/v1/assignments?id=eq.${assignment}`, {
    method: 'PATCH',
    token: tutor.access_token,
    headers: { Prefer: 'return=representation' },
    body: { status: 'published' },
  });
  check(
    'The tutor publishes "Ratio worksheet" through the API, with no error (AC-8.12)',
    published.status === 200 && published.json?.[0]?.status === 'published',
    JSON.stringify(published.json),
  );
  check(
    'Two "new assignment" emails are queued: Aarav and his parent (AC-8.1)',
    sql(
      `select string_agg(recipient_role || ':' || status, ',' order by recipient_role) from public.email_outbox where kind = 'new_assignment' and assignment_id = '${assignment}'`,
    ) === 'parent:pending,student:pending',
  );

  const run = await callWorker();
  check(
    'One worker run sends both',
    run.status === 200 && run.json?.data?.sent === 2 && run.json?.data?.failed === 0,
    JSON.stringify(run.json),
  );
  const toStudent = await messagesTo(STUDENT);
  const toParent = await messagesTo(PARENT);
  check(
    'One "new work" email each, and no others',
    toStudent.length === 1 &&
      toParent.length === 1 &&
      (await mailpit('/api/v1/messages')).total === 2,
  );
  const student = toStudent[0] && (await mailpit(`/api/v1/message/${toStudent[0].ID}`));
  const parent = toParent[0] && (await mailpit(`/api/v1/message/${toParent[0].ID}`));
  check(
    'Student subject: "New work set: Ratio worksheet"',
    student?.Subject === 'New work set: Ratio worksheet',
    student?.Subject,
  );
  check(
    'Parent subject: "New work for Aarav: Ratio worksheet"',
    parent?.Subject === 'New work for Aarav: Ratio worksheet',
    parent?.Subject,
  );
  for (const [who, message, path] of [
    ['student', student, `/portal/student/assignments/${assignment}`],
    ['parent', parent, `/portal/parent/children/`],
  ]) {
    if (!message) continue;
    check(
      `The ${who} email gives the class and the due date "${formatDueDate(dueOn)}" (AC-8.2)`,
      message.Text.includes('for Selective Entry Maths & Reasoning.') &&
        message.Text.includes(`It's due ${formatDueDate(dueOn)}.`),
      message.Text,
    );
    check(
      `The ${who} email's View assignment link opens the right page (AC-8.2)`,
      message.Text.includes('View assignment: ') &&
        message.Text.includes(path) &&
        message.Text.includes(`/assignments/${assignment}`),
    );
    check(
      `The ${who} email is from AJ Classes <hello@ajclasses.com.au>, with the header block (AC-8.16)`,
      message.From.Address === 'hello@ajclasses.com.au' &&
        message.From.Name === 'AJ Classes' &&
        message.HTML.includes('<strong>AJ</strong> Classes'),
    );
    check(
      `The ${who} email has no instructions or questions (AC-8.2)`,
      [message.Text, message.HTML].every(
        (body) => !body.includes('Simplify first') && !body.includes('Simplify the ratio'),
      ),
    );
  }
  const again = await callWorker();
  check(
    'A second worker call sends nothing more',
    again.json?.data?.claimed === 0,
    JSON.stringify(again.json),
  );
}

// AC-8.5, AC-8.9: Aarav hasn't started the seeded "Fractions quick quiz". Moved to due tomorrow,
// published 3 days ago, then one day's reminder queue and one worker run. Put back afterwards.
const FRACTIONS = "from public.assignments where title = 'Fractions quick quiz'";
let fractionsOriginal = null;
function restoreFractions() {
  if (fractionsOriginal === null) return;
  const [dueOn, publishedAt] = fractionsOriginal.split('|');
  sql(
    `update public.assignments set due_on = '${dueOn}', published_at = '${publishedAt}' where id = (select id ${FRACTIONS})`,
  );
  sql(
    `delete from public.email_outbox where kind = 'due_tomorrow' and assignment_id = (select id ${FRACTIONS})`,
  );
}

async function dueTomorrowRoundTrip() {
  console.log('\nnotifications: "due tomorrow" round trip (local stack, Mailpit)\n');
  fractionsOriginal = sql(
    `select due_on || '|' || published_at ${FRACTIONS} and status = 'published'`,
  );
  if (!fractionsOriginal) throw new Error('Seeded "Fractions quick quiz" not found');
  await mailpit('/api/v1/messages', { method: 'DELETE' });

  sql(
    `update public.assignments set due_on = private.melbourne_date(now()) + 1, published_at = now() - interval '3 days' where id = (select id ${FRACTIONS})`,
  );
  sql('select private.queue_due_tomorrow_emails_for(private.melbourne_date(now()))');
  const tomorrow = sql('select private.melbourne_date(now()) + 1');
  check(
    "One day's queue adds two reminders for the quiz: Aarav and his parent (AC-8.5)",
    sql(
      `select string_agg(a.title || ':' || o.recipient_role, ',' order by o.recipient_role) from public.email_outbox o join public.assignments a on a.id = o.assignment_id where o.kind = 'due_tomorrow' and o.status = 'pending'`,
    ) === 'Fractions quick quiz:parent,Fractions quick quiz:student',
  );

  const run = await callWorker();
  check(
    'One worker run sends both',
    run.status === 200 && run.json?.data?.sent === 2,
    JSON.stringify(run.json),
  );
  const toStudent = await messagesTo(STUDENT);
  const toParent = await messagesTo(PARENT);
  const student = toStudent[0] && (await mailpit(`/api/v1/message/${toStudent[0].ID}`));
  const parent = toParent[0] && (await mailpit(`/api/v1/message/${toParent[0].ID}`));
  check(
    'Student subject: "Due tomorrow: Fractions quick quiz"',
    student?.Subject === 'Due tomorrow: Fractions quick quiz',
    student?.Subject,
  );
  check(
    'Parent subject: "Aarav\'s work is due tomorrow: Fractions quick quiz"',
    parent?.Subject === "Aarav's work is due tomorrow: Fractions quick quiz",
    parent?.Subject,
  );
  for (const [who, message] of [
    ['student', student],
    ['parent', parent],
  ]) {
    if (!message) continue;
    check(
      `The ${who} reminder says "is due tomorrow (${formatDueDate(tomorrow)})" (AC-8.9)`,
      message.Text.includes(
        `is due tomorrow (${formatDueDate(tomorrow)}) and hasn't been handed in yet.`,
      ),
      message.Text,
    );
    check(
      `The ${who} reminder is from AJ Classes, with the header block, and has no instructions (AC-8.9, AC-8.16)`,
      message.From.Address === 'hello@ajclasses.com.au' &&
        message.HTML.includes('<strong>AJ</strong> Classes') &&
        !message.Text.includes('Four quick questions'),
    );
  }
}

// Security item 8 S2: the function deployed before the migration still sends "work returned".
async function claimFallbackChecks() {
  console.log('\nnotifications: claim, and the fallback to the old claim\n');
  const fakeClaim = (replies) => {
    const calls = [];
    const claim = async (args) => {
      calls.push(args === undefined ? 'no argument' : JSON.stringify(args));
      return replies.shift();
    };
    return { claim, calls };
  };
  const newRow = claimedRow({ kind: 'due_tomorrow' });
  const { kind: _kind, due_on: _dueOn, ...oldRow } = claimedRow();

  const normal = fakeClaim([{ data: [newRow], error: null }]);
  const normalResult = await claimRows(normal.claim);
  check(
    'New database: one claim, with every kind this worker can render',
    normal.calls.join('|') === JSON.stringify({ supported_kinds: [...EMAIL_KINDS] }) &&
      !normalResult.usedOldClaim &&
      normalResult.rows[0]?.kind === 'due_tomorrow',
    normal.calls.join('|'),
  );

  const old = fakeClaim([
    { data: null, error: { code: 'PGRST202' } },
    { data: [oldRow], error: null },
  ]);
  const oldResult = await claimRows(old.claim);
  check(
    'Old database (PGRST202): retries once with no argument',
    old.calls.length === 2 && old.calls[1] === 'no argument' && oldResult.usedOldClaim,
    old.calls.join('|'),
  );
  check(
    "and renders the old claim's rows as work returned, the only kind it has",
    oldResult.rows.length === 1 &&
      oldResult.rows[0].kind === 'work_returned' &&
      oldResult.rows[0].due_on === null &&
      JSON.stringify(renderEmail(oldResult.rows[0], SITE)) ===
        JSON.stringify(renderWorkReturned(claimedRow(), SITE)),
  );

  const refused = fakeClaim([{ data: null, error: { code: '42501' } }]);
  let refusedError = null;
  await claimRows(refused.claim).catch((error) => (refusedError = error));
  check(
    'Any other error is thrown, with no retry',
    refusedError?.code === '42501' && refused.calls.length === 1,
  );

  const bothFail = fakeClaim([
    { data: null, error: { code: 'PGRST202' } },
    { data: null, error: { code: 'PGRST000' } },
  ]);
  let fallbackError = null;
  await claimRows(bothFail.claim).catch((error) => (fallbackError = error));
  check(
    'A failed fallback is thrown too (the run fails; rows wait)',
    fallbackError?.code === 'PGRST000',
  );
}

await unitChecks();
newKindUnitChecks();
await claimFallbackChecks();

// Cron is paused, never removed, so a kick can't land mid-test (review-3 R2-1). The signal handlers
// come first, so a Ctrl-C at any point after this resumes it (review-3 R3-1).
console.log(
  `\nIf this run is interrupted, re-enable the email cron jobs with:\n  ${RECOVERY_COMMAND}\n(pnpm db:reset also restores it.)`,
);
for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
]) {
  process.on(signal, () => {
    setCronActive(true);
    console.log(`\nInterrupted: the email cron jobs are active again.`);
    process.exit(code);
  });
}
// Looked up before the pause, so a missing seed row fails while cron is still running.
const ids = seededIds();
try {
  setCronActive(false);
  restoreSeededWork(ids); // in case an earlier run was interrupted
  restoreRatio();
  await endToEndChecks(ids);
  await newAssignmentRoundTrip();
  await dueTomorrowRoundTrip();
} finally {
  // Resume first: if a restore throws, cron is already back on (review-5 finding 1).
  setCronActive(true);
  restoreSeededWork(ids);
  restoreRatio();
  restoreFractions();
}
check(
  'Both email cron jobs are active again',
  sql(`select count(*) filter (where active) || '/' || count(*) ${CRON_JOB}`) === '2/2',
);
console.log(`(${API} local stack only)`);
finish();
