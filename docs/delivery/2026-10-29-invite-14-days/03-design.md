# 03 — Solution design: invites stay valid for 14 days

Stage 3 of `/deliver`, Solution Designer. Branch `feature/invite-14-days` @ `af097ac`. Date 2026-10-29.
Inputs: [01-requirement.md](01-requirement.md) (approved, AC 1–41), [review-1.md](review-1.md),
[02-architecture.md](02-architecture.md) (approved; §11 handover items marked **H-n**),
[review-2.md](review-2.md) (round 2 nit 3 marked **R2-N3**),
[ADR-0010](../../decisions/0010-own-invite-token-with-supabase-sign-in-hop.md).
Revised after [review-3.md](review-3.md):
- blocking 1 → §4.3 step 6 and the §8.2 identity table (and the matching lines in 02 §4 and ADR-0010 decision 4);
- finding 2 → spike S4 in §9 and §10 risks 4 and 6;
- finding 3 → §8.1 item 1;
- finding 4 → §3 traps;
- finding 5 → §8.1 item 6;
- finding 6 → §2 note 2;
- finding 7 → §4.3 logging.

All paths are from the repo root. Line anchors were read on this branch on 2026-10-29; the
Developer re-checks each one before editing. The migration in §2 was dry-run on the local database
inside a transaction that was rolled back (store, claim, release, expiry, inactive, replaced hash,
rate limit, trigger guard all behaved as specified; nothing was left behind).

**New things and their cost:** one edge function (`invite-redeem`), one migration, two private
tables, three service-only SQL functions. No new dependency, vendor, secret, env var or hosted Auth
setting. Invite email moves from Resend SMTP to the Resend API on the same account and the same
Free-plan 100/day (02 §6).

**Copied function body.** Only one: `private.handle_updated_auth_user()`. Its current definition is
the last one in the migrations, `supabase/migrations/20261023100000_invite_onboarding.sql`
**lines 69–83** (`create or replace function` through the closing `$$;`). 02 §5 and §8 say
`69-82`; line 83 is the `$$;`. Checked with
`grep -n "function private.handle_updated_auth_user" supabase/migrations/*.sql | tail -1`, and the live
body (`pg_get_functiondef`) matches it.

**Migration timestamp.** `20261030100000` is later than every migration on every local branch,
remote branch and worktree (`aj_classes` main, `aj_classes-hiring`, `aj_classes-invites`). The
latest anywhere is `20261029100000_more_email_alerts.sql`.

---

## 1. Components

| # | Component | Responsibility |
|---|---|---|
| 1 | Migration `20261030100000_invite_tokens.sql` (new) | Token and attempt tables, store/claim/release functions, guarded `invited_at` copy, backfill |
| 2 | pgTAP `invite_tokens.test.sql` (new) | Grants, RLS, store/claim/release rules, expiry boundary, rate limit, trigger guard |
| 3 | `supabase/functions/_shared/email/` (moved from `notifications/`) | Transport (Resend/Mailpit), sender, hosted-safety check, HTML helpers: one copy for both functions |
| 4 | `supabase/functions/_shared/sha256.ts`, `client-address.ts`, `invite-token.ts` (new) | SHA-256 hex; salted caller-address hash (moved from `leads`); token make/shape/hash |
| 5 | `account-admin` (edit) | Every invite and re-send goes create → send → store; renders the invite email itself |
| 6 | `invite-redeem` (new function) | Signed-out `POST { token }`: shape, rate limit, single-use claim, recovery hop, identity check |
| 7 | `notifications` (edit, imports only) | Uses `_shared/email/`; no behaviour change |
| 8 | `leads` (edit, imports only) | Uses `_shared/client-address.ts`; no behaviour change |
| 9 | `supabase/config.toml`, `scripts/deploy.sh` (edit) | `[functions.invite-redeem] verify_jwt = false`; add to `FUNCTIONS` |
| 10 | Web constants (edit) | `INVITE_LIMITS`, `PORTAL_ROUTES.invite`, `PORTAL_QUERY.inviteToken`, dialog copy, SEO title |
| 11 | Web service `services/invites.service.ts` (new) + `account-admin.client.ts` (edit) | Redeem call and the sign-in hop; the only Supabase importer stays `services/` |
| 12 | Route `/portal/invite` (new) + `lib/invite-steps.ts` (new) | The Continue page and its pure state rules |
| 13 | `auth-confirm.tsx` (edit) | `type=invite` is recognised only to refuse it, with no network call |
| 14 | `lib/account-status.ts`, admin staff/student pages (edit) | 336 h rule; hide `Invited on` when null |
| 15 | Function test scripts (new + edit), e2e (edit) | See §8 |
| 16 | Docs (edit) | README runbooks, architecture doc, budget line, invite-onboarding pointer |

Not touched: `supabase/templates/*.html` (D6), `otp_expiry`, hosted Auth settings, recovery/magic-link
flows, RLS on existing tables, `aj_classes_mobile` (D1), `seed.sql`.

---

## 2. Migration: `supabase/migrations/20261030100000_invite_tokens.sql`

House style (as `20261029100000_more_email_alerts.sql`): header comment naming the source docs,
numbered `-- ----` sections, no `begin;`/`commit;` (the CLI wraps each file). The text below is the
whole file as dry-run; the Developer may reword comments but not change behaviour.

```sql
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
```

Notes for the Developer:

1. **Parameter names differ from 02 §2** on purpose: `invite_token_claim(hash, client_ip_hash)`.
   A plpgsql parameter named `ip_hash` would be ambiguous with the column of the same name.
2. **Rate limit raises instead of returning null**, so the function can log `rate_limited` (02 §3.3)
   while replying exactly as for any refusal. A refused call never writes an attempt row, because
   the insert comes after the check. So only allowed attempts are counted, as in
   `leads/rate-limit.ts` (review-3 finding 6).
3. **Strictness.** Valid while `expires_at > now()`, which is the AC rule line (now < sent + 336 h).
   The web rule in §5.3 uses the same strict `<`.
4. **Grants.** No table in `private` exists today and there are no default privileges for that
   schema (checked in `pg_default_acl`), so only the owner has rights. The revoke is defence in
   depth. Functions in `public` get default execute for `anon`, `authenticated` and `service_role`,
   hence the explicit revoke and grant.
5. **No other trigger fires** on `update public.profiles set invited_at` (checked: the profile
   triggers are on `phone`, profile fields, `role` and `is_active` only).
6. **Data clean-up.** Rows stay after an account joins (one per account, tiny). They go when the
   account is deleted (cascade). No sweep is needed.
7. **Down path** (02 §8): drop the three functions and two tables, restore lines 69–83 of the
   2026-10-23 migration, then run the restore in §6.6.

---

## 3. pgTAP: `supabase/tests/database/invite_tokens.test.sql` (new)

Same shape as `enquiries.test.sql`: `begin; select no_plan(); select tests.remove_all_accounts();`
… `select * from finish(); rollback;`. Use `tests.create_staff(…, p_joined => false)` and
`tests.create_family_account(…, p_joined => false)` for invited accounts. **Check function rights
with `has_function_privilege`, never by calling as `anon`/`authenticated`** (local Postgres crash,
`supabase/README.md` "Known local issues"). Hashes in tests are `repeat('a', 64)` etc.

