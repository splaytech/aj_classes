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

/** Lets a repeat sign-up or resend send again straight away (Auth waits 60 s between e-mails). */
const skipResendWait = (email) =>
  sql(
    `update auth.users set confirmation_sent_at = now() - interval '2 minutes', recovery_sent_at = now() - interval '2 minutes' where email = '${email}'`,
  );

/** A password sign-in. Returns { status, code, token }. */
async function passwordSignIn(email, password) {
  const reply = await api('/auth/v1/token?grant_type=password', {
    body: { email, password, gotrue_meta_security: CAPTCHA },
  });
  return {
    status: reply.status,
    code: reply.json?.error_code ?? reply.json?.code,
    token: reply.json?.access_token,
    refresh: reply.json?.refresh_token,
  };
}
const signsIn = async (email, password) => Boolean((await passwordSignIn(email, password)).token);

/** Opens the newest confirmation link the way /portal/auth/confirm does. Returns the session. */
async function openConfirmationLink(email, tokenHash) {
  const hash = tokenHash ?? (await confirmationHash(email));
  const reply = await api('/auth/v1/verify', { body: { type: 'email', token_hash: hash } });
  return {
    status: reply.status,
    token: reply.json?.access_token,
    refresh: reply.json?.refresh_token,
    json: reply.json,
  };
}

/** updateUser({ password }) in a session, as the finish step does. */
const setPassword = (token, password) =>
  api('/auth/v1/user', { method: 'PUT', token, body: { password } });

const storedHash = (email) =>
  sql(`select coalesce(encrypted_password, 'NULL') from auth.users where email = '${email}'`);
const lowCostHash = (email, password) =>
  sql(
    `update auth.users set encrypted_password = extensions.crypt('${password}', extensions.gen_salt('bf', 4)) where email = '${email}'`,
  );

async function wipeChecks() {
  console.log('\nS6: the confirm-time wipe (AC-14)');
  plantCapRows(0);
  // Checks 1-3 use one account whose P1 is planted with SQL (which also sets password_set_at).
  // It is never reused for an AC-14 case (review-4 finding 4).
  const planted = address('planted-p1');
  const P1 = `${PREFIX}-P1-stranger`;
  const P2 = `${PREFIX}-P2-owner`;
  await rawSignUp(planted, 'Planted Person');
  lowCostHash(planted, P1);
  check(
    'Before confirming, P1 is stored at bcrypt cost 4',
    storedHash(planted).startsWith('$2a$04$'),
  );
  const link = await openConfirmationLink(planted);
  check(
    'The confirmation link gives a session',
    link.status === 200 && Boolean(link.token),
    link.status,
  );
  check('S6(1): after confirming, encrypted_password is null', storedHash(planted) === 'NULL');
  const p1Try = await passwordSignIn(planted, P1);
  check('S6(1): P1 no longer signs in', !p1Try.token);
  check(
    'S6(3): a sign-in against a null password reads as a wrong password, not a 500',
    p1Try.status === 400 && p1Try.code === 'invalid_credentials',
    JSON.stringify(p1Try),
  );
  const setP2 = await setPassword(link.token, P2);
  check(
    'S6(2): the owner sets P2 in the link session',
    setP2.status === 200,
    JSON.stringify(setP2.json),
  );
  lowCostHash(planted, P2);
  const lowHash = storedHash(planted);
  check('S6(2): P2 signs in', await signsIn(planted, P2));
  const upgraded = storedHash(planted);
  // GoTrue re-hashes a cost-4 hash only in memory (models/user.go:497-503) and writes it back
  // only with database encryption on (token.go:139-149, off locally). Either way it runs only
  // after the typed password matched the stored hash, so it can never bring back a wiped one.
  check(
    'S6(2): the sign-in wrote no other hash (local: no encryption, so no write-back)',
    storedHash(planted) === lowHash,
    storedHash(planted).slice(0, 7),
  );
  check('S6(2): P1 still fails after the P2 sign-in', !(await signsIn(planted, P1)));
  check('S6(2): the wipe did not fire on that sign-in', storedHash(planted) !== 'NULL');

  // AC-14 case 3: A then B sign up; B finishes from the newest link.
  const case3 = address('case3');
  const PA = `${PREFIX}-PA-stranger`;
  const PB = `${PREFIX}-PB-owner-throwaway`;
  await rawSignUpWithPassword(case3, PA);
  skipResendWait(case3);
  const oldHash3 = await confirmationHash(case3);
  await rawSignUpWithPassword(case3, PB);
  const newHash3 = await confirmationHash(case3);
  check('AC-14: a repeat sign-up sends a new link', newHash3 !== '' && newHash3 !== oldHash3);
  check(
    'AC-14: the old link stops working',
    (await openConfirmationLink(case3, oldHash3)).status !== 200,
  );
  const owner3 = await openConfirmationLink(case3, newHash3);
  await setPassword(owner3.token, P2);
  check(
    "AC-14 case 3: only B's password signs in",
    (await signsIn(case3, P2)) && !(await signsIn(case3, PA)) && !(await signsIn(case3, PB)),
  );

  // AC-14 case 4: B then A sign up; B finishes from the newest link.
  const case4 = address('case4');
  await rawSignUpWithPassword(case4, PB);
  skipResendWait(case4);
  await rawSignUpWithPassword(case4, PA);
  const owner4 = await openConfirmationLink(case4);
  await setPassword(owner4.token, P2);
  check(
    "AC-14 case 4: only B's password signs in",
    (await signsIn(case4, P2)) && !(await signsIn(case4, PA)) && !(await signsIn(case4, PB)),
  );

  // AC-14 case 5: A uses the raw API with P1; B opens the link but doesn't finish; A tries P1.
  const case5 = address('case5');
  await rawSignUpWithPassword(case5, P1);
  const beforeConfirm = await passwordSignIn(case5, P1);
  check(
    'AC-14 case 5: before B confirms, A gets no session with P1',
    !beforeConfirm.token,
    JSON.stringify(beforeConfirm),
  );
  const owner5 = await openConfirmationLink(case5);
  const afterConfirm = await passwordSignIn(case5, P1);
  check(
    'AC-14 case 5: after B opens the link, P1 still gets no session (invalid_credentials)',
    !afterConfirm.token && afterConfirm.code === 'invalid_credentials',
    JSON.stringify(afterConfirm),
  );
  await setPassword(owner5.token, P2);
  check(
    "AC-14 case 5: when B sets a password, only B's password signs in",
    (await signsIn(case5, P2)) && !(await signsIn(case5, P1)),
  );
}

