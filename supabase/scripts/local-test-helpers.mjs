// Helpers for the end-to-end tests of the edge functions against the LOCAL stack.
// Uses only local seed accounts and the local-only authenticator key from supabase/seed.sql.

import { createHmac } from 'node:crypto';
import { execSync } from 'node:child_process';

export const API = 'http://127.0.0.1:55321';
export const MAILPIT = 'http://127.0.0.1:55324';
export const SITE_ORIGIN = 'http://localhost:5173';
const LOCAL_PASSWORD = 'local-password-123'; // supabase/seed.sql, local only
const LOCAL_ADMIN_KEY = 'LOCALDEVADMINKEYLOCALDEVADMINKEY'; // supabase/seed.sql, local only
const CAPTCHA = { captcha_token: 'XXXX.DUMMY.TOKEN.XXXX' }; // Turnstile always-pass test secret

const stackStatus = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8' }));
const publishableKey = stackStatus.PUBLISHABLE_KEY;
// The LOCAL stack's secret key, read at run time and never printed or written down.
export const serviceKey = stackStatus.SERVICE_ROLE_KEY;

let failures = 0;
export function check(description, condition, detail = '') {
  console.log(`${condition ? 'ok    ' : 'NOT OK'} ${description}${condition ? '' : `  ${detail}`}`);
  if (!condition) failures += 1;
}

/** Prints the result and sets the exit code. Call once at the end. */
export function finish() {
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

export async function api(path, { method = 'POST', body, token, headers = {} } = {}) {
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

export async function signIn(email) {
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

export async function adminTwoStepToken() {
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

export const sql = (query) =>
  execSync(`docker exec supabase_db_aj_classes psql -U postgres -qtAc "${query}"`, {
    encoding: 'utf8',
  }).trim();

/** Auth's admin API with the local secret key, e.g. adminApi('/auth/v1/admin/generate_link', …). */
export async function adminApi(path, { method = 'POST', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}

/** The plain-text body of one Mailpit message. */
export async function mailpitText(id) {
  return (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()).Text;
}

/** Every Mailpit message to this address, newest first (summaries only). */
export async function mailsTo(email) {
  const query = encodeURIComponent(`to:"${email}"`);
  return (await (await fetch(`${MAILPIT}/api/v1/search?query=${query}`)).json()).messages;
}

/** The newest Mailpit message to this address, or undefined. */
export async function latestMailTo(email) {
  return (await mailsTo(email))[0];
}

/** How many messages Mailpit holds in total. */
export async function mailpitTotal() {
  return (await (await fetch(`${MAILPIT}/api/v1/messages?limit=1`)).json()).total;
}
