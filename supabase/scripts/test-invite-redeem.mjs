// Tests of the 14-day invite link (ADR-0010; docs/delivery/2026-10-29-invite-14-days 03 §8.3):
//   1. Unit checks of the pure modules (token, invite email, issueInvite order, redeemInvite),
//      imported straight from the function folders: Node strips the types, and Deno isn't
//      installed locally.
//   2. End-to-end against the LOCAL stack: accounts made through account-admin, links read from
//      Mailpit, redeems through invite-redeem, the sign-in hop through Auth's /verify. Every
//      back-dating and set-up write is to the local database only (03 §8.1).
// Run: pnpm db:start && pnpm test:functions   (or: node supabase/scripts/test-invite-redeem.mjs)

import { createHash } from 'node:crypto';

import { execSync } from 'node:child_process';

import {
  API,
  SITE_ORIGIN,
  adminApi,
  adminTwoStepToken,
  api,
  check,
  finish,
  latestMailTo,
  mailpitText,
  signIn,
  sql,
} from './local-test-helpers.mjs';
import {
  INVITE_TOKEN_PATTERN,
  hashInviteToken,
  isInviteToken,
  newInviteToken,
} from '../functions/_shared/invite-token.ts';
import { INVITE_COPY } from '../functions/account-admin/invite-copy.ts';
import {
  inviteAudience,
  inviteLink,
  renderInviteEmail,
} from '../functions/account-admin/invite-email.ts';
import { issueInvite } from '../functions/account-admin/issue-invite.ts';
import { logRedeemOutcome, redeemInvite } from '../functions/invite-redeem/redeem.ts';

const SITE = 'http://localhost:5173';
const EXPIRY_LINE =
  'This link expires in 14 days and works once. If it has expired, ask AJ Classes to send you a new one.';
const LINK_PATTERN = /http:\/\/localhost:5173\/portal\/invite\?token=([A-Za-z0-9_-]{43})/;

function tokenUnitChecks() {
  console.log('\nUnit: invite token');
  const token = newInviteToken();
  check(
    'A new token is 43 characters of base64url',
    INVITE_TOKEN_PATTERN.test(token),
    token.length,
  );
  const many = new Set(Array.from({ length: 100 }, () => newInviteToken()));
  check('100 new tokens are all different', many.size === 100);
  check('isInviteToken accepts a new token', isInviteToken(token));
  check('isInviteToken refuses 42 characters', !isInviteToken('a'.repeat(42)));
  check('isInviteToken refuses 44 characters', !isInviteToken('a'.repeat(44)));
  for (const bad of ['+', '/', '=']) {
    check(`isInviteToken refuses "${bad}"`, !isInviteToken(`${'a'.repeat(42)}${bad}`));
  }
  for (const value of [null, undefined, 43, {}, ['a'.repeat(43)]]) {
    check(`isInviteToken refuses ${JSON.stringify(value) ?? 'undefined'}`, !isInviteToken(value));
  }
}

async function hashUnitChecks() {
  const token = newInviteToken();
  const hash = await hashInviteToken(token);
  check('The hash is 64 lower-case hex characters', /^[0-9a-f]{64}$/.test(hash));
  check(
    'The hash equals node:crypto SHA-256 of the token',
    hash === createHash('sha256').update(token).digest('hex'),
  );
}

