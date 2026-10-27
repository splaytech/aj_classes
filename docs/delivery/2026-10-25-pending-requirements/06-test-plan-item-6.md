# 06 — Test plan: item 6 (CI quality gates: E2E smoke, Lighthouse, structured data)

> **Stage:** 6a of /deliver (Tester, T6.12) · **Date:** 26 Oct 2026 · **Branch:** `feature/ci-quality-gates`
> (worktree `/Users/sjain/dev/work/aj_classes-items-4-9`)
> **Input:** [01b](01b-requirement-items-4-9.md) item 6 (AC-6.1 to AC-6.14) and the common rule,
> [03b](03b-design-items-4-8.md) §0.3 and §6 (§6.10 test approach, §6.11 release),
> [04b](04b-plan-items-4-8.md) §0 (full check) and §4 (T6.0 to T6.14, path B),
> [05-dev-notes-item-6.md](05-dev-notes-item-6.md) (§3 `act`, §4 baseline, §6 not covered, D1 to D13, O1 to O5),
> [review-5-item-6.md](review-5-item-6.md) (APPROVED, non-blocking 1 to 10), [06-security-item-6.md](06-security-item-6.md) (S1 to S6),
> `docs/testing/ci-gates.md`, `.github/workflows/ci.yml`, [06-test-plan-item-5.md](06-test-plan-item-5.md) (format, hdr helper),
> `~/second-brain/Projects/AJClasses/_agents/tester.md`.
> **Next:** `/test-and-ship docs/delivery/2026-10-25-pending-requirements/06-test-plan-item-6.md`
> freezes this list and runs it. IDs are stable: add new cases at the end, never renumber.

**Build under test:** the `feature/ci-quality-gates` HEAD at freeze time. This plan was written against
**`815135d`**. The code is final there; `1a85c28` (review 5 round 2) is docs only. On top of the first
build (`81caa8c` to `69a8f70`) it holds the review 5 and security fix commits `f4a14f5`, `3f89d3a`,
`b980ba1`, `b57e464`, `7aa7d43`, `5485710`, `05faecd`, `dae99de` (dev notes §11) and the lead's review 5
round 2 fix `815135d` (`id: hosted-ref`; the report and CSP steps skip on a build that failed the
hosted-ref check). The run doesn't start unless `git merge-base --is-ancestor 815135d HEAD` exits 0
**and** `git diff --quiet 815135d HEAD -- apps e2e .github package.json pnpm-lock.yaml pnpm-workspace.yaml supabase README.md docs/testing`
exits 0. If either fails, every expected value marked **[re-check]** is re-read from the files before
the run, never carried over.

