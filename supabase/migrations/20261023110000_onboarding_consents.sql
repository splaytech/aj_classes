-- Optional consents on the setup form and in Account → Your choices
-- (docs/requirements/invite-onboarding.md, "Consents"). Separate from the required Terms box, so
-- they're voluntary (Privacy Act APP 6, Spam Act). Offered to parents only. A timestamp means
-- "agreed at"; null means no. Every change is in the audit log.

alter table public.profiles
  add column marketing_consent_at timestamptz,
  add column results_publicity_consent_at timestamptz,
  add column video_publicity_consent_at timestamptz;

comment on column public.profiles.marketing_consent_at is
  'Parent agreed to news, offers and enrolment updates by email and SMS (Spam Act). Null: no.';
comment on column public.profiles.results_publicity_consent_at is
  'Parent agreed that their child''s name and selective school or scholarship result may be shared on the website and social media. Null: no.';
comment on column public.profiles.video_publicity_consent_at is
  'Parent agreed that a testimonial video they provide may be published on the website and social media. Null: no.';

-- These columns are not in the authenticated update grant: only the functions below write them.

alter table public.audit_log
  drop constraint audit_log_action_check,
  add constraint audit_log_action_check check (action in (
    'invite_sent', 'invite_resent', 'invite_cancelled',
    'role_changed', 'deactivated', 'reactivated',
    'two_step_reset', 'profile_edited_by_admin',
    'student_invited', 'parent_invited', 'parent_linked', 'parent_unlinked', 'consent_recorded',
    'account_activated', 'consent_changed'));

-- ---------------------------------------------------------------------------
-- complete_onboarding: the same rules as before, plus the three optional choices
-- ---------------------------------------------------------------------------

drop function public.complete_onboarding(text, text, text, boolean);

-- Finishes setup for the caller and makes the account active. All or nothing.
--   new_full_name, new_phone, new_year_level, accepts_terms: as in 20261023100000
--   wants_marketing, allows_results_publicity, allows_video_publicity: parents only, optional
create function public.complete_onboarding(
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

-- ---------------------------------------------------------------------------
-- set_my_consents: an active parent changes their choices (Account → Your choices)
-- ---------------------------------------------------------------------------

create function public.set_my_consents(
  wants_marketing boolean,
  allows_results_publicity boolean,
  allows_video_publicity boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := (select auth.uid());
  had_marketing boolean;
  had_results boolean;
  had_video boolean;
  changes jsonb := '{}'::jsonb;
begin
  if wants_marketing is null or allows_results_publicity is null or allows_video_publicity is null then
    raise exception 'invalid_input';
  end if;

  select p.marketing_consent_at is not null,
         p.results_publicity_consent_at is not null,
         p.video_publicity_consent_at is not null
  into had_marketing, had_results, had_video
  from public.profiles p
  where p.id = me and p.is_active and p.status = 'active' and p.role = 'parent'
  for update;

  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if wants_marketing <> had_marketing then
    changes := changes || jsonb_build_object('marketing', wants_marketing);
  end if;
  if allows_results_publicity <> had_results then
    changes := changes || jsonb_build_object('results_publicity', allows_results_publicity);
  end if;
  if allows_video_publicity <> had_video then
    changes := changes || jsonb_build_object('video_publicity', allows_video_publicity);
  end if;

  if changes = '{}'::jsonb then
    return; -- nothing changed: keep the original "agreed at" times
  end if;

  update public.profiles p
  set marketing_consent_at = case
        when not wants_marketing then null
        else coalesce(p.marketing_consent_at, now()) end,
      results_publicity_consent_at = case
        when not allows_results_publicity then null
        else coalesce(p.results_publicity_consent_at, now()) end,
      video_publicity_consent_at = case
        when not allows_video_publicity then null
        else coalesce(p.video_publicity_consent_at, now()) end
  where p.id = me;

  insert into public.audit_log (actor_id, action, target_id, details)
  values (me, 'consent_changed', me, changes);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function
  public.complete_onboarding(text, text, text, boolean, boolean, boolean, boolean),
  public.set_my_consents(boolean, boolean, boolean)
from public, anon;

grant execute on function
  public.complete_onboarding(text, text, text, boolean, boolean, boolean, boolean),
  public.set_my_consents(boolean, boolean, boolean)
to authenticated;
