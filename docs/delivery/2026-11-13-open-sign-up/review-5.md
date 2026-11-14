# Review 5: Developer build, open sign-up (`feature/open-sign-up`, `develop...HEAD`)

## Round 1

**Verdict: APPROVED**, with the non-blocking items below. Items 1 to 3 should be fixed before merge. None of them is a security hole.

**Checks I ran myself (I did not take the dev notes' word):**
- Scoped Prettier (tracked files), lint and typecheck: green.
- `pnpm test`: 827 web tests in 92 files, plus 6 e2e-unit, plus 35 `test-deploy-order.mjs` checks. Green.
- `VITE_APP_ENV=production pnpm build`: green.
- `pnpm db:test`: 1204 tests in 20 files. PASS.
- `pnpm test:functions`: 564 `ok`, "All checks passed".
- Bare `pnpm check` fails, but only on the untracked `actionItems.md` and `supabase/.temp/linked-project.json` (Prettier). Bare `pnpm build` needs `VITE_APP_ENV`. Neither comes from the branch.
- Stack left as found: switch open, `private.sign_up_emails` empty, `sign_up_guard_ready()` true, working tree unchanged.

**Spot-checked in a rolled-back transaction:**
- An unmarked e-mail account becomes `user/invited`.
- Confirming it nulls the password and deletes its factor.
- A Google identity insert on that confirmed user raises `identity_link_refused`.
- The hook refuses an incoming `account_role`, a Google `email_verified:false`, an empty Google e-mail and a missing provider.
- Every new function has `search_path=''`. The grants match 03 §3.10 apart from item 7.

**Security pieces that hold:**
- Unknown or `admin` marker maps to `user`, and the column default is `user`.
- The hook checks run in the design's order, under one advisory lock.
- The wipe trigger only fires on a null-to-set change of the confirmed date, for `user/invited`.
- The linking rule. The `amr` allow-list fails closed, and finishing deletes other sessions and factors.
- All four admin RPCs check `is_admin()` (aal2).
- account-admin: claiming the row and then deleting is race-safe against `complete_sign_up`'s row lock. The promotion runs under the admin's own session. Resend and cancel are refused for users.
- `deploy.sh`: the order is gate → `db push` → guard check (5 tries) → functions → secrets → `config push` last → hook post-check. It closes sign-up on failure, and the token is in a 0600 `mktemp` file passed with `-H @file`, never in argv.
- Web: no Supabase or `fetch` call outside `src/services/`, no `any`, no inline styles, no `console.log`. New portal routes sit under `portal-root`'s ErrorBoundary and `/terms` has its own (03 §7.5). PKCE leaves `token_hash` links working.

### Findings

1. **Non-blocking (fix before merge): docs no longer match the build.** Our rule is to fix the earlier doc when a later stage shows it wrong. These are still stale:
   - `03-design.md:647` (§8.1) and `:729` (§10 row 12) still say `signUp` returns 200 for a confirmed address. It returns `422 user_already_exists`.
   - The linking rule in 03 §3.6 (around line 185) and DEC-OS-5 in `release-notes.md` leave out the `p.is_active` condition the code has (`20261114100100_open_sign_up.sql:197`).
   - The Privacy draft in 03 §7.9 (`03-design.md:634`) still has the two sentences the developer corrected.

   **Fix:** update those lines, and the ADR-0011 text if it repeats them.

2. **Non-blocking: AC-46 / AC-12 page behaviour breaks if the cap fills, or sign-up closes, while the page is open.** `sign-up.tsx:96-105` only shows "busy" when the status was `busy` when the page loaded. Take a page loaded while open, after the 15th slot goes:
   - a new e-mail gets the hook's 429 `sign_up_busy` and the busy message;
   - an already-confirmed e-mail gets a 422, which is treated as quiet success, so the "Check your e-mail" card shows;
   - an unconfirmed one gets a 200 and the card.

   So the page differs by e-mail, which AC-46 rules out ("shows **everyone** the same neutral message"). Closing the switch mid-session does the same, with the closed card against the sent card. It gives an attacker nothing beyond R1, but the AC says "on the page".

   **Fix:** in `handleSubmit`, re-read `getSignUpOptions()` (or `sign_up_status`) right before `signUpWithEmail`, and show busy or closed for everyone if it changed. Add a unit test where the status is `open` at load and `busy` at submit, once for a "new" e-mail and once for an "existing" one.

3. **Non-blocking: client and server count name length differently, which gives an e-mail-dependent reply.**
   - `sign-up-validation.ts:17` uses `name.length` (UTF-16 units). The hook and `complete_sign_up` use `char_length` (code points).
   - A one-character astral name such as a single emoji passes the browser (length 2). For a new e-mail the hook then refuses it with `invalid_name`, which shows as a field error. For an existing e-mail the 422 comes first, so the sent card shows.

   **Fix:** use `[...name].length` (as in `Array.from`) for the 2–100 check, and add a test case.

4. **Non-blocking: `sign_up_guard_ready()` doesn't check the privileges the guard needs at run time on the hosted project.**
   - The `auth` tables are owned by `supabase_auth_admin`. Locally, `postgres` has UPDATE and DELETE on them through grants.
   - Earlier migrations never write to `auth.*`. These are the first to do so (`:38`, `:236`, `:372-373`).
   - If hosted `postgres` lacks DELETE on `auth.mfa_factors` or `auth.sessions`, the migration still succeeds and the guard still reads true. Then every confirmation link fails (the wipe trigger raises) and every finish step fails, while sign-up is publicly open. That fails closed, so it isn't a security problem, but it is a broken release.

   **Fix:** add `has_table_privilege('postgres', 'auth.mfa_factors', 'DELETE')`, the same for `auth.sessions` DELETE and `auth.users` UPDATE, to `sign_up_guard_ready()` (`:739-768`), with pgTAP cases. Also list "hosted `postgres` DML on `auth.mfa_factors`/`auth.sessions`" under "What wasn't verified" in `release-notes.md`.

5. **Non-blocking: the `deploy.sh` post-check is narrower than the claim in its header.**
   - Under `set -e`, a failed `supabase config push` (`deploy.sh:269`) ends the script without closing sign-up and without the post-check.
   - `auth_hook_is_on` (`:156-160`) checks only the hook, not that confirmations are on.
   - If confirmations didn't apply, an e-mail sign-up would be confirmed when it is created. The wipe trigger never fires on insert, so a password typed by someone who never proved the mailbox would sign in (AC-14). The finish step still refuses that session.

   **Fix:** use `if ! run supabase config push …; then close_sign_up; fail …; fi`. Extend the `jq` check with `and .mailer_autoconfirm == false and .disable_signup == false`. Add one fake-curl case to `test-deploy-order.mjs`.

6. **Non-blocking (nit): leftover doc comments.**
   - `supabase/functions/account-admin/handlers/accounts.ts:125`: the old `/** Removes an account that was only just created (undo)… */` now sits above `isUnfinishedSignUp`, not `deleteAccount`.
   - `apps/web/src/services/families.service.ts:114`: the old `/** Invites a new parent… */` is stacked on top of the new block.

   **Fix:** move the first one back above `deleteAccount` and delete the second.

7. **Non-blocking (nit): `service_role` can execute `hook_before_user_created`.** That comes from the default privileges. 03 §3.10 says "–". It's harmless, since `service_role` can do anything anyway, apart from using up cap slots. **Fix:** add `service_role` to the revoke at `:166`, or change the table in 03.

### Developer assumptions (05-dev-notes)

- **422 `user_already_exists` for confirmed e-mails: acceptable, no Product Owner question needed.** The page shows the same card (`sign-up.service.ts:57,72`), and the INT run confirmed it for all 8 AC-12 account kinds with no change and no mail. The raw-reply difference is exactly R1, which Saurabh accepted in Decision 6. Offering `[auth.sms] enable_confirmations = true` as optional hardening is right; leave it as Saurabh's choice. Still needs the doc fix in item 1 and the race in item 2.
- **Google link also requiring `is_active`: acceptable.** Stricter, refuses nothing legitimate, covered by pgTAP. Record it in 03 and DEC-OS-5 (item 1).
- **The two Privacy wording changes: acceptable as drafts, they need Saurabh.** Both are already in his wording approval (`release-notes.md` step 1).
- **`invite-onboarding.spec.ts` fixture now carries `account_role: tutor`: acceptable.** Real invites made before this release keep their stored `tutor` profile; the slice 3 migration test covered this.
- **The rest are acceptable:** INT empties the cap (local only); own message for control/bidi characters in a name; the callback shows the code exchange's own error; the parent-heal retry path; the `invite.html` condition order; "Security notice" counts as an account e-mail.

**Release-day note, already covered:** between `db push` and the functions deploy, the old account-admin would create staff invites with no marker, which would become `user` accounts. `release-notes.md` §3 says "No staff, student or parent invites while you do this", so keep that line.

## Lead note

All seven findings go back to the Developer in one fix round before stage 6. Items 4 and 5 are taken too: each would leave a broken or weaker release that only shows on the hosted project.

## Round 2

**Verdict: APPROVED.** All seven round 1 findings are fixed at `8a33156`, each has a test, and nothing new needs fixing before merge.

**Checks run at `8a33156`:** lint and typecheck green; `pnpm test` 832 web tests in 92 files (up from 827); 39 `test-deploy-order.mjs` checks `ok` (up from 35). `db:test`, `test:functions` and e2e were not run (the Tester and Security were using the stack); the new pgTAP cases were read, not run.

**Finding by finding:**
1. Docs: fixed (03 §3.6, §3.7, §5, §7.9, §8.1, §10 row 12; `release-notes.md` DEC-OS-3, DEC-OS-5, "What wasn't verified"; ADR-0011). One leftover phrase; see new finding 1.
2. Page race: fixed. The page re-reads `getSignUpOptions()` just before sending (`apps/web/src/routes/portal/sign-up.tsx:105`); four unit tests (open at load, busy or closed at submit, new and existing e-mail). The remaining sub-second gap is covered by R1 (`00-decisions.md:17`): once sent, GoTrue answers a confirmed e-mail with 422 before the hook runs, and anyone exploiting that window could call the raw API anyway.
3. Name length: fixed (`apps/web/src/lib/sign-up-validation.ts` counts code points; tests for 1, 2, 100, 101 emoji).
4. Guard rights: fixed. `private.can_write_auth_tables` (`20261114100100_open_sign_up.sql:740-751`) checks DELETE on `auth.mfa_factors`, DELETE on `auth.sessions`, UPDATE on `auth.users`; `sign_up_guard_ready()` requires it (`:776`); pgTAP (`open_sign_up.test.sql:612-619`) swaps in a false helper inside a savepoint and sees the guard turn false.
5. `deploy.sh`: fixed. A failed `config push` closes sign-up and fails loudly (`deploy.sh:274`); the post-check needs `mailer_autoconfirm == false and disable_signup == false` (`:163`); fake-curl tests cover a failed push and autoconfirm on.
6. Stray comments: fixed (`accounts.ts:204`, `families.service.ts:114`).
7. `service_role`: revoked (`:166`), with a pgTAP check and the 03 §3.10 table updated.

### Findings

1. **Non-blocking (nit): "the fake reply" is still in the docs** at `03-design.md:36`, `:381`, `:729` (§10 row 10), `02-architecture.md:87`, `04-plan.md:464`. **Fix:** reword to match §8.1 (422 `user_already_exists`, same card).
2. **Non-blocking (nit): the `disable_signup == false` half of the post-check has no test** (`test-deploy-order.mjs:57` always returns `false`). **Fix:** add a `FAKE_DISABLE_SIGNUP` case like `FAKE_AUTOCONFIRM`.
3. **Non-blocking (note, no change): a failed re-read shows the closed card** (`sign-up.tsx:105`) and the typed values are lost. Fails closed and is the same for every e-mail, so acceptable.

## Lead note (round 2)

Stage 5 gate passed. Nits 1 and 2 go to the Developer in the same batch as any 6b Security findings.

## Round 3 (fix batch 2, `8a33156..84d2691`)

**CHANGES_REQUESTED.** One blocking issue, in the 7-day clean-up. Every other fix in batch 2 was done as asked.

**Checks run at `84d2691`:** lint and typecheck green; `pnpm test` 843 web tests in 93 files plus e2e-unit; `test-deploy-order.mjs` 50 `ok` (up from 39). `format:check` flags only the untracked `actionItems.md` and the git-ignored `supabase/.temp/linked-project.json`. Not run: `db:test`, `test:functions`, e2e (new pgTAP cases read, not run).

**Verified:** Security 3 (no `--password`; `SUPABASE_DB_PASSWORD` exported; 0600 `--env-file` removed by the EXIT trap; quote/newline refused; tested). Security 4 (dialog warning). Security 5 (`otp_length = 8`; `emailCodeLength` on the account, join and finish fields; `reauthentication.html` states no length; TOTP stays 6 in `TwoStepCodeForm`, `two-step-setup`, `local-dev-two-step`, `[auth.mfa.phone]`; mobile has only `verify_totp_screen.dart` `maxLength: 6`). Security 6 (post-check covers Turnstile, `email_sent`, Google, manual linking, anonymous; one test each). Security 9 (no pre-fill; `btrim` with pgTAP). Security 10 (`enable_confirmations = true`; in GoTrue v2.197.0 its only other effect is that `PUT /user {phone}` now needs SMS confirmation, which fails with no provider: a side benefit). Review-5 round 2 nits 1 and 2. Stage 6a rulings (AC-12, AC-27, AC-56, D8). Tester bugs (Finish retry still safe since `complete_sign_up` needs `password_set_at >= session start`; Users page unknown status shows a retry and no switch; `invalid_name` shows `PROFILE_VALIDATION.nameLength`). Clean-up job deletes only `role='user'`, `status='invited'`, null `email_confirmed_at`, profile older than 7 days; staff, parents, students and confirmed users are never deleted; `sign_up_emails` untouched; no delete triggers on `profiles` or `auth.users`.

### Findings

1. **Blocking. The clean-up can't delete a deactivated sign-up, and one such row stops the whole job permanently** (`20261114100100_open_sign_up.sql:800-826`, `account-admin/handlers/set-active.ts:34-37`, `open_sign_up.test.sql:629`, `:644`).
   - (a) Deactivation confirms the e-mail (`email_confirm: true`), so the job never matches a deactivated row, yet the R4 Watch line (`release-notes.md:34`) tells the admin to deactivate them because "unconfirmed ones are deleted after 7 days anyway". `03-design.md:776` "(deactivated or not)" is also untrue.
   - (b) `admin_set_active` writes `audit_log(target_id = user)` before the ban/confirm step; `audit_log_target_id_fkey` is `NO ACTION`. If the ban fails and nobody retries, the row stays deactivated, unconfirmed and referenced; eight days later `delete … using` raises 23503 and rolls back the whole statement, every day, silently.
   - The pgTAP fixture at `:629` makes a deactivated row with no audit entry, which the real path never produces.
   - **Fix:** either leave unconfirmed rows alone (change the Watch line; add `and p.is_active` and a `not exists` audit_log guard so one row can't stop the job), or delete deactivated never-finished rows too (needs `audit_log` user FKs `on delete set null`). Either way add a pgTAP case that deactivates through `admin_set_active`, and update `03:776` and the release notes.
2. **Non-blocking.** The post-check (`deploy.sh:174-184`) doesn't confirm `.mailer_otp_length == 8` or `.sms_autoconfirm == false`. Add both with a fake-curl case each.
3. **Non-blocking.** The quote/newline refusal runs at step 6 (`deploy.sh:285-291`), after `db push` and functions. Move it into "Checking what's needed"; add a newline test.
4. **Non-blocking (nit).** `apps/web/src/services/auth.service.ts:101` still says "Emails a 6-digit code".

## Lead note (round 3)

Finding 1: take the first option. Audit rows keep their target, the job skips deactivated rows and can't be stopped by one row, and the Watch line no longer tells the admin to deactivate junk sign-ups. Findings 2–4 and the Tester's "a 8-digit" typo go in the same fix batch 3.

## Round 4 (fix batch 3, `84d2691..1562010`)

**APPROVED.** All four round 3 findings are fixed as asked; nothing new blocks the merge.

**Checks run at `1562010`:** lint and typecheck pass; `pnpm test` 844 web tests in 93 files plus e2e-unit; `test-deploy-order.mjs` 53 `ok`, 0 `not ok`. `db:test`, `test:functions`, e2e not run (pgTAP read). The deployed `private.delete_stale_sign_ups()` body on the local stack is byte-for-byte the migration.

**Verified:**
1. Clean-up (`20261114100100_open_sign_up.sql:796-836`): picks only `role='user'`, `status='invited'`, `is_active`, `email_confirmed_at is null`, profile over 7 days; skips rows `audit_log` names as `target_id` or `actor_id`; deletes one row at a time inside `begin … exception when others` with a warning, so no exception escapes; `audit_log` FKs unchanged. pgTAP (`open_sign_up.test.sql:642-685`): real `admin_set_active` audit row; half-finished deactivation kept; deactivated-then-reactivated kept; deactivated without audit kept; a row blocked by a test FK table kept while another is deleted, then deleted next run. `03:776`, `release-notes.md:34`, `01` AC-56 and `00-decisions.md` R4 agree with the code.
2. Post-check (`deploy.sh:179-187`) requires `mailer_otp_length` = configured `otp_length` (8) and `sms_autoconfirm == false`; one failing case each; dry-run text lists them.
3. Secret refusal runs at `deploy.sh:221-240`, before step 1; quote and newline tests assert no calls and no `1/7`.
4. `codeSent` says "an 8-digit"; `auth.service.ts:101` fixed; a test rejects `a 8-digit` in `@/constants`; remaining "6-digit" strings are TOTP only.

### Findings

1. **Non-blocking. Correction to round 3 finding 1(b):** `audit_log_actor_id_fkey` and `audit_log_target_id_fkey` are `ON DELETE SET NULL` (`20261006004522_staff_accounts.sql:82,87`, same on the local DB), not `NO ACTION`. The old job would not have stopped; it would have deleted a half-deactivated sign-up and silently cleared its audit target. The chosen fix still covers it (the `not exists` guard keeps audit targets); the per-row handler now guards against FKs no current table has.
2. **Non-blocking (nit).** `03-design.md:776` "audit rows keep their target" holds only because of the `not exists` guard; say so in the comment at `20261114100100_open_sign_up.sql:800-802`.

## Lead note (round 4)

Stage 5 gate passed. Round 3 finding 1(b)'s mechanism was wrong (SET NULL, not NO ACTION); the real risk was silent loss of audit targets, which the guard closes. Nit 2 goes to the Developer with batch 4.

## Round 5 (batch 4, `1562010..5e92ee6`): lead check

**APPROVED.** Small diff (8 files), read by the lead, not a fresh reviewer.
- `a55579f`: the `Staff` badge is gone from `reauthentication.html` (review-6a item 10).
- `5e92ee6`: the eligibility rule moved into `private.is_stale_sign_up(uuid)` (security definer, `search_path = ''`, execute revoked from public, anon, authenticated). The per-row delete repeats it (`delete … where u.id = stale and private.is_stale_sign_up(u.id)`) and counts only when `found` (security 06 finding 12). The comment says the audit check is what keeps audit targets, since the FKs are `ON DELETE SET NULL` (round 4 nit). Under READ COMMITTED each plpgsql statement takes a fresh snapshot, so the re-check sees a confirmation or deactivation committed after the loop query.
- Developer-reported: scoped full check green (web 844), `pnpm db:test` 1225. The Tester's run re-runs every suite.
