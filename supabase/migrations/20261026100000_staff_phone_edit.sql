-- Item 4: staff change their phone on My profile, and admins correct it on the staff page
-- (01b AC-4.1–4.8, 02b item 4, 03b §4.2).
--
-- The phone rides on the existing profile update, so RLS ("Staff update their own profile;
-- admins update all") still decides whose row can change. A trigger normalises and checks the
-- value, using the same rule as onboarding (private.normalise_au_phone).

-- ---------------------------------------------------------------------------
-- 1. Grant
-- ---------------------------------------------------------------------------

-- status, terms_accepted_at and password_set_at stay ungranted (AC-4.7).
grant update (phone) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Validating trigger
-- ---------------------------------------------------------------------------

-- security definer: execute on private.normalise_au_phone is revoked from authenticated
-- (review-2b finding 8). complete_onboarding() passes unchanged: staff get an already-normalised
-- number, families write null over null.
create function private.check_profile_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.phone := nullif(trim(new.phone), ''); -- the form sends a blank field as text
  if new.phone is not distinct from old.phone then
    return new; -- includes blank over no number: other fields still save (AC-4.4)
  end if;
  if new.phone is null then
    raise exception 'phone_required'; -- a saved number can be changed, never cleared
  end if;
  if new.role not in ('tutor', 'admin') then
    raise exception 'invalid_input'; -- families never hold a phone, even if an admin tries
  end if;
  new.phone := private.normalise_au_phone(new.phone);
  if new.phone is null then
    raise exception 'invalid_phone';
  end if;
  return new;
end;
$$;

create trigger profiles_check_phone
  before update of phone on public.profiles
  for each row execute function private.check_profile_phone();

-- ---------------------------------------------------------------------------
-- 3. updated_at follows a phone change (column list from 20261006004522, plus phone)
-- ---------------------------------------------------------------------------

drop trigger profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update of full_name, bio, qualifications, subjects, avatar_path, role, is_active, phone
  on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Admin audit records phone by name only (AC-4.6)
-- ---------------------------------------------------------------------------

-- Body from 20261006004522_staff_accounts.sql (never redefined since), plus the phone line.
-- Field names only, so the number never reaches audit_log.
create or replace function private.audit_admin_profile_edit()
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
  if new.phone is distinct from old.phone then changed := array_append(changed, 'phone'); end if;

  if cardinality(changed) > 0 then
    insert into public.audit_log (actor_id, action, target_id, details)
    values (editor, 'profile_edited_by_admin', new.id, jsonb_build_object('fields', changed));
  end if;
  return null;
end;
$$;

drop trigger profiles_audit_admin_edit on public.profiles;
create trigger profiles_audit_admin_edit
  after update of full_name, bio, qualifications, subjects, avatar_path, phone on public.profiles
  for each row execute function private.audit_admin_profile_edit();

-- ---------------------------------------------------------------------------
-- 5. Grants and comment
-- ---------------------------------------------------------------------------

revoke execute on function private.check_profile_phone() from public, anon, authenticated;

comment on column public.profiles.phone is
  'Staff only: an Australian number as +61…, given at setup; changed later on My profile or by an admin (item 4). Never public.';
