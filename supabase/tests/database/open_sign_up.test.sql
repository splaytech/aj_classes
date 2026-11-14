-- Open sign-up (ADR-0011, docs/delivery/2026-11-13-open-sign-up/03-design.md §3, §10 pgTAP-OS):
-- the user role, role mapping, the before-user-created hook, the linking and wipe triggers, the
-- finish step, the sign-up switch, the guards in existing functions, listing and promotion.

begin;
select no_plan();
select tests.remove_all_accounts();

-- #1 The user role exists
select ok('user' = any (enum_range(null::public.app_role)::text[]), 'public.app_role has the user value');

-- #2 Role mapping (§3.1, AC-28): no marker, an unknown one or 'admin' means user; never tutor
select is(private.role_from_app_metadata('{}'), 'user', 'No account_role maps to user');
select is(private.role_from_app_metadata('{"account_role":"x"}'), 'user', 'An unknown account_role maps to user');
select is(private.role_from_app_metadata('{"account_role":"admin"}'), 'user', 'account_role admin maps to user');
select is(private.role_from_app_metadata('{"account_role":"user"}'), 'user', 'account_role user maps to user');
select is(private.role_from_app_metadata('{"account_role":"tutor"}'), 'tutor', 'account_role tutor maps to tutor');
select is(private.role_from_app_metadata('{"account_role":"student"}'), 'student', 'account_role student maps to student');
select is(private.role_from_app_metadata('{"account_role":"parent"}'), 'parent', 'account_role parent maps to parent');
select is(private.role_from_app_metadata(null), 'user', 'Null app_metadata maps to user');
select col_default_is('public', 'profiles', 'role', 'user'::public.app_role, 'The profiles.role default is user');

-- Hostile user metadata (people can edit their own) never picks the role.
insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data)
values ('00000000-0000-0000-0000-00000000aa01', 'authenticated', 'authenticated', 'hostile1@test.local',
        '{"full_name":"Hostile One","role":"admin","account_role":"tutor"}', '{"provider":"email"}');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-00000000aa01'), 'user',
  'role and account_role in user metadata are ignored: the account is a user');
insert into auth.users (id, aud, role, email, raw_app_meta_data)
values ('00000000-0000-0000-0000-00000000aa02', 'authenticated', 'authenticated', 'hostile2@test.local',
        '{"account_role":"admin"}');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-00000000aa02'), 'user',
  'account_role admin in app_metadata gives a user, not an admin or a tutor');
insert into auth.users (id, aud, role, email, raw_app_meta_data)
values ('00000000-0000-0000-0000-00000000aa03', 'authenticated', 'authenticated', 'staff@test.local',
        '{"account_role":"tutor"}');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-00000000aa03'), 'tutor',
  'A staff invite (account_role tutor) still makes a tutor');

-- #3 The before-user-created hook (§3.5; S1, AC-28, AC-45, AC-46, AC-48, AC-53)
-- An event shaped like the one captured in 05-dev-notes.md (S1(a)). Lives only in this transaction.
create function tests.sign_up_event(
  p_provider text default 'email',
  p_email text default 'someone@test.local',
  p_user_metadata jsonb default '{"full_name":"Some Parent"}',
  p_app_metadata jsonb default '{}'
)
returns jsonb
language sql
set search_path = ''
as $$
  select jsonb_build_object(
    'user', jsonb_build_object(
      'id', gen_random_uuid(), 'aud', 'authenticated', 'role', '', 'email', p_email, 'phone', '',
      'identities', '[]'::jsonb, 'is_anonymous', false,
      'app_metadata', jsonb_build_object('provider', p_provider, 'providers', jsonb_build_array(p_provider)) || p_app_metadata,
      'user_metadata', p_user_metadata),
    'metadata', jsonb_build_object('name', 'before-user-created', 'ip_address', '127.0.0.1'))
$$;

delete from private.sign_up_emails;

select is(public.hook_before_user_created(tests.sign_up_event()), '{}'::jsonb,
  'An e-mail sign-up with a good name is allowed');
select is((select count(*)::int from private.sign_up_emails), 1, 'and it takes one cap slot');

select is(public.hook_before_user_created(tests.sign_up_event(p_app_metadata => '{"account_role":"tutor"}')),
  private.sign_up_refusal('sign_up_refused'), 'An incoming account_role is refused (AC-28)');
