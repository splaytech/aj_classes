# 05 — Developer notes: open sign-up (stage 5)

Developer, 14 Nov 2026, branch `feature/open-sign-up`. Local stack only (project `aj_classes`, ports 553xx). Supabase CLI v2.120.0, GoTrue image `v2.197.0`, Postgres `17.11.0.003`. No hosted Supabase, Vercel, Resend or Google access of any kind.

Captured JSON in this file uses fake addresses only and no tokens.

## Slice 0 — baseline (before any change, HEAD `9fc2a61`)

The edge runtime container had exited 5 days earlier, so the stack was restarted from the main checkout first (`pnpm db:stop && pnpm db:start`). Mount after restart: `/host_mnt/Users/sjain/dev/work/aj_classes/supabase/functions` (this checkout).

| Check | Result |
|---|---|
| FULL (scoped Prettier, lint, typecheck, `pnpm test`, `VITE_APP_ENV=production pnpm build`) | pass. 733 web tests (79 files) + 6 e2e-unit |
| RESET | pass |
| DB (`pnpm db:test`) | pass. 18 files, **834** tests |
| FN (`pnpm test:functions`) | pass. **413** `ok` lines over 4 scripts, 0 failures |
| E2E smoke | **10** passed |
| CSP (gate build, `check:hosted-ref` 0 files of 165, `test:csp`) | **21** passed |

## Slice 0 — hosted hook question (S1 hosted part)

Asked through the lead: Saurabh to open Dashboard → Authentication → Hooks and confirm that "Before User Created" is offered on the plan (read-only). **Answer: pending** (I can't ask him directly; it's in my report to the lead). This is a release gate, not a build gate (review-4 finding 1), so the build carries on.

## Slice 0 — GoTrue v2.197.0 reading (scratch clone, commit `4eee58f`, not in the repo)

| Spike | Finding (file:line) | Branch taken |
|---|---|---|
| S1(d) `id_token` | `token_oidc.go:326` `IdTokenGrant` calls `triggerBeforeUserCreatedExternal` before `createAccountFromExternalIdentity` (`:339`), the same hook path as the OAuth callback (`external.go:207`) | **Outcome A**: the hook runs for `signInWithIdToken`. No checks move into `check_identity_link()` |
| S1(e) `email_verified` | `provider/provider.go:110` `EmailVerified bool ... structs:"email_verified"` (no `omitempty` on the `structs` tag), filled from `google.go:127` `IsEmailVerified()`; `external.go:188-197` resets it to `false`, then copies `email.Verified`. `user_metadata` is `structs.Map(userData.Metadata)` (`hooks.go:69-71`) | A JSON **boolean**, always present for Google. The hook still treats `"true"` (string) as true and anything else (false, `"false"`, missing) as unverified, as 03 says |
| S1(f) Management API names | CLI v2.120.0 `packages/api/src/generated/openapi.json`: `GET/PATCH /v1/projects/{ref}/config/auth`; `AuthConfigResponse_Output` and `UpdateAuthConfigBody` both have `disable_signup`, `hook_before_user_created_enabled`, `hook_before_user_created_uri` | Names as in 03 §5. No change |
| S1 hook transaction | `hookspgfunc.go:112` runs `select <fn>(?)` in its **own** `db.Transaction`, and `triggerBeforeUserCreated` refuses to run inside a caller's transaction (`checkTX`, `hooks.go:43`) | The cap row the hook inserts commits on its own, even if the sign-up fails afterwards (R2 note in 03 §14 holds). The advisory lock is per hook call |
| S1(b) refusal shape (source) | `hookserrors.go:76-89`: `{"error":{"http_code":429,"message":"sign_up_busy"}}` becomes `HTTPError{HTTPStatus: 429, Message: "sign_up_busy"}` with **no `ErrorCode`** | Expect supabase-js `status 429`, `message 'sign_up_busy'`, `code` empty. Confirmed live in slice 5 |
| S3 order | `external.go:319` `case models.LinkAccount` → `:322` `createNewIdentity` → … → `:416` `RemoveUnconfirmedIdentities`. (The manual-link path `:495`/`:523` has the same order, and manual linking stays off) | **Confirmed**: `createNewIdentity` runs first, so the `before insert` trigger sees the e-mail identity still there. No "stored password" fallback |
| S3 callback shapes (source) | `redirectErrors` (`external.go:821-846`) puts the error in **both** the query (`error`, `error_code`, `error_description`) and the fragment (same keys when non-empty, plus `sb`). `getErrorQueryString` (`:848-891`) | See the table below |
| S5 Google `amr` | PKCE: the flow state is created with `AuthenticationMethod: models.OAuth` (`external.go:109`); `/token?grant_type=pkce` parses it (`token.go:256`) and adds that claim (`token.go:317`, `models/amr.go:28`). `models/factor.go:75-98` names: `oauth`, `otp`, `recovery`, `magiclink`, `email/signup`, `token_refresh` | Google PKCE `amr` = `[oauth]` |
| S6 hash upgrade | `token.go:124-150`: `Authenticate` runs first; only when the password matched and `shouldReEncrypt` is set does it `UpdateOnly(user, "encrypted_password")` with the password just typed. A banned user is refused before this (`token.go:120`) | As 03 S6. Tested live in slice 8 |

