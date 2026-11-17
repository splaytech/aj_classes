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

## Slice 16 — access sweep (pgTAP-AX)

- `open_sign_up_access.test.sql`: 204 checks. On the local seed (3 classes, 6 students, 8 assignments, 8 outbox rows…), a finished user in an `[otp]` session and again in an `[oauth]` session (AC-55): 0 rows from every AC-26 table (plus `enquiry_rate_limits`); only their own `profiles` row; every insert, update and delete refused or changes nothing; a direct update of each `profiles` column refused; `storage.objects` lists nothing and an avatar upload is refused; the pin of the 30 `public` functions `authenticated` can execute; each called with seed ids raises or returns nothing, except `am_i_admin` (false), `my_has_password` (own), `sign_up_status` and `sign_up_guard_ready` (public).
- AC-29: a user can't be a guardian (`not_a_parent_account`) or a student's account (`not_a_student_account`); after publishing drafts, returning marked work and running the due-tomorrow queue for every due date, no outbox row is for a user. AC-30: `admin_list_staff` and `admin_email_problems` never list a user; no student points at one.
- Checked by hand (not committed) that the sweep can fail: as the admin, the same helpers see classes, `admin_list_users` and `admin_list_staff` rows; and every call in the sweep resolves (no undefined-function or syntax error hiding behind "it raised").

## Slice 17 — invites replace an unfinished sign-up

- `accounts.ts`: `isUnfinishedSignUp`, `replaceUnfinishedSignUp` (race-safe claim, then `deleteUser`, restore on failure) and `clearForInvite` (shared by the three invite handlers). `invite.ts` now uses `findAccountByEmail`. `invite-student` gives `already_exists_user` for a finished user. `resend-invite`/`cancel-invite` give `not_allowed` for any user.
- INT: staff, student and parent invites each replace an unfinished sign-up (the old confirmation link dies, the invitee gets the invite's role, the invite redeems); the staff audit has `replaced_sign_up: true`; finished user → `already_exists` (staff) / `already_exists_user` (student); deactivated sign-up → `already_exists` for all three; AC-13 holds.
- **Surprise (affects AC-12, AC-13 raw replies):** for an address that already has a **confirmed** account, GoTrue answers `signUp` with **`422 user_already_exists`**, not 03's fake 200 user. Cause: `signup.go:293` returns it when `Mailer.Autoconfirm || Sms.Autoconfirm`, and `[auth.sms] enable_confirmations = false` makes `Sms.Autoconfirm` true. Nothing is created, changed or sent, so the outcome holds; only the raw reply differs, which R1 (accepted, Decision 6) already covers.
  - [ASSUMPTION] Smallest choice: `signUpWithEmail` treats `user_already_exists` as success, so the page shows the same "Check your e-mail" card (AC-10/AC-12 on the page). No config change.
  - **For the lead:** setting `[auth.sms] enable_confirmations = true` would make GoTrue send its fake 200 instead (there is no SMS provider and SMS sign-up stays off). It changes a hosted Auth setting the design didn't list, so I didn't do it. Offer it as hardening of R1.

## Slice 18 — promotion in invite-parent

- `accounts.ts`: `syncAccountRole` and `signUpFacts`; `AccountRecord` now carries `full_name` (the confirm message shows it).
- `invite-parent`: finished user → `needsConfirmation {userId, fullName, signedUpAt, signedUpWith}`; `confirmUserId` → `admin_promote_user` under the admin's own aal2 session, then `syncAccountRole` (`role_sync_failed` if that fails); a different or no-longer-finished account → `promotion_changed`; an existing parent is re-synced first (heals a failed promotion).
  - [ASSUMPTION] A retry that still carries `confirmUserId` for an account that is already a parent goes down the healing parent path instead of `promotion_changed`, so pressing the button again always heals. A `null` `confirmUserId` counts as absent.
- INT: needsConfirmation with method and date; wrong account → `promotion_changed`; confirm → `promoted`, no mail, parent and linked, `app_metadata.account_role = parent`, audit `parent_linked {promoted_from: user}`, password still signs in; a forced app_metadata failure (a temporary local trigger on `auth.users`, always dropped) → `role_sync_failed` with the DB step kept, and a plain retry heals it.

## Slice 19 — set-active for users, the AC-12 matrix, AC-29

- `set-active`: deactivating a user whose e-mail is unconfirmed also sends `email_confirm: true` with the ban, in the same `updateUserById` (S4(b) showed Auth would otherwise keep mailing it).
- INT: finished and unconfirmed users are banned and deactivated; the unconfirmed one is now confirmed; reactivate unbans and the password works again; audits `deactivated`, `reactivated`.
- **AC-12 raw replies, all eight:** admin, tutor, student, parent, invited, finished user, deactivated finished, deactivated unfinished → **`422 user_already_exists`** (see slice 17), with name, role, status, password hash and Mailpit count unchanged. The page shows the AC-10 card for it (slice 20/23).
- **AC-29:** a user's mailbox held "Confirm your e-mail for AJ Classes" and **"Your password was changed"** (Auth's security notice, on for every account since R2a G19). No portal e-mail. [ASSUMPTION] The security notice counts as an account e-mail. Consequence for slice 27: 03's Privacy draft says a user "gets only account e-mails (confirming your address and password resets)", a closed list that would be untrue; the draft will say "such as confirming your address, password resets and security notices" (for Saurabh's approval).