function renderUnitChecks() {
  console.log('\nUnit: invite email');
  check(
    'tutor and admin get the staff wording',
    inviteAudience('tutor') === 'staff' && inviteAudience('admin') === 'staff',
  );
  check(
    'inviteLink trims trailing slashes',
    inviteLink('https://ajclasses.com.au//', 'abc') ===
      'https://ajclasses.com.au/portal/invite?token=abc',
  );

  const link = inviteLink(SITE, newInviteToken());
  const cases = [
    { role: 'tutor', label: 'Staff', intro: INVITE_COPY.intro.staff },
    { role: 'admin', label: 'Staff', intro: INVITE_COPY.intro.staff },
    { role: 'student', label: 'Students', intro: INVITE_COPY.intro.student },
    { role: 'parent', label: 'Parents', intro: INVITE_COPY.intro.parent },
  ];
  for (const { role, label, intro } of cases) {
    const email = renderInviteEmail({ to: `${role}@local.test`, role, link });
    check(`${role}: sent to the given address`, email.to === `${role}@local.test`);
    check(
      `${role}: subject "You're invited to the AJ Classes portal" (AC 28)`,
      email.subject === "You're invited to the AJ Classes portal",
    );
    check(
      `${role}: heading, label "${label}" and role wording (AC 28)`,
      email.html.includes('>You&#39;re invited to AJ Classes</h1>') &&
        email.html.includes(`&nbsp;${label}</span>`) &&
        email.text.includes(`${intro} ${INVITE_COPY.nextStep}`),
    );
    check(
      `${role}: Accept invite button links to the invite page (AC 28, 31)`,
      email.html.includes(`<a href="${link}"`) && email.html.includes('>Accept invite</a>'),
    );
    check(
      `${role}: the expiry line says 14 days, in HTML and text (AC 29)`,
      email.html.includes(EXPIRY_LINE) && email.text.includes(EXPIRY_LINE),
    );
    check(
      `${role}: nothing says 1 hour (AC 29)`,
      !email.html.includes('1 hour') && !email.text.includes('1 hour'),
    );
    check(
      `${role}: the ignore line is kept (AC 28)`,
      email.text.includes("If you didn't expect this email, you can ignore it.") &&
        email.html.includes('If you didn&#39;t expect this email, you can ignore it.'),
    );
    check(
      `${role}: the text part has the full link (AC 30)`,
      email.text.includes(`Accept invite: ${link}`),
    );
    check(
      `${role}: the link is the site's own page, not Supabase (AC 31)`,
      LINK_PATTERN.test(email.text) && !link.includes('supabase') && !link.includes('auth/confirm'),
    );
  }
}

const sent = { outcome: 'sent' };
const failedSend = { outcome: 'failed', reason: 'rejected' };
const retrySend = { outcome: 'retry', reason: 'network' };

function fakeSteps(sendOutcome, storeResult) {
  const calls = { messages: [], stored: [] };
  return {
    calls,
    steps: {
      send: async (message) => {
        calls.messages.push(message);
        return sendOutcome;
      },
      store: async (hash) => {
        calls.stored.push(hash);
        return storeResult;
      },
    },
  };
}

async function issueUnitChecks() {
  console.log('\nUnit: issueInvite order (send, then store)');
  const account = { id: 'id-1', email: 'someone@local.test', role: 'tutor' };

  for (const [name, outcome] of [
    ['failed', failedSend],
    ['retry', retrySend],
  ]) {
    const { calls, steps } = fakeSteps(outcome, true);
    const result = await issueInvite(account, SITE, steps);
    check(
      `Send ${name} → false, and nothing is stored (AC 21, 39)`,
      result === false && calls.messages.length === 1 && calls.stored.length === 0,
    );
  }

  const joined = fakeSteps(sent, false);
  check(
    'Send ok but store refused (joined meanwhile) → false',
    (await issueInvite(account, SITE, joined.steps)) === false && joined.calls.stored.length === 1,
  );

  const ok = fakeSteps(sent, true);
  check('Send ok and store ok → true', (await issueInvite(account, SITE, ok.steps)) === true);
  const [message] = ok.calls.messages;
  const token = message.text.match(LINK_PATTERN)?.[1] ?? '';
  check('The email goes to the account', message.to === account.email);
  check(
    'The stored hash is the hash of the token in the emailed link, never the token',
    ok.calls.stored[0] === (await hashInviteToken(token)) && ok.calls.stored[0] !== token,
  );
}

const ACCOUNT = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const NOW = Date.parse('2026-10-29T03:00:00Z');
const JUST_NOW = new Date(NOW - 5_000).toISOString();
const LONG_AGO = new Date(NOW - 3_600_000).toISOString();

/** Fake redeem I/O. `overrides` replaces any step; every call is recorded. */
function fakeRedeem(overrides = {}) {
  const calls = { claim: [], release: [], emailOf: [], recoveryLink: [], deleteUser: [] };
  const record = (name, fn) => async (arg) => {
    calls[name].push(arg);
    return fn(arg);
  };
  const steps = {
    claim: record('claim', overrides.claim ?? (() => ACCOUNT)),
    release: record('release', overrides.release ?? (() => undefined)),
    emailOf: record('emailOf', overrides.emailOf ?? (() => 'someone@local.test')),
    recoveryLink: record(
      'recoveryLink',
      overrides.recoveryLink ??
        (() => ({
          userId: ACCOUNT,
          userCreatedAt: LONG_AGO,
          verificationType: 'recovery',
          hashedToken: 'hop-hash',
        })),
    ),
    deleteUser: record('deleteUser', overrides.deleteUser ?? (() => undefined)),
    now: () => NOW,
  };
  return { calls, steps };
}

