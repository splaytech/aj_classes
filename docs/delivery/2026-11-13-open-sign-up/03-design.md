# 03 — Solution design: open sign-up for parents and guardians

Stage 3 of `/deliver` (Solution Designer). Branch `feature/open-sign-up` @ `0993e7f`. Date 2026-11-14.

Inputs:
- [01-requirement.md](01-requirement.md) (approved; the PO is applying the AC-12/19/20/32/39/46 corrections and R3);
- [02-architecture.md](02-architecture.md) and [ADR-0011](../../decisions/0011-open-sign-up-supabase-public-and-google.md) (approved round 3);
- [00-decisions.md](00-decisions.md);
- [review-1.md](review-1.md) Rounds 6–7 and [review-2.md](review-2.md) Round 3 (notes for this stage).

Every path is from the repo root. Line numbers were read on this branch today. The Developer re-checks each one before copying. I did **not** dry-run the migration: the brief forbids touching the local stack. The spikes in §2 are the first build tasks and stand in for that check.

**What's new, and what it costs.**
- Two migrations and nine new `public` SQL functions (§3).
- Six new routes (§7.6).
- No new edge function, npm package, vendor or secret.
- One new hosted setting set: the Google OAuth client. It is free, and Saurabh creates it (A13).
- Auth e-mail stays on Resend Free.

## 0. Reviewer notes folded in

| Note | Where |
|---|---|
| review-2 R3 n1: Google `email_verified` means "verified once". Show "Signed up with Google" and record R3 | §6.3 (confirm reply), §7.7 (dialog text), §14 R3 |
| review-2 R3 n2 = review-1 R7: AC-12 applies on the page only (R1). AC-19/20/46: resends and Forgot password are neither counted nor stopped by the cap (R2). AC-39 is Auth's 30 per 5 min per IP. AC-32 reactivate is in v1 | §7.6, §10 (no "resend busy at cap" test) |
| review-2 R3 n3: S1 also checks that `grant_type=id_token` runs the hook | §2 S1 (outcome B) |
| review-2 R3 n4: S6 covers the sign-in hash upgrade (`token.go:140`) | §2 S6 |
| review-2 R3 n5: hook and trigger functions are `security definer` with `search_path = ''` | §3.5, §3.6 |
| review-1 R6 n2: the finish-step `amr` check fails closed on unknown values, and the real values are confirmed | §3.3 `session_can_finish_sign_up`, §2 S5 |
| review-1 R7 n1: AC-20's password path can't be reached. Keep it as a server safeguard, tested at the Auth/DB boundary, not as a Tester UI case | §10 AC-20 |
| review-1 R7 n2: a Google-only promoted parent can't use mobile until they set a password | §7.7 dialog text |

**Where this differs from 02 (none is an architecture reversal):**
1. `admin_user_sign_in_methods(target)` is replaced by `admin_list_users()`, which returns the sign-up method for every row in one call (no N+1). The promotion check reads identities with the service key in `account-admin`.
2. A new `my_has_password()` serves AC-23: Change password shows only for accounts with a password. A Google user who later sets a password through Forgot password has no `email` identity, so identities can't answer this.
3. Deactivating an **unconfirmed** user also confirms its e-mail (§6.4). GoTrue's repeat `signUp` resends to an unconfirmed address and doesn't check for a ban. Confirming means a deactivated sign-up gets the quiet reply (HTTP 200, `identities: []`, nothing sent; since `[auth.sms] enable_confirmations = true`) and nothing is sent (AC-12). S4 records what GoTrue actually does.
4. The hook also refuses an e-mail sign-up whose name breaks AC-4 (AC-45), and any new account that already has `app_metadata.account_role` (AC-28, defence in depth).
5. `deploy.sh` checks after `config push` that the hosted hook is on. If it isn't, it closes sign-up again (§5).
6. 02's local Google redirect `http://127.0.0.1:54321/auth/v1/callback` should be **`:55321`**, the local API port in `config.toml`.
7. **The finish-step `amr` check is stricter than 02.** 02 asked for *at least one* listed method. This design needs *every* entry to be listed (§3.3), so `[otp, unknown]` is refused. That is safe, and the Tester's matrix in §10 AC-17 follows it (review-3 item 6).
8. **Google ships off in production** (lead Q3, review-3 item 1). `[remotes.production.auth.external.google] enabled = false`. `deploy.sh` requires the Google credentials only when that line says `true` (§4.1, §5). Switching Google on later is a one-line release change, and e-mail sign-up can go live first.

## 1. Flows (what happens, end to end)

1. **E-mail sign-up.**
   1. `/portal/sign-up` reads `sign_up_status()`. If it is `closed` or `busy`, the page shows that message and calls nothing.
   2. Otherwise the browser calls `auth.signUp({ email, password: <throwaway>, options: { captchaToken, data: { full_name } } })`.
   3. The hook allows the new account and takes a cap slot. The profile is created as `user` and `invited`.
   4. GoTrue sends the confirmation e-mail. The page shows the AC-10 message, whatever the reply.
2. **Confirm.**
   1. The e-mail link opens `/portal/auth/confirm?token_hash=…&type=email`.
   2. Nothing is used until the person clicks Continue. Then `verifyOtp({ type: 'email' })` runs.
   3. The wipe trigger clears the password and authenticators.
   4. The session's `amr` is `otp`, and the person goes to `/portal/join`.
3. **Finish.** `/portal/join` (user variant) shows:
   - name;
   - password (e-mail accounts only);
   - the Terms tick.

   Save runs `updateUser({ password })` (e-mail accounts), then `complete_sign_up`. Then the person goes to `/portal` → `/portal/user`.
4. **Google.**
   1. `Continue with Google` runs `signInWithOAuth` (PKCE) and returns to `/portal/auth/callback`.
   2. `exchangeCodeForSession(code)` runs.
   3. The person goes to `/portal`, which sends them on:
      - a new account to the finish step (no password);
      - an account made with Google to its home;
      - a refusal to message M, or the AC-53 or "closed" message.
