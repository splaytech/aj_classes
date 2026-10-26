# 05 — Developer notes: item 8 ("new assignment" and "due tomorrow" emails)

> **Stage:** 5 of /deliver (Developer) · **Date:** 26 Oct 2026 · **Branch:** `feature/more-email-alerts`
> (worktree `aj_classes-items-4-9`, cut from `develop` @ `8e2af88`, whose CI run is green)
> **Input:** [01b](01b-requirement-items-4-9.md) item 8 (AC-8.1–8.17, assumptions 10–12),
> [02b](02b-architecture-items-4-8.md) §8, [ADR-0008](../../decisions/0008-scheduled-and-multi-kind-email.md)
> (extends [ADR-0004](../../decisions/0004-email-outbox-cron-worker.md)), [03b](03b-design-items-4-8.md) §8 and §9,
> [04b](04b-plan-items-4-8.md) §0 and T8.0–T8.12.
> **Next:** T8.13 Reviewer (`review-5-item-8.md`), then T8.14 Tester, T8.15 Security and T8.16 `/test-and-ship`.
> Nothing is pushed or merged.

Everything ran against the **local** stack only (`http://127.0.0.1:55321`). Email went only to the
local Mailpit (`:55324`). Nothing touched the hosted project: no `link`, `db push` or
`functions deploy`, no `deploy.sh` run, no real Resend key. I didn't read `supabase/.env.deploy`.
There's one migration, one function change and no new dependency. 0 browser requests went to
`supabase.co`.

## 1. Tasks done

| Task | Status | Evidence |
|---|---|---|
| T8.0 Stack checks, migration file | Done | Check 1 (edge-runtime mount) printed `1`, the mount being `/Users/sjain/dev/work/aj_classes-items-4-9/supabase/functions`. Check 2 printed `20261027100000` before the file existed. `email_outbox_kind_check`, `email_outbox_reason_check` and `email_outbox_once` present. File: `supabase/migrations/20261028100000_more_email_alerts.sql` |
| T8.1 Switches, outbox columns, Melbourne helpers | Done | Steps 1–3. DST and schedule row, deadline helper, defaults (`email_alerts.test.sql`) |
| T8.2 One recipient function | Done | Steps 4 and 7. Switch-per-kind cases. `fair_results.test.sql` AC-7.14 call renamed. Item 3's AC-3.1/3.2 green |
| T8.3 Queue on publish, hourly reminder job | Done | Steps 5–6. AC-8.1, 8.3, 8.4, 8.5, 8.6, 8.11, 8.12, 8.15 (queue half), cron job row |
| T8.4 Claim, sweep, admin list, clean-up | Done | Steps 8–11. AC-8.7, 8.13, 8.14, 8.15. Deploy-order proof (§4). `pnpm db:types`: only `database.types.ts` changed |
| T8.5 Worker renders three kinds | Done | `copy.ts`, `template.ts`, `index.ts`, `test-notifications.mjs`: +58 checks, two Mailpit round trips |
| T8.6 Three switches | Done | `notifications.service.test.ts` (9). Browser §3 leg 1 |
| T8.7 Type column | Done | `email-problems.test.ts`. Browser §3 leg 2 |
| T8.8 Privacy sentence | Done | 03b §8.9 sentence, `privacy.test.tsx`. Approval is B17 / Q7 (docs only, no code comment) |
| T8.9 Docs | Done | `supabase/README.md` ("Portal emails"), `arch.md`, `budget.md` ("pending Q27"), `release-5/PRP.md`, `release-2/go-live.md` §7d |
| T8.10 Manual passes | Done, scripted (§3) | Some legs left for the Tester (§7) |
| T8.11 Full check | Done | §2 |
| T8.12 Dev notes | Done | This file |
| T8.13–T8.16 | **Not started** | |

I didn't tick 04b. The Manager owns that file.

## 2. Commits and full check

Commits (oldest first):

