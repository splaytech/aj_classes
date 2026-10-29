# 05 — Developer notes: invites stay valid for 14 days

> **Stage:** 5 of /deliver (Developer) · **Date:** 29 Oct 2026 · **Branch:** `feature/invite-14-days`
> (worktree `/Users/sjain/dev/work/aj_classes-invites`, from `6a7d861`)
> **Input:** [04-plan.md](04-plan.md) (checklist T0–T9), [03-design.md](03-design.md) (build spec).

Sections are filled as each task is ticked in 04.

## T0. Local stack serves this worktree

- **T0.1:** the team lead announced the restart to `aj_classes-hiring` (nobody testing there) and
  stopped the `main` checkout's dev server on 5173 before this stage started.
- **T0.2:** `pnpm db:stop && pnpm db:start` from this worktree (data kept, no reset).
- **T0.3** (after every restart below): the edge runtime mount count for
  `aj_classes-invites/supabase/functions` is `1`; newest applied migration = newest file; 5173 is
  served by `pnpm --filter web dev` started by the Developer, cwd
  `/Users/sjain/dev/work/aj_classes-invites/apps/web`.
- **Local web env:** the worktree had no `apps/web/.env.local` or `.env.development.local`, so the
  portal would have been switched off. Both were copied from the `main` checkout (gitignored,
  local values only: `VITE_SUPABASE_URL=http://127.0.0.1:55321`).
- **T0.4 baseline on the untouched branch (`6a7d861`):**

  | Gate | Result |
  |---|---|
  | `pnpm test:functions` | green, 232 checks: `test-account-admin` 49, `test-leads` 30, `test-notifications` 153 |
  | e2e smoke | 9/9 passed (1.1 min) |
  | Left-overs | 0 `e2e-%` profiles, auth users and posts. 5173 is the Developer's own dev server (no server started by the smoke) |

## T1. Spikes (29 Oct 2026, local stack only)

Scripts were kept in the session scratchpad, not the repo. The service key was read from
`supabase status -o json` at run time and never written down. Every spike user was deleted.

### S1, the recovery hop: **passed** (no fallback needed)

| Case | `generateLink({ type: 'recovery' })` | `POST /auth/v1/verify { type: 'recovery', token_hash }` | `auth.users.invited_at` |
|---|---|---|---|
| (a) never-confirmed `admin/users` (createUser) account | 200, `verification_type = recovery`, `user.id` = the account | 200, session for that user. The e-mail is now confirmed; profile stays `invited` | `null` before and after |
| (b) the same account, now confirmed but still `invited` | 200, `recovery`, same id | 200, session for that user | unchanged |
| (c) an Auth-invited account (`/auth/v1/invite`) | 200, `recovery` | 200, session for that user | unchanged (same timestamp) |
| Deleted e-mail | **404 `user_not_found`** | — | `auth.users` count 6 before and after (no user created) |

So accounts are created without `email_confirm: true`, as 03 designs.

### S2, `functions serve --env-file`: **yes, it overrides `[edge_runtime.secrets]`**

With `EMAIL_TRANSPORT=off` in a scratch env file, `supabase functions serve --env-file <file>` made
`notifications` answer `503 config_missing` (it answers `401 not_allowed` with the config value
`mailpit`). There were no queued outbox rows, so nothing was flagged.

**Gotcha:** stopping `functions serve` removes the `supabase_edge_runtime_aj_classes` container.
Every function then answers `503 name resolution failed` until `pnpm db:stop && pnpm db:start`.
So an email-off run via S2 costs the same restart as the config edit. The T0.3 checks passed after
that restart.

### S3, First-admin path in local Studio (`http://127.0.0.1:55323`, Authentication → Users)

1. **Add user** (green button, top right) → menu item **Create new user** (the other item is
   **Send invitation**, which must not be used now).
2. Dialog **Create a new user**: **Email address**, **User Password** (**required**: an empty one
   shows `Password is required`), **Auto confirm user?** (ticked by default), button **Create user**.
3. Click the user's row → side panel, section **Reset password** → button **Send password recovery**
   ("Send a password recovery email to the user").

### S4a, can Mailpit refuse a send? **Yes: HTTP 400**

`POST /api/v1/send` in `mailpitRequest`'s shape with `To` = `has space@local.test`, `no-at-sign` or
an empty string → `400 {"Error":"invalid To address: …"}` each time. `outcomeForStatus(400)` is
`failed rejected`, so the full S4 sequence becomes an automated check in T5.5 (03 §9 S4).