## Slices 20–25 — web

- Slice 20: services as 03 §7.2, plus `user_already_exists` treated as a quiet success (slice 17 finding). `AppRole` now includes `user`, so the `Record<AppRole, …>` maps (home, nav, labels, badge) got their `user` entries in this slice to keep the typecheck green; slice 21 added the pages behind them.
- Slice 21: `PublicPostsList` moved out of `routes/posts.tsx` unchanged; the route-walk test fails if a new layout appears under `member-layout` without an entry in its area map.
- Slice 23: a small `test/turnstile-stub.tsx` stands in for the Turnstile widget in page tests (a "Pass the check" button, and it counts resets). [ASSUMPTION] A name with control or bidi characters gets its own message (`PORTAL_VALIDATION.nameCharacters`) rather than the length message.
- Slice 24: `LegalLink` moved to `components/portal/LegalLink.tsx` and shared by the invite setup form and the finish step. The finish step has its own "press Finish again" code line (`FINISH_SIGN_UP.codeSent`); `JOIN_PAGE.codeSent` names "Finish setup".
- Slice 25: the callback reads its parameters once at first render and shares the code exchange per code, because React runs effects twice in development (StrictMode) and a code works once. [ASSUMPTION] A failed code exchange (expired or reused code) shows that error's own message (for example "This link has expired…"), not message M; message M is for refusals that come back in the redirect, as 03 says.
- A first `e2e/tests/open-sign-up.spec.ts` test (e-mail sign-up → Mailpit link → Continue → finish → Latest news, plus the database check) was run early, after slice 24, against the real dev server: **pass**. It's committed with slice 30.

## Slice 26 — Terms & Conditions

- `/terms` from 03 §7.9's draft (`TERMS`, headed by the DRAFT comment), own `ErrorBoundary`, pre-rendered (`build/client/terms/index.html`, one `h1`), in the sitemap right after `/privacy`, in `hosting-csp.test.ts`, `public-csp.spec.ts` and `lighthouserc.json`. `LEGAL_LINKS.terms = ROUTES.terms`, so the invite setup form and the finish step now link it (new tab).
- The "Your information" section renders its Privacy link from a `privacyLink` part rather than splitting the sentence.
- CSP sweep: **23** passed (was 21). Each path runs at 375 px and 1280 px, so `/terms` adds 2, not 1 as 04/03 expected. `ci-gates.md` gets 23 in slice 31.

## Slice 27 — Privacy Policy text (draft for Saurabh's approval)

