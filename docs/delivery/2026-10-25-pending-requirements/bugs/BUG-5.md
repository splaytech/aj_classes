# BUG-5 — Returning work that has no `marked_by` sends no "work returned" email

- **Found:** 2026-10-25, `/test-and-ship` item 3, round 1, case E-20 · **Build:** `feature/work-returned-email` @ `4af50eb` (descends from `716c283`)
- **Severity:** Medium. A tutor returns the work, sees "Saved", and the student and parents silently get no email. Nothing shows on Admin → Emails either, because no row is ever queued. That breaks AC-3.1 ("When staff return a student's work … one email goes to …") for every result whose `marked_by` is empty. The seed's own demo row is one, so the local demo of the feature sends nothing.

## Steps to reproduce

1. Local stack after `pnpm db:reset` (or as the seed leaves it): Aarav's "Reasoning mock test 1" result is `marked`, mark 42.
   `select status, marked_by from public.assignment_results r join public.assignments a on a.id = r.assignment_id where a.title = 'Reasoning mock test 1' and r.student_id = (select id from public.students where full_name = 'Aarav Demo');` → `marked|` (null).
2. Dev server on :5173. Sign in as `tutor@local.test`, open the assignment (`/portal/assignments/<id>`).
3. Set Aarav's status from **Marked** to **Returned** and click **Save**.
4. `select count(*) from public.email_outbox where assignment_id = '<id>';`

## Expected

The return succeeds, and 2 rows are queued (Aarav's student account and `parent@local.test`). Within 5 minutes, one email reaches each of them.

## Actual

- The UI shows "Saved", and the result is `returned` with `returned_at` set.
- The PATCH response has `"marker": null`.
- Outbox rows: **0**. Calling the worker gives `claimed: 0`. Mailpit has no new message. Admin → Emails says "No failed or waiting emails".

Control: the same steps after `update … set marked_by = <tutor id>` (as a tutor-marked result would be) queue 2 rows and send 2 emails (E-20 re-run).

## Cause

- `assignment_results_queue_email` fires only `when (new.status = 'returned' and new.marked_by is not null)` (migration `20261025110000`, step 5). `marked_by` stands in for "returned by staff".
- `check_assignment_result` (`20261007090320_student_parent_portal.sql:605-614`) sets `marked_by` only on INSERT, on a change *into* marked/returned from another status, or when the mark or feedback changes.
- A **marked → returned** change with the mark and feedback unchanged keeps the old `marked_by`. If that is null, the staff return can never queue an email.

Results with a null `marked_by` while `marked`:
- rows written by the seed, an import or SQL;
- rows marked by a tutor whose profile was later deleted (`marked_by … on delete set null`).

The shared hosted DB may hold such rows from the legacy data work.

## Suggested fix

Either of these:
1. In `check_assignment_result`, when `by_staff` and the status changes to `returned`, set `marked_by` (and `marked_at`) if it is null.
2. Have the email trigger decide "staff return" from the caller at return time (for example a `returned_by` column, or a staff check in the trigger), not from `marked_by`.

Then add a pgTAP case: a `marked` row with null `marked_by`, returned by the tutor → 2 rows queued. Also consider seeding the mock result with `marked_by = tutor`, so the demo sends.

## Evidence

- TSR-item-3 E-20 (both runs).
- The PATCH body from the UI run: `"marker":null`, `status":"returned"`; `ob` empty.