5. **Resend and Forgot password.**
   - `/portal/sign-up/resend` calls `auth.resend({ type: 'signup' })`.
   - Forgot password is unchanged. For an unfinished sign-up, the recovery link wipes the old password (if the address wasn't yet confirmed) and the guard sends the person to `/portal/join`.
6. **Promotion.**
   1. Admin → student → `Invite or link a parent` with a finished user's e-mail returns `needsConfirmation`.
   2. The admin confirms.
   3. `admin_promote_user` runs (role `parent` and the link), then `app_metadata.account_role = 'parent'`.

## 2. Spikes S1–S7: the Developer's first tasks

Run all of these on the **local stack only**, after the migrations (§3) and `config.toml` (§4) are in place. Each one ends with a committed test. When a spike fails, take the "if not" column. Don't improvise a different design.

| # | Check | Test that stays | If not |
|---|---|---|---|
| S1 | **(a)** The `before-user-created` hook fires for e-mail `signUp`. Capture the real `event` JSON once (log it to a scratch table, then remove the logging) and record it in `05-dev-notes.md`: `user.app_metadata.provider`, `user.email`, `user.user_metadata.full_name`. **(b)** A refusal `{"error":{"http_code":429,"message":"sign_up_busy"}}` reaches supabase-js as `status 429` with `message === 'sign_up_busy'`. **(c)** A `security definer` hook owned by `postgres` and called by `supabase_auth_admin` can read `private.*`. `supabase_auth_admin` has `usage on schema public` (granted in §3.5), and `sign_up_guard_ready()` sees it. **(d)** Read `token_oidc.go` at v2.197.0: does `grant_type=id_token` (`signInWithIdToken`) for Google create its account through the same path that runs the hook (`external.go:207`)? **(e)** From GoTrue's `provider/google.go`, the shape of `email_verified` in the hook's `user_metadata` (boolean or string). **(f)** Read the Management API docs (public, no hosted call) for the auth-config field names `deploy.sh` §5 reads (`hook_before_user_created_enabled`, `hook_before_user_created_uri`, `disable_signup`). **Hosted:** Saurabh checks, read-only, that Dashboard → Authentication → Hooks offers "Before User Created" on this plan | `test-open-sign-up.mjs`: with 15 rows planted in `private.sign_up_emails`, the 16th `signUp` → 429 `sign_up_busy`, no Mailpit mail and no `auth.users` row. Switch closed → 429 `sign_up_closed`. pgTAP calls the hook directly with the captured shape (§10) | (b) different shape: map whatever arrives in `auth-errors.ts`, keyed by our message. (d) **outcome B**, the hook doesn't run for `id_token`: add the kill-switch and `email_verified` checks for `google` to `private.check_identity_link()` (§3.6), and add pgTAP for it. (f) different names: use the documented ones. Hosted plan lacks the hook: **stop**, and report to the lead and Saurabh (sign-up can't open safely) |
| S2 | Native Turnstile covers `/signup` and `/resend`. Also: does GoTrue's confirmation e-mail have a plain-text part (Mailpit `Text`)? | `test-open-sign-up.mjs`: both endpoints without `captcha_token` → refused, nothing created or sent | No text part: the template prints the full link as visible text under the button (§4.2). Raise `[TBC: AC-15 "plain-text part" is met as "link visible as text" – PO]` |
| S3 | `postgres` can create the `auth.identities` and `auth.users` `before` triggers, and delete from `auth.mfa_factors` and `auth.sessions`. Read `external.go` at v2.197.0 and confirm the **order** in the `LinkAccount` branch: `createNewIdentity` comes **before** `RemoveUnconfirmedIdentities`. If it came after, the e-mail identity would be gone and the "no identity yet" rule would let Google attach to an unconfirmed sign-up. What does `/portal/auth/callback` receive when (i) the identities trigger raises, (ii) the hook refuses, (iii) the user is banned? Record `error`, `error_code` and `error_description`, and whether they are in the query or the fragment | pgTAP: every Q3 row (§10). Web unit: callback maps the three recorded shapes. e2e: callback with the recorded trigger-refusal params shows message M | Order is the other way round: also refuse a `google` insert when the user has a stored password (`auth.users.encrypted_password is not null`). A brand-new Google account never has one, and an e-mail sign-up always does until it is confirmed. Add a pgTAP row for it and tell the lead |
| S4 | (a) A password sign-in to an unconfirmed e-mail returns `email_not_confirmed`, and the page shows `Email or password is incorrect.` (b) `signUp` and `resend` for a **banned, unconfirmed** address: does GoTrue send? | integration (a) and (b); web unit: `email_not_confirmed` → `invalidCredentials` | (b) sends nothing: §6.4's "confirm on deactivate" can stay (it is harmless) or be dropped. Lead decides; default keep |
| S5 | The `amr` arrays at v2.197.0 for: `verifyOtp(token_hash, type 'email')`; `verifyOtp(token_hash, type 'recovery')`; Google PKCE (read from `external.go`/`token.go`, since there's no local Google); password sign-in; and each of those after one refresh. Record them in `05-dev-notes.md` | integration: finish saves from the confirmation-link session and from a recovery-link session. It is refused from a password session and from a session whose `amr` holds an unknown method (pgTAP with crafted claims) | A link session shows a method not in the list: add exactly that method to `session_can_finish_sign_up()` and record it. Never add a catch-all |
| S6 | The wipe survives the rest of the request: `verify` and `recoverVerify` write only named columns after `Confirm()`, so the old hash never comes back. **Hash upgrade at sign-in (`token.go:140`):** this runs only after a password matches, and it rewrites `encrypted_password` with a fresh hash of the password just typed. Check: (1) with P1 stored at a low bcrypt cost before confirmation, after confirming P1 fails and `encrypted_password` stays null; (2) after B sets P2 (also stored at low cost by the test), a sign-in with P2 upgrades the hash, P1 still fails, and the wipe trigger doesn't fire (it is on `email_confirmed_at` only); (3) GoTrue handles a null `encrypted_password` on sign-in as "wrong password", with no 500 | integration: AC-14 cases 1, 3, 4, 5, plus (1)–(3) above. pgTAP: a factor inserted before confirmation is gone after it | Any write restores a hash: stop, report to the lead (design-level) |
| S7 | With the client's `flowType: 'pkce'`, check that these still work with `token_hash` + `verifyOtp`: reset-password links, the e-mail `signUp` confirmation, `resend`, and e-mail-change links | e2e: reset still works. Integration: sign-up confirm and resend links verify with `token_hash` | Keep the main client as it is today. Add `getOAuthClient()` in `supabase.client.ts`: `flowType: 'pkce'`, its own `storageKey` (`…-oauth`). After `exchangeCodeForSession`, copy the session into the main client with `setSession`, then `clearStoredSession`-style removal of the OAuth key. Never call `signOut` on it, because that revokes the token |

## 3. Migrations

Latest migration on every branch and worktree is `20261030100000_invite_tokens.sql`. I checked `git worktree list` (aj_classes, -hiring, -invites) and every local branch with `git ls-tree`. New files:

1. `supabase/migrations/20261114100000_user_role.sql`, in its own file because Postgres can't use a new enum value in the transaction that adds it (precedent `20261007090319_family_roles.sql`):
   ```sql
   alter type public.app_role add value if not exists 'user';
   ```
2. `supabase/migrations/20261114100100_open_sign_up.sql`, with the objects below **in this order**.

### 3.1 Role mapping and default (fact 2 closed)

- `create or replace function private.role_from_app_metadata(app_metadata jsonb) returns public.app_role`. It is `language sql immutable`, `set search_path = ''`. `account_role` values `tutor`, `student` and `parent` map to themselves. Anything else, or nothing, maps to `'user'`. That includes `admin` and `user`: admin is only ever set by `admin_set_role` or SQL.
- `alter table public.profiles alter column role set default 'user';`
- `comment on table public.profiles`: add "and signed-up users (user)".

### 3.2 Confirm existing non-user accounts (AC-42)

```sql
update auth.users u set email_confirmed_at = now()
where u.email_confirmed_at is null
  and exists (select 1 from public.profiles p where p.id = u.id and p.role <> 'user');
```

This runs before §3.6 creates the wipe trigger. The existing `on_auth_user_updated` trigger fires and only re-copies fields, which is harmless.

### 3.3 Private helpers

All are `set search_path = ''`, with execute revoked from `public, anon, authenticated`.

| Function | Body (summary) |
|---|---|
| `private.sign_up_daily_cap() returns int` immutable | `select 15`. The one constant behind AC-46 (Decision 3) |
| `private.is_valid_full_name(name text) returns boolean` immutable | `coalesce(char_length(name) between 2 and 100 and name !~ '[[:cntrl:]‪-‮⁦-⁩]', false)`. The same rule as `complete_onboarding` (`20261023110000_onboarding_consents.sql:89-93`); copy the regex exactly |
| `private.signed_up_with(target uuid) returns text` stable, security definer | `case when exists (select 1 from auth.identities i where i.user_id = target and i.provider = 'google') then 'google' else 'email' end` |
| `private.session_can_finish_sign_up() returns boolean` stable | True only when `auth.jwt() -> 'amr'` is a non-empty array and **every** entry's `method` is in (`otp`, `recovery`, `email/signup`, `magiclink`, `oauth`). A missing or unknown method, `password` or `token_refresh` gives false (fail closed, R6 n2). S5 confirms the list |
| `private.sign_up_refusal(reason text) returns jsonb` immutable | `jsonb_build_object('error', jsonb_build_object('http_code', 429, 'message', reason))` |

### 3.4 Settings (kill switch) and cap tables

```sql
create table private.sign_up_settings (
  id         boolean primary key default true check (id),  -- exactly one row
  open       boolean not null default true,                -- Decision 1: open at release
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into private.sign_up_settings default values;

create table private.sign_up_emails (       -- one row per new e-mail sign-up let through (AC-46)
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);
create index sign_up_emails_created_idx on private.sign_up_emails (created_at);

revoke all on table private.sign_up_settings, private.sign_up_emails from public, anon, authenticated;
alter table private.sign_up_settings enable row level security;   -- no policies
alter table private.sign_up_emails enable row level security;     -- no policies
```

`sign_up_emails` keeps no e-mail or user id, because the cap only needs a count (APP 3, collect the minimum).

### 3.5 The hook (Q5)

`public.hook_before_user_created(event jsonb) returns jsonb`: `language plpgsql`, `volatile`, **`security definer`, `set search_path = ''`** (R3 n5). In order:

1. `perform pg_advisory_xact_lock(hashtext('open_sign_up.new_account'));`. One global lock, so two sign-ups at once can't both take the 15th slot.
2. Closed: `coalesce((select s.open from private.sign_up_settings s), false) is not true` → `sign_up_refusal('sign_up_closed')`. A missing row counts as closed (fail closed).
3. `event -> 'user' -> 'app_metadata' ? 'account_role'` → `sign_up_refusal('sign_up_refused')`.
4. Provider `google`:
   - an empty `user ->> 'email'`, or `user -> 'user_metadata' ->> 'email_verified'` not `'true'` → `sign_up_refusal('google_email_unverified')`. S1(e) confirms the field; both a JSON `true` and `"true"` read as `'true'`.
   - otherwise allow `'{}'::jsonb`. Not counted.
5. Provider not `email` → `sign_up_refusal('sign_up_refused')` (fail closed; Apple and Facebook stay out).
6. Provider `email`:
   1. `not private.is_valid_full_name(trim(coalesce(user -> 'user_metadata' ->> 'full_name','')))` → `sign_up_refusal('invalid_name')` (AC-45).
   2. Delete `sign_up_emails` rows older than 24 hours.
   3. If `count(*) >= private.sign_up_daily_cap()` → `sign_up_refusal('sign_up_busy')`.
   4. Otherwise `insert into private.sign_up_emails default values` and return `'{}'::jsonb`.

Grants:
- `grant usage on schema public to supabase_auth_admin;` (review-3 item 3; harmless if it is already there);
- `revoke execute … from public, anon, authenticated;`
- `grant execute … to supabase_auth_admin;`

The hook doesn't fire for admin `createUser` (02 fact 5), so invites and Studio "Add user" are never capped or closed. AC-48's "by any path" means the sign-up paths (e-mail and Google).

### 3.6 Triggers (Q3, Q4)

Both functions are **`security definer`, `set search_path = ''`**, with execute revoked from everyone (trigger firing doesn't need it; the existing auth triggers are the precedent).

**Linking rule.**
- `private.check_identity_link()` returns `trigger`.
- Trigger `on_auth_identity_link_check`: `before insert on auth.identities for each row`.
- Rules:
  - `new.provider = 'email'` → `return new`.
  - `new.provider = 'google'` **and** the profile is `role 'user'`, `status 'invited'`, `is_active`, joined to `auth.users` with `email_confirmed_at is null`, **and** `not exists (select 1 from auth.identities i where i.user_id = new.user_id)` → `return new`. (`is_active` was added in the build, slice 7: a brand-new account is always active, so it refuses nothing legitimate.)
  - Otherwise `raise exception 'identity_link_refused' using errcode = '42501'`.
- (S1 outcome B adds the switch and `identity_data ->> 'email_verified'` checks for `google` here.)

**Confirm-time wipe.**
- `private.wipe_unproven_credentials()` returns `trigger`.
- Trigger `on_auth_user_email_confirmed`: `before update of email_confirmed_at on auth.users for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)`.
- If the profile is `role 'user'` and `status 'invited'`, it sets `new.encrypted_password := null` and `delete from auth.mfa_factors f where f.user_id = new.id`. Then `return new`.
- It doesn't touch invitees: they are confirmed at creation (§3.2, §6.1). If an admin-created account is confirmed by a second `UPDATE` while its profile is still `user` (the app-metadata second step, spike F30), the wipe clears a password nobody knows. That is harmless; §10 AC-42 covers it.

### 3.7 New `public` functions

Every new function starts with `revoke execute on function … from public, anon, authenticated;`, then the grant below.

| Signature | Kind | Grant | Does |
|---|---|---|---|
| `sign_up_status() returns text` | sql, stable, definer | `anon, authenticated` | `'closed'` if the switch is off (or the row is missing); `'busy'` if `sign_up_emails` rows newer than 24 h `>= cap`; else `'open'` |
| `sign_up_guard_ready() returns boolean` | sql, stable, definer | `anon, authenticated` | True only when: `role_from_app_metadata('{}')`, `('{"account_role":"x"}')` and `('{"account_role":"admin"}')` all = `'user'`; `pg_get_expr` of the `profiles.role` default is like `'''user''::%'`; `to_regprocedure('public.hook_before_user_created(jsonb)')` is not null; `has_function_privilege('supabase_auth_admin', …, 'execute')`; `has_schema_privilege('supabase_auth_admin', 'public', 'usage')`; both triggers exist and are enabled (`pg_trigger`, `tgenabled <> 'D'`); `postgres` can DELETE from `auth.mfa_factors` and `auth.sessions` and UPDATE `auth.users` (`private.can_write_auth_tables`, review-5 finding 4); and the settings row exists. Returns a boolean only |
| `my_sign_up() returns table (full_name text, email text, signed_up_with text, can_finish boolean)` | sql, stable, definer | `authenticated` | One row only for the caller when `role 'user'`, `status 'invited'`, `is_active`. `can_finish = private.session_can_finish_sign_up()` |
| `complete_sign_up(new_full_name text, accepts_terms boolean default false) returns void` | plpgsql, definer | `authenticated` | Below |
| `my_has_password() returns boolean` | sql, stable, definer | `authenticated` | Whether the caller's `auth.users.encrypted_password` is non-empty (AC-23) |
| `admin_set_sign_up_open(is_open boolean) returns void` | plpgsql, definer | `authenticated` | Not `is_admin()` → `not_admin` (42501). Null → `invalid_input`. Locks the row `for update`. No change → return. Otherwise updates `open`, `updated_at`, `updated_by = auth.uid()` and audits `sign_up_opened` / `sign_up_closed` (target null) |
| `admin_list_users() returns table (id uuid, email text, full_name text, signed_up_at timestamptz, signed_up_with text, finished boolean, is_active boolean)` | plpgsql, stable, definer | `authenticated` | Not `is_admin()` → `not_admin`. `profiles where role = 'user'`, `order by created_at desc, id`. `finished = status = 'active'` |
| `admin_promote_user(target uuid, target_student uuid) returns void` | plpgsql, definer | `authenticated` | Below |
| `hook_before_user_created(event jsonb) returns jsonb` | §3.5 | `supabase_auth_admin` | §3.5 |

**`complete_sign_up`, in order:**
1. `me := auth.uid()`. `select … from public.profiles p where p.id = me and p.role = 'user' and p.status = 'invited' and p.is_active for update`. Not found → `not_invited` (42501). The lock makes it race-safe against `replaceUnfinishedSignUp` (§6.2), the same way `cancel-invite` races `complete_onboarding`.
2. `auth.users.email_confirmed_at is null` → `not_invited` (can't normally happen; defence).
3. `not private.session_can_finish_sign_up()` → `sign_up_link_needed` (42501).
4. `via := private.signed_up_with(me)`. If `via = 'email'`:
   - `session_started := (select s.created_at from auth.sessions s where s.id = nullif(auth.jwt() ->> 'session_id','')::uuid and s.user_id = me)`;
   - if it is null, or `password_set_at` is null, or `password_set_at < session_started` → `password_not_set`.

   (`password_set_at` comes from the existing `on_auth_password_set` trigger, `20261023100000_invite_onboarding.sql:105-125`.)
5. `accepts_terms is not true` → `terms_required`. `not private.is_valid_full_name(trim(new_full_name))` → `invalid_name`.
6. `update public.profiles set full_name = trim(new_full_name), terms_accepted_at = now(), status = 'active', joined_at = now() where id = me;`
7. `delete from auth.mfa_factors where user_id = me;`
8. `delete from auth.sessions where user_id = me and id is distinct from nullif(auth.jwt() ->> 'session_id','')::uuid;`
9. Audit `account_activated`, `{ "role": "user", "via": via }`.

**`admin_promote_user`, in order:**
1. Not `is_admin()` → `not_admin` (42501).
2. Lock: `perform 1 from public.profiles p where p.id = target and p.role = 'user' and p.status = 'active' and p.is_active for update`. Not found → `not_a_signed_up_user`.
3. `select s.full_name into student_name from public.students s where s.id = target_student and s.is_active`. Not found → `not_found` (P0002).
4. `update public.profiles set role = 'parent' where id = target;`. This must come before the insert, because `student_guardians_check_account` needs `role = 'parent'`.
5. `insert into public.student_guardians (student_id, parent_id) values (target_student, target);`. A duplicate gives 23505, which can't happen for a user. A later retry takes the parent path in §6.3.
6. Audit `parent_linked`, `{ student_id, student_name, promoted_from: 'user', signed_up_with }`.
7. Nothing clears passwords, factors or sessions (02 Q8 step 4; R3).

### 3.8 Guards in existing functions (copy the current body, change one line)

| Function | Current definition (last one) | Change |
|---|---|---|
| `public.complete_onboarding(text,text,text,boolean,boolean,boolean,boolean)` | `20261023110000_onboarding_consents.sql` lines **38–138** (`create function` … `$$;`) | `create or replace`, the same body, plus `and p.role <> 'user'` in the locking `select` (line ~62) → `not_invited`. The grants stay |
| `public.my_onboarding()` | `20261023100000_invite_onboarding.sql` lines **195–210** | Add `and p.role <> 'user'`. Mobile never sees "invited, unfinished" for a user (AC-40) |
| `public.admin_set_active(uuid, boolean)` | `20261006004522_staff_accounts.sql` lines **366–407** | Select `p.role` too. Replace `if not has_joined then raise exception 'not_joined'` with `if not has_joined and current_role_value <> 'user' then …`. Users can be deactivated finished or not (AC-31/32) |

### 3.9 Audit actions

Copy the list from `20261023110000_onboarding_consents.sql` lines **20–27** and add `'sign_up_opened', 'sign_up_closed'`. Promotion reuses `parent_linked`, and finishing reuses `account_activated`.

### 3.10 Grants summary (for the AC-26 sweep)

| Object | anon | authenticated | supabase_auth_admin | service_role |
|---|---|---|---|---|
| `sign_up_status`, `sign_up_guard_ready` | ✓ | ✓ | – | default |
| `my_sign_up`, `complete_sign_up`, `my_has_password`, `admin_set_sign_up_open`, `admin_list_users`, `admin_promote_user` | – | ✓ | – | default |
| `hook_before_user_created` | – | – | ✓ | – (revoked explicitly: the default privileges grant it otherwise, review-5 finding 7) |
| `private.*` (new), both trigger functions | – | – | – | – |
| `private.sign_up_settings`, `private.sign_up_emails` | – | – | – | – (RLS on, no policies) |

## 4. `supabase/config.toml` and templates

### 4.1 `config.toml`

| Section | Today | Change |
|---|---|---|
| `[auth] enable_signup` | `false` (line 174) | `true`. Comment: "Open sign-up (ADR-0011). Safe only with the migrations: deploy.sh pushes this last" |
| `[auth] additional_redirect_urls` (local) | origins only (line 160) | add `"http://localhost:5173/portal/auth/callback"`, `"http://127.0.0.1:5173/portal/auth/callback"` |
| `[auth.email] enable_confirmations` | `false` (line 227) | `true` |
| `[auth.email.template.confirmation]` | none | `subject = "Confirm your e-mail for AJ Classes"`, `content_path = "./supabase/templates/confirmation.html"` |
| `[auth.hook.before_user_created]` | commented example (lines 300–303) | `enabled = true`, `uri = "pg-functions://postgres/public/hook_before_user_created"` |
| `[auth.external.google]` | none | `enabled = false` locally, `client_id = ""`, `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`, `skip_nonce_check = false` (the same pattern as `[auth.external.apple]`) |
| `[remotes.production.auth] additional_redirect_urls` | the two `/portal/auth/confirm` URLs | add `https://ajclasses.com.au/portal/auth/callback`, `https://staging.ajclasses.com.au/portal/auth/callback` |
| `[remotes.production.auth.external.google]` | none | **`enabled = false`** for the first release (lead Q3), `client_id = "env(GOOGLE_CLIENT_ID)"`, `secret = "env(GOOGLE_CLIENT_SECRET)"`. Turning Google on is a one-line change to `true` in a later release, after Saurabh creates the client. While it is off, `/auth/v1/settings` reports Google off, so the button stays hidden (AC-51) and the hook's `google` branch is never reached |
| `[auth.email] otp_length` | 6 | **8** (fix batch 2, security 06 finding 5 / review-6b): e-mailed codes (re-authentication before a password change) are 8 digits, with their own `AUTH_LIMITS.emailCodeLength`; authenticator (TOTP) codes stay 6. `otp_expiry` stays 3600 |
| `[auth.sms] enable_confirmations` | `false` | **`true`** (fix batch 2, security 06 finding 10). SMS sign-up stays off and no SMS provider exists; this makes `signUp` give an existing confirmed e-mail the quiet 200 (§8.1) |
| `[auth] enable_manual_linking`, `[auth.external.apple]`, `[auth.rate_limit]` | – | **unchanged** (`false`; off; `sign_in_sign_ups = 30`, `email_sent = 30`) |

After editing, the Developer restarts the local stack so Auth reads it. The lead owns that state change (§13).

### 4.2 Templates

- **New `supabase/templates/confirmation.html`.** Copy `recovery.html`'s frame and colours. Header badge: none (not "Staff").
  - Heading: `Confirm your e-mail`.
  - Text: `Someone, hopefully you, asked to create an AJ Classes account with this e-mail. Click the button to confirm it and finish signing up.`
  - Button: `Confirm my e-mail` → `{{ .SiteURL }}/portal/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
  - Then: `This link expires in 1 hour and works once.`
  - If S2 finds no text part: `If the button doesn't work, copy this link into your browser:` followed by the same URL as plain text.
  - Then: `If you didn't sign up, you can ignore this e-mail. Nothing happens unless the link is used.`
- **`recovery.html`**: change `this AJ Classes staff account` to `your AJ Classes account` and drop the `Staff` badge. Families and users already get this e-mail, so "staff" is untrue.
- **`invite.html`** (unused since ADR-0010): its condition becomes `eq . "parent"` (02 Q1).

## 5. `supabase/scripts/deploy.sh`

New order (02 Q1). The step labels change from `n/6` to `n/7`.

| Step | Script line today | New |
|---|---|---|
| Checks | 119–130 | `google_enabled()` reads `config.toml` and is true only when the `[remotes.production.auth.external.google]` table has `enabled = true` (a small `awk` over that one table). **Only then** run `require GOOGLE_CLIENT_ID "Google Cloud → APIs & Services → Credentials → your Web client"` and `require GOOGLE_CLIENT_SECRET "…same client"`. They are exported for `config push` (`env()`). With Google off they aren't needed and aren't read. Allow overriding the env file path: `ENV_FILE="${DEPLOY_ENV_FILE:-$(dirname "$0")/../.env.deploy}"`, so the test never reads real secrets |
| 1/7 link | 132–133 | unchanged |
| 2/7 **gate** | (new) | `signups_are_off \|\| sign_up_guard_ready`, else fail: "Sign-ups are on but the sign-up guard isn't installed. Turn sign-ups off (Dashboard → …) and run again. Nothing was changed." `sign_up_guard_ready()` = `curl -fsS --max-time 20 -X POST "${PROJECT_URL}/rest/v1/rpc/sign_up_guard_ready" -H "apikey: ${PUBLISHABLE_KEY}" -H 'Content-Type: application/json' -d '{}' \| grep -qx 'true'`. Before the migration it 404s, so the gate falls back to today's check. The gate records `SIGNUPS_WERE_ON=true` when it passed through `sign_up_guard_ready` with sign-up on, which step 4/7 needs |
| 3/7 `db push` | 146–147 | moved up |
| 4/7 **check** | (new) | `sign_up_guard_ready`, **retried up to 5 times, 3 s apart** (PostgREST reloads its schema cache after `db push`; review-3 2c). If it still fails: when the gate in 2/7 passed with sign-up **on** (a re-deploy), call `close_sign_up` (below) before failing (review-3 2a). Then fail with "The migrations ran but the sign-up guard isn't ready. Sign-up is off. Nothing else was changed." |
| 5/7 functions | 149–152 | unchanged |
| 6/7 secrets | 154–181 | unchanged. **No new function secret** (the kill switch is in the database) |
| 7/7 `config push` | 135–136 | moved to the end. Label: "Sign-in settings (sign-up open, hook, confirmations; Google only if enabled)". A failed `config push` runs `close_sign_up` and fails loudly (it may have opened sign-up part-way). Then **post-check** `auth_settings_are_safe`: `curl -fsS -H @"$AUTH_HEADER_FILE" "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \| jq -e '… hook_before_user_created_enabled == true and .hook_before_user_created_uri == "pg-functions://postgres/public/hook_before_user_created" and .mailer_autoconfirm == false and .disable_signup == false'` (S1(f) confirms the names; the last two from review-5 finding 5). On failure: `close_sign_up`, then fail with "The sign-up hook isn't on, or e-mail confirmations are off, so sign-up was closed again. …". In dry run, print what it would check |
| Helpers | (new) | **`AUTH_HEADER_FILE`** (review-3 2d): `umask 077; AUTH_HEADER_FILE="$(mktemp)"; printf 'Authorization: Bearer %s\n' "$SUPABASE_ACCESS_TOKEN" > "$AUTH_HEADER_FILE"; trap 'rm -f "$AUTH_HEADER_FILE"' EXIT`. Each Management API call uses `curl -H @"$AUTH_HEADER_FILE"`, so the token never appears in `ps`. Not created in dry run. **`close_sign_up`** (review-3 2a, 2b): `curl -fsS -X PATCH -H @"$AUTH_HEADER_FILE" -H 'Content-Type: application/json' -d '{"disable_signup":true}' "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth"`. It runs inside `if ! …; then`, so `set -e` can't end the script silently. If the PATCH fails: `fail "Sign-up may be open without the hook: turn it off in Dashboard → Authentication → Sign In / Providers → 'Allow new users to sign up' now."` |
| Old step 3 | 138–144 | removed (replaced by 2/7) |
| Header comment | 5–6 | "Order matters: migrations first, checked by behaviour; the Auth settings that open sign-up last (ADR-0011)" |
| `NEXT` text | 183–192 | "Dashboard → Authentication → Users: invited people and signed-up users (role `user`)"; "Close sign-up: Portal → Admin → Users" |

**New test `supabase/scripts/test-deploy-order.mjs`** (Node, no network, no local stack):
1. Make a temp dir with fake `supabase` and `curl` scripts that append their arguments to a log file and `exit 1`.
2. Run `bash supabase/scripts/deploy.sh --dry-run` with `PATH=<fakes>:$PATH`, `DEPLOY_ENV_FILE=/dev/null`, and obviously fake values for every required variable (`NOTIFY_WORKER_SECRET=dry-run-not-a-secret`, …).
3. Assert:
   - exit 0;
   - the step headings appear in the order gate → `db push` → guard check → functions → secrets → `config push` → hook post-check;
   - `config push` is the last `supabase` command printed;
   - the fake log is empty, so nothing real ran;
   - the token never appears in the printed commands.
4. **Failure cases** (review-3 item 2). These run the real script **without** `--dry-run` against fakes only. The fake `supabase` succeeds; the fake `curl` answers from a scripted table and logs its arguments; nothing leaves the machine. Assert:
   - **step-4 close:** the gate sees sign-up on and the guard ready, `db push` passes, then the guard check keeps failing → five retries, one `PATCH {"disable_signup":true}`, non-zero exit, and `config push` never runs;
   - **PATCH fails:** the hook post-check fails and the `PATCH` returns an error → non-zero exit with the "Sign-up may be open without the hook…" message;
   - **header file:** the `curl` log shows `-H @<file>` and never the token, and the file is gone after exit;
   - **Google gate:** with Google `enabled = false` in a copy of `config.toml`, the run needs no `GOOGLE_*`. With `true` and no `GOOGLE_*`, it stops at "Checking what's needed".

   The test points the script at its `config.toml` copy through a `DEPLOY_CONFIG` override, default `$(dirname "$0")/../config.toml`. `google_enabled()` reads that file only.

It is added to the root `test` script so CI runs it.

## 6. Edge function `account-admin`

No new action and no new function. `invite-redeem`, `leads` and `notifications` are unchanged.

### 6.1 `handlers/accounts.ts`

- `createInvitedAccount`: pass `email_confirm: true`, and always pass `app_metadata: { account_role: role }`, including `'tutor'` (02 Q2). Update the header comment ("Staff join as tutors, with no account_role" is no longer true).
- **New `replaceUnfinishedSignUp(account: AccountRecord): Promise<'replaced' | 'not_unfinished' | 'server_error'>`.** It uses the same race-safe pattern as `cancel-invite.ts`:
  1. If `role !== 'user' || status !== 'invited' || !is_active`, return `not_unfinished`.
  2. `update profiles set is_active = false where id and role = 'user' and status = 'invited' and is_active`. No row → `not_unfinished`.
  3. `auth.admin.deleteUser`. On error, restore `is_active = true` and return `server_error`.

  `complete_sign_up` locks the same row and needs `is_active`, so exactly one of the two wins.
- **New `syncAccountRole(userId, role: 'parent'): Promise<boolean>`.** `auth.admin.getUserById`. If `app_metadata.account_role !== role`, call `updateUserById(userId, { app_metadata: { ...current, account_role: role } })`. Returns success.
- **New `signUpFacts(userId): Promise<{ signedUpWith: 'email' | 'google'; signedUpAt: string }>`.** `getUserById` → `identities` includes `google` ? `'google'` : `'email'`, plus `created_at`.

### 6.2 Invites with a signed-up e-mail

| Handler | Existing account is… | Result |
|---|---|---|
| `invite.ts` (staff) | unfinished active user | `replaceUnfinishedSignUp`, then today's flow. The audit `invite_sent` details gain `replaced_sign_up: true` |
| | finished user, or deactivated user | `already_exists` (AC-37, AC-36) |
| `invite-student.ts` | unfinished active user | replace, then today's flow (AC-34, AC-36) |
| | finished active user | **`already_exists_user`** (AC-34 message plus hint) |
| | deactivated user | `already_exists` (AC-36) |
| `invite-parent.ts` | unfinished active user | replace, then today's new-parent flow |
| | finished active user | promotion (§6.3) |
| | deactivated user | `already_exists` |
| `resend-invite.ts`, `cancel-invite.ts` | `role === 'user'` | `not_allowed` (users have no invite; no delete in v1, A7) |

`invite.ts` swaps its own `profiles` lookup (lines 26–31) for `findAccountByEmail`, so all three handlers decide the same way.

### 6.3 Promotion contract (`invite-parent`)

Request:

```json
{ "action": "invite-parent", "studentId": "<uuid>", "email": "a@b.c", "fullName": "", "confirmUserId": "<uuid, optional>" }
```

- **Existing `parent`:** first `syncAccountRole(existing.id, 'parent')`, which heals a promotion whose second step failed. If it fails → `server_error`. Then link as today (`linked: true` or `already_linked`).
- **Finished active `user`, no `confirmUserId`:** `succeed({ needsConfirmation: true, userId, fullName, signedUpAt, signedUpWith })`. Nothing is changed and nothing is sent.
- **Finished active `user`, `confirmUserId === existing.id`:**
  1. `caller.client.rpc('admin_promote_user', { target, target_student })`, under the admin's own aal2 session;
  2. then `syncAccountRole(…, 'parent')`. If that fails → `role_sync_failed` (the database step stays; a retry heals it through the parent path above);
  3. then `succeed({ userId, linked: true, promoted: true })`.

  No e-mail is sent.
- **`confirmUserId` given, but the e-mail now belongs to a different account, or is no longer a finished active user:** `promotion_changed`.
- **Database refusals:** `not_a_signed_up_user` → `promotion_changed`; `not_found` → `not_found`.

### 6.4 `handlers/set-active.ts`

- Deactivate:
  1. `recordActive` (now allowed for users finished or not, §3.8);
  2. then `setBan(userId, BAN_FOREVER, { confirmEmail })`. `confirmEmail` is true when the target's profile is `role 'user'` and `auth.users.email_confirmed_at` is null (from `getUserById`). It passes `email_confirm: true` with the ban in the same `updateUserById`.
  3. Why: an unconfirmed deactivated sign-up then gets GoTrue's quiet reply (200, `identities: []`), and nothing is sent (AC-12).
  4. The wipe trigger clears its password, which is harmless.
  5. After a reactivate, the owner finishes through Forgot password (AC-20), the same as any confirmed, unfinished account.
- Reactivate: unchanged (unban, then `admin_set_active(true)`), writing `reactivated` (AC-32).
- Add `not_joined` handling: it is no longer raised for users. The refusal list stays.

## 7. Web (`apps/web/src`)

Rules kept everywhere: components and pages never call `fetch` or Supabase (services only); every word lives in `constants/*`; MUI only on staff/admin pages; CSS Modules elsewhere; `color="textSecondary"`.

### 7.1 Constants

**`constants/app.constants.ts`**
- `export const USER_ROLE = 'user' as const;`
- `export type UserRole = typeof USER_ROLE;`
- `export type AppRole = StaffRole | FamilyRole | UserRole;`
- `SIGN_UP_STATUSES = ['open','busy','closed'] as const` and its type.
- `AUTH_LIMITS.linkExpiryHours` stays the one source for "1 hour".

**`constants/routes.constants.ts`**
- `ROUTES.terms = '/terms'`.
- `PORTAL_ROUTES += { signUp: '/portal/sign-up', signUpResend: '/portal/sign-up/resend', authCallback: '/portal/auth/callback', user: '/portal/user', adminUsers: '/portal/admin/users' }`.
- `LEGAL_LINKS.terms = ROUTES.terms`, typed `string`. Update its comment.
- `PORTAL_QUERY += { oauthCode: 'code', oauthError: 'error', oauthErrorCode: 'error_code', oauthErrorDescription: 'error_description' }`.
- `SIGN_IN_REASONS.finishSignUp = 'finish-sign-up'`.

**`constants/portal.constants.ts`**
- `PORTAL_SEO += signUp: 'Create an account', signUpResend: 'Send the link again', authCallback: 'Signing in', user: 'Latest news', adminUsers: 'Users'`.
- `ROLE_LABELS.user = 'User'`; `PORTAL_COMMON.areaBadge.user = 'User'`; `PORTAL_COMMON.nav.userHome = 'Latest news'`.
- `LOGIN_PAGE += signUpPrompt: 'New to AJ Classes? ', signUpLink: 'Create an account', or: 'or'`.
- `AUTH_CONFIRM_PAGE.heading.email = 'Confirm your e-mail'`, `.intro.email = 'Continue to finish creating your account.'`, `sendAgain: 'Send the link again'`.
- `ADMIN_DASHBOARD.shortcuts.users = 'Users'`.
- `ACTIVITY_LABELS += sign_up_opened: 'Opened sign-up', sign_up_closed: 'Closed sign-up'`.
- `PARENT_INVITE_DIALOG.promote` (§7.7).
- `USERS_PAGE` (§7.8).

**New `constants/sign-up.constants.ts`** (exported from `constants/index.ts`). The wording is shown so the Developer copies it.

```ts
export const SIGN_UP_HOURS = AUTH_LIMITS.linkExpiryHours;          // Supabase otp_expiry 3600
const hours = (n: number) => `${n} hour${n === 1 ? '' : 's'}`;
export const FINISH_SIGN_UP_HINT = {                                 // AC-19 and AC-20: one wording
  before: 'To finish signing up, use the link we e-mailed you, or ',
  link: 'Forgot password',
  after: '.',
};
export const SIGN_UP_PAGE = {
  heading: 'Create an account',
  intro: 'For parents and guardians. Students get their accounts from AJ Classes.',
  labels: { fullName: 'Full name', email: 'Email' },
  submit: 'Create account', submitting: 'Creating…',
  notice: { before: 'We use your name and e-mail to run your account. See our ', link: 'Privacy Policy', after: '.' },
  or: 'or', google: 'Continue with Google',
  haveAccount: 'Already have an account? ', signIn: 'Sign in',
  sent: {
    heading: 'Check your e-mail',
    text: `We've sent a link to confirm your address. It expires in ${hours(SIGN_UP_HOURS)}.`,
    help: { before: 'Already have an account? ', signIn: 'Sign in', between: ' or ', reset: 'reset your password', after: '.' },
    sendAgain: 'Send the link again',
  },
  busy: 'Sign-up is busy right now. Please try again tomorrow.',
  closed: { heading: 'Sign-up is closed', text: 'New accounts are closed at the moment. If you already have an account, please sign in.' },
} as const;
export const SIGN_UP_RESEND_PAGE = {
  heading: 'Send the link again', intro: 'Enter the e-mail you signed up with.',
  submit: 'Send link', submitting: 'Sending…',
} as const;   // the reply reuses SIGN_UP_PAGE.sent plus FINISH_SIGN_UP_HINT
export const FINISH_SIGN_UP = {
  heading: 'Finish creating your account',
  intro: (email: string) => `You're signing up as ${email}.`,
  labels: { fullName: 'Full name', password: 'Create password', confirm: 'Confirm password', code: 'Code from the email' },
  hints: { password: JOIN_PAGE.hints.password },
  terms: { before: "I'm a parent or guardian, and I agree to the ", termsLink: 'Terms & Conditions', between: ' and ', privacyLink: 'Privacy Policy', after: '.' },
  submit: 'Finish', submitting: 'Finishing…', signOut: 'Not you? Sign out',
} as const;
export const AUTH_CALLBACK_PAGE = { checking: 'Signing you in…', backToSignIn: 'Back to sign in' } as const;
```

**`constants/error.constants.ts`, `PORTAL_ERRORS` additions:**

| Key | Text |
|---|---|
| `signUpBusy` | `SIGN_UP_PAGE.busy` |
| `signUpClosed` | `New accounts are closed at the moment. If you already have an account, please sign in.` |
| `googleAccountExists` (message M) | `This e-mail already has an AJ Classes account. Sign in with your e-mail and password, use Forgot password, or use the link we e-mailed you.` |
| `googleEmailUnverified` | `We couldn't get a verified e-mail address from Google. Please sign up with your e-mail instead.` |
| `finishSignUp` (AC-20, login notice) | `To finish signing up, use the link we e-mailed you, or Forgot password.` |
| `signUpLinkNeeded` | same text as `finishSignUp` |
| `alreadyExistsUser` | `This e-mail already has an account. Signed-up accounts are for parents and guardians. Use a different e-mail for the student's account.` |
| `promotionChanged` | `This e-mail's account changed while you were deciding. Please try again.` |
| `roleSyncFailed` | `They're linked as a parent, but their sign-in details didn't update. Please press Invite or link again.` |

**`constants/content.constants.ts`**: the `PRIVACY` edits (§7.9) and the new `TERMS` (§7.9). **`constants/seo.constants.ts`**: `SEO.terms = { title: 'Terms & Conditions | AJ Classes', description: 'The terms for using an AJ Classes portal account.' }`. Unit tests already enforce 60/160.

### 7.2 Services (the only Supabase or `fetch` callers)

| File | Function | Calls |
|---|---|---|
| **new `services/sign-up.service.ts`** | `getSignUpOptions(): Promise<{ status: SignUpStatus; google: boolean }>` | `rpc('sign_up_status')` and `fetch(\`${APP_CONFIG.supabase.url}/auth/v1/settings\`, { headers: { apikey } })` → `external.google === true`. Any failure gives `{ status: 'closed', google: false }`: hidden, never broken (AC-51) |
| | `signUpWithEmail(fullName, email, captchaToken): Promise<Result>` | `auth.signUp({ email: email.trim().toLowerCase(), password: throwawayPassword(), options: { captchaToken, data: { full_name: fullName.trim() } } })`. `throwawayPassword()` is 32 bytes from `crypto.getRandomValues`, base64url, not exported, never stored or returned. **Neutral reply:** `over_email_send_rate_limit` → `succeed()` (AC-12 on the page) |
| | `resendSignUpLink(email, captchaToken): Promise<Result>` | `auth.resend({ type: 'signup', email, options: { captchaToken } })`. Only `captchaFailed`, `tooManyAttempts` (from `over_request_rate_limit` only) and `network` fail. Everything else → `succeed()` (AC-19) |
| | `confirmSignUpLink(tokenHash): Promise<Result>` | `verifyOtp({ token_hash, type: 'email' })` |
| | `startGoogleSignIn(): Promise<Result>` | `auth.signInWithOAuth({ provider: 'google', options: { redirectTo: \`${window.location.origin}${PORTAL_ROUTES.authCallback}\` } })` |
| | `finishGoogleSignIn(code): Promise<Result>` | `auth.exchangeCodeForSession(code)` |
| | `completeSignUp(input: { fullName; password: string \| null; acceptsTerms }, emailedCode?)` | e-mail accounts: `changePassword(password, code)` first; `samePassword` → return the error (ask for a different password; see §7.6 join). Then `rpc('complete_sign_up', { new_full_name, accepts_terms })` |
| | `hasPassword(): Promise<Result<boolean>>` | `rpc('my_has_password')` |
| **new `services/users.service.ts`** | `listUsers()` | `getAdminClient()` → `rpc('admin_list_users')` → `SignedUpUser[]` |
| | `setSignUpOpen(isOpen)` | `getAdminClient()` → `rpc('admin_set_sign_up_open', { is_open })` |
| | (deactivate and reactivate reuse `staff.service.setAccountActive`) | |
| `services/auth.service.ts` | `readAccessState` | if `profile` and `onboarding` are both null → `readSignUp()` (`rpc('my_sign_up')`) → `signUp: SignUpInfo \| null`. Add `signUp: null` to `SIGNED_OUT` |
| `services/families.service.ts` | `inviteParent(studentId, email, fullName, confirmUserId?)` | returns `ParentInviteOutcome = { kind: 'invited' \| 'linked' \| 'promoted'; userId } \| { kind: 'needsConfirmation'; userId; fullName; signedUpAt; signedUpWith }` |
| `services/types.ts` | `AccessState.signUp`, `SignUpInfo = { fullName; email; signedUpWith: 'email' \| 'google'; canFinish: boolean }`, `SignedUpUser`, `ParentInviteOutcome`, `EmailLinkType = 'invite' \| 'recovery' \| 'email'`, new `ErrorKey`s | |
| `services/auth-errors.ts` | `ERROR_KEYS_BY_CODE.email_not_confirmed = 'invalidCredentials'` (S4) | own keys: `sign_up_busy → signUpBusy`, `sign_up_closed → signUpClosed`, `google_email_unverified → googleEmailUnverified`, `sign_up_refused → signUpClosed`, `identity_link_refused → googleAccountExists`, `invalid_name → invalidName` (exists), `sign_up_link_needed → signUpLinkNeeded`, `already_exists_user → alreadyExistsUser`, `promotion_changed → promotionChanged`, `role_sync_failed → roleSyncFailed`, `not_a_signed_up_user → promotionChanged` |
| `services/supabase.client.ts` | `flowType: 'pkce'` (S7; fallback in §2) | `detectSessionInUrl: false` stays |
| `services/database.types.ts` | regenerated with `pnpm db:types` | |

### 7.3 Access rules (`lib/portal-access.ts`, `lib/portal-guard.ts`)

- `PortalArea += 'user'`. `PAGE_AREAS.member` gains `'user'`, and `PAGE_AREAS.user = ['user']`. `HOME_BY_ROLE.user = PORTAL_ROUTES.user`. `isStaffRole` is unchanged. Add `isFamilyRole(role)`.
- New step **2b**, right after the `onboarding` step:

  ```ts
  if (state.signUp) {
    if (!state.signUp.canFinish) return { kind: 'signOut', to: loginWith(SIGN_IN_REASONS.finishSignUp), revoke: true };
    return area === 'join' ? ALLOW : { kind: 'redirect', to: PORTAL_ROUTES.join };
  }
  ```

  `AccessDecision`'s `signOut` gains `revoke?: boolean`. `guardPortalPage` calls `signOut()` (which revokes on the server) when `revoke` is set, and `forgetDeactivatedSession()` otherwise (deactivated, as today).
- A user opening any staff, admin, student or parent URL gets the existing `forbidden` view (step 9). Nothing new is needed (AC-25).
- `services/staff-client.ts` and `family-client.ts` already return null for `user`, so no request is sent.

### 7.4 Components

| Component | Responsibility |
|---|---|
| **new `components/posts/PublicPostsList.tsx`** (+ `PublicPostsList.module.css`, moved from `routes/posts.module.css`) | `PostList`, `NoPosts` and `PostsContent` lifted out of `routes/posts.tsx` unchanged (they still use `usePublicPosts`). `/posts` and the user home both render it (AC-21) |
| **new `components/portal/GoogleButton.tsx`** | One button. `onClick` → `startGoogleSignIn()` through a prop (the page passes the service). Shows an `FormAlert` on failure |
| **new `components/portal/FinishSignUpForm.tsx`** | Name; password and confirm (only if `signedUpWith === 'email'`, `autocomplete="new-password"`, show/hide through the existing `PasswordInput`); the Terms checkbox with links (`LEGAL_LINKS`, new tab); the emailed-code step on `reauthNeeded` (copied from `join.tsx` lines 120–127); Sign out. Validation in **new `lib/sign-up-validation.ts`** (`checkFullName` with `PROFILE_LIMITS`, `checkNewPassword`, `checkPasswordsMatch`, terms) |
| **new `components/portal/FinishSignUpHint.tsx`** | Renders `FINISH_SIGN_UP_HINT`, with `Forgot password` linked to `PORTAL_ROUTES.forgotPassword`. Used by the resend reply and the login notice |
| `components/portal/PortalLayout.tsx` | `NAV_BY_ROLE.user = [{ to: PORTAL_ROUTES.user, label: nav.userHome }, ACCOUNT_LINK]` (AC-22) |
| `components/portal/ParentInviteDialog.tsx` | On `needsConfirmation`, the form is replaced by the promotion text (§7.7), with Cancel and `Link as parent`. That button calls `onInvite(email, name, userId)` |

### 7.5 ErrorBoundary

- Every new portal route sits under `routes/portal/portal-root.tsx`, whose `ErrorBoundary` already covers it (AC-11). New portal routes export none of their own.
- `/terms` exports its own `ErrorBoundary`, copied from `routes/careers.tsx:59-69`, with `TERMS.errorBoundary` text (AC-50).

### 7.6 Routes and pages (`routes.ts`)

| Route | File | Guard area | What it does |
|---|---|---|---|
| `/terms` | **new `routes/terms.tsx`** | – (public, pre-rendered) | §7.9 |
| `/portal/sign-up` | **new `routes/portal/sign-up.tsx`** | `signedOutOnly` | The loader returns `getSignUpOptions()`. `closed` → card `SIGN_UP_PAGE.closed` with a Sign in link. Otherwise the form: name, e-mail, `TurnstileField`, submit, the notice line, `or`, and the `GoogleButton` (only if `google`). Submit: client checks (AC-4, AC-5) → no token → captcha message (AC-8) → if `status === 'busy'`, show `busy` without calling (AC-46) → `signUpWithEmail`. `ok` → the "sent" card (AC-10), the same for every e-mail. `signUpBusy` → busy. `signUpClosed` → closed. `captchaFailed` / `tooManyAttempts` / `network` / `unknown` → that message. Reset the widget after any failure. `invalidName` → field error. `noindex` through `buildPortalMeta` |
| `/portal/sign-up/resend` | **new `routes/portal/sign-up-resend.tsx`** | `signedOutOnly` | E-mail plus Turnstile → `resendSignUpLink`. `ok` → `SIGN_UP_PAGE.sent` plus `FinishSignUpHint` for everyone (AC-19). Not gated by `busy` (R2) |
| `/portal/auth/callback` | **new `routes/portal/auth-callback.tsx`** | none (like `auth-confirm`) | On mount: read `code` or `error*` from the query and the fragment, then `window.history.replaceState(null, '', PORTAL_ROUTES.authCallback)`. `code` → `finishGoogleSignIn` → `navigate(PORTAL_ROUTES.root, { replace: true })`. Errors, mapped by S3's recorded shapes: `google_email_unverified` → that message (AC-53); `sign_up_closed` / `sign_up_refused` → `signUpClosed` (AC-48); banned → `notActive` (AC-32); **anything else, including `identity_link_refused`** → message M (AC-54). A `Back to sign in` link. A late result after unmount is dropped |
| `/portal/user` | **new `routes/portal/user-home.tsx`** inside **new `routes/portal/user-layout.tsx`** (copy of `parent-layout.tsx`, area `'user'`) | `user` | `<h1>{POSTS_PUBLIC_PAGE.heading}</h1>`, the intro, `<PublicPostsList />` (AC-21) |
| `/portal/admin/users` | **new `routes/portal/admin-users.tsx`** inside `admin-layout` | `admin` | §7.8 |
| `/portal/login` | `routes/portal/login.tsx` | unchanged | The loader also returns `getSignUpOptions()`. Below the form: `New to AJ Classes? Create an account` when `status !== 'closed'` (AC-1, AC-48), and the `GoogleButton` when `google` (AC-51). `noticeFor` gains `finishSignUp` → status text with `FinishSignUpHint` (AC-20) |
| `/portal/auth/confirm` | `routes/portal/auth-confirm.tsx` | unchanged | `readLinkType` accepts `'email'`. Continue → `confirmSignUpLink` → wipe the URL → `navigate(PORTAL_ROUTES.join)`. Error: one message, `PORTAL_ERRORS.linkExpired` (AC-18), plus a link `Send the link again` → `signUpResend` |
| `/portal/join` | `routes/portal/join.tsx` | `join` | The loader returns `{ onboarding, signUp }`. `signUp` → `<AuthCard heading={FINISH_SIGN_UP.heading} intro={FINISH_SIGN_UP.intro(signUp.email)}><FinishSignUpForm …/></AuthCard>`. On success → `PORTAL_ROUTES.root`. `samePassword` → its message (ask for a different password). Invite onboarding is unchanged |
| `/portal/account` | `routes/portal/account.tsx` | unchanged | The loader skips `getMyConsents`/`getMyNotificationSettings` for `user` and adds `hasPassword()`. Render: `ChangePasswordSection` only if `hasPassword`; Notifications only `isFamilyRole(role)` (was `!isStaffRole`); Your choices and Two-step unchanged (parent only; staff only) → AC-23 |
| `/portal/admin` | `routes/portal/admin-dashboard.tsx` | unchanged | A `Users` shortcut card → `adminUsers`. Counts are unchanged: they come from `admin_list_staff` and students only (AC-30) |
| `/portal/admin/students/:id` | `routes/portal/admin-student.tsx` | unchanged | Wire the new `ParentInviteDialog` outcome; the student invite shows `alreadyExistsUser` as is |

`routes.ts`:
- add `route(ROUTES.terms, 'routes/terms.tsx')`;
- inside `portal-root`: `signUp`, `signUpResend`, `authCallback` (beside `authConfirm`);
- inside `member-layout`: `layout('routes/portal/user-layout.tsx', [route(PORTAL_ROUTES.user, 'routes/portal/user-home.tsx')])`;
- inside `admin-layout`: `route(PORTAL_ROUTES.adminUsers, 'routes/portal/admin-users.tsx')`.

`react-router.config.ts`: add `ROUTES.terms` to `prerender`. `routes/sitemap.ts`: add `ROUTES.terms` to `ALWAYS_LISTED` after `ROUTES.privacy`.

### 7.7 Promotion dialog text (AC-33, R3, Round 7 n2)

```ts
PARENT_INVITE_DIALOG.promote = {
  heading: 'Link a signed-up user?',
  text: (child: string) => `This e-mail belongs to a signed-up user. They'll become a parent of ${child}.`,
  signedUp: (method: string, date: string) => `Signed up with ${method} on ${date}.`,   // method: 'e-mail' | 'Google'
  googleMobile: "They signed up with Google, so they can't use the mobile app until they set a password with Forgot password on the website.",
  confirm: 'Link as parent',
  done: (child: string) => `Linked as a parent of ${child}. No e-mail was sent.`,
};
```

`googleMobile` shows only when `signedUpWith === 'google'`. That line is also where R3 is visible to the admin: the "Google" in `signedUp` says the account rests on Google's own verification.

### 7.8 Admin → Users page (AC-31, 32, 48)

MUI, laid out like `admin-staff.tsx`. The loader calls `listUsers()` and `getSignUpOptions()`.

1. **Sign-up card.**
   - It shows `USERS_PAGE.switch.open` (`Sign-up is open`) or `.closed` (`Sign-up is closed`). Busy counts as open here, because the cap display is deferred (D10).
   - One button, `Close sign-up` or `Open sign-up`, opens `ConfirmDialog`:
     - close: `Close sign-up?` / `New people won't be able to create an account, by e-mail or with Google. Everyone who already has an account can still sign in.`
     - open: `Open sign-up?` / `Parents and guardians will be able to create an account again.`
   - Then `setSignUpOpen` and a status message (`Sign-up closed.` / `Sign-up opened.`).
