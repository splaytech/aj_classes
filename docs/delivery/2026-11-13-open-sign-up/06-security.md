# 06 — Security review: open sign-up (stage 6b)

Security, 14 Nov 2026. Pinned to `8a33156` on `feature/open-sign-up` and reviewed against `git diff develop...8a33156` (119 files). I read 00, 02, 03, 05, review-5, ADR-0011, the migrations, the account-admin handlers, `deploy.sh`, `config.toml`, the templates and the web portal routes and services. I also read the mobile repo's `RoleResolver`, and parts of the GoTrue v2.197.0 source on GitHub (`api.go`, `user.go`, `mail.go`, `magic_link.go`, `apilimiter.go`).

**Verdict: PASS, no Blocking or High findings.** No self sign-up can reach any role other than `user`, and none can read any class, student, family or staff data. Before sign-up opens in production, Saurabh should decide on findings 1 and 2, which are new abuse paths the accepted risks don't cover. Finding 5 (guessing the 6-digit e-mail code) must be fixed before release, and the lead has decided to fix it. Finding 3 is a pre-existing breach of the house rule against secrets in argv, and it is cheap to fix.

**Counts:** Blocking 0 · High 0 · Medium 5 · Low 6 · Info 7. (Round 2, after `review-6b.md`: finding 5 moved from Low to Medium. Round 3: finding 12 added.)

**Round 3, re-checked at `1562010`** (`git show` only; the stack was not migrated or touched):
- Fixed and verified by reading the code: findings 3, 5, 6, 8 and 10.
- Fix batch 3 (`84d2691..1562010`) has one new Low, finding 12. The Info note on swallowed errors is §11.7.
- Still open for Saurabh's decision: findings 1 and 2.

## How I checked (local stack only, nothing left behind)

- I ran read-only catalogue queries for every RLS policy, every function's `security definer`, `search_path` and EXECUTE grants for `anon`, `authenticated` and `service_role`, every trigger on `auth.users`, `auth.identities` and `public.profiles`, and the table grants.
- **Probe 1 (rolled back):** I made a raw `auth.users` insert with no marker. It became `user/invited`. I then confirmed and finished it, and acted as it with `amr [otp]` at `aal2`. It got 0 rows from every `public` table and from `storage.objects`. It read only its own profile. It could not update `profiles.role` (permission denied). `complete_onboarding`, `admin_*`, `parent_*` and `student_*` all refused it.
- **Probe 2 (rolled back):** I called `hook_before_user_created` with crafted events: a missing provider, `phone`, `anonymous`, Google with `"true"`, Google with a whitespace-only e-mail, an HTML-shaped name, and `user_metadata.account_role`. I also inserted a Google identity for the seeded admin, which was refused with `identity_link_refused`.
- **Probe 3 (rolled back):** as the seeded `user@local.test` with real seed student, assignment and question ids, every family, student and admin RPC raised. Inserts into `notification_settings` and `storage.objects` were refused by RLS.
- **State check:** before and after, `private.sign_up_emails` had 0 rows, the switch was open and `sign_up_guard_ready()` returned true. I made no GoTrue sign-ups, no sign-ins and no writes through the API.

## Threat model: public sign-up (v1: e-mail, Google shipped off)

| Asset | Attacker | Main path | Control that holds | Residual |
|---|---|---|---|---|
| Child data (marks, timetable, assignments) | Anyone on the internet | Self sign-up, then escalate | Role fails closed to `user`. RLS and helper functions key on `my_active_role()`. No user-callable path changes `role`. | Getting **promoted by an admin** (finding 4) |
| Staff and admin accounts | Anyone | Google auto-link, or pre-registering a staff address | Linking trigger, confirm-time wipe, invites confirmed at creation | Guessing the e-mailed code (finding 5, Medium, fixed at `1562010`) |
| A parent's future account | Stranger pre-registers the parent's address | Hold a password until the parent confirms | Throwaway password, wipe on confirm, `amr` allow-list, password set in the link session, invite-replace path | Name pre-filled with the stranger's text (finding 9) |
| Resend quota and sender reputation | Anyone with Turnstile solves | Confirmations, resends, e-mail change | Cap of 15 new a day, Turnstile, 60 s per address, `email_sent = 30`/h | R2 (accepted). Cap-fill and bounces (finding 1) |
| Who is a client or staff member | Anyone | Raw replies | Same card on the page | R1 (accepted). E-mail-change oracle (finding 2) |
| Release integrity | Operator error, partial deploy | Sign-up open without the guard | Gate, behaviour check, `config push` last, post-check, close on failure | Post-check gaps (finding 6) |