**Status: FROZEN, 54 pre-merge cases** (plus 8 post-merge and 1 post-release cases, which the gate
doesn't count; §4). Frozen by the commit `docs(delivery): freeze the item 6 test plan` (its SHA is
recorded in `TSR-item-6.md`'s header). No case may be removed or weakened from here on; new cases go
at the end.

**Changes after review 6a** ([review-6a-item-6.md](review-6a-item-6.md), round 1; no second round, as
agreed if listed here):
1. Finding 1, **E-70**: step 5 adds `supabase stop --no-backup` and E-64's counts (`0`, `0`), so
   E-71's `database` run starts fresh.
2. Finding 2, **E-66** and **P-06**: `Started supabase…` is `1` in E-66 (stderr is kept) and not a
   measure in P-06; the S4 measures are the three key-value greps (`0`) plus a key-shape grep (`0`).
3. Finding 3, **E-70** step 4: the trace grep reads only the `*.network` log (`"url":"https://…supabase.co`).
4. Finding 4, **E-73** step 2: `grep -ac 'categories:performance failure'`, expecting `6` [measure].
5. Finding 5, **E-18** step 5: `-A4` (`pnpm install` is `ci-gates.md:21`).
6. Finding 6, **E-27**: an env measure (shell and the 5173 process: only the local
   `VITE_SUPABASE_URL`); **E-81** drops E-27 from the guard sum.
7. Finding 7, **E-66**: `***` `≥ 1`.
8. Finding 8, **E-66**: `14` `Applying migration`, the last `20261026100000_staff_phone_edit.sql...`, and `Seeding data from supabase/seed.sql...`.
9. Finding 9, **E-72** and **E-81**: `hosts` is `example.supabase.co/`.
10. Finding 10, **E-72** step 1: 4 lines (120, 121, 180, 181); edit 120 and 121 only.
11. Finding 11, **§1**: `ci.yml` lines 176 to 182.
12. Finding 12, **E-20**: exactly `23` lines.
13. Finding 13, **E-33**: a blank line before `lighthouse-report: …`.
14. Finding 14, **E-13** step 7: `retention-days: 7` on `3` lines (102, 154, 162).
15. Finding 15, **E-16** step 3: the `grep -cE '^[|] .(…). [|]'` form, expecting `5`.
16. Finding 16, **§3**: E-64 in the Safety row.
17. Finding 17, **§1**: `$SCR` is a fresh `item6-run` subfolder.
18. Finding 18: the R2 wording (the lead, in the Rulings block).
19. Finding 19, **§5** item 7 lists S1, S5, S6 as deferred; **E-18** step 5 checks `signing_keys_path` (`1`).
20. Finding 20, **E-42**: titles matched on text (Vitest prints ` > `).

**Path B (Q28 unanswered).** Nothing is pushed before the merge. The workflow is proven locally with
`act` 0.2.89 and image `catthehacker/ubuntu:act-latest`. Deliberate failures are **uncommitted
working-tree edits**, each undone with `git restore <file>` in the same case. The GitHub-only evidence
(real check names, run logs, three durations, 7-day retention, x86-64 runners) is in §4,
**"Post-merge on `develop`"**. Those cases are collected straight after the `develop` push (04b T6.14).
**They aren't counted in the pre-merge pass rate**: they're neither PASS nor BLOCKED for this gate, and
`TSR-item-6.md` lists them under "Not covered" until they're collected. A red post-merge case is fixed
forward on `fix/ci-quality-gates` before T7.0 (04b T6.14), never by re-breaking `develop`.

**Expected values were checked on this branch before writing them** (the item 4 round 1 lesson).
Read-only, at `815135d`:
- the script names in the three `package.json` files: root `typecheck` (`pnpm --filter web typecheck && pnpm --filter aj-classes-e2e typecheck`) and `test` (`pnpm --filter web test && pnpm --filter aj-classes-e2e test:unit`); `e2e` `test:smoke`, `test:csp`, `typecheck`, `test:unit` (`node --test "src/**/*.test.ts"`); `web` `lighthouse`, `lighthouse:report` (`node scripts/check-lighthouse-report.ts .lighthouseci`), `check:structured-data`, `check:hosted-ref`, `mirror`;
- the job ids, job names, step names and their order, `if:` conditions, timeouts and artifact names in `ci.yml` (the Lighthouse job's `id: hosted-ref` and the two `if: ${{ !cancelled() && steps.hosted-ref.outcome == 'success' }}` conditions from `815135d`);
- `act -l` output (run, read-only);
- the exact output strings in `check-hosted-ref.ts`, `check-lighthouse-report.ts`, `check-structured-data.ts`, `structured-data.ts`, `local-env.mjs`, `src/config.ts`, `src/local-hosts.ts`, `hosted-guard.ts`, `serve-mirror.ts`, `setup/global-setup.ts`;
- the test titles: 9 smoke tests (5 specs), 19 CSP tests (9 pages × 2 widths + 1), 25 structured-data and 9 Lighthouse-report unit tests, 6 `local-hosts` unit tests in 2 suites, 56 Vitest files;
- the Vitest total **496**: review 5 ran `pnpm test` at `3a07a95` and got 56 files / 493; since then the source adds exactly 3 tests (`lighthouse-report.test.ts` 8 → 9, `structured-data.test.ts` 23 → 25) and `dae99de` changes no `it`/`test` line (it swaps `userEvent.setup()` for `setupUser()` only); the dev notes §11 run reports the same 496;
- 18 HTML files in `build/client`, 14 migrations (newest `20261026100000`), 14 pgTAP files, 29 tracked files under `e2e/` + `.github/workflows`;
- the 14 moved files against `~/dev/work/aj_classes-e2e@488dde1` (formatting-only differences);
- the `act` log formats, the `lighthouse-report` folder layout (18 `.report.html`, 18 `.report.json`, `manifest.json` with 18 entries) and the `e2e-report` upload lines, from the Developer's `act` logs in the session scratchpad.

Values that depend on a run (build file count, Lighthouse scores, JS bytes, durations)
are marked **[measure]**: the expectation is the rule, and the number is recorded. Where a value came from
the dev notes and couldn't be re-derived from the files, it says **[dev notes]**.

**Environment (local only).**

| Name | What | Address |
|---|---|---|
| **DB** | Local Supabase, started from **this worktree** (`project_id = "aj_classes"`, shared by every checkout) | API `http://127.0.0.1:55321`, DB `:55322`, Mailpit `:55324` |
| **D** | Dev server started by the E2E global setup (`pnpm --filter web dev`); by hand only in E-29 | `http://localhost:5173` |
| **M** | The production mirror, `pnpm --filter web mirror` (LHCI and `test:csp` start their own) | `http://127.0.0.1:4173` |
| **A** | `act` containers (host Docker, host network). `database` and `e2e` start their own Supabase with the same container names and ports as **DB** | — |
| **CC** | A clean detached worktree of HEAD for the runbook cases | `$SCR/ci-check` |

- **The hosted project `unzjnxctkyahtmrkinyr` is never read or written.** `supabase/.env.deploy` is
  never opened. The committed `apps/web/.env.production` points at the hosted project, so every build in
  this plan sets its Supabase variables on the command line (CI's values, or 04b §0's local exports).
- **Console and network rule (team lead).** Any request to a `*.supabase.co` host, or any URL containing
  `unzjnxctkyahtmrkinyr`, **fails the case** it happens in. Measured by:
  - browser legs: the `hostedSupabaseGuard` fixture (every smoke and CSP spec), LHR `network-requests`
    and `inspector-issues`, and the case's own HAR or request counter where it has one;
  - builds and files: `check:hosted-ref` (prints `check-hosted-ref: 0 files (of N scanned)`);
  - `act` logs: `grep -aEc 'unzjnxctkyahtmrkinyr'` and `grep -aEo '[A-Za-z0-9.-]+\.supabase\.co([^m]|$)'`
    (the `[^m]` keeps the CLI's `supabase.com` update notice out).

  Declared exceptions, exact and nowhere else:
  - **H1.** E-25's injected `fetch('https://example.supabase.co/rest/v1/')`, which the guard must abort
    in the browser. It's the measurement.
  - **H2.** E-72's build is pointed at `https://example.supabase.co` on purpose. The mirror's CSP must
    block every attempt in the browser: 0 entries in any LHR `network-requests`, and the
    `  supabase.co request: https://example.supabase.co/…` lines on stderr are the expected output.
  - **H3.** E-29's hand-started dev server is configured for `https://example.supabase.co` on purpose.
    The warm-up browser's `abortHostedSupabase` route must abort its attempts in the browser; the
    public services that call Supabase are client-only modules (`*.client.ts`), so the dev server
    itself makes no server-side call.
  - Never `unzjnxctkyahtmrkinyr` itself, in any case. E-26 and E-28 use hosted-style values that are
    refused before any process that could send a request starts.
- **No real enquiry, subscription or Zoho write.** Web3Forms, Kit and `leads` are mocked by the specs.
  The local `leads` function's Zoho URLs point at the local stub (`supabase/config.toml`).
- **Local keys stay out of git (security S4).** The `act` logs and the `e2e-report`/`csp-report`
  artifacts hold the CLI's local keys, the seed admin's password and TOTP seed, and session JWTs.
  Raw logs and artifacts live in `$SCR` only. `$EVD` (committed with the TSR) gets filtered lines and
  `unzip -l` listings. E-82 greps `$EVD` for key shapes.

**Full check** (04b §0 steps 1 to 3, then the in-repo E2E; from the worktree root, with the §1 base
exports):

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build \
  && pnpm --filter web check:hosted-ref build/client \
  && pnpm db:test && pnpm test:functions
node e2e/scripts/local-env.mjs > e2e/.env && pnpm --filter aj-classes-e2e test:smoke
lsof -t -nP -iTCP:5173 -sTCP:LISTEN | xargs kill   # global setup leaves its dev server running
```

**Hard rules for this run.**
1. Local stack only. Banned: `supabase link`, `db push`, `config push`, `functions deploy`,
   `secrets set|unset|list`, anything with `--linked` or `--project-ref`, `git push`, `gh pr …`,
   `gh run rerun`, `gh workflow run` (post-merge cases only, §4). No `curl` to `ajclasses.com.au` or
   `*.vercel.app`.
2. `supabase/.env.deploy` is never opened, `cat`-ed, sourced or grepped. Key values are never printed:
   print names, counts, or `equal` / `differ`.
3. No tracked file is changed, **except** the five deliberate-failure edits (E-25, E-70, E-72, E-73, E-75),
   each undone with `git restore` inside the same case, with `git status --porcelain` empty afterwards.
   Fixtures live in `$SCR`, or in gitignored folders (`e2e/.env` moved aside and back in E-35;
   `build/client` copies go to `$SCR`).
4. Ports: 4173 (mirror) and 5173 (dev server) must be free at the start of each phase and of each
   case that runs the suite (E-29 starts its own dev server on 5173 and stops it in the same case). A server some other checkout left running on 5173 or 4173 would be **reused** by global setup
   or `reuseExistingServer`, and test the wrong code.
5. **Seed order.** Phases 2 to 5 run on the seeded local stack. Phase 6 deletes it on purpose
   (`supabase stop --no-backup`, E-64) right before the first `act` job that starts Supabase. Nothing
   after phase 6 needs the seed until E-80 restores it.

**For Saurabh** (not cases; nothing here blocks a pre-merge case):
1. **Q28.** If he says yes (push the branch, open a draft PR, and a throwaway `ci-proof/item-6`
   branch), P-01 to P-07 can run on the draft PR before the merge (path A), and the gate counts them.
   With no answer, path B stands and they stay post-merge.
2. **Optional, after merge:** required status checks (Q30 recommends `main` only; dev notes §7).
   That's a GitHub settings change, his account.
3. **Ask before T6.14:** P-02 uses `gh run rerun` (twice) on the first `develop` run, through the `gh`
   CLI logged in as `sorabh2008`. It changes no setting and costs nothing (public repo). The lead
   confirms with him that reruns are fine, so P-02 isn't discovered as blocked at the push.
4. Nothing in the pre-merge plan needs his accounts, his app config or a paid call.

**Known non-bugs for this run** (don't raise):
1. **K1. O4: `og-image.png` is a 404 live.** The JSON-LD `image` passes the check, which tests that a URL
   is absolute and on the production site, not that it loads.
2. **K2. `act` warns** "You are using Apple M-series chip and you have not specified container
   architecture". The runs are arm64 on purpose. x86-64 is P-04.
3. **K3. The Supabase CLI's update notice** ("A new version of Supabase CLI is available",
   `https://supabase.com/docs/…`) isn't a hosted request.
4. **K4. `act` times are indicative.** AC-6.4's limits are measured on GitHub (P-02).
5. **K5. The supabase-js vendor bundle holds a `*.supabase.co` allow-list literal** (TSR-item-4 R1).
   Never grep a build for `supabase.co`; `check:hosted-ref` (the project ref) is the build measure.
6. **K6. 30 files scanned locally, 29 in CI** for `check:hosted-ref ../../.github/workflows ../../e2e`:
   the gitignored `e2e/.env` exists locally only (act and CI don't copy gitignored files).
7. **K7. Lighthouse's `Best Practices` and the analytics 404:** the mirror stubs
   `/_vercel/insights/script.js` with an empty file (AC-6.6 allows it).
8. **K8. A `csp-report` artifact on E-73** (threshold miss): the job has failed, so the `if: failure()`
   upload runs even though the CSP sweep passed. It holds the sweep's passing HTML report.

**Rulings (team lead, 26 Oct 2026, decided before freeze).**
1. **R1. Dual-surface, AC-6.2. Accepted as proposed.** E-24 passes if the three data-writing
   journeys assert their row and `our-approach.spec.ts` and `staff-login.spec.ts` are unchanged from
   `488dde1`. Reason: AC-6.2 says the rule is "kept"; a static page and a sign-in write no row to
   assert. [ASSUMPTION] that "each spec" means each spec that writes data.
2. **R2. E-26 (unguarded warm-up). Kept at its stated expected value.** The lead has sent it to the
   Developer, and the fix is already in the build (`5485710`, dev notes §11 A): global setup refuses
   a non-loopback `VITE_SUPABASE_URL` before the dev server or the warm-up browser starts. A red E-26 in round 1 is a bug that item 6 waits for.
3. **R3. E-61 (`web` job flake). 3 of 3 green is required.** The `ProfileForm.test.tsx` phone
   tests' failure mode (a timed-out test's keystrokes leaking into the next test) is fixed on this
   branch with `setupUser()` (`dae99de`), because item 6 makes `web` a gate people rely on.
   `posts.test.tsx` › "shows a loading line until the posts arrive" is unchanged: its 27 s failure
   was a whole-machine stall a test change can't prevent (dev notes §11 B). [ASSUMPTION] that a
   test-only fix to item 4 tests is in item 6's scope. Any red run in round 1 counts as a FAIL and
   a bug, with no stall exception; item 6 waits for it.

## 1. Set-up (once per terminal)

```bash
cd /Users/sjain/dev/work/aj_classes-items-4-9
pnpm db:status                                   # else pnpm db:start (from this worktree)
export VITE_SUPABASE_URL=http://127.0.0.1:55321
export VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from pnpm db:status>
export VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA      # Cloudflare's public always-pass test key
export SCR=<session scratch dir>/item6-run   # fresh subfolder: the Developer's earlier logs are never globbed or overwritten
export EVD=$PWD/docs/test-reports/2026-10-26-feature-ci-quality-gates/evidence
mkdir -p "$EVD" "$SCR/act-logs" "$SCR/act-artifacts"
alias q='docker exec supabase_db_aj_classes psql -U postgres -At -c'
```

**Gate builds: CI's env exactly** (`ci.yml` lines 116 to 125 and 176 to 182 at `815135d`).
The base exports are removed for these builds, so the result matches CI (where `.env.production`
supplies the public Turnstile site key):

```bash
lh_build() { env -u VITE_TURNSTILE_SITE_KEY VITE_APP_ENV=production VITE_SUPABASE_URL= \
  VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder \
  VITE_KIT_FORM_ID=0000000 pnpm build; }
sd_build() { env -u VITE_TURNSTILE_SITE_KEY -u VITE_FORM_ACCESS_KEY -u VITE_KIT_FORM_ID \
  VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= pnpm build; }
nfiles() { find apps/web/build/client -type f | grep -viE '\.(png|jpe?g|gif|webp|ico|woff2?|avif)$' | wc -l; }
```

**`act` wrapper** (the `docs/testing/ci-gates.md` command; a fresh artifact folder per run):

```bash
actjob() {   # actjob <job-id> <tag>
  mkdir -p "$SCR/act-artifacts/$2"; local t0=$(date +%s)
  act pull_request -j "$1" -P ubuntu-latest=catthehacker/ubuntu:act-latest \
    --artifact-server-path "$SCR/act-artifacts/$2" \
    --env pnpm_config_store_dir=/root/.local/share/pnpm/store > "$SCR/act-logs/$2.log" 2>&1
  local rc=$?
  perl -pe 's/\e\[[0-9;]*m//g' "$SCR/act-logs/$2.log" | grep -aE '(Success|Failure) - Main|Job (succeeded|failed)|check-hosted-ref:|check-structured-data:|lighthouse-report:|[0-9]+ (passed|failed)|Test Files|Tests  |(tests|suites|pass|fail) [0-9]+$|Applying migration|Seeding data|Files=|Result:|Artifact .* uploaded' > "$EVD/act-$2.txt"
  echo "exit $rc wall $(( $(date +%s) - t0 ))s" >> "$EVD/act-$2.txt"
  echo "ref $(grep -ac unzjnxctkyahtmrkinyr "$SCR/act-logs/$2.log") hosts $(grep -aEo '[A-Za-z0-9.-]+\.supabase\.co([^m]|$)' "$SCR/act-logs/$2.log" | sort -u | tr '\n' ' ')" >> "$EVD/act-$2.txt"
}
```

**Header helper and reference strings** (from item 5's plan; built from the committed file at run time):

```bash
LOCAL=http://127.0.0.1:55321
PUB_HOSTED=$(jq -r '.headers[] | select(.source|startswith("/((?!portal")) | .headers[] | select(.key=="Content-Security-Policy") | .value' apps/web/vercel.json)
PUB_LOCAL=${PUB_HOSTED//https:\/\/unzjnxctkyahtmrkinyr.supabase.co/$LOCAL}
hdr() { curl -s -o /dev/null -D - "$1$2" | tr -d '\r' > "$SCR/h.txt"
        printf '%s %s csp=%s kind=%s\n' "$2" "$(head -1 "$SCR/h.txt" | cut -d' ' -f2)" \
          "$(grep -ci '^content-security-policy:' "$SCR/h.txt")" \
          "$(v=$(grep -i '^content-security-policy:' "$SCR/h.txt" | cut -d' ' -f2-)
             case "$v" in "$PUB_LOCAL") echo public-local;; "$PUB_HOSTED") echo public-hosted;; *) echo other;; esac)"; }
```

**Lighthouse page set** (`apps/web/lighthouserc.json`, exactly): `/`, `/programmes/vce`,
`/programmes/selective-entry`, `/resources`, `/resources/victorian-selective-entry-exam`, `/privacy`, on
`http://127.0.0.1:4173`, 3 runs each, so **18 runs**.

**Smoke test titles** (exactly 9; the source of truth for E-23, E-27, E-51 and E-66):
1. `Admin Daily Posts › create, edit, delete a post reflected in both UI and DB`
2. `Admin Daily Posts › public /posts renders published posts newest-first`
3. `Admin Daily Posts › long unbroken titles and URLs wrap: no sideways scroll on /posts or the admin page`
4. `Admin Daily Posts › XSS guard: script payload renders as text, never executes`
5. `Admin Daily Posts › RLS: anon can read the public post columns but not author_id, and cannot write`
6. `Invite onboarding › admin invites a staff member; they complete onboarding into an active tutor account`
7. `Our Approach homepage section › renders all four steps, in order, each with one h3`
8. `Register Interest form › submits via the mocked Web3Forms path and persists to public.enquiries`
9. `Staff/admin login › admin signs in through 2FA and lands on the portal`

**CSP sweep titles** (exactly 19): for each of `/`, `/programmes/vce`, `/programmes/selective-entry`,
`/resources`, `/resources/victorian-selective-entry-exam`, `/privacy`, `/posts`, `/subscribed`, `/nope`,
under both `Public CSP at 360px (phone)` and `Public CSP at 1280px (desktop)`:
`<path> loads and is used with no CSP violations` (18), plus
`a script from an origin outside the policy is blocked and reported (AC-5.8)`.

---

## 2. Cases

Phases run in this order: **0** safety, **1** repo, scope and committed config, **2** E2E smoke locally,
**3** Lighthouse gate locally, **4** structured data locally, **5** runbook from a clean worktree,
**6** the workflow under `act` (all green), **7** deliberate failures under `act`, **8** close-out.
Within a phase, run in table order.

### Phase 0 — safety (stop the run if any fails)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-01 | 6.14, §0.3 | Safety | Build under test, shell and tools | 1. `git rev-parse HEAD`; `git branch --show-current`; `git merge-base --is-ancestor 815135d HEAD; echo $?`; `git status --porcelain`. 2. `echo $VITE_SUPABASE_URL`; compare `$VITE_SUPABASE_PUBLISHABLE_KEY` with `pnpm db:status`'s key (`equal`/`differ`). 3. `env \| cut -d= -f1 \| grep -xE 'MIRROR_SUPABASE_ORIGIN\|CHROME_PATH\|GITHUB_ACTIONS\|GITHUB_ENV\|VITE_LEAD_CAPTURE\|VITE_FORM_ACCESS_KEY\|VITE_KIT_FORM_ID\|VITE_SUPABASE_FUNCTIONS_URL\|SUPABASE_ACCESS_TOKEN\|SUPABASE_DB_PASSWORD'`. 4. `lsof -nP -iTCP -sTCP:LISTEN \| grep -cE ':(4173\|5173) '`. 5. `act --version`; `docker images catthehacker/ubuntu:act-latest -q \| wc -l`; `supabase --version 2>/dev/null \| head -1`; `node --version`; `pnpm --version`. 6. `git -C ~/dev/work/aj_classes-e2e rev-parse --short HEAD`; `git -C ~/dev/work/aj_classes-e2e status --porcelain \| wc -l` | 1: HEAD recorded; `feature/ci-quality-gates`; `0`; empty (the Developer's docs edits committed). 2: exactly `http://127.0.0.1:55321`; `equal`. 3: **no output**. 4: `0`. 5: `act version 0.2.89`; `1`; `2.120.0` (same as `ci.yml`'s pin); `v24.x`; `11.1.2`. 6: `488dde1`; `0` (the external repo is frozen, ADR-0006). **Any failure: stop** | — |
| E-02 | §0.3 | Safety | Stack started and reset from this worktree; seed snapshot | 1. `pnpm db:reset`. 2. `docker inspect supabase_edge_runtime_aj_classes --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' \| grep -c aj_classes-items-4-9`. 3. `q "select max(version) from supabase_migrations.schema_migrations"`; `ls supabase/migrations \| tail -1`. 4. Snapshot to `$SCR/snapshot-start.txt`: `select count(*) from public.profiles`; `… public.posts`; `… public.enquiries`; `select count(*) from public.profiles where email like 'e2e-%'` | 1: exit 0. 2: `1` (else `pnpm db:stop && pnpm db:start` here, then repeat). 3: both `20261026100000` (item 6 adds no migration). 4: profiles **6**, posts **0**, `e2e-%` **0**; enquiries recorded. **Any failure in 2–3: stop** | DB |
| E-03 | §0.3, 6.3 | Safety | `.env.deploy` untouched; no banned command; nothing pushed | `git check-ignore -q supabase/.env.deploy; echo $?` (doesn't open it). At close-out: `grep -nE 'env\.deploy\|db push\|config push\|functions deploy\|secrets (set\|unset\|list)\|--linked\|--project-ref\|supabase link\|git push\|gh (pr\|run rerun\|workflow)\|ajclasses\.com\.au\|vercel\.app' <the TSR's command log>`; `git rev-parse @{u} 2>&1` | `0`; the log has no such command (a URL inside a `grep` pattern isn't a request); `@{u}` errors with "no upstream" (the branch was never pushed) | — |

### Phase 1 — repo, scope and committed config

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-10 | DoD, all | Full check | 04b §0 steps 1 to 3 (header block, first line) | Run with the base exports; log to `$EVD/E-10-fullcheck.log` | Every step exit 0. Lint 0 problems. `pnpm typecheck` runs **both** `web` and `aj-classes-e2e` (root script `pnpm --filter web typecheck && pnpm --filter aj-classes-e2e typecheck`). `pnpm test` runs Vitest **and** the e2e unit tests (root script `pnpm --filter web test && pnpm --filter aj-classes-e2e test:unit`): Vitest `Test Files  56 passed (56)` and `Tests  496 passed (496)` exactly (derivation in the header; a different number means a test was added or dropped since `815135d`: fail and explain), including `scripts/lighthouse-report.test.ts` (**9**) and `scripts/structured-data.test.ts` (**25**); then Node's test runner with `tests 6`, `suites 2`, `pass 6`, `fail 0` (E-19). Hosted-ref step `check-hosted-ref: 0 files (of N scanned)`, N = `nfiles` after this build (153 per dev notes §11 **[measure]**). `db:test` `Files=14, Tests=507` and `Result: PASS` (the Developer's `act` log format and count; item 6 adds no migration or pgTAP file). `test:functions` `169` `ok` lines and `0` `not ok` (dev notes §11; item 6 changes no function or its tests) | DB |
| E-11 | 03b §6.1 | Scope | Only the item 6 files changed; no runtime code, migration or production dependency | `git diff --name-only develop...HEAD -- . ':!docs'`; `git diff --name-only develop...HEAD -- apps/web/src`; `git diff --quiet develop...HEAD -- supabase apps/web/vercel.json apps/web/serve.railway.json; echo $?`; `git diff develop...HEAD -- package.json \| grep -E '^[-+] '` | Exactly **54** files (checked at `815135d`): 7 at the root (`.github/workflows/ci.yml`, `.gitignore`, `.prettierignore`, `README.md`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`); `apps/web/lighthouserc.json`, `apps/web/package.json`; 14 under `apps/web/scripts/` (`check-lighthouse-report.ts`, `check-structured-data.ts`, `lighthouse-report.ts`, `lighthouse-report.test.ts`, `structured-data.ts`, `structured-data.test.ts`, and the 8 `fixtures/structured-data/*.html`: `broken-json`, `course-missing-provider`, `guide-valid`, `home-valid`, `localhost-url`, `programme-valid`, `relative-url`, `review`); 3 under `apps/web/src/`; 28 under `e2e/` (`.env.example`, `csp/public-csp.spec.ts`, `package.json`, `playwright.config.ts`, `playwright.csp.config.ts`, `scripts/local-env.mjs`, `setup/global-setup.ts`, `tsconfig.json`, 14 under `src/` including the new `local-hosts.ts` and `local-hosts.test.ts`, 6 under `tests/`). The `apps/web/src` list is exactly the test-only files `components/portal/ProfileForm.test.tsx`, `routes/portal/admin-posts.test.tsx`, `test/user.ts` (R3 fix, `dae99de`): no runtime source. `0` (no database or hosting config change). Root `package.json`: exactly the `typecheck` and `test` lines changed | — |
| E-12 | 6.2, ADR-0006 | Moved suite | The specs and helpers are the external suite's, changed only by Prettier | For each of `tests/{admin-posts.spec.ts,admin-posts.selectors.ts,invite-onboarding.spec.ts,our-approach.spec.ts,register-interest.spec.ts,staff-login.spec.ts}`, `src/auth/{login,totp}.ts`, `src/db/{anon-client,pg-client,poll}.ts`, `src/fixtures/markers.ts`, `src/mail/mailpit.ts`, `src/mocks/web3forms.ts`: `cmp -s <(git -C ~/dev/work/aj_classes-e2e show 488dde1:$f \| tr -d ' \n,') <(tr -d ' \n,' < e2e/$f) && echo same` | **14 × `same`** (spaces, line breaks and Prettier's trailing commas removed; checked at `815135d`). The files changed on purpose (`setup/global-setup.ts`, `src/config.ts`, `src/fixtures/test-fixtures.ts`, `tsconfig.json`) and the new ones (`src/fixtures/hosted-guard.ts`, `src/local-hosts.ts`, `src/mocks/public-services.ts`) are covered by E-19, E-22, E-24, E-26, E-28 and E-29 | — |
| E-13 | 6.1 | Workflow shape | Five named jobs, every PR and every push to `develop`/`main`, independent, any failure fails | 1. `act -l 2>/dev/null` (record the full table). 2. `grep -nA3 '^on:' .github/workflows/ci.yml`. 3. `grep -nE '^\s+timeout-minutes:' .github/workflows/ci.yml`. 4. `grep -cE '^\s+(needs\|continue-on-error):' .github/workflows/ci.yml`. 5. `grep -nE '^\s+(- )?if:' .github/workflows/ci.yml`. 6. `grep -nA1 '^permissions:' .github/workflows/ci.yml`; `grep -c 'permissions:' .github/workflows/ci.yml`. 7. `grep -n 'retention-days: 7' .github/workflows/ci.yml` | 1: exactly 5 rows, stage 0: `structured-data Structured data`, `web web`, `database database`, `e2e E2E smoke`, `lighthouse Lighthouse`, each `CI ci.yml push,pull_request`. 2: `push: branches: [main, develop]` and `pull_request:` (no filter, no `pull_request_target`). 3: `15`, `20`, `15`, `10`, `10` (web, database, E2E, Lighthouse, structured data). 4: `0` (jobs run in parallel; none can pass on a failed step). 5: exactly 5 conditions: `if: failure()` (`e2e-report` upload), `if: ${{ !cancelled() && steps.hosted-ref.outcome == 'success' }}` (×2: "No Supabase requests; JS size per page" and the CSP sweep), `if: always()` (`lighthouse-report`), `if: failure()` (`csp-report`); and `grep -n 'id: hosted-ref'` gives exactly 1 line, on the Lighthouse job's "No hosted project reference in the build" step. 6: `contents: read`, and `1` (no job widens it). 7: `3` lines (102, 154, 162: `e2e-report`, `lighthouse-report`, `csp-report`; AC-6.5) | — |
| E-14 | 6.3, 6.14 | Workflow safety | No hosted value, secret or env file; keys only at run time | 1. `grep -c unzjnxctkyahtmrkinyr .github/workflows/ci.yml`; `grep -cE 'secrets\.\|pull_request_target\|supabase\.co\|--project-ref\|--linked\|supabase link\|github\.event\.' .github/workflows/ci.yml`. 2. `pnpm --filter web check:hosted-ref ../../.github/workflows ../../e2e; echo $?`; `git ls-files e2e .github/workflows \| wc -l`. 3. `sed -n '/^  e2e:/,/^  lighthouse:/p' .github/workflows/ci.yml \| grep -nE "VITE_LEAD_CAPTURE\|> /dev/null\|GITHUB_ENV"`. 4. `git ls-files \| grep -E '(^\|/)\.env'`; `grep -E '^(SUPABASE_ANON_KEY\|SUPABASE_SERVICE_ROLE_KEY\|VITE_SUPABASE_PUBLISHABLE_KEY)=' e2e/.env.example`; `git check-ignore -q e2e/.env; echo $?`. 5. `git grep -nE 'eyJ[A-Za-z0-9_-]{20,}\|sb_secret_\|sb_publishable_[A-Za-z0-9_]{8,}' -- e2e .github \| wc -l`; `git log -p develop..HEAD -- . ':!pnpm-lock.yaml' ':!docs' \| grep -cE 'eyJhbGci\|sb_secret_\|sb_publishable_[A-Za-z0-9_]{8,}\|unzjnxctkyahtmrkinyr'` | 1: `0`; `0`. 2: `check-hosted-ref: 0 files (of 30 scanned)` (29 tracked + the gitignored `e2e/.env`, K6; 29 if `e2e/.env` doesn't exist yet), exit 0; `29`. 3: `VITE_LEAD_CAPTURE: 'on'` in the job `env:` (AC-6.3); `supabase start -x studio,imgproxy,logflare,vector,supavisor,postgres-meta > /dev/null` (the key table isn't logged, S4); `node e2e/scripts/local-env.mjs >> "$GITHUB_ENV"`. 4: exactly `apps/web/.env.example`, `apps/web/.env.production`, `e2e/.env.example`; all three keys `=<from supabase status>`; `0`. 5: `0`; `0` (no key or hosted ref in any item 6 code commit; `docs/` is left out because existing docs name the hosted ref in prose; both checked on this branch) | — |
| E-15 | 6.6, 6.7, 6.8 | Lighthouse config | One committed config: mobile, the six pages, 3 runs, R1's thresholds, filesystem upload, no size gate | 1. `jq -c '.ci.collect \| {startServerCommand, startServerReadyPattern, numberOfRuns, settings, url}' apps/web/lighthouserc.json`. 2. `jq -c '.ci.assert.assertions' apps/web/lighthouserc.json`; `jq -c '.ci.upload' apps/web/lighthouserc.json`. 3. `git grep -n 'minScore' -- . ':!docs'`. 4. `git grep -nE 'temporary-public-storage\|LHCI_TOKEN\|LHCI_GITHUB' -- . ':!docs' \| wc -l`; `grep -c -- '--assert' .github/workflows/ci.yml`; `jq '.ci.assert.assertions \| has("resource-summary:script:size")' apps/web/lighthouserc.json` | 1: `node scripts/serve-mirror.ts --stub-analytics`, `Accepting connections`, `3`, `{"formFactor":"mobile","screenEmulation":{"mobile":true}}`, the six `http://127.0.0.1:4173/…` URLs in the order of §1. 2: four assertions, each `["error",{…,"aggregationMethod":"median"}]`: performance `0.9`, accessibility `0.9`, best-practices `0.9`, seo `1`; `{"target":"filesystem","outputDir":"./lighthouse-report"}`. 3: exactly 4 lines, all `apps/web/lighthouserc.json:19` to `:22`. 4: `0`; `0` (no command-line threshold override); `false` (the size gate is deferred, AC-6.8, dev notes §4) | — |
| E-16 | 6.13 | Dev dependencies | Five new dev-only dependencies, pinned, with a reason each | 1. `jq -c '{d: .dependencies, dd: .devDependencies}' e2e/package.json`. 2. `diff <(git show develop:apps/web/package.json \| jq -S .dependencies) <(jq -S .dependencies apps/web/package.json); echo $?`; `diff <(git show develop:apps/web/package.json \| jq -S .devDependencies) <(jq -S .devDependencies apps/web/package.json)`. 3. `grep -cE '^[\|] .(@playwright/test\|pg\|@types/pg\|dotenv\|@lhci/cli). [\|]' docs/delivery/2026-10-25-pending-requirements/05-dev-notes-item-6.md` | 1: `d` is `null`; `dd` exactly `@playwright/test 1.64.0`, `@supabase/supabase-js ^2.117.2`, `@types/node ^26.6.3`, `@types/pg 8.23.1`, `dotenv 18.0.7`, `pg 8.23.1`, `typescript ^6.0.3`. 2: `0`; exactly one added line, `"@lhci/cli": "0.15.1"`. 3: `5`, each row with a non-empty "Why" cell. (The merge-commit body is P-08) | — |
| E-17 | Repo rules | Code rules | Added lines follow the repo rules | `git diff develop...HEAD -- apps/web e2e \| grep -E '^\+' \| grep -nP 'console\.(log\|debug)\|style=\{\{\|: any\b\|TODO(?! \[)\|innerHTML\|document\.(querySelector\|getElementById)'` | **0** lines (checked on this branch; the CLIs use `console.error` and `process.stdout.write`; the spec's `document.addEventListener` isn't matched) | — |
| E-18 | 6.12 | Docs (static) | The runbook names every gate, with the commands CI uses, and supersedes the old README | 1. `grep -nE '^## ' docs/testing/ci-gates.md`. 2. For each of the three gate jobs, list its `run:` lines (`sed -n '/^  e2e:/,/^  lighthouse:/p'` etc. \| `grep -E '^\s+run:'`) and check each script call appears in `ci-gates.md` (`grep -cF`). 3. `grep -c 'docs/testing/ci-gates.md' README.md`; `grep -n 'E2E smoke\|Lighthouse\|Structured data' docs/architecture/arch.md \| wc -l`; `grep -c 'Preconditions' docs/testing/ci-gates.md`; `grep -n 'Amended 2026-10-26' docs/decisions/0006-ci-gates-e2e-in-repo.md`. 4. `grep -n 'supabase stop --no-backup\|pnpm db:stop' docs/testing/ci-gates.md`. 5. `grep -n -A4 '^First install the workspace once' docs/testing/ci-gates.md`; `grep -c signing_keys_path docs/testing/ci-gates.md`; `grep -c '^## Getting started' README.md`; `grep -c 'test:unit' docs/testing/ci-gates.md` | 1: `## The one rule: no hosted requests`, `## E2E smoke`, `## Lighthouse`, `## Structured data`, `## Running the workflow itself with \`act\` (optional)`. 2: every gate script (`check:hosted-ref`, `local-env.mjs`, `typecheck`, `playwright install`, `test:smoke`, the two builds' variables, `lighthouse`, `lighthouse:report`, `test:csp`, `check:structured-data`) is in the doc. Allowed, documented differences only: `> e2e/.env` for `>> "$GITHUB_ENV"`, `playwright install chromium` without `--with-deps`, and the CI-only `CHROME_PATH` and `--no-sandbox` (named in the doc). 3: `≥ 1`; `≥ 3`; `≥ 1` ("replaces the Preconditions"); 1 line. 4: the `act` section says `supabase stop --no-backup` **before** `database`/`e2e`, and `pnpm db:stop` appears only as "don't use it here" (review 5 finding 2). 5: the intro says "First install the workspace once", links `../../README.md#getting-started`, and gives `pnpm install` (line 21); `1` (the S4 condition names `signing_keys_path`); `1` (the anchor's target heading exists); `≥ 1` (the global-setup checks and their unit tests are documented) | — |
| E-19 | 6.14 | `local-hosts` unit tests | The pure loopback checks shared by the config, global setup and the unit test pass under plain `node --test` | 1. `pnpm --filter aj-classes-e2e test:unit 2>&1 \| tee $SCR/E-19.log; echo $?`. 2. `grep -c "from '" e2e/src/local-hosts.ts`; `grep -n "local-hosts" e2e/src/config.ts e2e/setup/global-setup.ts`. 3. `grep -nE "^\s+(it\|describe)\(" e2e/src/local-hosts.test.ts` | 1: exit `0`; Node's summary `tests 6`, `suites 2`, `pass 6`, `fail 0` **[measure: the reporter's exact prefix characters]**; passing: `assertLocalUrl` › `accepts localhost and 127.0.0.1`, `refuses a hosted Supabase URL and a URL that does not parse`; `assertLocalDevServerEnv` › `accepts the local stack URL`, `refuses a hosted VITE_SUPABASE_URL before the dev server starts`, `refuses an unset or blank VITE_SUPABASE_URL, which would fall back to the app env files`, `refuses any other hosted VITE_SUPABASE_*_URL`. 2: `0` (no imports, so it runs without the stack env); `config.ts` imports `assertLocalHost, assertLocalUrl`, `global-setup.ts` imports `assertLocalDevServerEnv`. 3: 2 `describe`, 6 `it` | — |

### Phase 2 — E2E smoke locally (AC-6.2, 6.3, 6.14)

Port 5173 free before each case that runs the suite (hard rule 4). After each suite run:
`lsof -t -nP -iTCP:5173 -sTCP:LISTEN | xargs kill`.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-20 | 6.3 | `local-env.mjs` | Prints the settings plus the local keys; masks on stderr only in CI mode | 1. `node e2e/scripts/local-env.mjs > $SCR/le.out 2> $SCR/le.err; echo $?`; `wc -l < $SCR/le.out`; `grep -c '<from supabase status>' $SCR/le.out`; `wc -c < $SCR/le.err`; for each of the three keys, compare its value with `supabase status -o json`'s field (`equal`/`differ`). 2. `GITHUB_ACTIONS=true node e2e/scripts/local-env.mjs > $SCR/le2.out 2> $SCR/le2.err`; `grep -c '^::add-mask::' $SCR/le2.err`; `wc -l < $SCR/le2.err`; `grep -c '::' $SCR/le2.out`; `cmp -s $SCR/le.out $SCR/le2.out && echo same` | 1: `0`; **23** (the 20 non-placeholder settings in `e2e/.env.example` plus 3 key lines); `0`; `0`; `equal` ×3 (`SUPABASE_ANON_KEY`→`ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`→`SERVICE_ROLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`→`PUBLISHABLE_KEY`). 2: `3`; `3`; `0`; `same`. No key value is printed into the evidence | DB |
| E-21 | 6.14 | `local-env.mjs` refuses | A non-local stack, a missing key, or no stack: exit 1, nothing on stdout | Fake `supabase` scripts in `$SCR/fakebin-<n>/supabase` (chmod +x), run with `PATH=$SCR/fakebin-<n>:$PATH node e2e/scripts/local-env.mjs > $SCR/r.out 2> $SCR/r.err; echo $?`: (a) prints `{"API_URL":"https://example.supabase.co","ANON_KEY":"a","SERVICE_ROLE_KEY":"b","PUBLISHABLE_KEY":"c"}`; (b) prints `{"API_URL":"http://127.0.0.1:55321","ANON_KEY":"a","SERVICE_ROLE_KEY":"b"}`; (c) `exit 1`. Read `r.err` and `wc -c < r.out` each time | (a) `local-env: the stack's API_URL is "https://example.supabase.co", not http://127.0.0.1:55321; refusing`; (b) ``local-env: `supabase status` has no PUBLISHABLE_KEY``; (c) ``local-env: `supabase status -o json` failed; start the local stack first (pnpm db:start)``. Each exit `1`, stdout `0` bytes. No network call is made (the fake prints JSON only) | — |
| E-22 | 6.14 | E2E config guard | The suite refuses non-local hosts and missing settings before any browser starts | Override one setting in the environment each time (a value already set wins over `e2e/.env`; dotenv doesn't override, D10): `<VAR>=<value> pnpm --filter aj-classes-e2e exec playwright test --list > $SCR/g.out 2>&1; echo $?`; then `lsof -nP -iTCP:5173 -sTCP:LISTEN \| wc -l`. (a) `WEB_BASE_URL=https://example.supabase.co`; (b) `SUPABASE_REST_URL=https://example.supabase.co`; (c) `MAILPIT_URL=http://10.0.0.5:55324`; (d) `PG_HOST=db.example.supabase.co`; (e) `ADMIN_EMAIL=` (set, empty) | (a) `Config error: WEB_BASE_URL must be localhost or 127.0.0.1, not "example.supabase.co"`; (b) the same for `SUPABASE_REST_URL`; (c) `… MAILPIT_URL must be localhost or 127.0.0.1, not "10.0.0.5"`; (d) `Config error: PG_HOST must be localhost or 127.0.0.1, not "db.example.supabase.co"`; (e) `Missing required environment variable(s): ADMIN_EMAIL.` and the hint ``Run `node e2e/scripts/local-env.mjs > e2e/.env` with the local stack up (docs/testing/ci-gates.md).``. Each exit ≠ 0; nothing on 5173 (`0`) | — |
| E-23 | 6.2 | E2E smoke (in-repo) | The smoke runs the five journeys against the local stack and cleans up | 1. `node e2e/scripts/local-env.mjs > e2e/.env && pnpm --filter aj-classes-e2e test:smoke 2>&1 \| tee $SCR/E-23.log`. 2. Kill 5173. 3. `q "select count(*) from public.profiles where email like 'e2e-%'"`; `q "select count(*) from public.posts where title like 'e2e-%'"`; `q "select count(*) from public.enquiries where email like 'e2e-%'"`. 4. `git status --porcelain` | 1: `9 passed`, 0 failed, 0 skipped, 0 flaky; the 9 titles of §1 exactly; duration recorded (1.8 min per dev notes **[measure]**). 2: port free. 3: `0`, `0`, `0`. 4: empty (`e2e/.env`, `e2e/playwright-report/`, `e2e/test-results/` are ignored). Hosted guard: 0 attempts (each test would fail otherwise) | DB, D |
| E-24 | 6.2 | Journeys and dual surface | The smoke covers the four journeys plus invite onboarding; data-writing specs assert the row; every spec is guarded | 1. Map the 9 titles to 01b's journeys. 2. Per spec: `grep -cE '\bdb\.\|anonDb\|poll' e2e/tests/<spec>`. 3. `grep -c 'mockWeb3Forms' e2e/tests/register-interest.spec.ts`. 4. `grep -l "from '../src/fixtures/test-fixtures.js'" e2e/tests/*.spec.ts \| wc -l`; `grep -c 'auto: true' e2e/src/fixtures/hosted-guard.ts`; `grep -c "from './hosted-guard.js'" e2e/src/fixtures/test-fixtures.ts`. 5. `jq -r '.scripts["test:smoke"]' e2e/package.json` | 1: home + Our Approach → 7; Register Interest → 8; staff sign-in with two-step → 9; admin post → `/posts` → 1, 2 (and 3 to 5); invite onboarding → 6 (01b assumption 5: in the smoke). 2: `admin-posts` ≥ 1, `invite-onboarding` ≥ 1, `register-interest` ≥ 1 (19, 10, 4 on this branch); `our-approach` `0` and `staff-login` `0`, both unchanged from `488dde1` (E-12; ruling R1). 3: `≥ 1` (Web3Forms mocked, as before). 4: `5` (all specs); `1`; `≥ 1`. 5: exactly `playwright test` (no `--grep-invert`: invite onboarding stays in) | — |
| E-25 | 6.14 (N-18) | Hosted guard proof (H1) | A spec that tries a `*.supabase.co` request fails, and the request never leaves the browser | 1. Uncommitted edit: in `e2e/tests/our-approach.spec.ts`, after `await page.goto('/#approach');` add `await page.evaluate(() => fetch('https://example.supabase.co/rest/v1/').then(() => 'sent', () => 'aborted'));`. 2. `pnpm --filter aj-classes-e2e exec playwright test -g "Our Approach" 2>&1 \| tee $SCR/E-25.log`. 3. `git restore e2e/tests/our-approach.spec.ts`; `git status --porcelain`. 4. Kill 5173 | 2: `1 failed`; the failure message contains `requests to a hosted Supabase project` and lists `https://example.supabase.co/rest/v1/`; the trace is kept under `e2e/test-results/` (`trace.zip` present). 3: empty. The only `supabase.co` URL is H1's own probe, aborted by `context.route` | DB, D |
| E-26 | 6.14 (edge) | Hosted URL refused at start-up (ruling R2) | A hosted-style `VITE_SUPABASE_URL` in the shell stops the run before the dev server or any browser starts | 1. Port 5173 free; `ls -d e2e/test-results/our-approach* 2>/dev/null \| wc -l` (before). 2. `VITE_SUPABASE_URL=https://example.supabase.co pnpm --filter aj-classes-e2e exec playwright test -g "Our Approach" > $SCR/E-26.log 2>&1; echo $?`. 3. `grep -c 'Config error: VITE_SUPABASE_URL must be localhost or 127.0.0.1, not "example.supabase.co"' $SCR/E-26.log`; `lsof -nP -iTCP:5173 -sTCP:LISTEN \| wc -l`; `grep -c 'Web dev server unreachable' $SCR/E-26.log`; `ls -d e2e/test-results/our-approach* 2>/dev/null \| wc -l`. 4. Repeat step 2 with `VITE_SUPABASE_FUNCTIONS_URL=https://example.supabase.co/functions/v1` (and `VITE_SUPABASE_URL` left local) | 2: exit ≠ 0. 3: `1` (`assertLocalDevServerEnv` runs first in `globalSetup`, before the probes); `0` (no dev server started); `0` (the "attempting to start it" warning never printed); no new `our-approach*` result folder (no test ran). 4: exit ≠ 0, with `Config error: VITE_SUPABASE_FUNCTIONS_URL must be localhost or 127.0.0.1, not "example.supabase.co"`, 5173 still free. Nothing is sent: the check throws before any process that could make a request starts (the value never reaches a browser) | — |
| E-27 | Regression | External suite | The frozen external suite, pointed at this worktree, still gives the same 9 | Before: `env \| grep -E '^VITE_SUPABASE_[A-Z_]*URL='` (names and values: URLs only, never keys). `(cd ~/dev/work/aj_classes-e2e && AJ_CLASSES_DIR=/Users/sjain/dev/work/aj_classes-items-4-9 VITE_LEAD_CAPTURE=on VITE_FORM_ACCESS_KEY=local-placeholder npx playwright test)` with the §1 base exports (dev notes O3). While the 5173 server it started is up, read that process's env: `ps eww -o command= -p $(lsof -t -nP -iTCP:5173 -sTCP:LISTEN \| head -1) \| tr ' ' '\n' \| grep -E '^VITE_SUPABASE_[A-Z_]*URL='`. Then kill 5173; the `e2e-%` counts as in E-23; `git -C ~/dev/work/aj_classes-e2e status --porcelain \| wc -l` | Env measure (this suite at `488dde1` has no hosted guard, so the guard can't count for it): exactly `VITE_SUPABASE_URL=http://127.0.0.1:55321`, no other `VITE_SUPABASE_*URL`, in the shell and in the 5173 process's env. `9 passed`, the same 9 titles as E-23; counts `0`; external repo `0` (only its ignored `test-results/` written) | DB, D |
| E-28 | 6.14 (edge) | Unset URL refused | A blank `VITE_SUPABASE_URL` is refused, because the dev server would fall back to the `apps/web/.env*` files | 1. Port 5173 free. `VITE_SUPABASE_URL= pnpm --filter aj-classes-e2e exec playwright test -g "Our Approach" > $SCR/E-28.log 2>&1; echo $?` (set and empty: dotenv doesn't override a variable that exists, so `e2e/.env`'s value doesn't fill it). 2. `grep -c 'Config error: VITE_SUPABASE_URL is not set, so the dev server would take its Supabase URL from apps/web/.env\* files. Set it to the local stack (e2e/.env or the CI job env).' $SCR/E-28.log`; `lsof -nP -iTCP:5173 -sTCP:LISTEN \| wc -l`. 3. Same with `VITE_SUPABASE_URL=' '` (a space) | 1: exit ≠ 0. 2: `1`; `0`. 3: the same message, exit ≠ 0, 5173 free | — |
| E-29 | 6.14 (edge) | Warm-up guard (H3) | A reused dev server that calls a `*.supabase.co` host fails global setup in the warm-up, with the request aborted | 1. Port 5173 free. Start a dev server by hand for a hosted-style project: `(cd apps/web && VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=proof-placeholder VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm dev --port 5173 --strictPort > $SCR/dev-hosted.log 2>&1 &)`; wait until `curl -s -o /dev/null http://localhost:5173/` answers. 2. With the normal local `e2e/.env` (so `assertLocalDevServerEnv` passes): `pnpm --filter aj-classes-e2e exec playwright test -g "Our Approach" > $SCR/E-29.log 2>&1; echo $?`. 3. `grep -o '\[global-setup\] The dev server at http://localhost:5173 requested a hosted Supabase project ([^)]*); stop it and re-run with the local settings.' $SCR/E-29.log`; `ls -d e2e/test-results/our-approach* 2>/dev/null \| wc -l` (vs before). 4. Stop the server: `lsof -t -nP -iTCP:5173 -sTCP:LISTEN \| xargs kill`; then the same `lsof` prints nothing | 2: exit ≠ 0. 3: exactly 1 line, naming a URL that starts `https://example.supabase.co/rest/v1/posts` (the News check on `/`, as item 5's E-23 measured: `rest/v1/posts?select=id&limit=1` **[measure: the exact query]**); no new result folder (no test ran). The request was aborted by `abortHostedSupabase`'s `context.route` (H3). 4: port 5173 free | D |

### Phase 3 — Lighthouse gate locally (AC-6.6, 6.7, 6.8, 6.14; item 5 regression)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-30 | 6.6, 6.14 | Lighthouse build | The Lighthouse build has no Supabase config and no hosted ref | `lh_build > $SCR/lh-build.log 2>&1; echo $?`; `pnpm --filter web check:hosted-ref build/client; echo $?`; `nfiles`; `grep -rl '127.0.0.1:55321' apps/web/build/client \| wc -l`; `grep -rl local-placeholder apps/web/build/client \| wc -l`; `grep -c 'Stay in the loop' apps/web/build/client/index.html`; `find apps/web/build/client -name '*.html' \| wc -l` | Build exit 0. `check-hosted-ref: 0 files (of N scanned)`, exit 0, N = `nfiles` (153 per dev notes **[measure]**). Local origin **0** (no Supabase config at all) **[measure; expected from the empty variables]**. Placeholder `≥ 1`; `1` (subscribe form built in). **18** HTML files | — |
| E-31 | 6.6, 5.1 (regr.) | Mirror headers | The mirror enforces the committed public CSP with only the local origin substituted, and stubs analytics | `pnpm --filter web mirror > $SCR/mirror.log 2>&1 &`; wait until `curl -s -o /dev/null http://127.0.0.1:4173/` answers; `grep '^serve-mirror:' $SCR/mirror.log`; `hdr http://127.0.0.1:4173 <path>` for the six Lighthouse pages and `/nope`; `curl -s -o /dev/null -w '%{http_code} %{size_download}\n' http://127.0.0.1:4173/_vercel/insights/script.js`; stop the mirror (`lsof -t -nP -iTCP:4173 -sTCP:LISTEN \| xargs kill`) | Exactly 1 line `serve-mirror: http://127.0.0.1:4173 (Supabase http://127.0.0.1:55321)`. Six lines `200 csp=1 kind=public-local`; `/nope` `404 csp=1 kind=public-local`. Stub `200 0`. Port 4173 free afterwards | M |
| E-32 | 6.6, 6.7 | Lighthouse run | `pnpm --filter web lighthouse` (runbook default, installed Chrome) passes R1's medians on mobile | 1. `rm -rf apps/web/.lighthouseci apps/web/lighthouse-report` (gitignored). 2. `pnpm --filter web lighthouse > $SCR/lhci.log 2>&1; echo $?`. 3. `ls apps/web/.lighthouseci/lhr-*.json \| wc -l`. 4. With `jq -s` over the LHRs: per `requestedUrl` the count, `configSettings.formFactor`, `configSettings.screenEmulation.mobile`, and the median (the middle of 3) of each category score; `.[0].environment.hostUserAgent`. 5. `ls apps/web/lighthouse-report \| sed -E 's/.*\.report\.(html\|json)$/\1/' \| sort \| uniq -c`; `jq length apps/web/lighthouse-report/manifest.json`. 6. `grep -ciE 'storage\.googleapis\|temporary-public-storage' $SCR/lhci.log`; `lsof -nP -iTCP:4173 -sTCP:LISTEN \| wc -l` | 2: exit `0`. 3: **18**. 4: 6 URLs × 3; every run `mobile` and `true`; medians per page: performance ≥ 0.90, accessibility ≥ 0.90, best-practices ≥ 0.90, SEO = **1.00** (dev notes §4: 94 / 97–100 / 100 / 100 **[measure]**); the Chrome version recorded. 5: `18 html`, `18 json`, plus `manifest.json` with **18** entries. 6: `0` (never public storage); `0` (LHCI stopped its mirror) | M |
| E-33 | 6.8, 6.14 | Report step | `lighthouse:report` prints the JS table, finds 0 `supabase.co`, and writes the step summary | 1. `GITHUB_STEP_SUMMARY=$SCR/sum.md pnpm --filter web lighthouse:report > $SCR/rep.out 2> $SCR/rep.err; echo $?`. 2. `cat $SCR/rep.out`; `wc -c < $SCR/rep.err`; `grep -c '### JavaScript transferred per page (median)' $SCR/sum.md`. 3. Cross-check with `jq` over the 18 LHRs: `[.audits["network-requests"].details.items[].url \| select(contains("supabase.co"))] \| length` and the `inspector-issues` sub-item URLs containing `supabase.co`; the `resource-summary` `script` `transferSize` per run | 1: exit `0`. 2: stdout is `### JavaScript transferred per page (median)`, a blank line, `\| Page \| JS (KB) \|`, `\| --- \| ---: \|`, exactly 6 rows for `/`, `/programmes/vce`, `/programmes/selective-entry`, `/resources`, `/resources/victorian-selective-entry-exam`, `/privacy` (each `\| <path> \| <n.n> \|`), a blank line, then `lighthouse-report: 18 runs, 0 supabase.co requests`; stderr `0` bytes; `1`. 3: `0` and `0` in every run; the JS medians match the table (bytes / 1024, 1 decimal). **AC-6.8 decision holds:** if every page's median is > 102,400 bytes, no size gate (E-15 step 4 `false`) and the TSR records the baseline (179–184 KB per dev notes **[measure]**). If every page is ≤ 102,400, the missing assertion is a bug (03b §6.6) | — |
| E-34 | 6.14 | Report fails closed | The report CLI refuses a missing, empty, unreadable or dirty result set | Copies in `$SCR/lhr-<n>/` of `apps/web/.lighthouseci/lhr-*.json`; each run `node apps/web/scripts/check-lighthouse-report.ts <dir>; echo $?` (stderr kept): (a) no argument; (b) `$SCR/nope`; (c) an empty dir; (d) one LHR with `{"url":"https://x.supabase.co/rest/v1/posts"}` added to `audits["network-requests"].details.items`; (e) one LHR with `audits["network-requests"].details` deleted; (f) one LHR with `audits["inspector-issues"].details.items` = `[{"subItems":{"items":[{"url":"https://x.supabase.co/rest/v1/posts?select=id"}]}}]`; (g) an extra `lhr-x.json` holding `{}` | (a) `lighthouse-report: no such folder: (none given); give the .lighthouseci folder`; (b) `lighthouse-report: no such folder: <dir>; give the .lighthouseci folder`; (c) `lighthouse-report: no lhr-*.json in <dir>; run lhci autorun first`; (d) stdout ends `lighthouse-report: 18 runs, 1 supabase.co requests`, stderr `  supabase.co request: https://x.supabase.co/rest/v1/posts`; (e) `lighthouse-report: <file>: no network-requests list for <url>; the audit may have errored` (security S2); (f) `18 runs, 1 supabase.co requests` and the blocked URL on stderr (D4); (g) `lighthouse-report: lhr-x.json: not a Lighthouse result: no requestedUrl`. Every case exit `1`. All fixtures are files in `$SCR`; no request is made | — |
| E-35 | 6.6, 5.3 (regr.) | CSP sweep as in CI | `test:csp` passes with none of the E2E settings, as in the Lighthouse job | 1. `mv e2e/.env $SCR/e2e.env.keep` (gitignored file, moved back in step 4). 2. `grep -rnE "src/(config\|db\|mail\|auth)\|test-fixtures" e2e/csp e2e/playwright.csp.config.ts e2e/src/fixtures/hosted-guard.ts e2e/src/mocks \| wc -l`; `grep -n "LOCAL_LEADS_URL =" e2e/src/mocks/public-services.ts`. 3. `env -u SUPABASE_ANON_KEY -u SUPABASE_SERVICE_ROLE_KEY -u VITE_SUPABASE_PUBLISHABLE_KEY pnpm --filter aj-classes-e2e test:csp 2>&1 \| tee $SCR/E-35.log`. 4. `mv $SCR/e2e.env.keep e2e/.env`; port 4173 free | 2: `0` (the import rule, 03b §6.4); `const LOCAL_LEADS_URL = 'http://127.0.0.1:55321/functions/v1/leads';` (only the local origin is mocked, security S3). 3: `19 passed`, the 19 titles of §1, 0 failed; the guard saw 0 hosted attempts. 4: `e2e/.env` back; `0` listeners on 4173 | M |

### Phase 4 — structured data locally (AC-6.9, 6.10)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-40 | 6.9, 6.14 | Gate run | The structured-data build passes the check | `sd_build > $SCR/sd-build.log 2>&1; echo $?`; `pnpm --filter web check:hosted-ref build/client; echo $?`; `pnpm --filter web check:structured-data > $SCR/sd.out 2> $SCR/sd.err; echo $?`; `cat $SCR/sd.out`; `wc -c < $SCR/sd.err` | Build exit 0. `check-hosted-ref: 0 files (of N scanned)`, exit 0. Exit `0`; stdout exactly `check-structured-data: 18 pages, 0 problems`; stderr `0` bytes | — |
| E-41 | 6.9 | Independent cross-check | The real build carries the right types and URLs, measured by a separate script | `$SCR/sd-cross.mjs` (written at run time, **not** importing `apps/web/scripts`): for each `build/client/**/*.html`, extract every `<script type="application/ld+json">`, `JSON.parse`, flatten `@graph`, list each node's `@type`; walk every value and collect keys `url`, `item`, `logo`, `image`, `@id`, `sameAs`, `review`, `aggregateRating`, and any `@type` `Review`/`AggregateRating` | Blocks: **1** on `index.html`, on each of the 9 `programmes/*/index.html` and on `resources/victorian-selective-entry-exam/index.html` (11 pages); **0** elsewhere (as item 5's E-28). Home: one node whose `@type` includes both `EducationalOrganization` and `LocalBusiness`, plus `WebSite` and `FAQPage` (every `Question` has `acceptedAnswer.text`). Each programme page: `Course` (with `name`, `description`, `provider.name`) and `BreadcrumbList` (every `ListItem` has numeric `position`, `name`, `item`). The guide: `Article` and `BreadcrumbList`. Every `url`/`item`/`logo`/`image`/`@id` value equals `https://ajclasses.com.au` or starts `https://ajclasses.com.au/`; every `sameAs` starts `https://`; `Review`, `AggregateRating`, `review`, `aggregateRating`: **0** | — |
| E-42 | 6.9, 6.10 | Unit tests | One unit test per invalid state, plus the page kinds | `pnpm --filter web exec vitest run scripts/structured-data.test.ts scripts/lighthouse-report.test.ts --reporter=verbose 2>&1 \| tee $SCR/E-42.log` | `Test Files  2 passed (2)`, `Tests  34 passed (34)` (25 + 9). Present and passing (match on the title text; Vitest prints ` > ` between names): `checkPage: invalid states (AC-6.10)` › `broken JSON`, `a missing required property`, `a relative URL`, `a non-production URL`, `a review or rating`, `a review property on another node`, `a sameAs link that is not absolute https`; `missingPageKinds` › `names each kind a partial build lacks, so its rules cannot switch off silently`; `reportFor` › `fails a result whose network-requests audit has no list, so it cannot pass unseen` | — |
| E-43 | 6.10 | CLI invalid states (real-build copies) | The CLI names the file and the problem for each invalid state, on real pages | For each mutation: `cp -R apps/web/build/client $SCR/sd-<x>`; mutate with `$SCR/sd-mutate.mjs` (parse the block, change one thing, write it back as compact JSON), then `node apps/web/scripts/check-structured-data.ts $SCR/sd-<x> > o 2> e; echo $?`. (a) `programmes/vce/index.html`: break the JSON (`{"@context"` → `{"@context",`). (b) delete `Course.provider`. (c) set `Course.provider.name` to `""`. (d) set breadcrumb item 3's `item` to `/programmes/vce`. (e) set `Course.url` to `http://localhost:5173/`. (f) the guide: append `{"@type":"Review","reviewBody":"x"}` to `@graph`. (g) the guide: set `Article.@type` to `["Article","Review"]`. (h) `Course.url` = `https://ajclasses.com.au.example.com/`. (i) `Course.url` = `https://www.ajclasses.com.au/programmes/vce`. (j) home: one `sameAs` set to `http://example.com/x`. (k) delete `programmes/` and `resources/victorian-selective-entry-exam/` from the copy. (l) an empty dir. (m) `$SCR/nope`. (n) no argument | (a) to (j): exit `1`; stdout `check-structured-data: 18 pages, 1 problems`; stderr one line: (a) `  programmes/vce/index.html: JSON-LD block 1 is not valid JSON (` + Node's reason + `)`; (b) `… Course is missing "provider"`; (c) `… Course is missing "provider.name"`; (d) `  programmes/vce/index.html: "item" is "/programmes/vce", not an absolute https://ajclasses.com.au URL`; (e) `… "url" is "http://localhost:5173/", not an absolute https://ajclasses.com.au URL`; (f) `  resources/victorian-selective-entry-exam/index.html: has a node of type Review, which the site must not publish (R1 F6.4.3)` (AC-6.10's "a `Review` block", which no unit test uses as a standalone node); (g) the same line; (h) `… "url" is "https://ajclasses.com.au.example.com/", not an absolute https://ajclasses.com.au URL`; (i) the same for the `www` URL; (j) `  index.html: "sameAs" is "http://example.com/x", not an absolute https:// URL`. (k) exit `1`, stdout `check-structured-data: 8 pages, 0 problems` **[re-check: 18 − 10 removed]**, stderr `check-structured-data: no programme, guide page in <dir>; is it a full build?`. (l) `check-structured-data: 0 pages, 0 problems` and `check-structured-data: no home, programme, guide page in <dir>; is it a full build?`, exit `1`. (m) `check-structured-data: no such folder: <dir>`, exit `1`. (n) `check-structured-data: no such folder: (none given)`, exit `1` | — |

### Phase 5 — runbook from a clean worktree (AC-6.12)

Follow `docs/testing/ci-gates.md` **literally**, in `$SCR/ci-check`. Record every command as typed. Any
command the page doesn't give but the run needs is a doc gap, recorded in the case.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-50 | 6.12 | Clean worktree | A fresh detached worktree of HEAD | `git worktree add --detach "$SCR/ci-check" HEAD`; `git -C "$SCR/ci-check" status --porcelain \| wc -l`; `ls -a "$SCR/ci-check/e2e" \| grep -cxE '\.env\|node_modules'`; `ls "$SCR/ci-check/node_modules" 2>&1 \| head -1` | `0`; `0`; "No such file or directory" (nothing installed yet) | CC |
| E-51 | 6.12, 6.2 | Runbook: E2E smoke | The intro's install step and the "E2E smoke" section, from a clean worktree | Port 5173 free. In `$SCR/ci-check`, run in order exactly as the page gives them: `pnpm install` (the intro), then the section's `pnpm db:start`, `node e2e/scripts/local-env.mjs > e2e/.env`, `pnpm --filter aj-classes-e2e exec playwright install chromium`, `pnpm --filter aj-classes-e2e test:smoke`, and the page's `lsof … \| xargs kill`. Any extra command the run needs is recorded as a doc gap | No extra command needed. `pnpm install` exit 0 (it installs `apps/web` and `e2e/` together); `pnpm db:start` reports the running stack and exits 0; `9 passed` (the 9 titles); 5173 free after the kill. The global setup starts the dev server from `$SCR/ci-check` (`AJ_CLASSES_DIR=..`): the dev-server process's `cwd` (`lsof -a -d cwd -p <pid>`) is under `ci-check` | CC, DB, D |
| E-52 | 6.12, 6.6 | Runbook: Lighthouse | The "Lighthouse" section, from the clean worktree | Run its five commands in order (the build line exactly as written, `check:hosted-ref`, `lighthouse`, `lighthouse:report`, `test:csp`); 4173 free after | Build exit 0; `check-hosted-ref: 0 files (of N scanned)`; LHCI exit 0; `lighthouse-report: 18 runs, 0 supabase.co requests`; `19 passed` | CC, M |
| E-53 | 6.12, 6.9 | Runbook: structured data | The "Structured data" section, from the clean worktree | Run its three commands in order | `check-hosted-ref: 0 files (of N scanned)`; `check-structured-data: 18 pages, 0 problems`, exit 0 | CC |
| E-54 | 6.12 | Other docs claims; clean-up | README's `web` mapping, the setup error hint, and the worktree removed | 1. `grep -c 'with the build run as `VITE_APP_ENV=production pnpm build`' README.md`; `sed -n '/^  web:/,/^  database:/p' .github/workflows/ci.yml \| grep -c 'VITE_APP_ENV: production'`. 2. `grep -c 'See docs/testing/ci-gates.md ("E2E smoke") for preconditions.' e2e/setup/global-setup.ts`; `grep -c '^## E2E smoke' docs/testing/ci-gates.md`. 3. `git -C "$SCR/ci-check" status --porcelain \| wc -l`; `git worktree remove "$SCR/ci-check"; echo $?`; `git worktree list \| grep -c ci-check` | 1: `1`; `1` (the README names the build setting CI's `web` job uses; a plain `pnpm build` stops at the G1 guard by design). 2: `1`; `1` (the hint names a section that exists). 3: `0` (all run output is gitignored); `0`; `0` | CC |

### Phase 6 — the workflow under `act` (path B, all green)

Ports 4173 and 5173 free on the host. `act` copies the working tree as it is, without gitignored files.
Keep the raw logs in `$SCR/act-logs` (they hold local keys, S4).

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-60 | 6.1 | Job list | `act` sees the five jobs | `act -l 2>/dev/null` | Same 5 rows as E-13 step 1 | A |
| E-61 | Regression | `web` ×3 | The existing `web` job is green, three times (ruling R3) | `actjob web web-1`; `actjob web web-2`; `actjob web web-3`; for each: `cat $EVD/act-web-<n>.txt` | Each: `Test Files  56 passed (56)`, `Tests  496 passed (496)`, and the e2e unit summary `pass 6` / `fail 0` (root `pnpm test` runs both); `✅  Success - Main pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `Build (production settings, as Vercel builds it)`; `🏁  Job succeeded`; `exit 0`; `ref 0`. Wall time recorded (40–56 s per dev notes, K4). Any red run: fail, with the failing test titles (R3; dev notes §11 B: `setupUser()` with `delay: null` in `ProfileForm.test.tsx` and `admin-posts.test.tsx`) | A |
| E-62 | 6.1, 6.9 | `structured-data` | The Structured data job is green | `actjob structured-data sd` | `check-hosted-ref: 0 files (of N scanned)`; `check-structured-data: 18 pages, 0 problems`; `✅  Success - Main JSON-LD on every pre-rendered page`; `🏁  Job succeeded`; `exit 0`; `ref 0 hosts ` (none) | A |
| E-63 | 6.1, 6.6, 6.8, 6.14 | `lighthouse` | The Lighthouse job is green, CI-exact (Playwright's Chromium, `--no-sandbox`) | `actjob lighthouse lh`; `unzip -l $SCR/act-artifacts/lh/*/lighthouse-report/lighthouse-report.zip \| tail -1`; `ls $SCR/act-artifacts/lh/*/` | In order: `✅  Success - Main Build with no Supabase config (never the hosted project)`, `check-hosted-ref: 0 files (of N scanned)`, `✅  Success - Main Lighthouse uses Playwright's Chromium`, `✅  Success - Main Lighthouse (mobile, median of 3; thresholds in apps/web/lighthouserc.json)`, `lighthouse-report: 18 runs, 0 supabase.co requests`, `✅  Success - Main No Supabase requests; JS size per page`, `19 passed`, `✅  Success - Main CSP sweep on the mirror (item 5, AC-5.3 and AC-5.8)`, `🏁  Job succeeded`; `exit 0`; `ref 0 hosts ` (none). Artifact: only `lighthouse-report/` (no `csp-report` on a pass), its zip **37** files. Wall time ≤ 10 min (about 4.8 min per dev notes, K4) | A |
| E-64 | §0, risk 1a | Stack hand-off | The local stack and its volume are gone before the `act` jobs that start Supabase (the corrected runbook) | Follow the `act` section's "Before" step: `supabase stop --no-backup`; `docker ps -a --filter name=_aj_classes -q \| wc -l`; `docker volume ls -q \| grep -c aj_classes` | `0`; `0`. (This deletes local data on purpose: hard rule 5) | DB |
| E-65 | Regression | `database` | The existing `database` job applies every migration fresh and passes | `actjob database db`; `grep -c 'Applying migration' $EVD/act-db.txt`; `grep 'Applying migration' $EVD/act-db.txt \| tail -1`; then the "After" step: `supabase stop --no-backup`, and E-64's two counts again | `14`; `Applying migration 20261026100000_staff_phone_edit.sql...`; `Seeding data from supabase/seed.sql...`; `Files=14, Tests=507`; `Result: PASS`; `✅  Success - Main Start a local database with every migration`; `✅  Success - Main Database tests (row-level security, functions, triggers)`; `🏁  Job succeeded`; `exit 0`. Afterwards `0` and `0` | A |
| E-66 | 6.1, 6.2, 6.3, 6.14 | `e2e` | The E2E smoke job is green against its own fresh stack, with keys masked | `actjob e2e e2e`; `grep -aE 'Success - Main' $EVD/act-e2e.txt`; in the raw log: `grep -ac 'Started supabase local development setup' $SCR/act-logs/e2e.log`; for each of the three local key values (from E-20's `$SCR/le.out`, never printed): `grep -acF "$value" $SCR/act-logs/e2e.log`; `grep -acE 'eyJ[A-Za-z0-9_-]{20,}\|sb_secret_\|sb_publishable_[A-Za-z0-9_]{8,}' $SCR/act-logs/e2e.log`; `grep -ac '\*\*\*' $SCR/act-logs/e2e.log`; `grep -c 'Applying migration' $EVD/act-e2e.txt`; `grep 'Applying migration' $EVD/act-e2e.txt \| tail -1`; `grep -c 'Seeding data from supabase/seed.sql' $EVD/act-e2e.txt`; then `supabase stop --no-backup` and E-64's counts | Steps in this order, each `✅  Success - Main`: `No hosted project reference in the workflow or the specs` (with `check-hosted-ref: 0 files (of 29 scanned)`), `pnpm --filter aj-classes-e2e typecheck`, `supabase/setup-cli@v1`, `Start local Supabase (only the services the specs use)`, `Local keys into the job env (masked)`, `pnpm --filter aj-classes-e2e exec playwright install --with-deps chromium`, `E2E smoke (global setup starts the dev server on 5173)` with `9 passed`; no `e2e-report` upload (the step is skipped on success); `🏁  Job succeeded`; `exit 0`; `ref 0 hosts ` (none). `Started supabase…` `1` (that line is on stderr, which `> /dev/null` keeps; the key table on stdout is dropped). S4 measures: each of the three key values `0` in the log **[measure: if `act` doesn't apply `::add-mask::`, record and move the check to P-06]**, key shapes `0`, `***` `≥ 1`. AC-6.2 fresh stack: `14` `Applying migration` lines, the last `Applying migration 20261026100000_staff_phone_edit.sql...`, and `1` `Seeding data from supabase/seed.sql...`. Afterwards `0` and `0`. Wall time ≤ 15 min (3 min 40 s per dev notes, K4) | A |

### Phase 7 — deliberate failures under `act` (uncommitted edits, each undone in the same case)

The stack stays stopped (E-66's "After"). Before each edit: `git status --porcelain` empty and
`H0=$(git rev-parse HEAD)`. After each `git restore`: `git status --porcelain` empty and HEAD = `$H0`.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-70 | 6.1, 6.5 | Broken spec | A wrong heading fails the E2E smoke job and uploads the report and trace | 1. `sed -i '' "s/{ name: 'Assess',/{ name: 'Assessment (deliberately wrong)',/" e2e/tests/our-approach.spec.ts`; `git diff --stat` shows 1 file, 1 line. 2. `actjob e2e broken`. 3. `Z=$(ls $SCR/act-artifacts/broken/*/e2e-report/e2e-report.zip)`; `unzip -l "$Z" > $EVD/E-70-zip.txt`; `grep -cE 'playwright-report/index\.html$' $EVD/E-70-zip.txt`; `grep -cE 'test-results/our-approach[^/]*/trace\.zip$' $EVD/E-70-zip.txt`; `grep -cE 'test-results/our-approach[^/]*/(video\.webm\|test-failed-1\.png)$' $EVD/E-70-zip.txt`. 4. `unzip -p "$Z" 'test-results/*/trace.zip' > $SCR/t.zip` and `unzip -p $SCR/t.zip \| grep -ac unzjnxctkyahtmrkinyr`; `unzip -p $SCR/t.zip '*.network' \| grep -aEo '"url":"https://[^"]*supabase\.co[^"]*' \| sort -u` (the trace's network log only: the dev-served supabase-js bundle holds doc-comment hosts such as `example`, `xyzcompany`, `project-id`, `myproject`, which aren't requests). 5. Keep the edit for E-71. Clear the stack the job left (D13; `ci-gates.md` "Afterwards"): `supabase stop --no-backup`, then E-64's two counts | 2: `1 failed` and `8 passed`; the failing test is `tests/our-approach.spec.ts:11:3 › Our Approach homepage section › renders all four steps, in order, each with one h3` with `Error: expect(locator).toHaveText(expected) failed`; `❌  Failure - Main E2E smoke (global setup starts the dev server on 5173)`; `Artifact e2e-report has been successfully uploaded!`; `🏁  Job failed`; exit ≠ 0. 3: `1`, `1`, `≥ 1`. 4: `0`; none (network log only). 5: `0` and `0`, so E-71's `database` run starts fresh. (Retention: P-03) | A |
| E-71 | 6.1 | "Only E2E fails" | With the broken spec still in place, the other four jobs stay green | `actjob database broken-db`, then `supabase stop --no-backup`; `actjob web broken-web`; `actjob structured-data broken-sd`; `actjob lighthouse broken-lh`. Then `git restore e2e/tests/our-approach.spec.ts`; `git status --porcelain`; HEAD = `$H0` | All four: `🏁  Job succeeded`, `exit 0`, with the same key lines as E-65, E-61, E-62 and E-63 (`web` includes `pnpm format:check`, which covers `e2e/`; the edited line is 92 characters, within Prettier's 100). After restore: empty; equal | A |
| E-72 | 6.14 (N-18) | Hosted-style URL (H2) | A Lighthouse build pointed at a `*.supabase.co` host fails "No Supabase requests", and nothing leaves the browser | 1. `grep -n "VITE_SUPABASE_URL: ''\|VITE_SUPABASE_PUBLISHABLE_KEY: ''" .github/workflows/ci.yml` (4 lines at `815135d`: 120, 121 in `lighthouse:` and 180, 181 in `structured-data:`). 2. Edit lines 120 and 121 only: `VITE_SUPABASE_URL: https://example.supabase.co`, `VITE_SUPABASE_PUBLISHABLE_KEY: proof-placeholder` (D6: both are needed for a request). `git diff --stat`: 1 file, 2 lines. 3. `actjob lighthouse hosted`. 4. From the `lighthouse-report` artifact's 18 `.report.json`: `network-requests` URLs containing `supabase.co` (count), and `inspector-issues` blocked URLs containing `example.supabase.co` (count per run). 5. `git restore .github/workflows/ci.yml`; `git status --porcelain`; HEAD = `$H0` | 3: `check-hosted-ref: 0 files (of N scanned)` (correct: it isn't the hosted ref); `✅  Success - Main Lighthouse (mobile, …)`; `lighthouse-report: 18 runs, 18 supabase.co requests` (one de-duplicated URL per run, per dev notes **[measure]**); `❌  Failure - Main No Supabase requests; JS size per page`; the CSP sweep now runs (`!cancelled()`): its result recorded (expected to fail on `connect-src` violations for `https://example.supabase.co` **[measure]**); `lighthouse-report` uploaded; `🏁  Job failed`; exit ≠ 0; `ref 0`; `hosts` lists only `example.supabase.co/`. 4: `0` in all 18 (nothing reached the network); `≥ 1` in every run. 5: empty; equal | A |
| E-73 | 6.7, review 5 #1 | Threshold miss | A missed Lighthouse threshold fails the job, and doesn't hide the other two results | 1. Edit `apps/web/lighthouserc.json` line 19 only: performance `"minScore": 0.9` → `"minScore": 1`. 2. `actjob lighthouse threshold`; `grep -ac 'categories:performance failure' $SCR/act-logs/threshold.log`. 3. `ls $SCR/act-artifacts/threshold/*/`. 4. `git restore apps/web/lighthouserc.json`; `git status --porcelain`; HEAD = `$H0` | 2: `❌  Failure - Main Lighthouse (mobile, median of 3; thresholds in apps/web/lighthouserc.json)` with `categories:performance failure` counted `6` (one per URL) **[measure: LHCI's exact line text recorded]**; then `lighthouse-report: 18 runs, 0 supabase.co requests` and `✅  Success - Main No Supabase requests; JS size per page`; `19 passed` and `✅  Success - Main CSP sweep on the mirror (item 5, AC-5.3 and AC-5.8)`; `🏁  Job failed`; exit ≠ 0. 3: `lighthouse-report/` (37 files, if LHCI uploads after a failed assertion as review 5 #6 says **[measure]**) and `csp-report/` (K8). If `act` doesn't evaluate `!cancelled()`, record it, and the check moves to P-07. 4: empty; equal | A |
| E-75 | 6.14, review 5 round 2 | Hosted-ref failure stops the job | A Lighthouse build that fails the hosted-ref check is never served: Lighthouse, the report and the CSP sweep all skip | Runs before E-74. 1. `sed -n '117p' .github/workflows/ci.yml` must be `        run: pnpm build` (the Lighthouse job's build; **[re-check]** the line). Edit that line only to `        run: pnpm build && cp apps/web/scripts/hosting-constants.ts apps/web/build/client/zz-hosted-probe.js` (plants a file that holds the hosted origin as text; nothing calls it, and the ref never appears in the command, so the log stays free of it). `git diff --stat`: 1 file, 1 line. 2. `actjob lighthouse hostedref`. 3. `grep -ac 'serve-mirror:' $SCR/act-logs/hostedref.log`; `grep -aE 'Main (Lighthouse \(\|No Supabase requests\|CSP sweep)' $SCR/act-logs/hostedref.log \| perl -pe 's/\e\[[0-9;]*m//g'`; `ls $SCR/act-artifacts/hostedref/ 2>/dev/null`. 4. `git restore .github/workflows/ci.yml`; `git status --porcelain`; HEAD = `$H0` | 2: `check-hosted-ref: 1 files (of N scanned)` with `  build/client/zz-hosted-probe.js`; `❌  Failure - Main No hosted project reference in the build`; `🏁  Job failed`; exit ≠ 0; `ref 0 hosts ` (none). 3: `0` (the mirror never started); **no** `Success`/`Failure` line for `Lighthouse (mobile, …)`, `No Supabase requests; JS size per page` or `CSP sweep on the mirror (…)` (all skipped; `act` doesn't print skipped steps **[measure: if it prints a skip line, record it; any run line for these three fails the case]**); no `lighthouse-report:` and no `passed` line; artifacts: none, or empty uploads (the `lighthouse-report` and `csp-report` steps still run, `always()`/`failure()`, and find no files: upload-artifact's "No files were found" warning) **[measure]**. 4: empty; equal | A |
| E-74 | 6.1 | History stays clean | No deliberate failure reached a commit (runs last in phase 7, after E-75) | `git log --format=%s develop..HEAD`; `git log -p develop..HEAD -- e2e/tests .github/workflows apps/web/lighthouserc.json \| grep -E '^\+' \| grep -cE 'deliberately wrong\|example\.supabase\.co\|zz-hosted-probe\|"categories:performance".*"minScore": 1\b'`; `git status --porcelain`; `git stash list \| wc -l` | The commit list is the branch's own commits only (the list recorded at freeze; no proof commit); `0` (checked on this branch); empty; `0` | — |

### Phase 8 — close-out

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| E-80 | §0 | Stack restored | The local stack is back, from this worktree, with the seed | `pnpm db:start`; §0 check 1 (mount `grep -c aj_classes-items-4-9`) and check 2 (newest migration); E-02 step 4 into `$SCR/snapshot-end.txt`; `diff` against the start, excluding the enquiries line | Mount `1`; `20261026100000`; `diff` empty (profiles **6**, posts **0**, `e2e-%` **0**). (The volume was rebuilt fresh, so the enquiries count is the seed's, recorded) | DB |
| E-81 | 6.14 | Hosted totals | No case made a hosted request | 1. `for f in $EVD/act-*.txt; do grep -H '^ref ' $f; done`. 2. `grep -lc unzjnxctkyahtmrkinyr $SCR/*.log $SCR/act-logs/*.log 2>/dev/null \| wc -l`. 3. Sum: the guard failures in E-23, E-35, E-51, E-52, E-66, E-71 (E-27 is env-only, no guard); the LHR counts in E-32, E-33, E-63, E-72, E-73; the warm-up attempts in E-29 | 1: every `ref 0`; `hosts` empty on every run except `act-hosted.txt` (`example.supabase.co/`, H2). 2: `0`. 3: hosted attempts **0** outside H1 (E-25, aborted), H2 (E-72, all CSP-blocked, 0 in `network-requests`) and H3 (E-29, aborted); E-26 and E-28 refused before any process started | — |
| E-82 | 6.3, S4 | Evidence and repo hygiene | No key in the evidence; nothing left running; repo clean | `grep -rlE 'eyJ[A-Za-z0-9_-]{20,}\|sb_secret_\|sb_publishable_[A-Za-z0-9_]{8,}' $EVD \| wc -l`; `find $EVD -name '*.zip' \| wc -l`; `lsof -nP -iTCP -sTCP:LISTEN \| grep -cE ':(4173\|5173) '`; `docker ps --format '{{.Names}}' \| grep -c '^act-'`; `git status --porcelain`; `git worktree list \| wc -l` | `0`; `0` (raw artifacts stay in `$SCR`); `0`; `0` (no `act` container left); only the untracked `docs/test-reports/2026-10-26-feature-ci-quality-gates/` and the uncommitted `TSR-item-6.md`; the same worktree count as before E-50 | — |

---

## 3. AC → case map

| AC | Pre-merge cases | Post-merge / post-release |
|---|---|---|
| 6.1 Every PR and push to `develop`/`main`; three named gate jobs; any failure fails | E-13, E-60, E-62, E-63, E-66, E-70, E-71, E-72, E-73, E-74, E-75 | P-01 (real check names, green) |
| 6.2 E2E smoke content: 4 journeys + invite; fresh local Supabase with migrations and seed; Web3Forms mocked; dual surface | E-12, E-23, E-24 (R1), E-27, E-51, E-66 | P-01 |
| 6.3 E2E safety: no hosted secret/URL/key; no `.env*` into git; `VITE_LEAD_CAPTURE` as job env | E-14, E-20, E-66, E-82 | P-06 (masks on GitHub) |
| 6.4 Time limits (E2E ≤ 15, others ≤ 10, workflow ≤ 20; 3 runs) | E-13 step 3 (limits set), E-61, E-63, E-66 (indicative, K4) | **P-02** |
| 6.5 Failing spec uploads report + traces, ≤ 7 days | E-70 (content) | **P-03** (retention) |
| 6.6 Lighthouse: mobile, production build, local or no Supabase, mirror CSP, stub, six pages, medians | E-15, E-30, E-31, E-32, E-35, E-52, E-63 | P-04 (x86), P-07 |
| 6.7 Thresholds never lowered; one config file | E-15, E-32, E-73 | — |
| 6.8 JS size reported; gate only if within budget | E-15 step 4, E-33, E-63 | P-07 (step summary on GitHub) |
| 6.9 Structured data on every pre-rendered page | E-40, E-41, E-42, E-53, E-62 | — |
| 6.10 Invalid states fail, naming file and problem; unit test each | E-42, E-43 | — |
| 6.11 Rich Results (manual, recorded) | — | **R-01** (post-release) |
| 6.12 Docs: each gate's local commands; old README superseded | E-18, E-50 to E-54 | — |
| 6.13 Dev dependencies dev-only, listed with reasons | E-16 | **P-08** (merge-commit body) |
| 6.14 No hosted requests: 0 refs in gate builds; 0 `supabase.co` requests; a failing CI step | E-01, E-14, E-19, E-21, E-22, E-25, E-26, E-28, E-29, E-30, E-33, E-34, E-35, E-40, E-63, E-66, E-72, E-75, E-81 | P-05 |
| Regression: existing `web` and `database` jobs (incl. the R3 test fix); existing E2E flows; item 5 CSP and hosted-ref checks | E-10, E-27, E-31, E-35, E-61, E-65, E-71 | P-01 |
| Safety, scope and code rules | E-01 to E-03, E-11, E-17, E-64, E-80, E-82 | — |

**Total: 54 pre-merge cases** (phase 0: 3, phase 1: 10, phase 2: 10, phase 3: 6, phase 4: 4, phase 5: 5,
phase 6: 7, phase 7: 6, phase 8: 3). The gate's pass rate counts these 54 only; BLOCKED counts as not
passed. §4's P and R cases are outside the count.

---

## 4. Post-merge on `develop` (not counted by the pre-merge gate)

**Counting rule.** These cases need GitHub's hosted runners, which path B doesn't use before the merge.
They're **not part of the pre-merge pass rate** and are neither PASS nor BLOCKED for the gate. The TSR
lists each one under "Not covered" with "post-merge, P-xx". Straight after `/test-and-ship` pushes the
`develop` merge, the team runs them and appends the results to `TSR-item-6.md` through a docs-only
`/test-and-ship` (04b T6.14). A failing P case is a bug, fixed forward on `fix/ci-quality-gates` before
T7.0, never by reverting or re-breaking `develop`. If Saurabh answers Q28 "yes" before the gate, P-01 to
P-07 run on the draft PR instead, and then they **are** counted.

`RUN` = the `CI` run for the merge commit: `gh run list --branch develop --workflow CI --limit 1 --json databaseId,headSha`.

| ID | AC | Area | Case | Steps | Expected (measurable) |
|---|---|---|---|---|---|
| P-01 | 6.1, 6.2 | Check names, green | The real run shows the five named checks, all green, on the merge SHA | `gh run view $RUN --json headSha,conclusion,jobs --jq '.headSha, .conclusion, (.jobs[] \| "\(.name) \(.conclusion)")'` | `headSha` = the merge commit; `success`; exactly `web success`, `database success`, `E2E smoke success`, `Lighthouse success`, `Structured data success` |
| P-02 | 6.4 | Three durations | Job and workflow wall times over 3 runs | Attempt 1 is the push. `gh run rerun $RUN` twice (wait for each; ask first, "For Saurabh" 3). For attempts 1 to 3: `gh api repos/splaytech/aj_classes/actions/runs/$RUN/attempts/<n>/jobs --jq '.jobs[] \| "\(.name) \(.started_at) \(.completed_at) \(.conclusion)"'`; workflow time = last `completed_at` − first `started_at` | Each attempt all `success`. E2E smoke ≤ 15 min, Lighthouse ≤ 10 min, Structured data ≤ 10 min, workflow ≤ 20 min, in all 3. If E2E goes over: `--grep-invert "Invite onboarding"` (03b §6.8) and invite onboarding goes under "Not covered". If Lighthouse comes close to 10 min, PO call, never a lowered threshold (O5) |
| P-03 | 6.5 | Retention | Artifacts are kept 7 days | `gh api repos/splaytech/aj_classes/actions/runs/$RUN/artifacts --jq '.artifacts[] \| "\(.name) \(.created_at) \(.expires_at)"'` | `lighthouse-report` present (`if: always()`), `expires_at` − `created_at` = 7 days (± 1 h). `e2e-report` and `csp-report` only appear on a failing run; their retention is the same `retention-days: 7` setting, measured on the first real failure (no failure is made on `develop`) |
| P-04 | 6.6 | x86-64 runner | The jobs ran on GitHub's x86-64 Ubuntu, and Lighthouse's Chromium works there with `--no-sandbox` (D5) | `gh run view $RUN --log --job <Lighthouse job id> \| grep -E 'Image: \|Version: \|Operating System' \| head -5`; the same log: `lighthouse-report: 18 runs, 0 supabase.co requests` and `19 passed` | Ubuntu 24.04 image, x86-64; Lighthouse step success with the two lines present |
| P-05 | 6.14 | Empty overrides on GitHub | The empty `VITE_SUPABASE_*` values really override `.env.production` on GitHub, and the pinned CLI is used | In the Lighthouse and Structured data logs: the `check-hosted-ref:` line after each build; in the database and E2E logs: the `supabase/setup-cli@v1` step's version line | Both `check-hosted-ref: 0 files (of N scanned)`; CLI `2.120.0` |
| P-06 | 6.3 | Masks on GitHub | No local key value shows in the E2E job log | `gh run view $RUN --log --job <E2E job id> > $SCR/gh-e2e.log`; for each local key value (from the CLI's defaults, never printed): `grep -cF "$value" $SCR/gh-e2e.log`; `grep -cE 'eyJ[A-Za-z0-9_-]{20,}\|sb_secret_\|sb_publishable_[A-Za-z0-9_]{8,}' $SCR/gh-e2e.log` | Each key value `0` (masked as `***` after the `local-env` step, and the `supabase start` table on stdout is dropped); key shapes `0`. (`Started supabase local development setup` is on stderr and may show: not a measure) |
| P-07 | 6.8, 6.6, review 5 #1 | Step summary and `!cancelled()` | The run's summary has the JS table; `!cancelled()` is honoured on GitHub if E-73 couldn't prove it under `act` | Read the run's summary page in the browser (no `gh` command returns the step summary), and the "No Supabase requests; JS size per page" step log (`gh run view $RUN --log --job <Lighthouse job id>`) | `### JavaScript transferred per page (median)` with 6 rows. `!cancelled()`: proven by E-73 under `act`; on GitHub only on a real Lighthouse miss (recorded then) |
| P-08 | 6.13 | Merge-commit body | The `--no-ff` merge commit lists the five dev dependencies with a reason each | `git log -1 --format=%B <merge sha>` (before the push, as part of T6.14) | Names `@playwright/test`, `pg`, `@types/pg`, `dotenv`, `@lhci/cli`, each with a one-line reason (review 5 #9) |

### Post-release (after the next production release; not counted)

| ID | AC | Area | Case | Steps | Expected (measurable) |
|---|---|---|---|---|---|
| R-01 | 6.11 | Rich Results | Google's Rich Results Test and the Schema Markup Validator on the live site | Run both public tools on `https://ajclasses.com.au/`, `/programmes/vce` and `/resources/victorian-selective-entry-exam`. No owner account needed | Rich Results: "Organization / LocalBusiness detected, no errors" (R1 F6 checklist), with the date; Course and Article/Breadcrumb items recorded; Schema Markup Validator 0 errors. K1's `og-image.png` 404 may show as a warning: record it, it's item 5's O1 |

## 5. Not covered here

1. Network capture at the host level for the `act` containers (the Supabase CLI's own update check, Docker pulls). The measure is the guard, the LHRs, `check:hosted-ref` and the log greps.
2. Browsers other than Chromium/Chrome for the CSP sweep and Lighthouse (dev notes §9).
3. A real GitHub failure run (artifact retention for `e2e-report` and `csp-report`; P-03) unless Q28 = yes.
4. ESLint over `e2e/` (review 5 #4 follow-up; only typecheck covers it).
5. Required status checks (Saurabh's optional setting; Q30).
6. **O1 (the `web` flake) on GitHub.** `TSR-item-6.md` carries it under "Not covered": the R3 fix
   (`setupUser()`, `delay: null`) is proven locally and under `act` only (E-10, E-61). It closes once
   the first GitHub `web` runs are green: P-01 and the three attempts of P-02. A red `web` attempt on
   GitHub reopens it as a bug, fixed forward before T7.0.
7. **Deferred security findings** (06-security): S1 (actions pinned to major tags, not SHAs), S5 (dev-dependency advisories under `@lhci/cli`), S6 (fork PRs run CI on a public repo: Saurabh's GitHub setting).
