# 04 — Delivery plan: pending requirements (programme) and build plan for items 1–3

> **Stage:** 4 of /deliver (Manager) · **Date:** 25 Oct 2026 · **Branch:** `feature/pending-requirements`
> **Input:** [01-requirement.md](01-requirement.md), [02-architecture.md](02-architecture.md),
> [03-design.md](03-design.md), [review-1](review-1.md), [review-2](review-2.md),
> [review-3](review-3.md) (all APPROVED), ADRs [0001–0004](../../decisions/).
> **Next stage:** Developer builds item 1, ticking this file as each task is tested.

How to use this file:
- Tick a task (`- [x]`) only after its test passes. Each task ends with the app still working.
- One conventional commit per task, or more (e.g. `feat(posts): …`, `test(db): …`). Commit locally;
  only `/test-and-ship` pushes.
- File numbers like "03 §1.1 #8" are the row numbers in 03's "Files to touch" tables.
- Stages 5–6 of /deliver run **per item**. Artifacts get an item suffix so the three items don't
  overwrite each other: `review-5-item-<n>.md`, `06-test-plan-item-<n>.md`,
  `06-security-item-<n>.md`, `TSR-item-<n>.md`, `bugs/item-<n>/BUG-<k>.md`.

---

## 1. Programme plan (all pending work, mobile excluded)

### 1.1 Build queue

| # | Item | Covers | Status | Next step before build | Release gate (owner) |
|---|---|---|---|---|---|
| 1 | News page works on the hosted site; News link only when there is news | BLOG-01, R1.1-03(a), R1.1-04 | **Designed, ready to build** | none | B1 (Q1) |
| 2 | Homework file uploads | R3-03, R3-04 | **Designed, ready to build** (held after test) | none | B3 + B17 (Q3, Q7) |
| 3 | "Work returned" email with an off switch | R5-02 (returned), R5-04 (first switch) | **Designed, ready to build** | none | Q2 (secrets, Vault, test family) + B17 |
| 4 | Staff phone on the profile page, plus Privacy update | INV-04, INV-05 | Needs elaboration | PO (ACs) → Designer. Architect: likely "no impact", one paragraph | B17 |
| 5 | Content security policy on public pages | R2-11 | Needs elaboration | PO → Architect (CSP must allow `connect-src` to the Supabase host, 02 cross-item notes) → Designer | none |
| 6 | CI quality gates: E2E smoke, Lighthouse budget, structured-data check | R2-09, R1-20 | Needs elaboration | PO → Architect (how `aj_classes-e2e` is wired in) → Designer | none |
| 7 | Fair results: "hold results" switch; returned marks stay visible after leaving a class | R3-06 | Needs elaboration | PO → Architect (changes the R3b F8 rule) → Designer | deploy only |
| 8 | "New assignment" and "due tomorrow" emails | R5-02 (rest), R5-04 (rest) | Needs elaboration; reuses item 3 | PO → Designer (Architect: reuse ADR-0004, short note). Starts after item 3 ships | deploy only; Resend volume |
| 9 | `hreflang` / `geo.*` head tags | R1-14 | Needs a do-or-drop call | PO decides; if kept, bundle with item 5 | none |

Later bucket (named, not dropped): Realtime status (R3-05), separate About page (R2-07), news
extras (home "latest 3", per-post pages, NewsArticle JSON-LD), R3b "later" ideas, MUI chunk split,
Railway leftovers clean-up, orphan-file sweep (from item 2).

Order after items 1–3: **4 → 5 (+9) → 6 → 7 → 8**. Item 4 is small and its wording rides the same
B17 review as items 2–3. Item 6 should land before 7 and 8 so they ship behind the new CI gates.

### 1.2 Questions for Saurabh (answer by number)

**A. Releases and production (unblock shipped work first)**
1. **[B1] Release item 1.** "OK to apply the posts migration to the hosted Supabase, publish at
   least one post, and release item 1's commit to `main` (via `release/news`, §2 rule 5)? This release also adds this to the Privacy Policy
   (Security's wording, `06-security-item-1.md` finding 6): 'When you visit a page, your browser asks our database provider (Supabase, Sydney) whether there is any news to show. Like any web request, this sends your IP address and browser type. Supabase keeps these in short-lived technical logs for security and troubleshooting. We don't save them in our own records or use them to identify you.' OK to publish that wording?" (This also releases the 19 commits already on `develop`: admin posts,
   Approach statements, KINET fixes. In practice the merge to `main` is `release/news` cut at
   item 1's SHA, not `develop` HEAD: §2 rule 5.)
2. **[Item 3 release]** "When item 3 is on `develop`: will you run the item 3 release steps (§6.3
   below: `deploy.sh` with a new `NOTIFY_WORKER_SECRET` from your password manager, the Vault SQL,
   then the test-family check)? Use the existing Resend key, or create a separate one for
   notifications so it can be rotated alone?"
3. **[B3] Supabase Pro.** "Have any real families been invited yet? Do you approve upgrading to Pro
   (≈ A$39/month) before they are?" This is item 2's release gate.
4. **[Item 2 branch]** "Item 2 will be fully tested and then held on
   `feature/homework-file-uploads`, unmerged, until you answer 3. OK to keep it local only, or
   should we push the branch to GitHub as a backup? (Pushing doesn't deploy anything to Supabase,
   but Vercel may build a preview of it.)"
5. **[B2] Hosted release checks.** "Can you run the 6 unticked checks in go-live.md §8 and the R2a
   manual checklist (real Gmail and Outlook inboxes, a second browser, Google Authenticator and
   1Password, a tutor signed in on a phone, VoiceOver) with real accounts? Or should we pick a
   time when you can do them while I watch?"

**B. Money and accounts**
6. **[B4] Vercel plan.** "Is the project on Vercel Hobby or Pro? Hobby doesn't allow commercial
   use. Upgrade to Pro (≈ A$31/month)?"
