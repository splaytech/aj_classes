// Integration tests of open sign-up (ADR-0011; docs/delivery/2026-11-13-open-sign-up 03 §10 "INT")
// against the LOCAL stack: Auth's own endpoints, Mailpit, account-admin and the local database.
// Every set-up write (planted cap rows, the switch, back-dating) goes to the local database only.
// Run: pnpm db:start && pnpm test:functions   (or: node supabase/scripts/test-open-sign-up.mjs)

import { createRequire } from 'node:module';
import path from 'node:path';

import {
  API,
  MAILPIT,
  SITE_ORIGIN,
  adminApi,
  adminTwoStepToken,
  api,
  check,
  finish,
  latestMailTo,
  mailpitText,
  mailsTo,
  signIn,
  sql,
} from './local-test-helpers.mjs';

const RUN = Date.now();
const CAPTCHA = { captcha_token: 'XXXX.DUMMY.TOKEN.XXXX' }; // Turnstile always-pass test secret
const PREFIX = `osu-${RUN}`;
const INVITE_LINK = /http:\/\/localhost:5173\/portal\/invite#token=([A-Za-z0-9_-]{43})/;
const SEED_ACCOUNTS = [
  'admin@local.test',
  'newadmin@local.test',
  'tutor@local.test',
  'parent@local.test',
  'student@local.test',
  'user@local.test',
];