2. **Table** (newest first):
   - `Name` and `E-mail`;
   - `Signed up` = `` `Signed up ${formatDate(signedUpAt)}` ``;
   - `How` = `E-mail` / `Google`;
   - `Finished` = `Finished` / `Not finished`;
   - `Status` = `Active` / `Deactivated` (the existing status chip style);
   - action `Deactivate` / `Reactivate`, through `ConfirmDialog` → `setAccountActive`:
     - `Deactivate <name>?` / `They'll be signed out and can't sign in until you reactivate them.`
     - `Reactivate <name>?` / `They'll be able to sign in again.`
3. **Empty state:** `No one has signed up yet.`
4. **Intro:** `People who signed up on the website. They see only the latest news until you link them to a student.`
5. **Hint under the table:** `To link a user to their child, use Invite or link a parent on the student's page.`

All of this wording goes in `USERS_PAGE` in `portal.constants.ts`.

### 7.9 Terms page and Privacy text

**`/terms`.**
- `routes/terms.tsx` has the same structure as `routes/privacy.tsx` (`SiteLayout`, `Section`, `h1`, `lastUpdated`, sections), plus `ErrorBoundary`. Meta: `buildPageMeta(SEO.terms, ROUTES.terms)`.
- Content is `TERMS` in `content.constants.ts`, headed by the comment `// DRAFT for Saurabh's approval before release (AC-50, A14). Covers every portal account.`
- It must stay consistent with `PRIVACY` (team rule 6) and claim nothing unbuilt (no mock tests).

