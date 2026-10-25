APPROVED

# Review 2: Architect stage (02-architecture.md, ADR-0001 to ADR-0004)

> **Reviewer gate, stage 2 of /deliver** · 25 Oct 2026 · branch `feature/pending-requirements`
> **Artifacts:** `02-architecture.md` (revised, 581 lines), `docs/decisions/0001`–`0004` and `README.md`
> **Against:** `01-requirement.md` items 1–3 (approved), `review-1.md` round 2 findings 1–3, and
> round 1 of this review

## Round 2

Both blocking findings and all five minor findings from round 1 are fixed. I re-checked each fix
against the doc, the code and the local stack. Nothing new blocks the stage. The findings below
are refinements that can go into the Solution Designer's brief.

### Round 1 findings, re-checked

| # | Round 1 finding | Status | Evidence |
|---|---|---|---|
| 1 | Decision 2: day window, and no backlog signal | **Fixed** | The cap is a rolling 24 h (lines 18, 426-432; ADR-0004 §3). Stuck `sending` rows are reclaimed after 10 min (433-435). `admin_email_problems()` shows Failed and Waiting rows, with "Daily limit", "Retrying" and "Not attempted" (436-449). Decision 2's wording now names that page. One refinement in finding 1 below |
| 2 | File hand-in is invisible to the web app | **Fixed** | The flag goes through `assignments_for_student` and its two wrappers, `assignment_view` and the staff select (174-190). `assignmentKind()` has a call-site table (192-210), and ADR-0002's Consequences are corrected. I confirmed the drop-and-recreate is safe: see "Checked" below. One page is missing from the table: finding 2 |
| 3 | Storage orphans, MIME claim, failed deletes | **Fixed** | The per-folder cap is 5 objects (265-272). MIME is described as "declared" (258-262, ADR-0003 §3). Deletes go by prefix with one retry, and two sweep cases are in Later (308-319). The cap has a race: finding 3 |
| 4 | Cron log growth | **Fixed** | The job runs every 5 min and skips when nothing is due or the cap is reached. A daily purge keeps 7 days (391-404, 528-529) |
| 5 | Secret defaults | **Fixed** | No default transport and no default secret. `deploy.sh` requires a non-local secret and unsets Mailpit values. `reason` holds codes only (450-475) |
| 6 | AC gaps | **Fixed** | AC-2.9 (no `max_mark` means feedback only: 171-173), AC-2.7 staff RLS (276-281), AC-1.8 counting and the `NAV.newsLink` shape (73-78) |
| 7 | Housekeeping | **Fixed** | ADRs and the README say Proposed. `routes.ts:19` and r3b D6 are on the docs-to-update list (550-553) |

### Checked this round

- **Dropping and recreating `assignments_for_student` is safe.** It and both wrappers are
  `language sql` with ordinary string bodies (not `begin atomic`), and `assignment_view` is
  plpgsql, so Postgres records no dependency between them. The drop succeeds without `cascade`.
  The wrappers (`select *`, `family_functions.sql:370,597`) must be recreated because their
  `returns table` lists would no longer match, and the doc does that.
  - The recreated functions get Postgres's default `EXECUTE` to `PUBLIC`, and Supabase's default
    privileges also grant it to `anon`. So both `revoke` blocks must be re-run, not only the
    `grant`. The doc re-applies `:786-830`, which covers `private.assignments_for_student`
    (`:795`) and both public wrappers (`:806,812`). Correct.
  - Recreating `assignment_view` isn't strictly required (`select s.* into record` adapts to new
    columns), but the new `isFileHandin` key needs it anyway.
  - The other callers, `student_assignment` and `parent_child_assignment` (`:381,608`), call
    `assignment_view`, whose signature doesn't change. The web callers only gain a field.
- **The per-folder count can be enforced from a storage policy.** `postgres` reads
  `storage.objects` and bypasses RLS (checked locally: `has_table_privilege` is true and
  `rolbypassrls` is true). So a `security definer` function owned by `postgres` can count objects
  under a prefix from inside a `storage.objects` INSERT policy without recursing. That's the same
  approach the avatars policy already takes with `private.is_admin()`. One caveat: finding 3.
- **The rolling cap and the reclaim.** The 10-minute reclaim is longer than the edge-function
  wall-clock limit (150 s on Free, 400 s on paid). So when a row is reclaimed, the worker that
  claimed it is already dead, and two live workers never hold the same row. Two narrow edges
  remain: finding 1.