7. **[B17] Quick checks and wording.** "Have you read the privacy wording for the portal and
   enquiries? Is +61 469 800 685 the WhatsApp Business number?" Once items 2 and 3 are built, this
   is also one batched review of their Privacy sentences (03 §2.8 and §3.8), plus item 4's later.
8. **[B5] Kit newsletter.** "Do you still want the footer newsletter? If so, please create the Kit
   account (hello@), turn on double opt-in, and send me the form ID."
9. **[B14] Sentry.** "Do you want error tracking? It needs a free Sentry account in the business's
   name."

**C. Legal and policy**
10. **[B6] Terms & Conditions.** "Will you provide T&C wording? Or should we draft one for you or a
    lawyer to approve?"
11. **[B7] Forgot password while invited.** "An invited person can use Forgot password to reach the
    setup form without an admin. Is that acceptable? Yes or no."

**D. Content from Ajay**
12. **[B15] Ajay's content.** "Can you collect from Ajay: class hours, Instagram and YouTube URLs,
    VCE counselling details (T15), SEAL year levels (T17), UCAT/GAMSAT details (T18), and the final
    tutor subject list?"
13. **[B8] Testimonials.** "Do you have at least 3 written reviews or videos with signed parent
    consent? Without them the section stays hidden."
14. **[B9] Public tutor profiles.** "Should tutors' names, photos and bios appear on the website?
    If yes, do we need each tutor's written OK?"
15. **[B10] Term dates.** "Do AJ Classes terms follow the Victorian school terms? If yes, I'll use
    the official 2027 dates. If not, please send the four term ranges."
16. **[B11] Events.** "Are any events planned (info night, mock exam)? If none in the next 2
    months, I'll move Events to the Later bucket."

**E. Product direction**
17. **[B12] Communities (R4).** "Classes are already run by admins. Do you want a self-serve
    community directory with 'request to join'? Recommendation: no, move R4 to Later."
18. **[B13] Recorded lectures and AI tutor (R6).** "Do you want to start R6? It needs a Mux account,
    an LLM and embeddings vendor, a monthly AI budget and a pilot course (R6 PRP Q1–Q7)."

**F. Setup and admin**
19. **[B16] Backup admin.** "Who is the second admin? Recommendation: your own account."
20. **[B18] Off-site SEO.** "Are Search Console, Bing and the Google Business Profile set up and
    verified? (I can't see this from the repo.)"

---

## 2. Ship order and branches for items 1–3

**Recommendation: 1 → 3 → 2.** Item 2 ranks above 3 on value, but it can't go live until B3, and
item 3 can. Building 3 first gets more value into production sooner. If Saurabh approves B3
(Q3) before item 3's build starts, swap to 1 → 2 → 3 and ship item 2 normally. Under the swap:
item 3's migration is created with `supabase migration new work_returned_email` after item 2
merges, so its timestamp is newer than item 2's (it replaces 03's `20261025110000`), and T2.11
moves into item 3 as part of T3.1 (the file hand-in case goes into `email_outbox.test.sql` when
that file is written).

| Order | Item | Branch | Cut from | Gate | Ends |
|---|---|---|---|---|---|
| 1st | 1 News | `feature/pending-requirements` (current; the delivery docs ship with it) | already on `develop` @ `425fec1` | full `/test-and-ship` | merged to `develop`, pushed |
| 2nd | 3 Email | `feature/work-returned-email` | `develop` after item 1's merge (`git pull --ff-only` first) | full `/test-and-ship` | merged to `develop`, pushed |
| 3rd | 2 Uploads | `feature/homework-file-uploads` | `develop` after item 3's merge | `/test-and-ship` **steps 0–5.1 only** | **held, unmerged** until B3 |

Rules:
1. **Item 2's gate stops after step 5.1** (commit the TSR on the feature branch). Skip steps
   5.2–5.4: no checkout of `develop`, no merge, no push. Set the TSR verdict to
   `APPROVED (auto), held for B3`. Push the branch only if Saurabh says yes to Q4.
2. **Why held:** `deploy.sh` runs `supabase db push`, which applies every migration in the
   checkout. If item 2's migration were on `develop`, the next deploy (e.g. item 3's) would put
   the bucket and the table live before B3.
