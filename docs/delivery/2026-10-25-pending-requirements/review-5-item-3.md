APPROVED

# Review 5, item 3, round 2: verdict APPROVED

> **Round 2** · 25 Oct 2026 · fix commits `e160995`..`02fb148` (`git diff 02232ec..HEAD`, 17 files),
> against round 1 below, `05-dev-notes-item-3.md` §8 and `06-security-item-3.md` S1-S8. Local stack only.

## Round 2

The round 1 blocking finding is fixed and proven by fault injection. All five minors are fixed. The
Security fixes are in, with one gap in S2 (finding R2-1 below), which is minor because S2(b) (the
README rule) meets Security's own release gate. The full check is green.

### Full check (re-run by the Reviewer, local stack)

`pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm db:test && pnpm test:functions` → **exit 0**.
- `test`: 47 files, 352 tests.
- `db:test`: 13 files, 450 tests, PASS.
- `test:functions`: 159 `ok`, 0 `NOT OK`.
- Cron afterwards: `email-worker-kick` and `daily-history-trim` both `active = t`. The old
  `cron-history-trim` is gone.

### Round 1 findings, re-checked

| # | Status | Evidence |
|---|---|---|
| 1 [blocking] cron stays paused | **Fixed** | `test-notifications.mjs`: `seededIds()` runs and validates before the pause, the pause is inside the `try`, and the `finally` resumes before restoring. The signal handlers are still registered first. The Developer's fault injection (a failing restore → exit 1, job active) matches the code |
| 2 hanging provider burns attempts | **Fixed** | `shouldStopBatch` covers `network`, and released rows carry the stopping reason. New unit check. README explains the attempt cost |
| 3 weak secret check | **Fixed** | `deploy.sh:101` compares with `sha256 "$NOTIFY_WORKER_SECRET"`. That covers both missing and local |
| 4 `no_address` untested | **Fixed** | pgTAP: not claimed, `failed`/`no_address`, 0 attempts, listed for admins |
| 5 README manual `secrets set` | **Fixed** | README:33 now says deploy.sh only, and why |
| 6 posts comment | **Fixed** | |

### Security fixes, checked

- **S1 subject sanitising: fixed.** `oneLine()` maps C0/C1 controls to a space in every interpolated
  field, so they're gone from both the subject and the body. The HTML is still escaped after. Unit
  checks cover CR/LF, tab, NUL and U+0085.
- **S2 local secret: partly fixed** (see R2-1).
- **S3 Privacy: fixed** as a draft for B17. Resend (United States) is named. `privacy.test.tsx` +1.
- **S4: fixed.** README and the printed Vault step both say to delete the snippet.
- **S7 retention: fixed.** `private.trim_history()` keeps the 7-day cron trim and deletes finished
  rows after 90 days, keeping waiting rows. It's revoked from public, anon and authenticated, and pgTAP
  covers the deletes, the keeps, the job command and the refusal. Editing the migration in place is
  acceptable, because it hasn't reached hosted yet (Saurabh's release step). **The rename to
  `daily-history-trim` is accepted:** the name now matches what the job does, and README and arch.md
  use it.
- **S8: fixed.** There's a README paragraph and a go-live §7a box.

### New findings (round 2)