/** Runs fn with console.info/warn captured; returns the logged lines. */
async function captureLogs(fn) {
  const lines = [];
  const saved = { info: console.info, warn: console.warn };
  console.info = (...args) => lines.push({ level: 'info', text: args.join(' ') });
  console.warn = (...args) => lines.push({ level: 'warn', text: args.join(' ') });
  try {
    await fn();
  } finally {
    Object.assign(console, saved);
  }
  return lines;
}

async function redeemUnitChecks() {
  console.log('\nUnit: redeemInvite branches');
  const token = newInviteToken();
  const hash = await hashInviteToken(token);

  for (const bad of [undefined, null, 42, 'abc', 'a'.repeat(44), `${'a'.repeat(42)}=`]) {
    const { calls, steps } = fakeRedeem();
    const outcome = await redeemInvite(bad, steps);
    check(
      `Token ${JSON.stringify(bad) ?? 'undefined'} → refused shape, no database call`,
      outcome.reason === 'shape' && calls.claim.length === 0,
    );
  }

  const ok = fakeRedeem();
  const okOutcome = await redeemInvite(token, ok.steps);
  check(
    'A good link → ok with the recovery token hash only',
    okOutcome.kind === 'ok' &&
      okOutcome.tokenHash === 'hop-hash' &&
      Object.keys(okOutcome).length === 2,
  );
  check('The claim is by the SHA-256 of the token, never the token', ok.calls.claim[0] === hash);
  check('A success keeps the claim (no release)', ok.calls.release.length === 0);

  const limited = fakeRedeem({ claim: () => 'rate_limited' });
  const limitedOutcome = await redeemInvite(token, limited.steps);
  check(
    'Rate-limited claim → refused rate_limited, nothing else called',
    limitedOutcome.reason === 'rate_limited' &&
      limited.calls.emailOf.length === 0 &&
      limited.calls.release.length === 0,
  );
  const unclaimed = fakeRedeem({ claim: () => null });
  const unclaimedOutcome = await redeemInvite(token, unclaimed.steps);
  check(
    'Claim refused (used, expired, replaced, joined, inactive) → refused claim, no release',
    unclaimedOutcome.reason === 'claim' && unclaimed.calls.release.length === 0,
  );

  const claimThrows = fakeRedeem({ claim: () => Promise.reject(new Error('db down')) });
  const claimThrew = await redeemInvite(token, claimThrows.steps).then(
    () => false,
    () => true,
  );
  check(
    'A thrown claim propagates and releases nothing',
    claimThrew && claimThrows.calls.release.length === 0,
  );

  const noUser = fakeRedeem({ emailOf: () => null });
  const noUserOutcome = await redeemInvite(token, noUser.steps);
  check(
    'No auth user → refused no_user, claim released',
    noUserOutcome.reason === 'no_user' && noUser.calls.release[0] === hash,
  );

  const gone = fakeRedeem({ recoveryLink: () => null });
  const goneOutcome = await redeemInvite(token, gone.steps);
  check(
    'Deleted between claim and link (404) → refused not_found, released once',
    goneOutcome.reason === 'not_found' && gone.calls.release.length === 1,
  );

  const linkThrows = fakeRedeem({ recoveryLink: () => Promise.reject(new Error('auth down')) });
  const linkThrew = await redeemInvite(token, linkThrows.steps).then(
    () => false,
    () => true,
  );
  check(
    'A thrown recoveryLink propagates after one release',
    linkThrew && linkThrows.calls.release.length === 1,
  );

  const emailThrows = fakeRedeem({ emailOf: () => Promise.reject(new Error('auth down')) });
  const emailThrew = await redeemInvite(token, emailThrows.steps).then(
    () => false,
    () => true,
  );
  check(
    'A thrown emailOf propagates after one release',
    emailThrew && emailThrows.calls.release.length === 1,
  );

  console.log('\nUnit: identity check (03 §8.2 table)');
  const identityRows = [
    {
      name: 'another user, recovery, < 60 s',
      userId: OTHER,
      type: 'recovery',
      created: JUST_NOW,
      reason: 'mismatch',
      deletes: false,
    },
    {
      name: 'another user, recovery, older',
      userId: OTHER,
      type: 'recovery',
      created: LONG_AGO,
      reason: 'mismatch',
      deletes: false,
    },
    {
      name: 'another user, magiclink, < 60 s',
      userId: OTHER,
      type: 'magiclink',
      created: JUST_NOW,
      reason: 'stray_user_removed',
      deletes: true,
    },
    {
      name: 'another user, magiclink, older',
      userId: OTHER,
      type: 'magiclink',
      created: LONG_AGO,
      reason: 'mismatch',
      deletes: false,
    },
    {
      name: 'same user, magiclink',
      userId: ACCOUNT,
      type: 'magiclink',
      created: JUST_NOW,
      reason: 'mismatch',
      deletes: false,
    },
  ];
  for (const row of identityRows) {
    const fake = fakeRedeem({
      recoveryLink: () => ({
        userId: row.userId,
        userCreatedAt: row.created,
        verificationType: row.type,
        hashedToken: 'x',
      }),
    });
    let outcome;
    const logs = await captureLogs(async () => {
      outcome = await redeemInvite(token, fake.steps);
      logRedeemOutcome(outcome);
    });
    const deleted = fake.calls.deleteUser;
    check(
      `${row.name} → ${row.reason}, ${row.deletes ? 'deleteUser(that id)' : 'deleteUser never called'}, released once`,
      outcome.reason === row.reason &&
        (row.deletes ? deleted.length === 1 && deleted[0] === OTHER : deleted.length === 0) &&
        fake.calls.release.length === 1,
    );
    check(
      `${row.name}: logs a warning with the reason only, no id`,
      logs.length === 1 &&
        logs[0].level === 'warn' &&
        logs[0].text === `invite-redeem ${row.reason}` &&
        !logs[0].text.includes(OTHER) &&
        !logs[0].text.includes(ACCOUNT),
    );
  }

  console.log('\nUnit: logging (AC 8)');
  const okLogs = await captureLogs(() => logRedeemOutcome({ kind: 'ok', tokenHash: 'hop-hash' }));
  check(
    'ok logs "invite-redeem ok" at info, without the tokenHash',
    okLogs.length === 1 && okLogs[0].level === 'info' && okLogs[0].text === 'invite-redeem ok',
  );
  const claimLogs = await captureLogs(() => logRedeemOutcome({ kind: 'refused', reason: 'claim' }));
  check(
    'A claim refusal logs at info',
    claimLogs[0]?.level === 'info' && claimLogs[0].text === 'invite-redeem claim',
  );
  const limitLogs = await captureLogs(() =>
    logRedeemOutcome({ kind: 'refused', reason: 'rate_limited' }),
  );
  check(
    'rate_limited logs at warn',
    limitLogs[0]?.level === 'warn' && limitLogs[0].text === 'invite-redeem rate_limited',
  );
}