select is(public.hook_before_user_created(tests.sign_up_event(p_app_metadata => '{"account_role":"parent"}')),
  private.sign_up_refusal('sign_up_refused'), 'An incoming account_role parent is refused too');

select is(public.hook_before_user_created(tests.sign_up_event(p_user_metadata => '{"full_name":"A"}')),
  private.sign_up_refusal('invalid_name'), 'A one-character name is refused (AC-45)');
select is(public.hook_before_user_created(tests.sign_up_event(p_user_metadata => '{}')),
  private.sign_up_refusal('invalid_name'), 'A missing name is refused');
select is(public.hook_before_user_created(tests.sign_up_event(p_user_metadata => jsonb_build_object('full_name', 'Bad' || chr(10) || 'Name'))),
  private.sign_up_refusal('invalid_name'), 'A name with a newline is refused');
select is(public.hook_before_user_created(tests.sign_up_event(p_user_metadata => jsonb_build_object('full_name', 'Evil' || chr(8238) || 'Name'))),
  private.sign_up_refusal('invalid_name'), 'A name with a text-direction override is refused');
select is(public.hook_before_user_created(tests.sign_up_event(p_user_metadata => jsonb_build_object('full_name', repeat('a', 101)))),
  private.sign_up_refusal('invalid_name'), 'A 101-character name is refused');
select is((select count(*)::int from private.sign_up_emails), 1, 'Refusals take no cap slot');

-- Google (S1(e): email_verified is a JSON boolean; "true" is accepted too)
select is(public.hook_before_user_created(tests.sign_up_event('google', 'g@test.local', '{"email_verified":true,"full_name":"G P"}')),
  '{}'::jsonb, 'Google with email_verified true is allowed');
select is(public.hook_before_user_created(tests.sign_up_event('google', 'g@test.local', '{"email_verified":"true"}')),
  '{}'::jsonb, 'Google with email_verified "true" is allowed');
select is((select count(*)::int from private.sign_up_emails), 1, 'Google sign-ups are not counted');
select is(public.hook_before_user_created(tests.sign_up_event('google', 'g@test.local', '{"email_verified":false}')),
  private.sign_up_refusal('google_email_unverified'), 'Google with email_verified false is refused (AC-53)');
select is(public.hook_before_user_created(tests.sign_up_event('google', 'g@test.local', '{"email_verified":"false"}')),
  private.sign_up_refusal('google_email_unverified'), 'Google with email_verified "false" is refused');
select is(public.hook_before_user_created(tests.sign_up_event('google', 'g@test.local', '{}')),
  private.sign_up_refusal('google_email_unverified'), 'Google with no email_verified is refused');
select is(public.hook_before_user_created(tests.sign_up_event('google', '', '{"email_verified":true}')),
  private.sign_up_refusal('google_email_unverified'), 'Google with an empty e-mail is refused');

select is(public.hook_before_user_created(tests.sign_up_event('apple')),
  private.sign_up_refusal('sign_up_refused'), 'Any other provider is refused (fail closed)');
select is(public.hook_before_user_created(tests.sign_up_event('facebook')),
  private.sign_up_refusal('sign_up_refused'), 'Facebook is refused');

-- The cap (AC-46): 24-hour window, 15 a day
delete from private.sign_up_emails;
insert into private.sign_up_emails (created_at)
select now() - interval '25 hours' from generate_series(1, 20);
select is(public.hook_before_user_created(tests.sign_up_event()), '{}'::jsonb,
  'Rows older than 24 hours don''t count');
select is((select count(*)::int from private.sign_up_emails), 1, 'and they are purged');

delete from private.sign_up_emails;
insert into private.sign_up_emails (created_at) select now() from generate_series(1, 14);
select is(public.hook_before_user_created(tests.sign_up_event()), '{}'::jsonb,
  'With 14 planted, the next sign-up is allowed');
select is(public.hook_before_user_created(tests.sign_up_event()), private.sign_up_refusal('sign_up_busy'),
  'and the one after is busy (15 a day)');
select is(public.hook_before_user_created(tests.sign_up_event('google', 'g@test.local', '{"email_verified":true}')),
  '{}'::jsonb, 'Google still works when the e-mail cap is full (no e-mail is sent)');

