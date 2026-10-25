# 05 — Developer notes: item 3 ("Work returned" email)

> **Stage:** 5 of /deliver (Developer) · **Date:** 25 Oct 2026 · **Branch:** `feature/work-returned-email`
> (cut from `develop` @ `ba9e286`, which has item 1)
> **Input:** [03-design.md](03-design.md) §3, [04-plan.md](04-plan.md) §4 (T3.0–T3.10), ADR-0004,
> reviews 2–4 (R3-1 included). Also the item 1 carry-over from 04 §7 item 5.
> **Next:** T3.10: Reviewer (`review-5-item-3.md`), Tester + Security, then `/test-and-ship`.
> Nothing is pushed or merged.

Everything ran against the **local** stack only (`http://127.0.0.1:55321`). Email went only to the
local Mailpit (`:55324`). No Resend key was used, read or printed. The real `supabase/.env.deploy`
exists on this machine; I never read it, and every `deploy.sh` test ran from a scratchpad copy of
the script, so that file was never loaded.

## 1. Tasks done

| Task | Status | Evidence |
|---|---|---|
| T3.0 Branch | Done | Branch already cut; stack already running (no `db:start` needed) |
| T3.1 Switch, outbox, trigger | Done | Migration steps 1–5; `email_outbox.test.sql` (paper + online return, every AC-3.2 case, AC-3.5, switch rules). Mutation check: dropping the `marked_by` condition fails the MCQ auto-return test |
| T3.2 Worker RPCs, cron, admin list | Done, one fix (D2) | Steps 6–9; local Vault in `seed.sql`. Container names confirmed from inside the DB with `net.http_get`: Kong `supabase_kong_aj_classes:8000` and Mailpit `supabase_inbucket_aj_classes:8025` both answer, so no fallback needed |
| Item 1 carry-over | Done (D5) | `20261025110100_posts_public_columns_and_trim.sql` + `posts.test.sql` (+9 tests). Anon REST: `select=id` and `select=id,created_at,title,body` 200, `select=author_id` refused. Browser: admin publishes, visitor sees it on `/posts`, News link shows |
| T3.3 Transport, template, copy | Done (D3) | `copy.ts`, `template.ts`, `transport.ts`, plus `batch.ts` and `secret.ts`; 46 Node unit checks |
| T3.4 Worker + end-to-end script | Done | `index.ts`, `config.toml`, `package.json`; 23 end-to-end checks. Ctrl-C test: SIGINT while the job was paused → exit 130, job `active = t`, next run passes. Visible leg: see §3 |
| T3.5 Account → Notifications | Done (D6, D8) | Service, types, page section; `notifications.service.test.ts` (8). Browser: §3 |
| T3.6 Admin Emails page | Done | Page, route, shortcut, constants, `lib/email-problems.ts` + test (15). Browser: §3 |
| T3.7 `deploy.sh` | Done (D10) | `bash -n`; dry run prints the new steps in order; local secret → exit 1; real-path digest check run against a fake `supabase`/`curl` on `PATH` (§4) |
| T3.8 Privacy + docs | Done | Sentence + `privacy.test.tsx` (+1); `supabase/README.md`, `arch.md`, `budget.md`, `release-5/PRP.md`, `release-2/go-live.md` |
| T3.9 Full check | Done | §2 |
| T3.10 Pipeline | **Not started** | Reviewer, Tester, Security and `/test-and-ship` are the next stages |

## 2. Commits and full check

Commits (oldest first):

1. `249f73b` feat(email): queue a work-returned email for each eligible family member
2. `c1968bf` feat(email): claim, record and kick work-returned emails, with an admin problems list
3. `8af2e82` fix(news): limit visitors to public post columns and refuse blank posts in the database
4. `7d6e765` feat(email): add the work-returned email template, transport and send loop
5. `5cff24e` feat(email): serve the notifications worker locally and test it end to end
6. `01dd172` feat(email): let students and parents turn the work-returned email off
7. `beb21f2` feat(email): show admins the work-returned emails that failed or are waiting
8. `73fd447` feat(deploy): deploy the notifications worker with hosted-only email settings
9. `48d000b` docs(email): document the work-returned email, its runbook and release steps
10. This file, the T3.9 tick and the 04 timestamp fix (docs commit).

Full check, from the repo root after the two local exports (03 §1.6):
`pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build && pnpm db:test && pnpm test:functions`
→ **exit 0**.