// ---------------------------------------------------------------------------------------------
// Integration (local stack)

const RUN = Date.now();
const CAPTCHA = { captcha_token: 'XXXX.DUMMY.TOKEN.XXXX' }; // Turnstile always-pass test secret
let addressCounter = 0;
// A fresh caller address per redeem keeps this run out of the shared local rate-limit bucket
// (local Kong keeps the leftmost x-forwarded-for, as test-leads.mjs relies on).
const freshAddress = () =>
  `10.${RUN % 250}.${Math.floor(addressCounter / 250) % 250}.${addressCounter++ % 250}`;

/** POST invite-redeem; returns the status and the raw body text, so refusals can be compared. */
async function redeem(
  body,
  { origin = SITE_ORIGIN, address = freshAddress(), method = 'POST', raw } = {},
) {
  const response = await fetch(`${API}/functions/v1/invite-redeem`, {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      'x-forwarded-for': address,
      'Content-Type': 'application/json',
    },
    body: method === 'POST' ? (raw ?? JSON.stringify(body)) : undefined,
  });
  const text = await response.text();
  return { status: response.status, text, json: text ? safeJson(text) : null };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The Auth sign-in hop the browser does: verify the recovery token, get a session. */
const verifyHop = (tokenHash) =>
  api('/auth/v1/verify', { body: { type: 'recovery', token_hash: tokenHash } });

