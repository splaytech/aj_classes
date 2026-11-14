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

select * from finish();
rollback;
