# ADR-0007: Returned work stays readable after leaving a class; writes still follow enrolment; results can be held

- **Status:** Proposed (2026-10-26, Architect, `/deliver` pending-requirements items 4–8, Stage 2). Becomes Accepted when this stage's review approves it.
- **Source:** `docs/delivery/2026-10-25-pending-requirements/02b-architecture-items-4-8.md` item 7
- **Changes:** R3b F8 ("visibility follows enrolment") and R3b D8 (all-MCQ work always auto-returns)

## Context

One predicate, `private.assignment_visible_to` (published, class active, enrolled), gates both
family reads and every family write. Removing a student, or archiving a class, hides that
student's returned marks from them and their parents.

All-MCQ quizzes return on submit, so the first finisher can share the answers.

Held item 2 drops and recreates the same family builders, `assignments_for_student` with its
wrappers and `assignment_view`, and replaces `student_submit`.

## Decision

1. **`assignment_visible_to` is unchanged (rule (a)), and every write path keeps using it.**
   `check_assignment_result`'s `not_enrolled` guard also stays. Past-class work is read-only by
   construction.
2. **A new `private.assignment_readable_by(student, assignment)`** = rule (a), or the assignment is
   published and the student's result is `returned` (rule (b)). Only read paths use it:
   - `assignments_for_student`: a left join on enrolment, plus an `is_past_class` column.
     Dropped and recreated with its two wrappers and their grants.
   - `assignment_view`, through the builder: gains an `isPastClass` key.
   - item 3's `work_returned_recipients`.
   - item 2's `can_read_assignment_file`, in its family branches, once item 2 lands.
3. **`assignments.hold_results boolean not null default false`**, granted for staff insert and
   update.
   - A guard trigger allows changes only on drafts, and refuses `true` without questions or on a
     file hand-in.
   - `student_submit` doesn't auto-return when it's on.
   - The staff return path, the `marked_by` rules and item 3's email are unchanged.
4. **Migration order with item 2.** Whichever of the two merges second has its migration renamed
   to a timestamp later than everything on `develop`. This is safe only while the file has never
   been applied to hosted, which `supabase migration list` checks. Every shared function is then
   rebuilt from its current body on `develop`, never from an older snapshot. Item 7's pgTAP tests
   run on the rebased branch to catch a lost rule. `db push --include-all` is never used.

## Consequences

- Families keep their record of marks and feedback across class changes and term-end archiving.
- Removing a student no longer revokes their returned work. Deactivating the student, or deleting
  the roster row, still does.
- A tutor can't return work for a student who has left (Later bucket).
- Item 2's eventual rebase has more to carry. The rule and the pinned tests make that mechanical.

## Alternatives rejected

- Widening `assignment_visible_to` itself: it would open every write path to past-class students.
- A separate "past work" RPC and page: a second read model for the same data, and AC-7.12 keeps the
  work in the normal list.
- A per-class hold default, or inferring hold from a dummy written question: deferred, and the
  status-quo workaround respectively.
