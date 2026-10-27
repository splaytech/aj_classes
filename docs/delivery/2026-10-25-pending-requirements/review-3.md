APPROVED

# Review 3: Solution Designer stage (03-design.md)

> **Reviewer gate, stage 3 of /deliver** · 25 Oct 2026 · branch `feature/pending-requirements`
> **Round 3 (final):** only the R2-1 to R2-5 fixes were checked, in `03-design.md` §1.6, §2.10
> (AC-2.9 row), §3.6 and §3.10, and in `02-architecture.md:22`. Settled findings weren't
> reopened.

## Round 3

All five round 2 findings are fixed. One nit is left, and it doesn't block the stage. The stage
is approved.

| # | Finding | Status | Evidence |
|---|---|---|---|
| R2-1 | Cron pause in `test-notifications.mjs` | **Fixed** | 03:1883-1903. The job is paused with `cron.alter_job(jobid, active := false)`, never removed. It resumes in a `finally` block and in `SIGINT`/`SIGTERM` handlers, which resume first and then exit 130/143. A `check()` confirms `active = t`. The script prints a recovery command at the start, and the design notes the `$$` shell-expansion trap. Verified below |
| R2-2 | `env $LOCAL_SB` broke in zsh | **Fixed** | 03:257-264 now uses two `export` lines, then plain `VITE_APP_ENV=… pnpm build` |
| R2-3 | Deploy check looked only at presence | **Fixed** | 03:1810-1820 compares the digests of `EMAIL_TRANSPORT` (`resend`) and `SITE_URL` (`https://ajclasses.com.au`), takes only the hash field with `cut -d' ' -f1`, skips the check under `--dry-run`, and makes "confirm the digest format on the first real run" a release step |
| R2-4 | AC-2.9 row expected the old mark rule | **Fixed** | 03:1175: "Return works without a mark, and the student then sees no mark" |
| R2-5 | 02 release steps lacked the phone check | **Fixed** | 02:22-24 adds the hosted phone camera/library check, with a test class and test student only. The 429 attempt nit was accepted as is |

### Verified on the local stack

`cron.alter_job` works on the local image. I ran this in one transaction and rolled it back, so
pg_cron is still not installed afterwards:
- `create extension pg_cron` gives version 1.6.4. Its signature is
  `alter_job(job_id bigint, schedule text, command text, database text, username text, active boolean)`.
- I scheduled `email-worker-kick`. The exact pause statement from 03:1891 set `active = f`, and
  the resume statement set it back to `t`.
- With no matching job, the same statement returns 0 rows and raises nothing. So a missing job
  no longer makes the script fail.
- The statements contain only single quotes and `:=`. They pass through the `sql` helper's
  double-quoted `/bin/sh` string (`local-test-helpers.mjs:82-85`) unchanged.

**Signal handlers resume before they exit.** The `sql` helper uses `execSync`, so the resume
finishes synchronously before the handler calls `process.exit(130|143)`.
- If Ctrl-C lands during an `execSync` call, the `docker exec` child is killed too. The `finally`
  block resumes the job, and then the handler resumes it again. Resuming twice is harmless.
- `finish()` only sets `process.exitCode`, so the `finally` block also runs on ordinary failures.

### Nit (doesn't block)

R3-1. 03:1898-1900 describes the signal handlers under step 4 ("Resume"). The Developer should
register them **before** step 1's pause, so a Ctrl-C between the pause and the `try` block still
resumes the job. This is a one-line ordering note for the build plan.

### Next

The stage is approved. Hand to the Manager for the build plan and todo file. Carry R3-1 into it.
Nothing here needs Saurabh.

## Round 2

Round 1's blocking findings 1 and 2 are fixed, and so are all 12 minors (3-14), three of them with a small gap. One new
problem blocks the stage: the cron pause in the notifications test script. Four minor findings need small
fixes. Everything else is ready.

