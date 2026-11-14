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