| Step | Result (before item 3) |
|---|---|
| `format:check` | Pass |
| `lint` | Pass, 0 problems |
| `typecheck` | Pass |
| `test` | **47 files, 351 tests** (45 files, 327) |
| `VITE_APP_ENV=production pnpm build` | Pass; no hosted project ref in the built JS |
| `db:test` | **13 files, 444 tests, PASS** (12 files, 349). `posts.test.sql` and `family_portal.test.sql` green |
| `test:functions` | **148 `ok`, 0 failed**: account-admin 49, leads 30, notifications 69 (46 unit + 23 end-to-end) |
| AC-1.12 bundle check | `done` over 13 pages |

## 3. Browser pass (dev server :5173, Chromium via Playwright)

| Check | Result |
|---|---|
| Account → Notifications, `student@` and `parent@` | Shown; on by default; first Save (insert) and second Save (update) both show "Saved. We'll remember this choice."; off survives sign-out/in; turned back on |
| Same, `tutor@` and `admin@` | Not shown |
| Email's `#notifications` link, fresh tab | Opens on the section (after D6) |
| Phone 390 px and dark mode | No sideways scroll; switch label ≤ 2 lines |
| Admin → Emails | Reached from the dashboard shortcut; "No failed or waiting emails"; with a failed + a 3-hour-old pending row: newest first, "Failed / Rejected by email service" and "Waiting / Not attempted"; no address on the page; phone and dark: table scrolls inside its box, as on Activity |
| Tutor at `/portal/admin/emails` | "You don't have access to this page" |
| AC-3.7 | `docker stop supabase_edge_runtime_aj_classes`, tutor returns Aarav's "Word problems set 1" in the submission page → "Returned…" notice, no error; 2 rows pending |
| T3.4 visible leg | Worker restarted → the **real cron job** delivered both emails to Mailpit in 130 s |
| AC-3.4 | Signed out, each email's **View feedback** → sign-in → `/portal/student/assignments/<id>` and `/portal/parent/children/<sid>/assignments/<id>` |
| Email rendering | Mailpit HTML at 800 / 375 / 320 px: AJ Classes header, Students / Parents label, button, footer link; 0 px overflow after D9 |
| Console | No errors in any run |

## 4. Deviations and `[ASSUMPTION]`s

- **D1. Extension schemas.** `create extension pg_cron with schema pg_catalog` and `pg_net with
  schema extensions`, the forms Supabase's dashboard uses, so the design's dashboard fallback
  (03 §3.2 step 1) gives the same result and `if not exists` skips cleanly.
- **D2. `notify_record_result` let a null reason through.** The test "retry without a reason is
  refused" failed: `failure_reason in (...)` is null for a null reason, and `not (… or null …)` is
  null, so `if` didn't raise. Fixed with `coalesce(…, false)`; tests added for `failed` + null and
  a null outcome.
- **D3. Two extra function files.** `batch.ts` (the send loop with its I/O passed in) and
  `secret.ts` (the constant-time check), so Node can test the 429 stop-batch order and the
  no-default-secret rule without Deno. `index.ts` only wires them.
- **D4. Small SQL ordering changes, same behaviour.** `admin_email_problems` works out the cap
  after the admin check, not in `declare`. `notify_claim_emails` returns rows oldest first.
- **D5. Posts carry-over in its own migration.** `20261025110100_…` sorts after item 3's. The
  checks trim `E' \t\n\r'`, not just spaces, so line-break-only text is refused like the admin
  page's `trim()`. They also keep the raw caps (`char_length(title) <= 120`), so padding can't
  store an over-long value. **Release risk:** if a hosted post is already blank or over-long, the
  migration fails (and rolls back). Pre-check in §5 step 0.
- **D6. Deep link to `#notifications`.** The section only renders after the client loader, so the
  browser's own jump to the anchor misses it. The section now scrolls itself into view when the
  hash matches (a ref, no DOM queries). **Not changed:** signing in drops the hash
  (`safeNextPath` keeps path and query only), so a signed-out person following the footer link
  lands at the top of Account. View feedback links have no hash and work as AC-3.4 asks.
- **D7.** The section shows for `!isStaffRole(role)`. The four roles split exactly into staff and
  family, so no new helper was needed.
- **D8. Extra test** `services/notifications.service.test.ts`: update-then-insert, never upsert;
  missing row means on; error mapping.
- **D9. Email footer wraps.** The raw Account URL pushed the card 31 px wider at 375 px. The link
  now has `word-break: break-all`.