### Round 1 findings, re-checked

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | Upload cap can't stop parallel uploads | **Fixed** (option a) | 03:598-616 drops the lock and `volatile`, and says how storage-api v1.80.2 applies the policy (rolled-back check, superuser write). The hard cap is the register RPCs: each locks first (assignment row `for update` / result row `for update`, 03:741-743), then counts, so parallel registers line up and at most 5 succeed. The test was changed (03:1180). There's a known limit in §6 (03:1965-1969). 02:275-279 and ADR-0003 §3 say the same. The upload's `INSERT` is correctly described as having no `RETURNING` |
| 2 | Switch upsert needs UPDATE on `profile_id` | **Fixed** | 03:1737-1744 does update, then insert, as `saveResult` does. The grants are unchanged |
| 3 | `FUNCTIONS` names the other item's function | **Fixed** | 03:38-40, :1795 |
| 4 | Second `secrets set` re-copies local values | **Fixed, one gap** | 03:1796-1810 now runs one `set`, then `unset` last, then a `secrets list` check. The check doesn't look at the values of `EMAIL_TRANSPORT` and `SITE_URL`: finding R2-3 |
| 5 | Item 2 unmerged until B3 | **Fixed** | 03:35-37 |
| 6 | Vercel mirror served an empty folder | **Fixed** | 03:270-273, with no positional folder; matches `serve` `main.js:476-479, 529` |
| 7 | Local-build override missing | **Fixed, but the command breaks in zsh** | 03:255-260: finding R2-2 |
| 8 | Storage error codes are in the response body | **Fixed** | 03:955-958; script test 03:1180 checks the body's `"403"` |
| 9 | `notify_record_result` contract | **Fixed** | 03:1457-1487: full header, the valid outcome/reason pairs, and an `invalid_input` test. The 429 stop-batch is at 03:1641-1645 |
| 10 | Seed and Vault collisions in tests | **Fixed, but the cron pause is unsafe** | 03:1860-1883 clears the outbox, updates/deletes the seeded Vault rows, and replaces the cap with 2. The cron unschedule/reschedule: finding R2-1 |
| 11 | Missing tests | **Fixed** | Claim-time skip row (03:1904); deactivated student in AC-3.2 (03:1886) |
| 12 | Assumptions without an owner | **Fixed, one leftover** | The mark is optional (03:1060, choice 6). The B1 question now carries the Privacy sentence (01:200-205, with a change-log row). One test row still expects the old rule: finding R2-4 |
| 13 | Phone check on the local stack | **Fixed** | 03:1178: device mode and file-picker checks locally; the phone camera check moves to a hosted release step. 02:22 doesn't list that step yet (R2-5) |
| 14 | Tidy-ups | **Fixed** | 02:282-284 and :484-485 point to 03 §5. The cap override is in the tests (03:1864-1865). The `posts.service.ts` comment is in file 2 (03:95) |

### New findings

R2-1. **[blocking] Pausing cron in `test-notifications.mjs` can leave the local stack broken,
and the next run then fails.** 03:1872-1880.
- **No guard on step 1.** `cron.unschedule('email-worker-kick')` *raises* when the job doesn't
  exist ("could not find valid entry for job"). After any run that didn't restore the job,
  every later `pnpm test:functions` fails at step 1 until someone runs `pnpm db:reset`.
- **Step 4's restore breaks through the shell.** The repo's `sql` helper
  (`supabase/scripts/local-test-helpers.mjs:82-85`) passes the query to `/bin/sh` inside double
  quotes. So the migration's `$$select private.kick_email_worker()$$` turns into
  `<pid>select …<pid>`, and the `finally` restore fails on every run. The job then stays off.
- **Ctrl-C skips the `finally`.** An interrupted run leaves cron off with no message.
- **Fix: pause the job instead of removing it.** No re-creation, no quoting, and no failure when
  the job is missing:
  - Start:
    `select cron.alter_job(jobid, active := false) from cron.job where jobname = 'email-worker-kick'`
    (pg_cron 1.6.4 has `alter_job(…, active)`).
  - `finally`, plus a `process.on('SIGINT'|'SIGTERM')` handler that does the same and exits: the
    same statement with `active := true`.
  - Then `check()` that `cron.job` shows the job as active.
  - The script prints the one-line recovery command when it starts. The README notes that
    `pnpm db:reset` also restores the job.
  - `finish()` sets `process.exitCode` rather than calling `process.exit`, so the `finally` does
    run on normal failures.

