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

-- ---------------------------------------------------------------------------
-- §3.6 Triggers: the linking rule
-- ---------------------------------------------------------------------------

-- A Google login may only attach to a brand-new account: one Auth has just created for that
-- Google sign-in (a user profile, invited, unconfirmed, with no identity yet). It never attaches
-- to an existing account, whatever its role or state (ADR-0011 linking policy, AC-54). GoTrue
-- inserts the new identity before it removes unconfirmed ones (external.go:322 then :416, S3), so
-- an unconfirmed e-mail sign-up still has its e-mail identity here and is refused.
create function private.check_identity_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider = 'email' then
    return new;
  end if;

  if new.provider = 'google'
     and exists (
       select 1
       from public.profiles p
       join auth.users u on u.id = p.id
       where p.id = new.user_id
         and p.role = 'user'
         and p.status = 'invited'
         and p.is_active
         and u.email_confirmed_at is null
     )
     and not exists (select 1 from auth.identities i where i.user_id = new.user_id) then
    return new;
  end if;

  raise exception 'identity_link_refused' using errcode = '42501';
end;
$$;

revoke execute on function private.check_identity_link() from public, anon, authenticated;

create trigger on_auth_identity_link_check
  before insert on auth.identities
  for each row
  execute function private.check_identity_link();

-- ---------------------------------------------------------------------------
-- §3.6 Triggers: the confirm-time wipe
-- ---------------------------------------------------------------------------

-- The moment a signed-up user proves the mailbox (confirmation or Forgot-password link), any
-- password or authenticator stored before then is wiped: whoever typed it hadn't proven they
-- own the address (AC-14). GoTrue's Confirm() writes only confirmation_token and
-- email_confirmed_at (models/user.go:529), so nothing writes the old hash back. Invitees are
-- confirmed when they are created, so this never touches them.
create function private.wipe_unproven_credentials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profiles p
    where p.id = new.id and p.role = 'user' and p.status = 'invited'
  ) then
    new.encrypted_password := null;
    delete from auth.mfa_factors f where f.user_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function private.wipe_unproven_credentials() from public, anon, authenticated;

create trigger on_auth_user_email_confirmed
  before update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.wipe_unproven_credentials();

-- ---------------------------------------------------------------------------
-- §3.3 Private helpers for the finish step
-- ---------------------------------------------------------------------------

-- 'google' when the account has a Google identity, else 'email'.
create function private.signed_up_with(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when exists (select 1 from auth.identities i where i.user_id = target and i.provider = 'google')
             then 'google'
           else 'email'
         end
$$;

-- True only when this session was made by an e-mail link (confirmation or Forgot password) or a
-- Google sign-in: every amr entry must be one of those methods. A password session, an unknown
-- method, an empty list or no claim at all gives false (fail closed, 02 Q4; review-3 item 6).
-- S5 (05-dev-notes.md): links give [otp], Google gives [oauth], and a refresh keeps the method.
create function private.session_can_finish_sign_up()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(auth.jwt() -> 'amr') = 'array'
    and jsonb_array_length(auth.jwt() -> 'amr') > 0
    and not exists (
      select 1
      from jsonb_array_elements(auth.jwt() -> 'amr') as entry
      where coalesce(entry ->> 'method', '') not in ('otp', 'recovery', 'email/signup', 'magiclink', 'oauth')
    ),
    false
  )
$$;

revoke execute on function private.signed_up_with(uuid) from public, anon, authenticated;
revoke execute on function private.session_can_finish_sign_up() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- §3.7 The finish step (/portal/join for a signed-up user)
-- ---------------------------------------------------------------------------

