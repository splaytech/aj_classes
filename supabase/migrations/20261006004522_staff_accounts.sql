-- R2a Tutor & Admin Logins: staff profiles, roles, audit log and profile photos.
-- Design: docs/requirements/release-2/r2a/design.md §5–§7.
--
-- Security notes:
--   * Roles and active status change ONLY through the admin_* functions below.
--   * Admin powers need a two-step (aal2) session: private.is_admin().
--   * Every function has a fixed, empty search_path, and EXECUTE is granted explicitly.


-- ---------------------------------------------------------------------------
-- Schema for helpers. PostgREST doesn't expose it, so nothing here is callable as an RPC.
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- Types and check helpers (needed by the table definitions)
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('tutor', 'admin');

-- True when every item is 1..max_length characters long.
create function private.items_within_length(items text[], max_length int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(char_length(trim(item)) between 1 and max_length), true)
  from unnest(items) as item
$$;

-- True when every item is a key such as 'maths' or 'verbal-reasoning'.
create function private.items_are_slugs(items text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(item ~ '^[a-z][a-z0-9-]{1,39}$'), true)
  from unnest(items) as item
$$;


-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  full_name       text not null default '' check (char_length(full_name) <= 100),
  bio             text not null default '' check (char_length(bio) <= 1000),
  qualifications  text[] not null default '{}'
                  check (cardinality(qualifications) <= 10
                         and private.items_within_length(qualifications, 150)),
  subjects        text[] not null default '{}'
                  check (cardinality(subjects) <= 15
                         and private.items_are_slugs(subjects)),
  -- The photo must live in the person's own folder: "{id}/{file}".
  avatar_path     text check (avatar_path is null
                              or (avatar_path like id::text || '/%' and avatar_path not like '%..%')),
  role            public.app_role not null default 'tutor',
  is_active       boolean not null default true,
  invited_at      timestamptz, -- copied from auth.users
  joined_at       timestamptz, -- auth.users.email_confirmed_at: the invite was accepted
  last_sign_in_at timestamptz, -- copied from auth.users
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index profiles_email_key on public.profiles (email);

comment on table public.profiles is
  'One row per staff account (tutor or admin). Created by a trigger on auth.users.';

create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references auth.users (id) on delete set null,
  action     text not null check (action in (
               'invite_sent', 'invite_resent', 'invite_cancelled',
               'role_changed', 'deactivated', 'reactivated',
               'two_step_reset', 'profile_edited_by_admin')),
  target_id  uuid references auth.users (id) on delete set null,
  details    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_target_idx on public.audit_log (target_id, created_at desc);

comment on table public.audit_log is
  'Who changed staff access, and when. Written only by functions; read only by admins.';


-- ---------------------------------------------------------------------------
-- Who is calling? (used by RLS policies and admin functions)
-- ---------------------------------------------------------------------------

-- The caller's role, or null when they have no profile or are deactivated.
-- security definer so it can read profiles without going through RLS (no recursion).
create function private.my_active_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid()) and is_active
$$;

create function private.is_active_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.my_active_role() is not null
$$;

-- Admin powers need an active admin AND a two-step (aal2) session.
create function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    private.my_active_role() = 'admin' and (select auth.jwt() ->> 'aal') = 'aal2',
    false
  )
$$;

-- True when target is the only active admin left.
create function private.is_last_active_admin(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.profiles
           where id = target and role = 'admin' and is_active
         )
     and not exists (
           select 1 from public.profiles
           where id <> target and role = 'admin' and is_active
         )
$$;

-- Serialises every change that could remove an admin, so two admins can't
-- demote or deactivate each other at the same moment and leave none.
create function private.lock_admin_changes()
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('r2a.admin_changes'))
$$;


-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- New auth user → profile. Role is always the default (tutor). Only full_name is read
-- from user metadata, because users can edit their own metadata.
create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, invited_at, joined_at, last_sign_in_at)
  values (
    new.id,
    coalesce(lower(new.email), ''),
    left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100),
    new.invited_at,
    new.email_confirmed_at,
    new.last_sign_in_at
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- Keep the copied auth fields in step.
create function private.handle_updated_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = coalesce(lower(new.email), email),
      invited_at = new.invited_at,
      joined_at = new.email_confirmed_at,
      last_sign_in_at = new.last_sign_in_at
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email, email_confirmed_at, last_sign_in_at, invited_at on auth.users
  for each row execute function private.handle_updated_auth_user();

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Only real profile changes bump updated_at (not the sign-in sync above).
create trigger profiles_set_updated_at
  before update of full_name, bio, qualifications, subjects, avatar_path, role, is_active
  on public.profiles
  for each row execute function private.set_updated_at();

-- An admin editing someone else's profile is recorded (field names only, not values).
create function private.audit_admin_profile_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  editor uuid := (select auth.uid());
  changed text[] := '{}';
begin
  if editor is null or editor = new.id then
    return null;
  end if;

  if new.full_name is distinct from old.full_name then changed := array_append(changed, 'full_name'); end if;
  if new.bio is distinct from old.bio then changed := array_append(changed, 'bio'); end if;
  if new.qualifications is distinct from old.qualifications then changed := array_append(changed, 'qualifications'); end if;
  if new.subjects is distinct from old.subjects then changed := array_append(changed, 'subjects'); end if;
  if new.avatar_path is distinct from old.avatar_path then changed := array_append(changed, 'avatar_path'); end if;

  if cardinality(changed) > 0 then
    insert into public.audit_log (actor_id, action, target_id, details)
    values (editor, 'profile_edited_by_admin', new.id, jsonb_build_object('fields', changed));
  end if;
  return null;
