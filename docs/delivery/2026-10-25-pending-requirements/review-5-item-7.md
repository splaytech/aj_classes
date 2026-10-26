APPROVED

# Review 5: item 7 (hold results; returned work outlives enrolment)

**Scope:** `git diff 68f1729...HEAD` on `feature/fair-results`, excluding 6dcca6f (item 6 TSR evidence) and 8aee800 (plan ticks), both confirmed single-doc commits; 28 files. Checked against 01b AC-7.1–7.17, 02b §7, ADR-0007, 03b §7 and §9, 04b §5 (T7.x, risks 1–5) and 05-dev-notes-item-7.md.

**Ran against the local stack (newest migration `20261027100000`):** `pnpm lint` pass; `pnpm typecheck` pass (web, e2e); `pnpm test` 59 files / 504 tests, e2e unit 0 fail; `pnpm db:test` 15 files / 581 tests PASS.

## Verified (T7.11)

1. **Copied bodies match their sources** (`diff` against the cited lines; only designed changes):
   - `student_submit` (20261007090321:463–527): `create or replace`, one comment, `or (select a.hold_results …)` on the final branch.
   - `assignments_for_student` (151–202): `is_past_class`, `left join public.enrolments`, a rule (a)-or-(b) `where`.
   - `student_assignments` (347–371), `parent_child_assignments` (574–598): only `is_past_class boolean` in `returns table`.
   - `assignment_view` (206–267): `create or replace` plus `'isPastClass'`.
   - `work_returned_recipients` (20261025110000:115–140): both `assignment_visible_to` calls become `assignment_readable_by`.
   - No later migration redefines any of them.
2. **D1 is right:** 115–138 would have dropped the parents' `notification_settings` off-switch (line 139). Other 03b ranges differ only by a trailing blank line or `$$;`.
3. **Grants match 20261007090321:786–831:** revoked from `public, anon, authenticated`; `execute` to `authenticated` on the two public wrappers only; new private helpers revoked; pgTAP lines 431–446.
4. **Every security definer function sets `search_path = ''`.**
5. **Rule (b) is read-only:** `student_submit`/`student_save_answer` still gate on `assignment_visible_to`; `assignment_readable_by` only in the recipients function; the builder's inlined condition is logically identical. Save and submit raise P0002 after removal and archive (lines 295–302, 413–417).
6. **Marks and answers hidden before return** (unchanged `assignment_view` hiding; pgTAP lines 169–211 for student and parent, list and page RPCs).
7. **Hold flag locks on publish, unlocks on back-to-draft** (trigger matches 03b; `status` is only `draft`/`published`; lines 132, 135, 138–151).
8. **Outbox assertions filter `kind = 'work_returned'`** (lines 226, 245, 341), except finding 1.
9. **pgTAP covers 7.1–7.6, 7.8–7.14 and the grants row**, except finding 2.
10. **Frontend:** only HTTP call is `setHoldResults` in `services/assignments.service.ts`; text from `HOLD_RESULTS`, `FAMILY_TAGS`, `PORTAL_ERRORS`; no `style={{`, `console.log`, `any`, TODO or DOM queries; tests co-located; switch only when `questionCount > 0` (`assignment-detail.tsx:76`).
11. **File half of AC-7.2 and AC-7.15 correctly not built** (03b §9 → T2.15).
12. **Docs (AC-7.17):** `r3b/review.md` F8/F28 resolved with a working 01b anchor; `r3b/design.md` D8 and §4 rows state rule (b).

## Blocking

None.

## Non-blocking

1. **`fair_results.test.sql:337`:** the `notify_claim_emails()` count doesn't filter by kind. Safe today and after item 8 (T8.4 keeps `default array['work_returned']`). Fix: join `email_outbox` on `kind = 'work_returned'`, or note in T8.4.
2. **AC-7.13 "deleting the assignment still deletes the result" has no test** (a 03b §7.7 gap). Fix: delete r1 (e008) as superuser, assert its `assignment_results` count is 0.
3. **Archive block (lines 397–427) is thin on the parent side.** Fix: `isnt(parent_child_assignment(d1, e008), null)` and `throws_ok(… e007 …, '42501')`.
4. **O4: race-case message** maps `assignment_published` to "Questions can't change once the assignment is published." Fix: a dedicated `holdLocked` key ("This can't change once the assignment is published.").
5. **O1: the checkbox only shows its new state after the reload** (`HoldResultsSetting.tsx:44`). Optional: keep a local pending value until `onChanged` finishes.
6. **O3 (5-line hint at 360 px) and O2 (`text.secondary` not muted, portal-wide, pre-existing):** PO wording and ticket decisions, not item 7 defects.

