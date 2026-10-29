# 04 — Build plan: invites stay valid for 14 days

> **Stage:** 4 of /deliver (Manager) · **Date:** 29 Oct 2026 · **Branch:** `feature/invite-14-days` (worktree `/Users/sjain/dev/work/aj_classes-invites`, at `dee64b8`)
> **Input:** [01](01-requirement.md) (approved, AC 1–41), [02](02-architecture.md) (approved),
> [ADR-0010](../../decisions/0010-own-invite-token-with-supabase-sign-in-hop.md),
> [03](03-design.md) (approved, review-3 round 2), [review-1](review-1.md), [review-2](review-2.md), [review-3](review-3.md).
> **Next stage:** the Developer builds on this branch, top to bottom, ticking this file as each task is tested.

How to use this file:

- Tick a task (`- [x]`) only after its **Verify** passes. Record results, spike answers and any deviation in `05-dev-notes.md`.
- One or more conventional commits per task, local only. `/test-and-ship` pushes. Keep the untracked `actionItems.md` (main checkout) and `e2e/.env` out of every commit.
- "03 §n" points at the design. 03 is the source for code; this file sets order, proof and ownership.
- One known gap, on purpose: from T4 until T6.5 the local invite flow is broken end to end. New emails carry `/portal/invite` links before that page exists, so `invite-onboarding.spec.ts` is red until T8. Every other suite stays green at every task.

---

## Baseline (run by the Manager on `dee64b8`, 29 Oct 2026)

| Check | Command | Result |
|---|---|---|
| Format | `pnpm format:check` | Clean repo-wide |
| Lint, typecheck | `pnpm lint && pnpm typecheck` | Clean |
| Unit | `pnpm test` | 69 files, 606 tests |
| One Vitest file | `pnpm --filter web exec vitest run src/lib/account-status.test.ts` | 1 file, 6 tests. (`pnpm --filter web test -- <file>` ignores the filter and runs all 606) |
| Build | `VITE_APP_ENV=production pnpm build` | OK |
| pgTAP | `pnpm db:test` | 17 files, 747 tests, PASS |
| E2E list | `node e2e/scripts/local-env.mjs > e2e/.env && pnpm --filter aj-classes-e2e exec playwright test --list` | 9 tests in 5 files |
| Functions | `pnpm test:functions` | **Not run.** It writes to the shared stack, and the edge runtime serves a deleted worktree (below). The scripts pass `node --check`. T0.4 is the first real run |
| E2E smoke | `pnpm --filter aj-classes-e2e test:smoke` | **Not run**, same reason. T0.4 |

Prettier is clean repo-wide, so `pnpm format` won't touch unrelated files. Still prefer
`pnpm exec prettier --write <files you changed>`.

**Stack state found (29 Oct 2026, read-only):**

- The edge runtime mounts `/host_mnt/Users/sjain/dev/work/aj_classes-items-4-9/supabase/functions`, a worktree that no longer exists.
- The DB container's workdir label is `aj_classes-fixes`, and the newest applied migration is `20261029100000`, which matches this branch.
- Docker prints the mount with a `/host_mnt` prefix. So 03 §8.1 item 1's check ("must show `/Users/…`") must be a substring match, as below.
- Worktrees sharing the stack:
  - `/Users/sjain/dev/work/aj_classes` (`main`);
  - `/Users/sjain/dev/work/aj_classes-hiring` (`feature/privacy-job-applicants`, clean, newest migration `20261027100000`);
  - this one.
- **Port 5173 is held** by a `pnpm dev` started from `/Users/sjain/dev/work/aj_classes/apps/web` (the `main` checkout) at 11:32 today. The e2e global setup reuses any server already on 5173. So until it's stopped, the smoke and every browser pass would test `main`'s web code, not this branch's.

---

## 1. Checklist

### T0. Local stack serves this worktree (03 §8.1 item 1)

- [ ] **T0.1 Announce.** Tell the team lead before the restart, because the restart briefly stops the stack for `aj_classes-hiring` too. The team lead tells whoever works there. Ask them to stop the `main` checkout's dev server on 5173: it isn't the Developer's process, so the Developer doesn't kill it.
- [ ] **T0.2 Restart from this worktree** (data is kept; **not** `db:reset`). The output prints local keys, so it goes to a scratch file:
  `cd /Users/sjain/dev/work/aj_classes-invites && pnpm db:stop && pnpm db:start > <scratchpad>/db-start.txt 2>&1`