3. **Migration timestamps.** `db push` refuses a migration older than the newest one applied on
   hosted. Item 3's file is `20261025110000_…`. Create item 2's with `supabase migration new
   assignment_files` **after** item 3 has merged (this replaces 03's `20261025100000` name).
   `migration new` stamps the **UTC** time: `20261025110000` is 25 Oct 22:00 AEDT, so a file made
   earlier than that sorts before item 3's. **Check and act:** run `ls supabase/migrations | tail -2`.
   If the new file isn't last, `git mv` it to a timestamp one minute after the newest file on
   `develop` (e.g. `20261025110200_assignment_files.sql`), then `pnpm db:reset`. Do the same check
   again at release time against every migration on `develop` and on hosted, and rename again if
   items 4–9 added newer ones meanwhile.
4. **When B3 is approved (item 2 release):** merge the latest `develop` into the branch, apply
   rule 3, `pnpm db:reset`, run the full item 2 gate again, and re-run `/test-and-ship` from
   step 0. That's a new TSR round with every case re-run, because `develop` has moved. Then let it
   merge and push.
5. **Deploy and merge to `main` the same commit.** `deploy.sh` deploys whatever is checked out,
   and Vercel builds whatever is on `main`. If they differ, web code can go live without its
   tables (e.g. item 3's Account page with no `notification_settings`), and every student and
   parent page that reads them fails. So each release:
   1. The team names the release SHA in the item's close-out message: the `develop` merge commit
      of that item (`git log --merges -1 --format=%H develop` straight after `/test-and-ship`).
   2. Saurabh cuts `release/<item>` at that SHA: `git fetch && git checkout -b release/<item> <SHA>`
      (`release/news`, `release/work-returned-email`, `release/homework-file-uploads`). This matches
      his existing `release/*` branch discipline for live work.
   3. He runs `deploy.sh` from that branch, then merges **that branch** (not `develop`) into `main`
      (PR from `release/<item>` → `main`).
   4. Live fixes found after release go on `release/<item>` and are merged back to `develop`.
   If item 3 has merged before B1, either release both together at item 3's SHA (§6.3 steps
   included) or release item 1 alone at item 1's SHA. Never merge `develop` HEAD into `main`.

---

## 3. Item 1 — News page (branch `feature/pending-requirements`)

Design: 03 §1 (21 files). No migration, no edge function. Test commands: 03 §1.6.

One-time set-up in every terminal used for builds (03 §1.6; never build browser-test copies
against the hosted project):

```bash
pnpm db:start && pnpm db:status          # note the publishable key
export VITE_SUPABASE_URL=http://127.0.0.1:55321
export VITE_SUPABASE_PUBLISHABLE_KEY=<from pnpm db:status>
```

Single test file: `pnpm --filter web exec vitest run <path>`.

- [x] **T1.1 Share post rows.** Files: 03 §1.1 #1 `services/post-rows.ts` (new), #2
  `posts.service.ts` (imports from it; comment updated). Test: existing tests stay green; admin can
  still publish at `/portal/admin/posts` (`pnpm dev`, `admin@local.test`). Run: `pnpm typecheck && pnpm test`.
- [x] **T1.2 Public posts client.** Files: #3 `services/public-posts.client.ts`, #4 its test, #5
  `services/index.ts`, `constants/error.constants.ts` (`PORTAL_ERRORS.notConfigured`). Test
  `public-posts.client.test.ts`: AC-1.7 (reject, 500, 5 s timeout → false / `ok: false`), AC-1.10
  (two calls, one fetch), AC-1.11 (empty url → false, no fetch). Run:
  `pnpm --filter web exec vitest run src/services/public-posts.client.test.ts`.
- [x] **T1.3 `/posts` page states.** Files: #6 `lib/use-has-news.ts`, #7 `lib/use-public-posts.ts`,
  #8 `routes/posts.tsx` (no `clientLoader`, four states, `ErrorBoundary`), #9 `routes/posts.test.tsx`,
  #10 `posts.module.css`, #11 `posts.constants.ts` (exact wording 03 §1.4). Test `posts.test.tsx`:
  one `h1` in every state (AC-1.3), empty shows `empty` + 2 links (AC-1.6), error shows `error`
  (AC-1.7), no "coming soon / check back" (AC-1.6), `<script>` title renders as text (AC-1.14).
  `posts.test.tsx` mocks the hook, so add `lib/use-public-posts.test.ts` (new, co-located;
  `renderHook` with `listPublicPosts` mocked): `fail('network')` → `{ status: 'error' }`,
  `succeed([])` → `ready` with `[]` (AC-1.7). Visible: `pnpm dev` → `/posts` shows loading, then
  the list. Run:
  `pnpm --filter web exec vitest run src/routes/posts.test.tsx src/lib/use-public-posts.test.ts`.
- [x] **T1.4 Pre-render `/posts` and guard the hosting config.** Files: #19
  `react-router.config.ts`, #20 `src/hosting-config.test.ts`, #21 `routes.ts:19` comment. Test
  `hosting-config.test.ts` (AC-1.1, 1.2, 1.4 unit parts). Visible:
  `VITE_APP_ENV=production pnpm build && ls apps/web/build/client/posts/index.html`.
  Run: `pnpm --filter web exec vitest run src/hosting-config.test.ts`.
- [x] **T1.5 Header News link.** (Done; the gap fix needed two more gaps, see 05 D2.)
  Files: #12 `content.constants.ts` (`NAV.newsLink`), #13
  `Header.tsx`, #14 `Header.test.tsx`. Test: link is the last `.links > li`, `href="/posts"`,
  `aria-current="page"` only on `/posts`, 6 items (AC-1.8); none when `useHasNews` is false
  (AC-1.6). Manual: desktop bar on one row at 1024 px and 1280 px. **Only if it wraps:**
  `Header.module.css` gap change (03 §1.1, conditional). Run:
  `pnpm --filter web exec vitest run src/components/layout/header/Header.test.tsx`.
- [x] **T1.6 Footer News link.** Files: #12 (`FOOTER.newsLink`), #15 `Footer.tsx` (first in
  `.legal`), #16 `Footer.test.tsx` (new). Test: present when true, absent when false (AC-1.9). Run:
  `pnpm --filter web exec vitest run src/components/layout/footer/Footer.test.tsx`.
- [x] **T1.7 Sitemap.** Files: #17 `routes/sitemap.ts`, #18 `sitemap.test.ts`. Test: `(false)`
  excludes `/posts`, `(true)` includes it (AC-1.11). Manual:
  `VITE_SUPABASE_URL= VITE_APP_ENV=production pnpm build` succeeds and
  `grep -c /posts apps/web/build/client/sitemap.xml` = 0. Run:
  `pnpm --filter web exec vitest run src/routes/sitemap.test.ts`.
- [x] **T1.8 Privacy sentence.** Files: #12 (`PRIVACY`, wording 03 §1.4; approved through Q1).
  Test: add one assertion to the existing `routes/privacy.test.tsx` that the sentence renders
  (same pattern items 2 and 3 use). Run: `pnpm --filter web exec vitest run src/routes/privacy.test.tsx`.
- [x] **T1.9 Docs.** `docs/architecture/arch.md` (one line, 03 §1.7), `docs/requirements/blog.md`
  status note. (`routes.ts` comment done in T1.4.) Run: `pnpm format:check`.