```ts
export const TERMS = {
  heading: 'Terms & Conditions',
  lastUpdated: 'Last updated: November 2026',
  intro: 'These terms cover every AJ Classes portal account: staff, students, parents and guardians, and people who sign up on our website. By creating or using an account, you agree to them.',
  sections: [
    { heading: 'Who we are', text: `AJ Classes is a tutoring business in Melbourne. You can contact us at ${BUSINESS.email}.` },
    { heading: 'Who can have an account', text: "Staff, students and parents get their accounts by invitation from AJ Classes. A student's account is only created after a parent or guardian agrees. Parents and guardians can also sign up on our website when sign-up is open. Students can't sign up themselves." },
    { heading: 'What a signed-up account is for', text: "An account you create yourself shows our latest news. It doesn't give access to classes, students or anyone else's information. If you enrol with us, we can link your account to your child, and you then see what a parent sees." },
    { heading: 'Keeping your account safe', text: "Use your own e-mail address and keep your password to yourself. Don't share your account with anyone, including your child. Tell us straight away if you think someone else has used it." },
    { heading: 'Using the portal', text: "Don't use the portal to break the law, to harass anyone, to try to see information that isn't yours, to upload anything harmful, or to get around its security." },
    { heading: 'E-mails from us', text: 'We send account e-mails, such as confirming your address and resetting your password. Families who enrol also get e-mails, SMS and calls about classes, their account and invoices, which are part of our service. We only send news and offers if you agree to them separately.' },
    { heading: 'Closing accounts', text: `We may deactivate an account that breaks these terms, that is no longer needed, or to protect students and families. You can ask us to close your account at any time by e-mailing ${BUSINESS.email}.` },
    { heading: 'Your information', text: 'Our Privacy Policy explains what we collect and how we use it.' },   // rendered with a link to ROUTES.privacy
    { heading: 'The portal itself', text: 'We try to keep the portal available and accurate, but it may sometimes be unavailable or change. Nothing in these terms limits your rights under the Australian Consumer Law.' },
    { heading: 'Changes to these terms', text: 'We may update these terms. The date at the top shows when they last changed.' },
  ],
  errorBoundary: { heading: 'Something went wrong', text: "This page couldn't be shown. Please try again later.", backHome: 'Back to the home page' },
  backHome: '← Back to home',
};
```