## Findings

### 1. Medium: 15 Turnstile solves a day close e-mail sign-up for everyone, and random addresses bounce through Resend

- **Where:** `supabase/migrations/20261114100100_open_sign_up.sql:155-160` (the cap counts every allowed new e-mail sign-up), `:419-432` (`sign_up_status` shows "busy" to everyone).
- **Exploit:** Each day, an attacker solves Turnstile 15 times and signs up 15 made-up addresses (no mailbox needed).
  - Every real parent then gets "Sign-up is busy" for 24 hours. Repeating this daily keeps sign-up shut, for about 15 human or solver-service captcha solves a day.
  - The 15 confirmation e-mails, plus resends to the same accounts every 60 s, go to addresses that don't exist.
  - **Bounce rate.** Resends to those 15 addresses can take the whole `email_sent = 30`/h. In about 3.5 hours they can spend most of the day's 100 Resend Free e-mails on hard bounces. A high bounce rate on a new sending domain can get Resend to pause sending. Then invites, password resets and portal e-mails stop too, not just sign-up mail.
  - At `8a33156` the unconfirmed rows never expired. Since batches 2 and 3, a daily job deletes them after 7 days (finding 8).
- **Why it isn't R2:** R2 covers mail outside the cap using up the quota. Nothing in 02, 03 or 00 covers deliberately filling the cap (a denial of service), or bounce reputation.
- **Fix (Saurabh to choose, smallest first):**
  1. Record it as accepted risk R4, with the bounce rate named in the R4 text, so Saurabh accepts that a Resend pause stops invites, resets and portal mail as well. **As built at `1562010`:** R4 in `00-decisions.md` and the `release-notes.md` §6 Watch line say this:
     - If many odd unconfirmed sign-ups appear, close sign-up and check Resend → Suppressions/Bounces.
     - Leave the unconfirmed rows to the 7-day job.
     - Deactivate a row only if its owner complains about repeated e-mails. Deactivation confirms the address (`set-active.ts`) and the job then keeps the row, so it blocks a later invite to that address.

     That advice is correct for the build. My round 1 wording ("deactivate them") would have turned every junk row into a permanent one.
  2. Free the slot when an admin deactivates an unfinished, unconfirmed sign-up, so the admin can undo a fill. This needs a row id or user id on `sign_up_emails`, which the design deliberately avoided (APP 3), so it is a trade-off.
  3. Raise the cap and move to Resend Pro if it happens.

### 2. Medium: the e-mail-change API is a Turnstile-free account-existence oracle and a third-party mail sender (beyond R1)

- **Where:** GoTrue `PUT /auth/v1/user`. It is outside the diff, but it is newly reachable by anyone, because anyone can now get a session. GoTrue v2.197.0 `internal/api/api.go`: `/user` PUT has only `requireAuthentication` and `limitHandler(limiterOpts.User)`, with no `verifyCaptcha`. `internal/api/user.go` around lines 135-141 runs `models.IsDuplicatedEmail` and returns `422 email_exists` before anything is written or sent.
- **Exploit (a), enumeration:** Sign up once with your own mailbox (one cap slot), then confirm it. From that link session, call `PUT /user {"email": X}` for each candidate X.
  - `422 email_exists` means X has an account (staff, student, parent or user).
  - No Turnstile is needed. The only limit is GoTrue's per-IP limiter (`RateLimitOtp`, 30 per 5 min with a burst of 30). That is about 8,600 probes a day per IP, against R1's one captcha solve per probe.
  - Student addresses are minors' addresses.
- **Exploit (b), mail:** a non-duplicate X gets an "email change" e-mail from AJ Classes, again with no Turnstile.
  - It is limited to one a minute per attacking account (`validateSentWithinFrequencyLimit`, `mail.go`) and by the global `email_sent = 30`/h, so it stays inside R2's bound.
  - It is a sender R2 doesn't list.