- **The call-site list** matches my grep of `src`, apart from `submission.tsx` (finding 2).

### Findings

1. **[minor] Two narrow edges in the email worker** (`02-architecture.md:397-402,426-435`;
   ADR-0004 §2-3).
   - **(a) The cap counts only `sent`.** If two worker runs overlap (a slow run plus a kick
     5 minutes later, or a manual run), the second one doesn't count the first run's rows that are
     still `sending`. Together they can claim more than 70. Unlikely with a 150 s limit and a
     5-minute kick, but trivial to close: count
     `status in ('sent','sending') and coalesce(sent_at, claimed_at) > now() - interval '24 hours'`.
   - **(b) Reclaim can send a duplicate.** A worker can die after Resend accepted the email but
     before it wrote `sent`. The row is then reclaimed and sent again, which breaks AC-3.5 ("at
     most once"). Fix:
     - send `Idempotency-Key: <email_outbox.id>` on the Resend call (Resend deduplicates for
       24 h, which covers the 10-minute reclaim);
     - write `sent` per row straight after each send, not once for the whole batch.

2. **[minor] The tutor's submission page is missing from the call-site table**
   (`02-architecture.md:197-210`).
   - `routes/portal/submission.tsx` is where AC-2.9 happens. It marks per question, and its score
     line adds up question marks (`:128,156-158`), so a file hand-in with a `max_mark` would show
     "0 / 20".
   - `submissions.service.ts:83` writes only `feedback` and `status` on `assignment_results`,
     never `mark`.
   - The DB side is right: the grant exists, and there is no answer trigger to overwrite the
     mark. But the web page needs, for a file hand-in:
     - one overall mark field, shown only when `totalMarks` isn't null;
     - the file list;
     - the service writing `mark`.
   - Add a row to the table. Also correct line 209-210: the claim that a grep found no other
     checks misses this page, because it uses `assignment.questions` without a length test.

3. **[minor] The 5-object cap needs a lock, or parallel uploads get past it**
   (`02-architecture.md:265-270,288`; ADR-0003 §3).
   - Storage inserts the object row in a transaction that stays open while the file uploads.
     Parallel uploads into one folder each count only committed rows. So each of 20 parallel
     requests sees 4 and passes, and the "at most 50 MB" claim fails for a student who bypasses
     the browser.
   - Fix: the policy function takes `pg_advisory_xact_lock(hashtext(folder))` before it counts.
     It must be declared `volatile`: a `stable` function reuses the caller's snapshot and wouldn't
     see the row the previous holder just committed. The lock is held only per folder, for the
     length of one upload.
   - Add a pgTAP or script test that fires 6 parallel uploads.

4. **[minor] Carry-over to the Product Owner and Solution Designer: AC-3.8's wording.** AC-3.8 says
   the list shows failed sends with the empty state "No failed emails". The design now shows Failed
   and Waiting rows, with the empty state "No failed or waiting emails" (line 447-448). The PO
   updates AC-3.8 (list contents and empty state) before the Tester uses it. This doesn't block, as
   agreed.

5. **[minor] Small items to tidy.**
   - `config_missing` puts rows back to `pending`, but the computed Waiting reasons (lines 442-445)
     don't include it. With `attempts > 0` they show "Retrying". Map `config_missing` to "Not set
     up" (or "Not attempted"), so a missing `EMAIL_TRANSPORT` reads as a set-up error.
   - ADR-0003's Decision list is numbered 1-6, 8, 7. Renumber it.
   - In `02-architecture.md`, lines 528-531 run the "Upgrade trigger…" sentence into the
     `cron.job_run_details` bullet. Split it into its own line.

### Simplicity and the decisions list

Unchanged from round 1, with one improvement. The 5-minute cron with a skip condition is leaner
than before. The added parts (reclaim, Waiting rows, reason codes) are each a few lines of SQL,
and each one answers a real "Saurabh would see something untrue" case. Decision 2 is now accurate.
Decision 1 is unchanged. No new vendor, paid plan, auth change or lock-in has been introduced.

## Next

Proceed to the Solution Designer. Carry findings 1-5 into its brief. Finding 2 belongs in the
component list. Findings 1 and 3 belong in the migration and function contracts. Finding 4 goes to
the PO for an AC-3.8 wording update. Once this stage is approved, the ADRs move from Proposed to
Accepted.
