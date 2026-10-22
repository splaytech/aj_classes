-- Test helpers shared by every test file (runs first: files run in name order).
-- Lives only in the local test database; never part of a migration.

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Start each test file with no accounts and no audit history (the local seed and manual testing
-- add some). Rolled back with the test.
create or replace function tests.remove_all_accounts()
returns void
language sql
set search_path = ''
as $$
  delete from public.audit_log;
  delete from auth.users;
$$;

-- Start with no classes or students either (the local seed adds demo ones). Rolled back too.
create or replace function tests.remove_all_classes()
returns void
language sql
set search_path = ''
as $$
  delete from public.classes;
  delete from public.students;
$$;

-- A staff account with a fixed id, created the way Supabase Auth would (the trigger makes the profile).
create or replace function tests.create_staff(
  p_id uuid,
  p_email text,
  p_role public.app_role default 'tutor',
  p_joined boolean default true,
  p_active boolean default true
)
returns uuid
language plpgsql
set search_path = ''
as $$
begin
  insert into auth.users (id, aud, role, email, invited_at, email_confirmed_at, raw_user_meta_data)
  values (
    p_id, 'authenticated', 'authenticated', p_email, now(),
    case when p_joined then now() end,
    jsonb_build_object('full_name', 'Test ' || split_part(p_email, '@', 1))
  );

  -- "Joined" means onboarding is done: active, with a password (invite-onboarding design).
  if p_joined then
    update auth.users set encrypted_password = 'test-hash' where id = p_id;
  end if;
  update public.profiles
  set role = p_role,
      is_active = p_active,
      status = case when p_joined then 'active'::public.account_status else 'invited' end,
      joined_at = case when p_joined then now() end
  where id = p_id;
  return p_id;
end;
$$;

-- A student or parent account. The role is in server-only app_metadata, as the account-admin
-- function sets it (R3b design D2); the trigger makes the profile.
create or replace function tests.create_family_account(
  p_id uuid,
  p_email text,
  p_role text,
  p_joined boolean default true,
  p_active boolean default true
)
returns uuid
language plpgsql
set search_path = ''
as $$
begin
  insert into auth.users (id, aud, role, email, invited_at, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  values (
    p_id, 'authenticated', 'authenticated', p_email, now(),
    case when p_joined then now() end,
    jsonb_build_object('provider', 'email', 'account_role', p_role),
    jsonb_build_object('full_name', 'Test ' || split_part(p_email, '@', 1))
  );

  if p_joined then
    update auth.users set encrypted_password = 'test-hash' where id = p_id;
  end if;
  update public.profiles
  set is_active = p_active,
      status = case when p_joined then 'active'::public.account_status else 'invited' end,
      joined_at = case when p_joined then now() end
  where id = p_id;
  return p_id;
end;
$$;

-- A confirmed authenticator app, as if the person finished two-step setup.
create or replace function tests.add_verified_factor(p_user_id uuid)
returns void
language sql
set search_path = ''
as $$
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
  values (gen_random_uuid(), p_user_id, 'Phone', 'totp', 'verified', now(), now(), 'TESTSECRET')
$$;

-- Act as a signed-in user for the rest of the transaction. Undo with `reset role;`.
create or replace function tests.authenticate_as(p_user_id uuid, p_aal text default 'aal1')
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Act as a signed-out visitor. Undo with `reset role;`.
create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

begin;
select plan(1);
select has_function('tests', 'create_staff', 'test helpers are installed');
select * from finish();
rollback;