- [x] **T1.10 Local production gate (manual, scripted).** (Done; step 6 simulated, see 05 D4.
  Measurements in [05-dev-notes-item-1.md](05-dev-notes-item-1.md).) With the exports above and ≥ 1 local post:
  1. `VITE_APP_ENV=production pnpm build`; run the bundle check (03 §1.6) → only `done` (AC-1.12).
  2. Vercel mirror (03 §1.6 box) on :4173: `/posts` = 200, list renders, hard refresh OK (AC-1.1);
     `curl -s` shows title, description, canonical, one `h1` (AC-1.3); `curl -sI` shows no
     `X-Robots-Tag`, CSP or `no-store` (AC-1.4); `/posts/anything` and `/postsx` = 404 (AC-1.5).
  3. Railway mirror on :4174: `/posts` = 200 (AC-1.2).
  4. `VITE_APP_ENV=staging pnpm build`: `/posts` HTML has `noindex` (AC-1.4).
  5. Delete every local post → no News links on home, a programme page, `/posts` shows the empty
     line (AC-1.6). Publish one → links back on reload (AC-1.10).
  6. `pnpm db:stop` → no links, `/posts` shows the error line (AC-1.7). `pnpm db:start` again.
  7. CLS on `/` at 1024 × 600 < 0.1, recorded for the TSR (AC-1.8).
  8. `tutor@local.test` at `/portal/admin/posts` sees "You don't have access to this page"
     (AC-1.13); admin compose refuses empty/over-long title and body (AC-1.14).
- [x] **T1.11 Full check.** Run:
  `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build && pnpm db:test`
  (`db:test` proves `posts.test.sql` is unchanged, AC-1.13; AC-1.15 is `pnpm lint`).
- [ ] **T1.12 Pipeline.** Reviewer on `develop...HEAD` → `review-5-item-1.md`; Tester →
  `06-test-plan-item-1.md`; Security → `06-security-item-1.md`; then
  `/test-and-ship docs/delivery/2026-10-25-pending-requirements/06-test-plan-item-1.md` →
  `TSR-item-1.md`, merge to `develop`, push.

**12 tasks.**

---

## 4. Item 3 — "Work returned" email (branch `feature/work-returned-email`)

Design: 03 §3 (31 files). Migration `20261025110000_work_returned_email.sql` (03 §3.2), edge
function `notifications` (03 §3.4). All email goes to the local Mailpit
(`http://127.0.0.1:55324`). Nothing in this item runs against the hosted project.

- [x] **T3.0 Branch.** `git checkout develop && git pull --ff-only && git checkout -b feature/work-returned-email && pnpm db:start`.
- [x] **T3.1 Switch, outbox and trigger.** Files: 03 §3.1 #1 migration steps 1–5 (extensions,
  `notification_settings` + RLS, `email_outbox`, helpers, `queue_work_returned_email` trigger) with
  their grants; #2 `email_outbox.test.sql` (starts with `delete from public.email_outbox`). Tests:
  AC-3.1 (paper and online returns queue student + both parents), AC-3.2 (every no-recipient case
  incl. the deactivated student, 0 rows, return succeeds), AC-3.5 (second return, MCQ auto-return,
  other parents/tutors: no rows), AC-3.6/3.10 own-switch rules. **Only under the 1 → 2 → 3
  swap (§2):** create the migration with `supabase migration new work_returned_email` (newer than
  item 2's; then the rule 3 `ls … | tail -2` check) instead of `20261025110000`, and add the file hand-in return case here (former
  T2.11). Visible: return work as
  `tutor@local.test` in the local portal → rows appear in Studio. Run: `pnpm db:reset && pnpm db:test`.
- [x] **T3.2 Worker RPCs, cron kick, admin list.** Files: #1 steps 6–9 (`notify_claim_emails`,
  `notify_record_result`, `notify_flag_config_missing`, `kick_email_worker` + both cron jobs,
  `admin_email_problems`, grants); #8 `seed.sql` (local Vault entries, 03 §3.6). Confirm container
  hostnames with `select net.http_get('http://supabase_kong_aj_classes:8000/functions/v1/notifications')`
  (fallback `host.docker.internal`, 03 §3.6). Tests in `email_outbox.test.sql`: claim-time skip,
  cap and reclaim (cap replaced by 2 in the test), AC-3.7 (no Vault secret → rows stay pending),
  AC-3.8 (refused for non-admins and aal1; failed/waiting rows with every reason; no email/body
  column; newest first), AC-3.2 (after each no-recipient return from T3.1, `admin_email_problems`
  returns 0 rows), AC-3.10 (`authenticated` can't execute `notify_*`). Run: `pnpm db:reset && pnpm db:test`.
- [x] **T3.3 Transport, template and copy.** Files: #4 `transport.ts`, #5 `template.ts`, #6
  `copy.ts`; #9 `test-notifications.mjs` with the Node unit block at the top. Tests: `pickTransport`
  null for unset / `''` / `smtp` / `Resend` / resend without key (AC-3.11); `resendRequest` headers
  (`Idempotency-Key`, `Authorization`); `outcomeForStatus` 200/429/409/500/422; `shouldStopBatch`;
  `renderWorkReturned` subject/body/button, no mark (AC-3.3), links (AC-3.4), footer link
  (AC-3.6). Run: `node supabase/scripts/test-notifications.mjs`.
- [x] **T3.4 Worker function and end-to-end script.** Files: #3 `functions/notifications/index.ts`,
  #7 `config.toml` (`verify_jwt = false`, local secrets), #12 `/package.json` (`test:functions`
  appends the script); #9 end-to-end part, in this order (03 §3.10 steps 0–6):
  1. print the recovery command;
  2. **register the `SIGINT`/`SIGTERM` handlers (resume, then exit 130/143) before the pause**
     (review-3 R3-1), so a Ctrl-C between the pause and the `try` still resumes the job;
  3. pause with `cron.alter_job(jobid, active := false)`, never `unschedule`; no `$$` in any SQL
     passed to the `sql` helper;
  4. `try`: drain the seed's queued rows (call the worker, `DELETE /api/v1/messages`), then the
     checks; `finally`: resume;
  5. `check()` the job is `active = t`; `finish()` sets `process.exitCode` only.

  Tests: AC-3.1 (one email each to `student@local.test` and `parent@local.test`), AC-3.3 (no mark
  or comment text in Mailpit), AC-3.5 (second worker call sends nothing), AC-3.7 (wrong secret →
  401, rows pending), AC-3.9 (`From`, branding), `Idempotency-Key` equals the outbox id. Also run it
  once and press Ctrl-C mid-run, then confirm `select active from cron.job` is `t`. Visible: return
  work in the portal → email in Mailpit within 5 minutes; signed out, open its **View feedback**
  link → sign-in → lands on the student's (and, from the parent email, the parent's) assignment
  page (AC-3.4 browser leg). Run: `pnpm test:functions`.