- [ ] **T0.3 Mount and migration checks.** Repeat these after **every** restart in this plan (T5.4, the email-off runs):
  - `docker inspect supabase_edge_runtime_aj_classes --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' | grep -c aj_classes-invites/supabase/functions` prints `1` (it printed `0` at the baseline);
  - `docker exec supabase_db_aj_classes psql -U postgres -Atc "select max(version) from supabase_migrations.schema_migrations"` prints the newest file in `ls supabase/migrations | tail -1`;
  - `lsof -nP -iTCP:5173 -sTCP:LISTEN` shows nothing, or a process whose cwd (`lsof -a -p <pid> -d cwd -Fn`) is anywhere under `/Users/sjain/dev/work/aj_classes-invites/` (the repo root or `apps/web`, depending on how it was started).
- [ ] **T0.4 Baseline on the untouched branch**, so later failures are clearly ours:
  - `pnpm test:functions` is green;
  - `node e2e/scripts/local-env.mjs > e2e/.env && pnpm --filter aj-classes-e2e test:smoke` gives 9/9.

  Record both counts in `05-dev-notes.md`. Afterwards, check no `e2e-%` rows are left, and that nothing the smoke started still listens on 5173 (Tester addendum).

**Verify:** all three T0.3 checks pass, and T0.4 is green.

### T1. Spikes S1–S4 (03 §9 step 2; answers in `05-dev-notes.md`)

Local stack only, with the service key from `supabase status -o json` kept in a scratch file. Clean up every user a spike creates.

- [ ] **T1.1 S1, the recovery hop.** On (a) a never-confirmed `auth.admin.createUser` account and (b) a confirmed but still `invited` one: `generateLink({ type: 'recovery' })`, then `POST /auth/v1/verify { type: 'recovery', token_hash }`, gives a session for that user, and `auth.users.invited_at` is unchanged. `generateLink` for a deleted e-mail gives 404, and the `auth.users` count is unchanged.
  - **Gate:** if (a) fails, create accounts with `email_confirm: true`, record it, and go on. **Any other failure stops the build** and goes back to the Architect.
- [ ] **T1.2 S2, env override.** Does `supabase functions serve --env-file <scratch>/email-off.env` override `[edge_runtime.secrets]`? Record yes or no. "No" means every email-off run uses the 03 §8.1 item 5 config edit and a restart.
- [ ] **T1.3 S3, the First-admin path.** The exact Studio (`http://127.0.0.1:55323`) labels for **Add user** and **Send password recovery**. Note whether a password is required. T7 uses them.
- [ ] **T1.4 S4a, can Mailpit refuse a send?** Before any code, `POST` to Mailpit's send API (as `mailpitRequest` builds it) with a `To` that has a space or no `@`. Record the HTTP status.
  - **Non-2xx:** the full S4 sequence (03 §9 S4 steps 1–5) becomes an automated check in T5.5, because it needs a new-format link first.
  - **2xx:** use the manual email-off run (T9.3). The Product Owner signs off the AC 37 wording in the TSR, and the Tester records it there.

**Verify:** `05-dev-notes.md` has a dated answer for S1–S4a, and S1 passed or took its recorded fallback.

### T2. Migration and pgTAP (03 §2, §3)

- [ ] **T2.1** Write `supabase/migrations/20261030100000_invite_tokens.sql` exactly as in 03 §2 (comments may be reworded), then run `supabase migration up`.
  - **Verify:** the T0.3 migration check prints `20261030100000`, and `docker exec supabase_db_aj_classes psql -U postgres -Atc "select count(*) from public.profiles where status = 'invited' and invited_at is not null"` prints `0` (step 6 ran; AC 25).
- [ ] **T2.2** Write `supabase/tests/database/invite_tokens.test.sql` (03 §3, rows 1–18, and the three traps). Don't wrap it in your own transaction.
  - **Verify:** `pnpm db:test` gives 18 files, PASS.
- [ ] **T2.3** Run `pnpm db:types`.
  - **Verify:** `grep -c "invite_token_" apps/web/src/services/database.types.ts` is 3 or more, and `pnpm typecheck` is clean.