## T2. Migration and pgTAP

- `supabase/migrations/20261030100000_invite_tokens.sql` is 03 §2 byte for byte. The copied
  `handle_updated_auth_user()` differs from `20261023100000` lines 69–83 only in the guarded
  `invited_at` line (checked with `diff`).
- `supabase migration up` applied only `20261030100000`. Newest applied version is now
  `20261030100000`; `invited` profiles with a non-null `invited_at`: `0` (there were 0 invited
  profiles locally before, so step 6 had nothing to clear here).
- `supabase/tests/database/invite_tokens.test.sql`: rows #1–#18 of 03 §3 with the three traps
  (`proconfig` as `text[]`, one `client_ip_hash` per group, table selects as in
  `enquiries.test.sql`). Not wrapped in an extra transaction.
- `pnpm db:test`: **18 files, 834 tests, PASS** (baseline 17 files, 747). The local seed is intact
  afterwards (6 auth users).
- `pnpm db:types`: adds the three RPCs (`grep -c invite_token_` = 3); `pnpm typecheck` clean.

## T3. Shared modules, no behaviour change

- `notifications/transport.ts` moved (`git mv`) to `_shared/email/transport.ts`: sender from
  `./sender.ts`, third parameter `idempotencyKey`, warn label `email send refused`, header comment.
- New: `_shared/email/{sender,config,html}.ts`, `_shared/sha256.ts`, `_shared/client-address.ts`,
  `_shared/invite-token.ts`. `notifications/config.ts` keeps the worker-secret half;
  `isUsableConfig` = `isSafeEmailConfig(config) && (!hosted || secret !== local)`, the same truth
  table. `notifications/copy.ts` lost `SENDER` and `COPY.from`.
- `test-notifications.mjs` changed only in its import lines.
- `pnpm test:functions`: **green, 232 checks** (49 / 30 / 153, identical to T0.4).
  `grep -rn "notifications/transport" supabase/` finds nothing.

### T3 correction (found in T4): the local edge runtime does not hot-reload

`supabase start` serves functions without watching files, so the T3 run above still exercised the
**old** code. After T4's first run showed old-format emails, `docker restart
supabase_edge_runtime_aj_classes` (same mount, T0.3 mount check `1`) loaded the new code. Re-run on
it: `test-leads` 30 and `test-notifications` 153 checks, both green, and leads and notifications
are unchanged since T3, so the no-behaviour-change proof holds. **Rule for the rest of this stage
and for the Tester: after any edit under `supabase/functions/`, `docker restart
supabase_edge_runtime_aj_classes` before testing.**

## T4. account-admin sends our own invite

- New pure modules: `account-admin/invite-copy.ts`, `invite-email.ts`, `issue-invite.ts`.
  `handlers/accounts.ts`: `createInvitedAccount` (staff get no `app_metadata`) and
  `sendAccountInvite`; `sendInvite` and `sendSetupLink` removed. The four handlers per 03 §4.2.
- `supabase/scripts/test-invite-redeem.mjs` unit section: token, render for tutor, admin, student
  and parent, `issueInvite` orderings: **59 checks green**.
- `local-test-helpers.mjs`: `serviceKey`, `adminApi`, `mailpitText`, `mailsTo`, `latestMailTo`,
  `mailpitTotal` (03 §7 lists four; `mailsTo` and `mailpitTotal` were added for the "exactly one
  email" and "no email" counts).
- `test-account-admin.mjs`: **92 checks green** (49 before). Added: the new link pattern and no
  old link, token row = SHA-256 of the token, unused, `invited_at = sent_at` (staff, student,
  parent, both re-sends); re-send gives a new token and moves `invited_at` on (AC 12, 24);
  AC 20 refused callers (signed out, invalid token, tutor, student, parent, admin without
  two-step, each for invite / resend / cancel) with no token, mail, audit or account change;
  AC 22 audit once per action; AC 35 one email per send; AC 41 no mail and no token when linking.
- **Deviation (test only):** locally a call with only the publishable key gets past Kong, so a
  signed-out invite gets `not_admin` 403, not 401. AC 20 allows either; the check accepts both. An
  invalid bearer token does get the gateway's 401.
- **Visible:** invited `dev-t42-…@local.test` from Staff → Invite staff in the browser (5173 from
  this worktree). Mailpit: subject `You're invited to the AJ Classes portal`, link
  `http://localhost:5173/portal/invite?token=<43 chars>`, line `This link expires in 14 days and
  works once. …`.

