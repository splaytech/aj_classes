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