### T3. Shared modules, with no behaviour change (03 §4.1)

- [ ] **T3.1** Create `_shared/email/{transport,sender,config,html}.ts`, `_shared/sha256.ts`, `_shared/client-address.ts` and `_shared/invite-token.ts`. Delete `notifications/transport.ts`, and repoint `notifications/*`, `leads/rate-limit.ts` and `test-notifications.mjs` at the shared files.
  - **Verify:** `pnpm test:functions` is green with the same check counts as T0.4, and `grep -rn "notifications/transport" supabase/` finds nothing. This is the "no behaviour change" proof; nothing in T4 starts before it.

### T4. `account-admin` sends our own invite (03 §4.2)

- [ ] **T4.1** Write the pure modules `invite-copy.ts`, `invite-email.ts` and `issue-invite.ts`. Create `supabase/scripts/test-invite-redeem.mjs` with its **unit** section: token, render for tutor, admin, student and parent, and the `issueInvite` orderings (03 §8.3 item 1, first three bullets).
  - **Verify:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON supabase/scripts/test-invite-redeem.mjs` is green.
- [ ] **T4.2** Edit `handlers/accounts.ts` (`createInvitedAccount`, `sendAccountInvite`; remove `sendInvite` and `sendSetupLink`) and the four handlers, per 03 §4.2 "Per action".
  - **Visible:** invite a staff member from the portal. Mailpit shows `You're invited to the AJ Classes portal`, a `/portal/invite?token=` link (43 chars), and the 14-day line.
- [ ] **T4.3** Update `test-account-admin.mjs` (03 §8.3 item 2): the link pattern, token row ≠ token, `invited_at = sent_at`, AC 20 callers with "no change" counts, AC 22 audit counts, AC 41.
  - **Verify:** `pnpm test:functions` is green.

### T5. `invite-redeem` (03 §4.3)

- [ ] **T5.1** Write `invite-redeem/redeem.ts`, and add every `redeemInvite` branch to the unit section, including the five-row identity table (03 §8.2): **no `deleteUser` on `recovery`**, and release on each refusal after the claim and on a throw.
  - **Verify:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON supabase/scripts/test-invite-redeem.mjs` is green, and its unit section asserts all five identity rows. In both `recovery` rows the fake `deleteUser` is **never called**, and `release` is called once.
- [ ] **T5.2** Write `invite-redeem/index.ts` (wiring and logging per 03 §4.3).
  - **Verify:** no Deno CLI is installed here (`which deno` finds nothing), and the repo has no type check for functions, so the proof is that the function boots. After the T5.4 restart:
    `curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS http://127.0.0.1:55321/functions/v1/invite-redeem -H 'Origin: http://localhost:5173'`
    must print `204`. A `503` with `BOOT_ERROR` in the body means an import or syntax error: check `docker logs supabase_edge_runtime_aj_classes --since 5m`. Tried on 29 Oct 2026: `leads` gave `503 BOOT_ERROR` while the mount pointed at a deleted folder, so the check does catch failures. The Reviewer also reads the `jsr:` imports against `leads/index.ts`.
- [ ] **T5.3** Add the `[functions.invite-redeem]` block to `config.toml`, and `invite-redeem` to `FUNCTIONS` in `deploy.sh`.
  - **Verify:** `git diff supabase/config.toml` shows only that block (AC 33), and `bash -n supabase/scripts/deploy.sh` passes.
- [ ] **T5.4** Restart the stack (the new `verify_jwt` setting). Announce it first, as in T0.1, then rerun the T0.3 checks.
- [ ] **T5.5** Add the integration section of `test-invite-redeem.mjs`:
  - HTTP cases 1–7 and the "Script" ACs of 03 §8.2;
  - REST can't reach `private` (406 `PGRST106`);
  - the rate limit with a unique `x-forwarded-for` per run;
  - `generateLink` for an unknown e-mail gives 404;
  - S4b if T1.4 said non-2xx.

  Append the script to `test:functions` in `package.json` (03 §7).
  - **Verify:** `pnpm test:functions` runs four scripts, all green. The AC 8 log check (03 §8.1 item 7) prints `0` for the token, the hash and the `tokenHash`.

### T6. Web (03 §5)