**Lists that gain `/terms`:**
- `apps/web/src/hosting-csp.test.ts` (public-rule list, next to `/careers`, line ~134);
- `e2e/csp/public-csp.spec.ts` (the path list, line ~29);
- `apps/web/lighthouserc.json` (the URL list, after `/careers`).

The CSP and hosting files themselves don't change (DEC-WH-1 precedent).

**`PRIVACY` edits (AC-43).** Draft for Saurabh's approval. Set `lastUpdated: 'Last updated: November 2026'`.
1. **What we collect:** after "subscribe," add "or sign up for a portal account,".
2. **Portal accounts:** replace the first sentence, `Portal accounts are created only by invitation from AJ Classes.`, with:

   > Portal accounts are created by invitation from AJ Classes, or by parents and guardians signing up themselves when sign-up is open. When you sign up, we collect your name and e-mail address, when you agreed to our Terms & Conditions and this policy, and whether you signed up with your e-mail or with Google. If you sign in with Google, Google gives us your name, your e-mail address and a link to your Google profile picture; we use only your name and e-mail address. A signed-up account that isn't linked to a student sees only our latest news, and gets only account e-mails, such as confirming your address, password resets and security notices.

   (Corrected in the build, slice 27: GoTrue stores Google's picture link, `provider/google.go:120-131`, and every account gets Auth's "Your password was changed" notice, slice 19.)

   The rest of the section stays. Its student sentences stay true.