- [x] **T3.5 Account → Notifications.** Files: #13 `notifications.service.ts` (get; save as
  update-then-insert, **no upsert**, review-3 finding 2), #14 `types.ts`, #15 `services/index.ts`,
  #16 `database.types.ts` (`pnpm db:types`), #17 `account.tsx`, #18 `account.module.css` (only if
  needed), #23 `portal.constants.ts` (`ACCOUNT_PAGE.notifications`). Test (browser, AC-3.6):
  shown to student and parent, not staff; on by default; first Save **and** second Save show
  "Saved…"; survives sign-out. Run: `pnpm db:types && pnpm typecheck && pnpm test`.
- [x] **T3.6 Admin Emails page.** Files: #19 `admin-emails.tsx`, #20 `routes.ts`, #21
  `admin-dashboard.tsx` (`SHORTCUTS`), #22 `routes.constants.ts`, #23 (`PORTAL_SEO.adminEmails`,
  `ADMIN_DASHBOARD.shortcuts.emails`, `EMAILS_PAGE`), #24 `lib/email-problems.ts`, #25 its test.
  Tests: `email-problems.test.ts` (every state, reason and role labelled, AC-3.8); browser:
  empty state "No failed or waiting emails"; tutor return with
  `docker stop supabase_edge_runtime_aj_classes` shows no error (AC-3.7). Run:
  `pnpm --filter web exec vitest run src/lib/email-problems.test.ts`.
- [x] **T3.7 `deploy.sh`.** File: #10 (03 §3.6 steps 1–4: require a non-local
  `NOTIFY_WORKER_SECRET`, append only `notifications` to `FUNCTIONS`, one `secrets set` then
  `unset` last with `MAILPIT_URL` in `local_only`, digest check skipped under `--dry-run`, print the
  Vault SQL). Test: `bash -n supabase/scripts/deploy.sh`;
  `supabase/scripts/deploy.sh --dry-run` prints the new steps in order;
  `NOTIFY_WORKER_SECRET=local-notify-secret supabase/scripts/deploy.sh --dry-run` exits non-zero.
  **Never run it without `--dry-run`**: the real run is Saurabh's (§6.3).
- [x] **T3.8 Privacy sentence and docs.** Files: #26 `PRIVACY` (the 03 §3.8 sentence only;
  `[TBC: B17]` is a marker in the docs, never in code: no literal "[TBC…]" and no TODO in the
  constant, per KINET `no-todo-without-ticket`; the B17 approval is tracked as Q7 and in §6.3),
  #31 `privacy.test.tsx` (sentence renders), #11 `supabase/README.md` (local email flow, Vault
  runbook, kill switch, recovery command, AC-3.11 check), #27 `arch.md`, #28 `budget.md`, #29
  `release-5/PRP.md`, #30 `release-2/go-live.md` (item 3 release steps as unticked boxes; Saurabh
  ticks them on release). Run: `pnpm --filter web exec vitest run src/routes/privacy.test.tsx && pnpm format:check`.
- [x] **T3.9 Full check.** Run:
  `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build && pnpm db:test && pnpm test:functions`.
  Plus the item 1 bundle check (03 §1.6) still prints only `done`.
- [ ] **T3.10 Pipeline.** `review-5-item-3.md` → `06-test-plan-item-3.md` + `06-security-item-3.md`
  (incl. the Spam Act "on by default" call, 01 assumption 13) →
  `/test-and-ship docs/delivery/2026-10-25-pending-requirements/06-test-plan-item-3.md` →
  `TSR-item-3.md`, merge to `develop`, push.

**11 tasks.**

---

## 5. Item 2 — Homework file uploads (branch `feature/homework-file-uploads`, held)

Design: 03 §2 (48 files). Migration created in T2.0 (name per §2 rule 3), edge function
`assignment-files` (03 §2.5). Uploads use local Storage only.

- [ ] **T2.0 Branch and migration file.** `git checkout develop && git pull --ff-only && git checkout -b feature/homework-file-uploads && supabase migration new assignment_files`.
  Then `ls supabase/migrations | tail -2`: if the new file isn't last (UTC stamp earlier than
  `20261025110100`, item 3's posts migration), `git mv` it to one minute after the newest file on `develop` (e.g.
  `20261025110200_assignment_files.sql`) and `pnpm db:reset` (§2 rule 3).
- [ ] **T2.1 The flag (DB).** Files: 03 §2.1 #1 migration steps 1–3 only (flag, flag guards,
  `is_online_assignment`) with their step 12 grants (keep 03 §2.2's step order in the file;
  steps 4–11 slot in at T2.2); #2 `assignment_files.test.sql` (first cases); #8 `seed.sql` (the
  file hand-in assignment). Tests: AC-2.2 (flag on insert, draft toggle, locked when published,
  questions guards), AC-2.8 (staff Submitted/Marked on a file hand-in → `invalid_status`). The
  family functions are untouched here, so the full pgTAP suite stays green. Run:
  `pnpm db:reset && pnpm db:test`.