## T5. invite-redeem

- `invite-redeem/redeem.ts` (pure) and `index.ts` (wiring) per 03 §4.3. Logging lives in
  `logRedeemOutcome()` in `redeem.ts`, so the unit section can assert it (reason name only;
  `rate_limited`, `mismatch`, `stray_user_removed` at warn).
- **T5.1** unit section: every branch; the five-row identity table (both `recovery` rows: `deleteUser`
  never called, `release` once; only "another user, magiclink, < 60 s" deletes); release on each
  post-claim refusal and on a thrown `emailOf`/`recoveryLink`; a thrown claim releases nothing.
- **T5.2** boot proof after the T5.4 restart: `OPTIONS` → `204`; `POST {"token":"x"}` →
  `200 {"ok":false,"code":"invite_invalid"}`.
- **T5.3** `git diff supabase/config.toml` adds only the `[functions.invite-redeem]` block;
  `otp_expiry = 3600` unchanged. `deploy.sh` `FUNCTIONS=(account-admin invite-redeem leads
  notifications)`; `bash -n` passes.
- **T5.4** stack restarted (announced at stage start; nobody on `aj_classes-hiring`). T0.3: mount
  `1`, migration `20261030100000` = newest file, 5173 cwd this worktree's `apps/web`.
- **T5.5** integration section: HTTP cases 1–6 (case 7, a 500, needs a failing database or Auth and
  is covered by the unit section; the script prints a `skip` line), AC 1–4, 7, 10–18, 16, S1 on
  real accounts, rate limit (fresh `x-forwarded-for` per redeem; 11th from one address refused,
  another address works), REST `Accept-Profile: private` → `406 PGRST106` for both tables as the
  publishable key and as a tutor, `generateLink` unknown e-mail → `404` with no user created,
  **S4b automated** (re-send to `has space@local.test` → `email_failed`; `invited_at` and
  `invite_resent` unchanged; the previous link still signs in), and the AC 8 leak check (token,
  its hash and the returned `tokenHash` absent from `docker logs supabase_edge_runtime_aj_classes`
  and `audit_log`). AC 11: 14 refusal kinds, all `200` and byte-identical.
- **Deviation (fixture only):** AC 17's password sign-in needs a confirmed e-mail
  (`email_not_confirmed` otherwise). A real joined account always confirmed it when it signed in
  to finish setup, so the fixture's `PUT /auth/v1/admin/users/<id>` sends
  `{ password, email_confirm: true }` (03 §8.1 item 6 sends only the password). The Tester should
  do the same.
- `package.json` `test:functions` runs four scripts: **green, 416 checks** (`test-account-admin` 92,
  `test-leads` 30, `test-notifications` 153, `test-invite-redeem` 141). The function log holds only
  `invite-redeem <reason>` lines.

## T6. Web

| Task | Change | Proof |
|---|---|---|
| T6.1 | `INVITE_LIMITS` (336 h, days derived), `PORTAL_ROUTES.invite`, `PORTAL_QUERY.inviteToken`, `PORTAL_SEO.invite`, `INVITE_DIALOG.intro` (14 days); `AUTH_LINK_ERRORS.invite` removed; `AUTH_LIMITS.linkExpiryHours` comment now says reset links only | `constants/invite-copy.test.ts` (3 tests: AC 26, AC 32) |
| T6.2 | `lib/account-status.ts` uses `INVITE_LIMITS.linkLifetimeHours`, strict `<` | `account-status.test.ts`: 13 d, 13 d 23 h → invited; 336 h exactly, 14 d 1 min, null → expired |
| T6.3 | `invokeEdgeFunction` extracted (account-admin and leads unchanged), `services/invites.service.ts`, `confirmRecoveryLink` (always `type: 'recovery'`), `invite_invalid → inviteExpired`, exports | `invites.service.test.ts` (9 tests: mapping, missing `tokenHash` → `unknown`, retry exactly once on `network`, not on `linkExpired`) |
| T6.4 | `lib/invite-steps.ts` | `invite-steps.test.ts` (11 tests, every §5.4 row) |
| T6.5 | `/portal/invite` route and `invite.tsx` | `invite.test.tsx` (9 tests: missing, ready with no call on render, garbled shows Continue, `replaceState` before `redeemInvite`, checking, refused (redeem and hop), both Try-again paths). **Browser:** UI invite → Mailpit link opened 3 times → Continue → `/portal/join`, `location.search` = `''`; the same link in a fresh context → AC 9 |
| T6.6 | `auth-confirm.tsx` refuses `type=invite` with no request; recovery unchanged | `auth-confirm.test.tsx` (4 tests). **Browser (375 px):** old-format fixture → Continue → AC 9 text and sign-in link, 0 `/auth/v1/verify` requests, `last_sign_in_at` still null |
| T6.7 | `Invited on` hidden when null (`admin-staff-member.tsx`, `admin-student.tsx`) | **Browser:** an invited account with no `invited_at` shows `Invite expired`, `The link has expired. Send a new one.`, and no `Invited on` line |

