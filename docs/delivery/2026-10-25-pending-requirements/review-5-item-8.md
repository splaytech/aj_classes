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
