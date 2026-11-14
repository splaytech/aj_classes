# 04 — Plan: open sign-up for parents and guardians

Stage 4 (Manager), 14 Nov 2026. Branch `feature/open-sign-up` @ `0993e7f`. It is already cut, so don't switch.

**Inputs:**
- `00-decisions.md`, with the lead's assumptions Q1–Q4;
- `01-requirement.md`;
- `02-architecture.md` (round 3) and ADR-0011;
- `03-design.md`, which `review-3.md` APPROVED.

The six non-blocking review-3 findings are being folded into 03 in parallel. This plan assumes all six are in; see "Review-3 findings: where they land".

**Owner for every slice: Developer (stage 5).** Rules:
- one commit per slice;
- write `05-dev-notes.md` in this folder as you go: the baseline, every spike outcome, the captured hook `event` JSON, the real `amr` arrays, and the test counts.

## Ground rules

1. **Local only.**
   - No hosted Supabase and no Management API calls, not even read-only.
   - Never pass `--linked`.
   - Never run `deploy.sh` except through `test-deploy-order.mjs`, with fakes on `PATH`.
   - The only hosted check is Saurabh's, and he does it himself (slice 0).
2. **One owner for the local stack: the Developer, for all of stage 5.** This replaces 03 §13's "the lead owns stack restarts".
   - Only the Developer runs commands that change the stack's state:
     - `pnpm db:start`, `pnpm db:stop`, `pnpm db:reset`;
     - `supabase migration up --local`, `supabase db reset --local --version …`;
     - `docker restart supabase_edge_runtime_aj_classes`;
     - `pnpm db:test`, `pnpm test:functions`;
     - the e2e smoke and CSP runs;
     - Auth admin-API calls, and the `psql` writes used to reset the cap.
   - Nobody else does, including the lead and the other worktrees.
   - `aj_classes-hiring` and `aj_classes-invites` share `project_id`, so no stack is started from them during stage 5.
   - Read-only checks are fine for anyone: `docker inspect`, `docker exec … psql -c "select …"`, and `supabase status` piped to a scratchpad file.
   - At the end (slice 33) the Developer hands the stack to the Tester, restarted from the main checkout on a fresh seed.
3. **Don't upgrade the Supabase CLI during stage 5.** It offers v3.1.0 and v2.120.0 is installed. An upgrade changes the GoTrue image, and the spike evidence is pinned to v2.197.0.
4. **Migration 2 grows over several slices.**
   - `20261114100100_open_sign_up.sql` is unreleased, so editing it is fine.
   - After each edit, apply it with `pnpm db:reset`, which also re-seeds.
   - Keep the two files 03 names. Tell the lead before adding a third.
   - Re-check every 03 line number before copying a function body.
5. **Commits.**
   - Conventional Commits, ending with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - Stage explicit paths only. Run `git status --short` before and `git show --stat HEAD` after.
   - Never stage `actionItems.md`, `brand/email/` or `docs/contracts/` (untracked, not ours).
   - The repo is **public**: scan new files for keys, tokens and real e-mail addresses. Captured JSON goes into the dev notes only with fake addresses and no tokens.

## Baseline (Manager, 14 Nov, this branch, before any change)

| Command | Result |
|---|---|
| `pnpm format:check` (and so `pnpm check`) | **fails before any change.** It warns on untracked `actionItems.md` and gitignored `supabase/.temp/linked-project.json`. Don't use `pnpm check` as the gate, and don't run `pnpm format` (it would rewrite `actionItems.md`) |
| `pnpm exec prettier --check apps e2e supabase/functions supabase/scripts supabase/templates package.json` | clean ("All matched files use Prettier code style!") |
| `pnpm lint` | pass |
| `pnpm typecheck` | pass (web plus e2e) |
| `pnpm test` | 733 web tests (79 files) and 6 e2e-unit tests, all passing |
| `pnpm --filter web exec vitest run src/routes/privacy.test.tsx` | 9 pass. This is the one-file form; `pnpm --filter web test -- <file>` runs everything |
| `VITE_APP_ENV=production pnpm build` | pass; `apps/web/build/client/privacy/index.html` exists. A plain `pnpm build` fails by design |
| `node supabase/scripts/test-deploy-order.mjs` | `MODULE_NOT_FOUND`, as expected: slice 4 creates it |
| `supabase test db --help` | takes `[<path...>]`. `supabase db reset --help` has `--version`; `supabase migration up` has `--local` |
| Edge runtime mount (read-only `docker inspect`) | `/Users/sjain/dev/work/aj_classes/supabase/functions`, the main checkout and this branch. Good |

**Not run by the Manager**, because the hard limit is not to touch the stack:
- `pnpm db:test`;
- `pnpm test:functions`;
- the e2e smoke and CSP runs.

The Developer runs them in slice 0 and records the counts. CI gates are documented as 10 smoke and 21 CSP.

## Command key (used in every slice's "Check")