03 §7.9's three edits are in, with two corrections so the policy says only true things (team rule 6), both [ASSUMPTION] for Saurabh to approve with the rest:
1. 03 said "If you sign in with Google, Google gives us only your name and e-mail address." GoTrue's Google provider also stores the profile picture link (`provider/google.go:120-131`: `Picture`/`AvatarURL` go into `user_metadata`). Now: "Google gives us your name, your e-mail address and a link to your Google profile picture; we use only your name and e-mail address."
2. 03 said a signed-up account "gets only account e-mails (confirming your address and password resets)", a closed list. Users also get Auth's "Your password was changed" notice (slice 19). Now: "account e-mails, such as confirming your address, password resets and security notices".
- "What we collect": "When you register interest, contact us, subscribe, or sign up for a portal account, …" (03's "after 'subscribe,'" didn't fit the sentence as written).

## Slices 28–31

- Slice 28: Admin → Users reads the sign-up status only after `listUsers` succeeded, so a tutor or family member opening the URL sends no further request (the staff-client rule).
- Slice 29: after "Link as parent", a refused or changed promotion goes back to the form with its message; pressing Invite or link again then goes down the healing parent path on the server (slice 18).
- Slice 30: `open-sign-up.spec.ts` has 3 tests (e-mail journey with DB check; Google button with stubbed `/auth/v1/settings` and an intercepted `/authorize` carrying `redirect_to=<origin>/portal/auth/callback` and a `code_challenge`; the callback refusal showing message M; Forgot password with the PKCE client). Smoke: **13** passed; CSP **23**. Afterwards no `e2e-%` rows in posts, enquiries or profiles, `private.sign_up_emails` empty, nothing on 5173.
- **AC-39 rate limit (opt-in `--rate-limit`): not enforceable locally.** GoTrue rate-limits only by a configured header (`GOTRUE_RATE_LIMIT_HEADER`, or `Sb-Forwarded-For` with `SB_FORWARDED_FOR_ENABLED`; `api/middleware.go:72-131`, `sbff/sbff.go:37`), and the local stack sets neither (`docker inspect`). A run of 31 wrong-password sign-ins got no `over_request_rate_limit`. The mode now says "NOT ENFORCED on this stack" instead of failing, and the static check `sign_in_sign_ups = 30` (slice 4) stays. Hosted, Supabase sets the header itself; that check is by hand, after release.

## Slice 33 — final gate and handover

| Check | Before (slice 0) | After |
|---|---|---|
| FULL (scoped Prettier, lint, typecheck, `pnpm test`, production build) | pass; 733 web (79 files) + 6 e2e-unit | pass; **827** web (92 files) + 6 e2e-unit + **35** `test-deploy-order.mjs` checks |
| DB (`pnpm db:test` after RESET) | 834 (18 files) | **1204** (20 files: `open_sign_up` and `open_sign_up_access` new) |
| FN (`pnpm test:functions`, edge runtime restarted) | 413 | **564** (`test-open-sign-up.mjs`: 150) |
| DEPLOY (`test-deploy-order.mjs`) | did not exist | 35 pass |
| E2E smoke | 10 | **13** |
| CSP | 21 | **23** |
| Lighthouse (`lighthouse` + `lighthouse:report`, gate build) | – | pass: 8 pages × 3 mobile runs, thresholds met, 0 `supabase.co` requests; `/terms` 189 KB JS |
| Rate limit (`--rate-limit`, opt-in) | – | **not enforceable locally** (no rate-limit header in local GoTrue); reports "NOT ENFORCED", no account created |