const REFUSED = '{"ok":false,"code":"invite_invalid"}';
const refusedBodies = {};

function backdate(email, interval) {
  sql(
    `update private.invite_tokens t set sent_at = t.sent_at - interval '${interval}', expires_at = t.expires_at - interval '${interval}' from public.profiles p where p.id = t.profile_id and p.email = '${email}'`,
  );
  sql(
    `update public.profiles set invited_at = invited_at - interval '${interval}' where email = '${email}'`,
  );
}

async function tokenFromMail(email) {
  const mail = await latestMailTo(email);
  return {
    subject: mail?.Subject,
    token: (await mailpitText(mail.ID)).match(LINK_PATTERN)?.[1] ?? '',
  };
}

let admin;
const accountAdmin = (body) => api('/functions/v1/account-admin', { token: admin.aal2, body });

async function inviteStaff(label) {
  const email = `redeem-${RUN}-${label}@local.test`;
  const reply = await accountAdmin({ action: 'invite', email, fullName: `Redeem ${label}` });
  if (!reply.json?.ok) throw new Error(`invite ${label} failed: ${JSON.stringify(reply.json)}`);
  return { id: reply.json.data.userId, email, token: (await tokenFromMail(email)).token };
}

async function resend(account) {
  const reply = await accountAdmin({ action: 'resend-invite', userId: account.id });
  return { reply, token: (await tokenFromMail(account.email)).token };
}

/** Redeems and does the hop; true when Auth gave a session for exactly this account. */
async function signsInAs(account, token) {
  const reply = await redeem({ token });
  if (reply.json?.ok !== true) return false;
  const session = await verifyHop(reply.json.data.tokenHash);
  return session.status === 200 && session.json?.user?.id === account.id;
}

async function httpChecks() {
  console.log('\nIntegration: HTTP contract (03 §4.3)');
  const preflight = await fetch(`${API}/functions/v1/invite-redeem`, {
    method: 'OPTIONS',
    headers: { Origin: SITE_ORIGIN },
  });
  check('1. OPTIONS → 204', preflight.status === 204);
  const get = await redeem(null, { method: 'GET' });
  check(
    '2. GET → 405 method_not_allowed',
    get.status === 405 && get.json?.code === 'method_not_allowed',
  );
  const noOrigin = await redeem({ token: newInviteToken() }, { origin: null });
  check(
    '3. No Origin (a script) → 403 forbidden',
    noOrigin.status === 403 && noOrigin.json?.code === 'forbidden',
  );
  const otherOrigin = await redeem({ token: newInviteToken() }, { origin: 'https://evil.example' });
  check(
    '3. Another site → 403 forbidden',
    otherOrigin.status === 403 && otherOrigin.json?.code === 'forbidden',
  );
  const notJson = await redeem(null, { raw: 'not json' });
  check(
    '4. Body not JSON → 400 invalid_request',
    notJson.status === 400 && notJson.json?.code === 'invalid_request',
  );
  for (const [name, body] of [
    ['no token', {}],
    ['token is a number', { token: 42 }],
    ['"abc" (AC 10)', { token: 'abc' }],
  ]) {
    const reply = await redeem(body);
    check(
      `6. ${name} → 200 invite_invalid`,
      reply.status === 200 && reply.text === REFUSED,
      reply.text,
    );
    refusedBodies[`garbled: ${name}`] = reply;
  }
  const signedOut = await fetch(`${API}/functions/v1/invite-redeem`, {
    method: 'POST',
    headers: {
      Origin: SITE_ORIGIN,
      'Content-Type': 'application/json',
      'x-forwarded-for': freshAddress(),
    },
    body: JSON.stringify({ token: newInviteToken() }),
  });
  check(
    'No apikey or Authorization at all → still reaches the function (verify_jwt = false)',
    signedOut.status === 200,
  );
  console.log(
    'skip   7. 500 server_error needs a failing database or Auth: covered by the unit section (throw → release)',
  );
}