- **Deviation (mechanical):** `invite.tsx` keeps the token with `useState(() => searchParams.get(…))`
  captured on first render, instead of a `useRef` set on click. Same effect (Try again never reads
  the address bar), and it avoids reading a ref during render.
- **Whole web:** `pnpm lint && pnpm typecheck && pnpm test` green: web **74 files, 645 tests**
  (baseline 69 / 606), e2e unit 6/6.

## T7. Docs

- `supabase/README.md`: `test:functions` row; Edge functions paragraph (invites through
  `EMAIL_TRANSPORT`, `invite-redeem` with `verify_jwt = false`, "start the stack from the worktree
  you test" with the mount check, and **`docker restart supabase_edge_runtime_aj_classes` after
  editing function code**, from the T3/T4 finding); First admin rewritten with the S3 labels
  (**Add user → Create new user**, password required, **Send password recovery**; don't use **Send
  invitation**); new `### Invites (ADR-0010)` before "Portal emails" (lifetime, storage, local flow,
  rate-limit clear command, troubleshooting, Auth-log note, restore SQL); both kill switches.
- `docs/architecture/arch.md` (Auth bullet, functions list, §7 email), `docs/budget.md` (Resend row),
  `docs/requirements/invite-onboarding.md` (pointer line).
- Every quoted command was run once on the local stack: the mount check, the edge-runtime restart,
  the rate-limit `delete`, the restore SQL (`UPDATE 0`). The First-admin path was run in a browser:
  a confirmed user with a password + a recovery link → Continue → `/portal/join`.
- `pnpm format:check` clean.

## T8. e2e

- `e2e/src/db/invites.ts`: `clearInviteRedeemAttempts()`, `backdateInvite(email, interval)`.
- `invite-onboarding.spec.ts`: new link pattern; the link is back-dated 13 days before use (AC 1
  in the browser, and the reason `backdateInvite` is used, not just exported); the rate limit is
  cleared; the link is opened 3 times before Continue (AC 6); `location.search` is `''` after
  Continue (AC 8); after the account is active, the same link in a new context shows AC 9 (AC 7).
  New second test: an invited `auth.users` row with no `invited_at` shows `Invite expired`, the
  expired warning and no `Invited on` on the staff member page (AC 25).
- Smoke: **10/10 passed** (1.2 min) against the stack and a 5173 dev server both from this
  worktree. Afterwards: 0 `e2e-%` profiles, auth users and posts; the only listener on 5173 is the
  Developer's dev server (cwd `aj_classes-invites/apps/web`).

## T9. Full check, manual proofs, handover

### T9.1 Gates (from this worktree, final code at `797a25f`)