- **Not run live:** this comes from source. A live probe needs a real session on the shared stack, which the brief ruled out. The Tester could confirm it with one `user@local.test` session, using `PUT /user {email: "admin@local.test"}` and expecting a 422.
- **Fix:** no GoTrue setting turns off self-service e-mail change, and the duplicate check runs before any database write, so a trigger can't hide it.
  - Record it as an extension of R1 and R2 in `00-decisions.md` ("any signed-in account can test whether an e-mail exists, without Turnstile, at about 30 per 5 min per IP; and can send e-mail-change mail within the 30/h limit"), and let Saurabh accept or reject it.
  - If rejected, the only real fixes are a custom Auth domain with a WAF rule on `PUT /auth/v1/user` bodies that contain `email`, which Decision 8 declined for now, or an Auth send-email hook (rejected in the ADR).

### 3. Medium (pre-existing), fixed and verified at `1562010`: the DB password and hosted secrets go on argv in `deploy.sh`

**Verified at `1562010`:**
- `supabase link` (`deploy.sh:254`) and `supabase db push` (`:271`) no longer take `--password`; the CLI reads `SUPABASE_DB_PASSWORD` from the environment.
- `secrets set` uses `--env-file` (`:299`). The file is a `mktemp` file under `umask 077` (`:247`, `:295`) and is removed by the `EXIT` trap (`:249`). Each value is single-quoted (`:297`), and a value with a quote or a line break is refused by name, before step 1 (batch 3).
- No secret value is printed. The line references below are for `8a33156`.

- **Where:**
  - `supabase/scripts/deploy.sh:204`: `supabase link … --password "$SUPABASE_DB_PASSWORD"`
  - `:221`: `supabase db push --password …`
  - `:251`: `supabase secrets set … RESEND_API_KEY=… NOTIFY_WORKER_SECRET=… ZOHO_CLIENT_SECRET=… ZOHO_REFRESH_TOKEN=…`
