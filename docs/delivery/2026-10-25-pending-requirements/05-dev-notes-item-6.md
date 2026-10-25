# 05 — Developer notes: item 6 (CI quality gates: E2E smoke, Lighthouse, structured data)

> **Stage:** 5 of /deliver (Developer) · **Date:** 26 Oct 2026 · **Branch:** `feature/ci-quality-gates`
> (worktree `aj_classes-items-4-9`, cut from `develop` @ `84124be`, after items 4 and 5 merged)
> **Input:** [01b](01b-requirement-items-4-9.md) item 6 (AC-6.1–6.14), [02b](02b-architecture-items-4-8.md) §6,
> [ADR-0006](../../decisions/0006-ci-gates-e2e-in-repo.md), [03b](03b-design-items-4-8.md) §0 and §6,
> [04b](04b-plan-items-4-8.md) §0 and T6.0–T6.14, [05-dev-notes-item-5](05-dev-notes-item-5.md) §8.
> **Path taken: B (local `act`).** Q28 is unanswered, so nothing was pushed and no PR was opened.
> **Next:** T6.11 Reviewer (`review-5-item-6.md`), then T6.12 test plan, T6.13 Security and
> T6.14 `/test-and-ship`. Nothing is pushed or merged.

Everything ran against the **local** stack only (`http://127.0.0.1:55321`), or against builds with
no Supabase config. Nothing touched the hosted project. I didn't read `supabase/.env.deploy`, and I
didn't run `link`, `db push` or `deploy`. The local repo `~/dev/work/aj_classes-e2e` was only read
(its tracked files are unchanged at `488dde1`); its own test run writes to its gitignored
`test-results/`. No CLI key is committed: `e2e/.env` is gitignored and generated from
`supabase status`.

## 1. Tasks done

| Task | Status | Evidence |
|---|---|---|
| T6.0 Branch and stack | Done | Branch already cut at `84124be`. Check 1 printed `1`, check 2 printed `20261026100000`. `pnpm db:reset` |
| T6.1 Move the suite in | Done | `git archive 488dde1 …` gave 20 files. `pnpm install`, `typecheck` and `format:check` pass; `git status` shows no `.env`. The demo JWTs in the old `.env.example` were replaced by `<from supabase status>` placeholders before the first commit, so they're in no commit |
| T6.2 Local env and hosted guard | Done | `local-env.mjs` prints the settings plus 3 keys; a fake `supabase` on `PATH` returning `https://x.supabase.co` → "refusing", exit 1; CLI failing → exit 1. With `GITHUB_ACTIONS=true` 3 `::add-mask::` lines go to stderr, 0 to stdout. `test:smoke`: **9 passed**. Guard proof: an uncommitted `fetch('https://example.supabase.co/…')` in a spec fails it with "requests to a hosted Supabase project", trace kept; restored |
| T6.3 CSP sweep | Done | Import-rule grep (04b T6.3 test 1): nothing found. No-Supabase build with the placeholders → `check:hosted-ref` `0 files (of 153 scanned)`. `env -u SUPABASE_ANON_KEY -u SUPABASE_SERVICE_ROLE_KEY … test:csp`: **19 passed** (9 pages × 2 widths + the AC-5.8 negative test). Mutation: Kit removed from the mirror's `connect-src` → the sweep fails; restored |
| T6.4 Lighthouse | Done | `lighthouse-report.test.ts` 8 tests. `pnpm --filter web lighthouse` passes every assertion (scores in §4). `startServerReadyPattern` confirmed: `serve` prints ` INFO  Accepting connections at http://127.0.0.1:4173` |
| T6.5 Structured data | Done | `structured-data.test.ts` 23 tests. Real build: `check-structured-data: 18 pages, 0 problems`, exit 0. An empty folder exits 1. Mutation: the URL rule made always-true → 2 tests fail; restored |
| T6.6 Workflow | Done (path B) | `check:hosted-ref ../../.github/workflows ../../e2e` → `0 files`. `act -l` lists the 5 jobs. All 5 green under `act` (§3) |
| T6.7 Proof runs | Done (path B) | Broken spec and hosted-URL proofs both fail where they should (§3.2). The second proof found a gap, now fixed (D4). Durations in §3.1 (indicative only). JS size decision in §4 |
| T6.8 Docs | Done | `docs/testing/ci-gates.md` (new), README "Checks", `arch.md` §2 and its diagram. Followed from a clean `git worktree add --detach … HEAD` at `69a8f70`: E2E 9 passed, Lighthouse assertions passed with 0 `supabase.co`, CSP 19 passed, structured data 0 problems; the worktree's `git status` stayed clean; worktree removed |
| T6.9 Full check | Done | §2 |
| T6.10 Dev notes | Done | This file |
| T6.11–T6.14 | **Not started** | Reviewer, test plan, Security, `/test-and-ship` |