| Gate | Command | Result |
|---|---|---|
| Full check | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build` | green: Prettier clean, lint and typecheck clean, web **75 files, 647 tests** (baseline 69 / 606), e2e unit 6/6, build OK. `VITE_APP_ENV=development pnpm check` also green |
| pgTAP | `pnpm db:test` | **18 files, 834 tests, PASS** (baseline 17 / 747); again after the final `db:reset` |
| Functions | `pnpm test:functions` | **4 scripts, 416 checks, 0 failed** (`test-account-admin` 92, `test-leads` 30, `test-notifications` 153, `test-invite-redeem` 141) |
| E2E smoke | `node e2e/scripts/local-env.mjs > e2e/.env && pnpm --filter aj-classes-e2e test:smoke` | **10/10** (stack and 5173 both from this worktree); 0 `e2e-%` rows after |
| Rule checks | `kinet validate` | not run: the CLI says "KINET not initialised" in this repo. Instead: no `console.log` outside the Node test scripts, no TODO, no inline styles, no `document.getElementById`/`innerHTML`, no `text.secondary`, no secrets in the diff |
| Diff hygiene | `git diff develop -- supabase/config.toml`; `git diff develop --stat -- supabase/templates` | only the `[functions.invite-redeem]` block; `otp_expiry = 3600`; templates untouched |

### T9.2 Browser pass (5173 from this worktree; headless Chromium; 84/84 checks)

Fixtures through `account-admin`, dates back-dated in the local database (03 §8.1 item 2), all
deleted afterwards. Admin views at 1280 light, 1280 dark, 375 light and 375 dark; invitee pages at
both widths and both schemes; every page measured for sideways scroll (none).

- **Staff list:** fresh and 13-day invites show `Invited`; 14 d 1 min shows `Invite expired` (AC 23).
- **Staff member:** 13 days shows `Invited on …` and no warning; 14 d 1 min shows `Invite expired`
  and `The link has expired. Send a new one.` (AC 23). **Resend invite** → chip `Invited`,
  `Invited on 29 Oct 2026, 2:29 pm` (AC 24).
- **Students list:** `Invited` and `Invite expired` chips in the Account column (AC 23).
- **Student page:** expired account shows the warning `The invite link has expired. Send a new
  one.`; the expired parent row shows `Invite expired`; a fresh one shows neither (AC 23). Resend
  on the account and on the parent row clears both (AC 24).
- **Invite staff dialog:** `… The link works for 14 days; you can resend it.` (AC 26).
- **Invitees:** staff (13 days old, AC 1), staff (fresh), student and parent: Continue →
  `/portal/join`, `location.search` empty (AC 8). Staff 14 d 1 min (AC 3) and the joined account
  (AC 17) → AC 9 with `Already set up your account? Sign in`. No token → `This link is
  incomplete…`, no Continue (AC 10). The joined account then signs in with its password (AC 17).
- **Old-format link** (T6.6, 375 px): AC 9, no `/verify` request, nobody signed in (AC 38).
- Screenshots: session scratchpad `browser/shots/t92-*.png` (not in the repo).

**Found and fixed in T9.2 (deviation, small):** none of the three **Resend invite** buttons (staff
member page, student account, parent row) reloaded the page data. After a re-send the page kept
the old `Invited on` date and, for an expired invite, `Invite expired` plus the warning right next
to `A new invite link has been sent.`, which breaks AC 24 and misleads the admin. This was there
before this branch, but the 14-day rule makes it visible. Fix: after a **successful** re-send the
page revalidates (`onChanged`), the same pattern as cancel; a failed re-send doesn't. Proof:
`admin-staff-member.test.tsx` (2 tests) and the browser checks above. Commit `797a25f`.

### T9.3 Email-off run (S2's `functions serve --env-file`, `EMAIL_TRANSPORT=off`; 14/14)

`config.toml` was not edited. Afterwards `functions serve` was stopped, the stack restarted
(`pnpm db:stop && pnpm db:start`), and T0.3 passed (mount `1`, migration `20261030100000`, 5173 cwd
this worktree). `git diff develop -- supabase/config.toml` still shows only the T5.3 block.

- **AC 36/21:** staff, student and parent first invites → `email_failed`; no `auth.users` or
  `profiles` row for any of the three; the roster row is still unlinked; nothing reached Mailpit.
  The **Invite staff** dialog and the staff member page both show `The invite e-mail couldn't be
  sent. Please try again.` The function log shows `invite email config missing` (6 times).
- **AC 39:** re-send → `email_failed`; account, `invited_at` and the stored token row unchanged; no
  `invite_resent`. After email came back on, the link from before the failed re-send still signed
  in (redeem `ok` + `/verify` session for that account).
- **AC 41:** linking `parent@local.test` works with email off: `linked: true`, `parent_linked`
  written, no token row, no email.

### AC trace

"Redeem script" = `supabase/scripts/test-invite-redeem.mjs`; "admin script" =
`supabase/scripts/test-account-admin.mjs`; "browser" = T9.2/T9.3 above.

| AC | Evidence |
|---|---|
| 1 | Redeem script `AC 1: a link 13 days old works and the hop signs in as that account`; e2e (link back-dated 13 days before Continue); browser (staff 13 days → `/portal/join`) |
| 2 | Redeem script `AC 2: a link 13 days 23 hours old works…` |
| 3 | Redeem script `AC 3: a link 14 days 1 minute old is refused`; pgTAP #13 (exactly 336 h refused); browser |
| 4 | Redeem script `AC 4: a link 15 days old is refused` |
| 5 | Method 03 §8.1 item 2, used by the redeem script (`backdate`), `e2e/src/db/invites.ts` `backdateInvite` and the browser pass; local only |
| 6 | `invite.test.tsx` (no call on render); e2e opens the link 3 times, then Continue works |
| 7 | Redeem script `AC 7: the same link a second time is refused`; e2e (fresh context → AC 9); pgTAP #9 |
| 8 | `invite.test.tsx` (`replaceState` before `redeemInvite`); e2e `location.search === ''`; redeem script AC 8 leak check (token, hash, `tokenHash` absent from function logs and `audit_log`); audit details are `{ email }` only |
| 9 | `invite.test.tsx` refused state; `auth-confirm.test.tsx`; browser (heading, message, sign-in link to `/portal/login`) |
| 10 | `invite.test.tsx` (no token → `invalidLink`, no button; `abc` → Continue); redeem script `"abc" (AC 10) → 200 invite_invalid`; browser |
| 11 | Redeem script AC 11: 14 refusal kinds (garbled ×5, used, expired ×2, replaced, cancelled, active, inactive, unknown, rate-limited), all `200` and byte-identical |
| 12 | Redeem script `AC 12/13 … (staff)`, `AC 12 (student)`, `AC 12 (parent)`; admin script `Resend invite: a new token…` |
| 13 | Redeem script `AC 13: after two re-sends the first link is refused`, `and the second`, `only the newest link works` |
| 14 | Redeem script AC 14 (first link signs in and confirms the e-mail; re-send is the invite email; its link signs in) |
| 15 | Redeem script `AC 15` (refused, token row gone); admin script `Cancel invite: account removed, and its token row with it`; pgTAP #16 |
| 16 | Redeem script `AC 16: re-sent on day 10, the new link still works 13 days after the re-send`, and the day-0 link is refused |
| 17 | Redeem script AC 17 (refused, `last_sign_in_at` unchanged, password sign-in works); pgTAP #14; browser (refused, then password sign-in) |
| 18 | Redeem script AC 18 (refused, never signed in); pgTAP #14 |
| 19 | Admin script existing checks (`already_exists`, `already_joined`, `already_has_account`, parent linked), unchanged and green |
| 20 | Admin script: signed out → 403 `not_admin` (local Kong lets the publishable key through; AC 20 allows it), invalid token → 401, tutor / student / parent × invite / resend / cancel → 403 `not_admin`, admin without two-step → `not_admin`; then no token, email, audit entry or account changed |
| 21 | `consent_needed` (admin script, unchanged); `issueInvite` unit (send fails → store not called); email-off run (no account left, roster unlinked, message shown) |
| 22 | Admin script: `invite_sent`, `student_invited`, `parent_invited`, `invite_resent`, `invite_cancelled`, `parent_linked` each once |
| 23 | `account-status.test.ts` (13 d, 13 d 23 h, 336 h, 14 d 1 min, null); browser on Staff, staff member, Students, student page (account + parent rows) |
| 24 | Admin script `Resend invite: invited_at moved on to the re-send`; browser (chip and `Invited on` update after Resend, all three buttons); `admin-staff-member.test.tsx` |
| 25 | Migration step 6 (`0` invited profiles with a date after `migration up`); e2e AC 25 test; `account-status.test.ts` (null → expired); browser T6.7 |
| 26 | `invite-copy.test.ts`; browser (dialog text) |
| 27 | pgTAP #18; the migration drops and renames nothing (Reviewer to confirm) |
| 28 | Redeem script unit (subject, heading, label, wording per role, button, ignore line); admin script (Mailpit subject and `From: AJ Classes <hello@ajclasses.com.au>`); `test-notifications.mjs` (`resendRequest` `from`/`reply_to`) |
| 29 | Redeem script unit (exact AC 29 line in HTML and text; no `1 hour`) |
| 30 | Redeem script unit (`Accept invite: <link>` in text); e2e reads the link from `Text` |
| 31 | Redeem script unit and admin script (link is `http://localhost:5173/portal/invite?token=…`, no `supabase`, no `auth/confirm`). Hosted: Saurabh's release step 5 |
| 32 | `invite-copy.test.ts` (`AUTH_LIMITS.linkExpiryHours === 1`, `FORGOT_PASSWORD_PAGE.sent` ends `It expires in 1 hour.`); `supabase/templates/` untouched |
| 33 | `git diff develop -- supabase/config.toml`: only the functions block; `otp_expiry = 3600` |
| 34 | `staff-login.spec.ts` in the 10/10 smoke; existing auth unit tests in the 647 |
| 35 | Admin script `exactly one e-mail` checks for staff, student, parent and re-send; e2e |
| 36 | `pickTransport` null (test-notifications, unchanged); email-off run |
| 37 | Re-send cancels the old link (AC 12/13) and used link refused (AC 7): redeem script + e2e. Expired link refused (AC 3): redeem script. Failed re-send keeps the previous link: **automated** S4b in the redeem script, plus `issueInvite` unit and the email-off run. (So the manual-fallback wording sign-off in 04 risk 4 isn't needed; the PO may still confirm) |
| 38 | `auth-confirm.test.tsx` (no service call); browser with the old-format fixture (no `/verify` request, nobody signed in) |
| 39 | Redeem script S4b (automated); `issueInvite` unit; email-off run (unchanged state, message, previous link still works) |
| 40 | Admin script `invited_at = sent_at` after staff, student, parent invites and both re-sends; pgTAP #5, #17 |
| 41 | Admin script `linking sends no e-mail and makes no invite link`; email-off run |

### Not verified here

1. Hosted anything: production web, `deploy.sh`, Resend API sends, hosted Auth logs, the hosted
   origin rule (local Kong adds `Access-Control-Allow-Origin: *`). These are Saurabh's release
   steps in 04 §7.
2. HTTP case 7 (a real `500 server_error`): needs a failing database or Auth. Covered only by the
   unit section (a throw releases the claim and propagates).
3. Mobile (`aj_classes_mobile`) against the new data: D1, unchanged by this branch.
4. Real mail clients' rendering of the new HTML (only Mailpit's text and HTML were checked).

