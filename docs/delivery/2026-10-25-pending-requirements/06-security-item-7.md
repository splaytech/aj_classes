APPROVED

# Security review: item 7 (hold results; returned work outlives enrolment)

> **Stage:** 6b (Security, T7.13) · **Date:** 26 Oct 2026 · **Branch:** `feature/fair-results`
> **Scope:** `git diff 68f1729...HEAD` excluding docs-only 6dcca6f and 8aee800. Main files: `supabase/migrations/20261027100000_fair_results.sql`, `supabase/tests/database/fair_results.test.sql`, the portal changes.
> **Method:** code reading plus probes against the **local** stack only (`docker exec … psql`, port 55322), every probe inside `begin … rollback`. No hosted project, `.env*` or `supabase/.env.deploy`; no reset, stop or start.

**Verdict:** nothing blocking. S1 is the accepted residual, stated as T7.13 asks. S2–S5 are non-blocking.

## Checked and held up

| Area | Evidence |
|---|---|
| Rule (b) is read-only | Only `assignments_for_student` (migration:216), through it `assignment_view`, and `work_returned_recipients` (:373, :383) use `assignment_readable_by`. `student_submit` (:96) and `student_save_answer` (20261007090321:408) still use `assignment_visible_to`; `check_assignment_result` still raises `not_enrolled`. After removal: save and submit give P0002 `not_found`; a tutor return gives `not_enrolled` |
| No direct table reads by families | As student and parent: `assignment_answers`, `assignment_results`, `assignment_questions`, `assignments` return 0 rows |
| Held work hidden before return | After a held submit, `student_assignment(h1)` has `correctOption` null, `explanation` '', `awardedMarks` null, `mark` null, `comment` ''; parent view and both list RPCs the same |
| Auto-return path | The held branch returns `'submitted'` before the `returned` update (:139–144); `student_submit` is single-shot |
| Families can't flip `hold_results` | Student and parent updates change 0 rows (RLS); column grant no wider than `status`; another class's tutor changes 0 rows |
| Can't flip after publish | `status='draft', hold_results=false` in one statement → `assignment_published`; with other fields → `assignment_published`; back to draft with submissions → `has_submissions`; insert published and held → `hold_needs_questions` |
| Grants after drop/recreate | `anon` can execute none of the 12 affected functions; `authenticated` only the public wrappers; private helpers `{postgres=X}` only; no `anon` usage on `private`; `create or replace` kept existing ACLs |
| `security definer` | All 7 new or rebuilt functions: `search_path=""`, schema-qualified names, no dynamic SQL |
| Deactivated / unlinked | Roster row deactivated: `student_assignments()` 42501 `not_student`, parent view 42501 `not_found`, 0 recipients |
| IDOR | Other students' and other parents' ids give P0002 / 42501 `not_found` |
| No existence leak | A real foreign id and a random uuid give the same code and message on every RPC probed |
| Email recipients after removal | Only the staff-return trigger queues rows (needs enrolment); queued rows re-checked at claim time; a later-linked parent has no row |
| Frontend | `setHoldResults` in `services/assignments.service.ts` via the Supabase client; no secrets, `console.*`, `innerHTML` or `supabase.co`; no dependency change |
| pgTAP | 15 files, 581 tests, PASS |

## Findings

1. **S1 — Low, accepted residual (02b §7.4 risk 1, ADR-0007). Removing a student no longer cuts off their returned work.**
   - **Where:** migration :59-76 (rule (b)), :213-216 (builder join and `where`).
   - **Scenario:** a child enrolled by mistake gets work returned (or submits a blank unheld MCQ, which auto-returns). After "Remove from class", the child and every linked parent can still read it: questions, options, correct answers, explanations, marks, feedback, instructions. Archiving doesn't cut it either.
   - **What an admin must do to cut access** (none is per class):
     - (a) Deactivate the student's roster row (`students.is_active = false`): cuts the student and all parents off from everything; results kept.
     - (b) Deactivate the student's login: student only; parents still see the work.
     - (c) Delete the roster row: all the student's results cascade away, in every class; irreversible.
     - (d) Unlink a parent: that parent only.
     - (e) Delete the assignment: removes it for every student.
     - Staff can't "un-return" online work.
   - **Fix:** none now. Record the residual and (a)–(e) in the admin runbook. Later: a per-class "revoke past-class access" admin RPC (deletes that student's `assignment_results` for one class, marks included).
2. **S2 — Low. A student who has left still sees later edits to returned assignments.** `assignment_view` reads `title`, `instructions`, `due_on` and the class name live (:314; builder :189-194). Probe: a later `instructions` edit is visible to the removed student. Questions are locked (`has_submissions`). **Fix:** tutor guidance now (no class-only links or meeting details in old, returned work); later, freeze instructions once a result is returned if it matters.
3. **S3 — Note for T2.15 (item 2 rebase).** Under rule (b) a removed student could read every attachment on a returned assignment, including files added later. **Fix in T2.15:** (a) pgTAP: a removed student gets no storage SELECT on non-returned assignments; (b) PO decides whether later-added attachments are acceptable, else limit rule (b) reads to objects created before `returned_at`; (c) upload, register and remove keep `assignment_visible_to`, with a pgTAP case each.
4. **S4 — Informational, behaviour change.** Returning work in an archived class now emails the student and active parents (before item 7 it queued none). Same people, not wider. A later-linked parent only gets emails for returns after linking. The TSR should state it so it isn't reported as a bug.
5. **S5 — Informational.** Held work submitted then removed before return is stranded: hidden from the family, and the tutor gets `not_enrolled`. Fails closed. Already in ADR-0007 Later; workaround: re-enrol, return, remove.

## Residual risks

1. S1 as stated.
2. Item 2's rebase must carry rule (b), the hold rule and the grants (ADR-0007 decision 4, pinned by `fair_results.test.sql`); re-run the grant query there.
3. At release: confirm on hosted (read-only) that the migration is applied and `anon` can't execute `student_assignments` or `parent_child_assignments`.

## Added after review 5 round 3

6. **S6 — Low, accepted residual (pre-existing).** Staff who manage the class (its tutor, or an admin) can change `awarded_marks` on a multiple-choice answer straight through the API (`20261007090320:741` column grant; `check_assignment_answer` has no kind check), up to that question's marks, and the result total follows. The portal never sends it (multiple-choice saves are feedback-only since `6b082f0`). Not a family-facing risk. **Follow-up:** have `check_assignment_answer` refuse a multiple-choice mark change outside the submit path, with a pgTAP case.
