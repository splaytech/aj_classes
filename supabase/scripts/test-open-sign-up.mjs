// Integration tests of open sign-up (ADR-0011; docs/delivery/2026-11-13-open-sign-up 03 §10 "INT")
// against the LOCAL stack: Auth's own endpoints, Mailpit, account-admin and the local database.
// Every set-up write (planted cap rows, the switch, back-dating) goes to the local database only.
// Run: pnpm db:start && pnpm test:functions   (or: node supabase/scripts/test-open-sign-up.mjs)

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

function cleanUp() {
  sql(`delete from auth.users where email like '${PREFIX}-%'`);
  sql(`delete from public.students where full_name = 'Open Sign-up ${RUN}'`);
}

async function main() {
  console.log('Open sign-up (local stack only)');
  admin = await adminTwoStepToken();
  try {
    await existingAccountChecks();
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