R2-2. **[minor] `env $LOCAL_SB …` doesn't work in zsh, which is the shell here.** 03:255-260.
- zsh doesn't split an unquoted variable into words. So `env` gets **one** assignment:
  `VITE_SUPABASE_URL="http://127.0.0.1:55321 VITE_SUPABASE_PUBLISHABLE_KEY=…"`.
- The build then has a broken URL and the hosted key from `.env.production`. Every AC-1.x
  browser check shows the error state. It doesn't reach the hosted DB, but it fails for the
  wrong reason.
- I hit exactly this zsh behaviour running a command in this repo during this review.
- Fix: two `export` lines (`export VITE_SUPABASE_URL=http://127.0.0.1:55321` and
  `export VITE_SUPABASE_PUBLISHABLE_KEY=<from pnpm db:status>`), then plain
  `VITE_APP_ENV=… pnpm build`.

R2-3. **[minor] The deploy check should look at the hosted values, not only whether they
exist.** 03:1806-1810.
- Whether an explicit `NAME=VALUE` beats the `config.toml` copy in the same `secrets set` call
  isn't proven. If the copy wins, the check catches the local worker secret but not
  `EMAIL_TRANSPORT=mailpit` or `SITE_URL=http://localhost:5173`. Those fail safely (no transport
  means no send), but the emails' links would point at localhost.
- Fix: also fail unless `EMAIL_TRANSPORT`'s digest is `sha256("resend")` and `SITE_URL`'s is
  `sha256("https://ajclasses.com.au")`.
- Take only the hash field from `shasum` (`| cut -d' ' -f1`).
- Skip the check under `--dry-run`, because `run` only prints.
- Confirm on the first real run that `secrets list -o json` gives SHA-256 hex digests.

R2-4. **[minor] One AC-2.9 test row still expects the old mark rule.** 03:1172 says "Return
refused without a mark". After the team lead's decision (03:1060, choice 6) it should say "Return
works without a mark; the student then sees no mark". Otherwise the Tester fails a correct build.

R2-5. **[minor, nit]**
- 02:22 (item 2 release steps) doesn't list the hosted phone camera check that 03:1178 adds
  for Saurabh.
- The 429 stop-batch (03:1641-1645) uses up an attempt on rows it never sent. Three rate-limited
  runs in a row would mark them `max_attempts`. That's acceptable at this volume. If it shows up
  on the Emails page, add a "release" outcome that keeps the attempt count.

### Checked this round

- The register RPCs lock before they count, so the hard cap holds under parallel registers.
- The `assignment_view` `unfinishedUploads` key still shows the extras to their owner only, never
  to parents.
- `notify_record_result`'s parameter names (`target`, `outcome`, `failure_reason`) don't clash
  with any `email_outbox` column. Its `case` gives `failed`/`max_attempts` at attempts 3 for
  `retry`, and only a row that is still `sending` changes.
- `deploy.sh` ordering: `config push` (step 2) and the single `secrets set` both run before the
  final `unset`, so nothing runs after it that could copy the local values back.
- CLI 2.120.0 has `--output/-o json` on `secrets list`.
- No section that round 2 left untouched is newly broken.

### Next

The Solution Designer fixes R2-1 (replace unschedule/reschedule with `alter_job` pause/resume,
plus a signal handler and a check) and folds in R2-2 to R2-5. Those are small, local edits. A
quick round 3 check on §1.6, §3.6 and §3.10 only, then this stage can be approved. Nothing here
needs Saurabh.

## Round 1

### Verdict in one line