-- The switch (AC-48)
update private.sign_up_settings set open = false;
select is(public.hook_before_user_created(tests.sign_up_event()), private.sign_up_refusal('sign_up_closed'),
  'Closed: an e-mail sign-up is refused');
select is(public.hook_before_user_created(tests.sign_up_event('google', 'g@test.local', '{"email_verified":true}')),
  private.sign_up_refusal('sign_up_closed'), 'Closed: a Google sign-up is refused');
delete from private.sign_up_settings;
select is(public.hook_before_user_created(tests.sign_up_event()), private.sign_up_refusal('sign_up_closed'),
  'A missing settings row counts as closed');
insert into private.sign_up_settings default values;
delete from private.sign_up_emails;

-- S1(c): Auth's role can run the hook, and the hook (security definer) can read private.*
select ok(has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute'),
  'supabase_auth_admin can execute the hook');
select ok(has_schema_privilege('supabase_auth_admin', 'public', 'usage'),
  'supabase_auth_admin has usage on schema public');
select ok(not has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'execute')
          and not has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute'),
  'Nobody else can call the hook');
select ok((select prosecdef from pg_proc where oid = 'public.hook_before_user_created(jsonb)'::regprocedure),
  'The hook is security definer');
select is((select proconfig from pg_proc where oid = 'public.hook_before_user_created(jsonb)'::regprocedure),
  array['search_path=""'], 'The hook has an empty search_path');
select ok(has_table_privilege((select proowner::regrole::text from pg_proc
                               where oid = 'public.hook_before_user_created(jsonb)'::regprocedure),
                              'private.sign_up_emails', 'select, insert, delete')
          and has_table_privilege((select proowner::regrole::text from pg_proc
                                   where oid = 'public.hook_before_user_created(jsonb)'::regprocedure),
                                  'private.sign_up_settings', 'select'),
  'The hook''s owner can read and write the private tables');
select ok(not has_table_privilege('anon', 'private.sign_up_settings', 'select')
          and not has_table_privilege('authenticated', 'private.sign_up_emails', 'select'),
  'The API roles can''t read the private tables');
select ok((select bool_and(relrowsecurity) from pg_class
           where oid in ('private.sign_up_settings'::regclass, 'private.sign_up_emails'::regclass)),
  'RLS is on for both private tables');

-- #4 The linking rule (§3.6, S3, AC-52, AC-54, AC-14 case 2)
create function tests.google_identity_sql(p_user uuid)
returns text
language sql
set search_path = ''
as $$
  select format(
    'insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at) '
    'values (gen_random_uuid(), %L, %L, %L, ''google'', now(), now())',
    p_user, 'google-sub-' || p_user, jsonb_build_object('sub', 'google-sub-' || p_user, 'email_verified', true))
$$;

-- Nothing matches (GoTrue just created this account for the Google sign-in): allowed.
insert into auth.users (id, aud, role, email, raw_app_meta_data)
values ('00000000-0000-0000-0000-00000000bb01', 'authenticated', 'authenticated', 'new-google@test.local',
        '{"provider":"google","providers":["google"]}');
select lives_ok(tests.google_identity_sql('00000000-0000-0000-0000-00000000bb01'),
  'A brand-new Google account gets its Google identity (AC-52)');
select is((select role::text || '/' || status::text from public.profiles where id = '00000000-0000-0000-0000-00000000bb01'),
  'user/invited', 'and it is a user, invited, until the finish step');
select throws_ok(
  format('insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at) '
         'values (gen_random_uuid(), %L, %L, ''{}'', ''google'', now(), now())',
         '00000000-0000-0000-0000-00000000bb01', 'another-google-sub'),
  '42501', 'identity_link_refused', 'A second Google identity on it is refused');

-- Every existing account is refused.
select tests.create_sign_up('00000000-0000-0000-0000-00000000bb02', 'unconfirmed@test.local', p_confirmed => false, p_finished => false);
select throws_ok(tests.google_identity_sql('00000000-0000-0000-0000-00000000bb02'), '42501', 'identity_link_refused',
  'S3 order: Google can''t attach to an unconfirmed e-mail sign-up whose e-mail identity is still there (AC-14 case 2)');