- [ ] **T2.2 Table, bucket, storage policies, RPCs, submit rule and family functions (DB).**
  Files: #1 steps 4–11 in order (steps 10 `student_submit` and 11 `assignment_view` both read the
  step 4 table) + remaining step 12 grants; #2 more cases; #17 `database.types.ts`. Tests: AC-2.1
  (5 attachments, 6th `too_many_files`, tutor 2 `not_found`), AC-2.3 (first register → in
  progress; paper refused 42501 / `not_online`), AC-2.4 DB refusals (`file_type`,
  `file_too_large`, `files_too_large`), AC-2.6 (0 files → `no_files`; 1 file → stays `submitted`,
  **never auto-returns**; locks after submit), AC-2.7 visibility by status, AC-2.9 DB marks,
  AC-2.10 parent JSON, AC-2.11 permission matrix, AC-2.14 cascade and removed student, sequential
  6th upload refused. **Regression:** `family_portal.test.sql` and every other pgTAP file stay
  green (the family functions are dropped and recreated). Run:
  `pnpm db:reset && pnpm db:test && pnpm db:types`.
- [ ] **T2.3 File hand-in in the web app.** Files: #12 `assignments.service.ts` (columns, mapping,
  save), #14 `family-data.ts` (`is_file_handin`), #15 `types.ts`, #20–21 `lib/assignments.ts` +
  test (`assignmentKind`, `acceptsStudentWork`), #30 `AssignmentDialog.tsx`, #32
  `assignment-detail.tsx` (kind, no question editor, submissions table), #34 `student-home.tsx`,
  #41 `online-assignments.constants.ts`, #42 `family.constants.ts`. Needs T2.2's family
  functions and types. Tests: `assignments.test.ts` (all three kinds); browser: tutor creates a
  File hand-in draft, switch locked once published (AC-2.2); student home shows "Upload your
  work"; existing student and parent assignment pages still load. Run:
  `pnpm --filter web exec vitest run src/lib/assignments.test.ts && pnpm typecheck`.
- [ ] **T2.4 File checks and photo compression.** Files: #22–23 `lib/work-files.ts` + test, #24–25
  `lib/photo.ts` (`fitWithin`, `prepareWorkPhoto`, `canvasToBlob` quality) + `photo.test.ts`, #37
  `WORK_FILE_LIMITS`, #38–39 `files.constants.ts` + export, #40 `error.constants.ts`, #18–19
  `auth-errors.ts` + test. Tests: `work-files.test.ts` (AC-2.4 types, empty-type `.docx`, 6th file,
  sizes, total), `photo.test.ts` (AC-2.5 `fitWithin`), `auth-errors.test.ts` (each new key). Run:
  `pnpm --filter web exec vitest run src/lib/work-files.test.ts src/lib/photo.test.ts src/services/auth-errors.test.ts`.
- [ ] **T2.5 Tutor attachments, end to end.** Files: #11 `assignment-files.service.ts` (map the
  storage error body's `statusCode`, not the HTTP status), #16 `services/index.ts`, #26–27
  `FilesCard.tsx` + test, #29 `components/portal/index.ts`, #32 attachments card, #12
  `assignments.service.ts` (`getAssignment` loads files). Tests: `FilesCard.test.tsx` (upload states and Try again AC-2.3, refusals
  AC-2.4, HTML file name as text AC-2.12, empty text AC-2.13, `accept` set and no `capture`
  AC-2.15). Visible: tutor attaches a PDF; student downloads it once published (AC-2.1). Run:
  `pnpm --filter web exec vitest run src/components/portal/FilesCard.test.tsx`.
- [ ] **T2.6 Student hand-in.** Files: #28 `FileHandInForm.tsx`, #35 `student-assignment.tsx`,
  #14 view keys (`isFileHandin`, `studentId`, `attachments`, `files`, `unfinishedUploads`).
  Browser: upload on file hand-in and online work, none on paper (AC-2.3); Hand in needs 1 file
  and confirms (AC-2.6); "No files attached" (AC-2.13). Run: `pnpm typecheck && pnpm test`.
- [ ] **T2.7 Tutor marking.** Files: #31 `SubmissionsTable.tsx` (Files column), #33
  `submission.tsx` (file list, optional overall mark, score line), #13 `submissions.service.ts`
  (`overallMark`, `files`). Browser (AC-2.9): file count; Download; mark field only when a max
  exists; Return works without a mark and the student then sees no mark; online return
  unchanged; "No files handed in" on a submitted online assignment with none (AC-2.13). Run:
  `pnpm typecheck && pnpm test`.
- [ ] **T2.8 Parent view.** File: #36 `parent-child-assignment.tsx`. Browser (AC-2.10): files
  after submit, read only, no Remove; none before. Run: `pnpm typecheck && pnpm test`.
- [ ] **T2.9 Delete through the edge function.** Files: #3 `functions/assignment-files/index.ts`,
  #4 `_shared/auth.ts` (`requireSignedIn`), #5 `config.toml`, #12 `deleteAssignment` →
  `callEdgeFunction`, #7 `deploy.sh` (append only `assignment-files`). Browser: delete an
  assignment with files; it's gone and the delete flow looks unchanged. Run: `bash -n supabase/scripts/deploy.sh && pnpm typecheck`.
