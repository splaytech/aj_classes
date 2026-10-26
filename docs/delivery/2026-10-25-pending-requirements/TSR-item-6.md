# Test Summary Report — item 6 (CI quality gates: E2E smoke, Lighthouse, structured data)

- Date: 2026-10-26 · Branch: `feature/ci-quality-gates` @ **`e83b81e`** (the plan freeze commit, `docs(delivery): freeze the item 6 test plan`). It descends from `815135d` (`git merge-base --is-ancestor 815135d HEAD` exits 0). The code equals `815135d`: `git diff --quiet 815135d HEAD -- apps e2e .github package.json pnpm-lock.yaml pnpm-workspace.yaml supabase README.md docs/testing` exits 0.
- **Path B** (Q28 unanswered): nothing was pushed, and no PR was opened. The workflow was proven with `act` 0.2.89 and image `catthehacker/ubuntu:act-latest` (arm64). The five deliberate failures were uncommitted edits, each undone with `git restore` in the same case.
- Environment: local only.
  - Local Supabase: API `127.0.0.1:55321`, reset from this worktree (edge-runtime mount check `1`, newest migration `20261026100000`). Rebuilt fresh by the `act` cases (`supabase stop --no-backup`), then restarted at E-80 with the same seed.
  - Supabase CLI 2.120.0 · Node v24.15.0 · pnpm 11.1.2.
  - Browsers: installed Chrome 155 (local LHCI, `HeadlessChrome/155.0.0.0`); Playwright 1.64.0's Chromium (smoke, CSP sweep, and Lighthouse inside `act`).
  - The hosted project was never read or written, and `supabase/.env.deploy` was never opened. No banned command ran: no push, no `gh pr`/`gh run`, no `link`/`db push`/`deploy`/`secrets`. Nothing was sent to `ajclasses.com.au` or `*.vercel.app`.
- **Full check (E-10) → PASS**, every step exit 0:
  - format clean · lint 0 problems · typecheck clean (web **and** e2e) · production build OK · `check-hosted-ref: 0 files (of 153 scanned)`;
  - `pnpm test`: Vitest **56 files, 496 tests passed**, then e2e `node:test` **6 tests, 2 suites, 6 pass, 0 fail**;
  - `db:test` **`Files=14, Tests=507`, `Result: PASS`**;
  - `test:functions` **169 `ok`, 0 `not ok`**;
  - E2E smoke (in-repo, E-23) **9 passed** (43.8 s). Afterwards: 0 `e2e-%` rows; port 5173 free.