### Handover

**Stack handed to the Tester at `797a25f` (code; this notes commit sits on top), mount checked.**

- Supabase stack started from `/Users/sjain/dev/work/aj_classes-invites`; edge runtime mount
  check `1`; newest migration `20261030100000`; final `pnpm db:reset` done, so the database holds
  the plain seed (6 auth users, 0 invite tokens, 0 redeem attempts).
- Port 5173 is **free**: the Developer's dev server is stopped. Start one from this worktree
  (`pnpm --filter web dev`); `apps/web/.env.local` and `.env.development.local` were copied from
  the `main` checkout (gitignored, local values).
- `e2e/.env` was regenerated by `local-env.mjs` (gitignored).
- **After any edit under `supabase/functions/`, run `docker restart supabase_edge_runtime_aj_classes`**:
  the local runtime doesn't reload code.
- Ownership of the stack passes to the Tester with this note.

## Fix batch 1 (review-5 and 06-security, both APPROVED; one round)

The Developer owned the stack and :5173 again for this batch.

| # | Source | Change |
|---|---|---|
| 1 | Security finding 1 (Medium) | **Link format is now `${SITE_URL}/portal/invite#token=<43 chars>`** (the fragment, never sent to a server, its logs or a Referer). `inviteLink()` builds `#token=`; the web reads it from `location.hash` (`inviteTokenFromHash`, new `PORTAL_FRAGMENT.inviteToken`; `PORTAL_QUERY.inviteToken` removed). **The token is wiped from the address bar on first load** (`useEffect` → `history.replaceState(null, '', '/portal/invite')`), keeping only the in-memory copy; Continue no longer touches the address bar. A `?token=` query is ignored. Updated: email link, constants, `invite.test.tsx`, `invite-steps.test.ts`, `test-account-admin.mjs` and `test-invite-redeem.mjs` link patterns, the e2e regex (and the e2e now checks the address bar is already `/portal/invite` before Continue, and has no search or hash after it), README, 02, 03, 04 (release step 5) and ADR-0010 decision 2 |
| 2 | Security finding 2 | `invite-redeem` never deletes a user. Any mismatch, whatever the type, refuses `mismatch`, releases the claim and logs `console.warn('invite-redeem', 'mismatch')`. Removed `deleteUser`, `now`, `userCreatedAt` and `stray_user_removed`. **Deviation from the approved 03 §4.3 (simplification):** the one-line rule is updated in 03 §4.3 step 6, 02 §4 (both places), ADR-0010 decision 4, and the 03 §8.2 identity table (3 rows, none deletes) |
| 3 | Security finding 4 | README "Kill switches" now has three: the third is `update private.invite_tokens set used_at = now() where used_at is null;` (then re-send), with `supabase functions delete invite-redeem --project-ref …` as the hard stop. The SQL was run once locally (`UPDATE 0`) |
| 4 | Security finding 5 | `respond()` (`_shared/responses.ts`) sends `Cache-Control: no-store` on every function reply. Seen on a local `invite-redeem` reply |
| 5 | Review-5 #2 | New `admin-student.test.tsx` (4 tests): a re-send on the student account or on a parent row reloads; a failed one doesn't. `admin-staff-member.test.tsx` now waits for the reload to finish (a race the full run exposed) |
| 5b | Tester P-1 (flaky `admin-staff-member.test.tsx:81`, 1 in 4 runs on `d35311c`) | The success notice appears before the reload finishes. The test now waits for the reload with `waitFor` before asserting the expired warning is gone and counting loader calls; `admin-student.test.tsx` uses the same pattern. **Full `pnpm test` run 4 times in a row: 76 files / 655 tests, 0 failed each time** |
| 6 | Review-5 #3 | Unit case: `recoveryLink` null and `release` rejects → `redeemInvite` rejects (a 500), release tried once, nothing deleted |
| 7 | Review-5 #4 | Renamed to `10 redeems from one address fill the bucket (each refused as an unknown link)` |

