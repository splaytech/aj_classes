# TSR — item 7 (hold results; returned work outlives enrolment)

> **Stage:** `/test-and-ship` step 3, round 1 · **Date:** 26 Oct 2026 · **Tester**
> **Plan:** [06-test-plan-item-7.md](06-test-plan-item-7.md), FROZEN, 69 cases, by the commit **`4c84dbd`** (`docs(delivery): freeze the item 7 test plan`)
> **Build under test:** `feature/fair-results` @ **`4c84dbd`** (code base `a6727f1`; last production code `995c9ee`). `git merge-base --is-ancestor a6727f1 HEAD` = 0 and `git diff --quiet a6727f1 HEAD -- apps e2e supabase package.json pnpm-lock.yaml` = 0, so no [re-check] value moved.
> **Changes after review 6a:** the plan's "Changes after review 6a" list (items 1–22) names every changed case; the plan was frozen with them, so no second review round was needed.

## Environment

| Name | What | Address |
|---|---|---|
| DB | Local Supabase from this worktree (edge-runtime mount check `1`; newest migration `20261027100000`, 15 files; cron `email-worker-kick` active) | API `127.0.0.1:55321`, DB `:55322`, Mailpit `:55324` |
| D | `pnpm dev --port 5173 --strictPort` (from `apps/web`, local exports, local two-step key for `admin@` only) | `localhost:5173` |
| M | Mirror started by `test:csp` | `127.0.0.1:4173` |
| Browser | Playwright Chromium (the in-repo `e2e/node_modules`), fresh context per leg, counters as the plan's §1 harness | — |

Local only. The hosted project wasn't read or written, `supabase/.env.deploy` was never opened (E-03), nothing was pushed, and no key appears in `evidence-item-7/` (key-shape grep: JWT 0, `sb_` keys 0, publishable/secret/service keys 0, TOTP seed 0, passwords 0, `access_token` 0, hosted ref 0).

## Full check (E-04 to E-06)

| Step | Result |
|---|---|
| `format:check`, `lint`, `typecheck` | Pass (lint 0 problems) |
| `pnpm test` | Vitest **60 files / 521 tests** passed; e2e unit **6/6** |
| `VITE_APP_ENV=production pnpm build` + `check:hosted-ref` | Pass; `check-hosted-ref: 0 files (of 153 scanned)` |
| `db:test` | **Files=15, Tests=590**, `Result: PASS` (`fair_results.test.sql` ok, 83) |
| `test:functions` | **169 `ok`**, 0 `not ok`, "All checks passed." ×3 |
| `test:smoke` | **9 passed** (45.3 s); port 5173 freed; `e2e-%` rows 0 / 0 / 0 |
| No-Supabase build + `check:hosted-ref` + `test:csp` | Build pass; `0 files (of 153 scanned)`; **19 passed** (29.6 s) |

## Round 1 results

Console rule: strict, with only A1–A4. Hosted (`supabase.co` / `unzjnxctkyahtmrkinyr`) requests: **0** on all 115 recorded legs.