1. `4712c7b` feat(email): add alert switches, outbox deadlines and Melbourne-time helpers (T8.0, T8.1)
2. `d5c3f7b` feat(email): pick email recipients per kind through one function (T8.2)
3. `d2e23b1` feat(email): queue new-assignment emails on publish and due-tomorrow reminders hourly (T8.3)
4. `00b26ca` feat(email): claim by supported kind, reminders first, and expire late rows (T8.4)
5. `3c127b2` chore(types): regenerate database types for the new email kinds (T8.4)
6. `466a857` feat(email): send new-assignment and due-tomorrow emails from the worker (T8.5)
7. `f8cfb93` feat(email): three notification switches and a Type column on Admin → Emails (T8.6, T8.7)
8. `d6c4eb6` feat(privacy): name all three portal emails and their off switches (T8.8)
9. `5b5a00b` docs(email): document the three portal emails, the reminder job and the deploy order (T8.9)
10. `5b15ded` fix(email): keep the Type label on one line on Admin → Emails at 360 px (T8.10)
11. `4871269` docs(email): correct how many emails the seed queues on db reset (six, not four)
12. This file (docs commit).

The migration grows across commits 1–4, one step group per task. Between commits 3 and 4 the old
claim (no kind filter) would send new-kind rows with the "work returned" template; that state only
existed on this branch for a few minutes, locally, into Mailpit.

Full check, from the repo root, on `5b15ded`, after `pnpm db:reset`:

| Step | Result (before item 8, item 7's last run) |
|---|---|
| `format:check` | Pass |
| `lint` | Pass, 0 problems |
| `typecheck` (web + e2e) | Pass |
| `test` | Vitest **62 files, 533 tests** (62, 525); e2e unit 6/6 |
| Local-exports `VITE_APP_ENV=production pnpm build`, Turnstile test key | Pass |
| `pnpm --filter web check:hosted-ref build/client` | `0 files (of 153 scanned)` |
| `db:test` | **16 files, 704 tests, PASS** (15, 590). `email_alerts.test.sql` has 114 |
| `test:functions` | **227 `ok`, 0 failed** (169): account-admin 49, leads 30, notifications **148** (90). "All checks passed." ×3. Run twice: repeatable |
| `test:smoke` (in-repo, `e2e/.env` from `local-env.mjs`) | **9 passed** (44.3 s) |
| No-Supabase build (ci-gates.md flags), then `check:hosted-ref` | Pass, `0 files` |
| `test:csp` | **19 passed** (30.4 s) |

Rule checks: `kinet validate` reports "KINET not initialised" in this worktree, and I didn't run
`kinet init`. Instead I grepped the added lines of every changed TS/TSX/MJS file for
`console.log`/`console.debug`, `style={{`, `: any`, `TODO`, `fetch(`, `axios` and DOM queries:
0 matches. No secret-like strings or hosted project ref in the diff.

**Mutation check** (local database only, each followed by `pnpm db:reset`):

| Mutation | Tests that fail |
|---|---|
| Claim ordered by `created_at` only (no reminders first) | 3 (all three AC-8.14 cap cases) |
| `kick_email_worker` without the too_late sweep | 3 (AC-8.7 sweep, admin list, cap-full sweep) |
| `is_reminder_hour` on UTC + 10 (no DST) | 4 (the AEDT cases of both DST changes) |
| Reminder boundary `<= today` instead of `< today` | 1 (published the day before: no reminder) |

After the last reset: 704 tests, PASS.

## 3. Browser pass (T8.10; dev server :5173, Chromium via Playwright, scripted)

Seed data plus local-only rows, removed afterwards. Accounts: `student@local.test` (Aarav Demo),
`parent@local.test`, `tutor@local.test`, `admin@local.test` (two-step with the local seed key).
Widths 1280 and 360; light and dark through the portal's Appearance setting.

| Leg | Result |
|---|---|
| AC-8.10 / 8.17 Account → Notifications, student and parent, 4 variants each | Three switches in the order work returned, new work, due tomorrow, all on (no row). Labels 1 line, except "Email me when work is marked and returned" at 360 (2 lines, O1). 0 px overflow. Contrast 16.27 light, 15.19 dark. 0 console errors |
| AC-8.10 each switch is its own | Student turns off "new work" only and saves: "Saved. We'll remember this choice."; DB `true,false,true`; signs out (lands on `/portal/login`) and back in: still `on, off, on`. Parent does the same with "due tomorrow": DB `true,true,false`, kept after sign-in. Both turned back on (DB `true,true,true`) |
| AC-8.10 staff | Tutor and admin: Account page has no Notifications section and no switch |
| AC-8.13 / 8.7 Admin → Emails, 4 variants | Headers When, Type, Recipient, Assignment, State, Reason. Hand-made failed rows show "Due tomorrow · Failed · Too late to send", "New assignment · Failed · Too late to send", "Work returned · Failed · Rejected by email service". New intro text. No `@local.test` on the page. At 360 the table scrolls in its box (690 px in 326 px), page overflow 0. After `5b15ded` the Type stays on one line |
| AC-8.13 empty | "No failed or waiting emails", spanning 6 columns, 0 px overflow at 360 dark |
| AC-8.1 / 8.2 publish in the UI | Tutor clicks "Publish to class" on the seeded draft "Ratio worksheet" and confirms. "Published. Students can see it now.", no error. DB: `parent:pending,student:pending` `new_assignment` rows |
| AC-8.2 delivery by the real cron job | Both emails reached Mailpit **117 s** after the publish: "New work set: Ratio worksheet" and "New work for Aarav: Ratio worksheet" |
| AC-8.2 signed-out link | Each email's **View assignment** link, opened signed out at 360: `/portal/login?next=…`, then sign-in lands on `/portal/student/assignments/<id>` and `/portal/parent/children/<id>/assignments/<id>`, heading "Ratio worksheet". 0 overflow, 0 errors |
| AC-8.12 edge runtime stopped | `docker stop supabase_edge_runtime_aj_classes`; the tutor creates "Item 8 stop check" (paper) and publishes it in the UI: "Published…", no error alert, 0 console errors; rows `parent:pending,student:pending`. Then `docker start`; the container is running again |
| AC-8.17 both new emails at 360 | Mailpit's HTML view (`/view/<id>.html`) of the student and parent "new work" and "due tomorrow" emails, light and dark: 0 px overflow, "View assignment" button 180 px wide, body wraps cleanly |
| Requests to `supabase.co` | 0 |

The screenshots and JSON are in the session scratchpad, not the repo:
`/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/f3122f43-e1db-48f8-8b25-a31385abb4a2/scratchpad/item8-run/`
(`shots/`, `out/`). I looked at the parent switches at 360 dark, Admin → Emails at 360 dark,
and the "new work" (parent, 360 light) and "due tomorrow" (student, 360 dark) emails.

**Observations (not changed):**

- **O1.** At 360 px item 3's "Email me when work is marked and returned" wraps to 2 lines, so the
  first switch row is 48 px and the other two 38 px. The wording is item 3's.
- **O2.** At 360 px on Admin → Emails, the Assignment and Reason cells can wrap to 2 lines. That's
  item 3's layout; the table scrolls sideways as designed.
- **O3.** Pre-existing (item 7 O5): at 360 px the "DEV" marker overlaps the signed-in name.
- **O4.** Locally, every `pnpm db:reset` now queues 6 "new assignment" rows from the seed
  ("Word problems set 1", "Fractions quick quiz" and "Times tables warm-up", for Aarav and his
  parent), and the local cron sends them to Mailpit within 5 minutes. After the last reset the
  real `email-worker-kick` run at 05:00 UTC answered `claimed 8, sent 8` (the 6 plus the seed's 2
  "work returned"). The README says so.

## 4. Deploy-order proof (T8.4, ADR-0008 decision 6)

With the migration applied (commit 4) and `supabase/functions/notifications` **still item 3's
code** (no diff against `8e2af88`), `pnpm test:functions` ran against the new database:

- **169 `ok`, 0 failed**, "All checks passed." ×3, the same as item 7's last run.
- Before: outbox `new_assignment pending 6`, `work_returned pending 2`. After: `work_returned sent 2`,
  `new_assignment pending 4` (the end-to-end script deletes "Word problems set 1"'s rows). So the old
  worker, calling `notify_claim_emails` with no argument through PostgREST, claimed only
  "work returned" and left the new kinds pending.
- pgTAP pins the same rule: with no argument the claim returns only `work_returned`, and leaves the
  new kinds `pending`.

The reverse order (new function, old database) wasn't run: by design it gets `PGRST202` and stops
all email. The release steps keep migration first (README "Portal emails", go-live §7d).

## 5. Copied function bodies (for T2.15 and the Reviewer)

Each was checked as the current definition with
`grep -n "function <schema>.<name>" supabase/migrations/*.sql | tail -1` before copying, copied by
script from the exact lines below, and `diff` against the source shows only the listed change.

| Function | Source file | Lines | Change |
|---|---|---|---|
| `private.queue_work_returned_email()` | `20261025110000_work_returned_email.sql` | 149–165 | `create or replace`; the recipients line calls `private.email_recipients('work_returned', new.assignment_id, new.student_id)` |
| `public.notify_claim_emails()` → `(supported_kinds text[] default array['work_returned'])` | `20261025110000_work_returned_email.sql` | 189–239 | Dropped and recreated. Output gains `kind` (after `id`) and `due_on` (last). The skip step calls `email_recipients(o.kind, o.assignment_id, o.student_id, private.melbourne_date(o.send_before))`. The claim's inner select adds `x.kind = any (supported_kinds)` and `(x.send_before is null or x.send_before > now())`, ordered `(x.kind = 'due_tomorrow') desc, x.created_at`. The final select returns `c.kind` and `a.due_on`, same order |
| `private.kick_email_worker()` | `20261025110000_work_returned_email.sql` | 299–336 | `create or replace`; the too_late sweep straight after the reclaim update, before the first early return |
| `public.admin_email_problems(int)` | `20261025110000_work_returned_email.sql` | 365–399 | Dropped and recreated; `kind text` after `created_at` in `returns table`, and `o.kind` in the select |
| People set of `private.email_recipients` | `20261027100000_fair_results.sql` (`work_returned_recipients`, item 7's version) | 360–385 | Not copied verbatim: the two branches become a `people` CTE, and the per-branch readable and switch checks move to `email_still_relevant` (`'work_returned'` → `assignment_readable_by`) and one `case` on the kind's switch column. `work_returned_recipients` is then dropped |

Grants: `notify_claim_emails(text[])` and `admin_email_problems(int)` are revoked from `public, anon,
authenticated`, then granted to `service_role` and `authenticated` respectively, as
`20261025110000` lines 405–421 did. pgTAP checks both, and that none of the 10 new private helpers
is executable by `authenticated` or `anon`.

**Where these live now (for T2.15, copy from here, not from `20261025110000`)**, in
`20261028100000_more_email_alerts.sql`: `email_still_relevant` 105–126, `email_recipients`
133–164, `queue_new_assignment_emails` 179–203, `queue_due_tomorrow_emails_for` 219–238,
`queue_due_tomorrow_emails` 242–255, `queue_work_returned_email` 274–290, `notify_claim_emails`
305–358, `kick_email_worker` 366–409, `admin_email_problems` 419–453.

## 6. Deviations and `[ASSUMPTION]`s

- **D1. Two cited line ranges were off; the copies use the real ones.** 03b §8.2 step 8 cites
  `notify_claim_emails` as `20261025110000` lines 189–243. The function ends at **239**: 240 is
  blank and 241–243 are `notify_record_result`'s comment. Step 7 cites `queue_work_returned_email`
  as 149–163; it ends at **165** (`end;` and `$$;`). 03b §8.2 step 4 cites the people set as
  `20261025110000` lines 115–138; the current definition is item 7's, `20261027100000` lines
  360–385 (item 7 D1 had already found the original ends at 140). §5 has the ranges I used.
- **D2. Revokes sit with their step.** The private helpers are revoked at the end of steps 3, 4 and
  6, not all in step 11, so each commit's migration was complete. Step 11 keeps the drop of
  `work_returned_recipients` and the claim and admin grants. The final grants are the design's.
- **D3. `formatDueDate` joins `formatToParts` by hand**, because ICU versions differ on the
  separator ("Friday, 30 October"). Node gives "Friday 30 October", and the Deno edge runtime gave
  "Thursday 5 November" and "Tuesday 27 October" in the Mailpit emails.
- **D4. "Work returned" is byte-identical.** The template now has one shared shell and three
  renderers. A snapshot of `renderWorkReturned` (escaped title, CR/LF class name, no first name)
  before and after the refactor compares equal. `viewFeedbackUrl` is renamed `assignmentUrl`, since
  no test imported it.
- **D5. Extra pgTAP cases** beyond 03b §8.10:
  - editing a published assignment queues nothing more;
  - a student enrolled after publishing still gets the reminder (only "new assignment" skips later joiners);
  - the sweep runs when the cap is full;
  - draft work due tomorrow is never reminded;
  - exactly one of a day's 24 hourly runs passes the guard;
  - execute privileges on every new helper, and `work_returned_recipients` is gone;
  - the cron wrapper's count is tied to `is_reminder_hour(now())`, so the suite passes in any hour (it ran during the 15:00 Melbourne hour).
- **D6. Test fixture: tutors can't insert an explicit `id`** (column grant), so the "inserted
  straight as published" case inserts without one and finds the row by title.
- **D7. README section renamed "Portal emails"** with a line saying it was "Work returned emails".
  `deploy.sh`'s printed hint and the comment in the applied `20261025110000` migration still use
  the old name. I didn't edit an applied migration or the release script for a label.
- **D8. Type cell `nowrap`** (`5b15ded`), matching the When cell, after the 360 px pass showed "Due
  tomorrow" on two lines.
- **D9. T8.6 and T8.7 are one commit.** They share `types.ts` and `portal.constants.ts`, so
  neither typechecks alone.
- **D10. Files.** 25 changed, plus this file. Against 03b §8.1: all rows except #24
  `account.module.css` (not needed: the switch rows space themselves) and #23 go-live's ticks (the
  boxes are added unticked). One extra: `services/index.ts` exports `EmailKind`.
  The switches are a list (`NOTIFICATION_SWITCHES`, keys are the setting names), not three
  hand-written rows.
- **D11. `test-notifications.mjs` pauses both jobs** with one `jobname in (...)` filter, so the
  recovery command and the Ctrl-C handler cover both. Its round trips use the seeded draft "Ratio
  worksheet" (published by the tutor through REST) and "Fractions quick quiz" (moved to due tomorrow,
  published 3 days ago, through SQL). Both are restored, and their test rows deleted, in `finally`,
  so the runs don't use up the 70-a-day cap.
- `[ASSUMPTION — Security to confirm]` (01b assumption 11): both new switches default on. Built as
  designed. For T8.15.
- The 03b `[ASSUMPTION]`s hold as designed: no catch-up for a missed 15:10 run; moving a published
  assignment to another class doesn't notify the new class; `email_recipients` has the fourth,
  defaulted `queued_due_on`.
- **Privacy (T8.8):** the 03b §8.9 sentence replaces item 3's two. Approval stays with Saurabh,
  B17 / Q7, tracked in docs only.
- **budget.md (T8.9):** the upgrade rule is written as 02b Decision 1's proposal, **pending Q27**.
- **Not built (moved to T2.15, item 2 held):** the file hand-in parts of AC-8.1 and AC-8.5. No item 2
  code or migration is touched. Once item 2 redefines `is_online_assignment`, reminders cover file
  hand-in with no item 8 change.

## 7. What I didn't verify (manual legs left for the Tester)

1. **A real 15:10 Melbourne cron run.** The reminder queue was called directly
   (`queue_due_tomorrow_emails_for`), and the cron entry only through pgTAP's hour-independent
   check and the `cron.job` row. The job exists and is active; nobody has watched it fire at 15:10.
2. **Back to draft before the send, in the browser.** Covered by pgTAP (rows end `skipped`, not
   shown to admins). I didn't click "Back to draft" between a publish and a worker run.
3. **A parent of two children in one class getting two emails in Mailpit.** pgTAP only. The seed
   has no such family in one class.
4. **Cap pressure end to end** (Daily limit and Too late to send from real cron runs). pgTAP only.
5. **Mailpit's own UI at 360 px.** I rendered the email HTML Mailpit serves (`/view/<id>.html`, what
   its preview frame shows), not the Mailpit app page.