### Gates (final code at the fix-batch commits below)

| Gate | Result |
|---|---|
| Full check (`format:check && lint && typecheck && test && VITE_APP_ENV=production build`) | Green. Web **76 files, 655 tests** (was 75 / 647), e2e unit 6/6 |
| `pnpm db:test` | **18 files, 834 tests, PASS** |
| `pnpm test:functions` | **4 scripts, 413 checks, 0 failed**: account-admin 92, leads 30, notifications 153, invite-redeem **138** (was 141: the identity table went from 5 rows × 2 checks to 3 × 2, and the release-rejects case adds 1) |
| E2E smoke | **10/10**, against this worktree's stack and a dev server started from it; 0 `e2e-%` rows after |
| Browser: new link format | **14/14**, on the dev server (:5173) **and on a production build**. That build is a local-Supabase gate build (ADR-0005: `VITE_APP_ENV=production` plus the local URL, publishable key and Turnstile test key), served by `pnpm mirror` on :4173 with the production headers (portal CSP, `Cache-Control: no-store`) and grepped for the hosted ref. Each server: the email link is `/portal/invite#token=<43>`; Continue shows (review-5 #1); the address bar is `/portal/invite` straight after load; a reload shows `This link is incomplete…` with no Continue; the link opened in a new tab + Continue lands on `/portal/join`; the used link is refused in a fresh context. For the :4173 origin, the functions ran under `supabase functions serve --env-file` with `ALLOWED_ORIGINS` adding `http://127.0.0.1:4173` (`config.toml` not edited). Afterwards: serve, mirror and dev server stopped, stack restarted, T0.3 passed |

### Found while checking (for the Tester; not changed)

- After the strip, **opening the link again in the same tab** (pasting it, or a mail client that
  reuses the tab) is only a fragment change, so the already-loaded page keeps showing `This link is
  incomplete…`. Opening it in a new tab, or reloading with the link, works. This is the same
  family as "a reload after the strip shows the incomplete state", which the coordinator said is
  expected. If it matters, the fix is to adopt a new token on `hashchange`. I left it for a
  decision rather than add state handling outside the brief.

### Handover (again)

Stack handed back to the Tester at the fix-batch docs commit, mount checked. It was started from
this worktree: mount check `1`, newest migration `20261030100000`, final `pnpm db:reset` done (6
auth users, 0 invite tokens). :5173 and :4173 are free; no `functions serve` or mirror is running.
`apps/web/build/` holds the local-Supabase gate build (gitignored); rebuild before any check that
needs the hosted-origin build.