| Key | Command |
|---|---|
| **FULL** | `pnpm exec prettier --check apps e2e supabase/functions supabase/scripts supabase/templates package.json && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build`. This is the repo's full check (`package.json` `check`: format, lint, typecheck, test, build), with Prettier scoped and the build run the way CI and Vercel run it. Fix formatting with `pnpm exec prettier --write <touched files>` only |
| **RESET** | `pnpm db:reset`. Re-applies every migration and the seed. Needed after any edit to the migration |
| **RESTART** | `pnpm db:stop && pnpm db:start > <scratchpad>/db-start.txt 2>&1`. Needed after any `config.toml` or template change. The output holds the local keys, so it goes to the scratchpad, never into the repo |
| **DB** | `pnpm db:test`. Never wrap the files in your own transaction |
| **FN** | `docker restart supabase_edge_runtime_aj_classes && pnpm test:functions`. From slice 3, `test:functions` includes `test-open-sign-up.mjs` |
| **INT** | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON supabase/scripts/test-open-sign-up.mjs` (the new file on its own) |
| **DEPLOY** | `node supabase/scripts/test-deploy-order.mjs`. From slice 4 it is also part of `pnpm test` |
| **ONE** | `pnpm --filter web exec vitest run <file>` |
| **E2E** | `node e2e/scripts/local-env.mjs > e2e/.env && pnpm --filter aj-classes-e2e test:smoke`. Then stop 5173: find the PID with `lsof -tiTCP:5173 -sTCP:LISTEN`, check its cwd is this repo, then `kill <pid>`. Never `pkill` |
| **CSP** | the Lighthouse gate build from `docs/testing/ci-gates.md`, then `pnpm --filter aj-classes-e2e test:csp`. It serves whatever is in `apps/web/build/`, so rebuild the gate build first |

## Review-3 findings: where they land

1. Production Google section `enabled = false`, and `GOOGLE_*` required only when it is enabled: **slice 4**.
2. `deploy.sh` fail-closed fixes (a)–(d), plus the extra `test-deploy-order.mjs` cases: **slice 4**.
3. `grant usage on schema public to supabase_auth_admin`: **slice 5**. `sign_up_guard_ready()` checks it: **slice 15**.
4. More existing tests to update:
   - `triggers.test.sql` and `family_portal.test.sql:97-110`: **slice 2**;
   - `test-invite-redeem.mjs:635`: **slice 3**;
   - `triggers.test.sql` account `…e1`, where the wipe fires harmlessly: **slice 8**.
5. AC-20 test setup uses the admin-API order (`Confirm` before `UpdatePassword`): **slice 10**.
6. Every `amr` entry must be on the list, so `[otp, unknown]` is refused: **slice 10**.

## Slices

### Phase 0: before any code

- [x] **0. Baseline, the hosted-hook question, and source-reading spikes.**
  - **Baseline.** Run FULL, RESET (so the counts start from a fresh seed), DB, FN, E2E and CSP. Record each count in `05-dev-notes.md`.
  - **Hosted hook (S1, hosted part).** Today, the Developer asks the lead to ask Saurabh to do a read-only check. He opens Dashboard → Authentication → Hooks and confirms that "Before User Created" is offered on this plan. Record his answer.
    - This is a **release gate, not a build gate** (review-4 finding 1). The local stack runs the hook, so the build goes on whatever he answers, slice 5 included.
    - A "no" is **stop condition 1**, which applies at release (see "Stop conditions").
    - `deploy.sh`'s check after `config push` closes sign-up again if the hosted hook isn't on.
  - **Read GoTrue v2.197.0** from a scratch copy (not in the repo), and record each finding with `file:line`:
    - S1(d): does `grant_type=id_token` go through the hook path (`external.go:207`)? If not, that is outcome B.
    - S1(e): is `email_verified` a boolean or a string in the hook's `user_metadata` (`provider/google.go`)?
    - S1(f): the auth-config field names in the public Management API docs (`hook_before_user_created_enabled`, `hook_before_user_created_uri`, `disable_signup`).
    - S3: re-confirm that in `LinkAccount`, `createNewIdentity` runs before `RemoveUnconfirmedIdentities` (review-3 says it does). Also record the error shape the callback receives in each case: (i) the trigger raises, (ii) the hook refuses, (iii) the user is banned. Note the query or fragment, and `error`, `error_code` and `error_description`.
    - S5: the `amr` method for Google PKCE (`external.go`, `token.go`).
  - **Check:** `05-dev-notes.md` has the baseline table, each reading outcome, and the "if not" branch it selects, or "none".
  - **Commit:** `docs(sign-up): stage 5 baseline and spike reading notes`

### Phase A: close the tutor hole and make deploy fail closed (safe on their own)

- [x] **1. Migration 1: the `user` enum value.**
  - **ACs:** groundwork for AC-28 and AC-41.
  - **Files:**
    - new `supabase/migrations/20261114100000_user_role.sql` (03 §3, item 1);
    - new `supabase/tests/database/open_sign_up.test.sql` (pgTAP-OS), starting with a test that `'user'` is in `public.app_role`.
  - **Check:** RESET, then DB (all green, with the new file counted), then FULL.
  - **Commit:** `feat(db): add the user account role`

- [x] **2. Migration 2a: no role marker means `user`, and staff invites carry `tutor`** (03 §3.1).
  - **ACs:** AC-28 (the mapping and default rows), AC-41 (part), AC-42 (part).
  - **Files:**
    - new `20261114100100_open_sign_up.sql` with §3.1 only;
    - `supabase/seed.sql`: staff rows get `'tutor'`; add `user@local.test`; update the header list (03 §9);
    - `supabase/functions/account-admin/handlers/accounts.ts`: `createInvitedAccount` always sends `app_metadata.account_role`, `tutor` included, and the header comment is updated. **This must be in the same slice.** Without it, staff invites become `user`, and the existing `test:functions` fails (02 Q1 release window);
    - `supabase/README.md`: the "First admin" SQL line (03 §9).
  - **Existing tests to update** (review-3 finding 4):
    - `triggers.test.sql:7-18`: `tutor` becomes `user`;
    - `family_portal.test.sql:97-110`: `tutor` becomes `user`;
    - grep `test-account-admin.mjs` for an assertion that staff have no `account_role`, and update it if one exists.
  - **New pgTAP-OS rows:**
    - `{}`, `{"account_role":"x"}` and `{"account_role":"admin"}` all map to `user`;
    - `tutor`, `student` and `parent` map to themselves;
    - the column default is `'user'`;
    - hostile `raw_user_meta_data` (`role`, `account_role`) maps to `user`.
  - **Check:** RESET, DB, FN, FULL.
  - **Visible:** on the dev server, the seeded `tutor@local.test` still signs in as a tutor. The staff invite in `test-account-admin.mjs` still makes a tutor.
  - **Commit:** `fix(db): accounts with no role marker become users, never tutors`

- [x] **3. E-mail confirmations on, with no lock-out** (03 §3.2, §4.1 `enable_confirmations`, §6.1 `email_confirm`).
  - **ACs:** AC-42.
  - **Files:**
    - the migration gains §3.2 (it runs before any wipe trigger exists);
    - `config.toml`: `[auth.email] enable_confirmations = true`;
    - `accounts.ts`: `email_confirm: true`;
    - `test-invite-redeem.mjs:635`: invites are now confirmed at creation (review-3 finding 4);
    - re-grep `createUser|/admin/users` in `supabase/scripts/*.mjs`, `e2e/src` and `e2e/tests`. The Manager found only `test-invite-redeem.mjs:635` and `:682-684`. Anything that creates a user and then signs in with a password passes `email_confirm: true`;
    - new `supabase/scripts/test-open-sign-up.mjs` (INT), using `local-test-helpers.mjs`, and add it to the root `test:functions`.
  - **INT, AC-42 section:**
    - every seed account signs in with confirmations on;
    - a new parent invite redeems;
    - a Studio-style admin (admin-API `createUser` with `email_confirm`, then the README `account_role` SQL) reaches staff onboarding.
  - **Migration step test** (by hand, recorded in dev notes):
    1. `supabase db reset --local --version 20261030100000`;
    2. insert an unconfirmed invitee;
    3. `supabase migration up --local`;
    4. check it is confirmed and still redeems;
    5. RESET.
  - **Check:** RESTART, RESET, DB, FN, FULL.
  - **Commit:** `feat(auth): turn on e-mail confirmations without locking out existing accounts`

- [x] **4. `deploy.sh`: guard first, sign-up last, fail closed; Google off in production** (03 §5 as amended by review-3 findings 1 and 2).
  - **ACs:** AC-47; also AC-15 and AC-39 through static config checks.
  - **Order matters.** This slice lands **before** any commit that sets `enable_signup = true` (slice 5). Then no commit on this branch pairs open sign-up with the old deploy order.
  - **Files:**
    - `supabase/scripts/deploy.sh`:
      - the seven steps, with the gate (`signups_are_off || sign_up_guard_ready`) and the step-4 guard check;
      - **(c)** a few retries on the step-4 check, for PostgREST lag;
      - the step-7 hook post-check;
      - **(a)** a failed step-4 check on a re-deploy, where sign-ups were on at the gate, sends `PATCH {"disable_signup":true}` before failing;
      - **(b)** the close-again `PATCH`'s exit code is checked. If it fails: "Sign-up may be open without the hook: turn it off in Dashboard → … now.", and a non-zero exit;
      - **(d)** the access token goes into a 0600 header file used with `curl -H @file`, and the file is deleted afterwards. The token is never in argv;
      - `DEPLOY_ENV_FILE` override;
      - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` required **only when** `[remotes.production.auth.external.google] enabled = true`;
      - new header comment and `NEXT` text.
    - `supabase/config.toml`:
      - `[auth.external.google]`: off locally;
      - `[remotes.production.auth.external.google]`: **`enabled = false`**, with `client_id`/`secret` read through `env()`.
    - New `supabase/scripts/test-deploy-order.mjs`, and root `package.json` `"test"` appends `&& node supabase/scripts/test-deploy-order.mjs`.
  - **Test cases.** Fake `supabase`, `curl` and `jq` go on a `PATH` limited to the fakes dir plus `/usr/bin:/bin`, so the real Homebrew `supabase` can't be reached. `DEPLOY_ENV_FILE=/dev/null`, and every secret is a fake:
    1. the dry-run order: gate → `db push` → guard check → functions → secrets → `config push` → hook post-check;
    2. `config push` is the last `supabase` command;
    3. the fake log is empty in the dry run;
    4. (a) step 4 fails after an open gate: the `PATCH` is sent, with a non-zero exit;
    5. (b) the `PATCH` fails: the Dashboard message, with a non-zero exit;
    6. (c) step 4 is retried before it fails;
    7. (d) no fake argv contains the token value;
    8. Google `enabled = false`: no `GOOGLE_*` is needed; Google enabled with the variables missing: it stops at "Checking what's needed", before any command.
  - **Static config checks** (offline, in the same file unless 03 names another home): `sign_in_sign_ups = 30` (AC-39); the production SMTP `sender_name = "AJ Classes"` and `admin_email = "hello@ajclasses.com.au"` (AC-15); `enable_manual_linking = false`; Apple off.
  - **Check:** DEPLOY, FULL. Never run `deploy.sh` any other way.
  - **Commit:** `feat(deploy): check the sign-up guard before opening sign-up last, and fail closed`

### Phase B: spikes S1–S7 (each builds the smallest piece it proves and ends in a committed pass/fail test)

When a spike fails, take 03 §2's "If not" column. Don't improvise. The stop outcomes are listed under "Stop conditions".

- [x] **5. S1: the `before-user-created` hook** (03 §3.3 `sign_up_daily_cap`, `is_valid_full_name`, `sign_up_refusal`; §3.4; §3.5).
  - **ACs:** AC-45 (name), AC-46 (server), AC-48 (server), AC-53 (DB), AC-28 (incoming `account_role` refused), AC-41 (no `account_role` after an e-mail `signUp`).
  - **Files:**
    - the migration gains the helpers, both tables (RLS on, no policies), the hook (`security definer`, `search_path = ''`), and **`grant usage on schema public to supabase_auth_admin`** (review-3 finding 3);
    - `config.toml`: `[auth.hook.before_user_created]` and `[auth] enable_signup = true`, with 03's comment.
  - **Capture the real `event` once.** Log it to a scratch table, record it in the dev notes, then remove the logging. Before committing, grep the migration for the scratch table name.
  - **Tests:**
    - **INT:** with 15 rows planted, the 16th `signUp` gets 429 `sign_up_busy`, with no Mailpit mail and no `auth.users` row. With the switch closed (direct `update private.sign_up_settings`), it gets 429 `sign_up_closed`. S1(b): supabase-js sees `status 429` and `message === 'sign_up_busy'`. **AC-41** (review-4 finding 2): after an allowed e-mail `signUp`, the new user's `app_metadata` has no `account_role`.
    - **pgTAP-OS**, calling the hook directly with the captured shape:
      - closed refuses, and so does a missing settings row;
      - an incoming `account_role` → `sign_up_refused`;
      - Google `email_verified` false, `"false"`, missing, or an empty e-mail → `google_email_unverified`;
      - Google `true` and `"true"` are allowed and not counted;
      - an unknown provider is refused;
      - an invalid name → `invalid_name`;
      - the 24-hour purge works;
      - with 14 planted, the first of two calls is allowed and the second is busy;
      - S1(c): the definer hook reads `private.*`;
      - `has_schema_privilege('supabase_auth_admin','public','usage')`.
  - **Check:** RESTART, RESET, DB, INT, FULL.
  - **If not:**
    - (b) a different shape: map it in `auth-errors.ts` (slice 9 or 20);
    - (d) outcome B: the switch and `email_verified` checks go into `check_identity_link()` in slice 7, with pgTAP;
    - (f) different names: use the documented ones in `deploy.sh` and amend slice 4's test.
  - **Commit:** `feat(auth): before-user-created hook for the sign-up switch, daily cap and Google e-mail check`

- [x] **6. Confirmation e-mail template** (03 §4.2). Every INT that follows an e-mail link needs it.
  - **ACs:** AC-15, AC-16 (where the link points).
  - **Files:**
    - new `supabase/templates/confirmation.html`;
    - `recovery.html`: "your AJ Classes account", and no Staff badge;
    - `invite.html`: the condition becomes `eq . "parent"`;
    - `config.toml`: `[auth.email.template.confirmation]`.
  - **INT:** in Mailpit, check the subject, the branded HTML, and the link `/portal/auth/confirm?token_hash=…&type=email`. **S2 text part:** does the message have a `Text` part? If not, the template prints the full link as visible text, and `[TBC AC-15]` goes to the PO (the lead's assumption Q1 already accepts this).
  - **Check:** RESTART, INT, FULL. Prettier covers `supabase/templates`.
  - **Commit:** `feat(auth): branded sign-up confirmation e-mail`

- [x] **7. S3: the linking trigger** (03 §3.6, "Linking rule").
  - **ACs:** AC-54 (DB), AC-52 (DB: a new Google user is allowed), AC-14 case 2 (the DB half).
  - **Files:**
    - the migration gains `private.check_identity_link()` and `on_auth_identity_link_check`;
    - `000-setup-tests-hooks.test.sql` gains `tests.create_sign_up(...)`, shaped as GoTrue does it: insert the user, insert the identity, then the confirm update.
  - **pgTAP-OS:** every Q3 row:
    - nothing matches → allowed;
    - an unconfirmed sign-up, a finished e-mail user, a tutor, an admin, an invitee, a parent, a student, or a deactivated account → `identity_link_refused`;
    - any other provider → refused.
    - Keep the "if not" row from review-3 even though its branch can't happen.
  - **Check:** RESET, DB, FULL.
  - **If not:** if the order in slice 0's reading is the other way round, also refuse a `google` insert when `encrypted_password is not null`, add a pgTAP row, and tell the lead. That is not a stop.
  - **Commit:** `feat(db): a Google login can only attach to a brand-new account`

- [x] **8. S6: the confirm-time wipe.** This is the riskiest slice (see Risks).
  - **03 reference:** §3.6, "Confirm-time wipe".
  - **ACs:** AC-14 (cases 3, 4, 5, and the first half of case 6).
  - **Files:**
    - the migration gains `private.wipe_unproven_credentials()` and `on_auth_user_email_confirmed`;
    - `triggers.test.sql` account `…e1`: the wipe fires harmlessly at line 25, so adjust any expectation there (review-3 finding 4).
  - **INT (S6):**
    1. P1 is stored at a low bcrypt cost before confirmation. After confirming, P1 fails and `encrypted_password` is null.
    2. B sets P2 through `updateUser` in the link session. A P2 sign-in upgrades the hash, P1 still fails, and the wipe doesn't fire.
    3. A null `encrypted_password` at sign-in reads as a wrong password, with no 500.
    4. AC-14 cases 3, 4 and 5, up to "only B's password signs in". Each case uses its own fresh `signUp`. Case 1 and the finish assertions come in slice 10.
  - **The planted-P1 account is for checks 1–3 only** (review-4 finding 4). Planting P1 with a SQL update of `encrypted_password` also sets `password_set_at`, so that account would skew later finish-step checks. Never reuse it for an AC-14 case, here or in slice 10.
  - **pgTAP-OS:** a factor inserted before confirmation is gone after it.
  - **Check:** RESET, DB, INT, FULL.
  - **If not:** if any GoTrue write puts a hash back, or a null password gives a 500: **stop**. Report to the lead; the Architect decides.
  - **Commit:** `feat(auth): proving the mailbox wipes any earlier password and authenticator`

- [x] **9. S2 (captcha) and S4 (unconfirmed sign-in).**
  - **ACs:** AC-8 and AC-38 (server), AC-14 (case 5, no session before confirmation; a repeat sign-up), AC-19, AC-46 (outside the cap), AC-12 (part).
  - **INT:**
    - `/signup` and `/resend` without `captcha_token` are refused, and nothing is created or sent;
    - **AC-19** (review-4 finding 2; needs slice 6's template):
      - an unconfirmed sign-up gets a new mail, and the old link fails;
      - a confirmed but unfinished one gets no mail;
      - a second resend within 60 seconds still gets a neutral reply;
      - the `private.sign_up_emails` count is unchanged;
    - **AC-46:** resend and Forgot password still send, and are neither stopped nor counted. Plant 15 rows first, so the cap is full;
    - **AC-14:** a repeat `signUp` for an unfinished e-mail sends a new link, and the old link fails;
    - the existing Forgot-password captcha check still passes;
    - S4(a): a password sign-in to an unconfirmed e-mail returns `email_not_confirmed`;
    - S4(b): ban an unconfirmed sign-up through the admin API, then record whether `signUp` and `resend` still send.
  - **Web:** `services/auth-errors.ts` maps `email_not_confirmed` to `invalidCredentials`, tested in `auth-errors.test.ts`.
  - **Check:** INT, ONE `src/services/auth-errors.test.ts`, FULL.
  - **If not:** if S4(b) sends nothing, the lead decides whether §6.4's "confirm on deactivate" stays. The default is to keep it.
  - **Commit:** `test(auth): captcha guards sign-up and resend; an unconfirmed sign-in reads as a wrong password`

- [x] **10. S5: the finish step on the server** (03 §3.3 `signed_up_with` and `session_can_finish_sign_up`; §3.7 `my_sign_up`, `complete_sign_up` and `my_has_password`).
  - **ACs:** AC-6 and AC-7 (server), AC-14 (all six cases), AC-17, AC-20, AC-24, AC-45 (terms).
  - **Files:**
    - the migration gains those functions;
    - `000-setup-tests-hooks.test.sql` gains `tests.authenticate_with_session(user_id, amr, aal)`.
  - **The `amr` rule.** **Every** `amr` entry must be in (`otp`, `recovery`, `email/signup`, `magiclink`, `oauth`) (review-3 finding 6).
  - **pgTAP-OS matrix:**
    - `[otp]`, `[recovery]` and `[oauth]` save;
    - `[password]`, `[token_refresh]`, **`[otp, unknown]`**, `[]` and a missing claim refuse with `sign_up_link_needed`;
    - an e-mail account with no password set in this session → `password_not_set`; a Google account needs none;
    - no tick → `terms_required`, and the account stays `invited`;
    - saving deletes factors and every other session, keeps the current one, sets the account active and `terms_accepted_at`, and audits `{role:'user', via}`;
    - `my_has_password` is correct.
  - **INT:**
    - record the real `amr` arrays in the dev notes: a confirmation link, a recovery link, a password sign-in, and each after one refresh;
    - the finish step saves from a confirmation session and from a recovery session;
    - it is refused from a password session;
    - AC-14 cases 1–6 run in full. Each case uses a fresh `signUp`, never slice 8's planted-P1 account (review-4 finding 4);
    - AC-24: a finished user resets and changes the password.
    - **AC-20** (review-3 finding 5): build the unreachable state with **one** admin `PUT /auth/v1/admin/users/:id { email_confirm: true, password }`. GoTrue runs `Confirm` before `UpdatePassword` (`admin.go:255-270`), so the password survives. Never set the password in an earlier call, because the wipe would clear it. Then a password sign-in gives `my_sign_up().can_finish = false`. `complete_sign_up` must refuse with **`sign_up_link_needed`, not `password_not_set`** (review-4 finding 3). The admin update fires `on_auth_password_set`, so `password_set_at` is set and only the `amr` check refuses.
    - Forgot password on an unconfirmed sign-up leads to the recovery link, and the finish step saves.
  - **Check:** RESET, DB, INT, FULL.
  - **If not:**
    - a link session shows a method that isn't listed: add **exactly** that method, and record it. Never add a catch-all;
    - a false `password_not_set` (clock skew, 03 §14 item 6): record it, and tell the lead before adding the 5-second allowance;
    - a refreshed link session loses its link method: **stop** (see stop condition 4).
  - **Commit:** `feat(db): finish-sign-up step that only an e-mail link or Google session can save`

- [x] **11. S7: PKCE without breaking e-mail links.**
  - **ACs:** AC-42 (reset and e-mail change still work), groundwork for AC-51.
  - **Files:** `apps/web/src/services/supabase.client.ts` gets `flowType: 'pkce'`, with a unit test that pins it.
  - **INT:** the sign-up confirmation and resend links verify with `token_hash`.
  - **E2E (03 S7):** reset still works. If this becomes a third test in `open-sign-up.spec.ts`, the smoke count is 13, not 12. Record that for slice 31.
  - **Check:** INT, ONE on the client test, E2E, FULL.
  - **If not:** keep the main client as it is, and add `getOAuthClient()` exactly as 03 §2 S7 says. Never call `signOut` on it.
  - **Commit:** `feat(portal): PKCE auth flow for Google without breaking e-mail links`

### Phase C: the rest of migration 2 (each with pgTAP)

- [x] **12. Sign-up status and the admin switch** (03 §3.7 `sign_up_status` and `admin_set_sign_up_open`; §3.9 audit actions).
  - **ACs:** AC-48, AC-46 (busy status).
  - **pgTAP-OS:**
    - the status is `open`, `busy` (15 planted), `closed`, and `closed` when the row is missing;
    - the switch works only for an admin at aal2; a tutor and an aal1 admin get `not_admin`;
    - null → `invalid_input`;
    - no change → no audit;
    - it audits `sign_up_opened` and `sign_up_closed`.
  - **INT:** with `admin_set_sign_up_open(false)` as the seeded admin at aal2, `signUp` gets 429 with no mail, existing users still sign in, and reopening works.
  - **Check:** RESET, DB, INT, FULL.
  - **Commit:** `feat(db): admin switch to close and reopen sign-up`

- [x] **13. Guards in existing functions** (03 §3.8: copy the latest body, change one line).
  - **ACs:** AC-28, AC-40 (DB), AC-32 (DB).
  - **pgTAP-OS:**
    - `complete_onboarding` → `not_invited` for a user;
    - `my_onboarding` returns no row for a user;
    - `admin_set_active` deactivates an unfinished user;
    - `has_column` on `profiles.role`, `full_name`, `is_active` and `invited_at` (AC-41).
  - Existing onboarding tests stay green, unchanged.
  - **Check:** RESET, DB, FULL.
  - **Commit:** `fix(db): invite onboarding refuses signed-up users; users can be deactivated before finishing`

- [ ] **14. List users and promote one** (03 §3.7 `admin_list_users` and `admin_promote_user`).
  - **ACs:** AC-31 (DB), AC-35 (DB).
  - **pgTAP-OS:**
    - `admin_list_users` works only for an admin at aal2, lists newest first, and has the right `signed_up_with` and `finished`;
    - after `admin_promote_user`, the role is `parent`, the link exists, sessions and password are kept, and the account is gone from the list;
    - a promoted Google user with `oauth` `amr` reads their child through the `require_parent` functions;
    - `not_a_signed_up_user` for an unfinished or deactivated target; `not_found` for an inactive student.
  - **Check:** RESET, DB, FULL.
  - **Commit:** `feat(db): list signed-up users and promote one to parent`

- [ ] **15. `sign_up_guard_ready()`** (03 §3.7, plus review-3 finding 3).
  - **ACs:** AC-47.
  - **pgTAP-OS:**
    - true after the migration;
    - false after dropping or disabling each trigger inside the test transaction;
    - false without the hook's execute grant;
    - false without `usage on schema public`;
    - false without the settings row.
  - **Check:** RESET, DB, DEPLOY, FULL.
  - **Commit:** `feat(db): sign_up_guard_ready checks behaviour, not migration history`

- [ ] **16. Access sweep** (new `supabase/tests/database/open_sign_up_access.test.sql`, pgTAP-AX).
  - **ACs:** AC-26, AC-27, AC-29 (DB), AC-30 (DB), AC-55.
  - **As a finished user:**
    - every table AC-26 lists, and other people's `profiles`, return 0 rows;
    - insert, update and delete are refused;
    - the **pinned list** of `public` functions executable by `authenticated` is checked; each is called with plausible arguments and raises or returns nothing. A new function fails the pin until someone reviews it;
    - `storage.objects` list and insert are refused;
    - a direct update of each `profiles` column is refused;
    - publishing, returning and the due-tomorrow sweep queue no `email_outbox` row for a user;
    - `admin_list_staff`, the student list and `admin_email_problems` exclude users.
  - Re-run the whole sweep with an `oauth` `amr` (AC-55).
  - **Check:** RESET, DB, FULL.
  - **Commit:** `test(db): signed-up users can read nothing but their own profile and posts`

### Phase D: the `account-admin` edge function (restart the edge runtime after every edit)

- [ ] **17. Invites replace an unfinished sign-up and refuse a finished one** (03 §6.1 `replaceUnfinishedSignUp`, §6.2).
  - **ACs:** AC-13, AC-34 (server), AC-36, AC-37.
  - **Files:** `handlers/accounts.ts`, `invite.ts` (switched to `findAccountByEmail`), `invite-student.ts` (`already_exists_user`), `invite-parent.ts` (the unfinished case), `resend-invite.ts`, `cancel-invite.ts` (`not_allowed`).
  - **INT:**
    - a staff, student or parent invite replaces an unfinished sign-up, and the old confirmation link fails afterwards;
    - a finished user gets `already_exists` (staff) or `already_exists_user` (student);
    - a deactivated sign-up gets `already_exists`;
    - after a parent invite, a `signUp` with that e-mail leaves the invite link still redeeming (AC-13).
  - **Check:** FN, FULL.
  - **Commit:** `feat(account-admin): invites replace an unfinished sign-up and refuse a finished one`

- [ ] **18. Promotion in `invite-parent`** (03 §6.1 `syncAccountRole` and `signUpFacts`; §6.3).
  - **ACs:** AC-33 (server), AC-35.
  - **INT:**
    - a finished user gives `needsConfirmation`, with the method and date;
    - confirming gives `promoted`, sends no Mailpit mail, and audits `parent_linked {promoted_from:'user'}`;
    - `app_metadata.account_role = 'parent'`, and the password still signs in;
    - a forced `syncAccountRole` failure gives `role_sync_failed`, and a retry heals it;
    - a changed account gives `promotion_changed`.
  - **Check:** FN, FULL.
  - **Commit:** `feat(account-admin): link a signed-up user as a parent after the admin confirms`

- [ ] **19. `set-active` for users, and the AC-12 matrix** (03 §6.4).
  - **ACs:** AC-32 (server), AC-12, AC-29 (mail).
  - **INT:**
    - deactivating and reactivating finished and unfinished users bans and unbans them and writes the audits;
    - deactivating an unconfirmed user confirms it.
    - **AC-12:** for each of admin, tutor, student, parent, invited, finished user, deactivated finished and deactivated unfinished, `signUp` returns 200; name, role, status and password are unchanged; the Mailpit count is unchanged.
    - **AC-29:** a user's Mailpit holds only the confirmation and reset e-mails.
  - **Check:** FN, FULL.
  - **Commit:** `feat(account-admin): deactivate and reactivate signed-up users`

### Phase E: web pages (`apps/web/src`; services are the only Supabase callers, and every word lives in constants)

- [ ] **20. Constants, types and services** (03 §7.1, §7.2).
  - Nothing new on screen yet.
  - **Files:**
    - `pnpm db:types` regenerates `database.types.ts`;
    - constants: `app`, `routes`, `portal`, `error`, `seo` and `index`, plus the new `sign-up.constants.ts`;
    - services: `types.ts`, `auth.service.ts` (`readSignUp`), `auth-errors.ts` (the new keys), `families.service.ts`, `index.ts`, plus the new `sign-up.service.ts` and `users.service.ts`.
  - **Unit tests:**
    - new `sign-up.service.test.ts`: the throwaway password is never returned and is at least 12 characters; the e-mail is lower-cased; `data` holds only `full_name`; the replies are mapped neutrally; a failed options read gives `{closed, google:false}`;
    - updated `auth-errors.test.ts`.
  - **Check:** `pnpm db:types`, then FULL.
  - **Commit:** `feat(portal): sign-up services and wording`

- [ ] **21. Access rules and the user home** (03 §7.3; §7.4 `PortalLayout` and `PublicPostsList`; §7.6 `/portal/user`).
  - **ACs:** AC-21, AC-22, AC-25.
  - **Files:**
    - `lib/portal-access.ts`, `lib/portal-guard.ts` (step 2b, `revoke`), `PortalLayout.tsx`;
    - new `components/posts/PublicPostsList.tsx` and its `.module.css` (moved from `routes/posts.module.css`), and `routes/posts.tsx`;
    - new `routes/portal/user-layout.tsx` and `user-home.tsx`, and `routes.ts`.
  - **Tests:**
    - `portal-access.test.ts`: a user is forbidden in `staff`, `admin`, `student` and `parent`; a route-walk over `routes.ts`; `signUp` plus `canFinish` allows only `join`; `!canFinish` gives `signOut` with `finish-sign-up` and `revoke`;
    - `PortalLayout` for a user shows only its links;
    - `user-home.test.tsx`;
    - `posts.test.tsx` still passes.
  - **Check:** ONE on each test, then FULL.
  - **Visible:** sign in as `user@local.test` and you land on `/portal/user`, headed "Latest news". The nav shows only Latest news, Account and Sign out. `/portal/admin` shows "not allowed".
  - **Commit:** `feat(portal): signed-up users get a Latest news home and nothing else`

- [ ] **22. Account page trim** (03 §7.6 `/portal/account`).
  - **ACs:** AC-23.
  - **Files:** `routes/portal/account.tsx`, new `account.test.tsx`.
  - **Check:** ONE, FULL.
  - **Visible:** as `user@`, the page shows the e-mail, `User`, Appearance and Change password. It has no Notifications, Your choices or Two-step. The parent and staff accounts are unchanged.
  - **Commit:** `feat(portal): trim the account page for signed-up users`

- [ ] **23. Sign-up page, the Sign in link and the resend page** (03 §7.6).
  - **ACs:** AC-1, AC-2, AC-4, AC-5, AC-8, AC-10, AC-11, AC-19, AC-39 (message), AC-46 (page), AC-48 (page).
  - **Files:**
    - new `routes/portal/sign-up.tsx`, `sign-up-resend.tsx`, `components/portal/FinishSignUpHint.tsx` and `lib/sign-up-validation.ts`;
    - `login.tsx` (loader and link);
    - `routes.ts`.
  - **Tests:**
    - `sign-up.test.tsx`: no password field; Google only when enabled; the same card for a new e-mail, the fake reply and `over_email_send_rate_limit`; the busy and closed cards; captcha reset; `noindex`; the route sits under `portal-root`;
    - `sign-up-resend.test.tsx`;
    - `login.test.tsx`: the link shows for `open` and `busy`, and hides for `closed`, a failed read, and an unconfigured portal;
    - `sign-up-validation.test.ts`;
    - `sitemap.test.ts`: the new pages are not listed.
  - **Check:** ONE on each test, then FULL.
  - **Visible:** on the dev server, `/portal/login` shows "New to AJ Classes? Create an account", and a sign-up puts a mail in Mailpit. To see busy, plant 15 rows; to see closed, set the row with `psql`. Reset both afterwards.
  - **Commit:** `feat(portal): parent and guardian sign-up page`

- [ ] **24. Confirm link and finish step** (03 §7.4 `FinishSignUpForm`; §7.6 `auth-confirm` and `join`).
  - **ACs:** AC-6, AC-7, AC-16, AC-17, AC-18, AC-20 (the login notice).
  - **Files:** `auth-confirm.tsx` (`type=email`), `join.tsx` (the user variant), new `FinishSignUpForm.tsx`.
  - **Tests:**
    - `auth-confirm.test.tsx`: no `verifyOtp` until Continue; the URL is wiped after; one error message plus "Send the link again";
    - new `FinishSignUpForm.test.tsx`: too short gives `passwordTooShort`; a server `weak_password` gives `weakPassword`; `autocomplete="new-password"`; show and hide; the tick's wording, its two links, and the error without it; no password for Google; `samePassword`;
    - the login notice for `finish-sign-up`.
  - **Check:** ONE on each test, then FULL.
  - **Visible:** a full e-mail sign-up by hand: Mailpit link → Continue → finish → `/portal/user`.
  - **Commit:** `feat(portal): confirm the e-mail and finish signing up`

- [ ] **25. Google button and the callback page** (03 §7.4 `GoogleButton`; §7.6 `/portal/auth/callback`; §4.1 redirect URLs).
  - **ACs:** AC-51, AC-52 to AC-55 (page side), AC-32 (banned → `notActive`).
  - **Files:**
    - new `GoogleButton.tsx` and `routes/portal/auth-callback.tsx`;
    - `login.tsx` and `sign-up.tsx` show the button;
    - `routes.ts`;
    - `config.toml`: the local and production `/portal/auth/callback` redirect URLs.
  - **Tests:**
    - `auth-callback.test.tsx` maps the three shapes recorded in slice 0: `google_email_unverified` → the AC-53 text; closed or refused → `signUpClosed`; banned → `notActive`; anything else, including `identity_link_refused` → message M. It also checks the URL is wiped and a late result is dropped;
    - the button shows only when `/auth/v1/settings` lists Google, and hides on a failed read.
  - **Check:** RESTART, ONE on each test, then FULL.
  - **Visible:** locally Google is off, so the button shows **nowhere**: hidden, never broken.
  - **Optional manual run:** only if Saurabh gives the team a **dev** Google client. Its redirect is `http://127.0.0.1:55321/auth/v1/callback`, and its secret is never committed.
  - **Commit:** `feat(portal): Continue with Google and the OAuth callback page`

- [ ] **26. Terms & Conditions page** (03 §7.5, §7.9). This slice is independent of the others: do it early, so Saurabh can read the draft sooner.
  - **ACs:** AC-50.
  - **Files:**
    - new `routes/terms.tsx`, with its own `ErrorBoundary` copied from `careers.tsx:59-69`;
    - `TERMS` in `content.constants.ts`, headed by the DRAFT comment;
    - `SEO.terms`;
    - `LEGAL_LINKS.terms = ROUTES.terms` (the join and finish forms now link to it);
    - `routes.ts` and `react-router.config.ts` (`prerender`);
    - `routes/sitemap.ts` (after `/privacy`);
    - `hosting-csp.test.ts`, `e2e/csp/public-csp.spec.ts` and `apps/web/lighthouserc.json`.
  - **Tests:** new `terms.test.tsx`; `sitemap.test.ts`; `hosting-csp.test.ts`.
  - **Check:** FULL; then `apps/web/build/client/terms/index.html` exists; then CSP.
  - **Visible:** `/terms` at 375 px and 1280 px has one `h1`, no sideways scroll, and links to Privacy.
  - **Commit:** `feat(terms): Terms & Conditions page (draft for Saurabh's approval)`

- [ ] **27. Privacy Policy text** (03 §7.9 `PRIVACY` edits).
  - **ACs:** AC-43.
  - **Files:** `content.constants.ts`, `routes/privacy.test.tsx` (fails if `only by invitation` comes back).
  - **Check:** ONE `src/routes/privacy.test.tsx`, then FULL.
  - **Commit:** `feat(privacy): say parents and guardians can sign up (draft for Saurabh's approval)`

- [ ] **28. Admin → Users page** (03 §7.8, plus the `admin-dashboard` shortcut).
  - **ACs:** AC-31, AC-32, AC-48, AC-30 (dashboard counts unchanged).
  - **Files:** new `routes/portal/admin-users.tsx` (MUI, `getAdminClient`), `admin-dashboard.tsx`, `routes.ts`, and `USERS_PAGE` in `portal.constants.ts`.
  - **Tests:** new `admin-users.test.tsx`: the columns and labels, the empty state, both switch dialogs, and both Deactivate and Reactivate dialogs. Check `color="textSecondary"`.
  - **Check:** ONE, FULL.
  - **Visible:** as `admin@` (2FA), the page lists `user@` and the sign-ups from earlier slices, and the switch closes and reopens sign-up (the login link hides and shows). `tutor@` gets "not allowed".
  - **Commit:** `feat(admin): Users page with the sign-up switch, deactivate and reactivate`

- [ ] **29. Promotion dialog** (03 §7.4 `ParentInviteDialog`, §7.7; `admin-student.tsx`).
  - **ACs:** AC-33, AC-34 (page side).
  - **Tests:** new `ParentInviteDialog.test.tsx`: the text, "Signed up with …", and the mobile line only for Google. The student invite shows `alreadyExistsUser`.
  - **Check:** ONE, FULL.
  - **Visible:** as an admin, link `user@` to a seeded student and confirm. The user then lands on the parent home.
  - **Commit:** `feat(admin): confirm before linking a signed-up user as a parent`

### Phase F: end to end, docs, release

- [ ] **30. E2E spec** (03 §10, "E2E").
  - **ACs:** AC-1, AC-16, AC-21, AC-51, AC-54 (end to end); AC-50 (CSP).
  - **Files:** new `e2e/tests/open-sign-up.spec.ts`, using `../src/fixtures/test-fixtures.js` (hosted guard) and checking both the UI and the database.
    - Test 1: e-mail sign-up through Mailpit and the finish step to "Latest news".
    - Test 2: the Google button with stubbed settings, and the callback error showing M.
    - Plus the S7 reset test, if slice 11 put it here.
  - **Check:** E2E and CSP. Afterwards, no `e2e-%` rows are left in posts, enquiries or profiles; the run's `sign_up_emails` rows are deleted; and nothing listens on 5173.
  - **Commit:** `test(e2e): e-mail sign-up to Latest news, and the Google button and refusal`

- [ ] **31. Docs and runbooks** (03 §9).
  - **Files:**
    - `supabase/README.md`: local accounts with `user@`; "Sign-up locally" with the cap reset; the "First admin" SQL (from slice 2: check it's there); "Close sign-up", including the Dashboard fallback;
    - root `README.md` portal paragraph: sign-up for parents and guardians, linking to `supabase/README.md`;
    - `docs/requirements/release-2/go-live.md` §0: sign-ups may be on, only with the ADR-0011 guard;
    - `docs/testing/ci-gates.md`: the smoke count goes from 10 to 12 (13 if slice 11 added one), CSP from 21 to 22, `test-deploy-order.mjs` is in `pnpm test`, `test-open-sign-up.mjs` is in `test:functions`, and the rate-limit opt-in is described;
    - `docs/decisions/README.md`: the **ADR-0011 row**, status "Proposed". The Manager sets it to Accepted at merge.
  - **Check:** FULL. Docs are in `.prettierignore`.
  - **Commit:** `docs(sign-up): runbooks for sign-up, closing it, and the new deploy order`

- [ ] **32. Release notes and decision drafts.**
  - **Files:** new `docs/delivery/2026-11-13-open-sign-up/release-notes.md`, written for Saurabh in plain English with numbered steps. It covers:
    1. **Before merging:** approve the Terms draft (`/terms`) and the Privacy text. The release waits for this (Decision 4).
    2. **Hook check (read-only, yours):** Dashboard → Authentication → Hooks offers "Before User Created". Already asked in slice 0: restate the answer. If it isn't offered, don't deploy.
    3. **Order:** merge, then production web is live (the link stays hidden while Auth has sign-up off), then you run `supabase/scripts/deploy.sh`, then one real e-mail sign-up on production. No invites during the deploy.
    4. **Google, when you're ready** (e-mail can go live first; lead assumption Q3):
       - In Google Cloud, create a project. Set the OAuth consent screen to External, In production, with scopes `openid email profile` (non-sensitive, so no app verification).
       - Create a Web client with the authorised redirect `https://unzjnxctkyahtmrkinyr.supabase.co/auth/v1/callback` and the JavaScript origin `https://ajclasses.com.au`. The consent screen will name the Supabase domain (no custom domain, Decision 8).
       - Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `supabase/.env.deploy`, and save them under a password-manager item name (never in chat or git).
       - Change `[remotes.production.auth.external.google] enabled` to `true`. That is a one-line change on its own branch.
       - Merge it, run `deploy.sh`, and do one real Google sign-up.
    5. **Closing sign-up:** Admin → Users → Close sign-up. The emergency fallback is Dashboard → "Allow new users to sign up". The next deploy turns that back on, so close the admin switch too.
    6. **Watch:** if "Sign-up is busy" shows on real days, or e-mail runs out (R2), move to Resend Pro (about A$31 a month).
    7. **Rollback:** set `enable_signup = false` in `config.toml`, then run `deploy.sh`. The migration stays.
    8. **Residual risks** in one line each: R1, R2, R3.
    9. **What wasn't verified:** hosted `postgres` rights on `auth` tables (S3: a failure leaves sign-up closed at step 3 or 4), a real Google sign-in, and mobile, which is the Tester's manual check.
  - **Decision drafts** go in a "For `_knowledge/decisions.md`" section of the same file:
    - DEC-OS-1 to DEC-OS-7 (02 "Decisions recorded");
    - the 03 differences (`admin_list_users`, `my_has_password`, confirm-on-deactivate, the hook's extra refusals, the hook post-check, `:55321`);
    - the review-3 changes (Google off in production, deploy fail-closed (a)–(d), the schema-usage grant, the every-`amr` rule);
    - R3.
    - The lead copies them into `~/second-brain/Projects/AJClasses/_knowledge/decisions.md` at close-out (outside the repo).
  - **Check:** `git show --stat HEAD` lists only this file, plus `05-dev-notes.md` if updated.
  - **Commit:** `docs(sign-up): release notes and decision drafts`

- [ ] **33. Final gate and handover.**
  - **Check, in order:**
    1. FULL;
    2. RESET, then DB;
    3. FN (which includes INT);
    4. DEPLOY;
    5. E2E;
    6. CSP;
    7. `pnpm --filter web lighthouse` and `lighthouse:report` (`/terms` is now in `lighthouserc.json`);
    8. **only now, by hand:** `test-open-sign-up.mjs --rate-limit` (AC-39). It blocks this IP's sign-ins for 5 minutes, so run it last.
  - **Browser pass:**
    - as admin (Users, the switch, deactivate, promote), tutor (no Users), student, parent, a finished user, an unfinished user (sent to `/portal/join`), and signed out;
    - at 375 px and 1280 px, in light and dark;
    - every `sitemap.xml` URL, `/terms` included: 200, no console errors, one `h1`.
  - **Record:** before and after counts in `05-dev-notes.md`, and what wasn't verified.
  - **Hand the stack to the Tester:**
    - restart it from the main checkout (`pnpm db:stop && pnpm db:start`);
    - RESET for a fresh seed;
    - the cap is empty and the switch is open;
    - nothing listens on 5173.
  - **Commit:** `docs(sign-up): stage 5 results`

**34 slices (0–33).**
- Slices 26–27 (Terms, Privacy) depend on nothing else and can move earlier.
- Everything else follows the order above, because each slice relies on the one before it.

## Risks and mitigations

1. **S6, the wipe, is the riskiest slice (8).**
   - Risk: it is the only thing that keeps a stranger's pre-confirmation password from working (AC-14), and it has no fallback in 03.
   - Mitigation:
     - it comes early, straight after the linking trigger;
     - INT covers the hash-upgrade path and the null-password path;
     - the pgTAP and INT tests rerun on every stack bump.
   - If it fails: stop condition 2.
2. **Before User Created may not be on the hosted plan (S1, hosted).**
   - Risk: without it, production has nothing to enforce the kill switch, the cap or Google verification. The build is not affected, because the local stack runs the hook.
   - Mitigation:
     - Saurabh is asked in slice 0, so the answer is in long before release;
     - it is a **release gate**: a "no" means `deploy.sh` is not run;
     - if `deploy.sh` runs anyway and the hosted hook isn't on, its check after `config push` closes sign-up again (slice 4).
3. **Hosted `postgres` rights on `auth` tables (S3) can't be proven locally.**
   - Mitigation: the migration runs at step 3/7. If it fails, the step-4 guard check fails too, and sign-up stays closed. Slice 4's (a) and (b) close sign-up again on a re-deploy, and say so loudly if that fails. This is in the release notes as unverified.
4. **An intermediate commit deployed with sign-up open.**
   - Mitigation:
     - slice 4 (new order, fail closed) lands before slice 5 (`enable_signup = true`);
     - Google stays off in production;
     - nothing on this branch is deployed before merge.
5. **The role-mapping slice could break staff invites.** Mitigation: the `accounts.ts` `account_role: 'tutor'` change is in the same slice (2), and FN proves it.
6. **Confirmations on could lock people out (AC-42).** Mitigation: slice 3's migration step test, plus INT sign-in for every seed account.
7. **Stale edge-function code or the wrong mount.**
   - Restart the edge runtime after every function edit (FN does this).
   - Slice 0 confirms the mount.
   - Never start the stack from another worktree during stage 5.
8. **`amr` or clock surprises (S5).** Add exactly the observed method. For clock skew, record it and ask the lead before adding the allowance.
9. **The local cap fills during manual testing.** Tests plant rows instead of sending mail, and the README documents the reset.
10. **The rate-limit test blocks the IP.** It is opt-in and runs last, by hand (slice 33).
11. **Terms or Privacy approval arrives late.** The release waits (Decision 4). Slices 26–27 can go first, so Saurabh gets the drafts early.
12. **Public repo leaks.** Captured hook JSON and `amr` arrays go into the dev notes with fake addresses and no tokens. Scan new files before each commit. Stack output goes to the scratchpad only.
13. **A Supabase CLI upgrade mid-stage** would change GoTrue under the spikes. Don't upgrade until stage 5 is done.

## Stop conditions

Stop, write it up in `05-dev-notes.md`, and report to the lead. Don't improvise another design.

**Back to the Architect** (the design no longer holds):
1. **S1 hosted (a release gate, not a build stop):** the plan doesn't offer Before User Created. The build carries on. At release, don't run `deploy.sh`; the Architect re-plans the switch and the cap, and Saurabh hears that sign-up can't open safely.
2. **S6:** any GoTrue write after `Confirm()` puts a password hash back, or a null `encrypted_password` gives a 500 at sign-in.
3. **S3, or S1(c):** locally, `postgres` can't create the `before` triggers on `auth.identities` or `auth.users`, or can't delete from `auth.mfa_factors` or `auth.sessions`. Or a `security definer` hook called by `supabase_auth_admin` can't read `private.*` even with the grants.
4. **S5:** e-mail-link or Google sessions can't be told apart from password-only sessions. For example, a refreshed link session keeps only `token_refresh`, so the every-entry rule would refuse a genuine owner after an hour. Choosing between that dead end and loosening the rule is an architecture call.

**To the lead** (handled inside the design, but the lead must know):

5. S3: the `LinkAccount` order is the other way round. Take the "stored password" fallback.
6. S1(d) outcome B: the checks move into the linking trigger.
7. S4(b): the lead decides on confirm-on-deactivate; the default is keep.
8. A clock-skew allowance is needed.
9. An existing test needs a **behaviour** change, not just a new expectation, beyond those listed in slices 2, 3 and 8.

**To the PO:**

10. S2 finds no plain-text part. `[TBC AC-15]`; the lead's assumption Q1 already accepts "the link is visible as text".

**Never, whatever happens:** a hosted command, `--linked`, `deploy.sh` outside its test, or a catch-all `amr` value.

## Deferred (from 01, not dropped)

1. **D1:** mock tests and any other user features.
2. **D2:** posts for signed-in users only.
3. **D3:** magic-link sign-in, and Google sign-in for invited staff, student and parent accounts.
4. **D4:** mobile: a "use the website for now" screen for users, then user features and provider sign-in on mobile. Needs a store release.
5. **D5:** optional marketing consent at sign-up, and sending sign-ups to Kit or Zoho.
6. **D6:** admin delete, edit, search and export of users; self-service account deletion. In v1, deletion is by e-mail.
7. **D7:** promoting a user to staff.
8. **D8:** cleaning up sign-ups not finished after N days.
9. **D9:** a "you already have an account" e-mail.
10. **D10:** showing admins when the daily cap is reached. Busy shows as open on the Users page.
11. **D11:** student self sign-up, with whatever age rule applies then.
12. **D12:** moved under D15.
13. **D13:** "Connected accounts": linking Google to an existing account by hand. `enable_manual_linking` stays `false`.
14. **D14:** Facebook sign-in, with 02's Facebook safeguard.
15. **D15:** Apple sign-in, including Hide My Email relay addresses.

Also not in v1:
- a Terms link in the public footer (lead's assumption Q4; offer it as a one-line follow-up);
- an Auth send-email hook to cap resends (R2's later option).

Removed ACs: AC-3, AC-9 and AC-49.

## Definition of done

1. Slices 0–33 are ticked and committed on `feature/open-sign-up`, one commit per slice, each with the trailer. None touches `actionItems.md`, `brand/email/` or `docs/contracts/`. Nothing is pushed unless the lead asks.
2. **The full check is green:** FULL (scoped Prettier, lint, typecheck, `pnpm test` with `test-deploy-order.mjs`, and `VITE_APP_ENV=production pnpm build`). Also green: DB, FN (with `test-open-sign-up.mjs`), E2E, CSP, Lighthouse, and the opt-in rate-limit run. The before and after counts are in `05-dev-notes.md`.
3. **Every live AC's test passes**, as mapped in 03 §10:
   - AC-1, 2, 4–8, 10–48, 50–55;
   - S1–S7 each have their committed test;
   - AC-40's mobile check is left to the Tester, and recorded as such.
4. `05-dev-notes.md` records:
   - each spike's outcome and the branch taken;
   - the captured hook `event` shape;
   - the real `amr` arrays;
   - S3's callback error shapes;
   - S4(b);
   - the AC-42 migration step test;
   - what wasn't verified.
5. **Docs and README runbooks are updated** (slice 31):
   - `supabase/README.md` (local accounts, sign-up locally and the cap reset, first-admin SQL, close sign-up);
   - root `README.md`;
   - `go-live.md` §0;
   - `ci-gates.md` counts and scripts;
   - `deploy.sh` header and `NEXT` text.
6. **Decisions are drafted:**
   - the DEC-OS-* entries, plus the 03 and review-3 changes and R3, in `release-notes.md`, ready for the lead to copy into `_knowledge/decisions.md`;
   - the ADR-0011 row in `docs/decisions/README.md`, marked Proposed (Accepted at merge).
7. **Release notes for Saurabh** (`release-notes.md`) include:
   - the Terms and Privacy approvals;
   - the read-only "Before User Created" hook check;
   - the deploy order;
   - the Google Cloud OAuth client steps and the one-line `enabled = true` switch;
   - closing sign-up, the Resend Pro trigger, rollback, R1–R3, and what wasn't verified.
8. The stack is handed to the Tester: restarted from the main checkout, on a fresh seed, with the cap empty, the switch open, and 5173 free.
