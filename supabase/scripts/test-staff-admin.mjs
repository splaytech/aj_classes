// End-to-end test of the staff-admin edge function against the LOCAL stack (R2a design §10).
// Run: pnpm db:start && pnpm test:functions
// Uses only local seed accounts and the local-only authenticator key from supabase/seed.sql.

import { createHmac } from 'node:crypto';
import { execSync } from 'node:child_process';

const API = 'http://127.0.0.1:55321';
const MAILPIT = 'http://127.0.0.1:55324';
const SITE_ORIGIN = 'http://localhost:5173';
const LOCAL_PASSWORD = 'local-password-123'; // supabase/seed.sql, local only
const LOCAL_ADMIN_KEY = 'LOCALDEVADMINKEYLOCALDEVADMINKEY'; // supabase/seed.sql, local only
const CAPTCHA = { captcha_token: 'XXXX.DUMMY.TOKEN.XXXX' }; // Turnstile always-pass test secret

const publishableKey = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8' }),
).PUBLISHABLE_KEY;

let failures = 0;
function check(description, condition, detail = '') {
  console.log(`${condition ? 'ok    ' : 'NOT OK'} ${description}${condition ? '' : `  ${detail}`}`);
  if (!condition) failures += 1;
}

async function api(path, { method = 'POST', body, token, headers = {} } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    json: text ? JSON.parse(text) : null,
  };
}

async function signIn(email) {
  const { json } = await api('/auth/v1/token?grant_type=password', {
    body: { email, password: LOCAL_PASSWORD, gotrue_meta_security: CAPTCHA },
  });
  return json;
}

