APPROVED

# 06 — Security review: item 6 (CI quality gates)

> **Stage:** 6b of /deliver (Security, T6.13) · **Date:** 26 Oct 2026 · **Branch:** `feature/ci-quality-gates`, diff `git diff develop...HEAD` (51 files)
> **Context:** `splaytech/aj_classes` is public, so CI logs and artifacts are world-readable.
> **Rules kept:** no read of `supabase/.env.deploy` or any real key, no contact with the hosted project, no supabase start/stop/reset, builds or `act`, no edits or commits. Only `pnpm audit --prod` and `pnpm audit` were run, read-only.

**Verdict:** No blocking findings. Six non-blocking findings. S2 and S3 are cheap guard hardening and fit on this branch. S1 and S5 are follow-up chores. S4 is an accepted risk to record. S6 is a GitHub setting for Saurabh.

## Checked and fine (T6.13 list)

1. **No keys or hosted values in the diff.** Grepped the diff for JWT shapes (`eyJ…`), `sb_secret_`, `sb_publishable_<key>`, the hosted ref, `secrets.`, `pull_request_target` and `temporary-public-storage`. The only hit is the dev notes' sentence describing that grep. CI also runs `check:hosted-ref ../../.github/workflows ../../e2e` (ci.yml:80-81).
2. **`::add-mask::` is correct.** `e2e/scripts/local-env.mjs:61-63` writes one mask per key to **stderr** before the single stdout write (line 67).
   - stdout goes to `$GITHUB_ENV`; a mask on stdout would corrupt the env file, so stderr is right.
   - The Actions runner processes workflow commands from both stdout and stderr. `act` also showed `***`.
   - No later step echoes the keys.
   - `supabase status` stderr is dropped (line 31). A CLI failure or a non-local `API_URL` exits 1, so it fails closed.
3. **Only Supabase CLI local defaults reach the logs.** `supabase/config.toml` has `signing_keys_path` commented out (line 166) and no custom JWT secret.
4. **Artifacts are uploaded from the filesystem only.** `actions/upload-artifact@v4` (ci.yml:94, 143, 149), 7-day retention, hidden files skipped. `lighthouserc.json` uses `"upload": { "target": "filesystem" }`; `temporary-public-storage` is never used; no `LHCI_*` token.
5. **`permissions: contents: read` is kept** (ci.yml:19-20), with no job-level widening.
6. **Triggers and inputs are safe.** `push` (main, develop) and `pull_request` only; no `pull_request_target`, no `secrets.*`, no `${{ github.event.* }}` in `run:`.
7. **Env files.** `e2e/.env` is gitignored (`.gitignore:6`, `git check-ignore`). `e2e/.env.example` holds placeholders for the three keys; other values are loopback URLs, the Cloudflare always-pass test key, `local-placeholder`, and the seed admin credentials `supabase/seed.sql` already publishes.
8. **No secret-bearing files tracked.** No HAR, trace, zip, report folder, `.lighthouseci` or new `.env`. Item 6 adds the four report folders to `.gitignore`.
9. **The hosted guards fail closed.**
   - `e2e/src/config.ts:49-63,121-125` refuses non-loopback `WEB_BASE_URL`, `SUPABASE_REST_URL`, `MAILPIT_URL`, `PG_HOST`.
   - `hosted-guard.ts` is an `auto` fixture that aborts `*.supabase.co` and fails the test; every spec imports it.
   - `check-hosted-ref` exits 1 on a missing path or empty scan; `check-structured-data` on an empty folder or no `index.html`; `lighthouse-report` on no LHR or any `supabase.co` URL, including CSP-blocked attempts (D4).
   - The Lighthouse and structured-data builds set blank `VITE_SUPABASE_*`, backed by `check:hosted-ref build/client`.
10. **Lockfile clean.** All five new packages pinned exactly, registry-resolved with sha512 integrity; no new build-script allow-list.

## Findings