**S3 callback error shapes (from source; a real Google run is Saurabh's).** Every case redirects to the `redirect_to` URL (`/portal/auth/callback`) with these keys in the query string and repeated in the fragment:

| Case | `error` | `error_code` | `error_description` |
|---|---|---|---|
| (i) `on_auth_identity_link_check` raises | `server_error` | `unexpected_failure` | `Error creating identity` (`createNewIdentity` wraps any insert error in `NewInternalServerError`, `external.go:910-912`; the trigger's own message never reaches the browser) |
| (ii) the hook refuses (closed, busy, refused, Google unverified) | `server_error` (429 is not in `oauthErrorMap`) | empty in the query, absent from the fragment | our message: `sign_up_closed`, `sign_up_refused`, `google_email_unverified` (or `sign_up_busy`, unreachable for Google) |
| (iii) the user is banned | `access_denied` | `user_banned` | `User is banned` |
| Auth sign-up switch off (`disable_signup`) | `access_denied` | `signup_disabled` | `Signups not allowed for this instance` |

So the callback page maps by `error_description` first (our hook messages), then `error_code` (`user_banned`, `signup_disabled`); everything else, including case (i), is message M (AC-54).

## Slice 3 — AC-42 migration step test (by hand, local)

1. `supabase db reset --local --version 20261030100000` (18 migrations, seed applied).
2. Inserted an unconfirmed staff invitee the old way (no `account_role`, `email_confirmed_at` null) and stored an invite token hash for it with `invite_token_store`. Profile: `tutor/invited`, unconfirmed.
3. `supabase migration up --local`: applied `20261114100000_user_role.sql` and `20261114100100_open_sign_up.sql`.
4. Result: still `tutor/invited`, now **confirmed**. `invite-redeem` accepted the token and the `/verify` hop gave a 200 session for that account.
5. RESET (fresh seed).

INT (`test-open-sign-up.mjs`, AC-42 section): all six signing-in seed accounts still sign in with confirmations on; every seed account is confirmed; a new parent invite is confirmed at creation and redeems; a Studio-style account (admin `createUser` with `email_confirm`, then the README `account_role` SQL) becomes `tutor/invited` and its recovery link reaches `my_onboarding` as a tutor.

## Slice 4 — deploy.sh

- New order 1/7 link → 2/7 gate → 3/7 `db push` → 4/7 guard check (5 tries, 3 s apart) → 5/7 functions → 6/7 secrets → 7/7 `config push` + hook post-check. Review-3 (a)–(d) are in; the token lives only in a 0600 `mktemp` header file removed by an `EXIT` trap.
- `test-deploy-order.mjs`: 35 checks (dry-run order, fail-closed paths against fakes, Google gate, static config). Runs in `pnpm test`. It uses `/bin/bash` (3.2 on macOS) and a PATH of only the fakes plus `/usr/bin:/bin`; the fake `jq` logs and hands over to the real `jq` (it has no network).
- Two test-only overrides were added beside 03's `DEPLOY_ENV_FILE`/`DEPLOY_CONFIG`: `DEPLOY_GUARD_RETRY_SECONDS` (default 3; the test uses 0).
- [ASSUMPTION] With `[remotes.production.auth.external.google] enabled = false`, `config push` needs no `GOOGLE_*`: CLI v2.120.0 `pkg/config/config.go:1481-1483` skips validation of a disabled provider, and `auth.go:1295-1303` pushes only `external_google_enabled = false` (no client id or secret). Read from the CLI source; not run against the hosted project.

## Slice 5 — S1: the before-user-created hook

**S1(a) captured `event`** (logged once to a scratch table, then the logging was removed; `grep hook_event_capture` on the migration finds nothing). E-mail `signUp` for a fake address, ids shortened:

```json
{
  "user": {
    "id": "30095486-…", "aud": "authenticated", "role": "", "email": "capture-s1@local.test",
    "phone": "", "created_at": "0001-01-01T00:00:00Z", "updated_at": "0001-01-01T00:00:00Z",
    "identities": [], "is_anonymous": false,
    "app_metadata": { "provider": "email", "providers": ["email"] },
    "user_metadata": { "full_name": "Capture Person" }
  },
  "metadata": { "name": "before-user-created", "time": "2026-11-14T01:48:32.01Z", "uuid": "1031d65b-…", "ip_address": "192.168.65.1" }
}
```

- `user.app_metadata.provider`, `user.email` and `user.user_metadata.full_name` are where 03 §3.5 reads them. The user isn't saved yet (`created_at` is the zero time, `identities` empty), so the hook can't look the account up.
- For Google, `user_metadata` is the provider's `structs.Map` (slice 0 S1(e)): `email_verified` is a JSON boolean. The pgTAP calls use this shape with `provider: google`.

**S1(b) refusal shape, live.** Raw `/auth/v1/signup` reply: `429 {"code":429,"error_code":"unknown","msg":"sign_up_closed"}`. supabase-js (`apps/web`'s copy): `error.status === 429`, `error.message === 'sign_up_busy'` (or `sign_up_closed`, `invalid_name`), `error.code === 'unknown'`. So `auth-errors.ts` keys our refusals by **message** (03 §7.2 already does); `code` is useless here. No "if not" branch.

**S1(c).** Live: Auth (as `supabase_auth_admin`) ran the hook, which read `private.sign_up_settings` and counted `private.sign_up_emails` (the 16th sign-up was refused busy; the closed switch refused). pgTAP can't `set role supabase_auth_admin` (`postgres` isn't a member), so pgTAP checks the grants instead: execute for `supabase_auth_admin` only, `usage on schema public`, security definer, empty `search_path`, and the owner's rights on both private tables. No stop.

- INT: 26 checks (AC-42 section plus the hook: allowed sign-up has no `account_role` (AC-41), is `user/invited` with the form's name; 16th → 429 `sign_up_busy`, no account, no mail; closed → 429 `sign_up_closed`; 1-character name → 429 `invalid_name`; a mixed-case e-mail is stored lower-case (AC-5)).
- pgTAP-OS: 49 checks in the file so far.
- [ASSUMPTION] INT empties `private.sign_up_emails` before planting and again at clean-up, and reopens the switch. It's the local stack I own, and handover needs an empty cap anyway.

## Slice 6 — confirmation e-mail (S2 text part)

- **S2 text part: none.** GoTrue v2.197.0 sends the confirmation as `Content-Type: text/html; charset=UTF-8` only (Mailpit's `Text` is its own rendering of the HTML). Took 03's "if not": the template prints the full link as visible text under the button ("If the button doesn't work, copy this link into your browser:"). `[TBC: AC-15 "plain-text part" is met as "link visible as text" – PO]`; the lead's assumption Q1 already accepts this.
- Templates are read when Auth starts: a template edit needs RESTART before INT sees it (bit me once).
- `invite.html` (unused since ADR-0010): [ASSUMPTION] the condition now tests `eq . "parent"` first, then `"student"`, else Staff, so a staff invite with `account_role: tutor` still says Staff (a bare `eq . "parent"` with the old else-branch would have called staff "Parents").
- `recovery.html`: "your AJ Classes account", no Staff badge.

## Slice 7 — S3: the linking trigger

- `postgres` creates `on_auth_identity_link_check` (`before insert on auth.identities`) locally: no permission problem. Seed and invite identities (`email`) pass.
- pgTAP-OS: 14 rows. A brand-new Google account gets its identity and stays `user/invited`; a second Google identity, an unconfirmed sign-up (S3 order row: its e-mail identity is still there), confirmed-unfinished, finished, deactivated, tutor, admin, invitee, parent and student are all refused with `identity_link_refused` (42501); Apple is refused; e-mail identities are allowed.
- [ASSUMPTION] The rule also requires `profiles.is_active` (not in 03's list). A brand-new Google account is always active, so nothing legitimate is refused; it only closes the corner of a deactivated, unconfirmed user with no identity, which 03 already refuses by other routes.
- No "stored password" fallback (slice 0 confirmed the order).

## Slice 8 — S6: the confirm-time wipe

**Outcome: pass, no stop.** `postgres` creates `on_auth_user_email_confirmed` (`before update of email_confirmed_at on auth.users`) and the trigger deletes from `auth.mfa_factors` without any permission problem.

| Check | Result |
|---|---|
| (1) P1 planted at bcrypt cost 4 before confirmation; confirm through the e-mail link | `encrypted_password` is **null** afterwards; P1 doesn't sign in |
| (3) password sign-in against the null hash | **400 `invalid_credentials`**, no 500 (`models/user.go:468-476` returns "no match" before any compare) |
| (2) owner sets P2 with `updateUser` in the link session; test re-plants P2 at cost 4; P2 sign-in | P2 signs in, P1 still fails, the wipe doesn't fire. **Surprise:** no hash is written back at all. GoTrue re-hashes a cost-4 (or > 10) hash only in memory (`models/user.go:490-503`) and persists only when database encryption is on (`token.go:139-149`; off locally). In both cases it runs only after the typed password matched the stored hash, so it can't restore a wiped one. The check now asserts "no other hash written" locally |
| GoTrue writes after `Confirm()` | `Confirm()` itself is `UpdateOnly(confirmation_token, email_confirmed_at)` (`models/user.go:529`), then `user_metadata.email_verified` and the one-time tokens. A repeat `signUp` for an unconfirmed address doesn't touch the user ("do not update the user", `signup.go:194`) |

- AC-14 cases 3, 4 and 5 pass up to "only B's password signs in" (B sets the password with `updateUser` in the link session; the finish RPC comes in slice 10). A repeat sign-up sends a new link and the old link stops working.
- Tests skip Auth's 60-second resend wait by back-dating `confirmation_sent_at` with SQL (local only).
- pgTAP-OS: a factor added before confirmation is gone after it; a second confirm update leaves a later password alone; a staff invitee's password and factor are kept. `triggers.test.sql`: account `…e1` (no marker, so a user) now also asserts it has no password after confirming.

## Slice 9 — S2 (captcha) and S4 (unconfirmed sign-in)

| Spike | Observed | Branch |
|---|---|---|
| S2 captcha | `/signup` and `/resend` without a token: `400 {"error_code":"captcha_failed","msg":"captcha protection: request disallowed (no captcha_token found)"}`; nothing created, nothing sent, no cap slot. `/recover` without a token is still refused | none |
| S4(a) | Password sign-in to an unconfirmed e-mail: `400 email_not_confirmed`. `auth-errors.ts` now maps it to `invalidCredentials` | none |
| S4(b) | Ban an unconfirmed sign-up (admin `ban_duration`), then `signUp` again → **200 and 1 e-mail sent**; `resend` → **200 and 1 e-mail sent**. GoTrue doesn't check the ban on either | **Keep** §6.4 "confirm on deactivate" (it is what stops these e-mails; the plan's default). Lead to note (stop condition 7, informational) |

- AC-19 raw replies: resend to an unconfirmed sign-up → 200, new link, old link dead; a second resend inside 60 s → `429 over_email_send_rate_limit` (the page maps it to "sent"); resend to a confirmed, unfinished sign-up → 200 and nothing sent; resends never take a cap slot.
- AC-46: with 15 planted, resend and Forgot password both still send and neither is counted.
- INT: 62 checks.

## Slice 10 — S5: the finish step

**Real `amr` arrays (GoTrue v2.197.0, local, from the JWT):**

| Session | `amr` | After one refresh | After two |
|---|---|---|---|
| Confirmation link (`verify` type `email`) | `[otp]` | `[otp]` | – |
| Recovery link (`verify` type `recovery`) | `[otp]` | `[otp]` | `[otp]` |
| Password sign-in | `[password]` | `[password]` | – |
| Google PKCE (source, slice 0) | `[oauth]` | (not run: no local Google) | – |

- A refresh keeps the session's original method: GoTrue reads `amr` from `auth.mfa_amr_claims` for the session and adds no `token_refresh` claim. So a link session stays recognisable after an hour. **Stop condition 4 does not apply.**
- Recovery links give `otp`, not `recovery`. `recovery`, `email/signup` and `magiclink` stay on the list as 03 has them (methods GoTrue can issue for link sessions); no method was added and there is no catch-all.
- `updateUser({ password })` in a link session doesn't change its `amr`, so the finish step saves from the same session that chose the password.
- No clock-skew problem: `password_set_at` (Postgres `now()`) was always after `auth.sessions.created_at` (GoTrue). No allowance added.

INT (89 checks so far): finish saves from a confirmation session and from a recovery session (the recovery link also confirms an unconfirmed sign-up and wipes its old password); refused from a password session with `sign_up_link_needed`; without a password chosen in the session, `password_not_set`; AC-14 cases 1–6 in full, each on a fresh `signUp` (never the planted-P1 account); saving leaves only the saving session (the other one can't refresh); AC-24 reset and change; AC-20 built with one admin `PUT { email_confirm, password }`: the password survives, `can_finish` is false and the refusal is `sign_up_link_needed`, with `password_set_at` set.

pgTAP-OS (the `amr` matrix with crafted claims): `[otp]`, `[recovery]`, `[oauth]` save; `[password]`, `[token_refresh]`, `[otp, unknown]`, `[otp, password]`, `[]` and no claim refuse; `password_not_set` for a password set before the session or none; Google needs no password; saving deletes factors and other sessions and audits `{role: user, via}`.

## Slice 11 — S7: PKCE and e-mail links

**Outcome: pass, main client switched to `flowType: 'pkce'`** (no `getOAuthClient()` fallback needed).

- With PKCE, GoTrue prefixes the e-mailed token hash: links read `token_hash=pkce_<hex>`. `verifyOtp({ token_hash, type })` accepts it in a fresh client with no stored code verifier (so a link opened on another device still works). `/portal/auth/confirm` passes the hash through without a format check, so nothing on the page changes.
- INT: a PKCE `signUp`, a PKCE `resend` (new `pkce_` link), `verifyOtp` type `email` on that link, and a PKCE `resetPasswordForEmail` whose `pkce_` recovery link verifies with type `recovery`. All pass.
- E-mail-change links: the portal has no e-mail-change flow (no `updateUser({ email })` anywhere), so there's nothing to break. Not tested.
- E2E smoke: 10 passed (the invite → recovery-`verifyOtp` journey and the staff 2FA login run in a real browser on the PKCE client). The explicit "reset still works" browser test lands in `open-sign-up.spec.ts` in slice 30, so the smoke count becomes 13 there.
- **To the lead (stop list item 9, informational):** `e2e/tests/invite-onboarding.spec.ts` AC 25 inserted a bare `auth.users` row to stand for an old staff invite. Since slice 2 such a row is a signed-up `user`, so it no longer showed on the staff page. The fixture now carries `account_role: tutor`, as every real staff invite does. Same intent, fixture only. I should have run E2E in slice 2; it was caught here.

## Slice 12 — sign-up status and the admin switch

- `admin_set_sign_up_open`'s UPDATE needed `where id`: API sessions run with `pg-safeupdate`, which refuses an UPDATE without a WHERE (pgTAP, as `postgres`, didn't notice; INT through PostgREST did). Fixed in the migration.
- pgTAP-OS: status open, busy (15 in 24 h), old rows ignored, closed (switch off or row missing); the switch is admin-at-aal2 only (tutor and aal1 admin → `not_admin`), null → `invalid_input`, no-ops write no audit, real changes audit `sign_up_closed` / `sign_up_opened` with no target.
- INT: closed by the seeded admin at aal2 → `signUp` 429 `sign_up_closed`, no account, no mail; user and staff still sign in; a tutor can't reopen; reopening works.

## Slices 13–15 — guards, list and promote, sign_up_guard_ready

- Slice 13: `complete_onboarding`, `my_onboarding` and `admin_set_active` copied from their latest definitions (`20261023110000:38-138`, `20261023100000:195-210`, `20261006004522:366-407`, line numbers re-checked) with one change each. Existing onboarding pgTAP stays green unchanged.
- Slice 14: `admin_list_users` (admin at aal2, newest first, `signed_up_with`, `finished`) and `admin_promote_user` (role first, then the guardian link; keeps password and sessions; audits `parent_linked {promoted_from: 'user', signed_up_with}`). A promoted Google user in an `[oauth]` session reads their child through `parent_children()`.
- Slice 15: `sign_up_guard_ready()` returns a bare `true` over PostgREST as `anon` (what `deploy.sh`'s `grep -qx true` needs).
  - [ASSUMPTION] "False after disabling each trigger" can't be simulated: `postgres` doesn't own `auth.users`/`auth.identities`, so it can't `alter table … disable trigger` or `drop trigger`. pgTAP instead drops each trigger through its function (`drop function … cascade`, inside a savepoint) and checks false; the `tgenabled <> 'D'` clause is covered by reading only. Hosted, only `supabase_auth_admin` could disable them.
  - `usage on schema public` comes to `supabase_auth_admin` through PUBLIC as well as its own grant, so the "without usage" case revokes both.
