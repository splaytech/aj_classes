-- Invite onboarding (docs/requirements/invite-onboarding.md).
--
-- Before: clicking the invite link confirmed the e-mail, and that alone made the account "joined",
-- before the person had chosen a password.
-- Now: an account stays 'invited' until the person finishes the setup form at /portal/join
-- (name, password, terms; phone for staff; year level for students). Only complete_onboarding()
-- makes it 'active', and only after Supabase Auth has stored (hashed) their password.
-- Every access rule requires 'active', so a half-finished account can see nothing.
--
-- The invite token itself is still Supabase Auth's: single use, 1 hour (config.toml otp_expiry).

-- ---------------------------------------------------------------------------
-- Status and the new profile fields
-- ---------------------------------------------------------------------------

create type public.account_status as enum ('invited', 'active');

alter table public.profiles
  add column status            public.account_status not null default 'invited',
  add column phone             text check (phone is null or phone ~ '^\+61[2-478][0-9]{8}$'),
  add column terms_accepted_at timestamptz,
  add column password_set_at   timestamptz;

comment on column public.profiles.status is
  'invited until the person completes /portal/join (complete_onboarding), then active. '
  'Deactivation is separate (is_active).';
comment on column public.profiles.phone is
  'Staff only, collected at onboarding. Australian number stored as +61XXXXXXXXX.';
comment on column public.profiles.password_set_at is
  'When the person chose their own password while invited (set by a trigger on auth.users). '
  'An account can only become active after this: a password Auth made up at creation does not count.';
comment on column public.profiles.joined_at is
  'When the person completed onboarding (was: when they clicked the invite link).';

-- Accounts that already joined under the old flow keep working.
update public.profiles set status = 'active' where joined_at is not null;

-- joined_at is the moment status became active, so the two can never disagree.
alter table public.profiles
  add constraint profiles_status_matches_joined
    check ((status = 'active') = (joined_at is not null));

-- ---------------------------------------------------------------------------
-- joined_at no longer comes from auth.users.email_confirmed_at
-- ---------------------------------------------------------------------------

-- New auth user → invited profile, whatever Auth says about the e-mail. Only full_name is read
-- from user metadata (users can edit it); the role only from server-only app_metadata.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, invited_at, last_sign_in_at)
  values (
    new.id,
    coalesce(lower(new.email), ''),
    left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100),
    private.role_from_app_metadata(new.raw_app_meta_data),
    new.invited_at,
    new.last_sign_in_at
  );
  return new;
end;
$$;

create or replace function private.handle_updated_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = coalesce(lower(new.email), email),
      invited_at = new.invited_at,
      last_sign_in_at = new.last_sign_in_at
  where id = new.id;
  return new;
end;
$$;

-- An account's role may still be set by app_metadata while it is invited (spike F30), but never
-- once active. (Before, "joined" was the guard; an invited person may now have signed in.)
create or replace function private.handle_auth_role_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set role = private.role_from_app_metadata(new.raw_app_meta_data)
  where id = new.id
    and status = 'invited';
  return new;
end;
$$;

-- Records the person choosing a password while invited. Only an UPDATE counts: a hash Auth stores
-- when it creates the account (createUser may store a random one) never does. Users change their
-- own password only through Supabase Auth, so this marks a password they know.
create function private.handle_auth_password_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set password_set_at = now()
  where id = new.id
    and status = 'invited';
  return new;
end;
$$;

create trigger on_auth_password_set
  after update of encrypted_password on auth.users
  for each row
  when (coalesce(new.encrypted_password, '') <> ''
        and new.encrypted_password is distinct from old.encrypted_password)
  execute function private.handle_auth_password_set();

-- ---------------------------------------------------------------------------
-- Access: active accounts only
-- ---------------------------------------------------------------------------

-- The single gate behind is_active_staff, is_admin, is_my_child, require_parent and the
-- "read your own profile" policy.
create or replace function private.my_active_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid()) and is_active and status = 'active'
$$;

-- Students are checked here directly, not through my_active_role.
create or replace function private.my_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.profile_id = (select auth.uid())
    and s.is_active
    and p.is_active
    and p.status = 'active'
    and p.role = 'student'
$$;

-- ---------------------------------------------------------------------------
-- Onboarding functions
-- ---------------------------------------------------------------------------

-- Audit entry for an account becoming active.
alter table public.audit_log
  drop constraint audit_log_action_check,
  add constraint audit_log_action_check check (action in (
    'invite_sent', 'invite_resent', 'invite_cancelled',
    'role_changed', 'deactivated', 'reactivated',
    'two_step_reset', 'profile_edited_by_admin',
    'student_invited', 'parent_invited', 'parent_linked', 'parent_unlinked', 'consent_recorded',
    'account_activated'));

-- '04xx xxx xxx', '(03) 9xxx xxxx', '+61 4xx …' → '+614xxxxxxxx'; anything else → null.
-- Same rule as the web app (lib/validation.ts isValidAustralianPhone).
create function private.normalise_au_phone(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when d ~ '^0[2-478][0-9]{8}$' then '+61' || substr(d, 2)
           when d ~ '^\+61[2-478][0-9]{8}$' then d
         end
  from (select regexp_replace(coalesce(raw, ''), '[[:space:]()-]', '', 'g') as d) as cleaned
$$;

-- What the setup form needs to know about the caller: their role decides the fields.
-- Returns no row unless the caller is an invited, not deactivated account. The role is read on
-- the server from the profile (set from server-only app_metadata), never from the browser.
create function public.my_onboarding()
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
$$;

-- Finishes setup for the caller and makes the account active. All or nothing.
--   new_full_name  2–100 characters
--   new_phone      staff (tutor/admin): required Australian number; anyone else: must be null
--   new_year_level students: required, '2'…'12' or 'other' (not at school); anyone else: null
--   accepts_terms  must be true
-- The password is set first by the person's own session (supabase.auth.updateUser), which
-- Supabase Auth stores hashed; this refuses to activate an account until they have chosen one
-- (password_set_at, from the trigger above).
create function public.complete_onboarding(
  new_full_name text,
  new_phone text default null,
  new_year_level text default null,
  accepts_terms boolean default false
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
  where p.id = me and p.is_active and p.status = 'invited'
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

  update public.profiles
  set full_name = clean_name,
      phone = clean_phone,
      terms_accepted_at = now(),
      status = 'active',
      joined_at = now()
  where id = me;

  insert into public.audit_log (actor_id, action, target_id, details)
  values (me, 'account_activated', me, jsonb_build_object('role', my_role));
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function private.normalise_au_phone(text) from public, anon, authenticated;

revoke execute on function
  public.my_onboarding(),
  public.complete_onboarding(text, text, text, boolean)
from public, anon;

grant execute on function
  public.my_onboarding(),
  public.complete_onboarding(text, text, text, boolean)
to authenticated;

-- status, phone, terms_accepted_at and password_set_at are not in the authenticated update grant, so nobody can
-- change them directly; only complete_onboarding() writes them.