- Test plan: `06-test-plan-item-6.md`, **frozen at 54 pre-merge cases** (`e83b81e`). The review 6a round 1 changes are listed in its header ("Changes after review 6a", 20 items), so there's no second round.
- **Evidence:**
  - committed (filtered and key-free): `docs/delivery/2026-10-25-pending-requirements/evidence-item-6/`, 44 files. `grep -rlE 'eyJ…|sb_secret_|sb_publishable_|service_role'` finds nothing; no zips;
  - kept out of git (they hold local keys, the seed admin's password and TOTP seed, and session JWTs; security S4): raw `act` logs, artifacts, traces, Lighthouse reports and `e2e/.env` copies, in the session scratchpad `item6-run/`.

**Run notes.**
1. **Order and data.** Phases 0 to 5 ran on the seeded stack. Phase 6 deleted it on purpose before the `act` jobs that start Supabase (E-64), and cleared it after each one (E-65, E-66, E-70, E-71). E-80 restarted it from this worktree: the end snapshot equals the start (profiles 6, posts 0, enquiries 0, `e2e-%` 0).
2. **Shell.** The runs used `bash`, whose `grep` is BSD (no `-P`). E-17's pattern was run with `perl` instead; same pattern, same files.
3. **Local keys in the session output (not in evidence).** In E-51, the runbook's `pnpm db:start` printed the local CLI status JSON, which holds the Supabase CLI's fixed default local keys, into the tester's tool output. Nothing went into the evidence folder or any committed file. They are the CLI's shared public defaults, not hosted values (security S4).
4. **`act` leaves its last container per job running.** At close-out, 2 `act-CI-…` containers (Lighthouse, E2E smoke) were still up. They were removed with `docker rm -f` (proposed ruling PR-3).

## Round 1

### Phase 0 — safety

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-01 | Safety | Build, shell, tools | HEAD ⊇ `815135d`; clean; local URL; key equal; no override names; ports free; tool versions; external repo frozen | `e83b81e`, ancestor `0`, code diff `0`, `feature/ci-quality-gates`, status `0`; `http://127.0.0.1:55321`, `equal`; no listed name set; ports `0`; act 0.2.89, image 1, CLI 2.120.0, v24.15.0, 11.1.2; external `488dde1`, `0` | PASS |
| E-02 | Safety | Stack from this worktree; snapshot | reset 0; mount 1; `20261026100000` ×2; profiles 6, posts 0, `e2e-%` 0 | exactly that; enquiries 0 | PASS |
| E-03 | Safety | `.env.deploy`; banned commands; nothing pushed | `0`; none; no upstream | `git check-ignore` 0; the session ran no banned command; `fatal: no upstream configured for branch 'feature/ci-quality-gates'` | PASS |

### Phase 1 — repo, scope and committed config

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-10 | Full check | 04b §0 steps 1–3 | all exit 0; 56/496 Vitest; 6/2 node:test; hosted-ref 0; 14/507 PASS; 169 ok | as expected (header) | PASS |
| E-11 | Scope | 54 non-docs files; 3 test-only `apps/web/src` files; config unchanged; root `typecheck` + `test` lines | 54 (7 root, 2 + 14 + 3 web, 28 e2e); `ProfileForm.test.tsx`, `admin-posts.test.tsx`, `test/user.ts`; `0`; exactly those two lines | PASS |
| E-12 | Moved suite | 14 files equal to `488dde1` modulo formatting | `14 same` | PASS |
| E-13 | Workflow shape | 5 jobs; triggers; timeouts; no needs; 5 `if:`; 1 `id: hosted-ref`; permissions; retention ×3 | `act -l` 5 rows (e2e/E2E smoke, lighthouse/Lighthouse, structured-data/Structured data, web, database; all `CI ci.yml push,pull_request`); `push: [main, develop]` + `pull_request:`; 15/20/15/10/10; `0`; lines 95, 144, 147, 149, 155 as listed; line 127; `contents: read`, `1`; 102, 154, 162 | PASS |
| E-14 | Workflow safety | no ref/secrets; hosted-ref 30 scanned; job env; env files; no keys in history | `0`, `0`; `check-hosted-ref: 0 files (of 30 scanned)` (`e2e/.env` present), exit 0, 29 tracked; `VITE_LEAD_CAPTURE: 'on'`, `> /dev/null`, `>> "$GITHUB_ENV"`; the 3 env files, 3 placeholders, ignored `0`; `0`, `0` | PASS |
| E-15 | Lighthouse config | one config, mobile, 6 URLs, 3 runs, 0.9/0.9/0.9/1 median, filesystem, no size gate | exactly that; `minScore` only at `lighthouserc.json:19–22`; public storage `0`; `--assert` `0`; size assertion `false` | PASS |
| E-16 | Dev deps | e2e devDependencies only; web deps unchanged; only `@lhci/cli` added; 5 reasons | `d` null, the 7 `dd` entries; `0`; `> "@lhci/cli": "0.15.1"`; `5` rows, "Why" 37–90 characters | PASS |
| E-17 | Code rules | 0 added lines match | `0` (via `perl`, run note 2) | PASS |
| E-18 | Docs (static) | 5 sections; every gate command in the doc; README/arch/ADR; `act` steps; install step; `signing_keys_path`; anchor; `test:unit` | sections ✓; README `1`, arch `5`, Preconditions `1`, ADR amendment ✓; `act` steps ✓; `pnpm install` at line 21, `signing_keys_path` `1`, `## Getting started` `1`, `test:unit` `1`. **But step 2:** the E2E job's `pnpm --filter aj-classes-e2e typecheck` isn't in the runbook (`grep -cF 'aj-classes-e2e typecheck'` → `0`) | **FAIL** (BUG-13) |
| E-19 | `local-hosts` tests | `test:unit` exit 0; `tests 6`, `suites 2`, `pass 6`, `fail 0`; 6 titles; no imports | exit 0; `ℹ tests 6`, `ℹ suites 2`, `ℹ pass 6`, `ℹ fail 0`; the 6 titles ✔ under `assertLocalUrl` and `assertLocalDevServerEnv`; imports `0`; used by `config.ts:4` and `global-setup.ts:6`; 2 describe, 6 it | PASS |

### Phase 2 — E2E smoke locally

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-20 | `local-env.mjs` | 23 lines; no placeholders; keys equal; masks on stderr only | exit 0; `23`; `0`; stderr `0`; 3 × `equal`; CI mode: 3 `::add-mask::` lines, stderr 3 lines, stdout `::` `0`, `same` | PASS |
| E-21 | Refusals | 3 exact messages, exit 1, stdout 0 | all three messages exact, exit 1, 0 bytes | PASS |
| E-22 | Config guard | 5 exact refusals; 5173 free | `Config error: WEB_BASE_URL / SUPABASE_REST_URL … not "example.supabase.co"`, `MAILPIT_URL … not "10.0.0.5"`, `PG_HOST … not "db.example.supabase.co"`, `Missing required environment variable(s): ADMIN_EMAIL.` + the hint; exit 1 each; 5173 `0` | PASS |
| E-23 | Smoke | 9 passed, the 9 titles; clean-up | `9 passed (43.8s)`, the 9 titles exactly, 0 failed/skipped/flaky; 5173 free; `e2e-%` 0/0/0; status clean | PASS |
| E-24 | Journeys | mapping; DB asserts (R1); Web3Forms mocked; all guarded; `playwright test` | 19/10/4 for admin-posts/invite/register, 0/0 for our-approach/staff-login (unchanged, R1); mock 2; 5 specs on test-fixtures; `auto: true` 1; guard import 2; `playwright test` | PASS |
| E-25 | Guard proof (H1) | 1 failed with the guard message; trace kept; restored | `1 failed`, `Error: requests to a hosted Supabase project` with `"https://example.supabase.co/rest/v1/"`; `trace.zip` kept; the trace's network log shows that request `status -1`, `net::ERR_FAILED` (aborted in the browser); restored, status `0`, HEAD equal | PASS |
| E-26 | Hosted URL refused (R2) | refused before the dev server; 5173 free | exit 1; the exact `Config error: VITE_SUPABASE_URL must be localhost or 127.0.0.1, not "example.supabase.co"` (1); 5173 `0`; "unreachable" warning `0`; result folders `0`. FUNCTIONS_URL leg: the exact message, exit 1, 5173 `0` | PASS |
| E-27 | External suite | env measure; 9 passed | shell and the 5173 process: only `VITE_SUPABASE_URL=http://127.0.0.1:55321`; `9 passed (1.6m)`, the 9 titles; `e2e-%` 0/0/0; external repo `0` | PASS |
| E-28 | Unset URL refused | exact "is not set" message; 5173 free | blank: the exact message (1), exit 1, 5173 `0`; space: the message, exit 1, 5173 `0` | PASS |
| E-29 | Warm-up guard (H3) | setup fails naming a `rest/v1/posts` URL; no test ran; 5173 freed | exit 1; `[global-setup] The dev server at http://localhost:5173 requested a hosted Supabase project (https://example.supabase.co/rest/v1/posts?select=id&limit=1); stop it and re-run with the local settings.`; result folders `0`; dev-server log `supabase.co` `0` (no server-side call); 5173 `0` after the kill | PASS |

### Phase 3 — Lighthouse gate locally

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-30 | Build | hosted-ref 0 of N; local origin 0; placeholder ≥ 1; subscribe 1; 18 HTML | exit 0; `check-hosted-ref: 0 files (of 153 scanned)`, N = 153; `0`; `1`; `1`; `18` | PASS |
| E-31 | Mirror headers | one log line; 6 × `200 csp=1 kind=public-local`; `/nope` 404; stub `200 0` | exactly that; 4173 free after | PASS |
| E-32 | LHCI | exit 0; 18 LHRs; mobile; medians ≥ thresholds; 37 report files; no public storage | exit 0; 18; 6 URLs × 3, all `mobile`/`true`; medians perf 0.94 (all pages), a11y 0.97 (`/`) / 1.00, BP 1.00, SEO **1.00**; 18 html + 18 json + `manifest.json` (18); `0`; 4173 free | PASS |
| E-33 | Report step | stdout table + blank + summary line; **stderr 0 bytes**; summary file | stdout exactly as specified (`/` 183.6, `/programmes/vce` 179.0, `/programmes/selective-entry` 180.4, `/resources` 180.0, guide 181.3, `/privacy` 179.0, blank line, `lighthouse-report: 18 runs, 0 supabase.co requests`); summary `1`; jq: 0 `network-requests` and 0 blocked `supabase.co` in all 18; medians match (bytes / 1024); all > 102,400, so no size gate (AC-6.8 holds). **stderr 56 bytes**: pnpm's own `$ node scripts/check-lighthouse-report.ts .lighthouseci` echo. The script itself, run with `node`, writes 0 bytes | **RULING** (PR-1) |
| E-34 | Report fails closed | (a)–(g) exact messages, exit 1 | all seven exact (S2 and D4 included), exit 1 each | PASS |
| E-35 | CSP sweep as CI | import rule 0; local leads URL; 19 passed; `.env` restored | `0`; line 33 `const LOCAL_LEADS_URL = 'http://127.0.0.1:55321/functions/v1/leads';`; `19 passed (30.3s)`, the 19 titles; `e2e/.env` back; 4173 free | PASS |

### Phase 4 — structured data

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-40 | Gate run | hosted-ref 0; exit 0; stdout exact; **stderr 0 bytes** | build 0; `0 files (of 153 scanned)`; exit 0; `check-structured-data: 18 pages, 0 problems`. The script's stderr (run with `node`) is 0 bytes; under `pnpm --filter` stderr holds only pnpm's `$ node scripts/check-structured-data.ts build/client` echo | **RULING** (PR-1) |
| E-41 | Cross-check | 11 pages × 1 block; types; URLs; no Review | exactly that (`E-41.txt`): home `EducationalOrganization+LocalBusiness, WebSite, FAQPage`; 9 × `Course, BreadcrumbList`; guide `Article, BreadcrumbList`; 7 others 0 blocks; problems `0` | PASS |
| E-42 | Unit tests | 2 files, 34 tests; 9 named titles | `Test Files 2 passed (2)`, `Tests 34 passed (34)`; each title ✓ once | PASS |
| E-43 | CLI invalid states | (a)–(n) exact | all 14 exact, including (f)/(g) `has a node of type Review…`, (k) `8 pages, 0 problems` + `no programme, guide page`, (l) `no home, programme, guide page`; exit 1 each | PASS |

### Phase 5 — runbook from a clean worktree

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-50 | Clean worktree | status 0; no `.env`/`node_modules` | `0`; `0`; "No such file or directory" | PASS |
| E-51 | Runbook E2E | page's commands only; 9 passed; dev-server cwd in `ci-check` | `pnpm install` 0, `pnpm db:start` 0 (running stack reported; edge-runtime mount still this worktree), `local-env` 0, `playwright install` 0, `9 passed (48.9s)`; cwd `…/item6-run/ci-check/apps/web`; 5173 free; no extra command | PASS |
| E-52 | Runbook Lighthouse | 5 commands; 0 files; LHCI 0; 0 `supabase.co`; 19 passed | all exit 0; `0 files (of 153 scanned)`; `18 runs, 0 supabase.co requests`; `19 passed`; 4173 free | PASS |
| E-53 | Runbook structured data | 3 commands; 0 files; 18 pages, 0 problems | all exit 0; exactly that | PASS |
| E-54 | Other docs; clean-up | README names `VITE_APP_ENV=production`; setup hint names an existing section; worktree removed | `1`, `1`; `1`, `1`; ci-check status `0`; remove `0`; list `0` | PASS |

### Phase 6 — the workflow under `act` (all green)

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-60 | Job list | 5 rows | 5 rows (`E-60-act-l.txt`) | PASS |
| E-61 | `web` ×3 (R3) | each 56/496, node:test 6/0, all steps ✅, succeeded | 3 of 3: `Test Files 56 passed (56)`, `Tests 496 passed (496)`, `ℹ pass 6`, `ℹ fail 0`, every step ✅, `Job succeeded`, exit 0, `ref 0`; wall 35 / 36 / 35 s | PASS |
| E-62 | `structured-data` | 0 files; 18 pages 0 problems; succeeded | exactly that; 17 s; `ref 0 hosts` none | PASS |
| E-63 | `lighthouse` | every step ✅ in order; 0 `supabase.co`; 19 passed; only `lighthouse-report`, 37 files | exactly that; artifact zip 37 files; no `csp-report`; 289 s (≤ 10 min); `ref 0 hosts` none | PASS |
| E-64 | Stack hand-off | containers 0; volume 0 | `0`; `0` | PASS |
| E-65 | `database` | 14 migrations fresh, last `20261026100000…`; seed; 14/507 PASS; succeeded; cleared after | `14`; `Applying migration 20261026100000_staff_phone_edit.sql...`; `Seeding data from supabase/seed.sql...`; `Files=14, Tests=507`; `Result: PASS`; both steps ✅; `Job succeeded`; 25 s; after `0`, `0` | PASS |
| E-66 | `e2e` | steps in order; 29 scanned; 9 passed; no upload; `Started` 1; keys 0; shapes 0; `***` ≥ 1; 14 migrations + seed; cleared | exactly that order; `0 files (of 29 scanned)`; `9 passed (52.6s)`; no `e2e-report`; `Started supabase…` `1`; each of the 3 key values `0`; shapes `0`; `***` `7`; `14`, last `…20261026100000_staff_phone_edit.sql...`, seed `1`; `Job succeeded`; 151 s (≤ 15 min); after `0`, `0` | PASS |

### Phase 7 — deliberate failures under `act`

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-70 | Broken spec | 1 failed, 8 passed; report + trace uploaded; no hosted URL in the network log; stack cleared | 1-line edit; `1 failed`, `8 passed (1.1m)`; `✘ 7 tests/our-approach.spec.ts:11:3 › Our Approach homepage section › renders all four steps, in order, each with one h3`, `Error: expect(locator).toHaveText(expected) failed`; `❌ Failure - Main E2E smoke (…)`; `Artifact e2e-report has been successfully uploaded!`; `Job failed`, exit 1. Zip: `index.html` 1, `trace.zip` 1, video/screenshot 2. Trace: ref `0`; network-log `supabase.co` URLs `0`. Cleared `0`, `0` | PASS |
| E-71 | Only E2E fails | database, web, structured data and Lighthouse green with the edit in place; restored | db `Files=14, Tests=507`, `Result: PASS`; web 56/496 + node 6; sd 18/0; lh `0 supabase.co`, `19 passed`; all `Job succeeded`, exit 0; restored, status `0`, HEAD equal | PASS |
| E-72 | Hosted-style URL (H2) | report step fails, `18 runs, 18 supabase.co requests`; nothing reaches the network | lines 120/121 edited (4 matches: 120, 121, 180, 181); build ✅, `0 files (of 153 scanned)`, LHCI ✅; `lighthouse-report: 18 runs, 18 supabase.co requests` (18 × `https://example.supabase.co/rest/v1/posts?select=id&limit=1`); `❌ Failure - Main No Supabase requests; JS size per page`; CSP sweep ran and **failed** `19 failed`, every violation `connect-src` on `https://example.supabase.co/rest/v1/posts…` (`E-72-csp-sweep.txt`); both artifacts uploaded; `Job failed`, exit 1; `ref 0`, hosts `example.supabase.co/` only. LHRs: `network-requests` `supabase.co` **0** in all 18; a blocked attempt in **18 of 18** runs. Restored, HEAD equal | PASS |
| E-73 | Threshold miss | LHCI fails; report and CSP still run; `grep -ac 'categories:performance failure'` = 6 | LHCI `❌ Failure`; `Checking assertions against 6 URL(s), 18 total run(s)`; 6 lines `✘ categories.performance failure for minScore assertion`; `Assertion failed. Exiting with status code 1.`; then `18 runs, 0 supabase.co requests` ✅ and `19 passed` ✅ (so `act` honours `!cancelled()`); `lighthouse-report` (37 files) and `csp-report` (K8) uploaded; `Job failed`, exit 1. **The plan's grep string (`categories:performance failure`, with a colon) counts `0`**: LHCI prints `categories.performance` with a dot | **RULING** (PR-2) |
| E-75 | Hosted-ref failure | hosted-ref fails; LHCI, report, CSP all skip; mirror never starts | line 117 edited; build ✅; `check-hosted-ref: 1 files in build/client contain the hosted project ref, e.g. zz-hosted-probe.js`, `1 files (of 154 scanned)`, `  build/client/zz-hosted-probe.js`; `❌ Failure - Main No hosted project reference in the build`; no line for Lighthouse, report, CSP sweep or Playwright's Chromium (all skipped; `act` prints nothing for skipped steps); `serve-mirror:` `0`; both uploads warned `No files were found…`, 0 artifact files; `Job failed`, exit 1 (19 s); `ref 0`; restored, HEAD equal | PASS |
| E-74 | History clean | the branch's commits only; 0 proof lines; clean; no stash | 23 commits, newest `e83b81e`, `1a85c28`, `815135d`, no proof commit; `0`; clean apart from the evidence folder; `0` | PASS |

### Phase 8 — close-out

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| E-80 | Stack restored | mount 1; `20261026100000`; snapshot diff empty | `db:start` 0; mount `1`; `20261026100000`; diff empty (profiles 6, posts 0, `e2e-%` 0; enquiries 0) | PASS |
| E-81 | Hosted totals | every `ref 0`; hosts only on `act-hosted`; logs `0`; attempts 0 outside H1–H3 | 15 `act` runs all `ref 0`; hosts only `act-hosted.txt` (`example.supabase.co/`); raw logs with the ref `0`; guard failures 0 in E-23, E-35, E-51, E-52, E-66, E-71; LHR `supabase.co` 0 except E-72 (CSP-blocked, 0 on the network); H1 (E-25) and H3 (E-29) aborted in the browser; E-26 and E-28 refused before any process started | PASS |
| E-82 | Hygiene | evidence key-free; no zips; ports 0; **no `act-` container**; clean; worktree count | key shapes `0` (`service_role` too); zips `0`; ports `0`; status: only `evidence-item-6/` and the uncommitted TSR and BUG-13; worktrees `3` (as before E-50). **`act-` containers: `2` at close-out** (the last Lighthouse and E2E smoke job containers, left running by `act`); removed with `docker rm -f`, then `0` | **RULING** (PR-3) |

## Results

- **Pass rate: 49 / 54 (90.7 %)** as frozen. FAIL 1 (E-18). RULING 4 cases, not counted as passed (E-33 and E-40 share PR-1; E-73 is PR-2; E-82 is PR-3). BLOCKED 0. Not run 0. If PR-1 to PR-3 are accepted, it's 53 / 54 (98.1 %), with BUG-13 open.
- **Defects:**
  - **BUG-13** (Low, docs): the runbook's "E2E smoke" section doesn't give the E2E job's `pnpm --filter aj-classes-e2e typecheck` step (AC-6.12, "the same commands CI uses"). Re-test: E-18.
- **Proposed rulings** (the plan measured the wrong thing; the behaviour is right):
  - **PR-1 (E-33, E-40):** "stderr `0` bytes" measured pnpm's own `$ node …` echo, which `pnpm --filter … run` writes to stderr. The CLIs themselves write 0 bytes to stderr on a pass (both run with `node`, 0 bytes). Stdout matched exactly in both. Proposed: pass on the script's own stderr, and change "stderr 0 bytes" to "stderr holds only pnpm's `$ node …` line".
  - **PR-2 (E-73):** the plan's count string `categories:performance failure` (review 6a finding 4) doesn't match LHCI 0.15.1's output, which is `✘  categories.performance failure for minScore assertion`. That line appears exactly **6** times, one per URL, as intended. The case marked LHCI's exact text as [measure]. Everything else in E-73 matched, including the review 5 #1 behaviour (report and CSP still run). Proposed: pass, with `categories.performance failure` as the recorded string.
  - **PR-3 (E-82):** `act` 0.2.89 leaves the last container of each job it ran (here Lighthouse and E2E smoke) running after the job ends. It isn't item 6 code. Nothing listened on the host's ports, and they were removed with `docker rm -f`. Proposed: pass after clean-up, plus a one-line follow-up in `ci-gates.md`'s `act` section (`docker ps -a --filter name=act- -q | xargs docker rm -f`). It could join the BUG-13 fix.
- **Measured baselines** (AC-6.6 to 6.8, recorded for later):
  - Lighthouse medians (local, Chrome 155): performance 0.94 on all six pages; accessibility 0.97 on `/`, 1.00 elsewhere; best practices 1.00; SEO 1.00.
  - JS per page: 179.0 to 183.6 KB (183,265 to 188,036 bytes). That's over the 102,400-byte budget, so the size gate stays in Later (AC-6.8).
  - `act` times (indicative, K4): web 35 s, structured data 17 s, database 25 s, E2E 151 s, Lighthouse 281–290 s.

## Not covered

1. **Post-merge on `develop` (plan §4; not counted in the pass rate)**, collected straight after the `develop` push (04b T6.14):
   - **P-01** real check names and green;
   - **P-02** three GitHub durations via `gh run rerun` (ask Saurabh first);
   - **P-03** 7-day artifact retention (`e2e-report` and `csp-report` only on a real failure);
   - **P-04** x86-64 runner with `--no-sandbox`;
   - **P-05** empty `VITE_*` overrides and CLI 2.120.0 on GitHub;
   - **P-06** masks on the GitHub log;
   - **P-07** the step summary table;
   - **P-08** the merge-commit body listing the five dev dependencies.
2. **R-01** Rich Results Test and Schema Markup Validator on the live site, after the next production release (AC-6.11).
3. **O1 (the `web` flake) on GitHub.** The R3 fix (`setupUser()`, `delay: null`) was green 3 of 3 under `act` (E-61), plus 2 more `web` runs (E-71) and the local full check. It closes when P-01 and P-02's three `web` attempts are green.
4. **Deferred security findings** (06-security): **S1** actions pinned to major tags, not SHAs; **S5** dev-dependency advisories under `@lhci/cli`; **S6** fork PRs run CI on a public repo (Saurabh's GitHub setting).
5. **Other path-B limits:**
   - `act` ran arm64 images (K2), not GitHub's x86-64;
   - there was no host-level network capture of the `act` containers (the measures are the guard, the LHRs, `check-hosted-ref` and the log greps);
   - the CSP sweep and Lighthouse ran on Chromium/Chrome only;
   - there's no ESLint over `e2e/` (review 5 #4 follow-up);
   - required status checks are Saurabh's optional setting (Q30).

## Verdict

**NOT APPROVED yet.** The frozen pass rate is 49 / 54. One real defect, BUG-13 (Low, docs), needs a Developer fix and an E-18 re-test. Three proposed rulings (PR-1 to PR-3) are waiting on the team lead. With the rulings accepted and BUG-13 fixed and re-tested, this would be 54 / 54. No case found a hosted request, a key in the evidence, or a code fault in the gates.

## Team lead rulings on round 1 (26 Oct 2026)
- **PR-1 (E-33, E-40): accepted.** The intent is that the scripts themselves write nothing to stderr; run directly with `node` they write 0 bytes. The only stderr is pnpm's own `$ node …` echo. Counted as PASS in round 2 if it repeats exactly.
- **PR-2 (E-73): accepted.** The behaviour was measured: LHCI failed, the report and the CSP sweep still ran. Only the grep string was wrong; LHCI 0.15.1 prints `✘  categories.performance failure for minScore assertion` (6 times). Round 2 uses that string.
- **PR-3 (E-82): rejected; FAIL.** The case's intent is that following the runbook leaves the machine clean, and it didn't until a manual `docker rm -f`. Filed as **BUG-14** (Low, docs).
- **Fixes:** BUG-13 and BUG-14 fixed in `docs/testing/ci-gates.md` (team lead acting as Developer; docs-only). Round 2 re-runs every case.

## Round 2

- Date: 2026-10-26 · Branch: `feature/ci-quality-gates` @ **`58600f2`**, which descends from the freeze commit `e83b81e`. The code equals `815135d` (`git diff --quiet 815135d HEAD -- apps e2e .github package.json pnpm-lock.yaml pnpm-workspace.yaml supabase README.md` exits 0). The only change since round 1 is `docs/testing/ci-gates.md` (`1ea4405`, the BUG-13 and BUG-14 fixes).
- Scope: **all 54 frozen cases re-run**, not just the failed ones. Two round-1 rulings apply:
  - **PR-1:** E-33 and E-40 pass if the script's own stderr (run with `node`) is 0 bytes and the only stderr under `pnpm --filter` is pnpm's `$ node …` echo;
  - **PR-2:** E-73 counts LHCI's `categories.performance failure for minScore assertion`.

  Nothing else was weakened.
- Regression checks for the bugs:
  - **BUG-13 (E-18):** the "E2E smoke" section now holds `pnpm --filter aj-classes-e2e typecheck` (1), before `pnpm db:start` (section lines 9 and 13). E-51 ran it as written: exit 0.
  - **BUG-14 (E-82):** after the `act` runs, I followed the runbook's new clean-up line `docker ps -aq --filter name=act- | xargs docker rm -f`. `act-` containers went from 2 to **0**.
- Environment: as round 1. The stack was reset from this worktree (mount `1`, `20261026100000`), rebuilt fresh by the `act` cases, and restarted at E-80. Every `pnpm db:start` / `supabase start` / `supabase stop` output went to files in the scratchpad, not to the console.
- Full check (E-10) → **PASS**, every step exit 0:
  - format, lint (0 problems), typecheck (web and e2e), build, `check-hosted-ref: 0 files (of 153 scanned)`;
  - Vitest **56 files, 496 tests**; `node:test` **6 tests, 2 suites, 6 pass, 0 fail**;
  - `db:test` **`Files=14, Tests=507`, `Result: PASS`**; `test:functions` **169 `ok`, 0 `not ok`**;
  - E2E smoke **9 passed** (43.5 s).
- Evidence:
  - committed: `evidence-item-6/`, round-2 files suffixed `-r2` (39 files, including `round2-p*-r2.txt` per phase). The key-shape grep (`eyJ…`, `sb_secret_`, `sb_publishable_`, `service_role`) finds nothing; no zips;
  - kept out of git: raw logs, artifacts and traces, in the scratchpad `item6-run-2/`.

| ID | Case | Round 2 result (measured) | Result |
|----|------|------|--------|
| E-01 | Build, shell, tools | `58600f2`; ancestor of `815135d` `0`; code diff `0`; only `docs/testing/ci-gates.md` changed; status clean; local URL; key `equal`; no override names; ports `0`; act 0.2.89, image 1, CLI 2.120.0, v24.15.0, 11.1.2; external `488dde1`, `0` | PASS |
| E-02 | Stack and snapshot | reset 0; mount 1; `20261026100000` ×2; profiles 6, posts 0, enquiries 0, `e2e-%` 0 | PASS |
| E-03 | `.env.deploy`; banned commands; nothing pushed | `git check-ignore` 0; no banned command in the session; `no upstream configured` | PASS |
| E-10 | Full check | as above | PASS |
| E-11 | Scope | 54 files (7 root, 2 + 14 + 3 web, 28 e2e); the 3 test-only `apps/web/src` files; config `0`; root `package.json` 4 changed lines (`typecheck`, `test`) | PASS |
| E-12 | Moved suite | `14 same` | PASS |
| E-13 | Workflow shape | 5 jobs; `push: [main, develop]` + `pull_request:`; 15 20 15 10 10; needs `0`; `if:` at 95, 144, 147, 149, 155; `id: hosted-ref` line 127; `contents: read`, 1; retention 102, 154, 162 | PASS |
| E-14 | Workflow safety | `0`, `0`; `check-hosted-ref: 0 files (of 30 scanned)`, exit 0; 29 tracked; job env lines 12/30/32; 3 env files; 3 placeholders; ignored `0`; keys `0`, history `0` | PASS |
| E-15 | Lighthouse config | identical to round 1 (mobile, 6 URLs, 3 runs, 0.9/0.9/0.9/1 median, filesystem; `minScore` only lines 19–22; `0`; `0`; `false`) | PASS |
| E-16 | Dev deps | `d` null, the 7 `dd`; web deps `0`; only `"@lhci/cli": "0.15.1"` added; `5` reason rows | PASS |
| E-17 | Code rules | `0` | PASS |
| E-18 | Docs (static) + **BUG-13 regression** | 5 sections; every gate command present, now including `aj-classes-e2e typecheck` (1, before `pnpm db:start`); README 1, arch 5, Preconditions 1, ADR amendment 1; `act` steps (`--no-backup` before and after, `pnpm db:stop` only as "don't use it here", clean-up line 203); `pnpm install`, `signing_keys_path`, anchor, `test:unit` all `1` | PASS |
| E-19 | `local-hosts` tests | exit 0; `ℹ tests 6`, `ℹ suites 2`, `ℹ pass 6`, `ℹ fail 0`; no imports; used by config and global setup; 2 describe, 6 it | PASS |
| E-20 | `local-env.mjs` | exit 0; 23 lines; placeholders 0; stderr 0; 3 × `equal`; CI mode 3 masks on stderr, stdout `::` 0, `same` | PASS |
| E-21 | Refusals | 3 exact messages, exit 1, stdout 0 | PASS |
| E-22 | Config guard | 5 exact refusals, exit 1 each, 5173 `0` | PASS |
| E-23 | Smoke | `9 passed (43.5s)`, the 9 titles; 5173 free; rows 0/0/0; status 0 | PASS |
| E-24 | Journeys (R1) | 19/10/4/0/0; mock 2; 5 guarded; `auto: true` 1; `playwright test` | PASS |
| E-25 | Guard proof (H1) | `1 failed`, `Error: requests to a hosted Supabase project` with the URL; trace network `status -1`, `net::ERR_FAILED`; restored; HEAD equal | PASS |
| E-26 | Hosted URL refused | exit 1, exact message 1, 5173 0, no start warning, no results; FUNCTIONS_URL leg the same | PASS |
| E-27 | External suite | shell and 5173 process: only `VITE_SUPABASE_URL=http://127.0.0.1:55321`; `9 passed (1.6m)`, same titles as E-23; rows 0; external repo 0 | PASS |
| E-28 | Unset URL refused | blank and space: exact message, exit 1, 5173 0 | PASS |
| E-29 | Warm-up guard (H3) | exit 1; the exact `[global-setup] … (https://example.supabase.co/rest/v1/posts?select=id&limit=1); stop it and re-run with the local settings.`; no results; dev log `supabase.co` 0; 5173 freed | PASS |
| E-30 | LH build | `0 files (of 153 scanned)`; N 153; local 0; placeholder 1; subscribe 1; 18 HTML | PASS |
| E-31 | Mirror headers | `serve-mirror: http://127.0.0.1:4173 (Supabase http://127.0.0.1:55321)`; 6 × `200 csp=1 kind=public-local`; `/nope 404 csp=1 kind=public-local`; stub `200 0`; 4173 freed | PASS |
| E-32 | LHCI | exit 0; 18 LHRs; 6 × 3, mobile/true; medians perf 0.94, a11y 0.97 (`/`) / 1, BP 1, SEO 1; Chrome 155; 18 + 18 + manifest (18); public storage 0 | PASS |
| E-33 | Report step (PR-1) | stdout exact (table 183.6 / 179.0 / 180.4 / 180.0 / 181.3 / 179.0, blank line, `18 runs, 0 supabase.co requests`); pnpm stderr only `$ node scripts/check-lighthouse-report.ts .lighthouseci`; `node` stderr 0; summary 1; LHRs `supabase.co` 0; no run ≤ 102,400 bytes | PASS |
| E-34 | Report fails closed | (a)–(g) exact, exit 1 each | PASS |
| E-35 | CSP sweep as CI | import rule 0; `LOCAL_LEADS_URL` line 33; `19 passed (29.9s)`; `.env` restored; 4173 freed | PASS |
| E-40 | SD gate run (PR-1) | `0 files (of 153 scanned)`; exit 0; `check-structured-data: 18 pages, 0 problems`; pnpm stderr only `$ node scripts/check-structured-data.ts build/client`; `node` stderr 0 | PASS |
| E-41 | Cross-check | 11 pages × 1 block; home / 9 programmes / guide types as expected; problems 0 | PASS |
| E-42 | Unit tests | 2 files, 34 tests; the 9 named titles ✓ | PASS |
| E-43 | CLI invalid states | (a)–(n) identical to round 1, all exact, exit 1 | PASS |
| E-50 | Clean worktree | add 0; status 0; no `.env`/`node_modules` | PASS |
| E-51 | Runbook E2E (+ BUG-13 step) | the page's 7 commands, in order: `pnpm install`, **`pnpm --filter aj-classes-e2e typecheck`**, `pnpm db:start` (output to a file), `local-env`, `playwright install chromium`, `test:smoke`, `lsof … \| xargs kill`; all exit 0; `9 passed (49.5s)`; dev-server cwd `ci-check/apps/web`; 5173 free | PASS |
| E-52 | Runbook Lighthouse | 5 commands exit 0; `0 files`; `18 runs, 0 supabase.co requests`; `19 passed`; 4173 free | PASS |
| E-53 | Runbook SD | 3 commands exit 0; `0 files`; `18 pages, 0 problems` | PASS |
| E-54 | Docs claims; clean-up | 1/1/1/1; ci-check status 0; removed; worktrees back to 3; edge-runtime mount still this worktree | PASS |
| E-60 | Job list | 5 rows | PASS |
| E-61 | `web` ×3 (R3) | 3 of 3 `56 passed (56)`, `496 passed (496)`, `pass 6`/`fail 0`, all 9 steps ✅, succeeded; 37 / 33 / 34 s | PASS |
| E-62 | `structured-data` | `0 files (of 153 scanned)`; `18 pages, 0 problems`; succeeded; 19 s; ref 0 | PASS |
| E-63 | `lighthouse` | every step ✅ in order; `18 runs, 0 supabase.co requests`; `19 passed`; only `lighthouse-report` (37 files); 285 s; ref 0 | PASS |
| E-64 | Stack hand-off | containers 0; volume 0 | PASS |
| E-65 | `database` | 14 migrations, last `20261026100000_staff_phone_edit.sql...`; seed; `Files=14, Tests=507`; `Result: PASS`; succeeded; cleared 0/0 | PASS |
| E-66 | `e2e` | steps in order, `0 files (of 29 scanned)`, `9 passed (56.0s)`; succeeded; 210 s; `Started` 1; 3 key values 0; shapes 0; `***` 7; 14 migrations + seed 1; no artifact; cleared 0/0 | PASS |
| E-70 | Broken spec | `1 failed` / `8 passed`; `✘ 7 … renders all four steps, in order, each with one h3`, `Error: expect(locator).toHaveText(expected) failed`; `❌ Failure - Main E2E smoke (…)`; `e2e-report` uploaded; index 1, trace 1, media 2; trace ref 0, network `supabase.co` 0; cleared 0/0 | PASS |
| E-71 | Only E2E fails | database (fresh 14, `507`, PASS), web (56/496, node 6), SD (18/0), Lighthouse (0 `supabase.co`, 19 passed): all succeeded; restored; HEAD equal | PASS |
| E-72 | Hosted-style URL (H2) | lines 120, 121 (of 120/121/180/181) edited; `0 files`; LHCI ✅; `18 runs, 18 supabase.co requests` (18 × `…/rest/v1/posts?select=id&limit=1`); `❌` report; CSP sweep `19 failed`, all `connect-src`; both artifacts; job failed; hosts `example.supabase.co/` only; LHRs `network-requests` `supabase.co` **0**, blocked attempt in 18 of 18; restored | PASS |
| E-73 | Threshold miss (PR-2) | LHCI `❌`; `Checking assertions against 6 URL(s), 18 total run(s)`; `✘  categories.performance failure for minScore assertion` **6** (counted on the ANSI-stripped log, as `actjob` writes it); `Assertion failed. Exiting with status code 1.`; report ✅ `0 supabase.co`; CSP ✅ `19 passed`; `lighthouse-report` (37) + `csp-report`; job failed; restored | PASS |
| E-75 | Hosted-ref failure | `1 files in build/client contain the hosted project ref, e.g. zz-hosted-probe.js`; `1 files (of 154 scanned)`; `❌` hosted-ref; later steps 0 lines; mirror 0; both uploads "No files were found…", 0 artifact files; job failed (19 s); ref 0; restored | PASS |
| E-74 | History clean | 25 commits, newest `58600f2`, `1ea4405`, `e83b81e`; no proof commit; proof-pattern lines 0; clean; stash 0 | PASS |
| E-80 | Stack restored | `db:start` 0 (output to file); mount 1; `20261026100000`; snapshot diff empty (profiles 6, posts 0, enquiries 0, `e2e-%` 0) | PASS |
| E-81 | Hosted totals | 15 round-2 `act` runs all `ref 0`; hosts only `act-hosted-r2.txt` (`example.supabase.co/`); raw logs with the ref 0; guard attempts 0 outside H1/H2/H3 (all aborted or CSP-blocked) | PASS |
| E-82 | Hygiene + **BUG-14 regression** | evidence key shapes 0; zips 0; ports 0; **`act-` containers 2 → 0 after the runbook's clean-up line**; status only evidence and this TSR; worktrees 3 | PASS |

### Round 2 results

- **Pass rate: 54 / 54 (100 %).** FAIL 0, BLOCKED 0, not run 0. The full check is green.
- **BUG-13: verified fixed** (E-18 and E-51). **BUG-14: verified fixed** (E-82, following the runbook line).
- No hosted request, no hosted ref in any build, log or artifact, and no key in the committed evidence.
- "Not covered" is unchanged from round 1: post-merge P-01 to P-08, R-01, O1 on GitHub, S1/S5/S6 deferred, and the other path-B limits.

## Verdict (round 2)

**APPROVED (auto).** 54 / 54 on the frozen plan, with the round-1 rulings PR-1 and PR-2 applied as stated. The full check is green, and BUG-13 and BUG-14 are verified fixed. Next is `/test-and-ship`'s merge to `develop`. Straight after the push come the post-merge cases P-01 to P-08 (ask Saurabh before P-02's `gh run rerun`).