The design is thorough and nearly all of it is correct against the code. Two findings block it.
The upload-cap mechanism can't work on the Storage version we run, so its own 6-parallel test
would fail (1). The notification-switch save would fail on every call (2). Both are small to fix.
Items 1 and 3 can't move until (2) and (1) are fixed, because they share this gate; item 1 has
no blocking finding of its own.

### Blocking

1. **[blocking] The 5-object cap can't stop parallel uploads. The lock is released before the
   object row is written.**
   `03-design.md:578-581, 584-619, 1151, 1894`; ADR-0003 §3; `02-architecture.md:275-276`.
   - I read storage-api v1.80.2 in the running container (`/app/dist/storage/uploader.js:50-80,
     159-190`, `database/pg.js:214-228`):
     - The INSERT policy runs only inside `canUpload` → `db.testPermission(...)`. That is a
       transaction the API **always rolls back**. So `pg_advisory_xact_lock` is released straight
       away.
     - The bytes then upload with no transaction open.
     - `completeUpload` writes the real row with `this.db.asSuperUser()`. RLS isn't checked
       there, so the policy function never runs again.
   - So with 6 parallel uploads into one folder, all 6 permission checks run before any row is
     committed. Each counts 4 or fewer and passes, and all 6 rows are written. The carry-over 3
     script test ("exactly 5 × 200 and 1 failure", line 1151) will fail as designed.
   - This is my mistake from review-2 finding 3. Its premise ("the transaction stays open while
     the file uploads") is wrong for this version. Sequential uploads are capped correctly, and
     the UI only uploads sequentially (FilesCard uploads "one at a time", line 1011).
   - Also at line 579: `createObject` is a plain `INSERT` with no `RETURNING`. The SELECT
     "unregistered" branch is still needed, but for `DELETE … RETURNING` and signed URLs
     (`pg.js:988-1010`), not for the upload.
   - **Fix (choose one; neither needs Saurabh):**
     - **(a) Recommended, smallest.** Keep the policy count, which holds for sequential uploads.
       Drop `volatile` and the advisory lock, and the "can't race" claim in 03 §2.2 step 8, 02
       §2.2 and ADR-0003 §3. The hard limit is then the **registered** files: the register RPCs
       already lock and count. Add to §6 Known limits: "a student who bypasses the browser can
       store more than 5 unregistered objects (≤ 10 MB each) with parallel requests. They see
       these as unfinished uploads, and the Later sweep removes them." Change the script test:
       a sequential 6th upload is refused by Storage, and after 6 parallel uploads at most 5
       files register. Security notes this in their sweep.
     - **(b) Keep a hard cap.** Reserve, then upload, then confirm. A reserve RPC writes a
       pending row for the exact path under the result-row lock (≤ 5 per folder). The INSERT
       policy allows only a path that has a pending reservation and no object yet. Confirm reads
       the real size. This changes ADR-0003's flow, so the Architect signs it off.

2. **[blocking] Saving the email switch fails with "permission denied" every time.**
   `03-design.md:1254-1255` (grants), `:1678` (service contract).
   - `saveMyNotificationSettings` uses PostgREST `upsert(..., { onConflict: 'profile_id' })`.
     PostgREST turns that into `ON CONFLICT (profile_id) DO UPDATE SET profile_id =
     EXCLUDED.profile_id, work_returned = EXCLUDED.work_returned`. It sets **every** column in
     the payload, so Postgres checks for UPDATE permission on `profile_id`.
   - The migration grants only `update (work_returned)`, so the statement is refused before it
     runs. That happens on the first save too, not only the second. AC-3.6 (Save, then
     "Saved…") fails.
   - The pgTAP plan (AC-3.6 row, line 1799) uses direct SQL, so it wouldn't catch this. Only the
     browser would.
   - The repo already avoids this pattern: `saveResult` does an update, then an insert
     (`apps/web/src/services/assignments.service.ts:215-240`).
   - **Fix:** do the same in `saveMyNotificationSettings`:
     `update({ work_returned }).eq('profile_id', me).select('profile_id').maybeSingle()`, and
     insert if no row came back. Keep the grants as they are. (Granting `update (profile_id)`
     also works, because the policy's `with check` pins the value, but update-then-insert
     matches the repo.)

### Minor

3. **[minor] Item 3's `deploy.sh` change breaks item independence.** `03-design.md:1730`
   sets `FUNCTIONS=(account-admin leads assignment-files notifications)`. If item 3 ships before
   item 2 (which §0.1 expects), `supabase functions deploy assignment-files` fails on a folder
   that doesn't exist yet. Fix: each item appends only its own function name.

4. **[minor] The second `secrets set` can bring the local-only values back.**
   `03-design.md:1731-1734`; `supabase/scripts/deploy.sh:94-101`.
   - The repo's own comment says the CLI copies `[edge_runtime.secrets]` from `config.toml` on
     `secrets set`. The design runs `unset`, then a **second** `secrets set`. That second call
     would copy `MAILPIT_URL` and the Zoho fakes again (`ZOHO_API_URL` pointing at
     `host.docker.internal`, which breaks live Zoho sync).
   - Fix:
     - Put all hosted values in the second `set`, and move the single `unset` to after it, at
       the very end.
     - Add a check after deploy: `supabase secrets list -o json`. Fail if `NOTIFY_WORKER_SECRET`'s
       digest equals the SHA-256 of `local-notify-secret`, or if any `local_only` name is still
       there.

5. **[minor] Say that item 2 stays off `develop` until B3.** `03-design.md:28-32`.
   - The renaming rule is correct. `db push` refuses local migrations that are older than the
     newest applied remote one (unless you pass `--include-all`, which we shouldn't).
   - But `deploy.sh` step 4 (`supabase db push`) applies **every** migration in the checkout. If
     item 2's file is on `develop` when Saurabh deploys item 3, the bucket and table go live
     before B3.
   - Add one line: "item 2 stays on its own branch, unmerged, until B3 is approved."

6. **[minor] The Vercel-mirror command serves an empty folder.** `03-design.md:255`.
   - Command: `serve build/client --config <scratch>/serve-like-vercel.json`, with the copied
     `"public": "build/client"`.
   - serve 14 resolves `public` against the positional folder
     (`node_modules/serve/build/main.js:476-479`). So it serves `build/client/build/client`, and
     every page returns 404. AC-1.1/1.3/1.4/1.5 then fail on the first run.
   - Fix: drop the positional `build/client` (run from `apps/web`), as `start:railway` does.

7. **[minor] The local-build override is on only one of the build commands.**
   `03-design.md:246, 261, 270`.
   - The box at line 261 correctly overrides `VITE_SUPABASE_URL`/`_PUBLISHABLE_KEY`. (Shell
     variables win over `.env.production`, and `apps/web/.env.production` points at the shared
     hosted project.)
   - But the "Commands" line (246) and the AC-1.4 staging build (270) don't have it. A Tester
     who opens either build in a browser reads the hosted project, which goes against §0.3.1.
   - Fix: define one env prefix and use it in every build command in §1.6.

8. **[minor] Storage errors come back as HTTP 400. The real code is in the body.**
   `03-design.md:927-928, 1138`.
   - storage-api returns HTTP 400 with `statusCode: "413" | "415" | "403"` in the JSON body
     (`/app/dist/http/error-handler.js:69-76`).
   - So the service must map `StorageApiError.statusCode`, not the HTTP status. The script test
     "refuses text/html (415) and an 11 MB PDF (413)" must check the body's `statusCode`.

9. **[minor] `notify_record_result` is the one RPC without a full contract.**
   `03-design.md:1375-1376, 1433-1435`.
   - Add the header: `language plpgsql volatile security definer set search_path = ''`.
   - Say which outcome and reason pairs are valid. For example: `sent` takes no reason; `retry`
     takes `rate_limited`/`server_error`/`network` only; `failed` takes `rejected`.
   - Optional: on a 429, stop the batch (§3.4.2 step 3). Otherwise one busy minute uses up an
     attempt on every claimed row.

10. **[minor] The item 3 tests will trip over the seed and Vault.**
    `03-design.md:1715-1720, 1794, 1800, 1805`; `supabase/seed.sql:276-291`.
    - The seed's tutor returns "patterns" for Aarav. So once the trigger exists, every
      `db reset` queues 2 outbox rows (student + parent), and cron sends them to Mailpit within
      5 minutes.
    - `test-notifications.mjs` must drain those first: call the worker, then
      `DELETE /api/v1/messages`. Then it returns `v_word`. Its "one email to student" and "sends
      nothing the second time" checks must also allow for a cron kick landing mid-test, for
      example by running `cron.unschedule` at the start and re-scheduling at the end.
    - Vault secret names are unique, and the seed creates them. So "Vault secrets created inside
      the test transaction" (line 1805) must update or delete the seeded ones first. The same
      goes for the "no worker secret" case (line 1800).

11. **[minor] Two behaviours have no test.** `03-design.md:1392-1395, 1838-1840`.
    - Choice 7, the claim-time `skipped` path, has no pgTAP case. Add two: turn the switch off
      after the row is queued, and deactivate the recipient after it is queued. Each row should
      end `skipped` and not appear in `admin_email_problems`.
    - The fixtures for AC-3.2/3.5 also lack a deactivated **student** account. Add one.

12. **[minor] Two assumptions go beyond the ACs and need a named owner.**
    - Choice 6 (`:1836-1837`), "Return needs a mark" on a file hand-in with a maximum. AC-2.9
      says the tutor "can enter" a mark. Requiring it is reasonable, but the Product Owner
      confirms it (or makes it optional) before the Tester uses AC-2.9.
    - Choice 14 (`:234-235, 1852-1853`), item 1's Privacy sentence ships as a draft with B1.
      That is Privacy Policy wording going to production. Add it to the B1 question in
      `01-requirement.md` §2.2 so Saurabh says yes knowingly, rather than learning about it from
      the release message.

13. **[minor] AC-2.15 (phone) can't run on the local stack as described.** `03-design.md:1149`.
    - A phone can't reach `localhost:5173` or `127.0.0.1:55321`.
    - Add the steps: `pnpm dev --host`, `VITE_SUPABASE_URL=http://<LAN IP>:55321`, the LAN
      origin added to `ALLOWED_ORIGINS`. Or say that Chrome device mode covers 360 px and that
      the camera picker is checked at the hosted release.

14. **[minor] Tidy-ups.**
    - `02-architecture.md:477-479` still says claimed rows "go back to pending" on a missing
      transport, and `:278-279` still names the two list RPCs. Add a one-line pointer to 03 §5
      in each, so 02 doesn't contradict the accepted design.
    - §4 lists 16 choices, but the hand-off says 15.
    - `03-design.md:1801, 1805`: 70 `sent` rows need 70 distinct
      `(assignment, student, recipient)` keys. It's simpler to
      `create or replace function private.email_daily_cap()` with a small value inside the test
      transaction.
    - `posts.service.ts:33`'s comment ("used by both the admin page and the public page") goes
      stale. Update it with file 2.

### Checked and correct

- **Family functions.** The line ranges are right: `family_functions.sql:151-202, 206-267,
  347-371, 463-527, 574-598`. No later migration redefines these functions; `invite_onboarding`
  redefines only `my_student_id` and `my_active_role`.
  - Dropping the two wrappers, then `private.assignments_for_student`, works without `cascade`.
    They are all `language sql` string bodies, and `assignment_view` is plpgsql.
  - Appending `is_file_handin` last keeps `select *` aligned.
  - Step 12 re-runs both `revoke` blocks and the grant, and it covers every new `private.*`
    function. That's needed because `20261007090320:744` revoked execute only from the functions
    that existed then, and `authenticated` has `usage` on `private`.
- **Triggers.**
  - `assignment_questions_check` locks the assignment row `for update`, and it fires before
    `assignment_questions_not_file_handin` in name order.
  - The flag trigger fires only when `is_file_handin` is in the SET list. An unchanged value on a
    published row passes.
  - `check_assignment_result` (`student_parent_portal.sql:529-640`) behaves as claimed:
    - staff Submitted/Marked on online work is refused (`invalid_status`);
    - submitted → returned is allowed;
    - `unmarked_answers` is empty for a file hand-in;
    - `assignment_total_marks` falls back to `max_mark`;
    - `marked_by` is null on the automatic return and set on staff returns, so item 3's
      `when (new.status = 'returned' and new.marked_by is not null)` and the
      `old.status = 'returned'` guard give one email per return.
  - `saveSubmission` writing `mark` isn't overwritten: `update_result_mark` fires only on
    answers.
- **The rest of the item 2 SQL.**
  - The path regex groups (1 assignment, 3 student, 4 file) and the `folder` value.
  - The `can_read_assignment_file` matrix against AC-2.7/2.11.
  - The DELETE policy only on unregistered objects.
  - No UPDATE policy, so an `x-upsert` replace is refused at `testPermission`.
  - `owner_id` exists alongside `owner` on the local `storage.objects`.
  - `protect_objects_delete` exists, so the `allow_delete_query` note for pgTAP is right.
- **Item 3 SQL.**
  - Every column exists: `profiles.status`, `email`, `full_name`; `students.profile_id`,
    `is_active`; `classes.name`.
  - `private.set_updated_at` and `private.is_admin` (aal2) exist.
  - Every reference in `notify_claim_emails` and `admin_email_problems` is qualified, so no OUT
    parameter clashes with a column name.
  - The rolling cap counts `sent` and `sending`.
  - Idempotency comes from three things: the unique key, the per-row record step guarded by
    `sending`, and the Resend `Idempotency-Key`.
  - pg_cron 1.6.4, pg_net 0.20.4 and vault 0.3.1 are on the local image, and pg_cron and pg_net
    are in `shared_preload_libraries`.
- **Web.** Every named route, service, component and symbol exists where the doc says:
  - `SectionCard`, `LoadError`, `FormStatus`/`FormAlert`, `ChoicesSection`;
  - `callEdgeFunction`, `ERROR_KEYS_BY_OWN_KEY`, `parseAnswerMark`, `canvasToBlob`;
  - `SHORTCUTS`, `isCurrentPage`/`closeMenu`, `.legal`;
  - `portal-root.tsx`'s `ErrorBoundary` and the admin layout in `routes.ts`.

  The call-site line numbers match. `ErrorKey` is `keyof typeof PORTAL_ERRORS`, so
  `notConfigured` needs only the constant.
- **Item 1.**
  - Dropping `clientLoader` and adding `ROUTES.posts` to `prerender` is the right change for
    `ssr: false`.
  - `supabase.client.ts` loads supabase-js by dynamic import, so exporting from the
    `@/services` barrel stays safe.
  - No backend change.
  - The `.links > li` count of 6 holds, because the sub-links are nested `li`s.
- **Rules.**
  - HTTP only in `services/`.
  - Text in `constants/`, and `copy.ts` for the edge function.
  - CSS modules on public pages, MUI `sx` in the portal (the repo convention).
  - Stable keys.
  - Co-located tests.
  - ErrorBoundary: `/posts` gets its own; the new admin route inherits portal-root's.
- **Deviations (§5).** Both are sound and minimal: family reads go through `assignment_view`,
  and a missing transport flags rows without claiming them. The other choices in §4 are fine.

### Next (round 1)

The Solution Designer fixes 1 and 2 (for 1, pick (a) or (b)) and folds in 3-14. For 1(a),
update ADR-0003 §3 and 02 §2.2 too. Then come back for a short round 2 on the changed sections
only. Nothing here needs Saurabh, except confirming the item 1 Privacy sentence in B1 (12).