async function lifetimeChecks() {
  console.log('\nIntegration: lifetime (AC 1–4, 7, 16)');
  const samples = [
    ['13 days', true, 'AC 1'],
    ['13 days 23 hours', true, 'AC 2'],
    ['14 days 1 minute', false, 'AC 3'],
    ['15 days', false, 'AC 4'],
  ];
  for (const [interval, works, ac] of samples) {
    const account = await inviteStaff(`age-${interval.replaceAll(' ', '')}`);
    backdate(account.email, interval);
    if (works) {
      check(
        `${ac}: a link ${interval} old works and the hop signs in as that account`,
        await signsInAs(account, account.token),
      );
    } else {
      const reply = await redeem({ token: account.token });
      check(
        `${ac}: a link ${interval} old is refused`,
        reply.status === 200 && reply.text === REFUSED,
      );
      refusedBodies[`expired ${interval}`] = reply;
    }
    if (ac === 'AC 1') {
      const again = await redeem({ token: account.token });
      check('AC 7: the same link a second time is refused', again.text === REFUSED);
      refusedBodies.used = again;
      check(
        'S1: the hop left Auth invited_at alone and profiles.invited_at set (AC 40)',
        sql(
          `select (invited_at is not null)::text from public.profiles where id = '${account.id}'`,
        ) === 'true',
      );
    }
  }

  const later = await inviteStaff('resend-day10');
  backdate(later.email, '10 days');
  const fresh = await resend(later);
  backdate(later.email, '13 days');
  check(
    'AC 16: re-sent on day 10, the new link still works 13 days after the re-send',
    await signsInAs(later, fresh.token),
  );
  check(
    'AC 16: the day-0 link is refused',
    (await redeem({ token: later.token })).text === REFUSED,
  );
}

async function resendChecks() {
  console.log('\nIntegration: re-send and cancel (AC 12–15)');
  const staff = await inviteStaff('resend-staff');
  const second = await resend(staff);
  const third = await resend(staff);
  check(
    'AC 13: after two re-sends the first link is refused',
    (await redeem({ token: staff.token })).text === REFUSED,
  );
  const replaced = await redeem({ token: second.token });
  check('AC 13: and the second', replaced.text === REFUSED);
  refusedBodies.replaced = replaced;
  check('AC 12/13: only the newest link works (staff)', await signsInAs(staff, third.token));

  // Student and parent re-sends (AC 12)
  const studentId = sql(
    `insert into public.students (full_name, year_level) values ('Redeem Test ${RUN}', 8) returning id`,
  );
  await api('/rest/v1/rpc/admin_record_consent', {
    token: admin.aal2,
    body: { target_student: studentId },
  });
  const kidEmail = `redeem-${RUN}-kid@local.test`;
  const parentEmail = `redeem-${RUN}-parent@local.test`;
  const kidReply = await accountAdmin({ action: 'invite-student', studentId, email: kidEmail });
  const parentReply = await accountAdmin({
    action: 'invite-parent',
    studentId,
    email: parentEmail,
    fullName: 'Redeem Parent',
  });
  for (const [role, reply, email] of [
    ['student', kidReply, kidEmail],
    ['parent', parentReply, parentEmail],
  ]) {
    const account = {
      id: reply.json?.data?.userId,
      email,
      token: (await tokenFromMail(email)).token,
    };
    const next = await resend(account);
    check(
      `AC 12 (${role}): after a re-send the old link is refused`,
      (await redeem({ token: account.token })).text === REFUSED,
    );
    check(`AC 12 (${role}): and the new one signs in`, await signsInAs(account, next.token));
  }

  // AC 14: opened (e-mail now confirmed), setup never finished, then re-sent
  const halfway = await inviteStaff('halfway');
  check(
    'AC 14: the first link signs in (this confirms the e-mail)',
    await signsInAs(halfway, halfway.token),
  );
  check(
    'AC 14: the e-mail is now confirmed and the account still invited',
    sql(
      `select (u.email_confirmed_at is not null)::text || p.status from auth.users u join public.profiles p on p.id = u.id where u.id = '${halfway.id}'`,
    ) === 'trueinvited',
  );
  const halfwayResent = await resend(halfway);
  const halfwayMail = await tokenFromMail(halfway.email);
  check(
    'AC 14: the re-send is an invite email ("You\'re invited to the AJ Classes portal"), not a reset',
    halfwayResent.reply.json?.ok === true &&
      halfwayMail.subject === "You're invited to the AJ Classes portal" &&
      halfwayResent.token !== '',
  );
  check('AC 14: and its new link signs in again', await signsInAs(halfway, halfwayResent.token));

  // AC 15: cancel
  const cancelled = await inviteStaff('cancelled');
  await accountAdmin({ action: 'cancel-invite', userId: cancelled.id });
  const afterCancel = await redeem({ token: cancelled.token });
  check('AC 15: after Cancel invite the link is refused', afterCancel.text === REFUSED);
  check(
    'AC 15: and its token row is gone',
    sql(`select count(*) from private.invite_tokens where profile_id = '${cancelled.id}'`) === '0',
  );
  refusedBodies.cancelled = afterCancel;
}

