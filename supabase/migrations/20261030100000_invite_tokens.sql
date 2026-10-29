-- Invites stay valid for 14 days (docs/delivery/2026-10-29-invite-14-days, ADR-0010).
--
-- Before: the invite link was Supabase Auth's own token (single use, 1 hour, otp_expiry), and
-- profiles.invited_at was copied from auth.users.invited_at, which only inviteUserByEmail sets.
-- Now: account-admin emails our own token. Only its SHA-256 is stored here, one row per account,
-- valid for 336 hours from the send. invite-redeem claims it once, then asks Auth for a one-time
-- recovery token that signs the person in. invited_at is set when a send is stored.

-- ---------------------------------------------------------------------------
-- Step 1. Tables (private schema: PostgREST doesn't expose it, config.toml [api] schemas)
-- ---------------------------------------------------------------------------

-- One live link per account: a re-send replaces the row, so only the newest link works.
create table private.invite_tokens (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  sent_at    timestamptz not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  check (expires_at > sent_at)
);

comment on table private.invite_tokens is
  'The live invite link of each invited account, as a SHA-256 of the token (never the token). '
  'Reached only through invite_token_store / _claim / _release (secret key).';

-- Redeem attempts per caller address, for the rate limit only (10 per 15 minutes).
create table private.invite_redeem_attempts (
  ip_hash    text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index invite_redeem_attempts_idx on private.invite_redeem_attempts (ip_hash, created_at);

comment on table private.invite_redeem_attempts is
  'Recent invite redeems as salted address hashes. Rows older than 15 minutes are deleted.';

revoke all on table private.invite_tokens, private.invite_redeem_attempts
  from public, anon, authenticated, service_role;
alter table private.invite_tokens enable row level security;          -- no policies
alter table private.invite_redeem_attempts enable row level security; -- no policies

-- ---------------------------------------------------------------------------
-- Step 2. Store: after the email was accepted, the new link replaces the old one
-- ---------------------------------------------------------------------------

-- Returns the send time, or null when the account isn't invited any more (it joined, or is gone).
-- 336 hours must match INVITE_LIMITS in apps/web/src/constants/app.constants.ts and
-- INVITE_LIFETIME_HOURS in supabase/functions/account-admin/invite-copy.ts.
create function public.invite_token_store(target uuid, hash text)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform 1 from public.profiles
  where id = target and status = 'invited'
  for update;
  if not found then
    return null;
  end if;

  insert into private.invite_tokens (profile_id, token_hash, sent_at, expires_at, used_at)
  values (target, hash, now(), now() + interval '336 hours', null)
  on conflict (profile_id) do update
    set token_hash = excluded.token_hash,
        sent_at    = excluded.sent_at,
        expires_at = excluded.expires_at,
        used_at    = null;

  update public.profiles set invited_at = now() where id = target;
  return now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Step 3. Claim: rate limit, then single use, only for an invited, active account
-- ---------------------------------------------------------------------------

-- Returns the account, or null for every refusal (unknown, used, expired, replaced, joined,
-- deactivated, cancelled). Raises 'rate_limited' for the 11th attempt in 15 minutes from one
-- address: the edge function logs it and gives the same refusal. The `for share` lock on the
-- profile serialises with cancel-invite's `update … set is_active = false`.
create function public.invite_token_claim(hash text, client_ip_hash text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid;
  recent int;
begin
  delete from private.invite_redeem_attempts where created_at < now() - interval '15 minutes';
  select count(*) into recent
  from private.invite_redeem_attempts
  where ip_hash = client_ip_hash;
  if recent >= 10 then
    raise exception 'rate_limited';
  end if;
  insert into private.invite_redeem_attempts (ip_hash) values (client_ip_hash);

  select t.profile_id into account
  from private.invite_tokens t
  where t.token_hash = hash;
  if account is null then
    return null;
  end if;

  perform 1 from public.profiles p
  where p.id = account and p.status = 'invited' and p.is_active
  for share;
  if not found then
    return null;
  end if;

  update private.invite_tokens t
  set used_at = now()
  where t.token_hash = hash
    and t.used_at is null
    and t.expires_at > now()
  returning t.profile_id into account;
  return account; -- null when it was used or expired
end;
$$;

-- ---------------------------------------------------------------------------
-- Step 4. Release: undo a claim when the sign-in hop failed (Auth down), so the link still works
-- ---------------------------------------------------------------------------

-- A no-op once a re-send replaced the row (the old hash no longer exists).
create function public.invite_token_release(hash text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update private.invite_tokens set used_at = null where token_hash = hash
$$;

revoke execute on function
  public.invite_token_store(uuid, text),
  public.invite_token_claim(text, text),
  public.invite_token_release(text)
from public, anon, authenticated;
grant execute on function
  public.invite_token_store(uuid, text),
  public.invite_token_claim(text, text),
  public.invite_token_release(text)
to service_role;

-- ---------------------------------------------------------------------------
-- Step 5. invited_at: copy Auth's value only when Auth itself sets a new one
-- ---------------------------------------------------------------------------

-- From 20261023100000_invite_onboarding.sql lines 69-83. Only the invited_at line changes: the
-- redeem's sign-in updates last_sign_in_at, and copying Auth's invited_at (null for createUser
-- accounts) would wipe the date invite_token_store set. A real Supabase invite (Dashboard, or the
-- old account-admin during the deploy window) still copies.
create or replace function private.handle_updated_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = coalesce(lower(new.email), email),
      invited_at = case
                     when new.invited_at is distinct from old.invited_at
                          and new.invited_at is not null
                       then new.invited_at
                     else invited_at
                   end,
      last_sign_in_at = new.last_sign_in_at
  where id = new.id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Step 6. Pending invites have no new-style link, so they show as "Invite expired" (AC 25)
-- ---------------------------------------------------------------------------

-- Reversible: auth.users.invited_at still holds the old send time (02-architecture §8).
update public.profiles set invited_at = null where status = 'invited';