- **D10. `deploy.sh` extras.**
  - `--dry-run` used to print the DB password (`--password …`) and every `NAME=value` secret.
    It now masks both.
  - The digest check uses `jq`, which the script now requires (`/usr/bin/jq` is on this Mac).
  - Tested by running the real code path against fake `supabase` and `curl` on `PATH`:
    - hosted values → passes;
    - `MAILPIT_URL` left over → fails;
    - transport `mailpit` or missing → fails;
    - `SITE_URL` localhost → fails;
    - local worker secret → fails.
- **D11. The end-to-end script restores the seeded work.** It puts "Word problems set 1" back to
  "waiting for marking" and deletes its outbox rows at the start and the end. So it can run again,
  and the Tester gets the seed's demo state. `package.json` runs it with
  `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON`. Without that flag, Node warns on every import
  of the function's `.ts` files; adding `"type": "module"` to the root `package.json` was the
  other option, and it's broader.
- **D12. How AC-3.3 is checked in Mailpit.** The text version, and the HTML with tags and
  entities stripped, are checked. Once the links and the title are taken out, neither contains
  any digit, and neither contains the seeded answer feedback or overall comment.
- **D13. One stack restart.** I ran `supabase stop && supabase start` once (data kept), so the edge
  runtime loaded the new function and its `config.toml` secrets. The README says to do this after
  changing `config.toml`.
- **D14. 04-plan timestamp example.** Item 2's example rename was `20261025110100_…`, which is now
  the posts migration. I changed it to `20261025110200_…` in §2 rule 3 and T2.0.

## 5. Release steps for Saurabh (04 §6.3, plus step 0)

Preconditions: Q2 answered; **Q7 (B17) Privacy wording approved**; B1 done first, or released
together at this SHA. Release SHA = item 3's `develop` merge commit, named at close-out.

0. **New, from D5.** In Dashboard → SQL Editor (read only), this must return 0:
   ```sql
   select count(*) from public.posts where btrim(title, E' \t\n\r') = '' or btrim(body, E' \t\n\r') = '' or char_length(title) > 120 or char_length(body) > 5000;
   ```
1. Put a new long random `NOTIFY_WORKER_SECRET` and the Resend key in the password manager and in
   `supabase/.env.deploy` (git-ignored).
2. `git fetch && git checkout -b release/work-returned-email <item-3 SHA>`; from that branch run
   `supabase/scripts/deploy.sh`. It applies both migrations, enables `pg_cron`/`pg_net`, deploys
   `notifications` and sets the secrets. If `db push` refuses the extensions, enable both in
   Dashboard → Database → Extensions and run it again. Confirm it printed "Hosted function
   settings checked". First run only: confirm `supabase secrets list -o json` shows SHA-256 hex
   digests.
3. Merge `release/work-returned-email` (the same SHA, not `develop`) into `main` through a PR.
4. Run the two Vault lines the script prints, in Dashboard → SQL Editor.
5. AC-3.11 check (`supabase/README.md` → "Work returned emails"):
   - set up the test family, using your own aliases;
   - a test tutor returns one paper assignment;
   - both emails arrive within 5 minutes;
   - `/portal/admin/emails` is empty;
   - delete the test class.
6. Tick the item 3 boxes in `docs/requirements/release-2/go-live.md` §7a.

## 6. Not verified

1. **Anything hosted:**
   - the migrations on hosted, including `create extension` from a migration;
   - Vault on hosted, and the `secrets list` digest format;
   - a real `deploy.sh` run. Only `--dry-run` and the fake-CLI run were done.
2. **Real Resend.** The request shape, the `Idempotency-Key` behaviour, the 429/409 handling and
   deliverability are checked only by unit tests of the request builder and outcome mapping. No
   Resend call was made.
3. **The edge function under Deno's type checker.** Deno isn't installed. The local edge runtime
   ran `index.ts`, which strips types but doesn't check them; `tsc` doesn't cover
   `supabase/functions`.
4. **Email clients.** I rendered the email in Chromium only, not in Gmail, Outlook or Apple Mail.
5. **The file hand-in return** (AC-3.1): item 2 isn't built. The trigger needs no change for it.
6. **For Security and B17 to decide:**
   - **Spam Act.** Whether the switch can be on by default (01 assumption 13).
   - **Resend in the Privacy Policy.** The Privacy sentence doesn't name Resend as the service
     that sends these emails (a US provider), and the existing policy doesn't name it for
     sign-in emails either. That's a wording decision for B17.
7. **Browsers.** Only Chromium was tested, not Safari, Firefox or a real phone.
8. **Possibly stale README note.** `supabase/README.md` → "Known local issues" says that calling a
   denied function in `psql` crashes Postgres. The new pgTAP tests do exactly that (`throws_ok …
   42501`) and pass on CLI 2.120, so that note may be out of date. I left it unchanged.

