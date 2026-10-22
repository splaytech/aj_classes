// End-to-end test of the account-admin edge function against the LOCAL stack (R2a design §10,
// R3b design §5).
// Run: pnpm db:start && pnpm test:functions
// Uses only local seed accounts (helpers: local-test-helpers.mjs).

import {
  MAILPIT,
  SITE_ORIGIN,
  adminTwoStepToken,
  api,
  check,
  finish,
  signIn,
  sql,
} from './local-test-helpers.mjs';

const accountAdmin = (token, body, headers) =>
  api('/functions/v1/account-admin', { token, body, headers });
const rpc = (token, name, body) => api(`/rest/v1/rpc/${name}`, { token, body });
const latestMail = async () =>
  (await (await fetch(`${MAILPIT}/api/v1/messages`)).json()).messages[0];
const mailText = async (summary) =>
  (await (await fetch(`${MAILPIT}/api/v1/message/${summary.ID}`)).json()).Text;

// ---------------------------------------------------------------------------------------------
console.log('account-admin edge function (local)\n');

const admin = await adminTwoStepToken();
const tutor = await signIn('tutor@local.test');
const tutorId = tutor.user.id;
const newAdminId = sql("select id from auth.users where email = 'newadmin@local.test'");

// Who may call it
check(
  'No token → refused',
  [401, 403].includes((await accountAdmin(undefined, { action: 'invite' })).status),
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
const inviteMail = await latestMail();
check(
  'Invite: e-mail went to the invitee',
  inviteMail.To[0].Address === email,
  inviteMail.To[0].Address,
);
check('Invite: worded for staff', (await mailText(inviteMail)).includes('staff portal'));
check(
  'Invite: same e-mail again → already_exists',
  (await accountAdmin(admin.aal2, { action: 'invite', email, fullName: 'New Tutor' })).json
    ?.code === 'already_exists',
);

// Resend and cancel
check(
  'Resend invite: ok',
  (await accountAdmin(admin.aal2, { action: 'resend-invite', userId: inviteeId })).json?.ok ===
    true,
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
const kidMail = await latestMail();
check('Invite student: e-mail went to the student', kidMail.To[0].Address === kidEmail);
check('Invite student: worded for students', (await mailText(kidMail)).includes('student portal'));
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
    (await mailText(await latestMail())).includes('student portal'),
);

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
  (await mailText(await latestMail())).includes('parent portal'),
);
check(
  'Invite parent: same parent again → already_linked',
  (await inviteParent({ email: parentEmail })).json?.code === 'already_linked',
);
const existingParent = await inviteParent({ email: 'parent@local.test' });
check(
  'Invite parent: an existing parent is linked, not re-invited',
  existingParent.json?.ok === true && existingParent.json?.data?.linked === true,
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
