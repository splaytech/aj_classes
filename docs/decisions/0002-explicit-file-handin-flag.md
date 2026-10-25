# ADR-0002: File hand-in is an explicit flag on assignments

- **Status:** Accepted (2026-10-25, Architect, `/deliver` pending-requirements Stage 2; proposed and accepted the same day, when review-2 round 2 approved the stage)
- **Amends:** R3b design D6 ("online work has questions; paper homework doesn't")
- **Source:** `docs/delivery/2026-10-25-pending-requirements/02-architecture.md` §2.1

## Context

`private.is_online_assignment` treats "online" as "has questions". A question-less file hand-in
would therefore be paper: students couldn't submit it, and staff could set Submitted or Marked.
Treating every question-less assignment as online would silently turn all existing paper
homework into online work.

## Decision

- Add `assignments.is_file_handin boolean not null default false`.
- `is_online_assignment` = `is_file_handin` **or** has questions.
- A file hand-in can't have questions. The flag can't be turned on while a draft has questions,
  and it's locked once published.
- `student_submit`: a file hand-in needs ≥ 1 file and never auto-returns. It stays `submitted`
  until staff return it.
- Marks use `max_mark` through the existing `assignment_total_marks` fallback. With no
  `max_mark`, a file hand-in takes feedback only, like paper (`no_marks`).
- **The flag reaches the web app.**
  - `private.assignments_for_student` returns `is_file_handin`. Its `returns table` signature
    changes, so the migration drops and recreates it with `public.student_assignments()` and
    `public.parent_child_assignments(uuid)`, and re-grants execute.
  - `private.assignment_view` adds `isFileHandin` to its JSON.
  - The staff `ASSIGNMENT_COLUMNS` select includes the flag.
- One helper, `assignmentKind()` in `apps/web/src/lib/assignments.ts`, returns
  `'file_handin' | 'online' | 'paper'`. It replaces every `questionCount > 0` /
  `questions.length > 0` online test:
  - `assignment-detail.tsx:75,179,240`
  - `AssignmentDialog.tsx:43`
  - `student-home.tsx:127,132,153`
  - `student-assignment.tsx:55,96,118`
  - `parent-child-assignment.tsx:90`
  - `submission.tsx:73,98,128,156-158` and `submissions.service.ts:83`: a file hand-in gets one
    overall mark field (when it has a maximum mark) and the file list, and the service writes
    `mark` for it (review-2 round 2, finding 2)

## Consequences

- Existing rows default to `false`, so paper stays paper. No backfill.
- The **SQL** rules built on `is_online_assignment` cover file hand-in with no other change.
- The **web app** doesn't. It decides the kind itself, so it needs the flag in the family and
  staff reads, plus the helper above. Without them, a file hand-in shows as paper to students
  and gets the paper marks table for tutors.
- One drop-and-recreate of three family list functions (no data change).
- Reversible: it can be folded into an enum `kind` later in one migration.

## Alternatives rejected

- Enum `kind` on every assignment: it duplicates what the questions already say, and needs a
  consistency trigger plus changes to every existing create/edit flow.
- Implicit "no questions = online": it breaks existing paper homework.
