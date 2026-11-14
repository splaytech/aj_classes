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


-- ---------------------------------------------------------------------------
-- §3.8 Guards in existing functions (each copied from its latest definition; one change each)
-- ---------------------------------------------------------------------------

-- From 20261023110000_onboarding_consents.sql: invite onboarding refuses signed-up users, who
-- finish with complete_sign_up instead (AC-28).
create or replace function public.complete_onboarding(
  new_full_name text,
  new_phone text default null,
  new_year_level text default null,
  accepts_terms boolean default false,
  wants_marketing boolean default false,
  allows_results_publicity boolean default false,
  allows_video_publicity boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := (select auth.uid());
  my_role public.app_role;
  clean_name text := trim(coalesce(new_full_name, ''));
  clean_phone text;
  level smallint;
begin
  -- Locks the row, so two submits at once can't both get past here.
  select p.role into my_role
  from public.profiles p
  where p.id = me and p.is_active and p.status = 'invited' and p.role <> 'user'
  for update;

  if my_role is null then
    raise exception 'not_invited' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = me and p.password_set_at is not null
  ) then
    raise exception 'password_not_set';
  end if;

  if accepts_terms is not true then
    raise exception 'terms_required';
  end if;

  -- No control characters (newlines, tabs) and no text-direction overrides, which could make a
  -- name display misleadingly on admin pages and in the audit log.
  if char_length(clean_name) not between 2 and 100
     or clean_name ~ '[[:cntrl:]\u202A-\u202E\u2066-\u2069]' then
    raise exception 'invalid_name';
  end if;

  if my_role in ('tutor', 'admin') then
    clean_phone := private.normalise_au_phone(new_phone);
    if clean_phone is null then
      raise exception 'invalid_phone';
    end if;
  elsif new_phone is not null then
    raise exception 'invalid_input';
  end if;

  if my_role = 'student' then
    if new_year_level = 'other' then
      level := null;
    elsif new_year_level ~ '^([2-9]|1[0-2])$' then
      level := new_year_level::smallint;
    else
      raise exception 'invalid_year_level';
    end if;

    update public.students s set year_level = level where s.profile_id = me;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  elsif new_year_level is not null then
    raise exception 'invalid_input';
  end if;

  -- The optional choices are offered to parents only (a minor can't agree to publicity).
  if my_role <> 'parent'
     and (wants_marketing is true or allows_results_publicity is true
          or allows_video_publicity is true) then
    raise exception 'invalid_input';
  end if;

  update public.profiles
  set full_name = clean_name,
      phone = clean_phone,
      terms_accepted_at = now(),
      marketing_consent_at = case when wants_marketing is true then now() end,
      results_publicity_consent_at = case when allows_results_publicity is true then now() end,
      video_publicity_consent_at = case when allows_video_publicity is true then now() end,
      status = 'active',
      joined_at = now()
  where id = me;

  insert into public.audit_log (actor_id, action, target_id, details)
  values (me, 'account_activated', me, jsonb_build_object(
    'role', my_role,
    'marketing', wants_marketing is true,
    'results_publicity', allows_results_publicity is true,
    'video_publicity', allows_video_publicity is true
  ));
end;
$$;

-- From 20261023100000_invite_onboarding.sql: the mobile app and the invite setup form never see a
-- signed-up user as "invited, unfinished" (AC-40).
create or replace function public.my_onboarding()
returns table (role public.app_role, full_name text, email text, year_level smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.role,
         p.full_name,
         p.email,
         (select s.year_level from public.students s where s.profile_id = p.id)
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and p.status = 'invited'
    and p.role <> 'user'
$$;

-- From 20261006004522_staff_accounts.sql: a signed-up user can be deactivated before finishing.
create or replace function public.admin_set_active(target uuid, active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  currently_active boolean;
  has_joined boolean;
  current_role_value public.app_role;
begin
  perform private.lock_admin_changes();
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if not active and target = (select auth.uid()) then
    raise exception 'cannot_deactivate_self';
  end if;

  select p.is_active, p.joined_at is not null, p.role
  into currently_active, has_joined, current_role_value
  from public.profiles p
  where p.id = target;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  -- Signed-up users can be deactivated whether or not they finished (AC-31, AC-32).
  if not has_joined and current_role_value <> 'user' then
    raise exception 'not_joined';
  end if;
  if currently_active = active then
    return;
  end if;
  if not active and private.is_last_active_admin(target) then
    raise exception 'last_admin';
  end if;

  update public.profiles set is_active = active where id = target;

  insert into public.audit_log (actor_id, action, target_id)
  values ((select auth.uid()), case when active then 'reactivated' else 'deactivated' end, target);
end;
$$;

-- ---------------------------------------------------------------------------
-- §3.7 Admin → Users: list signed-up users, and promote one to parent
-- ---------------------------------------------------------------------------

-- Everyone who signed up on the website, newest first, with how they signed up (one call, no N+1).
create function public.admin_list_users()
returns table (
  id uuid,
  email text,
  full_name text,
  signed_up_at timestamptz,
  signed_up_with text,
  finished boolean,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
    select p.id, p.email, p.full_name, p.created_at, private.signed_up_with(p.id),
           p.status = 'active', p.is_active
    from public.profiles p
    where p.role = 'user'
    order by p.created_at desc, p.id;
end;
$$;

-- Links a finished, active signed-up user to a student as their parent (AC-33, AC-35), after the
-- admin confirmed it in "Invite or link a parent". Keeps their password, sessions and
-- authenticators (02 Q8, R3). account-admin then sets app_metadata.account_role = 'parent'.
create function public.admin_promote_user(target uuid, target_student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_name text;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  perform 1
  from public.profiles p
  where p.id = target and p.role = 'user' and p.status = 'active' and p.is_active
  for update;
  if not found then
    raise exception 'not_a_signed_up_user';
  end if;

  select s.full_name into student_name
  from public.students s
  where s.id = target_student and s.is_active;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- The role first: the student_guardians trigger only accepts parent accounts.
  update public.profiles set role = 'parent' where id = target;
  insert into public.student_guardians (student_id, parent_id) values (target_student, target);

  insert into public.audit_log (actor_id, action, target_id, details)
  values ((select auth.uid()), 'parent_linked', target, jsonb_build_object(
    'student_id', target_student,
    'student_name', student_name,
    'promoted_from', 'user',
    'signed_up_with', private.signed_up_with(target)
  ));
end;
$$;

revoke execute on function public.admin_list_users() from public, anon, authenticated;
revoke execute on function public.admin_promote_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_promote_user(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- §3.7 sign_up_guard_ready(): deploy.sh opens sign-up only when this is true (ADR-0011)
-- ---------------------------------------------------------------------------

-- Checks the guard by behaviour, not by migration history: no marker maps to user, the profiles
-- default is user, the hook exists and Auth can call it, both triggers are there and enabled,
-- and the switch row exists. Returns only a boolean, so it tells a caller nothing else.
create function public.sign_up_guard_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.role_from_app_metadata('{}') = 'user'
    and private.role_from_app_metadata('{"account_role":"x"}') = 'user'
    and private.role_from_app_metadata('{"account_role":"admin"}') = 'user'
    and (select pg_get_expr(d.adbin, d.adrelid)
         from pg_catalog.pg_attrdef d
         join pg_catalog.pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
         where d.adrelid = 'public.profiles'::regclass and a.attname = 'role') like '''user''::%'
    and case
          when to_regprocedure('public.hook_before_user_created(jsonb)') is null then false
          else has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute')
        end
    and has_schema_privilege('supabase_auth_admin', 'public', 'usage')
    and exists (select 1 from pg_catalog.pg_trigger t
                where t.tgrelid = 'auth.identities'::regclass
                  and t.tgname = 'on_auth_identity_link_check' and t.tgenabled <> 'D')
    and exists (select 1 from pg_catalog.pg_trigger t
                where t.tgrelid = 'auth.users'::regclass
                  and t.tgname = 'on_auth_user_email_confirmed' and t.tgenabled <> 'D')
    and exists (select 1 from private.sign_up_settings),
    false
  )
$$;

revoke execute on function public.sign_up_guard_ready() from public, anon, authenticated;
grant execute on function public.sign_up_guard_ready() to anon, authenticated;