| # | Assertion |
|---|---|
| 1 | `has_table('private', 'invite_tokens')`, `has_table('private', 'invite_redeem_attempts')`; `relrowsecurity` true on both; no rows in `pg_policies` for either |
| 2 | `has_table_privilege(r, 'private.invite_tokens', 'select')` is false for `anon`, `authenticated`, `service_role`; same for `insert`, `update`, `delete`; same for `invite_redeem_attempts` |
| 3 | As anon (`tests.authenticate_as_anon()`) and as a tutor, a student and a parent (`tests.authenticate_as`), `select * from private.invite_tokens` throws `42501`; same for `invite_redeem_attempts` |
| 4 | `has_function_privilege` for the three functions: false for `anon` and `authenticated`, true for `service_role`. `prosecdef` true and `proconfig = array['search_path=""']` for all three (compare as a `text[]`) |
| 5 | Store on an invited tutor returns a time; the row has `expires_at - sent_at = interval '336 hours'`, `used_at` null; `profiles.invited_at` equals the returned time |
| 6 | Store on an active account returns null and adds no row; store on an unknown uuid returns null |
| 7 | Store with a bad hash (`'xyz'`) throws `23514` |
| 8 | Second store with a new hash: still one row for the account, the new hash, `used_at` null, `sent_at` updated |
| 9 | Claim with the current hash returns the account and sets `used_at`; a second claim returns null |
| 10 | Claim with the replaced (first) hash returns null; claim with an unknown hash returns null |
| 11 | Release, then claim again returns the account (a failed hop doesn't burn the link) |
| 12 | Release of an unknown/replaced hash changes no row |
| 13 | Expiry boundary: with `sent_at = now() - 336 h`, `expires_at = now()` the claim returns null; with `expires_at = now() + interval '1 second'` it returns the account |
| 14 | Inactive (`is_active = false`) → null; `status = 'active'` (with `joined_at = now()`) → null |
| 15 | Rate limit: with a fresh `client_ip_hash`, 10 claims run (any hash), the 11th `throws_ok(…, 'P0001', 'rate_limited')`; a second address still works; 10 rows older than 15 minutes (insert with `created_at = now() - interval '16 minutes'`) don't count and are deleted by the next call |
| 16 | Cascade: `delete from auth.users where id = <invited>` removes its `invite_tokens` row |
| 17 | Trigger guard: set `profiles.invited_at = '2026-01-01'`; `update auth.users set last_sign_in_at = now()` leaves it `2026-01-01`; `update auth.users set invited_at = '2026-02-02'` copies `2026-02-02`; `update auth.users set invited_at = null` leaves `2026-02-02` |
| 18 | `has_column('public', 'profiles', 'invited_at')` and `'status'` (AC 27: nothing mobile reads is removed) |

`now()` is fixed for the whole test transaction, so back-date rows rather than wait.

Traps (review-3 finding 4):
- #4: compare `proconfig` as `text[]` with `array['search_path=""']`.
- #9–#14: give each group its own `client_ip_hash` (for example `repeat('1', 64)`, `repeat('2', 64)`, …),
  so the running claim count never reaches 10 before #15 means it to.
- #3: write the table selects exactly as `enquiries.test.sql` does: `throws_ok($$ select * from … $$, '42501', null, …)`
  between `tests.authenticate_as…()` and `reset role;`. These are table reads, not function calls, so
  they don't hit the local `psql` crash.

---

## 4. Edge functions

### 4.1 Shared modules (moves, no behaviour change)

`notifications/transport.ts`, the hosted-safety half of `notifications/config.ts`, the sender
constant and the two HTML helpers move to `supabase/functions/_shared/email/`. They stay free of
Deno globals and `jsr:` imports, so the Node test scripts keep importing them directly.

| New file | Contents | From |
|---|---|---|
| `_shared/email/transport.ts` | `EmailMessage`, `SendOutcome`, `Transport`, `pickTransport`, `resendRequest`, `mailpitRequest`, `outcomeForStatus`, `shouldStopBatch`, `sendEmail` | `notifications/transport.ts` (whole file). Changes: import `SENDER`, `FROM_HEADER` from `./sender.ts`; the third parameter is renamed `idempotencyKey` (was `outboxId`); the warn label becomes `'email send refused'`; header comment says it serves both functions |
| `_shared/email/sender.ts` | `SENDER` (name, email, replyTo) and `FROM_HEADER = 'AJ Classes <hello@ajclasses.com.au>'` built from it | `notifications/copy.ts:22-27` and `COPY.from` (`:32`). `COPY.from` is removed: `transport.ts` was its only reader |
| `_shared/email/config.ts` | `isHostedProject(supabaseUrl)` (unchanged) and `isSafeEmailConfig({ transport, siteUrl, supabaseUrl })`: false if no transport or no `siteUrl`; locally true; on hosted true only if the transport isn't Mailpit and `siteUrl` starts with `https://` | `notifications/config.ts:15, 24-42` |
| `_shared/email/html.ts` | `escapeHtml`, `oneLine` | `notifications/template.ts:36-43, 61-65` |

`notifications/config.ts` keeps `LOCAL_WORKER_SECRET`, `WorkerConfig`, `gateRequest` and
`isUsableConfig`, which becomes `isSafeEmailConfig(config) && (!isHostedProject(config.supabaseUrl)
|| config.workerSecret !== LOCAL_WORKER_SECRET)`. That is the same truth table as today.
`notifications/{batch,index,template}.ts` import from `../_shared/email/…`.

Two more shared files:

| New file | Contents |
|---|---|
| `_shared/sha256.ts` | `sha256Hex(text): Promise<string>`: lower-case hex SHA-256 via `crypto.subtle` (Node and Deno) |
| `_shared/client-address.ts` | `hashClientAddress(request): Promise<string>`: moved from `leads/rate-limit.ts:8-16` unchanged (leftmost `x-forwarded-for`, `'unknown'` if empty, salted with `SUPABASE_SERVICE_ROLE_KEY`, via `sha256Hex`). Deno-only (reads `Deno.env`). `leads/rate-limit.ts` imports it |
| `_shared/invite-token.ts` | `INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/`; `newInviteToken()`: 32 bytes from `crypto.getRandomValues`, base64url with no padding (43 chars); `isInviteToken(value: unknown): value is string`; `hashInviteToken(token)` = `sha256Hex(token)`. Pure, Node-importable |

### 4.2 `account-admin`

**New files** (pure, Node-importable, no `jsr:` import):

1. `account-admin/invite-copy.ts`: every word of the invite email. The edge runtime can't import
   `apps/web/src/constants` (same reason as `notifications/copy.ts:1-5`).

   | Key | Value |
   |---|---|
   | `INVITE_LIFETIME_HOURS` | `336` (comment: must match the migration's `interval '336 hours'` and `INVITE_LIMITS.linkLifetimeHours`) |
   | `INVITE_PATH` | `'/portal/invite'` (must match `PORTAL_ROUTES.invite`) |
   | `INVITE_TOKEN_PARAM` | `'token'` (must match `PORTAL_QUERY.inviteToken`) |
   | `INVITE_COPY.subject` | `You're invited to the AJ Classes portal` |
   | `INVITE_COPY.heading` | `You're invited to AJ Classes` |
   | `INVITE_COPY.brandLabel` | `{ staff: 'Staff', student: 'Students', parent: 'Parents' }` |
   | `INVITE_COPY.intro.staff` | `You've been invited to the AJ Classes staff portal.` |
   | `INVITE_COPY.intro.student` | `You've been invited to the AJ Classes student portal, where you can see your classes and do your assignments online.` |
   | `INVITE_COPY.intro.parent` | `You've been invited to the AJ Classes parent portal, where you can follow your child's assignments, marks and tutor comments.` |
   | `INVITE_COPY.nextStep` | `Click the button, then fill in a few details and choose your password.` |
   | `INVITE_COPY.button` | `Accept invite` |
   | `INVITE_COPY.expiry` | built from `INVITE_LIFETIME_HOURS / 24`: `This link expires in 14 days and works once. If it has expired, ask AJ Classes to send you a new one.` (AC 29) |
   | `INVITE_COPY.ignore` | `If you didn't expect this email, you can ignore it.` |

   Wording is copied from `supabase/templates/invite.html:39-72` (AC 28, A6).

2. `account-admin/invite-email.ts`:
   - `inviteAudience(role: string)`: `'student'` → student, `'parent'` → parent, anything else
     (tutor, admin) → staff. Same rule as the template's `{{ with .Data.account_role }}`.
   - `inviteLink(siteUrl, token)`: `${siteUrl without trailing slashes}${INVITE_PATH}?${INVITE_TOKEN_PARAM}=${token}`.
     The token is base64url, so it needs no encoding (AC 31).
   - `renderInviteEmail({ to, role, link }): EmailMessage`, with `subject` from `INVITE_COPY`, and:
     - **HTML:** the markup of `invite.html:5-78` with each `style="…"` collapsed onto one line (as
       `notifications/template.ts:121-145` does). The label span holds `brandLabel[audience]`, the
       `h1` holds `heading`, the first `<p>` holds `intro[audience]` + `' '` + `nextStep`, and the
       button `href` is `escapeHtml(link)`. The two grey footer paragraphs are `expiry` and `ignore`.
       Every inserted string goes through `escapeHtml`. The email contains no user-typed text: no
       name, unlike 02 §6's note, because today's template has none (A6).
     - **Text** (lines joined with `\n`): `heading`, `''`, `intro[audience] + ' ' + nextStep`, `''`,
       `` `${button}: ${link}` ``, `''`, `expiry`, `''`, `ignore`, `''` (AC 30).

3. `account-admin/issue-invite.ts`: the ordering in one place, with its I/O passed in (the
   `notifications/batch.ts` pattern), so the Node script can test it with fakes.

   ```ts
   type InviteAccount = { id: string; email: string; role: string };
   type IssueSteps = {
     send: (message: EmailMessage) => Promise<SendOutcome>;
     store: (tokenHash: string) => Promise<boolean>; // invite_token_store returned a time
   };
   issueInvite(account: InviteAccount, siteUrl: string, steps: IssueSteps): Promise<boolean>
   ```

   1. `token = newInviteToken()`, `hash = await hashInviteToken(token)`. Both stay in memory.
   2. `message = renderInviteEmail({ to: account.email, role: account.role, link: inviteLink(siteUrl, token) })`.
   3. `outcome = await steps.send(message)`. If `outcome.outcome !== 'sent'` (including `retry`),
      return false. **Nothing has been written**, so the old row and `invited_at` are untouched (AC 39).
   4. Return `await steps.store(hash)`. False when the account joined meanwhile or the RPC failed.
      The email just sent then holds a link that was never stored, so it's refused (fail-safe, 02 §6).

**`handlers/accounts.ts` changes:**

| Today | Change |
|---|---|
| `createFamilyAccount(email, fullName, role)` `:57-83` | Becomes `createInvitedAccount(email, fullName, role: 'tutor' \| FamilyRole)`. `user_metadata: { full_name }` only (the `account_role` copy there existed only for the Auth template). `app_metadata: { account_role: role }` only for student/parent, **kept** because mobile reads it (`access_state_service.dart:59`). It still checks `findAccount(id).role === role` and deletes the account otherwise |
| `sendInvite(email)` `:85-89`, `sendSetupLink(userId, email)` `:91-105` | Removed. Replaced by `sendAccountInvite(account: InviteAccount): Promise<boolean>`, which wires `issueInvite` to the real world (below) |

`sendAccountInvite`:

1. `transport = pickTransport((name) => Deno.env.get(name))`, `siteUrl = Deno.env.get('SITE_URL') ?? ''`.
2. If `!isSafeEmailConfig({ transport, siteUrl, supabaseUrl: Deno.env.get('SUPABASE_URL') })`:
   `console.error('invite email config missing')`, return false. This is the kill switch (AC 36):
   `EMAIL_TRANSPORT` unset → no transport → false. Nothing falls back.
3. Otherwise `issueInvite(account, siteUrl, { send, store })`:
   - `send: (message) => sendEmail(transport, message, crypto.randomUUID())`. A fresh key per call:
     there's no automatic retry, so idempotency is moot (02 §6).
   - `store: (hash)` calls `serviceClient().rpc('invite_token_store', { target: account.id, hash })`
     and returns `!error && data !== null`. On error it logs `console.error('invite store failed', error.code)`.
4. Logs never include the token, the hash, the e-mail or the link (AC 8).

**Per action** (validation and early refusals are unchanged; only the send step changes):

| Action | File | Order | On failure |
|---|---|---|---|
| `invite` (staff) | `handlers/invite.ts` | profile e-mail check (`already_exists`) → `createInvitedAccount(email, fullName, 'tutor')` → `sendAccountInvite({ id, email, role: 'tutor' })` → audit `invite_sent` → `succeed({ userId })` | create fails → its code (`already_exists` / `server_error`); send or store fails → `deleteAccount(id)`, `email_failed` (AC 21) |
| `invite-student` | `handlers/invite-student.ts` | unchanged checks (`consent_needed`, …) → create (`'student'`) → link roster row → `sendAccountInvite` (replaces `:49`) → audit `student_invited` | as today: delete the account, `email_failed` |
| `invite-parent` | `handlers/invite-parent.ts` | existing parent e-mail → link, `parent_linked`, **no send, no token** (AC 41, unchanged `:39-46`) · new parent → create (`'parent'`) → link → `sendAccountInvite` (replaces `:59`) → audit `parent_invited` | as today: delete the account, `email_failed` |
| `resend-invite` | `handlers/resend-invite.ts` | `findAccount` → `status !== 'invited'` → `already_joined` → `sendAccountInvite(target)` (replaces `sendSetupLink`, `:22`) → audit `invite_resent` | `email_failed`. **Nothing is deleted or written**: the account, its links, the old token and `invited_at` stay (AC 39). Always an invite email, never a reset (AC 14) |
| `cancel-invite` | `handlers/cancel-invite.ts` | **No code change.** `is_active = false` (the claim then refuses under its `for share` lock) → `deleteUser` → the profile goes by cascade, and its token row with it (AC 15) | delete fails → `is_active` restored, token untouched (correct: nothing was cancelled) |

The `resend-invite` header comment (`:1-3`) changes to say a re-send always issues a new 14-day
invite link and switches the old one off only once the email is accepted. The audit details are
unchanged (`{ email }`, no token; AC 8, 22).

**Mailpit and Resend paths** (unchanged transport code, now shared):

- **Local:** `[edge_runtime.secrets]` (`config.toml:408-427`) already gives every local function
  `EMAIL_TRANSPORT=mailpit`, `MAILPIT_URL` and `SITE_URL=http://localhost:5173`. The email lands in
  Mailpit (`http://127.0.0.1:55324`), with the random `Idempotency-Key` echoed into its headers.
- **Hosted:** `deploy.sh` already sets `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY` and
  `SITE_URL=https://ajclasses.com.au` project-wide, so `account-admin` sees them with no new secret.
  `POST https://api.resend.com/emails` from `AJ Classes <hello@ajclasses.com.au>`, `reply_to`
  `hello@ajclasses.com.au`, HTML and text.
- **Outcome mapping** (unchanged `outcomeForStatus`): 2xx → stored; 429, 409, 5xx, timeout,
  network, or any other 4xx → `email_failed`.

### 4.3 `invite-redeem` (new function)

**Files:**

- `supabase/functions/invite-redeem/index.ts`: HTTP and wiring (Deno).
- `supabase/functions/invite-redeem/redeem.ts`: the decision logic with I/O passed in (pure,
  Node-importable).

**Contract:**

`POST /functions/v1/invite-redeem`. Body: `{ "token": "<43 chars>" }`. No `Authorization` needed
(the browser's supabase-js sends the publishable key; `verify_jwt = false`).

| Order | Case | HTTP | Body |
|---|---|---|---|
| 1 | `OPTIONS` | 204 | none, `corsHeaders(origin)` |
| 2 | Not `POST` | 405 | `{ ok: false, code: 'method_not_allowed' }` |
| 3 | `Origin` not in `ALLOWED_ORIGINS` (`isAllowedOrigin`, as `leads/index.ts:29`) | 403 | `{ ok: false, code: 'forbidden' }` |
| 4 | Body isn't JSON | 400 | `{ ok: false, code: 'invalid_request' }` |
| 5 | Success | 200 | `{ ok: true, data: { tokenHash } }`. Nothing else: no e-mail, id, role or expiry |
| 6 | Every refusal: token missing, not a string or badly shaped; unknown, used, expired, replaced, cancelled; account active, deactivated or deleted; rate-limited; identity mismatch | 200 | `{ ok: false, code: 'invite_invalid' }`, **byte-identical in every case** (AC 11) |
| 7 | Unexpected error (RPC or Auth failure) | 500 | `{ ok: false, code: 'server_error' }`, after `invite_token_release` if a claim had succeeded |

All replies go through `respond()` (`_shared/responses.ts`), so they carry the CORS headers and
`Content-Type: application/json`. A missing or garbled token is a 200 refusal, not a 400, so it
looks like every other refused link (AC 10, 11).

**`redeem.ts`:**

```ts
type RecoveryLink = { userId: string; userCreatedAt: string; verificationType: string; hashedToken: string };
type RedeemSteps = {
  claim: (hash: string) => Promise<string | null | 'rate_limited'>; // invite_token_claim
  release: (hash: string) => Promise<void>;                          // invite_token_release
  emailOf: (profileId: string) => Promise<string | null>;            // null: no such auth user
  recoveryLink: (email: string) => Promise<RecoveryLink | null>;     // null: 404 user_not_found
  deleteUser: (userId: string) => Promise<void>;
  now: () => number;
};
type RedeemOutcome =
  | { kind: 'ok'; tokenHash: string }
  | { kind: 'refused'; reason: 'shape' | 'claim' | 'rate_limited' | 'no_user' | 'not_found' | 'mismatch' | 'stray_user_removed' };
redeemInvite(token: unknown, steps: RedeemSteps): Promise<RedeemOutcome>
```

1. If `!isInviteToken(token)` → refused `shape`. No database call (02 §3.2).
2. `hash = await hashInviteToken(token)`. `claimed = await steps.claim(hash)`.
   - `'rate_limited'` → refused `rate_limited`.
   - `null` → refused `claim`.
   - A thrown error propagates (nothing was claimed: the RPC is one transaction).
3. From here on, any refusal **and** any throw first calls `steps.release(hash)` (try/catch around
   steps 4–6, release, then return the refusal or rethrow).
4. `email = await steps.emailOf(claimed)`. Null → refused `no_user`.
5. `link = await steps.recoveryLink(email)`. Null → refused `not_found`.
6. Identity check (02 §4, revised after review-3 blocking 1):
   - **On `recovery`, never delete.** `recovery` never creates a user, so a reply for a different
     user is always an existing account. For example, a redeem claims, then the admin cancels and
     at once re-invites the same e-mail, so `generateLink` returns the admin's fresh, legitimate
     account. When `link.verificationType === 'recovery'` and `link.userId !== claimed`, refuse with
     `mismatch`. Release happens as step 3 says, and so does the log.
   - **Delete only a user GoTrue may have just created.** That is when **all three** hold:
     `link.userId !== claimed`, `link.verificationType !== 'recovery'`, and
     `steps.now() - Date.parse(link.userCreatedAt) < 60_000`. Then call `steps.deleteUser(link.userId)`
     and refuse with `stray_user_removed`. This branch exists only so that a future GoTrue change
     can't turn a redeem into an account.
   - Any other `link.verificationType !== 'recovery'` (same user, or an older user) → refuse
     `mismatch`, no delete.
7. Return `{ kind: 'ok', tokenHash: link.hashedToken }`. The claim stays (single use).

**`index.ts` wiring:**

| Step | Implementation |
|---|---|
| `claim` | `serviceClient().rpc('invite_token_claim', { hash, client_ip_hash: await hashClientAddress(request) })`. `error?.message === 'rate_limited'` → `'rate_limited'`; any other error → throw; else `data` (uuid or null) |
| `release` | `rpc('invite_token_release', { hash })`; an error throws |
| `emailOf` | `auth.admin.getUserById(id)`. Error with `status === 404` → null; other error → throw; else `data.user.email ?? null` |
| `recoveryLink` | `auth.admin.generateLink({ type: 'recovery', email })`. Error with `status === 404` or `code === 'user_not_found'` → null; other error → throw. Else map `data.user.id`, `data.user.created_at`, `data.properties.verification_type`, `data.properties.hashed_token`. `action_link` and `email_otp` are never read or returned |
| `deleteUser` | `auth.admin.deleteUser(id)` |
| `now` | `Date.now` |

**Logging** (02 §3.4, AC 8): `console.info('invite-redeem', outcome.kind === 'ok' ? 'ok' : outcome.reason)`.
`rate_limited`, `mismatch` and `stray_user_removed` use `console.warn` instead, with the reason only
and no ids (review-3 finding 7). A throw logs `console.error('invite-redeem failed', error.name)`.
No token, hash, `tokenHash`, e-mail or user id is ever logged. No audit entry (AC 22).

**Rate limit:** 10 allowed claims per 15 minutes per salted address hash, counted in SQL (§2,
step 3). The key is the leftmost `x-forwarded-for` (02 §3.3; the trust caveat stands). Shape
refusals are not counted, because they never reach the database.

**`config.toml`:** add after `[functions.notifications]` (`:465-468`):

```toml
# invite-redeem (ADR-0010): the person redeeming an invite is signed out, so the gateway doesn't
# check a token; the function allows only the site's origins and rate-limits by address.
[functions.invite-redeem]
verify_jwt = false
```

**`deploy.sh:27`:** `FUNCTIONS=(account-admin invite-redeem leads notifications)`. No new secret:
`ALLOWED_ORIGINS` and `SUPABASE_SERVICE_ROLE_KEY` are already there.

---

## 5. Web

### 5.1 Constants

| File | Change |
|---|---|
| `constants/app.constants.ts:88-94` | `AUTH_LIMITS.linkExpiryHours` stays `1`; its comment becomes `// password-reset links (Supabase otp_expiry); invites use INVITE_LIMITS`. New, below it: `const INVITE_LINK_LIFETIME_HOURS = 336;` and `export const INVITE_LIMITS = { linkLifetimeHours: INVITE_LINK_LIFETIME_HOURS, linkLifetimeDays: INVITE_LINK_LIFETIME_HOURS / 24 } as const;` with the comment `// Must match interval '336 hours' in migration 20261030100000_invite_tokens.sql and INVITE_LIFETIME_HOURS in supabase/functions/account-admin/invite-copy.ts (ADR-0010).` |
| `constants/portal.constants.ts:550` | `INVITE_DIALOG.intro`: `` `They'll get an e-mail to set their password. The link works for ${INVITE_LIMITS.linkLifetimeDays} days; you can resend it.` `` (AC 26). Import `INVITE_LIMITS` |
| `constants/portal.constants.ts:153` | **No change**: `FORGOT_PASSWORD_PAGE.sent` keeps `AUTH_LIMITS.linkExpiryHours` (AC 32) |
| `constants/portal.constants.ts:9-16` | `PORTAL_SEO.invite: 'Accept invite'` |
| `constants/routes.constants.ts:20-27` | `PORTAL_ROUTES.invite: '/portal/invite', // invite email link (ADR-0010); must match account-admin/invite-copy.ts INVITE_PATH` |
| `constants/routes.constants.ts:99-104` | `PORTAL_QUERY.inviteToken: 'token', // must match INVITE_TOKEN_PARAM`; the `tokenHash` comment becomes `// from reset emails (supabase/templates/recovery.html) and old invite links` |
| `constants/error.constants.ts:118-121` | Remove `AUTH_LINK_ERRORS.invite`, which is dead once §5.5 lands. Keep `recovery` |

Page copy reuses existing keys with no new words. `AUTH_CONFIRM_PAGE.heading.invite`
(`Welcome to AJ Classes`), `.intro.invite`, `.continue`, `.checking`, `.invalidLink`, `.alreadySetUp`;
`PORTAL_ERRORS.linkExpired`, `.inviteExpired`, `.network`, `.serverProblem`, `.unknown`;
`PORTAL_COMMON.tryAgain` (`Try again`).

### 5.2 Services

1. **`services/account-admin.client.ts`**: extract the body of `callEdgeFunction` (`:21-38`) into
   `invokeEdgeFunction(functionName, body: Record<string, unknown>)`. `callEdgeFunction(fn, action,
   input)` becomes `invokeEdgeFunction(fn, { action, ...input })`, with the same behaviour for
   account-admin and leads. `replyFromError` stays private.
2. **`services/invites.service.ts` (new):**
   - `redeemInvite(token: string): Promise<Result<{ tokenHash: string }>>`. If
     `!isPortalConfigured()`, `fail('notConfigured')`. Else
     `invokeEdgeFunction('invite-redeem', { token })` (a local `const INVITE_REDEEM = 'invite-redeem'`).
     On `ok`, `data.tokenHash` must be a non-empty string, otherwise `fail('unknown')`.
   - `signInWithInviteHop(tokenHash: string): Promise<Result>`. Calls `confirmRecoveryLink(tokenHash)`.
     If the result is `fail('network')`, it calls once more and returns the second result (02 §4,
     finding 4). Any other result is returned as it is.
3. **`services/auth.service.ts:72-81`**: `confirmEmailLink(tokenHash, type)` becomes
   `confirmRecoveryLink(tokenHash)`, which always calls `verifyOtp({ token_hash, type: 'recovery' })`.
   After this, no code path can verify an Auth invite token (AC 38). Update `services/index.ts:12-23`
   to export `confirmRecoveryLink`, `redeemInvite` and `signInWithInviteHop`.
4. **`services/auth-errors.ts:57-113`**: add `invite_invalid: 'inviteExpired'` to `ERROR_KEYS_BY_OWN_KEY`.
5. `services/types.ts:78`: `EmailLinkType` stays `'invite' | 'recovery'`. The confirm page still
   reads both values from the URL.

Error mapping as it reaches the page:

| Server reply | Result |
|---|---|
| 200 `invite_invalid` | `inviteExpired` |
| 500 `server_error` | `serverProblem` |
| 403 `forbidden` | `unknown` |
| Network | `unknown` (supabase-js `FunctionsFetchError` isn't mapped to `network` today) |

Every case except `inviteExpired` is retryable on the page.

### 5.3 `lib/account-status.ts`

`:4` imports `INVITE_LIMITS` instead of `AUTH_LIMITS`. `:19` becomes
`now.getTime() - invitedAt < INVITE_LIMITS.linkLifetimeHours * HOUR_MS` (strict, matching
`expires_at > now()`). A null `invitedAt` still counts as 0, so the invite shows as expired (AC 25,
`:18` unchanged). The header comment notes that invites last 14 days (ADR-0010).

### 5.4 Route `/portal/invite`

- `routes.ts:26-33`: add `route(PORTAL_ROUTES.invite, 'routes/portal/invite.tsx')` next to
  `authConfirm`, inside `layout('routes/portal/portal-root.tsx', …)`. **ErrorBoundary:** inherited
  from `portal-root.tsx:28`, as every portal route does. The house rule is met by the layout, so
  the route adds no second boundary (same as `auth-confirm`, `join`).
- No `clientLoader` and no guard: a signed-out page, like `auth-confirm`.
- `meta()` returns `buildPortalMeta(PORTAL_SEO.invite)`.

**`lib/invite-steps.ts` (new, pure):**

```ts
type InviteStep =
  | { kind: 'ready' }
  | { kind: 'checking' }
  | { kind: 'refused' }
  | { kind: 'retry'; error: ErrorKey; tokenHash: string | null };
afterRedeem(result: Result<{ tokenHash: string }>): { kind: 'hop'; tokenHash: string } | InviteStep
afterHop(result: Result, tokenHash: string): { kind: 'signedIn' } | InviteStep
```

| Input | Next |
|---|---|
| redeem ok | `hop` with `tokenHash` |
| redeem `inviteExpired` | `refused` |
| redeem any other error | `retry` (`error`, `tokenHash: null`: Try again re-POSTs) |
| hop ok | `signedIn` |
| hop `linkExpired` (Supabase token gone: account deleted, or > 1 h) | `refused` |
| hop any other error (already retried once on `network` by the service) | `retry` (`error`, same `tokenHash`: Try again only re-verifies) |

**`routes/portal/invite.tsx` (new):**

- `tokenFromUrl = searchParams.get(PORTAL_QUERY.inviteToken) ?? ''`. A `useRef` keeps the token
  once Continue is clicked, so Try again never depends on the address bar.
- `handleContinue`:
  1. Store the token in the ref.
  2. `window.history.replaceState(null, '', PORTAL_ROUTES.invite)` **before any request** (AC 8;
     `auth-confirm.tsx:58` does this after the request, but here the request is ours, so it moves earlier).
  3. Set the step to `checking`.
  4. If the current step is `retry` with a `tokenHash`, skip to the hop. Otherwise
     `afterRedeem(await redeemInvite(token))`, and on `hop`, `afterHop(await signInWithInviteHop(tokenHash), tokenHash)`.
  5. `signedIn` → `navigate(PORTAL_ROUTES.join, { replace: true })`. Otherwise set the step.
- Nothing runs on page load (AC 6). There is no client-side shape check (H-1).

| State | When | Heading | Intro | Body |
|---|---|---|---|---|
| Missing | `!tokenFromUrl && !ref.current` | `PORTAL_ERRORS.linkExpired` | `AUTH_CONFIRM_PAGE.invalidLink` | nothing (no Continue; AC 10) |
| Ready | token present | `AUTH_CONFIRM_PAGE.heading.invite` | `AUTH_CONFIRM_PAGE.intro.invite` | Button `AUTH_CONFIRM_PAGE.continue` |
| Checking | after a click | same | same | Button disabled, label `AUTH_CONFIRM_PAGE.checking` |
| Refused | `refused` | same | none | `FormAlert` `PORTAL_ERRORS.inviteExpired` + `Link` to `PORTAL_ROUTES.login` labelled `AUTH_CONFIRM_PAGE.alreadySetUp` (AC 9) |
| Retry | `retry` | same | none | `FormAlert` `PORTAL_ERRORS[error]` + Button `PORTAL_COMMON.tryAgain` (disabled while checking) |

Use `AuthCard`, `FormAlert`, `Button` and `formStyles.actions` exactly as `auth-confirm.tsx` does.
There are no inline styles and no literals (`jsx-no-literals`).

### 5.5 `routes/portal/auth-confirm.tsx`

- `readLinkType` (`:28-30`) is unchanged, so an old invite link still shows the welcome card with
  Continue (AC 10, 38).
- In `handleContinue` (`:52-68`), for `type === 'invite'`: `replaceState` (as `:58`), then
  `setError(PORTAL_ERRORS.inviteExpired)`, with **no service call** and no checking state. The
  existing render then shows AC 9 and the `alreadySetUp` link.
- For `type === 'recovery'`: `confirmRecoveryLink(tokenHash)` → `setPassword` on success. On failure
  the message is `` `${PORTAL_ERRORS[error]} ${AUTH_LINK_ERRORS.recovery}` ``, as today.
  `linkErrorMessage` (`:33-36`) collapses to that one line.
- The header comment (`:1-4`) says invites now land on `/portal/invite` (ADR-0010), and that this
  page refuses old invite links.

### 5.6 Hide `Invited on` when null (02 §5.3)

- `routes/portal/admin-staff-member.tsx:143`: render the `Typography` with
  `STAFF_MEMBER_PAGE.invite.sentOn(…)` only when `person.invitedAt` is set. The expired `Alert`
  (`:144`) is unchanged and still shows.
- `routes/portal/admin-student.tsx:255-257`: the same for `texts.invitedOn(…)` with `account.invitedAt`.
- Parent rows (`admin-student.tsx:~395-420`) show only the status chip, so nothing to hide there.

---

## 6. Docs to touch

1. **`supabase/README.md`**
   1. `:16` table: the `test:functions` row lists `account-admin`, `invite-redeem`, `leads` and
      `notifications`.
   2. `:33` Edge functions paragraph: add that `account-admin` emails invites itself through
      `EMAIL_TRANSPORT` (Mailpit locally), and that `invite-redeem` is the signed-out redeem with
      `verify_jwt = false`. Also: the local stack serves functions from the folder it was started
      in, so start it from the worktree you're testing (§10 risk 1).
   3. `:50-58` **First admin**: replace step 1 with Dashboard → Authentication → **Add user** (their
      e-mail; if a password is required, any long random one: they choose their own on the setup
      form), then the user's row → **Send password recovery**. The 1-hour recovery link opens
      `/portal/auth/confirm?…&type=recovery`, then the set-password route, and the guard sends an
      invited account on to `/portal/join` (`lib/portal-access.ts` rule 2). Steps 2–4 are unchanged.
      Say that Dashboard **Invite user** links are refused now. The Developer confirms the exact
      Studio labels locally first (spike S3).
   4. **New subsection** `### Invites (ADR-0010)`, before "Portal emails":
      - **Lifetime:** 14 days (336 h) from each send, single use. Only the newest link works; a
        re-send or a cancel switches the old one off; a failed re-send changes nothing.
      - **Where it lives:** `private.invite_tokens` (hash only) and `private.invite_redeem_attempts`.
      - **Local flow:** invite from the portal, open Mailpit, open the link on `localhost:5173`, then
        Continue → `/portal/join`.
      - **Clear the local rate limit:** every browser request locally shares one address, so 10
        redeems per 15 minutes is easy to hit:
        `docker exec supabase_db_aj_classes psql -U postgres -c "delete from private.invite_redeem_attempts;"`
      - **Troubleshooting:**
        - "This invitation link has expired…" covers expired, used, replaced, cancelled, garbled
          and old-format links, an account that already joined, and the rate limit. All look the
          same on purpose. Fix: re-send.
        - **Closed tab after Continue:** the link is used up, so re-send.
        - **Hosted Auth logs** show each redeem as `user_recovery_requested` followed by a login for
          that account. That is the sign-in hop, not a password-reset request by the person (R2-N3).
        - **After a rollback** (02 §9), restore pending invite dates with the SQL in §6.6 below.
   5. `:167` **Kill switches**: rewrite to state both switches:
      - `cron.unschedule('email-worker-kick')` stops **only queued app email**. Invites don't use
        the outbox.
      - `supabase secrets unset EMAIL_TRANSPORT …` **stops app emails and invites**: every invite
        and re-send fails with "The invite e-mail couldn't be sent", no account is left behind, a
        re-send changes nothing, and linking an existing parent still works. It **doesn't** stop
        password-reset or sign-in emails, which go through Auth SMTP. Turn back on with `deploy.sh`.
   6. Restore SQL (02 §8), in the troubleshooting list:
      `update public.profiles p set invited_at = u.invited_at from auth.users u where u.id = p.id and p.status = 'invited' and p.invited_at is null;`
2. **`docs/architecture/arch.md`**
   - `:67-68`: Auth sends password reset and sign-in emails through Resend SMTP; invites are our
     own 14-day token (ADR-0010).
   - `:73-75`: the function list adds `invite-redeem` (signed-out redeem of an invite link).
   - `:100-101`: invites are sent by `account-admin` through the Resend HTTP API (Mailpit locally),
     not Auth SMTP, and don't count towards the outbox's 70 cap.
3. **`docs/budget.md:57`**: in the Resend row, "invite" becomes "invite (Resend API since ADR-0010)".
   The quota sentence stays.
4. **`docs/requirements/invite-onboarding.md`**: one line at the top: "The invite link itself
   changed in ADR-0010 (14 days, `/portal/invite`); the setup form is unchanged."
5. **`docs/requirements/release-1/environments.md`**: **no change**. Checked: it covers the
   environment banner and hosts only, and the email-link host (`SITE_URL` = production for both
   staging and prod) is unchanged by this work.
6. **e2e helpers**: see §7 and §8.3.
7. Not for the Developer's diff: ADR-0010 Proposed → Accepted, and DEC-IN-1 to DEC-IN-8 into
   `_knowledge/decisions.md`. The team lead does these when closing the stage.

---

## 7. Files to touch

| File | New / edit | Change |
|---|---|---|
| `supabase/migrations/20261030100000_invite_tokens.sql` | New | §2 |
| `supabase/tests/database/invite_tokens.test.sql` | New | §3 |
| `supabase/functions/_shared/email/transport.ts` | New (moved) | From `notifications/transport.ts`; sender import, parameter rename, log label |
| `supabase/functions/_shared/email/sender.ts` | New (moved) | `SENDER`, `FROM_HEADER` |
| `supabase/functions/_shared/email/config.ts` | New (moved) | `isHostedProject`, `isSafeEmailConfig` |
| `supabase/functions/_shared/email/html.ts` | New (moved) | `escapeHtml`, `oneLine` |
| `supabase/functions/_shared/sha256.ts` | New | `sha256Hex` |
| `supabase/functions/_shared/client-address.ts` | New (moved) | `hashClientAddress` from `leads/rate-limit.ts` |
| `supabase/functions/_shared/invite-token.ts` | New | Make, check and hash the token |
| `supabase/functions/notifications/transport.ts` | Deleted | Moved |
| `supabase/functions/notifications/config.ts` | Edit | Keeps the worker-secret gate; imports the shared check |
| `supabase/functions/notifications/copy.ts` | Edit | Drop `SENDER` and `COPY.from` (moved) |
| `supabase/functions/notifications/template.ts` | Edit | Import `escapeHtml`, `oneLine`, `EmailMessage` from shared |
| `supabase/functions/notifications/batch.ts`, `index.ts` | Edit | Import paths only |
| `supabase/functions/leads/rate-limit.ts` | Edit | Use `hashClientAddress` |
| `supabase/functions/account-admin/invite-copy.ts` | New | Invite email words and link constants |
| `supabase/functions/account-admin/invite-email.ts` | New | Audience, link, HTML and text renderer |
| `supabase/functions/account-admin/issue-invite.ts` | New | send → store ordering, I/O injected |
| `supabase/functions/account-admin/handlers/accounts.ts` | Edit | `createInvitedAccount`, `sendAccountInvite`; remove `sendInvite`, `sendSetupLink` |
| `supabase/functions/account-admin/handlers/invite.ts` | Edit | `createUser` + `sendAccountInvite`, roll back on failure |
| `supabase/functions/account-admin/handlers/invite-student.ts` | Edit | `createInvitedAccount`, `sendAccountInvite` |
| `supabase/functions/account-admin/handlers/invite-parent.ts` | Edit | Same |
| `supabase/functions/account-admin/handlers/resend-invite.ts` | Edit | `sendAccountInvite(target)`; comment |
| `supabase/functions/invite-redeem/index.ts` | New | §4.3 HTTP and wiring |
| `supabase/functions/invite-redeem/redeem.ts` | New | §4.3 logic |
| `supabase/config.toml` | Edit | `[functions.invite-redeem] verify_jwt = false` |
| `supabase/scripts/deploy.sh` | Edit | `invite-redeem` in `FUNCTIONS` |
| `supabase/scripts/local-test-helpers.mjs` | Edit | Export `serviceKey` (`SERVICE_ROLE_KEY` from `supabase status`), `adminApi(path, body)`, `mailpitText(id)`, `latestMailTo(email)` |
| `supabase/scripts/test-account-admin.mjs` | Edit | New-format link, token row, `invited_at`, refused callers, audit, AC 41 |
| `supabase/scripts/test-invite-redeem.mjs` | New | §8.3 |
| `supabase/scripts/test-notifications.mjs` | Edit | Import paths for the moved modules |
| `package.json:26` | Edit | `test:functions` appends `&& node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON supabase/scripts/test-invite-redeem.mjs` |
| `apps/web/src/services/database.types.ts` | Regenerated | `pnpm db:types` (adds the three RPCs) |
| `apps/web/src/constants/app.constants.ts` | Edit | `INVITE_LIMITS`; reset comment |
| `apps/web/src/constants/portal.constants.ts` | Edit | `INVITE_DIALOG.intro`, `PORTAL_SEO.invite` |
| `apps/web/src/constants/routes.constants.ts` | Edit | `PORTAL_ROUTES.invite`, `PORTAL_QUERY.inviteToken` |
| `apps/web/src/constants/error.constants.ts` | Edit | Remove `AUTH_LINK_ERRORS.invite` |
| `apps/web/src/constants/invite-copy.test.ts` | New | AC 26, 32 constants checks |
| `apps/web/src/services/account-admin.client.ts` | Edit | Extract `invokeEdgeFunction` |
| `apps/web/src/services/invites.service.ts` | New | `redeemInvite`, `signInWithInviteHop` |
| `apps/web/src/services/invites.service.test.ts` | New | Mapping and retry-once |
| `apps/web/src/services/auth.service.ts` | Edit | `confirmRecoveryLink` |
| `apps/web/src/services/auth-errors.ts` | Edit | `invite_invalid` |
| `apps/web/src/services/index.ts` | Edit | Exports |
| `apps/web/src/lib/account-status.ts` | Edit | 336 h rule |
| `apps/web/src/lib/account-status.test.ts` | Edit | 14-day samples |
| `apps/web/src/lib/invite-steps.ts` | New | Pure state rules |
| `apps/web/src/lib/invite-steps.test.ts` | New | Every row of the §5.4 table |
| `apps/web/src/routes.ts` | Edit | `/portal/invite` route |
| `apps/web/src/routes/portal/invite.tsx` | New | §5.4 |
| `apps/web/src/routes/portal/invite.test.tsx` | New | Page states |
| `apps/web/src/routes/portal/auth-confirm.tsx` | Edit | Refuse `type=invite` locally |
| `apps/web/src/routes/portal/auth-confirm.test.tsx` | New | Old link refused, recovery unchanged |
| `apps/web/src/routes/portal/admin-staff-member.tsx` | Edit | Hide `Invited on` when null |
| `apps/web/src/routes/portal/admin-student.tsx` | Edit | Same |
| `e2e/src/db/invites.ts` | New | `clearInviteRedeemAttempts()`, `backdateInvite(email, interval)` |
| `e2e/tests/invite-onboarding.spec.ts` | Edit | New link pattern; AC 6, 7, 8, 25 checks |
| `supabase/README.md` | Edit | §6 item 1 |
| `docs/architecture/arch.md` | Edit | §6 item 2 |
| `docs/budget.md` | Edit | §6 item 3 |
| `docs/requirements/invite-onboarding.md` | Edit | §6 item 4 |

Not touched: `supabase/templates/*`, `account-admin/index.ts`, `cancel-invite.ts`,
`set-active.ts`, `reset-two-step.ts`, `_shared/auth.ts`, `seed.sql`, `join.tsx`,
`portal-access.ts`, the mobile repo. Keep the untracked `actionItems.md` out of every commit.

---

## 8. Test approach

### 8.1 Local methods (local stack only; never hosted)

All SQL runs as `postgres` through
`docker exec supabase_db_aj_classes psql -U postgres -c "…"` (no `psql` on this Mac). On the shared
local stack, **one role owns state-changing commands** (restart, migration, test runs that write)
at a time. The others stay read-only (team-lead rule; item 8 lesson).

1. **Serve this branch's functions.** The local edge runtime serves functions from the folder the
   stack was started in. Today that is a deleted worktree (`aj_classes-items-4-9`; see §10 risk 1).
   Before any function or e2e test: from `/Users/sjain/dev/work/aj_classes-invites`, run
   `pnpm db:stop && pnpm db:start` (data is kept), then `supabase migration up` (applies only
   `20261030100000`; **not** `db reset`). Review-3 finding 3 adds two steps:
   - **Before** the restart, tell whoever owns `aj_classes-hiring`. The restart moves the shared
     stack to this worktree's functions and briefly stops it for them.
   - **After** it, check the mount:
     `docker inspect supabase_edge_runtime_aj_classes --format '{{range .Mounts}}{{.Source}}{{end}}'`
     must show `/Users/sjain/dev/work/aj_classes-invites/supabase/functions`. Don't run any
     function or e2e test until it does.
2. **Back-date a link (AC 1–5, 16, 23; H-2).** Move the token **and** the profile date by the same
   amount, so the link and the chip agree. `sent_at` moves too, so `expires_at > sent_at` holds:

   ```sql
   update private.invite_tokens t
      set sent_at = t.sent_at - interval '13 days 23 hours',
          expires_at = t.expires_at - interval '13 days 23 hours'
     from public.profiles p
    where p.id = t.profile_id and p.email = 'someone@example.test';
   update public.profiles
      set invited_at = invited_at - interval '13 days 23 hours'
    where email = 'someone@example.test';
   ```

   Samples: `13 days` (AC 1, works), `13 days 23 hours` (AC 2, works), `14 days 1 minute` (AC 3,
   refused), `15 days` (AC 4, refused). Run it right after the send, so "now − send" is the
   interval plus a few seconds.
3. **Clear the redeem rate limit** before any browser or e2e redeem:
   `delete from private.invite_redeem_attempts;`. The Node script avoids the shared bucket by
   sending a unique `x-forwarded-for` per run (local Kong keeps the leftmost entry, as
   `test-leads.mjs:24` relies on).
4. **Make an old-format link (AC 38; H-3).** With the service key from `supabase status -o json`
   (`SERVICE_ROLE_KEY`; keep it in a scratch file, never in the TSR):
   `POST http://127.0.0.1:55321/auth/v1/admin/generate_link` with headers `apikey` and
   `Authorization: Bearer <key>`, and body `{ "type": "invite", "email": "old-link-<n>@example.test" }`.
   Build `http://localhost:5173/portal/auth/confirm?token_hash=<properties.hashed_token>&type=invite`.
   The admin chip shows `Invited` for this fixture: Auth set `invited_at` and the guarded trigger
   copied it, which is expected. Delete the user afterwards (`delete from auth.users where email = …`).
5. **Turn invite email off (AC 21, 36, 39, 41).** In the local `supabase/config.toml` (not
   committed), set `EMAIL_TRANSPORT = "off"`, then `pnpm db:stop && pnpm db:start`. Afterwards,
   revert the file and restart again (README `:35` documents the restart). Alternative, if the
   Developer confirms it overrides config secrets (spike S2):
   `supabase functions serve --env-file <scratch>/email-off.env` with `EMAIL_TRANSPORT=off`.
6. **Defence-in-depth states.** AC 17 (active):
   `update public.profiles set status = 'active', joined_at = now() where email = '…';`.
   AC 18 (deactivated): `update public.profiles set is_active = false where email = '…';`.
   Issue the link first and don't use it. For AC 17's password sign-in, first give the account a
   known local-only password (review-3 finding 5):
   `PUT http://127.0.0.1:55321/auth/v1/admin/users/<id>`, with the service key headers as in item 4
   and body `{ "password": "<long local test password>" }`. That is `auth.admin.updateUserById`.
   Then sign in at `/portal/login` with it.
7. **Prove a token never leaks (AC 8):** after a redeem,
   `select count(*) from public.audit_log where details::text like '%<token>%'` = 0, and
   `docker logs supabase_edge_runtime_aj_classes 2>&1 | grep -c '<token>'` = 0 (also try the hash
   and the `tokenHash`).

### 8.2 Per AC

"Script" = `supabase/scripts/test-invite-redeem.mjs` unless it says `test-account-admin.mjs`.
"Unit" = Node checks inside those scripts.

| AC | How | Where |
|---|---|---|
| 1 | Back-date 13 d → redeem `ok`; `POST /auth/v1/verify {type:'recovery', token_hash}` gives a session whose `user.id` is the account. Browser: Continue → `/portal/join` | Script + Tester browser |
| 2 | Back-date 13 d 23 h → `ok` | Script |
| 3 | Back-date 14 d 1 min → `invite_invalid`; browser shows AC 9 | Script + Tester |
| 4 | Back-date 15 d → `invite_invalid` | Script |
| 5 | Method §8.1 item 2 recorded in the test plan; local only | Tester |
| 6 | Render with a token: no service called. e2e: `goto(link)` 3 times, then Continue works | `invite.test.tsx` + e2e |
| 7 | Second redeem → `invite_invalid`. e2e: after join, open the same link in a fresh context → AC 9 | Script + e2e |
| 8 | `replaceState` called before `redeemInvite` (call-order spy); e2e: after Continue, `location.search === ''`; §8.1 item 7 | `invite.test.tsx` + e2e + script/Tester |
| 9 | Refused state: heading, `inviteExpired` text, `alreadySetUp` link to `/portal/login` | `invite.test.tsx` + browser |
| 10 | No token → `invalidLink`, no button; `?token=abc` → Continue shown; script: `abc` → `invite_invalid` | `invite.test.tsx` + script |
| 11 | Collect replies for expired, used, replaced, cancelled, garbled, unknown, active, inactive, rate-limited: all `200` with identical body text | Script |
| 12 | For staff, student, parent: resend → old `invite_invalid`, new `ok` | Script |
| 13 | Two resends → only the third link works | Script |
| 14 | Redeem + verify (confirms the e-mail), never join, resend → Mailpit subject `You're invited to the AJ Classes portal`, text has `/portal/invite?token=`, new link works | Script + Tester |
| 15 | Cancel → link `invite_invalid`; token row gone | Script |
| 16 | Back-date 10 d, resend, back-date the new link 13 d → `ok` | Script |
| 17 | §8.1 item 6 → `invite_invalid`, no session, `last_sign_in_at` unchanged. Password sign-in with the account's password works | Script + Tester (sign-in) |
| 18 | `is_active = false` → `invite_invalid`, `last_sign_in_at` unchanged | Script |
| 19 | Existing checks: `already_exists`, `already_joined`, `already_has_account`, parent linked | `test-account-admin.mjs` (unchanged) |
| 20 | Existing no-token, tutor, admin-aal1 checks, plus student and parent tokens → `not_admin`. After all refused calls: token rows, Mailpit count and audit count unchanged | `test-account-admin.mjs` |
| 21 | `consent_needed` (existing). Email off (§8.1 item 5): staff, student and parent first invites → `email_failed`, no `profiles`/`auth.users` row for the e-mail, roster `profile_id` still null | Script unit (`issueInvite` send fails → store not called, returns false) + Tester |
| 22 | `invite_sent`, `student_invited`, `parent_invited`, `invite_resent`, `invite_cancelled`, `parent_linked` each written once for its action | `test-account-admin.mjs` |
| 23 | Rule at 13 d, 13 d 23 h, 336 h exactly, 14 d 1 min; browser on Staff, the staff member page, Students and the student page (account + parent rows) with back-dated rows: chip and both warnings | `account-status.test.ts` + Tester |
| 24 | After resend, `invited_at` > the previous value and equals the token's `sent_at`; browser `Invited on` shows it | Script + Tester |
| 25 | After `migration up`, no invited profile has a non-null `invited_at` without a token row. e2e: an invited account with null `invited_at` (SQL insert into `auth.users` without `invited_at`) shows `Invite expired` and no `Invited on` | Tester SQL + e2e + `account-status.test.ts` (null) |
| 26 | `INVITE_DIALOG.intro` equals the AC 26 sentence; `INVITE_LIMITS.linkLifetimeDays === INVITE_LIMITS.linkLifetimeHours / 24` | `invite-copy.test.ts` (web) |
| 27 | pgTAP #18; migration review (no drop or rename). Optional: mobile admin lists load against local | pgTAP + Reviewer + Tester |
| 28 | Rendered subject, heading, label and body per role, button, ignore line; Mailpit `From` `AJ Classes <hello@ajclasses.com.au>`; `resendRequest` `from`/`reply_to` (existing) | Script unit + `test-account-admin.mjs` + `test-notifications.mjs` |
| 29 | HTML and text contain the exact AC 29 sentence; neither contains `1 hour` | Script unit |
| 30 | Text contains the full link | Script unit + e2e (`extractLink` reads `Text`) |
| 31 | Link starts `http://localhost:5173/portal/invite?token=`; contains neither `supabase` nor `auth/confirm`. Hosted: Saurabh's release check | Script + release check |
| 32 | `FORGOT_PASSWORD_PAGE.sent` ends `It expires in 1 hour.`; `AUTH_LIMITS.linkExpiryHours === 1`; `recovery.html` untouched (`git diff`) | `invite-copy.test.ts` + Reviewer |
| 33 | `git diff supabase/config.toml` only adds the functions block; `otp_expiry = 3600` | Reviewer |
| 34 | `staff-login.spec.ts` and the existing auth unit tests pass unchanged | CI-equivalent run |
| 35 | One Mailpit message per send (staff, student, parent, resend) to that address; e2e link works on 5173 | `test-account-admin.mjs` + e2e |
| 36 | Unit `pickTransport` null (existing). Email off: each action `email_failed`; nothing emailed; first invites leave no account; resend changes nothing; parent link works | Tester (§8.1 item 5) |
| 37 | Re-send cancels the old link (AC 12) and used link refused (AC 7): script + e2e. Expired link refused (AC 3): script. Failed re-send keeps the previous link: script unit (`issueInvite` ordering) + Tester email-off run (§10 risk 6) | As listed |
| 38 | `type=invite` → Continue → AC 9, `confirmRecoveryLink` not called; `type=recovery` still calls it. Browser with the §8.1 item 4 fixture | `auth-confirm.test.tsx` + Tester |
| 39 | Email off: resend → `email_failed`; the previous link still redeems `ok`; `invited_at` and the chip unchanged; no new `invite_resent` | Script unit + Tester |
| 40 | After each invite and resend, `profiles.invited_at` = `invite_tokens.sent_at`; pgTAP #5, #17 | `test-account-admin.mjs` + pgTAP |
| 41 | Existing parent link: `linked: true`, no token row for that parent, no new Mailpit message. Also under email off | `test-account-admin.mjs` + Tester |

Also checked by script, not by AC: REST can't reach `private` (02 §2, finding 8).
`GET /rest/v1/invite_tokens` with `Accept-Profile: private`, as the publishable key and as a
signed-in tutor, returns 406 (`PGRST106`); same for `invite_redeem_attempts`. Rate limit: 10
redeems from one fresh address, then the 11th gives the identical `invite_invalid`, and another
address still works. Deleted-user race (02 §4, finding 1d): unit `redeemInvite` with
`recoveryLink` → null releases and refuses. Identity cases, revised for review-3 blocking 1:

| `userId` | `verificationType` | Created | Expect |
|---|---|---|---|
| another user | `recovery` | < 60 s ago | `mismatch`, release, **no `deleteUser`** (the cancel-and-re-invite case) |
| another user | `recovery` | older | `mismatch`, release, no delete |
| another user | `magiclink` | < 60 s ago | `stray_user_removed`, `deleteUser(that id)`, release |
| another user | `magiclink` | older | `mismatch`, release, no delete |
| same user | `magiclink` | any | `mismatch`, release, no delete |

Each refused case asserts the `console.warn` reason and that no id is logged.
Integration: `generateLink({ type: 'recovery', email: 'nobody-<stamp>@local.test' })` with the
service key returns 404, and `auth.users` count is unchanged.

### 8.3 New and changed test files

1. **`test-invite-redeem.mjs`:**
   - **Unit:** `newInviteToken` is 43 chars and matches the pattern, and 100 tokens are distinct.
     `isInviteToken` rejects 42 and 44 chars, `+`, `/`, `=`, non-strings. `hashInviteToken` gives
     64 lower hex chars, equal to `node:crypto` SHA-256.
   - **Unit:** `renderInviteEmail` for tutor, admin, student and parent (label, intro, AC 28–30).
     `inviteLink` trims trailing slashes.
   - **Unit:** `issueInvite` with fakes. Send `failed` or `retry` → store never called, false.
     Send `sent` + store false → false. Send `sent` + store true → true. The stored hash equals the
     hash of the token in the message's link.
   - **Unit:** every `redeemInvite` branch in §4.3, including release on each post-claim refusal
     and on a thrown `recoveryLink`.
   - **Integration:** HTTP cases 1–7 of §4.3 (no-Origin → 403 using `headers: { Origin: … }` as in
     `test-leads.mjs:24`), then AC rows marked "Script" above.
   - Create accounts through `account-admin` with `@local.test` addresses stamped per run. Read the
     token from Mailpit's `Text`. Clean up with `cancel-invite` or `delete from auth.users`.
2. **`test-account-admin.mjs`:**
   - Existing checks stay. The "worded for staff / students / parents" checks now read our email.
   - Add: the link pattern; a token row exists, and its hash is not the token; `invited_at` = `sent_at`.
   - Add: AC 20 extra callers and "no change" counts; AC 22 audit counts; AC 41 no token or mail.
3. **`test-notifications.mjs`:** only the import lines change (`../functions/_shared/email/…`).
   Every existing check must still pass. This is the "no behaviour change" proof for the move.
4. **pgTAP:** §3.
5. **Vitest:**
   - `account-status.test.ts`: replace the 1-hour cases with the AC 23 samples, plus null → expired.
   - `invite-steps.test.ts`: the §5.4 table.
   - `invites.service.test.ts`: mock `invokeEdgeFunction` and `confirmRecoveryLink`.
     `invite_invalid` → `inviteExpired`. A missing `tokenHash` → `unknown`. Hop retried exactly
     once on `network`, and not retried on `linkExpired`.
   - `invite.test.tsx`: `createRoutesStub`, `vi.mock('@/services')` as `submission.test.tsx:12`. All
     five states; no call on render; Try-again after a hop failure calls only `signInWithInviteHop`
     with the same hash; Try-again after a redeem failure calls `redeemInvite` again; success
     navigates to `PORTAL_ROUTES.join`.
   - `auth-confirm.test.tsx`: missing parameters → `invalidLink`; `type=invite` → AC 9 with no
     service call; `type=recovery` success → `setPassword`, failure → message + `requestNewLink`.
   - `constants/invite-copy.test.ts`: AC 26 and AC 32.
   - Query by role and constants, not literal strings.
6. **e2e:**
   - `e2e/src/db/invites.ts` holds the two helpers.
   - `invite-onboarding.spec.ts`:
     - `INVITE_LINK_PATTERN = /https?:\/\/[^\s")]+\/portal\/invite\?token=[A-Za-z0-9_-]{43}/`;
     - call `clearInviteRedeemAttempts()` before the redeem;
     - open the link 3 times before Continue (AC 6);
     - assert `location.search` is empty after Continue (AC 8);
     - after `active`, open the link in a new context → AC 9 text (AC 7).
   - A second test in the same file covers AC 25: insert an invited `auth.users` row with no
     `invited_at`, open its staff member page as the admin, expect `Invite expired` and no
     `Invited on`, then clean up.
   - The smoke goes from 9 to 10 tests; update the count in `_agents/tester.md` when the team lead
     closes the stage.

---

## 9. Sequencing

1. **Local setup** (Developer owns the stack for the build): §8.1 item 1.
2. **Spikes, recorded in `05-dev-notes.md`:**
   - **S1** (02 §4): `generateLink({ type: 'recovery' })` + `verifyOtp({ token_hash, type: 'recovery' })`
     signs in (a) a never-confirmed `createUser` account and (b) a confirmed but still invited one.
     `auth.users.invited_at` is untouched, and a deleted e-mail gets 404 with no user created.
     If (a) fails, create accounts with `email_confirm: true`. Any other failure goes back to the Architect.
   - **S2**: whether `functions serve --env-file` overrides `[edge_runtime.secrets]`. If it
     doesn't, use the config edit + restart in §8.1 item 5.
   - **S3**: the exact Studio steps for "Add user" + "Send password recovery".
   - **S4** (review-3 finding 2): try to automate a failed re-send.
     1. On an invited account with a working link L1, record `invited_at` and the
        `invite_resent` count.
     2. Set the local `profiles.email` to a value Mailpit's send API rejects (for example one with
        a space or no `@`; `sendAccountInvite` uses the address it is given).
     3. Call `resend-invite`. Expect `email_failed`.
     4. Check that L1 still redeems `ok`, and that `invited_at` and the `invite_resent` count are unchanged.
     5. Restore the e-mail.

     If it works, add it to `test-invite-redeem.mjs` as the automated AC 37/39 check.
     **Fallback:** if Mailpit accepts every value, keep the manual email-off run (§8.1 item 5), and
     the Tester records the AC 37 wording in the TSR.
3. **Database:** migration → `supabase migration up` → pgTAP file → `pnpm db:test` →
   `pnpm db:types`.
4. **Shared moves** (§4.1) → `pnpm test:functions` green with no behaviour change, before any
   invite change.
5. **account-admin:** `invite-copy` → `invite-email` → `issue-invite` → `accounts.ts` → the four
   handlers → `test-account-admin.mjs`.
6. **invite-redeem:** `redeem.ts` → `index.ts` → `config.toml` → `deploy.sh` → restart the stack
   (new `verify_jwt` setting) → `test-invite-redeem.mjs` → `package.json`.
7. **Web:**
   - constants → `account-status` → services → `invite-steps` → `invite.tsx` + route →
     `auth-confirm` → admin pages;
   - Vitest alongside each step.
8. **e2e** (clear the rate limit first), then docs.
9. **Full check:** `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test &&
   VITE_APP_ENV=production pnpm build && pnpm db:test && pnpm test:functions`, then the e2e smoke.
   Then a browser pass as admin, plus an invitee for each role, light and dark, 375 px and 1280 px.
10. **Release order** is 02 §9 (DEC-IN-8): production web first, then `deploy.sh`, then re-send
    pending invites. The Manager's stage-4 plan carries it.

---

## 10. Risks and open questions

1. **The local edge runtime serves a deleted worktree.** `supabase_edge_runtime_aj_classes` mounts
   `/Users/sjain/dev/work/aj_classes-items-4-9/supabase/functions`, which no longer exists. The DB
   container's workdir label is `aj_classes-fixes`. Until the stack is restarted from this
   worktree, local function tests run old or missing code. A restart also affects anyone testing
   from `aj_classes-hiring`: one owner, announced first.
2. **[ASSUMPTION] The email has no recipient name.** 02 §6 mentions escaping the name, but
   `invite.html` has no name, and A6 keeps the copy. So no user-typed text enters the email.
3. **[ASSUMPTION] SQL naming and the raise.** `client_ip_hash`, and `raise 'rate_limited'` rather
   than a null return. These are design-level choices inside 02's contract (same refusal, same
   limit). They don't reverse the architecture.
4. **[ASSUMPTION] AC 36 and 39 are checked end to end by hand.** Production code has no seam to
   force a send failure, and a dev-only seam would break the house rule. Spike S4 (§9) first tries
   a provider refusal through a rejected address. If that fails, the Tester runs §8.1 item 5 and
   records it in the TSR. Review-3 accepted this.
5. **A network error on the redeem POST shows `unknown`**, not `network`. supabase-js's
   `FunctionsFetchError` isn't mapped. The message is still "Something went wrong. Please try
   again." with Try again. Mapping it for every function call is a separate, wider change (Later).
6. **AC 37's "failed re-send keeps the previous link working"** is covered by the `issueInvite`
   ordering unit test plus either the S4 integration check or, failing that, the manual email-off
   run (risk 4). Review-3 accepts it, subject to the Product Owner signing off the AC 37 wording in the TSR.
7. **A re-send racing a redeem.** `invite_token_store` waits for the claim's `for share` lock. If
   the claim won, the person is signed in with the old link a moment before the new one replaces
   it. Harmless: it's the same person, and the new link is then the only one left.
8. **A re-send just as the person finishes setup.** Store returns null, and the admin sees
   `email_failed` instead of `already_joined`. The email that went out holds a dead link. A rare,
   harmless wording gap; the Staff list refreshes as `Active`.
9. **Accepted by 02, restated for the Tester:**
   - a closed tab after Continue burns the link;
   - `x-forwarded-for` can be spoofed;
   - old Auth tokens still work directly against Auth for up to 1 h after release;
   - mobile shows `Invite expired` after 1 h until D1 ships.
10. **`[TBC: hello@ajclasses.com.au still verified as a Resend sending domain for API sends – Saurabh]`**
    (01 "For Saurabh" item 2). Needed only at release; locally Mailpit is used.
11. **Staging.** Don't test invites on staging between the `develop` merge and `deploy.sh` (02 §9).
    `invite-redeem` doesn't exist hosted until then.