I didn't tick 04b. The Manager owns that file while this stage runs.

## 2. Commits and full check

Commits (oldest first), all staged by name:

1. `81caa8c` test(e2e): move the Playwright suite into an e2e workspace
2. `4b98ab9` test(e2e): read local keys from supabase status and guard against hosted requests
3. `7297b8d` test(e2e): automate the public CSP sweep on the local mirror
4. `433e5f8` build(web): add the Lighthouse CI budget and its report step
5. `1812c8d` test(web): check the pre-rendered JSON-LD offline
6. `4693f7f` ci: add the E2E smoke, Lighthouse and structured-data gates
7. `3e57c91` fix(web): count supabase.co requests the mirror's CSP blocked
8. `69a8f70` docs: how to run the CI quality gates locally
9. This file (docs commit).

Before this file, the branch touches 49 files, and every one is in 03b §6.1's list. Rows 12–25
(the moved files) and 32 (the 8 fixtures) expand to one file each. No deliberate-failure edit was
ever committed:
`git log develop..HEAD` has only the commits above.

Full check, from the repo root, with the 04b §0 exports where a step needs them:

| Step | Result |
|---|---|
| `format:check`, `lint`, `typecheck` | Pass |
| `test` | **56 files, 493 tests** (54 / 462 after item 5; +2 files, +31 tests: 8 Lighthouse report, 23 structured data) |
| `VITE_APP_ENV=production pnpm build` (local exports) | Pass |
| `check:hosted-ref build/client` | **`0 files (of 153 scanned)`**; old grep also 0 |
| `db:test` (after `db:reset`) | **14 files, 507 tests, PASS** |
| `test:functions` | **169 `ok`, 0 `not ok`** |
| E2E, **in-repo** (`node e2e/scripts/local-env.mjs > e2e/.env && pnpm --filter aj-classes-e2e test:smoke`) | **9 passed** (1.8 min) |
| E2E, **external repo** (04b §0 command, with the §0 exports) | **9 passed** (1.6 min). See O3 |
| No-Supabase build → `check:hosted-ref`, `test:csp`, `check:structured-data` | `0 files`; **19 passed**; **18 pages, 0 problems** |
| `lighthouse` + `lighthouse:report` | All assertions pass; **18 runs, 0 `supabase.co` requests** |

The dev server on 5173 and the mirror on 4173 were stopped after each run.

`kinet validate` couldn't run ("KINET not initialised"), and I didn't run `kinet init`. Instead I
grepped the 28 changed `.ts`/`.mjs` files for `console.log`, `console.debug`, `TODO`, `: any`,
`style={{`, `innerHTML`, `querySelector` and `getElementById`: 0 hits. A grep of every changed file
for JWT-shaped strings, `sb_secret_`, `sb_publishable_<key>` and the hosted ref: 0 hits (the one
file it lists, `arch.md`, has the hosted ref in existing text, not in this diff).

## 3. `act` (path B)

`act` 0.2.89 (`brew install act`, a laptop tool, not in `package.json`), image
`catthehacker/ubuntu:act-latest` (the medium image, arm64, about 540 MB). Command per job:

```bash
act pull_request -j <job> -P ubuntu-latest=catthehacker/ubuntu:act-latest --artifact-server-path "$ART" --env pnpm_config_store_dir=/root/.local/share/pnpm/store
```