| ID | Case | Result | Measured |
|---|---|---|---|
| E-01 | Env local only | PASS | URL `http://127.0.0.1:55321`, key `equal`; `.env.example`, `.env.production` only; e2e `.env` 0 hosted, local URLs; no secret names; HEAD `4c84dbd`, ancestor 0, diff 0, `feature/fair-results` |
| E-02 | Reset from this worktree | PASS | reset exit 0; mount `1`; `20261027100000` = newest file; 15 files; cron `t` |
| E-03 | `.env.deploy` untouched; no banned command | PASS | `git check-ignore` 0; banned-command grep over every run script and log: 0 lines (the only text match anywhere is E-03's own `check-ignore` step, which doesn't open the file) |
| E-04 | Full check | PASS | as above |
| E-12 | Seed emails; start snapshot | **FAIL (plan order; ruling R1)** | Run as ordered (after E-04): the outbox showed both seed rows `sent`, but Mailpit held `… Word problems set 1` mails. `test:functions` (inside E-04) calls the worker itself, deletes every Mailpit message, and leaves its own two "Word problems" emails. After a second `pnpm db:reset`, the cron sent both seed rows at 02:20:00 UTC: `Your work has been marked: Number patterns check`, `Aarav's work has been marked: Number patterns check`. Snapshot taken then (6 profiles, 0 held assignments) |
| E-05 | Smoke | PASS | 9 passed; port free; `e2e-%` 0, 0, 0 |
| E-06 | CSP | PASS | build 0; hosted-ref 0 files; 19 passed |
| E-07 | Scope guard | PASS | exactly the 31 listed files; 0 under `e2e/` or `supabase/functions/` |
| E-08 | Code rules | PASS | perl scan printed 0 lines |
| E-09 | Types | PASS | `db:types` exit 0; `git diff --exit-code` 0 |
| E-10 | DB objects and grants | **FAIL (plan command; ruling R2)** | Column `false\|NO\|boolean`; trigger `O`; all 8 functions `t` + `{"search_path=\"\""}`; privileges: anon `f` ×5, authenticated `t` on the 2 wrappers, `f` on the 3 private helpers. The frozen last step (`grep -lE '…\b' … \| tail -1`) prints `20261025110000_work_returned_email.sql` on macOS BSD grep. Per function (`grep -lE "function (public\|private)\.<name>\("`), all 7 are last defined in `20261027100000_fair_results.sql` |
| E-11 | Docs | PASS | `2`, `2`, `2`, `1`, `1`, `1`, `5` |
| E-20 | Default off | PASS | `0`; `f` |
| E-21 | Tutor sets it | PASS | 200 `true` → `t`; 200 `false` → `f`; 200 `true` |
| E-22 | No questions | PASS | 400 P0001 `hold_needs_questions` (update), `f`; insert 400 `hold_needs_questions`, count 0; published paper 400 `assignment_published`, `f` |
| E-23 | Lock and unlock | PASS | publish 200; 400 `assignment_published` ×2, `published\|true`; title 200; back to draft 200; 200 `false`; publish 200, `f` |
| E-24 | Who can set it | PASS | aal2 admin 200 `true`/`false`; aal1 admin MD `[]`; `newadmin@` `[]`; tutor on NAPLAN `[]`; aal1 admin on NAPLAN 200 `[{"id":"…","hold_results":true}]`, `t`, reset `f`; student `[]`, parent `[]`; anon 401 `42501`; student GET `[]`; values unchanged |
| E-25 | Closed helpers | PASS | both private RPCs 404 `PGRST202`; anon `student_assignments` 401 `42501`, `parent_child_assignments` 401 `42501`; tutor `student_assignments` 403 `not_student` |
| E-26 | Stale `true` | PASS | hold 200; delete 200 (1 row); `t`; 0 questions |
| E-30 | Start-up | PASS | `/` and `/portal/login` 200; 1 `h1`; robots meta 1; overflow 0; console 0 |
| E-31 | Sign-in per role | PASS | admin `/portal/admin` "Admin"; newadmin `/portal/account/two-step/setup`; tutor `/portal/tutor`; student `/portal/student` `Hi Aarav`; parent `/portal/parent` `Hi Local`; same after reload; console 0 |
| E-32 | Deactivated refused | PASS | message shown; stays `/portal/login`; 0 token keys; console: 1 line, the A1 400 (an earlier attempt logged 2 because the harness clicked Sign in twice; the harness was fixed and the case re-run) |
| E-33 | Switch appears with a question | PASS | 0 switches with 0 questions; after Q1: 1, unticked, enabled; label exact; hint exact via `aria-describedby`; after the question list; 2 questions. Due date set to today + 7 by SQL (the MUI date picker isn't fill-able; the date isn't under test) |
| E-34 | Paper: no switch | PASS | paper draft 0; published paper 0; `MD` 0 with the empty text; PATCH 0 |
| E-35 | Immediate tick | PASS | +200 ms checked + disabled; PATCH 1 `{"hold_results":true}`; after save, before reload: checked + disabled; after reload: checked + enabled; page reload checked; DB `t`; no error alert |
| E-36 | Off again; double click | PASS | untick → `f`; double click → 1 PATCH; final `t` |
| E-92 | Slow connection | PASS | untick: 90 samples, 0 wrong, disabled from the click, enabled at 3.5 s, 1 PATCH; tick: 91 samples, 0 wrong, same; reload checked, DB `t`; console 0 |
| E-93 | Reload brings back the old value | PASS | forced reload: checked (the reloaded value) and **enabled**; real reload shows DB `f`; final `t` |
| E-37 | Locked on publish | PASS | dialog title and text exact; notice; checked + disabled; locked note exact; force-click 0 PATCH |
| E-38 | Back to draft | PASS | dialog exact; `Moved back to draft.`; enabled, hint back; `f` then `t`; republished: locked; 0 results |
| E-39 | Race: published elsewhere | PASS | alert `This can’t change once the assignment is published.`; unticked, enabled; DB `f`; console: 1 A2 line |
| E-40 | Race: no questions | PASS | alert `Add at least one question before holding results.`; unticked, enabled; DB `f`; 1 A2 line; race quiz deleted |
| E-41 | Admin role | PASS | hint; tick `t`; locked with note; back to draft enabled; untick `f`; deleted; console 0 |
| E-42 | UI permission boundaries | PASS | tutor on NAPLAN: `Not found`; student, parent: `You don't have access to this page`, only `profiles?full_name,role,is_active`; signed out: `/portal/login?next=…`, 0 requests; switches 0; console 0 |
| E-43 | Student submits held work | PASS | dialog exact; `Handed in! Your tutor will mark it soon.`; `Waiting for marking`; correct/explanation/awarded 0; `student_submit` `"submitted"`; JSON hides all; after reload `Handed in 26 Oct 2026, 1:34 pm. Waiting for your tutor to mark it.`; home under Waiting; DB `submitted\|true`, awarded `2`, `0`. 4 legs: overflow 0, contrast 13.87–17.15 |
| E-44 | Parent before return | PASS | chip `Waiting for marking`, no score; `Their answer` 2, correct/explanation/awarded 0; JSON and list row hidden |
| E-45 | API before return | PASS | 4 RPCs: status `submitted`, mark null, comment `''`, 0 leaks; 6 table GETs `200 []` |
| E-46 | Tutor sees held work | PASS | row `Submitted … 2 / 3 Mark`; `Returned 0 of 3`; `Aarav Demo’s work`; `2 / 2 (marked automatically)`, `0 / 1 (marked automatically)`; `Score 2 / 3`; Return enabled |
| E-47 | Per-question feedback (UI) | PASS | 2 feedback fields, 0 mark inputs; `Saved.`; writes: 2 × `PATCH assignment_answers` with `feedback` only, then `PATCH assignment_results`; DB `1\|2.0\|e2e-item7 Q1 feedback`, `2\|0.0\|`; 1,001 chars → 1,000; after reload Q2 empty, DB `''` |
| E-48 | Feedback hidden until return | PASS | student and parent `feedback` `["",""]` |
| E-49 | Return; email by cron | PASS | dialog exact; notice exact; `returned\|t`; Q1 feedback kept, Q2 `''`; `ob` pending → both `sent` at 02:40:00, **222 s** after the return; subjects exact; mark/comment/feedback in mail 0; links as expected |
| E-50 | Returned: everything shows | PASS | student: `Returned`, `Your results`, correct 2, both explanations, `2 / 2`, `0 / 1`, comment, `Tutor feedback: …`, radios 0, Hand in 0, Past class 0; home under Marked and returned `2 / 3 (67%)`; parent row `Returned … Tutor: e2e-item7 nice work`, heading `Aarav’s results` |
| E-51 | Hold off unchanged | PASS | `Handed in and marked. Here are your results.`; `Returned`; `returned\|t`; outbox empty; worker claimed 0; Mailpit 0 / 0; restored |
| E-52 | Switch on phone and themes | PASS | 16 legs: overflow 0; box inside; label 1 line; hint 3 (1280) / 5 (360); note 1 / 2; contrast 13.76–21; 1 `h1`; console 0 |
| E-60 | Remove from class (UI) | PASS | dialog exact; Aarav gone; 1 `DELETE enrolments`; enrolment 0; results 5 → 5 |
| E-61 | Student home after removal | PASS | `Nothing to do right now. Nice work!`; no Waiting heading; 2 returned items, each 1 `Past class`; Done `2 of 2`, Average `71%`, on time `2 of 2`; timetable interview only |
| E-62 | Past-class pages, read-only | PASS | both: `Returned` + `Past class`, correct 2, comments, `Tutor feedback` on H1; radios 0, textareas 0, Hand in 0; writes 0 |
| E-63 | Hidden work by URL | PASS | all 6: `Not found`, 0 prompt leaks; 1 A3 line each (`student_assignment` 500) |
| E-64 | Student API after removal | PASS | 2 rows, both past + returned; NP `isPastClass` true, `correctOption` 1; 6 hidden ids 500 P0002; 2 saves + 2 submits 500 P0002; timetable 0 maths rows (1 total); md5 before = after |
| E-65 | Parents after removal (X9) | PASS | X9 joined (`parent\|active\|true`, linked); both parents: 2 rows `Returned` + `Past class`, `Tutor:` lines, interview timetable only; both pages read-only; writes 0; console 0 |
| E-66 | Parent API after removal | PASS | 2 past rows; NP 200 `isPastClass=true`; WORD 403 42501 `not_found`; timetable 0 maths; step 4 `Not found`, 1 A3 line (403) |
| E-67 | Email links after removal | PASS | both → `/portal/login?next=…` → the page, `Returned` + `Past class`, correct 2; console 0 |
| E-68 | Past class on phone and themes | PASS | 16 legs: chips inside, no overlap, not clipped; contrast 13.76–16.27; overflow 0; 1 `h1`; console 0 |
| E-69 | Tutor side after removal (S5) | PASS | Aarav not listed; marking URL `Not found`; console 0; API 400 `not_enrolled`, WORD stays `submitted` (S5, informational) |
| E-70 | Another student (X10) | PASS | Isla joined; list: `Reasoning mock test 1` `submitted`, the rest `not_started`, none past, marks null; NP: mark null, comment `''`, selections null, responses `''`; leak grep 0; home `Nothing returned yet.` |
| E-71 | Another child's parent (X11) | PASS | 500 P0002; 403 42501; 500 P0002; home Isla only; child page `Not found` (2 A3 lines); assignment `Not found` (1 A3 line) |
| E-72 | Unlinked parent | PASS | dialog exact (full names); `Parent removed.`; links 0; RPCs 500 / 403 / 500; home `No children are linked…`; child page `Not found` (2 A3 lines); `parent@` still 200 with rows |
| E-73 | Deactivated student (X12) | **FAIL — BUG-15** | dialog exact; `Deactivated.`; `is_active` `f`. Step 2: the open page signs out to `/portal/login` (correct), but logs **2** console lines from `POST /auth/v1/logout?scope=local` 403 ×2, neither covered by A4. Step 3: 403 `not_student` ×2. Step 4: refused, 1 A1 line. Step 5: parent still sees the rows (S1 (b)). Restore: `Reactivated.`, sign-in OK, 2 past items |
| E-74 | Roster row archived (X13) | PASS | dialog exact; 1 `PATCH students`; banner exact; open page shows `Your student account isn’t active. Please contact AJ Classes.`, 1 A4 line (403 `student_assignments`); student 403 `not_student`; parent 500 P0002 / 403 42501; parent home `Noah Demo` only; restored |
| E-75 | Roster row deleted (rolled back) | PASS | inside: results 0, RPC raised `P0002 not_found`; after rollback 4 = 4 |
| E-76 | Assignment deleted | PASS | dialog exact; results 0; home: `Number patterns check` only, 1 `Past class`; old URL `Not found` (1 A3 line); RPC 1 row |
| E-77 | Re-enrol | PASS | enrolment 1; **6** rows, 0 past; headings To do / Waiting / Returned; chips 0; `Saved`; both classes on the timetable; console 0 |
| E-78 | Class archived (X14), S4 | PASS | dialog exact; banner; student 1 past item, others hidden, interview only; saves/submit 500 P0002; parent 1 past row, NP 200, WORD 403; tutor class list hides maths. S4 (informational, expected): the admin can return the paper mock test in the archived class from the UI (`Saved`), and it queues and sends 2 `work_returned` emails (student, parent). Restored: 6 rows, 0 past |
| E-79 | Empty states (X15) | PASS | Isla: `Nothing to do right now. Nice work!`, `Nothing returned yet.`, no Waiting; timetable `You’re not in any classes yet.`; P3 card `Year 8 · Not in a class yet`; child page `Nothing has been set yet.`, `Not in any classes yet.`; re-enrolled (2) |
| E-80 | Paper return email | PASS | `ob` 2 pending → worker `sent: 2` → sent; subjects exact; Parent Two 0; `42`/feedback 0; restored |
| E-81 | Waiting email after removal | PASS | 2 mark inputs; returned; 2 pending; removed (UI); worker `sent: 2`, skipped 0; subjects `… Word problems set 1`; both links open with `Returned` + `Past class`; restored to the snapshot row; cron `t` |
| E-82 | Family pages on the seed | PASS | To do: `Fractions practice set 3`, `Fractions quick quiz`, `Times tables warm-up`; Waiting: `Word problems set 1`, `Reasoning mock test 1`; Returned: `Number patterns check`; `Past class` 0; parent home both children, `Can Noah Demo use the portal?` 1; console 0 |
| E-90 | Data restore | PASS | `e2e-item7%` assignments 0; `diff snapshot-start snapshot-end` **empty**; `e2e-%` 0 / 0 / 0; outbox waiting 0; cron `t` |
| E-91 | Console and hosted total | **FAIL — BUG-15** | Hosted **0** over 115 legs. Console lines: A1 (E-32 1, E-73 step 4 1), A2 (E-39 1, E-40 1), A3 (E-63 6 × 1, E-66 1, E-71 2 + 1, E-72 2, E-76 1), A4 (E-74 1). One leg outside A1–A4: E-73 step 2, 2 lines (BUG-15) |