end;
$$;

create trigger profiles_audit_admin_edit
  after update of full_name, bio, qualifications, subjects, avatar_path on public.profiles
  for each row execute function private.audit_admin_profile_edit();


-- ---------------------------------------------------------------------------
-- Functions the app calls (RPC)
-- Errors use a stable message key that the web app maps to friendly text.
-- ---------------------------------------------------------------------------

create function public.am_i_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.is_admin()
$$;

-- Every staff member (or one, when target is given) with whether two-step is set up.
create function public.admin_list_staff(target uuid default null)
returns table (
  id uuid,
  email text,
  full_name text,
  bio text,
  qualifications text[],
  subjects text[],
  avatar_path text,
  role public.app_role,
  is_active boolean,
  invited_at timestamptz,
  joined_at timestamptz,
  last_sign_in_at timestamptz,
  has_two_step boolean
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
    select p.id, p.email, p.full_name, p.bio, p.qualifications, p.subjects, p.avatar_path,
           p.role, p.is_active, p.invited_at, p.joined_at, p.last_sign_in_at,
           exists (
             select 1 from auth.mfa_factors f
             where f.user_id = p.id and f.status = 'verified'
           )
    from public.profiles p
    where target is null or p.id = target
    order by lower(p.full_name), p.email;
end;
$$;

create function public.admin_set_role(target uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role_value public.app_role;
  has_joined boolean;
begin
  -- Lock first, then check the caller, so a caller demoted a moment ago is refused.
  perform private.lock_admin_changes();
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select p.role, p.joined_at is not null
  into current_role_value, has_joined
  from public.profiles p
  where p.id = target;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not has_joined then
    raise exception 'not_joined';
  end if;
  if current_role_value = new_role then
    return;
  end if;
  if new_role <> 'admin' and private.is_last_active_admin(target) then
    raise exception 'last_admin';
  end if;

  update public.profiles set role = new_role where id = target;

  insert into public.audit_log (actor_id, action, target_id, details)
  values ((select auth.uid()), 'role_changed', target,
          jsonb_build_object('from', current_role_value, 'to', new_role));
end;
$$;

create function public.admin_set_active(target uuid, active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  currently_active boolean;
  has_joined boolean;
begin
  perform private.lock_admin_changes();
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if not active and target = (select auth.uid()) then
    raise exception 'cannot_deactivate_self';
  end if;

  select p.is_active, p.joined_at is not null
  into currently_active, has_joined
  from public.profiles p
  where p.id = target;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not has_joined then
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

-- Used by the staff-admin edge function (secret key) for invite and two-step actions.
create function public.admin_log(actor uuid, action text, target uuid, details jsonb default '{}')
returns void
language sql
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, target_id, details)
  values (actor, action, target, coalesce(details, '{}'::jsonb))
$$;


-- ---------------------------------------------------------------------------
-- Grants. Supabase gives anon/authenticated broad defaults, so reset and grant
-- only what the app needs (design §7.1).
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.audit_log from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, bio, qualifications, subjects, avatar_path) on public.profiles to authenticated;
grant select on public.audit_log to authenticated; -- RLS: admins only

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.my_active_role(),
  private.is_active_staff(),
  private.is_admin(),
  private.items_within_length(text[], int),
  private.items_are_slugs(text[])
to authenticated, service_role;

revoke execute on function
  public.am_i_admin(),
  public.admin_list_staff(uuid),
  public.admin_set_role(uuid, public.app_role),
  public.admin_set_active(uuid, boolean),
  public.admin_log(uuid, text, uuid, jsonb)
from public, anon, authenticated;

grant execute on function
  public.am_i_admin(),
  public.admin_list_staff(uuid),
  public.admin_set_role(uuid, public.app_role),
  public.admin_set_active(uuid, boolean)
to authenticated;

grant execute on function public.admin_log(uuid, text, uuid, jsonb) to service_role;


-- ---------------------------------------------------------------------------
-- Row level security (design §7.2)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;

create policy "Staff read their own profile; admins read all"
  on public.profiles for select to authenticated
  using (
    (id = (select auth.uid()) and (select private.is_active_staff()))
    or (select private.is_admin())
  );

create policy "Staff update their own profile; admins update all"
  on public.profiles for update to authenticated
  using (
    (id = (select auth.uid()) and (select private.is_active_staff()))
    or (select private.is_admin())
  )
  with check (
    (id = (select auth.uid()) and (select private.is_active_staff()))
    or (select private.is_admin())
  );

create policy "Admins read the audit log"
  on public.audit_log for select to authenticated
  using ((select private.is_admin()));


-- ---------------------------------------------------------------------------
-- Profile photos (design §7.3). Public read so the website can show them later.
-- No SVG: it can carry scripts.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Staff manage photos in their own folder; admins manage all"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'avatars'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_active_staff()))
      or (select private.is_admin())
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_active_staff()))
      or (select private.is_admin())
    )
  );