`$ART` and the logs were in the session scratchpad, not the repo. The `--env` is an `act`-only
fix (D12). Before `database` and `e2e` I ran `supabase stop --no-backup` (D13), and after them the
same again to clear what the job left. Then `pnpm db:start` and the §0 checks: mount `1`, newest
migration `20261026100000`.

### 3.1 Results (all on the working tree at the commit named)

| Job | Result | `act` wall time | Notes |
|---|---|---|---|
| `web` | **Pass**, 4 runs: 3 pass, 1 fail (O1) | 40–56 s | 56 files pass; build OK |
| `database` | **Pass** | 29 s | CLI `2.120.0` from `setup-cli`; 14 migrations applied fresh; **14 files, 507 tests, PASS** |
| `e2e` (E2E smoke) | **Pass** | 3 min 40 s | hosted-ref step `0 files (of 27 scanned)`; `supabase start -x …` 28 s; Playwright install 47 s; **9 passed** in 1.9 min. Keys show as `***` from the `local-env` step on |
| `lighthouse` | **Pass** (twice: `4693f7f`, and on `69a8f70` after the D4 fix) | 4 min 37 s / 4 min 50 s | Build, `0 files`, Playwright's Chromium 156, LHCI 18 runs (3 min), **0 `supabase.co`**, CSP **19 passed**, `lighthouse-report` artifact uploaded |
| `structured-data` | **Pass** | 56 s | `0 files (of 153 scanned)`; **18 pages, 0 problems** |

These times are **indicative only**: a 15-core M-series laptop with warm images and caches. The
3 GitHub-hosted runs required by AC-6.4 come from the first `develop` push (§6).

### 3.2 Proof runs (T6.7), uncommitted edits undone with `git restore`

1. **Broken spec** (AC-6.1, AC-6.5): `our-approach.spec.ts` step 1 expected "Assessment
   (deliberately wrong)". `act … -j e2e` failed: **1 failed, 8 passed**, "Failure - Main E2E
   smoke", job failed. `$ART/1/e2e-report/e2e-report.zip` holds `playwright-report/index.html`,
   the report's trace viewer, and `test-results/…/trace.zip`, `video.webm` and
   `test-failed-1.png`. `git restore e2e/tests/our-approach.spec.ts`; `git status` clean.
2. **Hosted-style URL** (AC-6.14): the Lighthouse build env in `ci.yml` set to
   `VITE_SUPABASE_URL: https://example.supabase.co` and `VITE_SUPABASE_PUBLISHABLE_KEY:
   proof-placeholder` (D6). `act … -j lighthouse`: build, hosted-ref (`0 files`, as expected: it's
   not the hosted ref) and LHCI passed; **"Failure - Main No Supabase requests; JS size per page"**,
   with `18 runs, 18 supabase.co requests`, then the artifact steps ran and the job failed.
   `git restore .github/workflows/ci.yml`; `git status` clean.
   - The first version of this proof, run by hand, **passed the report step**. That's how D4 was
     found and fixed before the `act` run.

## 4. Lighthouse baseline and the JS size decision (AC-6.6–6.8)

Median of 3 mobile runs per page, on the no-Supabase build served by the mirror:

| Page | Perf | A11y | Best Pr. | SEO | JS (KB, gzipped, median) |
|---|---|---|---|---|---|
| `/` | 94 (95 in `act`) | 97 | 100 | 100 | 183.6 |
| `/programmes/vce` | 94 (95) | 100 | 100 | 100 | 179.0 |
| `/programmes/selective-entry` | 94 (95) | 100 | 100 | 100 | 180.4 |
| `/resources` | 94 (95) | 100 | 100 | 100 | 180.0 |
| `/resources/victorian-selective-entry-exam` | 94 (95) | 100 | 100 | 100 | 181.3 |
| `/privacy` | 94 (95) | 100 | 100 | 100 | 179.0 |

