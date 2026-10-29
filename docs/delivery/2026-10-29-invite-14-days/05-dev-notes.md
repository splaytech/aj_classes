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