## For the next stages

1. T7.12 Tester: the dev notes §6 manual legs, plus findings 2 and 3 if not added to pgTAP.
2. T2.15 / item 8: keep both copies of rule (b) in step (`assignment_readable_by` and the builder condition at `fair_results.sql:216`).

---

APPROVED

# Review 5 — item 7, round 2

**Scope:** `git diff 8aee800..374b368` (9 commits, 8 files). Ran: lint, typecheck (web, e2e) pass; Vitest 59 files / 506 tests; pgTAP 15 files / 586 tests PASS.

**Status:** R1–R5 and S1–S3 resolved; dev notes §7 matches. Step (c)'s SQL is correct (all 5 FKs to `public.students` cascade). Code-quality rules hold.

## Blocking

None.

## Non-blocking

1. `HoldResultsSetting.tsx:53-54`: possible one-frame flicker after a successful save (`revalidate()` resolves before the transition renders new data). Fix: clear `pending` only on refusal; on success keep it until the `holdResults` prop changes.
2. `HoldResultsSetting.tsx:53-54`: if `onChanged` throws, `pending` is never cleared. Fix: `try … finally`.
3. `supabase/README.md:92-94` step (c): also say enrolments, parent links and answers go; suggest (b) first and a `select full_name …` check before deleting.
4. `HoldResultsSetting.test.tsx:94`: the constant-text assertion repeats the constant. Drop it or keep as a copy pin.
5. `05-dev-notes-item-7.md:212`: clarify the box was unticked by hand to restore seed data.
6. `fair_results.test.sql:459-461`: optionally assert the count is 1 just before the delete.

Tester (T7.12): click the switch on a slow connection and watch for the flicker.

**Lead note:** findings 1, 2, 3, 5, 6 fixed in 0d1b701, 8cf5689, 3d1e2fb, d5baae1, 0ccdd93; 4 skipped. The throw path of finding 2 has no unit test (an `onChanged` rejection is left unhandled by design, so Vitest fails the run); covered by reading only. Vitest 506, pgTAP 587.

---

APPROVED

# Review 5 — item 7, round 3

**Scope:** `git diff c5167a6..79e803a` (6b082f0, 92163b9, 995c9ee, 79e803a). Lint, typecheck, format clean; Vitest 60 files / 520; pgTAP 15 files / 587 PASS. No migration change.

## Blocking

None.

## Non-blocking

1. **The DB doesn't refuse a staff mark edit on a multiple-choice answer** (pre-existing: `20261007090320:741` grants `update (awarded_marks, feedback)`; RLS :796 checks only `can_manage_assignment`; `check_assignment_answer` :648–685 has no kind check). Round 3's UI sends only `{ feedback }` for MCQ, and a feedback-only update doesn't fire `assignment_answers_update_mark`. Fix: tighten the trigger, or record as an accepted risk.
2. **No pgTAP proves a feedback-only update on held MCQ keeps `awarded_marks` and `mark`.** Add one to `fair_results.test.sql`.
3. **The mid-save reload guard (`HoldResultsSetting.tsx:61`) is untested.** Add a test: pending save, `reloadWith(false)` → still checked and disabled; resolve, `reloadWith(true)` → checked and enabled.
4. **Other staff loaders (`assignments.tsx`, `classes.tsx`, `class-detail.tsx`, timetable, tutor dashboard) still read for a family role.** Out of item 7's scope; record the deferral in the dev notes.

## Checked and fine

Written answers unchanged (a blank written mark still blocks Return); the MCQ field follows the conventions and families see it after return (`FamilyWork.tsx:207`); `getStaffClient` matches the item 4 helpers and only `getAssignment`/`getSubmission` use it; the revision approach has no stuck, flicker or stale-closure bug (double click, refusal, throw, unmount, mid-save reload all reasoned); dev notes match.

**Lead ruling on finding 1:** accepted residual, not fixed in item 7. Only the class's tutor or an admin can do it, through the API not the UI, capped at the question's marks; it was already possible before item 7. Recorded in 06-security-item-7.md as S6 and on the follow-up list. Findings 2–4 go to the Developer now.