Per-file proof: `pnpm --filter web exec vitest run <test file>`. Whole-web proof at the end of T6: `pnpm lint && pnpm typecheck && pnpm test`.

- [ ] **T6.1** Constants: `INVITE_LIMITS`, `PORTAL_ROUTES.invite`, `PORTAL_QUERY.inviteToken`, `PORTAL_SEO.invite`, `INVITE_DIALOG.intro`; remove `AUTH_LINK_ERRORS.invite`. Add `constants/invite-copy.test.ts` (AC 26, 32).
- [ ] **T6.2** `lib/account-status.ts` uses the 336 h rule; replace the 1-hour cases in `account-status.test.ts` with the AC 23 samples plus null → expired.
- [ ] **T6.3** Services: `invokeEdgeFunction`, `invites.service.ts`, `confirmRecoveryLink`, `invite_invalid` → `inviteExpired`, and the exports. Add `invites.service.test.ts` (retry once on `network` only).
- [ ] **T6.4** Add `lib/invite-steps.ts` and `invite-steps.test.ts`, covering every row of the 03 §5.4 table.
- [ ] **T6.5** Add the `/portal/invite` route, `invite.tsx` and `invite.test.tsx` (five states, no call on render, `replaceState` before `redeemInvite`, both Try-again paths).
  - **Visible:** Mailpit link → `Continue` → `/portal/join` in the browser (5173 served from this worktree, T0.3). The address bar has no `?token=`.
- [ ] **T6.6** `auth-confirm.tsx` refuses `type=invite` locally; add `auth-confirm.test.tsx`.
  - **Visible:** the old-format fixture (03 §8.1 item 4) shows AC 9.
- [ ] **T6.7** Hide `Invited on` when it's null (`admin-staff-member.tsx`, `admin-student.tsx`).
  - **Visible:** a pending invite from before the migration shows `Invite expired` and no `Invited on` line.

### T7. Docs (03 §6)

- [ ] **T7.1** Make the `supabase/README.md` edits in 03 §6 item 1: the `test:functions` row, the Edge functions paragraph with the "start from the worktree you test" line, First admin (from S3), the new `### Invites (ADR-0010)` section, both kill switches, and the restore SQL.
- [ ] **T7.2** Edit `docs/architecture/arch.md`, `docs/budget.md:57` and `docs/requirements/invite-onboarding.md` (03 §6 items 2–4).
  - **Verify:** `pnpm format:check` is clean. Every path and command quoted in the new README text exists, or was run once.

ADR-0010 → Accepted, DEC-IN-1…8 into `_knowledge/decisions.md`, and the Tester addendum's smoke count (9 → 10) are the **team lead's** at stage close, not this diff.

### T8. e2e (03 §8.3 item 6)

- [ ] **T8.1** Add `e2e/src/db/invites.ts` (`clearInviteRedeemAttempts`, `backdateInvite`).
- [ ] **T8.2** Edit `invite-onboarding.spec.ts`: the new link pattern, clearing the rate limit, three opens before `Continue`, empty `location.search`, and the reused link refused in a new context. Add the second AC 25 test.
  - **Verify:** `pnpm --filter aj-classes-e2e test:smoke` gives **10/10**. Afterwards, no `e2e-%` rows are left and nothing the smoke started holds 5173.

### T9. Full check, manual proofs, handover

- [ ] **T9.1 Full check** (definition of done, §5).
- [ ] **T9.2 Browser pass** at 5173 from this worktree: as the admin, plus an invitee for each of staff, student and parent; light and dark; 375 px and 1280 px.
  - Cover AC 1 and AC 3 (back-dated per 03 §8.1 item 2), AC 17 sign-in (03 §8.1 item 6), and AC 23 on Staff, the staff member page, Students and the student page.