3. **Optional permissions:** "When parents set up their portal account, they can choose" becomes "Parents linked to a student can choose, when they set up their account or later in Account → Your choices". This is true for promoted parents too.

`privacy.test.tsx` fails if `only by invitation` comes back.

## 8. API contracts and error codes

### 8.1 Auth (supabase-js, called from services only)

| Call | Success | Refusals the page handles |
|---|---|---|
| `signUp` | 200 (new, an unconfirmed resend, or Auth's quiet reply for an address that already has a **confirmed** account: 200 with `identities: []`, creating, changing and sending nothing). The quiet reply needs `[auth.sms] enable_confirmations = true` (set in fix batch 2, security 06 finding 10); with it off, GoTrue v2.197.0 answers `422 user_already_exists` instead (`signup.go:293`), which the page also shows as success (R1) | 429 `sign_up_busy` / `sign_up_closed` / `sign_up_refused` / `invalid_name` (hook); `captcha_failed`; `over_request_rate_limit` (AC-39); `over_email_send_rate_limit` and `user_already_exists` → shown as success |
| `resend({type:'signup'})` | 200 (also unknown or confirmed: nothing sent) | `captcha_failed`; `over_request_rate_limit`; anything else → success |
| `verifyOtp({type:'email'})` | session (`amr` `otp`) | `otp_expired` → `linkExpired` |
| `signInWithOAuth` / `exchangeCodeForSession` | session (`amr` `oauth`) | the S3 shapes → M / AC-53 / closed / not active |
| `signInWithPassword` | as today | `email_not_confirmed` → `invalidCredentials` |

### 8.2 RPC

| RPC | Args | Returns | Errors (`message`, code) |
|---|---|---|---|
| `sign_up_status` | – | `'open' \| 'busy' \| 'closed'` | – |
| `sign_up_guard_ready` | – | boolean | – |
| `my_sign_up` | – | `[{ full_name, email, signed_up_with, can_finish }]` or `[]` | – |
| `complete_sign_up` | `new_full_name text, accepts_terms boolean` | void | `not_invited` 42501, `sign_up_link_needed` 42501, `password_not_set`, `terms_required`, `invalid_name` |
| `my_has_password` | – | boolean | – |
| `admin_list_users` | – | rows (§3.7) | `not_admin` 42501 |
| `admin_set_sign_up_open` | `is_open boolean` | void | `not_admin` 42501, `invalid_input` |
| `admin_promote_user` | `target uuid, target_student uuid` | void | `not_admin` 42501, `not_a_signed_up_user`, `not_found` P0002 |

### 8.3 `account-admin` (`{ ok, data | code }`, as today)

| Action | New input | New `data` | New `code`s |
|---|---|---|---|
| `invite-parent` | `confirmUserId?` | `{ needsConfirmation, userId, fullName, signedUpAt, signedUpWith }` or `{ userId, linked, promoted }` | `promotion_changed`, `role_sync_failed` |
| `invite-student` | – | – | `already_exists_user` |
| `invite` | – | – | – (an unfinished user is replaced; a finished user gets `already_exists`) |
| `resend-invite`, `cancel-invite` | – | – | `not_allowed` for users |
| `set-active` | – | – | – (users accepted; unconfirmed confirmed on deactivate) |

## 9. Seed, docs and scripts

- **`supabase/seed.sql`** (lines 25–32):
  - staff rows get `'tutor'` in the `account_role` column (admins too; line 61 still promotes them). Otherwise `tutor@` and `inactive@` would become `user`.
  - Add `('user@local.test', 'Local User', null)`. It stays `user` and finishes like the others (line 64 block). Phone is null for non-staff already.
  - Update the header list (lines 5–10).
- **`supabase/README.md`:**
  - "Local accounts" gains `user@local.test`.
  - New "Sign-up locally": the cap reset is `docker exec supabase_db_aj_classes psql -U postgres -c "delete from private.sign_up_emails"`; Google is off locally; Mailpit shows the confirmation.
  - "First admin on a new environment" step 1 gains, right after **Create user**:
    ```sql
    update auth.users set raw_app_meta_data = raw_app_meta_data || '{"account_role":"tutor"}' where email = 'their@email';
    ```
    Without it the account becomes a signed-up `user` (AC-42).
  - New "Close sign-up": Admin → Users → `Close sign-up`. The emergency fallback is Dashboard → Allow new users to sign up. The next deploy reopens it, so also close the admin switch (AC-48).
- **`docs/requirements/release-2/go-live.md` §0:** sign-ups may be on, and only with the ADR-0011 guard. Link ADR-0011.
- **`docs/testing/ci-gates.md`:** the smoke count goes 10 → 12, the CSP count 21 → 22, plus the new `test-deploy-order.mjs` in `pnpm test`.
- **Root `package.json`:**
  - `"test"` appends `&& node supabase/scripts/test-deploy-order.mjs`;
  - `"test:functions"` appends `&& node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON supabase/scripts/test-open-sign-up.mjs`.
- **Existing test scripts and e2e setup:** grep `admin/users` and `createUser` in `supabase/scripts/*.mjs` and `e2e/src/**`. Anything that creates a user and then signs in with a password must pass `email_confirm: true` (confirmations are now on).
- **Existing tests whose expectations change** (review-3 item 4):
  - `supabase/tests/database/triggers.test.sql`:
    - lines 7–18: a new auth user now gets `user`, not `tutor`;
    - lines 24–66: account `…e1` is now a `user`. The `email_confirmed_at` update at line 25 fires the wipe trigger, which is harmless: assert the same status, `joined_at` and sign-in copy, and add that `encrypted_password` is null afterwards. Alternatively, give `…e1` `account_role 'tutor'` if the block is about staff. The Developer picks whichever keeps that block's intent.
  - `supabase/tests/database/family_portal.test.sql` lines 97–110: the `sneaky@` (role in user metadata) and `admin-try@` (`account_role admin`) rows now expect `user`, not `tutor`. Update the descriptions: "…is ignored: they become a signed-up user".
  - `supabase/scripts/test-invite-redeem.mjs` line ~635 (AC 14 "halfway"): invites are now confirmed from creation, so `email_confirmed_at` is set **before** the first redeem as well as after. The assertion still passes, but its description ("this confirms the e-mail") becomes "the e-mail was confirmed at creation". Add one check that a fresh invite has `email_confirmed_at` set before any redeem (AC-42).

## 10. Test approach per acceptance criterion

All tests run on the local stack only. Every pgTAP run is `pnpm db:test`, never wrapped in a transaction. Abbreviations:
- **pgTAP-OS** = new `supabase/tests/database/open_sign_up.test.sql`;
- **pgTAP-AX** = new `open_sign_up_access.test.sql`;
- **INT** = new `supabase/scripts/test-open-sign-up.mjs` (Auth API, Mailpit, `account-admin`, `sql()` helper);
- **E2E** = new `e2e/tests/open-sign-up.spec.ts`.

Web unit tests sit beside their file.

pgTAP helpers to add to `000-setup-tests-hooks.test.sql`:
- `tests.create_sign_up(id, email, p_provider 'email'|'google', p_confirmed bool, p_finished bool, p_active bool)`, shaped as GoTrue does: the `auth.users` insert, then an `auth.identities` insert, then the `email_confirmed_at` update;
- `tests.authenticate_with_session(user_id, amr text[], aal)`, which inserts an `auth.sessions` row and sets `sub`, `role`, `aal`, `session_id`, and `amr` as `[{method,timestamp}]`.

| AC | Test type | Where / what |
|---|---|---|
| 1 | web unit; E2E | `login.test.tsx`: the link shows for `open`/`busy`, hides for `closed`, a failed options read and an unconfigured portal. `sign-up.test.tsx`: the link back to Sign in. E2E starts from the link |
| 2 | web unit | `sign-up.test.tsx`: heading and intro, name, e-mail, Turnstile, no password field, notice with Privacy link, Google button only when `google` |
| 4 | web unit; pgTAP-OS; INT | `lib/sign-up-validation.test.ts` (2–100, control and bidi characters). pgTAP: hook `invalid_name`; `complete_sign_up` `invalid_name`. INT: raw `signUp` with a 1-character name → 429, no user, no mail |
| 5 | web unit; INT | invalid e-mail message. A mixed-case e-mail is stored lower-case in `profiles.email` |
| 6 | web unit; INT | `FinishSignUpForm.test.tsx`: short → `passwordTooShort`; server `weak_password` → `weakPassword`; `autocomplete="new-password"`; show/hide. INT: AC-14 cases (the finish-step password is the only one that works) |
| 7 | web unit; pgTAP-OS | wording and both links; error without the tick. pgTAP: `terms_required`; `terms_accepted_at` set on save |
| 8 | web unit; INT (S2) | captcha message and widget reset. `/signup` without a token is refused |
| 10 | web unit | `sign-up.test.tsx`: the same card for a new e-mail, an e-mail that already has an account (the quiet 200; a `422 user_already_exists` is shown the same way) and `over_email_send_rate_limit`; the hours come from `AUTH_LIMITS`; Sign in and reset links |
| 11 | web unit | `noindex` meta; not in `sitemap.test.ts`; inherits the `portal-root` `ErrorBoundary` (route-table assertion) |
| 12 | web unit; INT | The page shows the identical card (unit). INT, for each of admin, tutor, student, parent, invited, finished user, deactivated finished and deactivated unfinished: `signUp` returns the quiet 200 with `identities: []` (all eight are confirmed; see §8.1), which the page shows as the AC-10 card; name, role, status and password are unchanged; the Mailpit count is unchanged. Unit: the page also re-reads the sign-up status just before sending, so a cap that filled or a switch that closed after the page loaded gives everyone the same busy or closed answer (review-5 finding 2). The raw-API difference is R1 (no test) |
| 13 | INT | Invite a parent, `signUp` with that e-mail, and the invite link still redeems through `invite-redeem` |
| 14 | INT (S6); pgTAP-OS | Cases 1–6 exactly as in 01, with A as a stranger and B the owner. Case 2 uses a pgTAP Google identity insert, refused. Case 5 uses the raw API with P1 → `Email or password is incorrect.` and no session. Case 6: a factor row before confirmation is gone after; one before the save is gone after. A repeat sign-up sends a new link and the old one fails |
| 15 | INT (S2); static test | Mailpit: subject, branded HTML, the link to `/portal/auth/confirm?…type=email`, and the text part or visible link. A config test: `[remotes.production.auth.email.smtp]` `sender_name = "AJ Classes"`, `admin_email = "hello@ajclasses.com.au"`. `[TBC AC-15 text part]` |
| 16 | web unit; E2E | `auth-confirm.test.tsx`: no `verifyOtp` until Continue; the URL is wiped after. E2E clicks through |
| 17 | pgTAP-OS; web unit; INT | pgTAP matrix: `amr` [otp], [recovery], [oauth] save; [password], [token_refresh], [otp, unknown], [] and a missing claim refuse (`sign_up_link_needed`). Without a password set in this session → `password_not_set` (e-mail account), and the Google account needs none. Saving deletes factors and every other session, keeps the current one, sets active, and audits `{role:user, via}`. `portal-access.test.ts`: `signUp` + `canFinish` → only `join`. INT: saves from the confirmation and recovery sessions |
| 18 | web unit | `auth-confirm.test.tsx` `type=email` error: one message and a `Send the link again` link |
| 19 | web unit; INT | `sign-up-resend.test.tsx`: always the neutral card plus the hint, except captcha, IP limit and network. INT: unconfirmed → a new mail and the old link dead; confirmed-unfinished → no mail; within 60 s → the page is still neutral; `sign_up_emails` count unchanged. **No "busy at cap" test** (R2) |
| 20 | INT (Auth/DB boundary); web unit | **A safeguard, and reachable from the UI** (R7 n1 thought it unreachable; Tester 6a found otherwise): if the finish step saves the password and then `complete_sign_up` fails (network, a server refusal), the person can sign out and sign in with that password. The guard then signs that password session out with the finish hint, and Forgot password or the e-mailed link finishes. Pressing Finish again in the same link session now saves (the retry goes on past `same_password`, fix batch 2). INT builds the unreachable state with the admin API: one `PUT /auth/v1/admin/users/<id>` with `{ email_confirm: true, password }` on an unfinished user. GoTrue runs `Confirm` **before** `UpdatePassword` in that call (`admin.go:255-270`), so the wipe fires first and the password survives. Never set the password in an earlier, separate call, because the wipe would then clear it (review-3 item 5). It then signs in by password → `my_sign_up().can_finish = false` and `complete_sign_up` → `sign_up_link_needed`. Unit: `decidePortalAccess` → `signOut` with `finish-sign-up` and `revoke`; the login notice shows the hint. INT: Forgot password for an unfinished, unconfirmed sign-up → recovery link → saves |
| 21 | web unit; E2E | `user-home.test.tsx` renders `PublicPostsList` with `POSTS_PUBLIC_PAGE` heading, empty and error texts. `posts.test.tsx` still passes |
| 22 | web unit | `PortalLayout` for `user`: Latest news, Account, Sign out only |
| 23 | web unit | `account.test.tsx` (new): `user` shows e-mail, `User`, Appearance; no Notifications, Your choices or Two-step; Change password only when `hasPassword` |
| 24 | INT; pgTAP-OS | A finished e-mail user resets and changes the password. A Google user (pgTAP-made, then the INT recovery link via the admin API) sets a password for the same id |
| 25 | web unit | `portal-access.test.ts`: `user` is `forbidden` for `staff`, `admin`, `student`, `parent`. A test walks `routes.ts` layouts so a new area can't be missed |
| 26 | pgTAP-AX | As a finished user: `select` returns 0 rows from every listed table and other people's `profiles`; insert/update/delete refused; a **pinned list** of `public` functions executable by `authenticated` (from `information_schema.routine_privileges`), each called with plausible arguments → raises or returns empty. A new function fails the pin until reviewed. `storage.objects` list and insert refused |
| 27 | pgTAP-AX | Reads only its own row. A direct update of each column (role, status, `is_active`, `terms_accepted_at`, `full_name`, …) is refused (the policy needs active staff). The name changes only through `complete_sign_up` |
| 28 | pgTAP-OS | Hostile `raw_user_meta_data` (`role`, `account_role`) and `raw_app_meta_data.account_role` of `admin` or `x` → `user`; the hook refuses an incoming `account_role`; `complete_onboarding` → `not_invited`; `my_onboarding` → none; no path gives `tutor` |
| 29 | pgTAP-AX; INT | Publishing and returning work, and the due-tomorrow sweep, queue no `email_outbox` row for a user. INT: a user's Mailpit holds only confirmation and reset |
| 30 | pgTAP-AX; web unit | `admin_list_staff`, students and `admin_email_problems` exclude users; dashboard counts (unit) come from staff and students |
| 31 | pgTAP-OS; web unit | `admin_list_users`: admin aal2 only (tutor and aal1 → `not_admin`), newest first, method and finished correct. `admin-users.test.tsx`: columns, labels, empty state, switch |
| 32 | INT; pgTAP-OS | `set-active` on finished and unfinished users: banned, audit `deactivated`/`reactivated`; an unconfirmed one is now confirmed; reactivate unbans. A Google sign-in for a banned user: S3 shape → `notActive` (unit). Password sign-in of a banned account stays `invalidCredentials` (R2a V18; see §14 Q2) |
| 33 | INT; web unit | `invite-parent` with a finished user → `needsConfirmation` with method and date; confirm → `promoted`, no Mailpit mail, audit `parent_linked` `{promoted_from:'user'}`. `ParentInviteDialog.test.tsx`: the text, the "Signed up with Google" line and the mobile line only for Google |
| 34 | INT; web unit | Student invite: finished user → `already_exists_user` (message and hint); unfinished → replaced (old link dead, new invite works) |
| 35 | pgTAP-OS; INT | pgTAP: after `admin_promote_user` the role is `parent`, the link exists, sessions and password are kept, and it is no longer in `admin_list_users`; as `oauth` `amr` the promoted Google user reads its child (`require_parent` functions). INT: `app_metadata.account_role = 'parent'`; the password still signs in; a forced `syncAccountRole` failure → `role_sync_failed`, then a retry heals |
| 36 | INT | Staff, student and parent invites each replace an unfinished sign-up (its confirmation link fails afterwards). A deactivated sign-up → `already_exists` |
| 37 | INT | `invite` with a finished user → `already_exists` |
| 38 | INT (S2) | `/signup` and `/resend` without captcha refused; the existing Forgot-password captcha test still passes |
| 39 | web unit; static test; INT opt-in | `over_request_rate_limit` → `tooManyAttempts` text. A config test pins `sign_in_sign_ups = 30`. `test-open-sign-up.mjs --rate-limit` (run last, by hand: it blocks this IP's sign-ins for 5 minutes) |
| 40 | manual (Tester, mobile); pgTAP-OS | Mobile against local with `user@local.test` → today's "Unresolvable role" error, no data, no crash; an unfinished user can't sign in (no password) and is never "invited, unfinished". `my_onboarding` excludes users. **No mobile code change** (§12) |
| 41 | pgTAP-OS; INT | The mobile-read columns are unchanged (`has_column`); e-mail and Google sign-ups never get `account_role` |
| 42 | all suites; INT; migration step test | `pnpm check`, `db:test`, `test:functions`, smoke and CSP as before. INT: seed accounts sign in with confirmations on; a new invite redeems; the Studio-style admin (admin API `createUser` with `email_confirm`, plus the README `account_role` SQL) reaches staff onboarding. **Migration step test** (local, Developer): `supabase db reset --version 20261030100000`, create an unconfirmed invitee, `supabase migration up`, check it is now confirmed and still redeems |
| 43 | web unit; Saurabh | `privacy.test.tsx`: no `only by invitation`; the new sentences present. Wording approval before release |
| 44 | – | This table |
| 45 | INT; pgTAP-OS | Raw API with a bad name, or with no captcha → no user, no mail. `complete_sign_up` without the tick → `terms_required` and the account stays `invited` |
| 46 | pgTAP-OS; INT; web unit | pgTAP: 15 rows → the hook refuses the 16th; 24 h purge; with 14 planted, two calls → the first allowed, the second `sign_up_busy` (the advisory lock serialises real parallel calls; S1 notes whether the hook runs in its own transaction). INT: plant 15 → `signUp` 429 `sign_up_busy`, no mail. Unit: with `busy` the page shows the same message for any e-mail and never calls `signUp`. Resend and Forgot password still send (not stopped, not counted) |
| 47 | `test-deploy-order.mjs`; pgTAP-OS | The order and no real calls (§5). `sign_up_guard_ready()` true after the migration, false after dropping a trigger inside the test transaction |
| 48 | pgTAP-OS; INT; web unit | Closed → the hook refuses e-mail and Google; `sign_up_status = 'closed'`; audit. INT: `admin_set_sign_up_open(false)` → `signUp` 429 `sign_up_closed`, no mail; existing users still sign in; reopen works. Unit: login link hidden; sign-up page shows the closed card; admin switch dialogs |
| 50 | web unit; E2E CSP; Saurabh | `terms.test.tsx`: heading, every section, the Privacy link, `ErrorBoundary`. `sitemap.test.ts`, `hosting-csp.test.ts` and `public-csp.spec.ts` include `/terms`; `LEGAL_LINKS.terms` links in both the join and finish forms |
| 51 | web unit; E2E | The button shows only when settings say Google, and hides on a failed read. E2E: `page.route` stubs `/auth/v1/settings` with Google on; click → the intercepted `/auth/v1/authorize?provider=google` has `redirect_to=<origin>/portal/auth/callback` and a `code_challenge`; abort the navigation |
| 52 | pgTAP-OS; Saurabh | A Google-shaped new user → `user`/`invited`; the identity is allowed; finish with `oauth` `amr` and no password → active. Saurabh does one real Google sign-up after setting up credentials |
| 53 | pgTAP-OS; web unit | Hook: `email_verified` false, missing or `"false"`, and an empty e-mail → `google_email_unverified`. Callback shows the AC-53 text |
| 54 | pgTAP-OS; web unit; E2E | Every Q3 row: unconfirmed sign-up, finished e-mail user, tutor, admin, invitee, parent, student, deactivated → refused; an account made with Google → no insert. Callback maps the trigger refusal to M |
| 55 | pgTAP-OS; web unit | An `oauth` session reads exactly what an e-mail user reads (re-run the AX sweep with `oauth` `amr`). Sign out as today |
| 56 | pgTAP-OS | Added at stage 6 (fix batch 2; reworked in fix batch 3 after review-5 round 3): `private.delete_stale_sign_ups()` deletes, one row at a time, only **active** `user`/`invited` accounts with no confirmed e-mail whose profile is over 7 days old and that no `audit_log` row names (as target or actor); a row whose delete still fails is logged and kept, and the rest are deleted. pgTAP: the normal delete; a sign-up deactivated through `admin_set_active` whose ban step failed half-way (unconfirmed, audited) is kept; a reactivated one that audit rows point at is kept; a deactivated one is kept; a row whose delete fails is kept while the job deletes the others, and goes on the next run once unblocked; a 6-day-old sign-up, confirmed and finished users, staff, parent and student invitees and a parent are untouched; `cron.job` runs it daily (`delete-stale-sign-ups`, `45 17 * * *`); `sign_up_guard_ready()` also needs `postgres` DELETE on `auth.users`. Audit rows keep their target: the `audit_log` foreign keys are unchanged |

**E2E `open-sign-up.spec.ts`** (2 tests; markers `e2e-<run>-…`):
1. Login link → sign-up → Mailpit link → Continue → finish (password and tick) → `/portal/user` shows "Latest news". DB check: role `user`, status `active`, `terms_accepted_at`, audit `account_activated`. Cleanup deletes the user and the `sign_up_emails` rows created since the test began.
2. The Google button with stubbed settings (AC-51) and the callback error → M (AC-54).

## 11. New and changed test files

New:
- `supabase/tests/database/open_sign_up.test.sql`
- `supabase/tests/database/open_sign_up_access.test.sql`
- `supabase/scripts/test-open-sign-up.mjs`
- `supabase/scripts/test-deploy-order.mjs`
- `e2e/tests/open-sign-up.spec.ts`
- Web: `lib/sign-up-validation.test.ts`, `services/sign-up.service.test.ts` (throwaway never returned and ≥ 12 characters; e-mail lower-cased; only `full_name` in `data`; neutral mapping), `routes/portal/sign-up.test.tsx`, `sign-up-resend.test.tsx`, `auth-callback.test.tsx`, `user-home.test.tsx`, `admin-users.test.tsx`, `account.test.tsx`, `routes/terms.test.tsx`, `components/portal/FinishSignUpForm.test.tsx`, `ParentInviteDialog.test.tsx`

Changed:
- `000-setup-tests-hooks.test.sql` (helpers), `triggers.test.sql` (lines 7–18 and 24–66), `family_portal.test.sql` (lines 97–110)
- `supabase/scripts/test-invite-redeem.mjs` (~line 635), `test-deploy-order.mjs` failure cases (§5)
- `lib/portal-access.test.ts`, `services/auth-errors.test.ts`, `routes/portal/auth-confirm.test.tsx`, `routes/privacy.test.tsx`, `routes/sitemap.test.ts`, `routes/posts.test.tsx` (extracted list), `hosting-csp.test.ts`
- `e2e/csp/public-csp.spec.ts`

## 12. Files to touch

**Database and Auth**
- new `supabase/migrations/20261114100000_user_role.sql`, `supabase/migrations/20261114100100_open_sign_up.sql`
- `supabase/config.toml`; new `supabase/templates/confirmation.html`; `supabase/templates/recovery.html`; `supabase/templates/invite.html`
- `supabase/scripts/deploy.sh`; `supabase/seed.sql`; `supabase/README.md`

**Edge function** (`supabase/functions/account-admin/handlers/`)
- `accounts.ts`, `invite.ts`, `invite-parent.ts`, `invite-student.ts`, `set-active.ts`, `resend-invite.ts`, `cancel-invite.ts`

**Web** (`apps/web/src/`)
- constants: `app.constants.ts`, `routes.constants.ts`, `portal.constants.ts`, `error.constants.ts`, `content.constants.ts`, `seo.constants.ts`, `index.ts`; new `sign-up.constants.ts`
- services: `types.ts`, `auth.service.ts`, `auth-errors.ts`, `supabase.client.ts`, `families.service.ts`, `index.ts`, `database.types.ts` (regenerated); new `sign-up.service.ts`, `users.service.ts`
- lib: `portal-access.ts`, `portal-guard.ts`; new `sign-up-validation.ts`
- `routes.ts`; `react-router.config.ts` (in `apps/web/`); `routes/sitemap.ts`; `routes/posts.tsx` (and move `posts.module.css` list styles)
- routes/portal: `login.tsx`, `join.tsx`, `auth-confirm.tsx`, `account.tsx`, `admin-dashboard.tsx`, `admin-student.tsx`; new `sign-up.tsx`, `sign-up-resend.tsx`, `auth-callback.tsx`, `user-layout.tsx`, `user-home.tsx`, `admin-users.tsx`
- new `routes/terms.tsx`
- components/portal: `PortalLayout.tsx`, `ParentInviteDialog.tsx`, `index.ts`; new `GoogleButton.tsx`, `FinishSignUpForm.tsx`, `FinishSignUpHint.tsx`
- new `components/posts/PublicPostsList.tsx` (+ `.module.css`)
- `apps/web/lighthouserc.json`

**Tests:** §11.

**Repo**
- `package.json` (`test`, `test:functions`)
- `docs/requirements/release-2/go-live.md`, `docs/testing/ci-gates.md`
- `docs/decisions/0011-…md` (status → Accepted at merge; the Manager does this)

**Mobile:** none. I checked `aj_classes_mobile/lib/core/domain/role.dart` and `access_state_service.dart`:
- a finished user (`profiles.role = 'user'`, no `account_role`) resolves to null → "Unresolvable role", with no data;
- an unfinished one has no readable profile and no `my_onboarding` row → treated as signed out or deactivated;
- nothing in `lib/` parses `role` into a strict enum;
- `profiles.role`, `full_name`, `is_active`, `invited_at` and `my_onboarding` keep their names.

## 13. Sequencing

1. **Migrations** §3, plus `pnpm db:types`. The lead owns stack restarts and resets (one owner for state-changing commands); the Developer asks.
2. **`config.toml`** and templates (§4). Restart the stack.
3. **Spikes S1–S7** (§2), each with its test committed. Record the outcomes in `05-dev-notes.md`. Stop at any "stop" outcome.
4. pgTAP-OS and pgTAP-AX green; existing pgTAP green (update `triggers.test.sql`).
5. Seed (§9), then `account-admin` (§6), then restart the edge runtime (`docker restart supabase_edge_runtime_aj_classes`), then `test-open-sign-up.mjs` and every existing `test:functions` script green.
6. `deploy.sh` and `test-deploy-order.mjs`.
7. Web: constants → services → access rules → components → pages → Terms and Privacy. Unit tests with each.
8. E2E and CSP; `pnpm check` with `VITE_APP_ENV=production pnpm build`.
9. Docs (§9).

**Release (Saurabh; 02 "Release order"):**
1. Terms and Privacy wording approved.
2. Production web live (the link and button stay hidden while Auth says sign-up is off).
3. `deploy.sh` (Google off; no `GOOGLE_*` needed).
4. One real e-mail sign-up.
5. **Later, to switch Google on:** Saurabh creates the OAuth client and puts `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.deploy`. A one-line change sets `enabled = true`, then `deploy.sh`, then one real Google sign-up.

No invites during the deploy (02 Q1 release window).

## 14. Risks and open questions

**Residual risks.** R1 and R2 are accepted by Saurabh (Decision 6). R3 is new and recorded here for `decisions.md`.

1. **R1:** `signUp`'s raw reply shows whether an e-mail has an account. At the cap, the raw reply differs for new and existing e-mails. The page never shows the difference.
2. **R2:** resends and Forgot password are neither counted nor stopped by the 15-a-day cap. Within Auth's 30 e-mails an hour, they could use up Resend Free's 100 a day. That would stop resets, e-mailed codes, invites and portal e-mails until the next day. A sign-up whose slot was taken but then failed still uses that slot.
3. **R3 (new):** promoting a Google-only account rests on Google's past verification of that address. `email_verified` means "verified once". A recycled ISP address, a lapsed domain, or a Workspace admin minting addresses on their own domain could put a different person behind it. Mitigation: the admin sees "Signed up with Google" in the confirm message (§7.7) and can check with the family. The extra e-mail proof step was not added (the cheap option, review-2 R3 n1).

4. **R4 (proposed, security 06 finding 1):** about 15 Turnstile solves a day can fill the cap, so everyone sees "busy" for 24 hours, and resends to made-up addresses can spend most of a day's Resend Free quota on hard bounces; a high bounce rate can get Resend sending paused, which also stops invites, resets and portal e-mails. Mitigations: unconfirmed sign-ups are deleted after 7 days, and the release notes tell the admin what to watch. Saurabh to accept.
5. **R1 and R2 extended (security 06 finding 2):** any signed-in account can test whether an e-mail exists through `PUT /auth/v1/user` (422 `email_exists`, no Turnstile, about 30 per 5 minutes per IP) and can send e-mail-change mail within Auth's 30 an hour. No Supabase setting turns it off; the real fix (custom Auth domain and a WAF rule) was declined in Decision 8.
6. **Known Low, accepted: `posts.author_id` is readable by any signed-in account (security 06 finding 7).** An earlier review hid `author_id` from `anon` (`20261025110100_posts_public_columns_and_trim.sql`); with open sign-up, `authenticated` includes anyone, and RLS (`"Anyone reads posts"`) plus the full-table SELECT grant let them read it. The staff profile ids it reveals are useless under `profiles` RLS, so there is no data impact. Recorded here because it reverses that hardening; the fix, if wanted later, is an `admin_list_posts()` RPC and a column-limited grant (review-6b item 4).
7. **Known Low, deferred:** the Google half of security 06 finding 9 (Google sign-ups skip the name rule); fix before Google is switched on.

**Other risks.**

8. **Hosted `postgres` rights on `auth` tables (S3).** If they are missing, the migration fails at step 3/7 and sign-up stays closed.
9. **GoTrue upgrades** can change linking, the hook, `Confirm()` or `amr`. The S1–S6 tests run on every local stack bump.
10. **Clock skew** between GoTrue (`auth.sessions.created_at`) and Postgres (`password_set_at = now()`). The password is set seconds after the session, so milliseconds of skew don't matter. If S5 or S6 ever shows a false `password_not_set`, compare with a 5-second allowance. Record it, don't guess.
11. **The local cap** fills during manual testing. README documents the reset. Tests plant rows instead of sending real mail.

**Open questions** (mark as `[TBC]` in 01 or the dev notes; none blocks the build):
1. `[TBC: AC-15 "plain-text part": GoTrue may send HTML only (S2). If so, accept "the full link is visible as text in the e-mail" – PO]`
2. `[TBC: AC-32 "on their next sign-in, by any method, they see Your account is not active". Today a banned account's password sign-in shows "Email or password is incorrect." on purpose (R2a V18: the ban is reported before the password is checked, so "not active" would reveal deactivated e-mails to anyone). Design keeps V18. "Not active" shows for an existing session and for Google – PO]`
3. **Answered (lead Q3, review-3 item 1):** e-mail sign-up goes first. Google ships `enabled = false`, and `deploy.sh` asks for the Google credentials only when it is enabled (§0 item 8, §4.1, §5, §13).
4. `[TBC: Terms & Conditions draft (§7.9) and Privacy text (§7.9) – Saurabh approves before release]`
5. Not done, because no AC asks for it: a Terms link in the public footer. Offer it as a one-line follow-up.