- **Exploit:** while each command runs, any local process or user can read the values with `ps -axww` (macOS shows every process's argv). This is the same leak class as The School Run Maps key (ways-of-working, 2026-11-08). Only the Management API token is protected, by `-H @file` at `:198-200` and `:160` and `:169`, which is correct.
- **Fix:**
  - Drop `--password` from both calls. The CLI reads `SUPABASE_DB_PASSWORD` from the environment, which is already exported when it comes from `.env.deploy`.
  - For `secrets set`, write the `NAME=value` lines to a `mktemp` file under the existing `umask 077`, call `supabase secrets set --project-ref "$PROJECT_REF" --env-file "$file"`, and remove the file in the existing `EXIT` trap.
  - Update `describe_command`'s dry-run output and the `test-deploy-order.mjs` expectations to match.

### 4. Medium (process): promotion proves the mailbox, not the parenthood

- **Where:** `supabase/functions/account-admin/handlers/invite-parent.ts:44-63` and `:108-125`, and `20261114100100_open_sign_up.sql:685-725`. This is the only path from a self sign-up to child data.
- **Exploit:** a stranger signs up with their own real mailbox and finishes. They then contact AJ Classes ("I'm Aarav's dad, please link my account dad@…"). An admin types that address into "Invite or link a parent". The dialog shows the stranger's self-chosen name and "Signed up with e-mail", the admin confirms, and the stranger reads the child's marks, timetable and tutor comments.
  - Every technical check passes, because the account really does own that mailbox.
- **Fix:**
  - Add one line to the promotion dialog (`03 §7.7`) and to `release-notes.md`: "Only link an e-mail that is already on this student's enrolment record, or that you confirmed with the parent you already know. Never link one supplied only in a message."
  - Optionally, show the student's existing guardian e-mails beside the confirm button.

### 5. Medium (was Low), fixed and verified at `1562010`: the 6-digit e-mailed code can be guessed, which confirms a pre-registered address

- **Where:** `supabase/config.toml:214` (`token_verifications = 30`) and `:241-243` (`otp_length = 6`, `otp_expiry = 3600`). Also `PortalField.tsx:217`, where the e-mail code field shares `AUTH_LIMITS.codeLength` with the TOTP field.
- **Exploit:** GoTrue accepts `POST /verify {type: "signup", email, token}` with the 6-digit code that exists alongside the link. Our template doesn't show the code, but the API still accepts it.
  - An attacker pre-registers the real parent's address, `parent@x`, and guesses codes. `token_verifications = 30` per 5 min per IP gives about 360 guesses an hour per IP.
  - A resend restarts the hour. It costs one Turnstile solve and sends one e-mail to the victim, so the attempts add up across hours. Each hour gives about 360 / 10^6 per IP, independently of the others.
  - That is about **23% within a month from 1 IP**, and about **45% within a week from 10 IPs**. Round 1 said "about 1,400 IPs for 50%", which counted only a single code's one-hour life and understated the risk.
  - On success, the attacker holds a confirmed session for `parent@x` and finishes the sign-up. Every later check sees an account that "proved" the mailbox.
  - **It also defeats finding 4's safeguard.** The address *is* the one on the enrolment record, so the admin's "only link a known e-mail" check passes and promotion hands over the child's data.
  - The ADR's claim that "every finished account has proven the mailbox" rests on this code being unguessable.
- **Decision (lead, `00-decisions.md` stage 6b, after `review-6b.md`):** fix it, not defer it. E-mailed codes go to 8 digits (`otp_length = 8`), with their own length constant on the web instead of the shared `AUTH_LIMITS.codeLength`. The authenticator (TOTP) code stays at 6, and the mobile app, which has only a TOTP field, is unaffected.
  - With 8 digits, the same attacks drop to about 0.26% (1 IP, a month) and about 0.6% (10 IPs, a week).
  - Shortening `otp_expiry` on its own wouldn't help, because it doesn't change the guess rate.
  - **Verified at `1562010`:**
    - `config.toml:244`: `[auth.email] otp_length = 8`. The other `otp_length = 6`, at `:354`, is outside `[auth.email]`.
    - `app.constants.ts:90-91`: `codeLength: 6` for TOTP and `emailCodeLength: 8` for e-mailed codes.
    - The three e-mailed-code fields use `emailCodeLength`: `FinishSignUpForm.tsx:175`, `account.tsx:229` and `join.tsx:279`, with validation in `portal-validation.ts:28`.
    - TOTP still uses `codeLength` (`TwoStepCodeForm.tsx:68`, `portal-validation.ts:35`).
    - The `deploy.sh` post-check now also requires the hosted `mailer_otp_length` to equal `[auth.email] otp_length`. If that value can't be read, `--argjson` fails and sign-up is closed, so it fails closed.

### 6. Low, fixed and verified at `1562010`: the `deploy.sh` post-check doesn't cover the other settings the safety argument relies on

**Verified at `1562010`:** `auth_settings_are_safe` now checks every field listed below, plus `mailer_otp_length` and `sms_autoconfirm == false`. Expected values come from `config.toml` through `config_value`. Any jq or curl failure closes sign-up. The field names follow the CLI OpenAPI (05 dev notes); they can only be proven against hosted on the first real run.

- **Where:** `supabase/scripts/deploy.sh:159-164` (`auth_settings_are_safe`).
- **Gap:** it checks the hook, `mailer_autoconfirm` and `disable_signup`, but not:
  - Turnstile on (`security_captcha_enabled`, `security_captcha_provider == "turnstile"`), which R1, R2 and finding 1 depend on;
  - `rate_limit_email_sent` (R2's 30/h bound);
  - `external_google_enabled` matching `google_enabled`;
  - `security_manual_linking_enabled == false` and `external_anonymous_users_enabled == false`. The trigger and the hook back these up, so they are defence in depth.
- **Exploit:** a Dashboard edit or a CLI push quirk leaves captcha off. Sign-up opens, and the cap is the only brake on mass sign-ups and third-party mail.
- **Fix:** extend the `jq -e` expression with those fields (names as in `UpdateAuthConfigBody`, see 05 S1(f)), and add one fake-curl case.

### 7. Low: signed-up users can read `posts.author_id`, which an earlier review deliberately hid from the public

- **Where:** `20261024120000_posts.sql:24` (`"Anyone reads posts"`, `using (true)` for `authenticated`), plus full-table `SELECT` for `authenticated`. `20261025110100_posts_public_columns_and_trim.sql:8-9` limited `anon` to public columns "never author_id".
- **Exploit:** with open sign-up, "authenticated" now includes anyone. A signed-up user can run `select author_id from posts` and get staff profile UUIDs. RLS on `profiles` makes those UUIDs useless today, which is why this is Low. It still undoes a stated hardening decision.
- **Fix:** either accept it and note it in `03 §14`, or make the admin page read posts through an `admin_list_posts()` RPC. Then `revoke select on public.posts from authenticated; grant select (id, created_at, updated_at, title, body) on public.posts to authenticated;`.

### 8. Low, fixed and verified at `1562010`: unconfirmed sign-ups are never removed

**Built in v1:** the lead moved D8 into v1, and it is now AC-56. Verified at `1562010`:
- `private.delete_stale_sign_ups()` (`20261114100100_open_sign_up.sql:803-836`) runs daily at 17:45 UTC through `cron.schedule('delete-stale-sign-ups', …)` (`:842`).
- It deletes only rows that are:
  - role `user`, `status = 'invited'` and `is_active`;
  - `email_confirmed_at is null`, and created more than 7 days ago;
  - not pointed at by any `audit_log` row as actor or target.
- It deletes one row at a time, each in its own sub-block, so one row that can't be deleted is logged and the rest still go.
- **Deactivated sign-ups are kept.** `set-active` confirms an unconfirmed sign-up when it deactivates it, and the job requires both `is_active` and unconfirmed, so it skips them. Their `deactivated` audit row also keeps them.
- EXECUTE is revoked from `public`, `anon` and `authenticated` (`:838`). `sign_up_guard_ready()` now also requires `postgres` to hold DELETE on `auth.users` (`:749`), so the job can't fail silently on hosted.

One residual is finding 12. The round 1 text follows.

- **Where:** no clean-up exists in the migration or in cron.
- **Exploit:** anyone can make up to 15 rows a day at any address, each holding a name of the attacker's choosing, forever.
  - It clutters Admin → Users.
  - It is personal data that was never confirmed (APP 11.2: destroy what is no longer needed).
  - Combined with finding 1, a deactivated junk row also blocks a future invite to that address (`clearForInvite` gives `already_exists`).
- **Fix:** a daily `pg_cron` job (the repo already uses pg_cron) that deletes `auth.users` rows with `email_confirmed_at is null` and a `user/invited` profile older than 7 days. Deleting from `auth.users` cascades to the profile.

### 9. Low: Google sign-ups skip the name rule, and a stranger's name is pre-filled for the real owner

- **Where:**
  - `20261114100100_open_sign_up.sql:138-145`: the Google branch returns before the `is_valid_full_name` check at `:151`, so `handle_new_auth_user` (`20261023100000_invite_onboarding.sql:49`ff) stores whatever Google sends. Probe 2 confirmed that a name containing U+202E is let through.
  - `:140`: the e-mail check isn't trimmed, so `" "` passes. That is harmless in practice, because Google always sends a real address.
  - `FinishSignUpForm.tsx:48`: an e-mail sign-up's finish form pre-fills `full_name` from the first sign-up, which may be a stranger's.
- **Exploit:** a bidi or control-character name shows misleadingly on Admin → Users and in the promotion dialog before the person finishes. A parent whose address was pre-registered sees text the stranger chose (up to 100 characters, for example a phone number to call) pre-filled as "their" name. React escapes everything, so there is no XSS.
- **Fix:**
  - In the Google branch, apply the same name rule and fall back to `''` instead of refusing: `complete_sign_up` validates the name again anyway.
  - Use `btrim` on the e-mail before the empty check.
  - Optionally, don't pre-fill the name on the finish step for e-mail sign-ups.
  - This can wait until Google is switched on, except the pre-fill change.

### 10. Low, fixed and verified at `1562010`: tighten R1 cheaply

**Verified at `1562010`:** `config.toml:303` sets `[auth.sms] enable_confirmations = true`, and the `deploy.sh` post-check requires `sms_autoconfirm == false`.

- **Where:** `supabase/config.toml:292-296` (`[auth.sms] enable_confirmations = false`).
- **Detail:** per 05 slice 17, this makes GoTrue answer `422 user_already_exists` for a confirmed address, instead of its fake 200, so the raw-API oracle is trivial to read.
- **Fix:** set `[auth.sms] enable_confirmations = true`, as the Developer offered. SMS sign-up stays off and no SMS provider exists. Saurabh's call, since it changes a hosted setting the design didn't list.

### 11. Info: verified as correct (no action)

1. **Role fail-closed.**
   - `role_from_app_metadata` maps a missing marker, an unknown one and `admin` to `user` (`:12-24`), and the column default is `user`.
   - `app_metadata` can't be written by a user: GoTrue's `UserUpdate` refuses `AppData` for non-admins.
   - The hook also refuses an incoming `account_role` (`:134`). `user_metadata.account_role` gets through, but nothing reads it: web, the edge functions and the mobile `access_state_service.dart:59` read `appMetadata` only.
   - `admin_set_role` refuses any non-staff target. `handle_auth_role_assigned` needs a service-role `app_metadata` change.
2. **Hook.**
   - It is `security definer` with `search_path = ''`. EXECUTE is held by `supabase_auth_admin` only; `anon`, `authenticated` and `service_role` all show `f`.
   - Its advisory-lock key (`open_sign_up.new_account`) is distinct from `r2a.admin_changes`. No dynamic SQL.
   - It is called for `signUp`, `/otp`/`/magiclink` (which go through `a.Signup`, `magic_link.go`), OAuth and `id_token` (05 S1d). Admin `createUser` skips it, and only `service_role` can call that.
   - Phone, anonymous and providerless events are refused (probe 2).
3. **Linking trigger** (`:178-213`): a Google identity on the seeded admin is refused (probe 2), and so is every non-`email`, non-`google` provider. The wipe trigger's `WHEN` clause fires only on a null-to-set change, for `user/invited`.
4. **The `complete_sign_up` race with `replaceUnfinishedSignUp`** (`accounts.ts:136-159`): both act on the same row under READ COMMITTED. The claim's `UPDATE … where status='invited' and is_active` re-evaluates after the `FOR UPDATE` lock is released, so exactly one side wins. The `amr` list fails closed (an empty list, a missing claim and `password` all refuse).
5. **Web.**
   - PKCE (`supabase.client.ts`): the callback uses only the query `code`, wipes the address on mount (`auth-callback.tsx:79`) and navigates to a fixed route (`:84`), so there is no open redirect.
   - Error text is mapped to fixed messages and never rendered raw.
   - A forged `?code=` fails without the verifier, so there is no login CSRF.
   - The production redirect allow-list (`config.toml:511`, `:513`) includes `staging.ajclasses.com.au`, because staging and prod share one project. PKCE keeps that unexploitable: the code verifier stays on the origin that started the sign-in, so a code that lands on staging can't be exchanged anywhere else.
   - `Referrer-Policy: strict-origin-when-cross-origin`, and `/portal/:path*` is `no-store` with the portal CSP.
   - Google is a top-level navigation, so it is correct that the CSP wasn't widened (no Google script or image is loaded).
   - Names render through JSX on Admin → Users and in the dialog. `notifications/template.ts` escapes every field.
   - The confirmation template contains no `.Data` (no name) and uses `.SiteURL`, not `.RedirectTo`, so our domain can't relay attacker text or redirects.
6. **Secrets.** I found no live secret anywhere in the diff.
   - The only values are test fakes (`dry-run-not-a-secret`, `a long enough password`, `local-password-123` in the seed), Cloudflare's documented always-pass Turnstile test secret (pre-existing, local only), the public project ref and publishable key, and `hello@ajclasses.com.au`.
   - E-mail addresses use `local.test`, `test.local` or `example.com`.
   - `supabase/.env.deploy` is git-ignored. No dependency changes.
7. **Lower-order notes.**
   - The sign-up confirm link's `token_hash` stays in history until Continue, which is the same scanner-safe pattern as recovery.
   - The `.env.deploy` loader exports any unset `[A-Z_]+` name, `BASH_ENV` and `HTTPS_PROXY` included. That is the operator's own file, so it is the same trust level.
   - Whether `supabase config push` prints hashed or plain SMTP, Turnstile and Google secrets in its diff isn't verified. Watch the first real run.
   - R3 is recorded in 03 and the release notes, but Saurabh hasn't formally accepted it in `00-decisions.md`.
   - Batch 3 clean-up (`:830-831`): `exception when others` only raises a warning, with the user's uuid and `sqlerrm`, and no e-mail or name. That is acceptable: a failure keeps data rather than exposing it. But the warning appears only in the Postgres log, not in `cron.job_run_details`, so nobody would notice the job keeping rows. Optionally, return or log a count of kept rows that an admin can see.
   - Batch 3 `deploy.sh`: refusing a secret value that holds a quote or a line break now happens before step 1, so nothing changes on hosted. The message names the variable, never its value. A carriage return isn't refused; that is harmless for the CLI's `.env` reader.

### 12. Low (new in batch 3): the clean-up deletes by id without re-checking, so a sign-up confirmed or deactivated mid-run can still be deleted

- **Where:** `20261114100100_open_sign_up.sql` at `1562010`, lines 814-826 and 828. The loop picks its ids with conditions and no row lock (`for stale in select u.id … where … email_confirmed_at is null and p.is_active …`). It then runs `delete from auth.users where id = stale`, which has no conditions.
- **Exploit or failure:** the job runs at 17:45 UTC over rows more than 7 days old. Two things can happen between the select and that row's delete.
  - The owner opens a Forgot-password link, which confirms the address, and the confirmed account is deleted straight afterwards.
  - An admin deactivates the row and writes an audit entry. The row the design says to keep is deleted, and the audit row is left pointing at nothing.
- **Impact:** availability and integrity only. Nobody gains access; at worst a person loses an account they had only just confirmed and signs up again. The window is milliseconds, once a day, which is why this is Low.
- **Fix:** repeat the conditions in the delete, so the check and the delete are one statement:
  ```sql
  delete from auth.users u using public.profiles p
  where u.id = stale and p.id = u.id and p.role = 'user' and p.status = 'invited'
    and p.is_active and u.email_confirmed_at is null
    and not exists (select 1 from public.audit_log a where a.target_id = u.id or a.actor_id = u.id);
  ```
  Count only when `found`. Alternatively, add `for update of u, p skip locked` to the loop's query. Add one pgTAP case: confirm a planted row between the select and the delete, and expect it kept.

## Accepted risks: still bounded as accepted?

- **R1 (raw `signUp` reply reveals an existing e-mail): yes, as accepted.**
  - Each probe needs a fresh Turnstile token, and Auth's 30 per 5 min per IP applies.
  - The page shows the same card, including the busy and closed re-check from review-5 item 2, which is fixed at `sign-up.tsx`.
  - But the same fact leaks without Turnstile through `PUT /user` (finding 2), so R1 as worded understates the exposure. Finding 10 is a cheap narrowing.
- **R2 (mail outside the cap can use up Resend Free's 100 a day): still bounded the way 03 §14 says.**
  - The bound is the global `email_sent = 30`/h limiter in GoTrue's `sendEmail` (`mail.go`; it applies while autoconfirm is off). That is about 720 a day, so a sustained attacker empties 100 in roughly 3.5 hours, which is exactly what was accepted.
  - Two caveats: the list of uncounted senders is longer than the docs say (repeat `signUp` to an unconfirmed address, `/otp` magic links to existing accounts, and e-mail change, which has no Turnstile: finding 2), and nothing checks after deploy that hosted really has `email_sent = 30` (finding 6).
  - Per third-party address, mail is limited to one a minute (`max_frequency = 60s`), and an admin can stop it by deactivating, which confirms and bans.
- **R3 (Google `email_verified` means "verified once"): not live.** Google ships `enabled = false` (`config.toml`, `[remotes.production.auth.external.google]`), and `deploy.sh` only asks for credentials when it is true. Get Saurabh's explicit acceptance before turning Google on.

## For the lead

1. Decide findings 1 and 2 with Saurabh: accept as R4 (bounce rate included), and as an R1/R2 extension, or fix. These are the only items that still need his answer before sign-up opens.
2. Verified at `1562010`:
   - finding 5 (8-digit e-mailed codes with their own constant; TOTP stays 6; post-check on `mailer_otp_length`);
   - finding 3 (no secrets on argv);
   - finding 6 (full post-check);
   - finding 8 (D8 in v1 as AC-56: a 7-day job that deletes one row at a time and only active, unconfirmed sign-ups no audit row points at; deactivated sign-ups are confirmed and kept);
   - finding 10 (SMS confirmations on).
3. Developer:
   - Finding 12 (new, Low) is a small fix: re-check the conditions inside the clean-up's DELETE. It can go in the next batch, and it doesn't block release.
   - Finding 7 and the Google half of finding 9 stay deferred to the Google release, as the lead recorded. Finding 7 should go into `03 §14` so the reversal of the earlier hardening decision is on record.
   - I didn't re-check findings 4 and 9's pre-fill in this round.
4. Tester (optional): confirm finding 2 with one `user@local.test` session and `PUT /auth/v1/user {"email":"admin@local.test"}`, expecting `422 email_exists`. It writes nothing for an address that already exists.