**Browser pass** (a temporary Playwright spec, run once and deleted, never committed): at 375 and 1280 px, light and dark — signed out (`/portal/login` with the Create-an-account link and no Google button, `/portal/sign-up`, `/portal/sign-up/resend`, `/terms`), a finished user (Latest news home, the trimmed Account page, "not allowed" on `/portal/admin` and `/portal/parent`), an unfinished user (confirm page → finish step; `/portal/user` sends them back to `/portal/join`), the admin (Users page lists `user@local.test`, the switch reads open, the dashboard has the Users shortcut), and tutor, student and parent (their homes; "not allowed" on `/portal/admin/users`). Each page: one `h1`, no sideways scroll, no console errors. Then all **23** `sitemap.xml` URLs (with `/terms`): 200, one `h1`, no console errors. 21 tests passed. The only console error seen was Vite's dev-only "504 Outdated Optimize Dep" on a first visit (the README's known reload); the pass ignores that one message. Screenshots were checked by eye for the sign-up page, the finish step, the user home and the Users page.

**Handover state:** stack restarted from the main checkout (`/Users/sjain/dev/work/aj_classes/supabase/functions` mounted), RESET for a fresh seed, `private.sign_up_emails` empty, switch open, `sign_up_guard_ready()` true, nothing on 5173 or 4173.