/** A raw sign-up with a chosen password (a stranger using the API directly). */
const rawSignUpWithPassword = (email, password) =>
  api('/auth/v1/signup', {
    body: { email, password, data: { full_name: 'Some Person' }, gotrue_meta_security: CAPTCHA },
  });

const capCount = () => sql('select count(*) from private.sign_up_emails');
/** POST /auth/v1/resend {type: signup} as /portal/sign-up/resend does. */
const resendSignUp = (email, { captcha = true } = {}) =>
  api('/auth/v1/resend', {
    body: { type: 'signup', email, ...(captcha ? { gotrue_meta_security: CAPTCHA } : {}) },
  });
/** POST /auth/v1/recover as Forgot password does. */
const forgotPassword = (email) =>
  api('/auth/v1/recover', { body: { email, gotrue_meta_security: CAPTCHA } });
const settle = () => new Promise((resolve) => setTimeout(resolve, 500));

async function captchaAndResendChecks() {
  console.log(
    '\nS2/S4: captcha, resend and unconfirmed sign-in (AC-8, AC-14, AC-19, AC-38, AC-46)',
  );
  plantCapRows(0);
  const noCaptcha = address('no-captcha');
  const signUpNoCaptcha = await rawSignUp(noCaptcha, 'No Captcha', { captcha: false });
  check(
    'AC-38: /signup without a captcha token is refused, nothing created or sent',
    signUpNoCaptcha.status >= 400 &&
      userCount(noCaptcha) === '0' &&
      (await mailCount(noCaptcha)) === 0 &&
      capCount() === '0',
    JSON.stringify({ status: signUpNoCaptcha.status, body: signUpNoCaptcha.json }),
  );
  captchaShape = { status: signUpNoCaptcha.status, ...signUpNoCaptcha.json };

  const unconfirmed = address('resend-unconfirmed');
  await rawSignUp(unconfirmed, 'Resend Parent');
  const mailsBefore = await mailCount(unconfirmed);
  const resendNoCaptcha = await resendSignUp(unconfirmed, { captcha: false });
  await settle();
  check(
    'AC-38: /resend without a captcha token is refused and sends nothing',
    resendNoCaptcha.status >= 400 && (await mailCount(unconfirmed)) === mailsBefore,
    JSON.stringify({ status: resendNoCaptcha.status, body: resendNoCaptcha.json }),
  );
  const recoverNoCaptcha = await api('/auth/v1/recover', { body: { email: unconfirmed } });
  check(
    'The existing Forgot-password captcha check still holds',
    recoverNoCaptcha.status >= 400,
    recoverNoCaptcha.status,
  );

  const s4a = await passwordSignIn(unconfirmed, `${PREFIX}-throwaway-Pw1!`);
  check(
    'S4(a): a password sign-in to an unconfirmed e-mail returns email_not_confirmed',
    !s4a.token && s4a.code === 'email_not_confirmed',
    JSON.stringify(s4a),
  );

  // AC-19: an unconfirmed sign-up gets a new mail, and the old link fails.
  const oldHash = await confirmationHash(unconfirmed);
  const capBefore = capCount();
  skipResendWait(unconfirmed);
  const resent = await resendSignUp(unconfirmed);
  await settle();
  const newHash = await confirmationHash(unconfirmed);
  check(
    'AC-19: resend to an unconfirmed sign-up sends a new link',
    resent.status === 200 && newHash !== '' && newHash !== oldHash,
    JSON.stringify({ status: resent.status }),
  );
  check(
    'AC-19: and the old link fails',
    (await openConfirmationLink(unconfirmed, oldHash)).status !== 200,
  );
  const tooSoon = await resendSignUp(unconfirmed);
  resendTooSoonShape = { status: tooSoon.status, code: tooSoon.json?.error_code };
  check(
    'AC-19: a second resend within 60 s is either 200 or over_email_send_rate_limit (the page shows both as sent)',
    tooSoon.status === 200 ||
      (tooSoon.status === 429 && tooSoon.json?.error_code === 'over_email_send_rate_limit'),
    JSON.stringify(resendTooSoonShape),
  );
  check('AC-19: resends take no cap slot', capCount() === capBefore);

  // AC-19: a confirmed but unfinished sign-up gets no mail.
  const confirmedUnfinished = address('resend-confirmed');
  await rawSignUp(confirmedUnfinished, 'Confirmed Parent');
  await openConfirmationLink(confirmedUnfinished);
  skipResendWait(confirmedUnfinished);
  const before = await mailCount(confirmedUnfinished);
  const resentConfirmed = await resendSignUp(confirmedUnfinished);
  await settle();
  check(
    'AC-19: resend to a confirmed, unfinished sign-up sends nothing',
    (await mailCount(confirmedUnfinished)) === before,
    JSON.stringify({ status: resentConfirmed.status, body: resentConfirmed.json }),
  );
  resendConfirmedShape = { status: resentConfirmed.status, code: resentConfirmed.json?.error_code };

  // AC-46: with the cap full, resend and Forgot password still send and aren't counted.
  const atCap = address('at-cap');
  await rawSignUp(atCap, 'At Cap');
  plantCapRows(15);
  skipResendWait(atCap);
  const atCapResend = await resendSignUp(atCap);
  await settle();
  check(
    'AC-46: at the cap, resend still sends',
    atCapResend.status === 200 && (await mailCount(atCap)) === 2,
    JSON.stringify({ status: atCapResend.status, body: atCapResend.json }),
  );
  skipResendWait(atCap);
  const atCapRecover = await forgotPassword(atCap);
  await settle();
  check(
    'AC-46: at the cap, Forgot password still sends',
    atCapRecover.status === 200 && (await mailCount(atCap)) === 3,
    JSON.stringify({ status: atCapRecover.status, body: atCapRecover.json }),
  );
  check('AC-46: neither was counted', capCount() === '15');
  plantCapRows(0);

  // S4(b): a banned, unconfirmed sign-up. Does Auth still send on signUp and resend?
  const banned = address('banned-unconfirmed');
  const bannedReply = await rawSignUp(banned, 'Banned Parent');
  await adminApi(`/auth/v1/admin/users/${bannedReply.json?.id}`, {
    method: 'PUT',
    body: { ban_duration: '876000h' },
  });
  skipResendWait(banned);
  const beforeBan = await mailCount(banned);
  const bannedSignUp = await rawSignUp(banned, 'Banned Parent');
  await settle();
  const afterSignUp = await mailCount(banned);
  skipResendWait(banned);
  const bannedResend = await resendSignUp(banned);
  await settle();
  const afterResend = await mailCount(banned);
  s4b = {
    signUp: { status: bannedSignUp.status, sent: afterSignUp - beforeBan },
    resend: { status: bannedResend.status, sent: afterResend - afterSignUp },
  };
  check('S4(b) recorded (see 05-dev-notes.md)', true);
}

let captchaShape = null;
let resendTooSoonShape = null;
let resendConfirmedShape = null;
let s4b = null;

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
    await wipeChecks();
    await captchaAndResendChecks();
  } finally {
    cleanUp();
  }
  check(
    'Clean-up left no test accounts',
    sql(`select count(*) from auth.users where email like '${PREFIX}-%'`) === '0',
  );
  console.log(
    '\nRecorded:',
    JSON.stringify({ captchaShape, resendTooSoonShape, resendConfirmedShape, s4b, s1bShape }),
  );
  finish();
}

await main();