**Pass rate:** **65 / 69 = 94.2 %**. Not passed: E-10, E-12 (plan expectations; rulings R1–R2), E-73 and E-91 (BUG-15). If R1 and R2 are accepted: 67 / 69 = 97.1 %.

## Defects

- **[BUG-15](bugs/BUG-15.md)** (Low, pre-existing, not an item 7 file): a deactivated student's open page sends two `POST /auth/v1/logout` requests on reload, both 403. That's 2 console lines on E-73 step 2, so E-73 and E-91 fail. Cause: `member-layout` and `student-layout` both run `guardPortalPage` in parallel, and each calls `signOut()`.

## Rulings needed (team lead)

- **R1 (E-12).** The plan orders E-12 after E-04. But `test:functions` (in E-04) runs the worker itself, deletes all Mailpit messages and leaves its own "Word problems" emails, so the seed emails can't be seen in Mailpit then. Measured after a second reset, the cron sent both "Number patterns check" emails with the exact subjects.
  - **Proposed:** PASS. The intent ("the seed's two emails go out") is met. The wording should say "on a fresh reset, before E-04" in a later revision.
- **R2 (E-10).** The frozen one-line grep uses `\b`, which macOS BSD grep handles differently. It prints `20261025110000`. The per-function grep shows every rebuilt function is last defined in `20261027100000_fair_results.sql`, and every other E-10 value matches.
  - **Proposed:** PASS, with the step rewritten as a per-function `grep -lE "function (public|private)\.<name>\("`.
