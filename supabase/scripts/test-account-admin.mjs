// End-to-end test of the account-admin edge function against the LOCAL stack (R2a design §10,
// R3b design §5). Invites are our own 14-day links since ADR-0010 (invite delivery 03 §8.3 item 2).
// Run: pnpm db:start && pnpm test:functions
// Uses only local seed accounts (helpers: local-test-helpers.mjs).

import { createHash } from 'node:crypto';

import {
  SITE_ORIGIN,
  adminTwoStepToken,
  api,
  check,
  finish,
  latestMailTo,
  mailpitText,
  mailpitTotal,
  mailsTo,
  signIn,
  sql,
} from './local-test-helpers.mjs';

const accountAdmin = (token, body, headers) =>
  api('/functions/v1/account-admin', { token, body, headers });
const rpc = (token, name, body) => api(`/rest/v1/rpc/${name}`, { token, body });
const mailText = async (summary) => mailpitText(summary.ID);
const INVITE_LINK =
  /http:\/\/localhost:5173\/portal\/invite#token=([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/;
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const tokenRow = (profileId) =>
  sql(
    `select token_hash || '|' || (used_at is null) || '|' || (p.invited_at = t.sent_at) from private.invite_tokens t join public.profiles p on p.id = t.profile_id where t.profile_id = '${profileId}'`,
  );
const auditCount = (action) =>
  sql(`select count(*) from public.audit_log where action = '${action}'`);

/** Checks one invite email: our link (not Supabase's), and that only its hash is stored, unused,
 * with profiles.invited_at equal to the send time (AC 31, 40; ADR-0010). Returns the token. */
async function checkInviteMail(label, address, profileId) {
  const mail = await latestMailTo(address);
  const text = mail ? await mailText(mail) : '';
  const token = text.match(INVITE_LINK)?.[1] ?? '';
  check(`${label}: the e-mail links to /portal/invite#token=<43 chars>`, token !== '', text);
  check(
    `${label}: the e-mail has no Supabase or old confirm link`,
    !/supabase|auth\/confirm/.test(text),
  );
  const [hash, unused, datesMatch] = tokenRow(profileId).split('|');
  check(
    `${label}: a token row holds the token's hash, not the token`,
    hash === sha256(token) && hash !== token,
  );
  check(
    `${label}: the link is unused, and invited_at = sent_at (AC 40)`,
    unused === 'true' && datesMatch === 'true',
  );
  return token;
}

// ---------------------------------------------------------------------------------------------
console.log('account-admin edge function (local)\n');

const admin = await adminTwoStepToken();
const tutor = await signIn('tutor@local.test');
const tutorId = tutor.user.id;
const newAdminId = sql("select id from auth.users where email = 'newadmin@local.test'");

// Who may call it (AC 20). Every refused call carries a real invite body, and afterwards no token,
// email or audit entry has appeared.
const student = await signIn('student@local.test');
const parent = await signIn('parent@local.test');
const refusedEmail = `refused-${Date.now()}@local.test`;
const refusedInvite = { action: 'invite', email: refusedEmail, fullName: 'Refused Person' };
const before = {
  tokens: sql('select count(*) from private.invite_tokens'),
  mail: await mailpitTotal(),
  audit: sql('select count(*) from public.audit_log'),
};
check(
  'No token → refused',
  [401, 403].includes((await accountAdmin(undefined, { action: 'invite' })).status),
);
// Locally the publishable key alone gets past Kong, so the function answers not_admin (AC 20
// allows either).
const signedOut = await accountAdmin(undefined, refusedInvite);
check(
  'Signed out (publishable key only), real invite body → 401 or not_admin 403 (AC 20)',
  signedOut.status === 401 || (signedOut.status === 403 && signedOut.json?.code === 'not_admin'),
  signedOut.status,
);
check(
  'An invalid token → 401 from the gateway (AC 20)',
  (await accountAdmin('not-a-real-token', refusedInvite)).status === 401,
);
for (const [who, session] of [
  ['Tutor', tutor],
  ['Student', student],
  ['Parent', parent],
]) {
  for (const body of [
    refusedInvite,
    { action: 'resend-invite', userId: tutorId },
    { action: 'cancel-invite', userId: tutorId },
  ]) {
    const reply = await accountAdmin(session.access_token, body);
    check(
      `${who} ${body.action} → 403 not_admin (AC 20)`,
      reply.status === 403 && reply.json?.code === 'not_admin',
    );
  }
}
check(
  'Admin without two-step, real invite body → 403 not_admin (AC 20)',
  (await accountAdmin(admin.aal1, refusedInvite)).json?.code === 'not_admin',
);
check(
  'After every refused call: no token, email or audit entry, and no account (AC 20)',
  sql('select count(*) from private.invite_tokens') === before.tokens &&
    (await mailpitTotal()) === before.mail &&
    sql('select count(*) from public.audit_log') === before.audit &&
    sql(`select count(*) from auth.users where email = '${refusedEmail}'`) === '0',
);
check(
  'Tutor → 403 not_admin',
  (await accountAdmin(tutor.access_token, { action: 'invite' })).json?.code === 'not_admin',
);
check(
  'Admin without two-step → 403',
  (await accountAdmin(admin.aal1, { action: 'invite' })).status === 403,
);
check(
  'GET → 405',
  (await api('/functions/v1/account-admin', { method: 'GET', token: admin.aal2 })).status === 405,
);
check(
  'Unknown action → 400',
  (await accountAdmin(admin.aal2, { action: 'drop-tables' })).status === 400,
);