- Laptop runs used the installed Chrome 155; `act` used Playwright's Chromium 156.
- Every page meets the thresholds, so nothing needed fixing (AC-6.7). The thresholds are in
  `apps/web/lighthouserc.json` only: 0.9 / 0.9 / 0.9 / 1.
- **JS size gate: not added.** Every page is about 179–184 KB, over the 100 KB (102,400 bytes)
  budget. So per AC-6.8 and 03b §6.6, v1 records the baseline here, and the size gate goes to
  **Later**, with the MUI chunk split. The figure is a gzipped transfer: the mirror's `serve`
  sends `Content-Encoding: gzip`. No commented-out assertion is committed.

## 5. New dev dependencies (AC-6.13, KINET dependency-approval)

All dev-only, pinned exactly, each published at least two weeks before 26 Oct 2026. Added with
`pnpm --filter <workspace> add -D --save-exact`, lockfile committed.

| Package | Version (published) | Workspace | Why |
|---|---|---|---|
| `@playwright/test` | 1.64.0 (7 Oct 2026) | `e2e` | Runs the E2E smoke and CSP sweep in a real browser; the suite was already written for it |
| `pg` | 8.23.1 (30 Sep 2026) | `e2e` | Lets each spec assert the database row directly (the suite's dual-surface rule) |
| `@types/pg` | 8.23.1 (17 Aug 2026) | `e2e` | Types for `pg`, so `e2e` typechecks |
| `dotenv` | 18.0.7 (9 Oct 2026) | `e2e` | Loads the gitignored `e2e/.env` that `local-env.mjs` writes, for local runs |
| `@lhci/cli` | 0.15.1 (25 Jun 2025, the newest release) | `apps/web` | Runs Lighthouse 3× per page and enforces the committed thresholds in CI |

`@supabase/supabase-js` (`^2.117.2`), `typescript` (`^6.0.3`) and `@types/node` (`^26.6.3`) are
declared in `e2e` at `apps/web`'s ranges, so the lockfile has one version of each, and nothing
new is downloaded for them (review-3b finding 10). Newer versions were skipped on purpose:
`@playwright/test` 1.64.1 (14 Oct) and `dotenv` 18.0.9 (22 Oct) are less than two weeks old.

`pnpm audit` (for Security, T6.13): `@lhci/cli`'s tree brings advisories, 5 of them high:
`basic-ftp`, `compression`, `extract-zip`, `tmp`, `zod`; plus moderate `uuid`. 0.15.1 is LHCI's
newest release, so no upgrade is available. It's dev-only. It runs in the Lighthouse job, which
has no secret and `contents: read`, and it only opens this job's own local pages. The other
advisories in the audit come from existing dependencies (`vite`, `vitest`, `jsdom`, `serve`).

## 6. Not covered until the first `develop` run

Path B can't produce these. `TSR-item-6.md` should list them under "Not covered", and T6.14
collects them straight after the push:

1. The check names as GitHub shows them ("web", "database", "E2E smoke", "Lighthouse",
   "Structured data") on a real run, all green (AC-6.1).
2. The real GitHub run logs, including `::add-mask::` on the hosted runner (`act` honoured it:
   `***`).
3. **Three GitHub durations** (AC-6.4): E2E ≤ 15 min, Lighthouse and structured data ≤ 10 min,
   workflow ≤ 20 min, via `gh run rerun`. If E2E goes over, add
   `--grep-invert "Invite onboarding"` to `test:smoke` (03b §6.8). See O5 on the Lighthouse limit.
4. **7-day artifact retention** (AC-6.5): a GitHub setting. `act` doesn't apply it. A failing run
   on GitHub is needed to see it, and none is planned on `develop`, so it may stay "Not covered"
   until a real failure happens.
5. **x86-64 runners.** `act` ran arm64 images. GitHub's `ubuntu-latest` is x86-64 Ubuntu 24.04.
   The Chrome-for-Testing sandbox flag (D5) is aimed at that runner and is proven only there.
6. The `supabase/setup-cli@v1` download of 2.120.0 on GitHub (`act` downloaded the same version).

## 7. Deviations and `[ASSUMPTION]`s

- **Q30 deviation (T6.10). Required checks on `main` only.** 03b §6.11 says to make the five
  checks required on `develop` and `main`. Q30 recommends `main` only, because `/test-and-ship`
  pushes merge commits straight to `develop`, and a required check there would block that push.
  This is Saurabh's optional GitHub-settings step after the merge (04b §8.3 step 2). Nothing in
  this branch depends on it.
- **D1. The mirror is addressed as `http://127.0.0.1:4173`,** not `localhost:4173`, in
  `lighthouserc.json` and `playwright.csp.config.ts`. Item 5's S3 fix makes the mirror listen on
  `127.0.0.1` only, and `localhost` can resolve to `::1` first.
- **D2. The E2E job env adds `VITE_FORM_ACCESS_KEY: local-placeholder`.** 03b §6.8 omits it, but
  without it Register Interest fails, because CI has no `.env.local` (04b §0 notes the same for
  local runs). It's a placeholder; Web3Forms is always mocked.
- **D3. `e2e/.env.example` holds the dev server's `VITE_*` values** (local URL, Turnstile test
  key, form placeholder, `VITE_LEAD_CAPTURE=on`). So `local-env.mjs` puts them in `e2e/.env`, and
  the dev server that global setup starts gets them on a laptop too. AC-6.3 still holds: in CI
  `VITE_LEAD_CAPTURE=on` is set as job env, and no app env file changes. In CI `local-env.mjs`
  also writes the same values to `$GITHUB_ENV`. They're identical, so it's harmless.