## 7. Local state left for the Tester

- **Stack:** running.
  - Both cron jobs are active.
  - The edge runtime is serving `notifications` with the local Mailpit settings.
- **Outbox:** the seed's 2 rows are `sent`.
- **Demo work:** "Word problems set 1" is back to "waiting for marking".
- **Switches:** `notification_settings` is empty, so everyone is on.
- **Posts:** one local post ("Term 4 classes start on Monday"). `db:reset` had removed the post item
  1 left, so I added this one back.
- **Mailpit:** still holds this run's local emails.
- **Dev server:** stopped.

## 8. Review fixes (review-5-item-3.md round 1, 06-security-item-3.md)

| Finding | Fix | Proof |
|---|---|---|
| R1 [blocking] cron could stay paused | `test-notifications.mjs`: seeded ids are looked up (and validated) **before** the pause; the pause is inside the `try`; the `finally` resumes cron **first**, then restores | Fault injection: a temporary trigger made every restore update fail. Script exit 1 with "injected restore failure", job `active = t`. Trigger dropped; next run "All checks passed" |
| R2 hanging provider burns attempts | `shouldStopBatch` is true for `network` as well as `rate_limited`; the rest are released with the same reason. README explains that released rows still use an attempt | Unit: network stops the batch after one send, rest recorded as network retries |
| R3 secret check too weak | `deploy.sh` compares the hosted digest with `sha256 "$NOTIFY_WORKER_SECRET"` | Fake CLI: as deployed → pass; missing, local or other value → exit 1. Dry run still masks: 0 sentinel values printed |
| R4 `no_address` untested | pgTAP: blank `profiles.email` → not claimed, `failed`/`no_address`, 0 attempts, listed for admins | `db:test` |
| R5 README manual `secrets set` | README now says hosted function secrets change only through `deploy.sh` | Docs |
| R6 posts comment | Says the admin page's `trim()` is stricter (NBSP, `\v`, `\f`, Unicode spaces) | Comment only |
| R7 | go-live §7a has the step 0 posts pre-check box; 04 §7 Later has "keep `#notifications` through sign-in" | Docs |
| S1 header injection | `template.ts` `oneLine()`: C0/C1 control characters → space in the title, class and names, so in the subject and body | Unit: `Fractions\r\nBcc: x@y` → subject `…Fractions Bcc: x@y`, no control characters |
| S2 committed local secret on hosted | New `config.ts` `isUsableConfig()`: outside Mailpit, the local worker secret or a non-https `SITE_URL` is a set-up error (rows flagged, 503, nothing claimed) | 6 unit checks. Not exercised end to end: that needs a non-Mailpit transport on the local runtime |
| S3 Resend not named | Privacy portal section: "…and Resend (United States) sends our sign-in and portal emails; all of these may process data outside Australia." Draft for B17 | `privacy.test.tsx` (+1) |
| S4 secret saved in SQL Editor | README and `deploy.sh`'s printed Vault step: delete the snippet and history afterwards | Docs |
| S7 retention | Migration edited in place: daily job renamed `daily-history-trim`, runs `private.trim_history()` (cron log 7 days; sent/skipped/failed outbox rows after 90 days; waiting rows kept) | pgTAP: old finished rows gone, old pending and 89-day sent kept; job command; others refused |
| S8 `net` schema | README and a go-live §7a box: keep `net` out of the exposed schemas | Docs |

Deviation: the daily job's name changed from `cron-history-trim` (03 §3.2 step 7) to `daily-history-trim`, because it now trims the outbox too.

**Commits:**
1. `e160995` fix(email): always resume cron in the test script and harden the worker
2. `794fe1a` feat(email): trim finished emails after 90 days and test the no-address path
3. `eee5bd3` fix(deploy): check the hosted worker secret is the value deployed
4. `e6b1601` fix(privacy): name Resend as the overseas service that sends portal emails
5. `2bd6550` docs(email): tighten the runbook and release steps after review
6. This section (docs commit)

**Checks** (local exports, after `pnpm db:reset`): full check exit 0.

| Step | Result |
|---|---|
| `test` | 47 files, 352 tests |
| `db:test` | 13 files, 450 tests, PASS |
| `test:functions` | 159 `ok`, 0 failed (account-admin 49, leads 30, notifications 80) |
| AC-1.12 bundle check | Clean |
| Cron | `email-worker-kick` and `daily-history-trim` both active |

Local state as in §7. `db:reset` removed the local post again, so I re-added it.
