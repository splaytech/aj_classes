# Dependabot alerts: developer notes

- **Date:** 2026-10-29
- **Branch:** `chore/dependabot-alerts` (from `origin/develop` at `82a60ef`)
- **Scope:** version bumps and overrides only. No new production dependency (CLAUDE.md
  "dependency-approval"). No database, Supabase or dev-server change.

## Source of the alert list

The GitHub token in use can't read the Dependabot alerts API (HTTP 403, "Resource not accessible
by personal access token"), so the list below comes from `pnpm audit` on the same lockfile.
GitHub reported 24 open alerts (9 high). `pnpm audit` found 29 advisories (12 high, 13 moderate,
4 low). It counts per advisory, so a package with several advisories shows up several times. The
counts differ because Dependabot and `pnpm audit` count in different ways. Recheck the GitHub list
once this branch is merged.

Every vulnerable package was a dev or tooling dependency except `compression` and `fast-uri`, which
come in through `serve`, the Railway static server (`start:railway`). Nothing in the browser bundle
was affected.

## Where the overrides live

pnpm 11 reads `overrides` from `pnpm-workspace.yaml`, not from the `pnpm` field in the root
`package.json`, so they are in `pnpm-workspace.yaml`. Each override has a version selector, so it
only changes copies that are still vulnerable, and it stays within the major version the parents
already use.

## Alert → action

| # | Package (resolved) | Advisory | Severity | Path | Action |
|---|---|---|---|---|---|
| 1 | vite 8.3.1 | GHSA-587h-7wmj-h5pm | high | `@react-router/dev`, `vitest` | **Bumped** devDep `vite` `^8.3.1` → `^8.3.3` (resolves 8.3.5) |
| 2 | vite 8.3.1 | GHSA-698v-4r3x-3vcv | moderate | same | Bumped (row 1) |
| 3 | vite 8.3.1 | GHSA-r825-w8mm-5pxw | moderate | same | Bumped (row 1) |
| 4 | vite 8.3.1 | GHSA-rq7h-c2jc-7f22 | moderate | same | Bumped (row 1) |
| 5 | vite 8.3.1 | GHSA-vfpm-58rq-9qcg | moderate | same | Bumped (row 1) |
| 6 | vite 8.3.1 | GHSA-9jrq-w75r-8gcw | low | same | Bumped (row 1) |
| 7 | @vitest/mocker 5.0.2 | GHSA-qxg6-89mg-rqv8 | moderate | `vitest` | **Bumped** devDep `vitest` `^5.0.2` → `^5.0.3` (resolves 5.0.5, mocker 5.0.5) |
| 8 | @vitest/mocker 5.0.2 | GHSA-xp26-3454-mjgp | moderate | `vitest` | Bumped (row 7) |
| 9 | undici 8.11.2 | GHSA-xjj6-f33q-929c | high | `jsdom` | **Overridden** `undici@>=8.0.0 <8.12.2` → `^8.12.2` |
| 10 | undici 8.11.2 | GHSA-4w7w-5xrc-9h26 | high | `jsdom` | Overridden (row 9) |
| 11 | undici 8.11.2 | GHSA-2m5v-pch6-74hx | high | `jsdom` | Overridden (row 9) |
| 12 | undici 8.11.2 | GHSA-qrxm-fqhp-jwvm | high | `jsdom` | Overridden (row 9) |
| 13 | undici 8.11.2 | GHSA-4qv8-2p9j-2685 | moderate | `jsdom` | Overridden (row 9) |
| 14 | undici 8.11.2 | GHSA-f72v-6w45-q472 | moderate | `jsdom` | Overridden (row 9) |
| 15 | undici 8.11.2 | GHSA-9fm3-97px-rjf6 | moderate | `jsdom` | Overridden (row 9) |
| 16 | undici 8.11.2 | GHSA-55wc-3pg8-jfw6 | moderate | `jsdom` | Overridden (row 9) |
| 17 | compression 1.8.1 | GHSA-vc2v-76pw-4v95 | high | `serve`, `@lhci/cli` | **Overridden** `compression@<1.8.2` → `^1.8.2` |
| 18 | source-map-js 1.2.1 | GHSA-68fv-2mgg-jv7q | high | `vite > postcss` | **Overridden** `source-map-js@>=1.0.0 <1.2.2` → `^1.2.2` |
| 19 | fast-uri 3.1.8 | GHSA-w74x-v6f9-j3xg | moderate | `serve > ajv` | **Overridden** `fast-uri@>=3.0.0 <3.1.9` → `^3.1.9` |
| 20 | fast-uri 3.1.8 | GHSA-wjr9-j795-jxcr | moderate | same | Overridden (row 19) |
| 21 | fast-uri 3.1.8 | GHSA-xhq7-xmqj-769h | low | same | Overridden (row 19) |
| 22 | fast-uri 3.1.8 | GHSA-333x-w4r6-6crp | low | same | Overridden (row 19) |
| 23 | zod 4.6.5 | GHSA-mrhx-c7xc-m3w5 | high | `eslint-plugin-react-hooks` | **Overridden** `zod@>=4.0.0 <4.6.6` → `^4.6.6` |
| 24 | tmp 0.0.33, 0.1.0 | GHSA-ph9p-34f9-6g65 | high | `@lhci/cli` | **Overridden** `tmp@<0.2.6` → `^0.2.6` (see note 1) |
| 25 | tmp 0.0.33, 0.1.0 | GHSA-52f5-9888-hmc6 | low | `@lhci/cli` | Overridden (row 24) |
| 26 | zod 3.25.76 | GHSA-mrhx-c7xc-m3w5 | high | `@lhci/cli > lighthouse > puppeteer-core > chromium-bidi` | **Deferred:** no 3.x fix. The only fix is zod 4, a major change under `chromium-bidi`. |
| 27 | extract-zip 2.0.1 | GHSA-jmr9-qjv8-65gv | high | `@lhci/cli > … > @puppeteer/browsers` | **Deferred:** the patched version (2.0.2) isn't on npm. Latest is 2.0.1. |
| 28 | extract-zip 2.0.1 | GHSA-7pqw-9j4j-h8q3 | high | same | **Deferred:** same as row 27 |
| 29 | basic-ftp 5.3.1 | GHSA-c475-qrg2-pj4r | high | `@lhci/cli > proxy-agent > … > get-uri` | **Deferred:** the fix is 6.2.1, a major change. The latest `get-uri` (8.0.1) still needs `^5.3.1`. |
| 30 | uuid 8.3.2 | GHSA-w5hq-g745-h8pq | moderate | `@lhci/cli` | **Deferred:** the fix is 11.1.1, a major change (8 → 11) under `@lhci/cli`, which asks for `^8.3.1`. |