select tests.create_sign_up('00000000-0000-0000-0000-00000000bb03', 'confirmed-unfinished@test.local', p_finished => false);
select throws_ok(tests.google_identity_sql('00000000-0000-0000-0000-00000000bb03'), '42501', 'identity_link_refused',
  'Google can''t attach to a confirmed, unfinished e-mail sign-up');
select tests.create_sign_up('00000000-0000-0000-0000-00000000bb04', 'finished@test.local');
select throws_ok(tests.google_identity_sql('00000000-0000-0000-0000-00000000bb04'), '42501', 'identity_link_refused',
  'Google can''t attach to a finished e-mail user');
select tests.create_sign_up('00000000-0000-0000-0000-00000000bb05', 'deactivated@test.local', p_active => false);
select throws_ok(tests.google_identity_sql('00000000-0000-0000-0000-00000000bb05'), '42501', 'identity_link_refused',
  'Google can''t attach to a deactivated user');
select tests.create_staff('00000000-0000-0000-0000-00000000bb06', 'tutor@test.local');
select throws_ok(tests.google_identity_sql('00000000-0000-0000-0000-00000000bb06'), '42501', 'identity_link_refused',
  'Google can''t attach to a tutor');
select tests.create_staff('00000000-0000-0000-0000-00000000bb07', 'admin@test.local', 'admin');
select throws_ok(tests.google_identity_sql('00000000-0000-0000-0000-00000000bb07'), '42501', 'identity_link_refused',
  'Google can''t attach to an admin');
select tests.create_staff('00000000-0000-0000-0000-00000000bb08', 'invitee@test.local', p_joined => false);
select throws_ok(tests.google_identity_sql('00000000-0000-0000-0000-00000000bb08'), '42501', 'identity_link_refused',
  'Google can''t attach to an invitee');
select tests.create_family_account('00000000-0000-0000-0000-00000000bb09', 'parent@test.local', 'parent');
select throws_ok(tests.google_identity_sql('00000000-0000-0000-0000-00000000bb09'), '42501', 'identity_link_refused',
  'Google can''t attach to a parent');
select tests.create_family_account('00000000-0000-0000-0000-00000000bb10', 'student@test.local', 'student');
select throws_ok(tests.google_identity_sql('00000000-0000-0000-0000-00000000bb10'), '42501', 'identity_link_refused',
  'Google can''t attach to a student');

-- Other providers are refused; e-mail identities are untouched by the rule.
insert into auth.users (id, aud, role, email, raw_app_meta_data)
values ('00000000-0000-0000-0000-00000000bb11', 'authenticated', 'authenticated', 'new-apple@test.local',
        '{"provider":"apple","providers":["apple"]}');
select throws_ok(
  format('insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at) '
         'values (gen_random_uuid(), %L, ''apple-sub'', ''{}'', ''apple'', now(), now())',
         '00000000-0000-0000-0000-00000000bb11'),
  '42501', 'identity_link_refused', 'Any other provider is refused, even on a brand-new account');
select lives_ok(
  format('insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at) '
         'values (gen_random_uuid(), %L, %L, ''{}'', ''email'', now(), now())',
         '00000000-0000-0000-0000-00000000bb11', '00000000-0000-0000-0000-00000000bb11'),
  'An e-mail identity is always allowed (sign-up, invites)');

-- #5 The confirm-time wipe (§3.6, S6, AC-14 case 6)
select tests.create_sign_up('00000000-0000-0000-0000-00000000cc01', 'wipe@test.local', p_confirmed => false, p_finished => false);
select tests.add_verified_factor('00000000-0000-0000-0000-00000000cc01');
select is((select count(*)::int from auth.mfa_factors where user_id = '00000000-0000-0000-0000-00000000cc01'), 1,
  'Before confirmation: a stored password and an authenticator');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000cc01';
select is((select encrypted_password from auth.users where id = '00000000-0000-0000-0000-00000000cc01'), null,
  'Confirming wipes the password stored before the mailbox was proven');
select is((select count(*)::int from auth.mfa_factors where user_id = '00000000-0000-0000-0000-00000000cc01'), 0,
  'and the authenticator added before it (AC-14 case 6)');
select is((select password_set_at from public.profiles where id = '00000000-0000-0000-0000-00000000cc01'), null,
  'and no password counts as set');