**S1 — Non-blocking. Actions pinned to mutable major tags, not commit SHAs.**
- **Where:** `.github/workflows/ci.yml:31-33, 52, 73-75, 82, 94, 107-109, 143, 149, 162-164`; third-party: `pnpm/action-setup@v4`, `supabase/setup-cli@v1`.
- **Risk:** a moved tag runs attacker code in every job. Limited today (no secrets, read-only token, CI doesn't deploy): worst case a forged gate result or a poisoned cache. The pattern already exists on `develop`.
- **Fix (separate `chore/` branch):** pin each `uses:` to a full SHA with a `# vX.Y.Z` comment; add `.github/dependabot.yml` for `github-actions`.

**S2 — Non-blocking. The Lighthouse `supabase.co` check passes if the `network-requests` audit is missing.**
- **Where:** `apps/web/scripts/lighthouse-report.ts:23-31, 51-54`.
- **Scenario:** `auditItems` returns `[]` with no `details.items`; an errored audit counts zero requests and passes without looking.
- **Fix:** in `reportFor`, fail when `audits['network-requests'].details.items` isn't an array; add one unit test. `inspector-issues` may stay optional.

**S3 — Non-blocking. `mockLeads` hides a hosted `leads` call from the hosted guard.**
- **Where:** `e2e/src/mocks/public-services.ts:31-33` (used at `e2e/csp/public-csp.spec.ts:98`).
- **Scenario:** `page.route` handlers match before `context.route`; the glob `**/functions/v1/leads` also matches a hosted URL, so the guard would never see it. Mitigated today by the mirror's CSP and lead capture being off in the Lighthouse build.
- **Fix:** scope the mock to the local origin.

**S4 — Non-blocking (accepted risk; record it). Local CLI keys appear in public logs and artifacts.**
- **Where:** `.github/workflows/ci.yml:86`, `e2e/playwright.config.ts:18-20`.
- **What:** `supabase start` prints the status table before any mask; `e2e-report` traces carry local keys, the seed admin password, the TOTP seed and session JWTs. Downloadable by any signed-in GitHub user for 7 days.
- **Why acceptable:** CLI fixed public defaults on a throwaway runner; no custom signing keys configured.
- **Condition:** only while `config.toml` keeps the default keys. Setting `signing_keys_path`, `jwt_secret` or real CI-provided `env(...)` values would publish them.
- **Fix:** record the condition in `docs/testing/ci-gates.md` ("The one rule") and the threat model; optionally `> /dev/null` on the `supabase start` step.

**S5 — Non-blocking. Dependency advisories.**
- `pnpm audit`: 9 high, 11 moderate, 4 low, 0 critical. None of `@playwright/test` 1.64.0, `pg` 8.23.1, `@types/pg` 8.23.1, `dotenv` 18.0.7 has an advisory.
- The five highs from `@lhci/cli` 0.15.1, judged for this use (filesystem upload, `CHROME_PATH`, local pages, no secrets):
  1. **basic-ftp** (GHSA-c475-qrg2-pj4r): only via a PAC/FTP proxy; CI sets none. Not reachable.
  2. **compression** (GHSA-vc2v-76pw-4v95): used by `lhci server`, never run. Not reachable via LHCI.
  3. **extract-zip** (GHSA-jmr9-qjv8-65gv, GHSA-7pqw-9j4j-h8q3): only on browser download; `CHROME_PATH` is supplied. Not reachable.
  4. **tmp** (GHSA-ph9p-34f9-6g65): needs an attacker-controlled prefix. Not reachable.
  5. **zod** (GHSA-mrhx-c7xc-m3w5): validates our own Chromium's messages; worst case a failed job.
- Moderate **uuid**: needs an attacker-controlled buffer. Not reachable. Others (`vite`, `@vitest/mocker`, `undici`, `source-map-js`, `fast-uri`) pre-date item 6.
- `pnpm audit --prod`: 1 high (`compression` via `serve`), 2 moderate and 2 low (`fast-uri` via `serve`), pre-existing; `serve` only runs the mirror and the dormant Railway config.
- **Fix:** accept the `@lhci/cli` tree (newest release); recheck when LHCI releases. Separately, add `pnpm.overrides` for `compression >=1.8.2` and `fast-uri >=3.1.9` (or move `serve` to devDependencies), and bump `vite`/`vitest` as their own chore.

**S6 — Non-blocking (Saurabh's GitHub setting). Fork PRs run CI on a public repo.**
- **Where:** `.github/workflows/ci.yml:17`.
- **What:** fork `pull_request` runs untrusted code with a read-only token and no secrets (correct model), but now starts Docker, Supabase and Chromium (`--no-sandbox`, ci.yml:137).
- **Risk:** runner-minute abuse only.
- **Fix:** Settings → Actions → General → "Require approval for all external contributors".

## Pending for Saurabh
1. Optional: the S6 Actions approval setting.
2. On the first real `develop` run, check the `local-env` step shows no key values and later steps show `***`.

## Next steps
1. Developer: S2 and S3 on this branch.
2. Docs: S4 condition in `docs/testing/ci-gates.md`.
3. Later `chore/` branches: S1 SHA pinning with Dependabot; S5 overrides or Railway clean-up.