- [ ] **T2.10 Real Storage API script.** Files: #6 `test-assignment-files.mjs`, #10 `/package.json`
  (`test:functions` appends it), #9 `supabase/README.md`. Tests: AC-2.4 (`text/html` → body
  `"415"`, 11 MB PDF → `"413"`, HTTP 400), AC-2.11 (no public URL; signed URL `exp - iat = 60`),
  AC-2.12 (`Content-Disposition: attachment`), AC-2.14 (prefix delete incl. an orphan; tutor 2
  `not_found`), carry-over 3 (sequential 6th → `"403"`; 6 parallel → at most 5 register, extras in
  `unfinishedUploads`). Run: `pnpm test:functions`.
- [ ] **T2.11 Item 3 cross-check** (under the 1 → 2 → 3 swap this moves into T3.1 and is skipped here). Add the "file hand-in return queues student + parents" case to
  `email_outbox.test.sql` (03 §3.10 AC-3.1, "if item 2 is in"). Run: `pnpm db:test`.
- [ ] **T2.12 Privacy sentence and docs.** Files: #43 `PRIVACY` (the 03 §2.8 sentence only;
  `[TBC: B17]` is a docs marker, never a literal or TODO in the constant; approval is Q7 / §6.2),
  #48 `privacy.test.tsx`, #44 `arch.md`, #45 `r3b/design.md` D6, #46 `budget.md`, #47
  `release-3/PRP.md` ("built, pending release"). Run: `pnpm --filter web exec vitest run src/routes/privacy.test.tsx && pnpm format:check`.
- [ ] **T2.13 Full check and manual passes.** Run:
  `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build && pnpm db:test && pnpm test:functions`,
  plus the item 1 bundle check (AC-2.16). Manual: 3 real 12 MP phone photos uploaded, stored
  sizes from Studio recorded (each ≤ 2 MB, AC-2.5); Chrome device mode 360 px; `.heic` in Chrome
  → `heicUnsupported` (AC-2.15).
- [ ] **T2.14 Pipeline, held.** `review-5-item-2.md` → `06-test-plan-item-2.md` +
  `06-security-item-2.md` (MIME spoofing, soft upload cap, no virus scan) →
  `/test-and-ship` **steps 0–5.1 only** → `TSR-item-2.md` verdict `APPROVED (auto), held for B3`.
  No merge, no push (unless Q4 says push the branch).
- [ ] **T2.15 Release refresh (only after B3).** §2 rule 4: merge `develop` in, check the migration
  timestamp, `pnpm db:reset`, T2.13 again, `/test-and-ship` from step 0 (new round, every case),
  merge to `develop`, push.

**16 tasks.**

---

## 6. Risks, mitigations, and release steps for Saurabh

### 6.1 Item 1

| # | Risk | Mitigation |
|---|---|---|
| 1 | Desktop bar wraps at 1024 px with a sixth link | Measure in T1.5; use the conditional gap change only; breakpoint unchanged |
| 2 | A browser-test build reads the hosted DB (`.env.production`) | The two `export` lines in every build terminal (03 §1.6) |
| 3 | Posts migration not yet on hosted at release | Fails safe: links hide, `/posts` shows the error line. B1 step 1 applies it first |
| 4 | Releasing item 1's SHA also ships the 19 unreleased commits before it | Named in Q1 so Saurabh approves them knowingly; B2 checks cover them |
| 5 | Item 5's future CSP blocks the news check | 02 cross-item note: `connect-src` must include the Supabase host; carried into item 5's ACs |

**Release steps (Saurabh, Q1).** Release SHA = item 1's `develop` merge commit, named in item 1's
close-out message (§2 rule 5).
1. `git fetch && git checkout -b release/news <item-1 SHA>`.
2. From `release/news`: `supabase/scripts/deploy.sh` (applies the posts migration).
3. Publish at least 1 post at `/portal/admin/posts` (hosted).
4. Merge `release/news` (the same SHA, not `develop`) into `main` through a PR.
5. Check: `curl -s -o /dev/null -w '%{http_code}' https://ajclasses.com.au/posts` = 200, also after
   a hard refresh; the News link shows in the header and footer; `sitemap.xml` lists `/posts`.

### 6.2 Item 2

| # | Risk | Mitigation |
|---|---|---|
| 1 | Item 2 reaches hosted before B3 (merged, or deployed from its checkout) | Held branch (§2 rules 1–2); never run `deploy.sh` from it; TSR verdict says "held" |
| 2 | Dropping and recreating the family functions breaks family pages or grants | Step 12 re-grants; full pgTAP suite (T2.2) and the family-flow regression cases in the TSR |
| 3 | A file hand-in auto-returns on submit | pgTAP case in T2.2 (status stays `submitted`) |
| 4 | Branch goes stale while waiting for B3 | T2.15 refresh: merge `develop`, rename the migration if needed, re-run everything |
| 5 | MIME spoofing; soft upload cap under parallel requests; no virus scan | Download-only, served from `*.supabase.co`, images re-encoded; hard cap on registered files; Security reviews (T2.14); orphan sweep in Later |
| 6 | HEIC photos from iPhones | Clear refusal message; hosted phone check in the release steps; HEIC support to Later if needed |
| 7 | Staging and prod share one DB, so staging uploads land in the real bucket | Release checks use a test class and test student only, deleted through the function afterwards |

**Release steps (Saurabh, after Q3 = yes and Q7 wording).** Release SHA = item 2's `develop`
merge commit from T2.15, named in that close-out message.
1. Upgrade to Supabase Pro.
2. Team runs T2.15 (merge to `develop`, push) and names the SHA.
3. `git fetch && git checkout -b release/homework-file-uploads <item-2 SHA>`; from that branch:
   `supabase/scripts/deploy.sh` (migration and the `assignment-files` function).
4. Merge `release/homework-file-uploads` (the same SHA) into `main` through a PR.
5. On a phone against the hosted site, with a test class and test student only: the picker offers
   camera and library; upload an iPhone photo; hand in; delete the test assignment.