- **BUG-15 route.** Either fix it before the merge (one-flight sign-out, plus a unit test), and re-run E-73 and E-91 in round 2. Or rule it pre-existing and out of scope for item 7, and carry it as a follow-up: E-73 and E-91 stay FAIL in the record, and the gate needs your call.

## Deviations (none changes an expected value)

1. E-33: the due date (today + 7) was set by SQL after the UI created H1, because the MUI date picker can't be filled by Playwright. The due date isn't measured.
2. E-32: the first attempt's 2 lines came from the harness clicking Sign in twice. The harness was fixed, and the re-run shows 1 line (A1).
3. E-25, E-74, E-78 (S4), E-79: harness selector or quoting faults were fixed and the legs re-run. For E-74, the archive was undone in the UI and then re-applied. No product behaviour differed between attempts.
4. X9–X11 accounts came from the real invite flows: admin UI → Mailpit link → Continue → `/portal/join`.

## Not covered

1. **Deferred to T2.15** (item 2 held): AC-7.2's file hand-in half, all of AC-7.15, and AC-7.11's upload/remove half (security S3 (a)–(c)).
2. **Security residuals:**
   - S1 (removal or archiving doesn't revoke returned work; runbook (a)–(e) exercised in E-72 to E-76);
   - S2 (later edits visible to a removed student);
   - S6 (staff can change a multiple-choice `awarded_marks` through the API; the portal never sends it, as E-47 shows).
3. **Informational:** S4, confirmed in E-78 (a return in an archived class emails the family), and S5, confirmed in E-69 (held work stranded after removal; a tutor return gives `not_enrolled`).
4. **Deferred staff-loader pre-checks** (dev notes Round 3, the E-60 follow-up): `assignments.tsx`, `classes.tsx`, `class-detail.tsx`, the timetable and the tutor dashboard still read for a family role. Only the assignment and marking pages are covered (E-42).
5. **Real devices, Safari, Firefox, screen reader:** Chromium at emulated widths only. Screenshots for Saurabh's look are in `evidence-item-7/screenshots/` (E-43 ×4, E-52 ×16, E-68 ×16).
6. **Hosted:** the migration deploy and the hosted grant check are Saurabh's release steps.

## Evidence

`evidence-item-7/` (filtered, key-free): E-01, E-04 to E-06 summaries, E-07 file list, E-07 to E-11, E-10, E-12 snapshot (ids masked), E-20 to E-26 API output, E-45/48, E-49 and E-81 mail lines, E-64, E-66/69, E-70/71, E-75, E-80, the E-90 snapshot diff, `browser-legs-summary.json` (every browser leg's counters, with response bodies and request lists removed), and 36 screenshots. Raw logs, response bodies and scripts are in the session scratchpad `item7-run/`.

## Verdict

**NOT APPROVED (round 1): 65 / 69.** It needs your rulings R1 and R2, and a decision on BUG-15 (fix and re-run E-73 and E-91, or rule it out of scope). Not merged. The stack was reset at the end, with no fixture rows left.

## Team lead rulings on round 1 (26 Oct 2026)
- **R1 (E-12): accepted.** The intent (the seed's two "Number patterns check" emails go out with the exact subjects) was measured on a fresh reset; only the plan's order was wrong (`test:functions` in E-04 clears Mailpit). Round 2 measures it on a fresh reset before E-04.
- **R2 (E-10): accepted.** The frozen grep's `\b` behaves differently in BSD grep; a per-function grep shows all 7 rebuilt functions are last defined in `fair_results`, and every other E-10 value matched. Round 2 uses the per-function grep.
- **BUG-15: fixed in item 7, not deferred.** It's Low and pre-existing, but it's a real console error on a flow item 7's cases exercise, and the fix is small. Round 2 re-runs every case.

## Round 2

> **Date:** 26 Oct 2026 · **Build under test:** `feature/fair-results` @ **`6c717df`** (BUG-15 fix `e748a61`, tests `1707ee3`, comment `8752ed3`; review `review-bug-15.md` APPROVED). Round 1 record committed at `8d29762`.
> **Applied:** R1 (E-12 measured on a fresh reset before E-04) and R2 (E-10's last step as the per-function grep). Nothing else was changed or weakened. Every one of the 69 frozen cases was re-run, plus **E-94**, the BUG-15 regression case.
> **Lead-approved scope change (not a weakening):** E-07's list grows from 31 to **36** files, adding the BUG-15 fix files `apps/web/src/lib/portal-guard.ts`, `apps/web/src/lib/portal-guard.test.ts`, `apps/web/src/services/auth.service.ts`, `apps/web/src/services/supabase.client.ts` and `apps/web/src/services/supabase.client.test.ts` (`services/index.ts` was already listed). Re-derived from `git diff --name-only develop...HEAD -- apps supabase e2e`.
> **[re-check] values re-read** (E-01: `git diff --quiet a6727f1 HEAD -- apps …` = 1, the BUG-15 files): Vitest **62 files / 527 tests** (was 60 / 521, +6 from the BUG-15 tests; none dropped); pgTAP 15 / 590 and `fair_results` 83 unchanged.
> **Environment:** as round 1 (local stack from this worktree, mount `1`, newest migration `20261027100000`; D on :5173; M from `test:csp`; Chromium per leg). Evidence: fresh `item7-run-2/` in the session scratchpad; filtered `*-r2` files and `screenshots-r2/` in `evidence-item-7/`. Key-shape grep over the whole folder: JWT 0, `sb_` keys 0, publishable/secret/service/anon keys 0, TOTP seed 0, passwords 0, `access_token` 0, hosted ref 0.

### Full check

| Step | Result |
|---|---|
| `format:check`, `lint`, `typecheck` | Pass |
| `pnpm test` | Vitest **62 files / 527 tests** passed; e2e unit **6/6** |
| Production build + `check:hosted-ref` | Pass; `check-hosted-ref: 0 files (of 153 scanned)` |
| `db:test` | **Files=15, Tests=590**, `Result: PASS` |
| `test:functions` | **169 `ok`**, 0 `not ok`, "All checks passed." ×3 |
| `test:smoke` | **9 passed** (43.2 s); port freed; `e2e-%` 0 / 0 / 0 |
| No-Supabase build + `check:hosted-ref` + `test:csp` | Pass; `0 files (of 153 scanned)`; **19 passed** (29.5 s) |

### Results

Hosted requests: **0** on all 117 recorded legs. Console: only A1–A4 lines (listed under E-91).

| ID | Result | Measured (round 2) |
|---|---|---|
| E-01 | PASS | URL local, key `equal`; `.env.example`, `.env.production`; e2e `.env` 0 hosted; no secret names; HEAD `6c717df`, ancestor 0, diff 1 (BUG-15 files: [re-check] values re-read, above) |
| E-02 | PASS | reset 0; mount 1; `20261027100000` newest; 15 files; cron `t` |
| E-03 | PASS | `check-ignore` 0; banned-command grep over run scripts and logs 0 |
| E-12 | PASS (R1) | fresh reset 03:33:15 UTC, before E-04; cron sent both at 03:35:00; `Your work has been marked: Number patterns check`, `Aarav's work has been marked: Number patterns check`; snapshot 6 profiles, 0 held |
| E-04 | PASS | as the full check above |
| E-05 | PASS | 9 passed; port 0; `e2e-%` 0, 0, 0 |
| E-06 | PASS | build 0; 0 files; 19 passed |
| E-07 | PASS | 36 files = round 1's 31 + the 5 BUG-15 files (lead-approved); 0 under `e2e/`, `supabase/functions/` |
| E-08 | PASS | 0 lines |
| E-09 | PASS | `db:types` 0; diff 0 |
| E-10 | PASS (R2) | column, trigger, 8 × `t` + `{"search_path=\"\""}`, privileges as round 1; per-function grep: all 7 in `20261027100000_fair_results.sql` |
| E-11 | PASS | `2`, `2`, `2`, `1`, `1`, `1`, `5` |
| E-20–E-26 | PASS (7) | identical codes and values to round 1 (E-22: 400 `hold_needs_questions` ×2, published paper 400 `assignment_published`; E-23: 400 `assignment_published` ×2, title and back-to-draft 200; E-24: aal1 admin on NAPLAN 200 `true`, reset; families `200 []`, anon 401; E-25: 404 ×2, anon 401 ×2, tutor 403 `not_student`; E-26: `t`, 0 questions) |
| E-30 | PASS | both 200, 1 `h1`, robots 1, overflow 0, console 0 |
| E-31 | PASS | five roles land as in round 1, same after reload, console 0 |
| E-32 | PASS | message; `/portal/login`; 0 token keys; 1 A1 line |
| E-33–E-38 | PASS (6) | as round 1: switch only with a question, exact label/hint, paper 0, immediate tick (+200 ms checked + disabled; still disabled after save; enabled after reload), double click 1 PATCH, locked note, back to draft editable |
| E-92 | PASS | untick 90 samples / 0 wrong, tick 90 / 0 wrong; 1 PATCH each; enabled at ~3.5 s; DB `t`; console 0 |
| E-93 | PASS | forced old value → checked and **enabled**; DB `f` then `t` |
| E-39 | PASS | `This can’t change once the assignment is published.`; reverted, enabled; DB `f`; 1 A2 line |
| E-40 | PASS | `Add at least one question before holding results.`; reverted; DB `f`; 1 A2 line |
| E-41 | PASS | tick `t`, locked, back to draft, untick `f`, deleted; console 0 |
| E-42 | PASS | tutor `Not found`; student, parent: no-access page with only the layout's `profiles` read (0 staff reads); signed out → sign-in, 0 requests; switches 0 |
| E-43 | PASS | `"submitted"`; notice, chip; 0 correct/explanation/awarded; JSON hidden; `Handed in 26 Oct 2026, 2:44 pm. Waiting for your tutor to mark it.`; DB `submitted\|true`, `2`, `0`; 4 legs overflow 0, contrast 13.87–17.15 |
| E-44 | PASS | `Waiting for marking`, no score; `Their answer` 2; 0 correct/explanation/awarded; JSON and list hidden |
| E-45 | PASS | 4 RPCs hidden; 6 table GETs `200 []` |
| E-46 | PASS | `Submitted … 2 / 3`; `Returned 0 of 3`; `Aarav Demo’s work`; auto-marks `2 / 2`, `0 / 1`; `Score 2 / 3` |
| E-47 | PASS | 2 feedback fields, 0 mark inputs; `Saved.`; feedback-only PATCHes; marks `2.0`, `0.0` kept; 1,000-char cap; Q2 `''` after reload |
| E-48 | PASS | student and parent `feedback` `["",""]` |
| E-49 | PASS | dialog and notice exact; `returned\|t`; Q1 feedback, Q2 `''`; cron sent both at 03:50:00, **199 s** after the return; subjects exact; leak 0 |
| E-50 | PASS | ordinary return visible to both; `Aarav’s results` on the parent page; `Past class` 0 |
| E-51 | PASS | auto-returned, `returned\|t`; outbox empty; worker 0; Mailpit 0/0; restored |
| E-52 | PASS | 16 legs, every threshold met, console 0 |
| E-60 | PASS | dialog exact; 1 `DELETE enrolments`; results 5 → 5 |
| E-61 | PASS | to-do empty text; no Waiting; 2 items with `Past class`; `2 of 2 Done 71% Average mark 2 of 2 Handed in on time`; interview timetable only |
| E-62 | PASS | both pages read-only (0 radios, textareas, Hand in; writes 0), results shown |
| E-63 | PASS | 6 × `Not found`, 0 leaks, 1 A3 line each |
| E-64 | PASS | 2 past rows; 6 hidden ids, 2 saves, 2 submits 500 P0002; timetable 0 maths; md5 unchanged |
| E-65 | PASS | X9 joined; both parents 2 past rows, read-only pages, console 0 |
| E-66 | PASS | 2 past rows; NP 200 past; WORD 403; timetable 0 maths; step 4 `Not found`, 1 A3 line |
| E-67 | PASS | both links → sign-in → the page with `Returned` + `Past class`; console 0 |
| E-68 | PASS | 16 legs; chips inside, no overlap, unclipped; contrast ≥ 13.76; overflow 0 |
| E-69 | PASS | not listed; `Not found`; console 0; API 400 `not_enrolled`, WORD `submitted` |
| E-70 | PASS | X10 joined; Isla's own statuses (`Reasoning mock test 1` submitted, rest not started); nothing of Aarav's; `Nothing returned yet.` |
| E-71 | PASS | 500 / 403 / 500; home Isla only; `Not found` ×2 (2 + 1 A3 lines) |
| E-72 | PASS | dialog exact; `Parent removed.`; RPCs 500/403/500; empty home text; child `Not found` (2 A3 lines); `parent@` unaffected |
| E-73 | **PASS** | dialog exact; `Deactivated.`; step 2: open page → `/portal/login`, **0 console lines** (BUG-15 fixed; no `/logout` request); step 3: 403 `not_student` ×2; step 4: refused, 1 A1 line; step 5: parent still sees the rows (S1 (b)); restored, 2 past items |
| E-74 | PASS | dialog exact; banner; open page shows `Your student account isn’t active. Please contact AJ Classes.`, 1 A4 line; 403 `not_student`; parent 500/403; parent home `Noah Demo` only; restored |
| E-75 | PASS | inside: 0 results, `P0002 not_found`; rollback 4 = 4 |
| E-76 | PASS | dialog exact; results 0; 1 past item left; old URL `Not found`, 1 A3 line |
| E-77 | PASS | 6 rows, 0 past; sections back; `Saved`; both classes |
| E-78 | PASS | archived: 1 past item, writes 500 P0002, parent 1 row, WORD 403, tutor list hides maths; S4 (informational, expected): admin return `Saved` → 2 queued → worker sent 2 (student 1, parent 1); restored, 6 rows / 0 past |
| E-79 | PASS | Isla: both empty texts, no Waiting, `You’re not in any classes yet.`; P3 card `Year 8 · Not in a class yet`; child page both empty texts; re-enrolled |
| E-80 | PASS | 2 pending → `sent: 2`; subjects exact; Parent Two 0; leak 0; restored |
| E-81 | PASS | 2 mark inputs; returned; removed (UI); `sent: 2`, skipped 0; both links open with `Past class`; restored to the snapshot row; cron `t` |
| E-82 | PASS | seed sections and titles; `Past class` 0; `Can Noah Demo use the portal?` 1; console 0 |
| E-90 | PASS | `e2e-item7%` 0; snapshot diff **empty**; `e2e-%` 0/0/0; outbox waiting 0; cron `t` |
| E-91 | **PASS** | Hosted 0 over 117 legs. Console lines, all declared: A1 (E-32 1, E-73 step 4 1); A2 (E-39 1, E-40 1); A3 (E-63 6 × 1, E-66 1, E-71 2 + 1, E-72 2, E-76 1); A4 (E-74 1). None outside A1–A4 |
| **E-94** (new, BUG-15) | **PASS** | Before: session key `sb-127-auth-token` stored. Admin deactivates Aarav; the open student page reloads → `/portal/login?reason=inactive`; **0** `/auth/v1/logout` requests; **0** console errors; **no** stored session key; requests only `GET profiles` and `POST rpc/my_onboarding` (no 4xx); hosted 0. Reactivated (`t`) |

**Pass rate:** **70 / 70 = 100 %** (the 69 frozen cases plus E-94). Full check green.

**Defects open:** none. BUG-15 is fixed and verified (E-73, E-91, E-94).

**Deviations:** as round 1, items 1 and 4 (H1's due date by SQL; real invite flows). The round 1 harness faults were fixed in the round 2 scripts before the run, and no leg was repeated.

**Not covered:** unchanged from round 1 (T2.15 halves; S1/S2/S6 residuals; S4/S5 informational, both re-confirmed; deferred staff-loader pre-checks; real devices, Safari, Firefox, screen reader; hosted steps).

### Verdict (round 2)

**APPROVED (auto): 70 / 70 = 100 %, full check green.** Ready for the merge to `develop` (the lead's step). End state: final `pnpm db:reset`, stack up at `20261027100000`, no fixture rows, ports 5173 and 4173 free. Nothing committed or pushed by the Tester.