function totp(base32Key) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...base32Key].map((c) => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac('sha1', key).update(counter).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

async function adminTwoStepToken() {
  const session = await signIn('admin@local.test');
  const user = await api('/auth/v1/user', { method: 'GET', token: session.access_token });
  const factorId = user.json.factors.find((factor) => factor.status === 'verified').id;
  const challenge = await api(`/auth/v1/factors/${factorId}/challenge`, {
    token: session.access_token,
    body: {},
  });
  const verified = await api(`/auth/v1/factors/${factorId}/verify`, {
    token: session.access_token,
    body: { challenge_id: challenge.json.id, code: totp(LOCAL_ADMIN_KEY) },
  });
  return { aal1: session.access_token, aal2: verified.json.access_token, id: session.user.id };
}

const staffAdmin = (token, body, headers) =>
  api('/functions/v1/staff-admin', { token, body, headers });
const latestMail = async () =>
  (await (await fetch(`${MAILPIT}/api/v1/messages`)).json()).messages[0];
const sql = (query) =>
  execSync(`docker exec supabase_db_aj_classes psql -U postgres -tAc "${query}"`, {
    encoding: 'utf8',
  }).trim();

// ---------------------------------------------------------------------------------------------
console.log('staff-admin edge function (local)\n');

const admin = await adminTwoStepToken();
const tutor = await signIn('tutor@local.test');
const tutorId = tutor.user.id;
const newAdminId = sql("select id from auth.users where email = 'newadmin@local.test'");

// Who may call it
check(
  'No token → refused',
  [401, 403].includes((await staffAdmin(undefined, { action: 'invite' })).status),
);
check(
  'Tutor → 403 not_admin',
  (await staffAdmin(tutor.access_token, { action: 'invite' })).json?.code === 'not_admin',
);
check(
  'Admin without two-step → 403',
  (await staffAdmin(admin.aal1, { action: 'invite' })).status === 403,
);
check(
  'GET → 405',
  (await api('/functions/v1/staff-admin', { method: 'GET', token: admin.aal2 })).status === 405,
);
check(
  'Unknown action → 400',
  (await staffAdmin(admin.aal2, { action: 'drop-tables' })).status === 400,
);

// CORS: the local gateway (Kong) answers preflights and adds "Access-Control-Allow-Origin: *" to
// every response, so the function's origin allowlist can only be checked on staging (R2a V33).
console.log(`skip   CORS allowlist (${SITE_ORIGIN} only): check on staging, see R2a review V33`);

// Invite
const email = `invitee-${Date.now()}@local.test`;
check(
  'Invite: bad e-mail refused',
  (await staffAdmin(admin.aal2, { action: 'invite', email: 'nope', fullName: 'Someone' })).json
    ?.code === 'invalid_email',
);
check(
  'Invite: short name refused',
  (await staffAdmin(admin.aal2, { action: 'invite', email, fullName: 'A' })).json?.code ===
    'invalid_name',
);
const invited = await staffAdmin(admin.aal2, {
  action: 'invite',
  email: email.toUpperCase(),
  fullName: '  New Tutor  ',
});
check('Invite: sent', invited.json?.ok === true, JSON.stringify(invited.json));
const inviteeId = invited.json?.data?.userId;
check(
  'Invite: profile created as tutor with the trimmed name',
  sql(`select role || '|' || full_name from public.profiles where id = '${inviteeId}'`) ===
    'tutor|New Tutor',
);
const inviteMail = await latestMail();
check(
  'Invite: e-mail went to the invitee',
  inviteMail.To[0].Address === email,
  inviteMail.To[0].Address,
);
check(
  'Invite: same e-mail again → already_exists',
  (await staffAdmin(admin.aal2, { action: 'invite', email, fullName: 'New Tutor' })).json?.code ===
    'already_exists',
);

// Resend and cancel
check(
  'Resend invite: ok',
  (await staffAdmin(admin.aal2, { action: 'resend-invite', userId: inviteeId })).json?.ok === true,
);
check(
  'Resend invite: joined staff refused',
  (await staffAdmin(admin.aal2, { action: 'resend-invite', userId: tutorId })).json?.code ===
    'already_joined',
);
check(
  'Cancel invite: joined staff refused',
  (await staffAdmin(admin.aal2, { action: 'cancel-invite', userId: tutorId })).json?.code ===
    'already_joined',
);
check(
  'Cancel invite: ok',
  (await staffAdmin(admin.aal2, { action: 'cancel-invite', userId: inviteeId })).json?.ok === true,
);
check(
  'Cancel invite: account removed',
  sql(`select count(*) from auth.users where id = '${inviteeId}'`) === '0',
);
check(
  'Cancel invite: audit keeps the e-mail',
  sql(
    `select details ->> 'email' from public.audit_log where action = 'invite_cancelled' order by id desc limit 1`,
  ) === email,
);

// Deactivate and reactivate
check(
  'Deactivate yourself → refused',
  (await staffAdmin(admin.aal2, { action: 'set-active', userId: admin.id, active: false })).json
    ?.code === 'cannot_deactivate_self',
);
check(
  'Deactivate tutor: ok',
  (await staffAdmin(admin.aal2, { action: 'set-active', userId: tutorId, active: false })).json
    ?.ok === true,
);
check(
  'Deactivate tutor: profile inactive and banned',
  sql(
    `select (not p.is_active and u.banned_until > now())::text from public.profiles p join auth.users u on u.id = p.id where p.id = '${tutorId}'`,
  ) === 'true',
);
check(
  'Deactivated tutor cannot sign in',
  (await signIn('tutor@local.test')).error_code === 'user_banned',
);
check(
  'Reactivate tutor: ok',
  (await staffAdmin(admin.aal2, { action: 'set-active', userId: tutorId, active: true })).json
    ?.ok === true,
);
check('Reactivated tutor can sign in', Boolean((await signIn('tutor@local.test')).access_token));

// Two-step reset
check(
  'Reset your own two-step → refused',
  (await staffAdmin(admin.aal2, { action: 'reset-two-step', userId: admin.id })).json?.code ===
    'cannot_reset_self',
);
const reset = await staffAdmin(admin.aal2, { action: 'reset-two-step', userId: newAdminId });
check(
  "Reset someone else's two-step: ok",
  reset.json?.ok === true && reset.json?.data?.removed === 0,
  JSON.stringify(reset.json),
);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