Notes:

1. `tmp` is pre-1.0, so moving from 0.0/0.1 to 0.2 is technically a breaking change. `@lhci/cli`
   calls it once (`tmp.fileSync({ postfix: '.html' })` in `lhci open`), and that API is the same in
   0.2. The other user is `inquirer > external-editor`, which calls `tmp.tmpNameSync()` (also
   unchanged in 0.2) and only runs for the interactive `lhci wizard`. CI never runs that.
2. All five deferred advisories come only through `@lhci/cli@0.15.1`, which is already the latest
   version. They run only in the CI Lighthouse job, against this repo's own local build. They are
   never in the deployed site or the Railway server.
   Revisit when `@lhci/cli` (or `lighthouse` / `puppeteer-core`) ships updated dependencies; for
   zod 3, that means `chromium-bidi` moving to zod 4 and `puppeteer-core` picking it up. Or
   dismiss them in Dependabot as "risk is tolerable: dev-only tooling".
3. An earlier unfinished attempt (an uncommitted patch in an old worktree) made the same `vite` /
   `vitest` bumps and the `compression` / `source-map-js` overrides. Those were checked against the
   current audit and kept. The overrides now use a ranged selector and a `^` target so they can't
   pin below a later patch.

## Verification

`pnpm audit` went from 29 advisories (12 high) to 5 (4 high, 1 moderate), all deferred above.

Gate run by the team lead on 29 Oct 2026, after merging `develop` (`9059d0a`) into this branch,
against the local stack only. The steps mirror the CI jobs:

| Step | Result |
|------|--------|
| `pnpm install --frozen-lockfile` | Pass |
| `format:check`, `lint`, `typecheck` | Pass |
| `pnpm test` | Web 66 files / 581 tests; e2e unit 6 / 6 |
| `pnpm audit` | 5 advisories (4 high, 1 moderate): the five deferred above, no others |
| `pnpm db:reset`, `pnpm db:test` | Pass; 17 files / 747 tests |
| `pnpm test:functions` | 232 ok, 0 not ok |
| `test:smoke` (Playwright E2E) | 9 passed |
| CI-style build (empty Supabase config, `VITE_APP_ENV=production`) + `check:hosted-ref` | Pass; 0 of 154 files flagged |
| Lighthouse (7 URLs, 21 runs, Playwright Chromium) | All assertions met |
| `lighthouse:report` | 21 runs, 0 supabase.co requests |
| `test:csp` | 21 passed |

The build step inside `pnpm check` needs `VITE_APP_ENV` set, so the build was run as the CI
Lighthouse job runs it. A final `pnpm db:reset` left the seed in place.