update auth.users set encrypted_password = 'chosen-later' where id = '00000000-0000-0000-0000-00000000cc01';
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000cc01';
select is((select encrypted_password from auth.users where id = '00000000-0000-0000-0000-00000000cc01'), 'chosen-later',
  'A later confirm update (already confirmed) leaves the password alone');

-- Not a user: nothing is wiped (staff, families and invitees).
select tests.create_staff('00000000-0000-0000-0000-00000000cc02', 'staff-unconfirmed@test.local', p_joined => false);
update auth.users set encrypted_password = 'staff-hash' where id = '00000000-0000-0000-0000-00000000cc02';
select tests.add_verified_factor('00000000-0000-0000-0000-00000000cc02');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000cc02';
select is((select encrypted_password from auth.users where id = '00000000-0000-0000-0000-00000000cc02'), 'staff-hash',
  'Confirming a staff invitee keeps its password');
select is((select count(*)::int from auth.mfa_factors where user_id = '00000000-0000-0000-0000-00000000cc02'), 1,
  'and its authenticator');

select ok((select prosecdef from pg_proc where oid = 'private.wipe_unproven_credentials()'::regprocedure)
          and (select prosecdef from pg_proc where oid = 'private.check_identity_link()'::regprocedure),
  'Both trigger functions are security definer');

-- #6 The finish step (§3.3, §3.7; S5, AC-6, AC-7, AC-17, AC-20, AC-24, AC-45, AC-52)
-- A confirmed, unfinished e-mail sign-up with a password chosen at the start of the session.
create function tests.ready_to_finish(p_id uuid, p_provider text default 'email')
returns uuid
language plpgsql
set search_path = ''
as $$
begin
  perform tests.create_sign_up(p_id, 'finish-' || right(p_id::text, 4) || '@test.local', p_provider,
                               p_confirmed => true, p_finished => false);
  if p_provider = 'email' then
    update auth.users set encrypted_password = 'chosen-in-session' where id = p_id;
  end if;
  return p_id;
end;
$$;

-- The amr matrix: [otp], [recovery], [oauth] save.
select tests.ready_to_finish('00000000-0000-0000-0000-00000000dd01');
select tests.add_verified_factor('00000000-0000-0000-0000-00000000dd01');
insert into auth.sessions (id, user_id, created_at, updated_at, aal)
values ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-00000000dd01', now(), now(), 'aal1');
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd01', array['otp']);
select results_eq($$ select full_name, email, signed_up_with, can_finish from public.my_sign_up() $$,
  $$ values ('Signed Up finish-dd01', 'finish-dd01@test.local', 'email', true) $$,
  'my_sign_up: the caller''s row, e-mail, and can_finish in a link session');
select ok(public.my_has_password(), 'my_has_password: true once a password is chosen (AC-24)');
select throws_ok($$ select public.complete_sign_up('Finished Parent', false) $$, 'P0001', 'terms_required',
  'No tick: terms_required (AC-7)');
select throws_ok($$ select public.complete_sign_up('A', true) $$, 'P0001', 'invalid_name',
  'A one-character name: invalid_name (AC-4)');
select lives_ok($$ select public.complete_sign_up('  Finished Parent  ', true) $$,
  'An [otp] session (confirmation or Forgot-password link) saves the finish step');
select is_empty($$ select 1 from public.my_sign_up() $$, 'my_sign_up has no row once finished');
reset role;
select results_eq(
  $$ select full_name, status::text, joined_at is not null, terms_accepted_at is not null, role::text
     from public.profiles where id = '00000000-0000-0000-0000-00000000dd01' $$,
  $$ values ('Finished Parent', 'active', true, true, 'user') $$,
  'Saving trims the name, records the Terms tick and makes the account an active user');
select is((select count(*)::int from auth.mfa_factors where user_id = '00000000-0000-0000-0000-00000000dd01'), 0,
  'Saving deletes every authenticator (AC-14 case 6)');
select is((select count(*)::int from auth.sessions where user_id = '00000000-0000-0000-0000-00000000dd01'), 1,
  'Saving deletes every other session and keeps this one');
select is_empty($$ select 1 from auth.sessions where id = '00000000-0000-0000-0000-0000000005e1' $$,
  'The other session is the one that went');
select results_eq(
  $$ select actor_id, details from public.audit_log
     where action = 'account_activated' and target_id = '00000000-0000-0000-0000-00000000dd01' $$,
  $$ values ('00000000-0000-0000-0000-00000000dd01'::uuid, '{"role": "user", "via": "email"}'::jsonb) $$,
  'Saving is audited as account_activated {role: user, via: email}');