async function stateChecks() {
  console.log('\nIntegration: joined and deactivated accounts (AC 17, 18)');
  const joined = await inviteStaff('joined');
  sql(`update public.profiles set status = 'active', joined_at = now() where id = '${joined.id}'`);
  const signInBefore = sql(
    `select coalesce(last_sign_in_at::text, 'never') from auth.users where id = '${joined.id}'`,
  );
  const joinedReply = await redeem({ token: joined.token });
  check(
    'AC 17: an unused link of an account that is now active is refused',
    joinedReply.text === REFUSED,
  );
  check(
    'AC 17: nobody was signed in',
    sql(
      `select coalesce(last_sign_in_at::text, 'never') from auth.users where id = '${joined.id}'`,
    ) === signInBefore,
  );
  refusedBodies.active = joinedReply;
  const password = `local-only-${RUN}-password`;
  // A real joined account confirmed its e-mail when it signed in to finish setup, so the fixture
  // confirms it too (03 §8.1 item 6 sets only the password).
  await adminApi(`/auth/v1/admin/users/${joined.id}`, {
    method: 'PUT',
    body: { password, email_confirm: true },
  });
  const passwordSignIn = await api('/auth/v1/token?grant_type=password', {
    body: { email: joined.email, password, gotrue_meta_security: CAPTCHA },
  });
  check(
    'AC 17: password sign-in still works',
    Boolean(passwordSignIn.json?.access_token),
    JSON.stringify({
      status: passwordSignIn.status,
      code: passwordSignIn.json?.error_code ?? passwordSignIn.json?.code,
    }),
  );

  const inactive = await inviteStaff('inactive');
  sql(`update public.profiles set is_active = false where id = '${inactive.id}'`);
  const inactiveReply = await redeem({ token: inactive.token });
  check("AC 18: a deactivated account's link is refused", inactiveReply.text === REFUSED);
  check(
    'AC 18: nobody was signed in',
    sql(
      `select coalesce(last_sign_in_at::text, 'never') from auth.users where id = '${inactive.id}'`,
    ) === 'never',
  );
  refusedBodies.inactive = inactiveReply;

  const unknown = await redeem({ token: newInviteToken() });
  refusedBodies.unknown = unknown;
  const changed = inactive.token.slice(0, 42) + (inactive.token.endsWith('A') ? 'B' : 'A');
  refusedBodies['garbled: one character changed'] = await redeem({ token: changed });
  refusedBodies['garbled: cut short'] = await redeem({ token: inactive.token.slice(0, 30) });
}

async function rateLimitChecks() {
  console.log('\nIntegration: rate limit (10 per 15 minutes per address)');
  const address = `10.250.${RUN % 250}.1`;
  const replies = [];
  for (let i = 0; i < 11; i += 1)
    replies.push(await redeem({ token: newInviteToken() }, { address }));
  check(
    '10 redeems from one address are answered',
    replies.slice(0, 10).every((reply) => reply.text === REFUSED),
  );
  check(
    'The 11th gets the identical refusal',
    replies[10].status === 200 && replies[10].text === REFUSED,
  );
  refusedBodies['rate-limited'] = replies[10];
  const account = await inviteStaff('after-limit');
  const blocked = await redeem({ token: account.token }, { address });
  check('A good link from the limited address is refused too', blocked.text === REFUSED);
  check(
    'The same good link still works from another address',
    await signsInAs(account, account.token),
  );
}

function sameRefusalCheck() {
  const names = Object.keys(refusedBodies);
  check(
    `AC 11: ${names.length} refusal kinds give byte-identical 200 replies (${names.join(', ')})`,
    names.length >= 12 &&
      names.every(
        (name) => refusedBodies[name].status === 200 && refusedBodies[name].text === REFUSED,
      ),
    names.filter((name) => refusedBodies[name].text !== REFUSED).join(', '),
  );
}