- **D4. `lighthouse-report` also counts CSP-blocked attempts.** 03b §6.6 reads only the
  `network-requests` audit. But the mirror's CSP names only the local origin, so Chrome blocks a
  request to any `supabase.co` host before it reaches the network, and Lighthouse never lists it.
  That includes a build pointed at the hosted origin, which the mirror's CSP no longer allows.
  The report now also reads the blocked URLs in `inspector-issues`, de-duplicated. 2 new tests
  cover it. Commit `3e57c91`.
- **D5. Lighthouse in CI uses Playwright's Chromium,** through `CHROME_PATH`, with
  `--collect.settings.chromeFlags=--no-sandbox` on the command line. This means one browser,
  pinned by the Playwright version, for both Lighthouse and the CSP sweep, instead of the
  runner's Chrome, which updates under us. Chrome for Testing has no usable sandbox on Ubuntu
  24.04 runners, or as root in `act`. The flag isn't in `lighthouserc.json`, so laptop runs keep
  the sandbox. It only ever opens the job's own local build. Because of this, Playwright is
  installed before LHCI, not after.
- **D6. The hosted-URL proof sets the publishable key too.** 04b T6.7 sets only
  `VITE_SUPABASE_URL`. But public pages only call Supabase when the URL **and** the key are set
  (`hasPublicSupabaseConfig`), so a URL alone makes no request and proves nothing.
- **D7. The Lighthouse job also uploads a `csp-report` artifact on failure** (the CSP sweep's
  report and traces, 7 days). 03b uploads only `lighthouse-report`.
- **D8. Structured data:**
  - When a block doesn't parse, the page reports only that. The "missing type" errors that would
    follow are noise. This also keeps AC-6.10's "exactly one problem" for `broken-json.html`.
  - Fixtures are small HTML files wrapping the real build's JSON-LD blocks, not whole built pages.
  - `.prettierignore` has `apps/web/scripts/fixtures/`, because Prettier would rewrite the JSON
    and can't parse the broken one.
  - Extra unit cases beyond 03b: a `review` property, a non-`https` `sameAs`, a question with no
    answer, the wrong page type, and a home page with no JSON-LD.
- **D9. `lighthouse-report.ts` is the pure module and the CLI in one file**, as 03b row 28 names
  it. The CLI part runs only under `import.meta.main`, so the tests import it without side
  effects. It also exports `summaryTable`. The CLI exits 1 on a folder with no `lhr-*.json`.