// CORS: the local gateway (Kong) answers preflights and adds "Access-Control-Allow-Origin: *" to
// every response, so the function's origin allowlist can only be checked on staging (R2a V33).
console.log(`skip   CORS allowlist (${SITE_ORIGIN} only): check on staging, see R2a review V33`);

// Invite
const email = `invitee-${Date.now()}@local.test`;
check(
  'Invite: bad e-mail refused',
  (await accountAdmin(admin.aal2, { action: 'invite', email: 'nope', fullName: 'Someone' })).json
    ?.code === 'invalid_email',
);
check(
  'Invite: short name refused',
  (await accountAdmin(admin.aal2, { action: 'invite', email, fullName: 'A' })).json?.code ===
    'invalid_name',
);
const invited = await accountAdmin(admin.aal2, {
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
const inviteMail = await latestMailTo(email);
check(
  'Invite: exactly one e-mail went to the invitee (AC 35)',
  (await mailsTo(email)).length === 1,
);
check(
  'Invite: subject "You\'re invited to the AJ Classes portal", from AJ Classes (AC 28)',
  inviteMail?.Subject === "You're invited to the AJ Classes portal" &&
    inviteMail?.From.Address === 'hello@ajclasses.com.au' &&
    inviteMail?.From.Name === 'AJ Classes',
);
check('Invite: worded for staff', (await mailText(inviteMail)).includes('staff portal'));
const firstStaffToken = await checkInviteMail('Invite', email, inviteeId);
check(
  'Invite: audited once as invite_sent (AC 22)',
  sql(
    `select count(*) from public.audit_log where action = 'invite_sent' and target_id = '${inviteeId}'`,
  ) === '1',
);
check(
  'Invite: same e-mail again → already_exists',
  (await accountAdmin(admin.aal2, { action: 'invite', email, fullName: 'New Tutor' })).json
    ?.code === 'already_exists',
);

// Resend and cancel
sql(
  `update public.profiles set invited_at = invited_at - interval '1 day' where id = '${inviteeId}'`,
);
const invitedBefore = sql(`select invited_at from public.profiles where id = '${inviteeId}'`);
check(
  'Resend invite: ok',
  (await accountAdmin(admin.aal2, { action: 'resend-invite', userId: inviteeId })).json?.ok ===
    true,
);
check('Resend invite: a second e-mail went out (AC 35)', (await mailsTo(email)).length === 2);
const resentToken = await checkInviteMail('Resend invite', email, inviteeId);
check(
  'Resend invite: a new token, so the old link is replaced (AC 12)',
  resentToken !== firstStaffToken,
);
check(
  'Resend invite: invited_at moved on to the re-send (AC 24)',
  sql(
    `select (invited_at > '${invitedBefore}'::timestamptz)::text from public.profiles where id = '${inviteeId}'`,
  ) === 'true',
);
check(
  'Resend invite: audited once as invite_resent (AC 22)',
  sql(
    `select count(*) from public.audit_log where action = 'invite_resent' and target_id = '${inviteeId}'`,
  ) === '1',
);
check(
  'Resend invite: joined staff refused',
  (await accountAdmin(admin.aal2, { action: 'resend-invite', userId: tutorId })).json?.code ===
    'already_joined',
);
check(
  'Cancel invite: joined staff refused',
  (await accountAdmin(admin.aal2, { action: 'cancel-invite', userId: tutorId })).json?.code ===
    'already_joined',
);
check(
  'Cancel invite: ok',
  (await accountAdmin(admin.aal2, { action: 'cancel-invite', userId: inviteeId })).json?.ok ===
    true,
);
check(
  'Cancel invite: account removed, and its token row with it (AC 15)',
  sql(`select count(*) from auth.users where id = '${inviteeId}'`) === '0' &&
    sql(`select count(*) from private.invite_tokens where profile_id = '${inviteeId}'`) === '0',
);
check(
  'Cancel invite: audited once as invite_cancelled (AC 22)',
  sql(
    `select count(*) from public.audit_log where action = 'invite_cancelled' and details ->> 'email' = '${email}'`,
  ) === '1',
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
  (await accountAdmin(admin.aal2, { action: 'set-active', userId: admin.id, active: false })).json
    ?.code === 'cannot_deactivate_self',
);
check(
  'Deactivate tutor: ok',
  (await accountAdmin(admin.aal2, { action: 'set-active', userId: tutorId, active: false })).json
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
  (await accountAdmin(admin.aal2, { action: 'set-active', userId: tutorId, active: true })).json
    ?.ok === true,
);
check('Reactivated tutor can sign in', Boolean((await signIn('tutor@local.test')).access_token));

// Two-step reset
check(
  'Reset your own two-step → refused',
  (await accountAdmin(admin.aal2, { action: 'reset-two-step', userId: admin.id })).json?.code ===
    'cannot_reset_self',
);
const reset = await accountAdmin(admin.aal2, { action: 'reset-two-step', userId: newAdminId });
check(
  "Reset someone else's two-step: ok",
  reset.json?.ok === true && reset.json?.data?.removed === 0,
  JSON.stringify(reset.json),
);

// Student and parent invites (R3b FA2, FA3). A throwaway roster row keeps this re-runnable.
const stamp = Date.now();
const studentId = sql(
  `insert into public.students (full_name, year_level) values ('Function Test ${stamp}', 8) returning id`,
);
const kidEmail = `kid-${stamp}@local.test`;
const parentEmail = `parent-${stamp}@local.test`;
const inviteKid = (body) =>
  accountAdmin(admin.aal2, { action: 'invite-student', studentId, ...body });
const inviteParent = (body) =>
  accountAdmin(admin.aal2, { action: 'invite-parent', studentId, ...body });

check(
  'Invite student: tutor → 403',
  (await accountAdmin(tutor.access_token, { action: 'invite-student', studentId, email: kidEmail }))
    .status === 403,
);
check(
  'Invite student: needs consent first',
  (await inviteKid({ email: kidEmail })).json?.code === 'consent_needed',
);
check(
  'Record consent (admin function)',
  (await rpc(admin.aal2, 'admin_record_consent', { target_student: studentId })).status === 204,
);
check(
  'Invite student: bad e-mail refused',
  (await inviteKid({ email: 'nope' })).json?.code === 'invalid_email',
);
check(
  "Invite student: a staff member's e-mail is refused",
  (await inviteKid({ email: 'tutor@local.test' })).json?.code === 'already_exists',
);
check(
  'Invite student: unknown student → not_found',
  (
    await accountAdmin(admin.aal2, {
      action: 'invite-student',
      studentId: '00000000-0000-0000-0000-000000000000',
      email: kidEmail,
    })
  ).json?.code === 'not_found',
);
const kidInvite = await inviteKid({ email: kidEmail.toUpperCase() });
check('Invite student: sent', kidInvite.json?.ok === true, JSON.stringify(kidInvite.json));
const kidId = kidInvite.json?.data?.userId;
check(
  'Invite student: student account linked to the roster row',
  sql(
    `select p.role || '|' || p.full_name from public.students s join public.profiles p on p.id = s.profile_id where s.id = '${studentId}'`,
  ) === `student|Function Test ${stamp}`,
);
const kidMail = await latestMailTo(kidEmail);
check(
  'Invite student: exactly one e-mail went to the student (AC 35)',
  (await mailsTo(kidEmail)).length === 1,
);
check('Invite student: worded for students', (await mailText(kidMail)).includes('student portal'));
await checkInviteMail('Invite student', kidEmail, kidId);
check(
  'Invite student: only once per student',
  (await inviteKid({ email: `other-${stamp}@local.test` })).json?.code === 'already_has_account',
);
check(
  'Invite student: audited',
  sql(
    `select count(*) from public.audit_log where action = 'student_invited' and target_id = '${kidId}'`,
  ) === '1',
);
check(
  'Resend student invite: keeps the student wording',
  (await accountAdmin(admin.aal2, { action: 'resend-invite', userId: kidId })).json?.ok === true &&
    (await mailText(await latestMailTo(kidEmail))).includes('student portal'),
);
await checkInviteMail('Resend student invite', kidEmail, kidId);

check(
  'Invite parent: new parent needs a name',
  (await inviteParent({ email: parentEmail, fullName: 'A' })).json?.code === 'invalid_name',
);
const parentInvite = await inviteParent({ email: parentEmail, fullName: 'Test Parent' });
check(
  'Invite parent: sent',
  parentInvite.json?.ok === true && parentInvite.json?.data?.linked === false,
);
const parentId = parentInvite.json?.data?.userId;
check(
  'Invite parent: parent account linked to the student',
  sql(
    `select p.role from public.student_guardians g join public.profiles p on p.id = g.parent_id where g.student_id = '${studentId}'`,
  ) === 'parent',
);
check(
  'Invite parent: worded for parents',
  (await mailText(await latestMailTo(parentEmail))).includes('parent portal'),
);
check(
  'Invite parent: exactly one e-mail went to the parent (AC 35)',
  (await mailsTo(parentEmail)).length === 1,
);
await checkInviteMail('Invite parent', parentEmail, parentId);
check(
  'Invite parent: audited once as parent_invited (AC 22)',
  sql(
    `select count(*) from public.audit_log where action = 'parent_invited' and target_id = '${parentId}'`,
  ) === '1',
);
check(
  'Invite parent: same parent again → already_linked',
  (await inviteParent({ email: parentEmail })).json?.code === 'already_linked',
);
const existingParentId = sql("select id from public.profiles where email = 'parent@local.test'");
const existingParentMails = (await mailsTo('parent@local.test')).length;
const existingParent = await inviteParent({ email: 'parent@local.test' });
check(
  'Invite parent: an existing parent is linked, not re-invited',
  existingParent.json?.ok === true && existingParent.json?.data?.linked === true,
);
check(
  'Invite parent: linking sends no e-mail and makes no invite link (AC 41)',
  (await mailsTo('parent@local.test')).length === existingParentMails &&
    sql(`select count(*) from private.invite_tokens where profile_id = '${existingParentId}'`) ===
      '0',
);
check(
  'Invite parent: linking is audited',
  sql(
    `select count(*) from public.audit_log where action = 'parent_linked' and details ->> 'student_id' = '${studentId}'`,
  ) === '1',
);
check(
  "Invite parent: a student's e-mail is refused",
  (await inviteParent({ email: 'student@local.test' })).json?.code === 'already_exists',
);

check(
  'Cancel parent invite: ok, and the link goes with it',
  (await accountAdmin(admin.aal2, { action: 'cancel-invite', userId: parentId })).json?.ok ===
    true &&
    sql(`select count(*) from public.student_guardians where parent_id = '${parentId}'`) === '0',
);
check(
  'Cancel student invite: ok, and the roster row stays (unlinked)',
  (await accountAdmin(admin.aal2, { action: 'cancel-invite', userId: kidId })).json?.ok === true &&
    sql(
      `select coalesce(profile_id::text, 'none') from public.students where id = '${studentId}'`,
    ) === 'none',
);
sql(`delete from public.students where id = '${studentId}'`);

finish();
