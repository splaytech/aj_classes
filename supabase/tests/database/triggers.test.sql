-- Triggers: profile creation, sync from auth.users, updated_at, admin-edit audit (design §6.2).

begin;
select no_plan();
select tests.remove_all_accounts();

-- A new auth user gets a tutor profile, even if they try to claim a role in their metadata.
insert into auth.users (id, aud, role, email, invited_at, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', 'New.Person@Test.Local', now(),
  '{"full_name": "  New Person  ", "role": "admin"}'
);

select results_eq(
  $$ select email, full_name, role::text, is_active, joined_at is null
     from public.profiles where id = '00000000-0000-0000-0000-0000000000e1' $$,
  $$ values ('new.person@test.local', 'New Person', 'tutor', true, true) $$,
  'A new auth user gets a tutor profile: email lower-cased, name trimmed, role metadata ignored'
);

-- Clicking the invite link (e-mail confirmed, signed in) does NOT make the account joined: only
-- finishing /portal/join does (invite-onboarding design). Sign-in is still copied, without
-- touching updated_at.
update public.profiles set updated_at = '2000-01-01' where id = '00000000-0000-0000-0000-0000000000e1';
update auth.users set email_confirmed_at = now(), last_sign_in_at = now()
where id = '00000000-0000-0000-0000-0000000000e1';

select results_eq(
  $$ select status::text, joined_at is null, last_sign_in_at is not null, updated_at = '2000-01-01'
     from public.profiles where id = '00000000-0000-0000-0000-0000000000e1' $$,
  $$ values ('invited', true, true, true) $$,
  'Clicking the invite link leaves the account invited; sign-in is copied; updated_at unchanged'
);

update public.profiles set bio = 'Hello' where id = '00000000-0000-0000-0000-0000000000e1';
select isnt(
  (select updated_at from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'),
  '2000-01-01'::timestamptz,
  'A real profile edit bumps updated_at'
);

-- Admin edits are audited (field names only); self edits are not.
select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
update public.profiles set bio = 'My own words' where id = '00000000-0000-0000-0000-0000000000e1';
reset role;

select is_empty(
  $$ select id from public.audit_log where action = 'profile_edited_by_admin' $$,
  'Editing your own profile is not audited'
);

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
update public.profiles set bio = 'Tidied by admin', full_name = 'New Person'
where id = '00000000-0000-0000-0000-0000000000e1';
reset role;

select results_eq(
  $$ select actor_id, target_id, details from public.audit_log where action = 'profile_edited_by_admin' $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000e1'::uuid,
             '{"fields": ["bio"]}'::jsonb) $$,
  'An admin edit is audited with only the fields that changed'
);

-- Deleting the auth user (cancelled invite) removes the profile and keeps the audit entry.
delete from auth.users where id = '00000000-0000-0000-0000-0000000000e1';

select is_empty(
  $$ select id from public.profiles where id = '00000000-0000-0000-0000-0000000000e1' $$,
  'Deleting the auth user deletes the profile'
);
select isnt_empty(
  $$ select id from public.audit_log where action = 'profile_edited_by_admin' and target_id is null $$,
  'Audit entries survive, with the target cleared'
);

select * from finish();
rollback;