// supabase-js as the portal uses it (apps/web's copy), to see what the browser sees (S1(b)).
const { createClient } = createRequire(
  path.join(import.meta.dirname, '../../apps/web/package.json'),
)('@supabase/supabase-js');
const PUBLISHABLE_KEY = JSON.parse(
  (await import('node:child_process')).execSync('supabase status -o json', { encoding: 'utf8' }),
).PUBLISHABLE_KEY;
const browserClient = () =>
  createClient(API, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let admin;
const accountAdmin = (body) => api('/functions/v1/account-admin', { token: admin.aal2, body });
const address = (label) => `${PREFIX}-${label}@local.test`;

/** Redeems an invite token the way /portal/invite does, then the Auth hop. True on a session. */
async function invitedSignsIn(email, userId) {
  const mail = await latestMailTo(email);
  const token = (await mailpitText(mail.ID)).match(INVITE_LINK)?.[1] ?? '';
  const redeem = await fetch(`${API}/functions/v1/invite-redeem`, {
    method: 'POST',
    headers: { Origin: SITE_ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const reply = await redeem.json();
  if (reply.ok !== true) return false;
  const hop = await api('/auth/v1/verify', {
    body: { type: 'recovery', token_hash: reply.data.tokenHash },
  });
  return hop.status === 200 && hop.json?.user?.id === userId;
}

async function existingAccountChecks() {
  console.log('\nAC-42: confirmations on, nobody locked out');
  for (const email of SEED_ACCOUNTS) {
    const session = await signIn(email);
    check(`${email} still signs in with a password`, Boolean(session?.access_token));
  }
  check(
    'Every seed account is confirmed',
    sql(
      `select count(*) from auth.users where email like '%@local.test' and email_confirmed_at is null`,
    ) === '0',
  );

  const studentId = sql(
    `insert into public.students (full_name, year_level) values ('Open Sign-up ${RUN}', 7) returning id`,
  ).split('\n')[0];
  const parentEmail = address('parent-invite');
  const invited = await accountAdmin({
    action: 'invite-parent',
    studentId,
    email: parentEmail,
    fullName: 'Invited Parent',
  });
  check('A new parent invite is sent', invited.json?.ok === true, JSON.stringify(invited.json));
  check(
    'The parent invitee is confirmed at creation',
    sql(
      `select (email_confirmed_at is not null)::text from auth.users where email = '${parentEmail}'`,
    ) === 'true',
  );
  check(
    'The parent invite still redeems',
    await invitedSignsIn(parentEmail, invited.json?.data?.userId),
  );

  // Studio "Add user" with Auto confirm, then the README's account_role SQL (supabase/README.md).
  const studioEmail = address('studio-admin');
  const created = await adminApi('/auth/v1/admin/users', {
    body: { email: studioEmail, password: `${PREFIX}-throwaway-Pw1!`, email_confirm: true },
  });
  sql(
    `update auth.users set raw_app_meta_data = raw_app_meta_data || '{\\"account_role\\":\\"tutor\\"}' where email = '${studioEmail}'`,
  );
  check(
    'A Studio-made account with the README SQL becomes an invited tutor',
    sql(`select role || '/' || status from public.profiles where id = '${created.json?.id}'`) ===
      'tutor/invited',
  );
  const link = await adminApi('/auth/v1/admin/generate_link', {
    body: { type: 'recovery', email: studioEmail },
  });
  const hop = await api('/auth/v1/verify', {
    body: { type: 'recovery', token_hash: link.json?.hashed_token },
  });
  const onboarding = await api('/rest/v1/rpc/my_onboarding', {
    token: hop.json?.access_token,
    body: {},
  });
  check(
    'and its recovery link reaches staff onboarding',
    onboarding.json?.[0]?.role === 'tutor',
    JSON.stringify(onboarding.json),
  );
}

/** POST /auth/v1/signup as the sign-up page does (a throwaway password, the name in data). */
const rawSignUp = (email, fullName = 'Test Parent', { captcha = true } = {}) =>
  api('/auth/v1/signup', {
    body: {
      email,
      password: `${PREFIX}-throwaway-Pw1!`,
      data: { full_name: fullName },
      ...(captcha ? { gotrue_meta_security: CAPTCHA } : {}),
    },
  });
const mailCount = async (email) => (await mailsTo(email)).length;
const userCount = (email) => sql(`select count(*) from auth.users where email = '${email}'`);
const plantCapRows = (count) =>
  sql(
    `delete from private.sign_up_emails; insert into private.sign_up_emails (created_at) select now() from generate_series(1, ${count})`,
  );
const setSwitch = (open) => sql(`update private.sign_up_settings set open = ${open}`);

async function hookChecks() {
  console.log('\nS1: the before-user-created hook (AC-41, AC-46, AC-48)');
  plantCapRows(0);
  const allowed = address('allowed');
  const reply = await rawSignUp(allowed, 'Allowed Parent');
  check('A sign-up with room under the cap is accepted', reply.status === 200, reply.status);
  check(
    'AC-41: the new account has no account_role in app_metadata',
    reply.json?.app_metadata && !('account_role' in reply.json.app_metadata),
    JSON.stringify(reply.json?.app_metadata),
  );
  check(
    'and it is a user, invited, with the name from the form',
    sql(
      `select role || '/' || status || '/' || full_name from public.profiles where email = '${allowed}'`,
    ) === 'user/invited/Allowed Parent',
  );
  check('and it took one cap slot', sql('select count(*) from private.sign_up_emails') === '1');

  plantCapRows(15);
  const busy = address('busy');
  const busyReply = await rawSignUp(busy);
  check(
    'With 15 planted, the 16th sign-up gets 429 sign_up_busy',
    busyReply.status === 429 && busyReply.json?.msg === 'sign_up_busy',
    JSON.stringify(busyReply),
  );
  check('and no account was made', userCount(busy) === '0');
  check('and no e-mail was sent', (await mailCount(busy)) === 0);
  check(
    'and the cap row count is unchanged',
    sql('select count(*) from private.sign_up_emails') === '15',
  );

  const viaJs = await browserClient().auth.signUp({
    email: address('busy-js'),
    password: `${PREFIX}-throwaway-Pw1!`,
    options: { captchaToken: CAPTCHA.captcha_token, data: { full_name: 'Busy Parent' } },
  });
  check(
    "S1(b): supabase-js sees status 429 and message 'sign_up_busy'",
    viaJs.error?.status === 429 && viaJs.error?.message === 'sign_up_busy',
    JSON.stringify({
      status: viaJs.error?.status,
      message: viaJs.error?.message,
      code: viaJs.error?.code,
    }),
  );
  s1bShape = {
    status: viaJs.error?.status,
    message: viaJs.error?.message,
    code: viaJs.error?.code,
  };

  plantCapRows(0);
  setSwitch(false);
  const closed = address('closed');
  const closedReply = await rawSignUp(closed);
  check(
    'Switch closed: sign-up gets 429 sign_up_closed',
    closedReply.status === 429 && closedReply.json?.msg === 'sign_up_closed',
    JSON.stringify(closedReply.json),
  );
  check('and no account or e-mail', userCount(closed) === '0' && (await mailCount(closed)) === 0);
  setSwitch(true);

  const badName = address('bad-name');
  const badNameReply = await rawSignUp(badName, 'A');
  check(
    'AC-4/45: a 1-character name gets 429 invalid_name, no account, no e-mail',
    badNameReply.status === 429 &&
      badNameReply.json?.msg === 'invalid_name' &&
      userCount(badName) === '0' &&
      (await mailCount(badName)) === 0,
    JSON.stringify(badNameReply.json),
  );

  const mixed = `${PREFIX}-Mixed.Case@Local.Test`;
  await rawSignUp(mixed, 'Mixed Case');
  check(
    'AC-5: a mixed-case e-mail is stored lower-case in profiles',
    sql(`select count(*) from public.profiles where email = '${mixed.toLowerCase()}'`) === '1',
  );
}

let s1bShape = null;

const CONFIRM_LINK =
  /http:\/\/localhost:5173\/portal\/auth\/confirm\?token_hash=([0-9a-f]+)&(?:amp;)?type=email/;

/** The newest Mailpit message to this address, in full (HTML, Text, headers). */
async function fullMail(email) {
  const summary = await latestMailTo(email);
  if (!summary) return null;
  const message = await (await fetch(`${MAILPIT}/api/v1/message/${summary.ID}`)).json();
  const headers = await (await fetch(`${MAILPIT}/api/v1/message/${summary.ID}/headers`)).json();
  return { ...message, contentType: headers['Content-Type']?.[0] ?? '' };
}

/** The token_hash from the newest confirmation e-mail to this address. */
async function confirmationHash(email) {
  return (await fullMail(email))?.HTML.match(CONFIRM_LINK)?.[1] ?? '';
}

async function templateChecks() {
  console.log('\nAC-15/16: the confirmation e-mail (S2 text part)');
  plantCapRows(0);
  const email = address('template');
  await rawSignUp(email, 'Template Parent');
  const mail = await fullMail(email);
  check(
    'Subject "Confirm your e-mail for AJ Classes"',
    mail?.Subject === 'Confirm your e-mail for AJ Classes',
    mail?.Subject,
  );
  check(
    'Branded HTML: heading and the Confirm my e-mail button',
    mail?.HTML.includes('Confirm your e-mail</h1>') && mail?.HTML.includes('>Confirm my e-mail</a'),
  );
  check(
    'The link goes to /portal/auth/confirm?token_hash=…&type=email',
    CONFIRM_LINK.test(mail?.HTML ?? ''),
  );
  check('No Staff badge', !mail?.HTML.includes('Staff'));
  check(
    'S2: Auth sends HTML only, so the full link is also printed as visible text',
    mail?.contentType.startsWith('text/html') &&
      (mail?.Text ?? '').includes('/portal/auth/confirm?token_hash=') &&
      mail?.HTML.includes("If the button doesn't work, copy this link into your browser:"),
    mail?.contentType,
  );
  check(
    'The expiry line says 1 hour',
    mail?.HTML.includes('This link expires in 1 hour and works once.'),
  );
}

function cleanUp() {
  sql(`delete from auth.users where lower(email) like '${PREFIX}-%'`);
  sql('delete from private.sign_up_emails');
  sql('update private.sign_up_settings set open = true');
  sql(`delete from public.students where full_name = 'Open Sign-up ${RUN}'`);
}

async function main() {
  console.log('Open sign-up (local stack only)');
  admin = await adminTwoStepToken();
  try {
    await existingAccountChecks();
    await hookChecks();
    await templateChecks();
  } finally {
    cleanUp();
  }
  check(
    'Clean-up left no test accounts',
    sql(`select count(*) from auth.users where email like '${PREFIX}-%'`) === '0',
  );
  finish();
}

await main();