**Not verified (also in release-notes.md):** the hosted "Before User Created" hook (Saurabh's answer pending); hosted `postgres` rights on the `auth` triggers; a real Google sign-in; the per-IP rate limit; mobile with a user account (Tester); `config push` with Google off needing no Google values on the hosted project.

**Untracked files left alone:** `actionItems.md`, `brand/email/`, `docs/contracts/`, and `docs/requirements/seo-audit-2026-11-14.md`, which appeared during the build and isn't mine.

## Fix round after review-5 (all seven non-blocking findings)

1. **Stale docs.** 03 §8.1 and §10 row 12 now say a confirmed address gets `422 user_already_exists` (shown as the AC-10 card); §3.6 has the `is_active` condition; the §7.9 Privacy draft carries the two corrected sentences; §3.7 and §5 describe the guard's new check and the wider post-check; §3.10 notes the explicit `service_role` revoke. `release-notes.md` DEC-OS-3 and DEC-OS-5, and ADR-0011 (decision 3 and the linking rule), match.
2. **Sign-up page race.** `handleSubmit` re-reads `getSignUpOptions()` right before `signUpWithEmail`: busy shows the busy message and closed shows the closed card, for every e-mail, and nothing is sent. Unit tests: open at load and busy at submit, and open at load and closed at submit, each with a new and an existing e-mail. A tiny window between that read and the sign-up call remains; there the reply can still differ by e-mail, which R1 already covers.
3. **Name length** counts code points (`[...name].length`), as `char_length` does. Tests: one emoji is too short, 100 emoji fit, 101 don't.
4. **Guard and Auth-table rights.** New `private.can_write_auth_tables(role)` (DELETE on `auth.mfa_factors` and `auth.sessions`, UPDATE on `auth.users`), and `sign_up_guard_ready()` requires it for `postgres`. Locally `postgres` holds these by grant from `supabase_auth_admin` and can't revoke them from itself, so pgTAP checks the helper is true for `postgres`, false for `anon`, and that the guard turns false when the helper is replaced (inside a savepoint). Migration edited in place (not pushed anywhere). `release-notes.md` "What wasn't verified" has the line.
5. **`deploy.sh`.** `if ! run supabase config push …; then close_sign_up; fail …; fi`, and the post-check (`auth_settings_are_safe`) also needs `mailer_autoconfirm == false` and `disable_signup == false`. `test-deploy-order.mjs`: a failing `config push` (one PATCH, non-zero, message) and autoconfirm on after the push (one PATCH, non-zero). 39 checks.
6. **Stray comments** moved back above `deleteAccount` (`accounts.ts`) and deleted (`families.service.ts`).
7. **`service_role`** is in the revoke on `hook_before_user_created`; pgTAP checks it can't execute it.

## Fix batch 2 (security 6b, review-5 round 2, Tester 6a, review-6b)

- **Security 3, argv secrets.** `link` and `db push` no longer pass `--password`. The CLI binds `DB_PASSWORD` to the `SUPABASE_` env prefix (viper `SetEnvPrefix("SUPABASE")` + `AutomaticEnv`, `BindPFlag("DB_PASSWORD", …)`), and `deploy.sh` now exports `SUPABASE_DB_PASSWORD`. `secrets set` reads a `mktemp` 0600 `--env-file` that the EXIT trap removes; each value is single-quoted, so the CLI's .env reader takes it literally. [ASSUMPTION] A value containing `'` or a line break is refused with a message rather than escaped. `test-deploy-order.mjs`: no fake ever sees any of six distinct fake secret values in argv; link and db push find the password in env; the env file is `-rw-------` with every value; a quoted value stops the run before `config push`.
- **Security 6 + review-5 r2 nit 2, post-check.** `auth_settings_are_safe` also needs `security_captcha_enabled == true`, `security_captcha_provider == "turnstile"`, `rate_limit_email_sent ==` the `[auth.rate_limit] email_sent` in config.toml, `external_google_enabled ==` `google_enabled`, `security_manual_linking_enabled == false` and `external_anonymous_users_enabled == false` (names from the CLI's OpenAPI `AuthConfigResponse_Output`, as in S1(f)). One fake-curl case each, `FAKE_DISABLE_SIGNUP` included. Deploy test: 50 checks.
- **Security 4.** The promotion dialog shows "Only link an e-mail that is already on this student’s enrolment record, or that you confirmed with the parent you already know. Never link one supplied only in a message." (warning box); the release notes say the same. Unit test.
- **Security 8 (= AC-56).** `private.delete_stale_sign_ups()` runs daily from `pg_cron` (`delete-stale-sign-ups`, `45 17 * * *`, the repo's existing pattern): it deletes `auth.users` rows whose profile is `user`/`invited`, older than 7 days, with `email_confirmed_at` null (cascading to profile, identity and sessions). `can_write_auth_tables` now also needs `postgres` DELETE on `auth.users`. pgTAP: exactly the two stale rows go; a 6-day-old sign-up, confirmed and finished users, staff, parent and student invitees and a parent stay. No existing test pins the full cron list. The Privacy draft doesn't state how long sign-up data is kept, so it is unchanged; the release notes have a line.
- **Security 9, pre-fill half.** The finish step no longer pre-fills an e-mail sign-up's name (a Google sign-up still gets the name from its own Google account). The hook `btrim`s the Google e-mail before the empty check (pgTAP: a spaces-only e-mail is refused). The e2e journey now types the name. The Google name rule half stays deferred.
- **Security 10.** `[auth.sms] enable_confirmations = true`. **Observed:** `signUp` for `user@`, `tutor@` and `parent@local.test` now answers **200 with `identities: []`** and sends nothing (was `422 user_already_exists`). All 8 AC-12 account kinds get 200 in INT, which now requires it. The page shows the same card (the service still treats a 422 as quiet, in case a project has SMS confirmations off).
- **Review-6b, security 5 fixed.** `[auth.email] otp_length = 8`. New `AUTH_LIMITS.emailCodeLength = 8` beside `codeLength = 6` (TOTP); `checkEmailCode` and `PORTAL_VALIDATION.emailCodeInvalid`; `CodeInput` takes a `length` (default 6), and the three e-mailed-code fields (account Change password, invite setup, finish step) pass 8; the Change-password "we emailed you a … code" text uses the constant. `TwoStepCodeForm`, `two-step-setup` and `local-dev-two-step` stay 6. The only template with `{{ .Token }}` is `reauthentication.html` (no length in its text; "staff portal" became "portal", since families and users get it too). `[auth.mfa.phone] otp_length = 6` is for phone MFA, which is off; left alone. Mobile: grep finds only the TOTP field (`verify_totp_screen.dart`, `maxLength: 6`), so no change. Tests: lengths and validators, a guard that config.toml's `otp_length` equals the constant, and the finish form refusing a 6-digit code.
- **Review-5 r2 nit 1.** "the fake reply" is gone from 02, 03 and 04 (now "the quiet reply", 200 with `identities: []`).
- **Tester 6a bugs.** (1) Pressing Finish again after a failed save: `completeSignUp` now goes on past `same_password` (only an earlier press in this flow can have set that password; the server still requires it was set in this session). 03 §10 AC-20 now says the state is reachable from the UI and how it's handled. (2) Admin → Users: a failed status read shows "We couldn't load whether sign-up is open." with Try again, via the new `getSignUpStatus()` (`Result`), and no Close/Open button. The self-service page's fail-closed card is unchanged. (3) A server `invalid_name` on the sign-up page and the finish step shows `PROFILE_VALIDATION.nameLength` ("your"), as the browser check does. Unit tests for each.
- **Docs.** 01: AC-12 reworded (page vs raw reply), AC-27 a permission rule, AC-56 added, D8 moved into v1, change log. 03: §4.1 (`otp_length`, SMS confirmations), §8.1, §10 rows 10, 12, 20 and new 56, §14 (R4, the R1/R2 extension, finding 7 recorded, the Google name rule deferred). Release notes: Watch line for R4, R1 narrowed, R1/R2 extension, deferred Lows, 8-digit codes, the 7-day clean-up.

## Fix batch 3 (review-5 round 3)

1. **Clean-up job (blocking; the lead took option 1).** Deactivating a sign-up confirms it, and `admin_set_active` writes an audit row naming it (an FK with no `on delete`), so batch 2's single `delete … using` could never delete a deactivated sign-up, and one half-finished deactivation (audit row written, ban-and-confirm step failed) would have made the whole statement fail every day. Now: only **active** `user`/`invited`, unconfirmed rows over 7 days old with **no `audit_log` row naming them** (target or actor) are picked, and each is deleted on its own inside an exception block, so a row that still fails is logged (`raise warning`) and kept while the rest go. Audit rows keep their target; the `audit_log` FKs are unchanged. pgTAP: the normal delete; deactivation through `admin_set_active` with the ban step "failed" (unconfirmed, audited) is kept; a reactivated, audited one is kept; a deactivated one is kept; a row blocked by a test-only FK is kept while the job deletes the others, then goes on the next run. Batch 2's note that the job deleted a sign-up "deactivated or not" was wrong; 01 AC-56, 03 §10 row 56 and the release notes now say deactivated ones are kept and block a later invite to that address until reactivated and linked as a parent. The R4 Watch line now says close sign-up, leave unconfirmed sign-ups to the job, and deactivate one only if its owner complains about repeated e-mails.
2. **Post-check** also needs `.mailer_otp_length ==` `[auth.email] otp_length` (8) and `.sms_autoconfirm == false` (names in the CLI's OpenAPI `AuthConfigResponse_Output`). One fake-curl case each.
3. **`deploy.sh` order.** The secrets list is built, and a value with a quote or a line break refused, in "Checking what's needed", before step 1. Tests for both, asserting no command ran. Deploy test: 53 checks.
4. **Nits.** `auth.service.ts` comment says 8-digit; Change password reads "an 8-digit code"; a test fails if any constant says "a 8-digit". The other e-mailed-code strings ("we've emailed you a code", "Please enter the 8-digit code from the email") were already right.

## Fix batch 4 (review-6a item 10, review-5 round 4, security 06 finding 12)

- `reauthentication.html`: no `Staff` badge (signed-up users get this code e-mail from the finish step and Change password). No test reads the template.
- The clean-up's comment now says what review-5 round 4 found: `audit_log`'s FKs are `ON DELETE SET NULL` (checked in the catalogue), so the `not exists` audit check is what keeps audit history pointing at the account. Batch 3's note that they were plain foreign keys was wrong.
- Security 06 finding 12: the conditions moved into `private.is_stale_sign_up(id)`, which picks the rows and is repeated in each row's `DELETE … where id = stale and private.is_stale_sign_up(id)`, so a sign-up confirmed, deactivated or audited while the job runs stays. The count only rises when a row was really deleted. pgTAP: the helper turns false for a row confirmed, deactivated or audited "meanwhile", and the job then leaves it. `pnpm db:test`: 1225.
