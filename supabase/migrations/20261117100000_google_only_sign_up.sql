-- Google-only sign-up for the first release (Saurabh, 2026-11-17; 00-decisions.md "Google-only").
-- E-mail self sign-up stays built but is switched off by a second flag on the sign-up settings
-- row, so the public form can't send confirmation mail to made-up addresses (security 06
-- finding 1, R2, R4). Invites are unaffected: account-admin uses createUser, which skips the hook.
-- Turning e-mail back on later is one UPDATE of private.sign_up_settings.email_open (local seed
-- does this so the e-mail path stays tested).

alter table private.sign_up_settings
  add column email_open boolean not null default false; -- off: Google-only at release

-- Same hook as 20261114100100 §3.5, with one change: e-mail sign-ups are refused while
-- email_open is off.
create or replace function public.hook_before_user_created(event jsonb)
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
    if coalesce(btrim(new_user ->> 'email'), '') = ''
       or coalesce(new_user -> 'user_metadata' ->> 'email_verified', '') <> 'true' then
      return private.sign_up_refusal('google_email_unverified');
    end if;
    return '{}'::jsonb; -- not counted: Google sign-ups send no e-mail
  end if;

  if provider is distinct from 'email' then
    return private.sign_up_refusal('sign_up_refused'); -- Apple, Facebook and the rest stay out
  end if;

  -- E-mail sign-up switched off: the same answer as a closed sign-up (fail closed).
  if coalesce((select s.email_open from private.sign_up_settings s), false) is not true then
    return private.sign_up_refusal('sign_up_closed');
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

-- Whether the sign-up page shows the e-mail form. A missing row reads as off.
create function public.sign_up_email_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.email_open from private.sign_up_settings s), false)
$$;

revoke execute on function public.sign_up_email_open() from public;
grant execute on function public.sign_up_email_open() to anon, authenticated;

-- Google sign-ups get the same name rule as e-mail ones (security 06 finding 9, Google half). The
-- hook can't change the name, so a name that fails the rule is stored as '' and the person types
-- one on the finish step (complete_sign_up checks it again). Invites keep today's behaviour.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  given_name constant text := left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100);
begin
  insert into public.profiles (id, email, full_name, role, invited_at, last_sign_in_at)
  values (
    new.id,
    coalesce(lower(new.email), ''),
    case
      when new.raw_app_meta_data ->> 'provider' = 'google' and not private.is_valid_full_name(given_name) then ''
      else given_name
    end,
    private.role_from_app_metadata(new.raw_app_meta_data),
    new.invited_at,
    new.last_sign_in_at
  );
  return new;
end;
$$;