- **D10. `e2e/src/config.ts` loads `e2e/.env` by absolute path,** with `quiet: true`, so the
  suite works from any working directory. A relative `AJ_CLASSES_DIR` is resolved from `e2e/`. A
  `PG_HOST` that isn't local is refused too, beside the three URLs.
- **D11. `setup/global-setup.ts` changed one hint.** 03b says it's unchanged apart from paths. Its
  closing hint pointed at `apps/web/.env.development.local`. It now says the flag comes from
  `e2e/.env` or the job env, and that a dev server already running is reused as it is.
- **D12. `act` only: `--env pnpm_config_store_dir=/root/.local/share/pnpm/store`.** Without it,
  pnpm 11 puts its store in the copied workspace (`.pnpm-store/`), and `pnpm format:check` fails
  on thousands of store files. GitHub runners keep the store under `$HOME`, so the workflow isn't
  changed. `docs/testing/ci-gates.md` records it.
- **D13. `supabase stop --no-backup` around the `act` runs,** rather than `pnpm db:stop`. Without
  `--no-backup` the `act` job would reuse the local database volume, skip the migrations, and test
  old data. It wipes local data only, as T6.0's `db:reset` already had.
- `[ASSUMPTION]` 01b assumption 5: invite onboarding stays in the smoke. It ran in every E2E run
  (8.6–8.7 s). The 15-minute check waits for the GitHub runs (§6 item 3).

## 8. Observations (not changed, outside item 6)

- **O1. A flaky item 4 unit test.** `ProfileForm.test.tsx` "refuses clearing a saved number in
  the browser (AC-4.4)" failed once in 4 `act` runs of `web`. After `userEvent.clear` the field
  still held `9 999`, so the "Please enter a phone number" message never showed. It passed in 5
  local reruns of the file and in every full local run. Item 6 doesn't touch it, but it can make
  the existing `web` check go red now and then. This needs a fix-forward on its own branch: look
  at `clear` racing the phone formatter.
- **O2. Local stack keys in CI output** (for Security, T6.13):
  - `supabase start` prints its status table, including the local publishable and secret keys,
    before any mask can apply. The CLI itself labels these "shared defaults".
  - The `e2e-report` traces hold the local keys in request headers.
  - Both are the Supabase CLI's fixed local values on a throwaway runner, the same set the old
    repo's `.env.example` held. Artifacts of a public repo can be downloaded by any signed-in
    GitHub user.
- **O3. The external suite depends on shell exports.** Its harness-started dev server takes the
  portal settings from the 04b §0 "every build terminal" exports. My first external run, without
  them, failed 8/9: "Sign-in isn't available right now". It passed 9/9 with them. The in-repo
  suite carries those values in `e2e/.env`, so it doesn't need the exports.
- **O4. The JSON-LD `image` points at a missing file.** `https://ajclasses.com.au/og-image.png`
  is still a 404 (item 5's O1). It passes the check, which tests that a URL is absolute and on
  the production site, not that it loads.
- **O5. The Lighthouse job's 10-minute limit is the tightest.** It took about 4.8 min under `act`
  on this laptop, 3 of them in LHCI. GitHub's 2-core x86 runners are slower. If the first
  `develop` runs come close to the limit, don't lower anything. Ask the PO whether to raise the
  job's `timeout-minutes` or drop a page.

## 9. What I didn't verify

1. Anything in §6: the GitHub-side evidence, the three durations, artifact retention, and
   x86-64 runners.
2. The Rich Results Test and Schema Markup Validator on the live site (AC-6.11): that's a release
   step after the next production release (04b §8.3 step 3).
3. Browsers other than Chromium for the CSP sweep (Chrome 155 and Chromium 156 only).
4. A `kinet validate` run (not initialised in this repo; rule greps instead, §2).

## 10. Later (deferred, named)

- **JS size gate** (`resource-summary:script:size` ≤ 102,400 bytes), with the MUI chunk split
  (§4).
- The rest of 01b's deferred list is unchanged: the full E2E suite on every PR, Lighthouse on
  portal pages, visual regression, E2E against hosted staging, and required checks (Q30, owner).