async function privateSchemaChecks() {
  console.log('\nIntegration: REST cannot reach private');
  const tutor = await signIn('tutor@local.test');
  for (const table of ['invite_tokens', 'invite_redeem_attempts']) {
    for (const [who, token] of [
      ['publishable key', undefined],
      ['signed-in tutor', tutor.access_token],
    ]) {
      const reply = await api(`/rest/v1/${table}`, {
        method: 'GET',
        token,
        headers: { 'Accept-Profile': 'private' },
      });
      check(
        `GET private.${table} as ${who} → 406 PGRST106`,
        reply.status === 406 && reply.json?.code === 'PGRST106',
      );
    }
  }
}

async function unknownEmailCheck() {
  const before = sql('select count(*) from auth.users');
  const reply = await adminApi('/auth/v1/admin/generate_link', {
    body: { type: 'recovery', email: `nobody-${RUN}@local.test` },
  });
  check(
    'generateLink recovery for an unknown e-mail → 404, and no user is created',
    reply.status === 404 && sql('select count(*) from auth.users') === before,
  );
}

async function failedResendCheck() {
  console.log('\nIntegration: S4b, a failed re-send changes nothing (AC 37, 39)');
  const account = await inviteStaff('failed-resend');
  const invitedAt = sql(`select invited_at from public.profiles where id = '${account.id}'`);
  const resentCount = () =>
    sql(
      `select count(*) from public.audit_log where action = 'invite_resent' and target_id = '${account.id}'`,
    );
  const resentBefore = resentCount();
  // Mailpit refuses this address (spike S4a: 400), the same as a provider refusing a send.
  sql(`update public.profiles set email = 'has space@local.test' where id = '${account.id}'`);
  try {
    const reply = await accountAdmin({ action: 'resend-invite', userId: account.id });
    check(
      'Re-send to an address the provider refuses → email_failed',
      reply.json?.code === 'email_failed',
      JSON.stringify(reply.json),
    );
  } finally {
    sql(`update public.profiles set email = '${account.email}' where id = '${account.id}'`);
  }
  check(
    'invited_at and the invite_resent count are unchanged',
    sql(`select invited_at from public.profiles where id = '${account.id}'`) === invitedAt &&
      resentCount() === resentBefore,
  );
  check(
    'The account is still there',
    sql(`select count(*) from auth.users where id = '${account.id}'`) === '1',
  );
  check('The previous link still works', await signsInAs(account, account.token));
}

function noLeakCheck(secrets) {
  console.log('\nIntegration: nothing secret in logs or audit (AC 8)');
  const logs = execSync('docker logs supabase_edge_runtime_aj_classes 2>&1', {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const audit = sql("select coalesce(string_agg(details::text, ' '), '') from public.audit_log");
  for (const [name, value] of Object.entries(secrets)) {
    check(
      `The ${name} is in neither the function logs nor audit_log`,
      !logs.includes(value) && !audit.includes(value),
    );
  }
}

async function leakProbe() {
  const account = await inviteStaff('leak');
  const reply = await redeem({ token: account.token });
  await verifyHop(reply.json?.data?.tokenHash);
  return {
    token: account.token,
    'token hash': await hashInviteToken(account.token),
    tokenHash: reply.json?.data?.tokenHash ?? 'missing',
  };
}

function cleanUp() {
  sql(`delete from auth.users where email like 'redeem-${RUN}-%'`);
  sql(`delete from public.students where full_name = 'Redeem Test ${RUN}'`);
}

async function integrationChecks() {
  admin = await adminTwoStepToken();
  try {
    await httpChecks();
    await lifetimeChecks();
    await resendChecks();
    await stateChecks();
    await rateLimitChecks();
    sameRefusalCheck();
    await privateSchemaChecks();
    await unknownEmailCheck();
    await failedResendCheck();
    noLeakCheck(await leakProbe());
  } finally {
    cleanUp();
  }
  check(
    'Clean-up left no test accounts',
    sql(`select count(*) from auth.users where email like 'redeem-${RUN}-%'`) === '0',
  );
}

async function main() {
  tokenUnitChecks();
  await hashUnitChecks();
  renderUnitChecks();
  await issueUnitChecks();
  await redeemUnitChecks();
  console.log('\ninvite-redeem edge function (local)');
  await integrationChecks();
  console.log('(http://127.0.0.1:55321 local stack only)');
  finish();
}

await main();