6. **Email clients and real devices.** Chromium only, with emulated colour schemes. No Gmail,
   Outlook, Apple Mail, Safari, Firefox or phone. No keyboard-only or screen-reader pass on the
   three switches.
7. **The function under Deno's type checker.** Deno isn't installed. The local edge runtime ran the
   code (both round trips and the browser pass went through it), but types are only checked by
   `tsc` for the web app, not `supabase/functions`.
8. **Hosted:** none, by rule. The migration on hosted, the deploy order on hosted, `deploy.sh` and
   real Resend are all Saurabh's release steps (go-live §7d).

## 8. Local state left for the Tester

- **Stack:** running, from this worktree, newest migration `20261028100000`. All three cron jobs
  active: `daily-history-trim`, `due-tomorrow-reminders`, `email-worker-kick`.
- **Outbox:** fresh from the last `pnpm db:reset` (after the mutation check): the seed's 2
  "work returned" and 6 "new assignment" rows, all sent by the real cron job to Mailpit.
- **Demo work:** "Ratio worksheet" is a draft again; "Fractions quick quiz" is back to its seeded due
  date; "Word problems set 1" is waiting for marking.
- **Switches:** `notification_settings` is empty, so everyone is on.
- **Mailpit:** holds this run's local emails.
- **Ports 5173 and 4173:** free. Dev server and mirror stopped.