### 6.3 Item 3

| # | Risk | Mitigation |
|---|---|---|
| 1 | Real families get emails during testing (one DB for staging and prod) | All tests on the local stack with Mailpit; no default transport or secret; the hosted check uses only a test family with Saurabh's own addresses (03 §3.7) |
| 2 | A send loop uses up Resend's 100/day, blocking sign-in email | Unique key per recipient, app cap 70 per rolling 24 h, ≤ 3 attempts, 429 stops the batch |
| 3 | Local values copied to hosted (`MAILPIT_URL`, local secret, localhost `SITE_URL`) | Single `secrets set`, `unset` last, digest check (T3.7); Saurabh confirms the digest format on the first real run |
| 4 | Vault secret or cron job missing on hosted, so nothing sends | Rows wait, nothing is lost; the admin Emails page shows "Not attempted" after ~2 h; release step 5 checks a row drains |
| 5 | The test script leaves cron paused locally | Pause, not unschedule; signal handlers registered before the pause (R3-1); `finally`; recovery command printed; `db:reset` restores |
| 6 | Hosted refuses `create extension pg_cron/pg_net` from a migration | Saurabh enables both in Dashboard → Database → Extensions and re-runs (03 §3.2 step 1) |
| 7 | Web released before the DB, or a different commit merged to `main` than was deployed, so the Account page fails to load the missing table | Release order below: DB first, then `main`; deploy and merge the same SHA via `release/*` (§2 rule 5) |
| 8 | Container hostnames in local Vault/config are wrong | Checked in T3.2 with `net.http_get`; `host.docker.internal` fallback |

**Release steps (Saurabh). Preconditions:** Q2 answered; **Q7 (B17) wording approved** for the
item 3 Privacy sentence; B1 done first, or released together at this SHA. Release SHA = item 3's
`develop` merge commit, named in item 3's close-out message.
1. Put a new long random `NOTIFY_WORKER_SECRET` and the Resend key in his password manager and
   `supabase/.env.deploy` (git-ignored).
2. `git fetch && git checkout -b release/work-returned-email <item-3 SHA>`; from that branch:
   `supabase/scripts/deploy.sh` (migration, enables `pg_cron`/`pg_net`, the `notifications`
   function, secrets). Confirm the digest check passed.
3. Merge `release/work-returned-email` (the same SHA, not `develop`) into `main` through a PR.
4. Run the Vault SQL that `deploy.sh` prints, in Dashboard → SQL Editor.
5. AC-3.11 check (03 §3.7): test family, a test tutor returns one paper assignment, both emails
   arrive within 5 minutes, `/portal/admin/emails` is empty. Delete the test class.
6. Tick the item 3 boxes in `docs/requirements/release-2/go-live.md`.

---

## 7. Deferred (not in items 1–3)

1. **Item 1:** home-page "latest 3" preview, per-post pages, NewsArticle JSON-LD, post images and
   tags, email digest; "What's On" label (waits for Events, B11).
2. **Item 2:** student uploads on paper homework (owner decision), staff close-out of unsubmitted
   online work, tutor marked-up copies, previews and thumbnails, annotation, virus scanning,
   admin storage-usage view, HEIC support if testing needs it, orphan-file sweep.
3. **Item 3:** "new assignment" and "due tomorrow" emails (item 8), daily digest, SMS, push
   (mobile), tutor-side alerts, `List-Unsubscribe` header, emails for auto-returned MCQ quizzes,
   a "release" outcome that keeps the attempt count on 429.
4. **Programme:** items 4–9 (§1.1), everything blocked in §1.2, the Later bucket, mobile.
5. **Next migration batch (from item 1 review and security):** item 1 stays migration-free, so
   these ride with the next item that ships a migration (item 3 or 2):
   1. Column-level read for anon on `posts`: `revoke select on public.posts from anon;
      grant select (id, created_at, updated_at, title, body) on public.posts to anon;`. Safe
      because the public client already asks only for those columns (`68460ec`).
   2. `posts` title/body checks use `char_length(btrim(...))`, so a spaces-only post sent
      straight to the API is refused too (the admin page already refuses it, `686bfe5`).

---

## 8. Definition of done

Common to every item:
1. Every task in its section is ticked, and each tick means its test ran and passed.
2. Every AC has a passing test: unit, pgTAP, script or a recorded manual result in the TSR. Hosted-only
   parts are written as release steps (§6), not skipped silently.
3. Full check green: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build`,
   plus `pnpm db:test` and `pnpm test:functions` where the item changes DB or functions.
4. Reviewer `review-5-item-<n>.md` APPROVED; Security `06-security-item-<n>.md` has no open
   blocking finding.
5. `TSR-item-<n>.md` at 100% with the full check green; "Not covered" filled in.
6. Release steps for Saurabh written in §6 and repeated in the item's close-out message, with
   the **release SHA** (the item's `develop` merge commit) and its `release/<item>` branch name.

| Item | Docs updated (from 03) | Merge and push |
|---|---|---|
| 1 | `routes.ts:19` comment, `docs/architecture/arch.md` (public live reads), `docs/requirements/blog.md` status | Merged to `develop`, pushed |
| 3 | `supabase/README.md` (email flow, Vault runbook, kill switch, recovery, AC-3.11), `arch.md` §4/§7 and diagram, `budget.md` §2 Resend row, `release-5/PRP.md`, `release-2/go-live.md` release boxes | Merged to `develop`, pushed |
| 2 | `supabase/README.md` (function, `test:functions`, orphans), `arch.md` §4 and diagram, `r3b/design.md` D6, `budget.md` §4, `release-3/PRP.md` | **Held:** TSR committed on the branch, not merged or pushed (unless Q4). Done again after B3 via T2.15 |

Item 2 is "done (held)" at T2.14 and "done (released)" after T2.15 and Saurabh's release steps.