R2-1. **[minor] `supabase/functions/notifications/config.ts:124-131`: the S2 guard exempts Mailpit, and the scenario it targets sets Mailpit.**
- The comment (lines 114-117) says it protects against a manual `supabase secrets set` copying
  config.toml's local values. But that copy brings `EMAIL_TRANSPORT=mailpit` and `MAILPIT_URL` along
  with the local secret (Security's own exploit text: "With transport `mailpit` …").
- `isUsableConfig` returns `true` for any Mailpit transport, so in that exact case the hosted worker
  still accepts the public `local-notify-secret`. Anyone can then call it three times and burn every
  pending row to `failed`.
- It isn't blocking: README:33 now forbids manual `secrets set`, which is Security's 2(b) and meets
  its release gate. No data leaks, because Mailpit's container name doesn't resolve on hosted.
- **Fix:** tell hosted from local by the built-in `SUPABASE_URL` (hosted `https://<ref>.supabase.co`,
  local edge runtime `http://…`). When it's https, treat a Mailpit transport, the local worker secret or
  a non-https `SITE_URL` as a set-up error. Better still, have `secretMatches` refuse the local secret
  there. Add a unit check. Confirm the local runtime's `SUPABASE_URL` value first.
- Or, if the Developer prefers, correct the comment to say the guard covers only a copy that leaves
  `EMAIL_TRANSPORT=resend`. In that case the README rule is the control.

R2-2. **[minor] `20261025110000_work_returned_email.sql:254-255`: the 90-day trim reopens AC-3.5 for very late re-returns.**
- Deleting a `sent` (or `skipped`) row also removes its `email_outbox_once` key. A tutor who moves the
  work returned → marked → returned again more than 90 days later queues and sends a second email.
- AC-3.5 says "returned again later, no second email". That's rare and harmless, but it's a silent
  change to an AC.
- **Fix:** record it as an accepted limit (01 change log or 03 §3.9 "Data lifecycle", plus the README
  retention line). Code is only needed if the PO wants it; one option is to keep the `sent` rows'
  unique tuple in a slim table.

R2-3. **[minor] `docs/requirements/release-2/go-live.md` §7a: the Vault box says "Straight after the deploy" but sits after the merge-to-`main` box.** Move it directly under the "Hosted function settings checked" box, so the checklist order matches Security info 6.

### Next

Approved for Tester and `/test-and-ship`. R2-1 to R2-3 are minors. Do them with any TSR bug-fix loop, or
before the merge, without another Reviewer round. If R2-1 is done in code, the Tester re-runs
`pnpm test:functions`. Nothing here needs Saurabh, apart from the existing B17/Q7 Privacy approval.

---

# Round 1 (kept for the record; its first line was `CHANGES_REQUESTED`)


# Review 5, item 3: "Work returned" email (Developer stage gate)

> **Reviewer** · 25 Oct 2026 · branch `feature/work-returned-email`, diff `ba9e286..HEAD` (10 commits, 37 files)
> **Against:** 01 item 3 (AC-3.8 as reworded), 02 item 3, ADR-0004, 03 §3, 04 T3.0–T3.9 and §8, review-3 R3-1,
> `05-dev-notes-item-3.md` D1–D14. Local stack only; hosted project and `supabase/.env.deploy` not touched.

## Verdict

The build is sound and matches the design closely. The outbox state machine, the cap, the
idempotency, the trigger, the grants, the Vault use and the cron jobs are correct, and the
pgTAP suite is thorough. One blocking finding: the end-to-end script doesn't resume the cron job
on every exit path, which is the exact property this gate was asked to check (review-3 R2-1, R3-1).
It's a three-line fix. The minors can go in the same commit.

## Full check (re-run by the Reviewer, local stack)

`pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm db:test && pnpm test:functions`
→ **exit 0**. Also `VITE_APP_ENV=production pnpm build` → exit 0.

- `test`: 47 files, 351 tests passed.
- `db:test`: 13 files, 444 tests, PASS (`email_outbox`, `posts`, `family_portal` green).
- `test:functions`: 148 `ok`, 0 failed. Both cron jobs `active = t` afterwards.
- `deploy.sh --dry-run`, from a scratchpad copy with no `.env.deploy`: the steps print in order
  (one `secrets set`, then `unset … MAILPIT_URL`, then the check line, then Vault). Every
  `NAME=value` and the `--password` argument print as `…`. The local secret makes it exit 1.

## Findings

1. **[blocking] `supabase/scripts/test-notifications.mjs:469-477`: the cron job stays paused on some failure paths.**
   - `setCronActive(false)` (469) runs before `seededIds()` (470), and `seededIds()` is outside the `try`.
   - In the `finally`, `restoreSeededWork(ids)` (475) runs **before** `setCronActive(true)` (476). `sql()` uses
     `execSync`, so a failed query throws.
   - **Concrete break:** the seed's "Word problems set 1" or "Aarav Demo" is renamed, or `docker exec` hiccups.
     `seededIds()` then returns `{ assignment: '', student: undefined }`. `restoreSeededWork` in the `try`
     fails (`invalid input syntax for type uuid`), and the same call in the `finally` throws again before the
     resume. The script dies with the job paused. Local emails then silently stop until someone notices
     and runs the printed recovery command or `db:reset`.
   - **Fix:** call `seededIds()` before the pause. Put the pause inside the `try`. In the `finally`, resume
     **first**, then restore, e.g. `finally { setCronActive(true); restoreSeededWork(ids); }`, or wrap the
     restore in its own `try`. The signal handlers already come first (R3-1 done correctly).

2. **[minor] `supabase/functions/notifications/transport.ts:95-97` / `batch.ts:38`: a hanging Resend can burn attempts on emails that were never tried.**
   - Only `rate_limited` stops the batch. Each `network` outcome (a 10 s timeout) costs 10.6 s, so a batch
     of 70 against a hanging API passes the 150 s Free wall clock after ~14 rows.
   - The rest stay `sending` for 10 minutes and count against the cap meanwhile. Then the kick reclaims
     them with the attempt counted. After three such kicks, rows that were never actually sent show as
     "Gave up after 3 tries".
   - **Fix:** also stop the batch on `network`, releasing the rest as a retry (one line in `shouldStopBatch`
     plus its unit check). Or give the loop a ~100 s time budget and release what's left. The same
     attempt cost applies to rows released by a 429, which 03 §3.4.2 accepted; note it in the README's
     "Gave up after 3 tries" line.

3. **[minor] `supabase/scripts/deploy.sh:99`: the worker-secret check only proves "not the local value".**
   - If `NOTIFY_WORKER_SECRET` were missing from the hosted listing, its digest would be empty. Empty
     isn't the local digest, so the check passes.
   - **Fix:** compare against the value being deployed:
     `[[ "$(hosted_digest NOTIFY_WORKER_SECRET "$listing")" == "$(sha256 "$NOTIFY_WORKER_SECRET")" ]] || fail …`.
     That covers the missing case and the "config.toml copy won" case together, as the
     `EMAIL_TRANSPORT`/`SITE_URL` checks already do.

4. **[minor] `supabase/migrations/20261025110000_work_returned_email.sql:209-211`: the `no_address` branch has no test.**
   - Nothing in `email_outbox.test.sql` drives a profile with a blank email through the claim.
   - **Fix:** add one case: set a queued recipient's `profiles.email` to `''` inside the test, claim, then
     expect `failed`/`no_address`, not returned by the claim, and listed by `admin_email_problems` with
     `no_address`.

5. **[minor] `supabase/README.md:33`: it still tells people to run `supabase secrets set ALLOWED_ORIGINS=...` by hand.**
   - Per 02 item 3, that call also copies `[edge_runtime.secrets]` to the hosted project. That now
     includes `EMAIL_TRANSPORT=mailpit`, `SITE_URL=http://localhost:5173` and the committed
     `NOTIFY_WORKER_SECRET=local-notify-secret`.
   - One manual run would stop hosted emails, because the Vault secret no longer matches. It would also
     leave the worker open to a secret that is public in the repo.
   - **Fix:** change that sentence to "Hosted: run `supabase/scripts/deploy.sh`; never `supabase secrets set`
     by hand (it copies local values)".

6. **[minor] `supabase/migrations/20261025110100_posts_public_columns_and_trim.sql:11`: the comment overstates the match.**
   - JavaScript's `trim()` also removes NBSP, `\v`, `\f` and other Unicode spaces, so the page stays
     stricter than the database.
   - That's harmless, but "so both refuse the same values" isn't true. Reword it to "the common
     whitespace the admin page's trim() removes".

## Deviation rulings

| # | Ruling | Note |
|---|---|---|
| D1 | Accept | The dashboard's schemas, so the fallback toggle is equivalent |
| D2 | **Accept** | A real bug, correctly fixed with `coalesce(…, false)`. Tests cover `failed` + null and a null outcome |
| D3 | Accept | `batch.ts`/`secret.ts` make the 429 order and the no-default secret testable in Node. `index.ts` is thin |
| D4 | Accept | Same behaviour. The admin check now runs before any outbox read, which is better |
| D5 | **Accept** | A separate, later migration is right. Keeping the raw caps is right. The release pre-check (§5 step 0) is needed and belongs in go-live §7a as a box too. Comment wording: finding 6 |
| D6 | **Accept, with one deferral** | Ref plus `scrollIntoView`, no DOM query: fine. A signed-out footer click lands at the top of Account, because `safeNextPath` drops the hash. AC-3.6 only needs a link to the page, so this is acceptable. Put "keep the `#hash` through sign-in" in the Later bucket so it isn't silently dropped |
| D7 | Accept | `!isStaffRole(role)` is exactly students and parents with today's four roles |
| D8 | Accept | |
| D9 | Accept | |
| D10 | **Accept** | Masking checked by a dry run with sentinel values: none printed. `jq` is required up front. The digest check is skipped under `--dry-run` and is otherwise strict for `local_only`, `EMAIL_TRANSPORT` and `SITE_URL`. Tighten the secret check (finding 3). The first-run digest-format check is correctly a release step |
| D11 | Accept | The restore makes the script re-runnable, but see finding 1 for its order in the `finally` |
| D12 | Accept | Stripping the title and links, then requiring no digit, is a fair proxy for "no mark". The seeded feedback strings are checked directly |
| D13 | Accept | Data kept, and the README documents the restart |
| D14 | Accept | Avoids the timestamp collision with item 2 |

## Checks asked for

**1. AC → test trace**

| AC | Test |
|---|---|
| 3.1 | pgTAP paper and online returns queue student + 2 active parents (`email_outbox.test.sql` ~88-122). Script: one Mailpit email each to `student@`/`parent@`. File hand-in waits for item 2 (dev notes §6.5) |
| 3.2 | pgTAP: roster-only, invited, deactivated student (parent still gets one), no active parent, all off. Each `lives_ok`, 0 rows, admin list empty (~169-207, 282-285) |
| 3.3 | pgTAP: the claim's columns have no mark or feedback. Unit: template wording. Script: Mailpit text/HTML has no digits or seeded feedback |
| 3.4 | Unit plus script: link paths. Browser leg recorded in dev notes §3, and the Tester repeats it in the TSR |
| 3.5 | pgTAP: return again, edit after return, MCQ auto-return, other parents, tutors and admins. Script: the second worker call sends nothing |
| 3.6 | pgTAP own-row rules (~221-280). `notifications.service.test.ts` (update then insert, missing row = on). Unit: footer link. Browser: dev notes §3 |
| 3.7 | pgTAP: a failing return rolls back its rows. No Vault secret → no call. Script: wrong or missing secret → 401, rows pending. Browser: edge runtime stopped |
| 3.8 | pgTAP: refused for tutor, student, parent, aal1 admin and anon. Failed/Waiting with each reason; newest first; no address column; `max_rows`. `email-problems.test.ts`. Browser: empty state |
| 3.9 | Script: `From`, header and brand colour. Wording all in `copy.ts` |
| 3.10 | pgTAP: own switch only. Another class's tutor changes and queues nothing. `notify_*` refused for student, admin and anon |
| 3.11 | Unit: `pickTransport` returns null for unset, `''`, `smtp`, `Resend`, or a missing key/URL. Hosted test-family check is in README and go-live §7a |

**2. SQL.**
- States: claim → `sending` with `attempts + 1`. Record has a `sending` guard. Reclaim after 10 min
  keeps the attempt and fails at 3. Ineligible → `skipped`. The `attempts between 0 and 3` check
  can't be breached.
- Cap: one function counts `sent` + `sending` on `coalesce(sent_at, claimed_at)`. Both the kick and
  the claim use it, under an advisory lock.
- At most once: the unique key, `on conflict do nothing`, a per-row record and `Idempotency-Key`.
- Trigger: only when `marked_by` is set, an `UPDATE` from `returned` is ignored, and it runs in the
  tutor's transaction.
- Eligibility: one function at queue time and at claim time.
- Grants: both tables revoked from anon and authenticated, with column grants on the switch. No
  policies on the outbox. Worker RPCs are `service_role` only. The admin list is `is_admin()`, which
  needs aal2.
- Switch save: update, then insert, no upsert.
- Vault: read in the kick only, never in a migration. Seed values are local.
- Cron: `schedule` by name, a 5-minute kick, a daily 7-day trim of `cron.job_run_details`.

**3. Edge function.**
- `secretMatches` refuses when the secret is unset or empty, compares in constant time, and checks
  length first.
- No transport or `SITE_URL` → flag rows, 503, claim nothing.
- Reasons are fixed codes from `outcomeForStatus`. The body is cancelled unread.
- Logs show the HTTP status, error name and counts only. No address, key or provider text.
- 429 stops the batch and releases the rest. A unit test checks the order.

**4. `deploy.sh`.**
- One `secrets set` with all hosted values, `unset` last with `MAILPIT_URL`, then the digest check,
  then the printed Vault lines.
- `FUNCTIONS` gains only `notifications`, which exists. No item 2 function.

**5. Cron pause in the script.** The handlers are registered before the pause (R3-1 met) and exit
130/143. The `finally` misses some paths: finding 1.

**6. Repo rules.**
- HTTP only in `services/notifications.service.ts`.
- All web text is in `constants/portal.constants.ts` and `content.constants.ts`; email text is in `copy.ts`.
- No `style={{}}` in React. `sx` follows `admin-activity.tsx`/`admin-enquiries.tsx`. Inline styles in
  the email HTML are required for email clients.
- `key={problem.id}`.
- `/portal/admin/emails` sits inside `portal-root`, which has an ErrorBoundary.
- No `console.log`, no dead code, no TODO. The `[TBC: B17]` marker stays in the docs only.

**7. Item 1.**
- `posts.test.sql`: anon can read `id, created_at, updated_at, title, body`, but `author_id` and
  `select *` are refused. Signed-in staff still read every column.
- The public client only asks for `select=id` and `PUBLIC_POST_COLUMNS`, which are inside the grant.
- The admin posts path is `authenticated`, which is unchanged.

**8. Full check.** Green (above).

## Next

Developer: fix finding 1 (blocking) and, in the same commit, findings 2-6. Add D5's step 0 as a go-live
§7a box and D6's hash deferral to the Later list. Re-run `pnpm test:functions` and `pnpm db:test`. Then
back to the Reviewer for a quick round 2, which only needs to look at the fix commit. Nothing here
needs Saurabh.
