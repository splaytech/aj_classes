-- Open sign-up for parents and guardians (ADR-0011).
-- Design: docs/delivery/2026-11-13-open-sign-up/03-design.md §3. Objects are in the design's order;
-- the order matters (existing accounts are confirmed before the wipe trigger exists).

-- ---------------------------------------------------------------------------
-- §3.1 Role mapping and default: no role marker means a signed-up user, never a tutor
-- ---------------------------------------------------------------------------

-- 'tutor', 'student' or 'parent' from server-only app_metadata (account-admin always sets one).
-- Anything else, or nothing, is a signed-up user. 'admin' is never taken from metadata: admins are
-- made only by admin_set_role or SQL.
create or replace function private.role_from_app_metadata(app_metadata jsonb)
returns public.app_role
language sql
immutable
set search_path = ''
as $$
  select case app_metadata ->> 'account_role'
           when 'tutor' then 'tutor'::public.app_role
           when 'student' then 'student'::public.app_role
           when 'parent' then 'parent'::public.app_role
           else 'user'::public.app_role
         end
$$;

alter table public.profiles alter column role set default 'user';

comment on table public.profiles is
  'One row per account: staff (tutor, admin), families (student, parent) and signed-up users (user). Created by a trigger on auth.users.';

-- ---------------------------------------------------------------------------
-- §3.2 Confirm existing non-user accounts (AC-42)
-- ---------------------------------------------------------------------------

-- E-mail confirmations are now on. Staff, students and parents were all created by AJ Classes
-- (invites, Studio), so their addresses count as confirmed and nobody is locked out. This runs
-- before the confirm-time wipe trigger (§3.6) exists, so no password is touched.
update auth.users u set email_confirmed_at = now()
where u.email_confirmed_at is null
  and exists (select 1 from public.profiles p where p.id = u.id and p.role <> 'user');

-- ---------------------------------------------------------------------------
-- §3.3 Private helpers
-- ---------------------------------------------------------------------------

-- The most new e-mail sign-ups let through in 24 hours (AC-46, Decision 3: Resend Free).
create function private.sign_up_daily_cap()
returns int
language sql
immutable
set search_path = ''
as $$
  select 15
$$;

-- 2–100 characters, no control characters (newlines, tabs) and no text-direction overrides: the
-- same rule as complete_onboarding (20261023110000_onboarding_consents.sql).
create function private.is_valid_full_name(name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    char_length(name) between 2 and 100 and name !~ '[[:cntrl:]‪-‮⁦-⁩]',
    false
  )
$$;

-- The before-user-created hook's refusal. Auth turns it into an HTTP 429 whose message is reason.
create function private.sign_up_refusal(reason text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('error', jsonb_build_object('http_code', 429, 'message', reason))
$$;

revoke execute on function private.sign_up_daily_cap() from public, anon, authenticated;
revoke execute on function private.is_valid_full_name(text) from public, anon, authenticated;
revoke execute on function private.sign_up_refusal(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- §3.4 The sign-up switch (kill switch) and the daily cap
-- ---------------------------------------------------------------------------

create table private.sign_up_settings (
  id         boolean primary key default true check (id),  -- exactly one row
  open       boolean not null default true,                -- Decision 1: open at release
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into private.sign_up_settings default values;

-- One row per new e-mail sign-up let through (AC-46). No e-mail or user id: the cap only needs
-- a count (APP 3, collect the minimum).
create table private.sign_up_emails (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);
create index sign_up_emails_created_idx on private.sign_up_emails (created_at);

revoke all on table private.sign_up_settings, private.sign_up_emails from public, anon, authenticated;
alter table private.sign_up_settings enable row level security;   -- no policies
alter table private.sign_up_emails enable row level security;     -- no policies

-- ---------------------------------------------------------------------------
-- §3.5 The before-user-created hook (Supabase Auth calls it for every new account made by
-- sign-up: e-mail signUp, OAuth and id_token. Not for admin createUser, so invites are never
-- capped or closed.)
-- ---------------------------------------------------------------------------

create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_user constant jsonb := event -> 'user';
  provider constant text := new_user -> 'app_metadata' ->> 'provider';
begin
  -- One lock for every new account, so two sign-ups at once can't both take the last slot.
  perform pg_advisory_xact_lock(hashtext('open_sign_up.new_account'));

  -- A missing settings row counts as closed (fail closed).
  if coalesce((select s.open from private.sign_up_settings s), false) is not true then
    return private.sign_up_refusal('sign_up_closed');
  end if;

  -- Only the server sets a role marker (account-admin, with createUser, which skips this hook).
  if new_user -> 'app_metadata' ? 'account_role' then
    return private.sign_up_refusal('sign_up_refused');
  end if;

  if provider = 'google' then
    -- Google's own check of the address (S1(e): a JSON boolean; "true" is accepted too).
    if coalesce(new_user ->> 'email', '') = ''
       or coalesce(new_user -> 'user_metadata' ->> 'email_verified', '') <> 'true' then
      return private.sign_up_refusal('google_email_unverified');
    end if;
    return '{}'::jsonb; -- not counted: Google sign-ups send no e-mail
  end if;

  if provider is distinct from 'email' then
    return private.sign_up_refusal('sign_up_refused'); -- Apple, Facebook and the rest stay out
  end if;

  if not private.is_valid_full_name(trim(coalesce(new_user -> 'user_metadata' ->> 'full_name', ''))) then
    return private.sign_up_refusal('invalid_name');
  end if;

  delete from private.sign_up_emails e where e.created_at < now() - interval '24 hours';
  if (select count(*) from private.sign_up_emails) >= private.sign_up_daily_cap() then
    return private.sign_up_refusal('sign_up_busy');
  end if;

  insert into private.sign_up_emails default values;
  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin; -- review-3 item 3 (harmless if already there)
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