select tests.ready_to_finish('00000000-0000-0000-0000-00000000dd02');
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd02', array['recovery']);
select lives_ok($$ select public.complete_sign_up('Recovery Parent', true) $$, 'A [recovery] session saves');
reset role;

-- Google (AC-52): an [oauth] session saves with no password at all.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000dd03', 'authenticated', 'authenticated', 'google-finish@test.local',
        '{"provider":"google","providers":["google"]}', '{"full_name":"Google Parent"}');
select lives_ok(tests.google_identity_sql('00000000-0000-0000-0000-00000000dd03'), 'A new Google account');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000dd03';
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd03', array['oauth']);
select results_eq($$ select signed_up_with, can_finish from public.my_sign_up() $$,
  $$ values ('google', true) $$, 'my_sign_up: a Google account in an [oauth] session');
select ok(not public.my_has_password(), 'my_has_password: false for a Google-only account');
select lives_ok($$ select public.complete_sign_up('Google Parent', true) $$,
  'An [oauth] session saves a Google account with no password (AC-52)');
reset role;
select is((select details ->> 'via' from public.audit_log
           where action = 'account_activated' and target_id = '00000000-0000-0000-0000-00000000dd03'),
  'google', 'and the audit says via google');

-- Refused: [password], [token_refresh], [otp, unknown], [] and no amr claim (fail closed).
select tests.ready_to_finish('00000000-0000-0000-0000-00000000dd04');
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd04', array['password']);
select is((select can_finish from public.my_sign_up()), false, 'my_sign_up: can_finish false in a password session');
select throws_ok($$ select public.complete_sign_up('Some Parent', true) $$, '42501', 'sign_up_link_needed',
  '[password] is refused: sign_up_link_needed (AC-17, AC-20)');
reset role;
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd04', array['token_refresh']);
select throws_ok($$ select public.complete_sign_up('Some Parent', true) $$, '42501', 'sign_up_link_needed',
  '[token_refresh] is refused');
reset role;
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd04', array['otp', 'unknown']);
select throws_ok($$ select public.complete_sign_up('Some Parent', true) $$, '42501', 'sign_up_link_needed',
  '[otp, unknown] is refused: every entry must be a link method (review-3 item 6)');
reset role;
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd04', array['otp', 'password']);
select throws_ok($$ select public.complete_sign_up('Some Parent', true) $$, '42501', 'sign_up_link_needed',
  '[otp, password] is refused');
reset role;
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd04', array[]::text[]);
select throws_ok($$ select public.complete_sign_up('Some Parent', true) $$, '42501', 'sign_up_link_needed',
  'An empty amr is refused');
reset role;
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd04', null);
select throws_ok($$ select public.complete_sign_up('Some Parent', true) $$, '42501', 'sign_up_link_needed',
  'A missing amr claim is refused');
reset role;
select is((select status::text from public.profiles where id = '00000000-0000-0000-0000-00000000dd04'), 'invited',
  'After every refusal the account is still invited');

-- An e-mail account must choose its password in this session.
select tests.ready_to_finish('00000000-0000-0000-0000-00000000dd05');
update public.profiles set password_set_at = now() - interval '1 minute' where id = '00000000-0000-0000-0000-00000000dd05';
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd05', array['otp']);
select throws_ok($$ select public.complete_sign_up('Some Parent', true) $$, 'P0001', 'password_not_set',
  'A password set before this session doesn''t count: password_not_set (AC-6)');
reset role;
update public.profiles set password_set_at = null where id = '00000000-0000-0000-0000-00000000dd05';
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd05', array['otp']);
select throws_ok($$ select public.complete_sign_up('Some Parent', true) $$, 'P0001', 'password_not_set',
  'No password at all: password_not_set');
reset role;
select is((select status::text from public.profiles where id = '00000000-0000-0000-0000-00000000dd05'), 'invited',
  'and the account stays invited');

-- Not an unfinished user: not_invited.
select tests.create_sign_up('00000000-0000-0000-0000-00000000dd06', 'unconfirmed-finish@test.local', p_confirmed => false, p_finished => false);
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd06', array['otp']);
select throws_ok($$ select public.complete_sign_up('Some Parent', true) $$, '42501', 'not_invited',
  'An unconfirmed account can''t finish (defence)');
