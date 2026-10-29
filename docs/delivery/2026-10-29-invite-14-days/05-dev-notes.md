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
