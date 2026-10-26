CHANGES_REQUESTED

# Review 5, item 8: "New assignment" and "due tomorrow" emails

Branch `feature/more-email-alerts`, diff `git diff 8e2af88...HEAD` (996bfbe excluded). 26 Oct 2026.

**Ran (read-only):** format, lint, typecheck pass; Vitest 62 files / 533; pgTAP 16 files / 704 PASS. `test:functions` not run, as briefed.

**Copied bodies** diffed against the dev notes' corrected ranges: `queue_work_returned_email` (20261025110000:149–165 → 274–290), `notify_claim_emails` (189–239 → 305–358), `kick_email_worker` (299–336 → 366–409), `admin_email_problems` (365–399 → 419–453): only designed changes. D1 is right. **Work-returned email byte-identical:** 32 rendered cases, old vs new, 0 differences.

## Blocking

1. **The too_late sweep fails rows that should have been skipped** (`20261028100000_more_email_alerts.sql:384-389`). Only the claim re-checks relevance, and the claim doesn't run when the cap is full or the worker returns `config_missing`. At the deadline the sweep turns every pending row with `send_before <= now()` into `failed`/`too_late`, relevant or not: e.g. a 15:10 reminder for work handed in at 19:00 shows as "Too late to send". Contradicts AC-8.6, AC-8.3 and 03b §8.3, and inflates the Q27 watch count. **Fix:** run the claim's relevance skip (lines 320–323) straight before the sweep; pgTAP case next to "cap full" (~644): cap 0, a due-tomorrow row past its deadline whose student has submitted → `skipped`, not listed by `admin_email_problems`; the still-relevant case still ends `too_late`. Record as a deviation from 03b §8.2 step 9's literal text.

## Non-blocking

2. `account.tsx:276`: stale JSDoc sits above `NOTIFICATION_SWITCHES`; put one JSDoc on `NotificationsSection` ("The three email switches (AC-3.6, AC-8.10)…").
3. `content.constants.ts:401-402`: the B17 comment names the removed sentence; update to "The portal-emails sentence (ADR-0004, ADR-0008) …".
4. `email_alerts.test.sql:116-120`: run the 24-run "one reminder hour a day" count on the October 2026 and April 2027 DST days too (optional).

## Checked and fine

`supported_kinds` default and dropped old overload; claim order and filters; sweep placement before both early returns; `email_recipients` people set equals item 7's `work_returned_recipients` (active, role, rule (b), parents' off switch via one left join, union dedup); `email_still_relevant` per kind; Melbourne guard and DST; cron `10 * * * *`; publish trigger (deadline from `published_at`, republish silent); definer functions, revokes and grants; no caller left for `work_returned_recipients`; worker copy, escaping, no instructions/marks/answers, `formatDueDate`; web rules; docs (README "Portal emails", budget "pending Q27", go-live §7d unticked).

---

CHANGES_REQUESTED → resolved by the lead (docs only)

# Review 5 — item 8, round 2

**Scope:** `996bfbe..a0a2ef3`. format, lint, typecheck pass; Vitest 62 / 533; pgTAP 16 files / 708 PASS. `claimRows` exercised with a fake claim.

**Round 1 status:** 1 resolved (the skip at :385-392 is word-for-word the claim's skip, runs before the sweep and both early returns; pgTAP :668-712 proves skipped vs too_late with only the relevant row listed). 1a: no race with the claim (both guarded by `status = 'pending'`, `skip locked`, same rule). 2, 3, 4 resolved. S2 resolved in code (`claim.ts:20-33`; the old claim's columns are `ClaimedRow` minus `kind`/`due_on`, so fallback rows render; no secrets logged; five meaningful unit checks).

## Blocking

1. Three operator docs still said a function-first deploy stops all email (`supabase/README.md:135`, `go-live.md:129`, ADR-0008 decision 6). **Fixed by the lead:** each now says "work returned" keeps sending and the new kinds wait, with the log line; ADR-0008 has a dated amendment pointing to D13. Migration first is still the release order.

## Non-blocking

2. A past-deadline row with an empty address ends `too_late`, not `no_address` (pre-existing, cosmetic). Not changed; follow-up.
3. Dev notes :143 contradicted §9 D13. **Fixed:** "(superseded by §9 D13 …)".

**Lead ruling:** the blocking item was documentation only and is fixed as specified, so no further code round is needed; the Tester's round checks the docs text.

---

CHANGES_REQUESTED

# Review 5 — item 8, round 3

**Scope:** `467ded7..7301a3c` (72ccd1f P2, edb4f6f P3, ef66c48 P4, 7301a3c dev notes). format, lint, typecheck, Vitest 540, pgTAP 16 / 712 all pass, but miss Blocking 1.

## Blocking

1. **`20261028100000_more_email_alerts.sql:117-121`: a dated "new assignment" email that expires naturally now ends `skipped`, not `failed / too_late`.** The deadline is `melbourne_day_start(due + 1)` (:84); once past it, `melbourne_date(now())` is `due + 1`, so the new `a.due_on >= melbourne_date(now())` is false although the due date never changed. Both skip sites run before the sweep, so no dated row can reach "Too late to send" (01b :662, AC-8.7, 03b §8.10 item 8), hiding cap pressure. Tests miss it because the AC-8.7 fixtures (`email_alerts.test.sql:632-633`, ~658) use a `send_before` that can't occur with that due date. **Fix:** skip only when the due date moved earlier than queued, e.g. `a.due_on is null or a.due_on >= melbourne_date(now()) or a.due_on + 1 >= queued_due_on`; note the null `queued_due_on` at queue time and the no-due-date-at-queue case in the comment. Realistic fixtures (past D, `send_before = melbourne_day_start(D + 1)`) → kick ends `failed / too_late`; add a kick-path "re-dated to yesterday → skipped" case; update dev notes §10 and §5.

## Non-blocking

2. `email_alerts.test.sql:787-790`: the "due-tomorrow unchanged" assertion runs on another assignment after a rollback, so it proves nothing about P3; replace with the natural-expiry case and fix §10's wording.
3. P2 correct (matches `listActivity`/`listStaff`; covered in `ADMIN_READS`).
4. P4 correct (`test-notifications.mjs:624-634`; re-runs still start clean).
5. P5 / D14 docs and §5 line ranges accurate.

**Lead note:** this is the third CHANGES_REQUESTED in a row for item 8's code stage (rounds 1, 2, 3), which is the /deliver pause condition. Item 8 is paused for Saurabh here.