reset role;
select tests.create_family_account('00000000-0000-0000-0000-00000000dd07', 'invited-parent@test.local', 'parent', p_joined => false);
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd07', array['otp']);
select throws_ok($$ select public.complete_sign_up('Some Parent', true) $$, '42501', 'not_invited',
  'An invited parent uses complete_onboarding, not this');
select is_empty($$ select 1 from public.my_sign_up() $$, 'and my_sign_up has no row for them');
reset role;
select tests.create_sign_up('00000000-0000-0000-0000-00000000dd08', 'inactive-finish@test.local', p_finished => false, p_active => false);
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000dd08', array['otp']);
select throws_ok($$ select public.complete_sign_up('Some Parent', true) $$, '42501', 'not_invited',
  'A deactivated sign-up can''t finish');
reset role;

-- Grants
select ok(has_function_privilege('authenticated', 'public.complete_sign_up(text, boolean)', 'execute')
          and not has_function_privilege('anon', 'public.complete_sign_up(text, boolean)', 'execute'),
  'complete_sign_up: authenticated only');
select ok(has_function_privilege('authenticated', 'public.my_sign_up()', 'execute')
          and not has_function_privilege('anon', 'public.my_sign_up()', 'execute')
          and has_function_privilege('authenticated', 'public.my_has_password()', 'execute')
          and not has_function_privilege('anon', 'public.my_has_password()', 'execute'),
  'my_sign_up and my_has_password: authenticated only');
select ok(not has_function_privilege('authenticated', 'private.session_can_finish_sign_up()', 'execute')
          and not has_function_privilege('authenticated', 'private.signed_up_with(uuid)', 'execute'),
  'The private helpers are not callable from the API');

-- #7 Sign-up status and the admin switch (§3.7, §3.9; AC-46, AC-48)
delete from private.sign_up_emails;
select is(public.sign_up_status(), 'open', 'sign_up_status: open');
insert into private.sign_up_emails (created_at) select now() from generate_series(1, 15);
select is(public.sign_up_status(), 'busy', 'sign_up_status: busy with 15 in the last 24 hours');
update private.sign_up_emails set created_at = now() - interval '25 hours';
select is(public.sign_up_status(), 'open', 'sign_up_status: rows older than 24 hours don''t count');
delete from private.sign_up_emails;
update private.sign_up_settings set open = false;
select is(public.sign_up_status(), 'closed', 'sign_up_status: closed when the switch is off');
delete from private.sign_up_settings;
select is(public.sign_up_status(), 'closed', 'sign_up_status: closed when the settings row is missing');
insert into private.sign_up_settings default values;
select ok(has_function_privilege('anon', 'public.sign_up_status()', 'execute'),
  'sign_up_status: the signed-out sign-up page can read it');

delete from public.audit_log;
select tests.create_staff('00000000-0000-0000-0000-00000000ee01', 'switch-admin@test.local', 'admin');
select tests.create_staff('00000000-0000-0000-0000-00000000ee02', 'switch-tutor@test.local');
select tests.authenticate_as('00000000-0000-0000-0000-00000000ee02', 'aal2');
select throws_ok($$ select public.admin_set_sign_up_open(false) $$, '42501', 'not_admin', 'A tutor can''t close sign-up');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-00000000ee01', 'aal1');
select throws_ok($$ select public.admin_set_sign_up_open(false) $$, '42501', 'not_admin',
  'An admin without two-step (aal1) can''t close sign-up');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-00000000ee01', 'aal2');
select throws_ok($$ select public.admin_set_sign_up_open(null) $$, 'P0001', 'invalid_input', 'Null: invalid_input');
select lives_ok($$ select public.admin_set_sign_up_open(true) $$, 'Opening when already open is a no-op');
select lives_ok($$ select public.admin_set_sign_up_open(false) $$, 'An admin at aal2 closes sign-up');
reset role;
select is(public.sign_up_status(), 'closed', 'and the status is closed');
select results_eq($$ select open, updated_by from private.sign_up_settings $$,
  $$ values (false, '00000000-0000-0000-0000-00000000ee01'::uuid) $$, 'The switch records who changed it');