- [ ] **T9.3 Email-off run** (03 §8.1 item 5, or S2's env file): AC 21, 36, 39, 41.
  - Revert `supabase/config.toml` afterwards, restart, and rerun T0.3.
  - **Verify:** `git diff supabase/config.toml` again shows only the T5.3 block.
- [ ] **T9.4** Fill `05-dev-notes.md`:
  - the spike answers and any deviations from 03;
  - the AC trace (§6) with the evidence for each AC;
  - "stack handed to the Tester at `<commit>`, mount checked".

---

## 2. Ownership of shared state

- **During stage 5 the Developer is the single owner of the local Supabase stack and the local database.**
  - Only the Developer runs anything that changes state:
    - `pnpm db:stop` / `db:start`, and `supabase migration up`;
    - `pnpm db:types`, `pnpm db:test`, `pnpm test:functions` and the e2e smoke;
    - SQL that writes (back-dating, fixtures, clearing the rate limit);
    - the local `config.toml` email-off edit;
    - Mailpit deletes.
  - **Nobody resets.** `pnpm db:reset` isn't in this plan for anyone. If the data gets into a bad state, the Developer fixes it with targeted SQL and records that in `05-dev-notes.md`.
- **Everyone else is read-only** during stage 5. That covers the Reviewer, Security, the Tester preparing `06-test-plan.md`, and any session in `aj_classes-hiring` or the `main` checkout. They may run `select` queries, `docker inspect`, `docker logs` and Mailpit reads, and read files. They don't restart, migrate, run test suites that write, or start a dev server on 5173.
- **Handover.** Ownership passes to the Tester only when `05-dev-notes.md` records the handover (T9.4). From then on the Tester is the single owner, and the Developer is read-only while fixing bugs, unless the Tester hands the stack back.
- **Files.** The Developer owns every file in 03 §7 and this checklist's ticks. A parallel subagent (a Reviewer or Security pass) edits none of them and commits nothing. `actionItems.md` (main checkout) is untouched.

---

## 3. Risks

1. **Tests run someone else's code.** Two ways: the edge runtime still mounts a deleted worktree, and 5173 is served from the `main` checkout, which the e2e setup reuses.
   - *Mitigation:* the T0.3 checks after every restart, and before T6.5, T8 and T9.
2. **A restart interrupts `aj_classes-hiring`.**
   - *Mitigation:* announce it via the team lead (T0.1, T5.4). There are only two planned restarts, plus the email-off pair.
3. **S1 fails** (the recovery hop doesn't sign in an unconfirmed account).
   - *Mitigation:* the `email_confirm: true` fallback. Any other failure stops the build at T1, before any code is written.
4. **S4a: Mailpit accepts any address**, so AC 37/39 can't be automated end to end.
   - *Mitigation:* the `issueInvite` ordering unit test plus the manual email-off run (T9.3). The Product Owner signs off the AC 37 wording in the TSR, and the Tester records it there. Review-3 accepted this.
5. **The local email-off edit leaks.** If `EMAIL_TRANSPORT = "off"` stays in `config.toml`, it could be committed. And `deploy.sh` runs `supabase config push` and copies `[edge_runtime.secrets]` from that file. Its secret check fails when `EMAIL_TRANSPORT` isn't `resend`, so the deploy would stop loudly.
   - *Mitigation:* the T9.3 diff check, and Saurabh deploys from a clean, up-to-date `main` (release step 2).
6. **The invite e2e is red from T4 to T8.** This is expected.
   - *Mitigation:* nothing is pushed until `/test-and-ship`. Don't hand over before T8.
7. **The local rate limit trips.** Every browser and e2e request shares one address.
   - *Mitigation:* clear the bucket first (03 §8.1 item 3). The Node script uses a unique `x-forwarded-for`.
8. **Migration order at merge.** If another branch lands a later migration first, ours must be renamed (ADR-0007 §4). `aj_classes-hiring` is at `20261027100000` today.
   - *Mitigation:* `ls supabase/migrations | tail -1` on `develop` just before the merge.
9. **Production web from `main` is not verified** (`docs/architecture/arch.md:18`).
   - *Mitigation:* release step 1 checks it on the live URL. A not-found page means stop.
10. **Hosted `invite-redeem` deployed with the gateway check on**, which makes every redeem 401.
    - *Mitigation:* the release step 2 `curl` check expects `invite_invalid`.
11. **Resend sender not verified** for API sends (03 risk 10). Every invite would then fail with `email_failed`. That is fail-safe (no account is left behind), but invites are down.
    - *Mitigation:* release step 4, done before step 1.
12. **Re-sending a backlog uses the Free plan's 100/day**, which app email shares.
    - *Mitigation:* count the pending invites before release step 5. If there are more than about 50, spread them over two days.
13. **Accepted, restated:**
    - a closed tab after `Continue` uses up the link;
    - `x-forwarded-for` can be spoofed;
    - old Auth tokens still work directly against Auth for up to 1 h after release (release step 6 removes this);
    - mobile shows `Invite expired` after 1 h until D1 ships.
14. **Stale project note.** `_agents/devops.md` says Railway rebuilds `main`. The host is Vercel (`_knowledge/decisions.md` item 10, `arch.md`). This doesn't affect this build. The team lead corrects the addendum.

---

## 4. Deferred scope (Later bucket, from 01 "Scope")

1. **D1:** mobile status rule, 14 days in `account_status.dart`. Needs a mobile change and a store release. **Saurabh still has to decide** whether it follows straight away (01 "For Saurabh" item 7).
2. **D2:** the exact expiry date and time in the email and on the admin page.
3. **D3:** failed or undelivered invites on the admin Emails list.
4. **D4:** telling "used" apart from "expired" in the refusal. Held back on purpose (AC 11).
5. **D5:** a reminder email to invitees who haven't joined after N days.
6. **D6:** removing the unused Supabase invite template and `[auth.email.template.invite]`. Clean-up only.

Also deferred, from 03 risk 5: mapping supabase-js `FunctionsFetchError` to `network` for every function call.

---

## 5. Definition of done

1. Every box in §1 is ticked, each with its Verify passed.
2. **Full check** from this worktree, all green:
   `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build`
   (baseline 606 unit tests; the count only goes up).
3. **`pnpm db:test`**: 18 files, PASS (baseline 17 files, 747 tests).
4. **`pnpm test:functions`**: all four scripts green, including `test-invite-redeem.mjs`.
5. **E2E smoke**: `node e2e/scripts/local-env.mjs > e2e/.env && pnpm --filter aj-classes-e2e test:smoke` gives 10/10, against a stack and a 5173 both served from this worktree (T0.3). No `e2e-%` rows are left afterwards.
6. **Every AC 1–41 traced** in `05-dev-notes.md` (§6 below), each with the test name or manual evidence. The Tester re-proves them in the TSR at stage 6.
7. **Diff hygiene:**
   - `git diff develop -- supabase/config.toml` adds only the functions block, and `otp_expiry = 3600` is unchanged (AC 33);
   - `supabase/templates/` is untouched (AC 32, D6);
   - no `console.log`, no TODO without a ticket, no literals in JSX, no inline styles;
   - no token, hash, e-mail or user id is logged;
   - `actionItems.md` and `e2e/.env` aren't committed.
8. Docs from T7 are updated in the same branch.

---

## 6. AC trace (where each AC is built, and where it is first proved)

| AC | Built in | First proof |
|---|---|---|
| 1–4, 16 | T2, T5 | `test-invite-redeem.mjs` (back-dated); AC 1 and 3 also by browser, T9.2 |
| 5 | T2 | Method in 03 §8.1 item 2; Tester |
| 6, 8, 9, 10 | T6.5 | `invite.test.tsx`; e2e T8 (AC 6, 8); script (AC 8 logs, AC 10 `abc`) |
| 7, 11, 12, 13, 15, 18 | T5 | `test-invite-redeem.mjs`; e2e T8 (AC 7) |
| 14 | T4, T5 | `test-invite-redeem.mjs` (T5.5: redeem + verify, resend, Mailpit invite subject, new link works) |
| 19, 20, 22, 24, 28–31, 35, 40, 41 | T4 | `test-account-admin.mjs` + unit section; pgTAP #5, #17 (AC 40); e2e (AC 30, 35) |
| 17 | T5, T9.2 | Script (refused) + browser password sign-in |
| 21, 36, 39 | T4 | `issueInvite` unit; S4b or the email-off run (T9.3) |
| 23, 25 | T6.2, T6.7, T2.1 | `account-status.test.ts`; e2e AC 25 test; browser T9.2 |
| 26, 32 | T6.1 | `invite-copy.test.ts`; `recovery.html` untouched |
| 27 | T2 | pgTAP #18; Reviewer reads the migration |
| 33 | T5.3 | `git diff supabase/config.toml` |
| 34 | none (unchanged) | `staff-login.spec.ts` and the existing auth unit tests, T9.1 |
| 37 | T4, T5 | Script + e2e (AC 7, 12); unit + S4b/T9.3 (failed re-send) |
| 38 | T6.6 | `auth-confirm.test.tsx`; browser with the old-format fixture |

---

## 7. Release steps for Saurabh (production is yours)

**Timing:** do step 4 and start step 6's quiet hour **before** step 1. Steps 1 → 2 → 3 → 5 then run back to back, with no invites between 1 and 2. Staging shares the hosted project, so don't test invites on staging between the `develop` merge and step 2.

1. **Production web (`main`) is live.** Merge `develop` → `main` and wait for Vercel's production deploy to finish. Then open https://ajclasses.com.au/portal/invite with no token. It must show `This link has expired or has already been used.` and `This link is incomplete. Please use the button in the email.` A not-found page means production isn't serving the new build yet (`arch.md:18` says this binding is unverified): **stop**, and don't run step 2.
2. **`supabase/scripts/deploy.sh`**, from a clean, up-to-date `main` checkout (`git status` empty, so no local `config.toml` edits).
   1. First run `supabase link --project-ref unzjnxctkyahtmrkinyr`. It asks for the hosted database password (your password-manager item for the Supabase DB, the same value as `SUPABASE_DB_PASSWORD` in `supabase/.env.deploy`). Then run `supabase db push --dry-run`. It should list only `20261030100000_invite_tokens.sql`.
   2. Then run `supabase/scripts/deploy.sh --dry-run`. Step 5/6 should list `account-admin invite-redeem leads notifications`.
   3. Then run it for real.
   4. Afterwards, check the gateway setting and the origin rule with a junk token. This is a shape refusal, so it touches no data:

      ```bash
      curl -s -X POST https://unzjnxctkyahtmrkinyr.supabase.co/functions/v1/invite-redeem \
        -H 'Origin: https://ajclasses.com.au' -H 'Content-Type: application/json' \
        -H 'apikey: <PUBLISHABLE_KEY from supabase/scripts/deploy.sh:23>' -d '{"token":"x"}'
      ```

      It must print `{"ok":false,"code":"invite_invalid"}`. A 401 means `verify_jwt` didn't deploy as `false`.
3. **`supabase secrets list --project-ref unzjnxctkyahtmrkinyr`**: `EMAIL_TRANSPORT`, `RESEND_API_KEY` and `SITE_URL` are listed, and `MAILPIT_URL` isn't. `deploy.sh` checks `EMAIL_TRANSPORT` and `SITE_URL` itself, but not `RESEND_API_KEY`, so look for that one by eye.
4. **Resend sender verified.** In the Resend dashboard, Domains: `ajclasses.com.au` is **Verified**, so `hello@ajclasses.com.au` can send through the API. This closes 03's TBC (risk 10). If it isn't verified, don't release: every invite would fail with "The invite e-mail couldn't be sent".
5. **Re-send pending invites.**
   1. First, a smoke: invite yourself as staff on an address you own. Open the email, check the link starts `https://ajclasses.com.au/portal/invite?token=`, click `Continue`, and check you land on `/portal/join`. Then cancel that invite.
   2. Then, on Staff and Students, `Resend invite` every account showing `Invite expired`. The migration cleared their dates, so every pending invite shows this.
   3. Count them first. They share the Free plan's 100 emails a day with app email.
6. **No invites in the hour before release** (and none between steps 1 and 2). Old-format Auth links last an hour. A quiet hour means no live old-format token exists at release, which closes the accepted "usable directly against Auth for up to 1 h" exposure. It also means no invite you send is refused straight away.
7. **A rollback goes back together** (02 §9). Never roll back only the web or only the functions.
   1. Redeploy the previous `main` on Vercel, and the previous `develop` on staging.
   2. Redeploy `account-admin` and `notifications` from that same commit.
   3. Optionally run `supabase functions delete invite-redeem --project-ref unzjnxctkyahtmrkinyr` (it's harmless if left).
   4. The migration stays: it is additive. Afterwards, restore pending invite dates with the README's restore SQL (production SQL is yours to run), or re-send them.

After release, the team lead closes the stage. That means ADR-0010 → Accepted, DEC-IN-1…8 into `_knowledge/decisions.md`, and your D1 decision recorded.
