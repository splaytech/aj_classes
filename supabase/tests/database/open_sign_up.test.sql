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

select * from finish();
rollback;