select is(public.hook_before_user_created(tests.sign_up_event()), private.sign_up_refusal('sign_up_closed'),
  'and the hook now refuses sign-ups');
select tests.authenticate_as('00000000-0000-0000-0000-00000000ee01', 'aal2');
select lives_ok($$ select public.admin_set_sign_up_open(false) $$, 'Closing again is a no-op');
select lives_ok($$ select public.admin_set_sign_up_open(true) $$, 'and reopening works');
reset role;
select is(public.sign_up_status(), 'open', 'Open again');
select results_eq(
  $$ select action, actor_id, target_id, details from public.audit_log
     where action in ('sign_up_opened', 'sign_up_closed') order by created_at, id $$,
  $$ values ('sign_up_closed', '00000000-0000-0000-0000-00000000ee01'::uuid, null::uuid, '{}'::jsonb),
            ('sign_up_opened', '00000000-0000-0000-0000-00000000ee01'::uuid, null::uuid, '{}'::jsonb) $$,
  'One audit row per real change, none for a no-op');
select ok(not has_function_privilege('anon', 'public.admin_set_sign_up_open(boolean)', 'execute'),
  'Signed-out visitors can''t call the switch');

-- #8 Guards in existing functions (§3.8; AC-28, AC-31, AC-32, AC-40, AC-41)
select tests.ready_to_finish('00000000-0000-0000-0000-00000000ff01');
select tests.authenticate_with_session('00000000-0000-0000-0000-00000000ff01', array['otp']);
select throws_ok($$ select public.complete_onboarding('Sneaky User', null, null, true) $$, '42501', 'not_invited',
  'complete_onboarding refuses a signed-up user (not_invited): no path to tutor (AC-28)');
select is_empty($$ select 1 from public.my_onboarding() $$,
  'my_onboarding returns no row for an unfinished user (mobile never sees "invited") (AC-40)');
reset role;
select is((select role::text || '/' || status::text from public.profiles where id = '00000000-0000-0000-0000-00000000ff01'),
  'user/invited', 'and the account is unchanged');

select tests.create_staff('00000000-0000-0000-0000-00000000ff02', 'guard-admin@test.local', 'admin');
select tests.create_sign_up('00000000-0000-0000-0000-00000000ff03', 'guard-unfinished@test.local', p_finished => false);
select tests.create_sign_up('00000000-0000-0000-0000-00000000ff04', 'guard-finished@test.local');
select tests.create_staff('00000000-0000-0000-0000-00000000ff05', 'guard-invitee@test.local', p_joined => false);
select tests.authenticate_as('00000000-0000-0000-0000-00000000ff02', 'aal2');
select lives_ok($$ select public.admin_set_active('00000000-0000-0000-0000-00000000ff03', false) $$,
  'admin_set_active deactivates an unfinished user (AC-32)');
select lives_ok($$ select public.admin_set_active('00000000-0000-0000-0000-00000000ff04', false) $$,
  'and a finished user');
select lives_ok($$ select public.admin_set_active('00000000-0000-0000-0000-00000000ff03', true) $$,
  'and reactivates the unfinished one');
select throws_ok($$ select public.admin_set_active('00000000-0000-0000-0000-00000000ff05', false) $$, 'P0001', 'not_joined',
  'A staff invitee still can''t be deactivated (unchanged: cancel the invite instead)');
reset role;
select results_eq(
  $$ select id, is_active from public.profiles
     where id in ('00000000-0000-0000-0000-00000000ff03', '00000000-0000-0000-0000-00000000ff04') order by id $$,
  $$ values ('00000000-0000-0000-0000-00000000ff03'::uuid, true), ('00000000-0000-0000-0000-00000000ff04'::uuid, false) $$,
  'The deactivations stuck');
select is((select count(*)::int from public.audit_log
           where actor_id = '00000000-0000-0000-0000-00000000ff02' and action in ('deactivated', 'reactivated')),
  3, 'Each change is audited');

-- The mobile app's columns keep their names (AC-41).
select has_column('public', 'profiles', 'role', 'profiles.role is still there');
select has_column('public', 'profiles', 'full_name', 'profiles.full_name is still there');
select has_column('public', 'profiles', 'is_active', 'profiles.is_active is still there');
select has_column('public', 'profiles', 'invited_at', 'profiles.invited_at is still there');

select * from finish();
rollback;