-- What the finish step needs: one row for the caller while they are an unfinished, active user.
create function public.my_sign_up()
returns table (full_name text, email text, signed_up_with text, can_finish boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name, p.email, private.signed_up_with(p.id), private.session_can_finish_sign_up()
  from public.profiles p
  where p.id = (select auth.uid())
    and p.role = 'user'
    and p.status = 'invited'
    and p.is_active
$$;

-- Saves the finish step: the name, the Terms tick and (for e-mail accounts) a password chosen in
-- this very session. Only from a session made by an e-mail link or Google (AC-17). All or nothing.
create function public.complete_sign_up(new_full_name text, accepts_terms boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := (select auth.uid());
  this_session constant uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  clean_name constant text := trim(coalesce(new_full_name, ''));
  set_at timestamptz;
  session_started timestamptz;
  via text;
begin
  -- Locks the row, so this can't race an invite replacing the sign-up (account-admin).
  select p.password_set_at into set_at
  from public.profiles p
  where p.id = me and p.role = 'user' and p.status = 'invited' and p.is_active
  for update;
  if not found then
    raise exception 'not_invited' using errcode = '42501';
  end if;

  if (select u.email_confirmed_at from auth.users u where u.id = me) is null then
    raise exception 'not_invited' using errcode = '42501';
  end if;

  if not private.session_can_finish_sign_up() then
    raise exception 'sign_up_link_needed' using errcode = '42501';
  end if;

  via := private.signed_up_with(me);
  if via = 'email' then
    select s.created_at into session_started
    from auth.sessions s
    where s.id = this_session and s.user_id = me;
    if session_started is null or set_at is null or set_at < session_started then
      raise exception 'password_not_set';
    end if;
  end if;

  if accepts_terms is not true then
    raise exception 'terms_required';
  end if;
  if not private.is_valid_full_name(clean_name) then
    raise exception 'invalid_name';
  end if;

  update public.profiles
  set full_name = clean_name,
      terms_accepted_at = now(),
      status = 'active',
      joined_at = now()
  where id = me;

  -- Anything added before this point by someone else is gone (AC-14 case 6).
  delete from auth.mfa_factors f where f.user_id = me;
  delete from auth.sessions s where s.user_id = me and s.id is distinct from this_session;

  insert into public.audit_log (actor_id, action, target_id, details)
  values (me, 'account_activated', me, jsonb_build_object('role', 'user', 'via', via));
end;
$$;

-- Whether the caller has a password (Account → Change password shows only then, AC-23).
create function public.my_has_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.encrypted_password from auth.users u where u.id = (select auth.uid())), '') <> ''
$$;

revoke execute on function public.my_sign_up() from public, anon, authenticated;
revoke execute on function public.complete_sign_up(text, boolean) from public, anon, authenticated;
revoke execute on function public.my_has_password() from public, anon, authenticated;
grant execute on function public.my_sign_up() to authenticated;
grant execute on function public.complete_sign_up(text, boolean) to authenticated;
grant execute on function public.my_has_password() to authenticated;

-- ---------------------------------------------------------------------------
-- §3.9 Audit actions: the sign-up switch (promotion reuses parent_linked, finishing reuses
-- account_activated). The list is copied from 20261023110000_onboarding_consents.sql.
-- ---------------------------------------------------------------------------

alter table public.audit_log
  drop constraint audit_log_action_check,
  add constraint audit_log_action_check check (action in (
    'invite_sent', 'invite_resent', 'invite_cancelled',
    'role_changed', 'deactivated', 'reactivated',
    'two_step_reset', 'profile_edited_by_admin',
    'student_invited', 'parent_invited', 'parent_linked', 'parent_unlinked', 'consent_recorded',
    'account_activated', 'consent_changed',
    'sign_up_opened', 'sign_up_closed'));

-- ---------------------------------------------------------------------------
-- §3.7 Sign-up status and the admin switch
-- ---------------------------------------------------------------------------

-- What the sign-up page and the Sign in link need: 'closed' (switch off, or no settings row),
-- 'busy' (the daily cap is reached), else 'open'.
create function public.sign_up_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when coalesce((select s.open from private.sign_up_settings s), false) is not true then 'closed'
           when (select count(*) from private.sign_up_emails e where e.created_at >= now() - interval '24 hours')
                >= private.sign_up_daily_cap() then 'busy'
           else 'open'
         end
$$;

-- Admin → Users → Close / Open sign-up (AC-48). Admins at aal2 only.
create function public.admin_set_sign_up_open(is_open boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_open boolean;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if is_open is null then
    raise exception 'invalid_input';
  end if;

  select s.open into current_open from private.sign_up_settings s for update;
  if current_open is not distinct from is_open then
    return;
  end if;

  if found then
    update private.sign_up_settings
    set open = is_open, updated_at = now(), updated_by = (select auth.uid())
    where id; -- the one row (API sessions refuse an UPDATE with no WHERE: pg-safeupdate)
  else
    insert into private.sign_up_settings (open, updated_by) values (is_open, (select auth.uid()));
  end if;

  insert into public.audit_log (actor_id, action, target_id, details)
  values ((select auth.uid()), case when is_open then 'sign_up_opened' else 'sign_up_closed' end, null, '{}');
end;
$$;

revoke execute on function public.sign_up_status() from public, anon, authenticated;
revoke execute on function public.admin_set_sign_up_open(boolean) from public, anon, authenticated;
grant execute on function public.sign_up_status() to anon, authenticated;
grant execute on function public.admin_set_sign_up_open(boolean) to authenticated;
