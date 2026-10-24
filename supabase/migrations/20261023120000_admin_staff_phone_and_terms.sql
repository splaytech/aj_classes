-- Admins see what a person gave at setup (invite-onboarding.md, "Admin view"): a staff member's
-- phone number and when they accepted the Terms. admin_list_staff() gains two columns; its
-- return type changes, so it is dropped and created again with the same rules and grants.

drop function public.admin_list_staff(uuid);

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
  has_two_step boolean,
  phone text,
  terms_accepted_at timestamptz
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
           ),
           p.phone, p.terms_accepted_at
    from public.profiles p
    where p.role in ('tutor', 'admin')
      and (target is null or p.id = target)
    order by lower(p.full_name), p.email;
end;
$$;

revoke execute on function public.admin_list_staff(uuid) from public, anon;
grant execute on function public.admin_list_staff(uuid) to authenticated;
