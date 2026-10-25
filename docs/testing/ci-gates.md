# CI quality gates: how to run each one locally

`.github/workflows/ci.yml` runs five jobs on every pull request and every push to `develop` and
`main`. Each one is its own named check, so a red check says which gate failed. This page gives
the same commands CI runs, from the repo root. The design is in
[03b §6](../delivery/2026-10-25-pending-requirements/03b-design-items-4-8.md) and
[ADR-0006](../decisions/0006-ci-gates-e2e-in-repo.md).

| Check on GitHub | What it proves | Local time (M-series laptop) |
| --- | --- | --- |
| `web` | format, lint, typecheck, unit tests, production build | about 1 min |
| `database` | pgTAP tests on a fresh local database | about 30 s |
| `E2E smoke` | the Playwright suite in `e2e/` on the dev server | about 2 min (plus the stack) |
| `Lighthouse` | mobile Lighthouse budget, no `supabase.co` requests, CSP sweep | about 4 min |
| `Structured data` | the JSON-LD on every pre-rendered page | under 1 min |

## The one rule: no hosted requests

Staging and prod share one hosted Supabase project, so no gate, locally or in CI, may reach it
(AC-6.14):

- E2E runs on the **dev server**, which never reads `apps/web/.env.production`. Its Supabase
  settings come from the local stack.
- Lighthouse and structured data run on a **production build with no Supabase config**: the
  blank `VITE_SUPABASE_*` values below override `.env.production`.
- `pnpm --filter web check:hosted-ref <paths>` must print `0 files` on every gate build, and on
  the workflow and `e2e/`. The mirror runs the same check and won't serve a build that fails it.
- Every E2E and CSP spec runs under `hostedSupabaseGuard`
  (`e2e/src/fixtures/hosted-guard.ts`), which aborts any `*.supabase.co` request and fails the
  test. `lighthouse:report` fails if any Lighthouse run requested, or tried to request, a
  `supabase.co` URL.
- No key is committed. `e2e/.env` is gitignored and generated from `supabase status`.

## E2E smoke

Needs Docker and the Supabase CLI. Port 5173 must be free, or must already be serving this
checkout's dev server with the settings below: global setup reuses a running server as it is.

```bash
pnpm db:start
```

```bash
node e2e/scripts/local-env.mjs > e2e/.env
```

```bash
pnpm --filter aj-classes-e2e exec playwright install chromium
```

```bash
pnpm --filter aj-classes-e2e test:smoke
```

- `local-env.mjs` writes every setting from `e2e/.env.example` and adds the local keys from
  `supabase status`. It refuses a stack whose API isn't `http://127.0.0.1:55321`.
- Global setup starts `pnpm --filter web dev` on 5173 if nothing is listening, with the
  `VITE_*` values from `e2e/.env`. It leaves that server running. Stop it afterwards:

  ```bash
  lsof -t -nP -iTCP:5173 -sTCP:LISTEN | xargs kill
  ```

- The suite never resets the database. Rows it creates carry an `e2e-<runId>-` marker and are
  deleted after each test.
- A failing test keeps its trace, video and screenshot in `e2e/test-results/`. The HTML report
  is in `e2e/playwright-report/`; open it with
  `pnpm --filter aj-classes-e2e exec playwright show-report`. In CI both folders are uploaded as
  the `e2e-report` artifact, kept for 7 days.
- **Adding a spec:** put it in `e2e/tests/`, import `test` and `expect` from
  `../src/fixtures/test-fixtures.js` (so it runs under the hosted guard), and assert both the UI
  and the database row (the suite's dual-surface rule).

This replaces the "Preconditions" in the old local `aj_classes-e2e` repo's README. That repo is
frozen; `e2e/` here is the suite's only home (ADR-0006).

## Lighthouse

```bash
VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 pnpm build
```

```bash
pnpm --filter web check:hosted-ref build/client
```

```bash
pnpm --filter web lighthouse
```

```bash
pnpm --filter web lighthouse:report
```

```bash
pnpm --filter aj-classes-e2e test:csp
```

- The build placeholders turn the enquiry form and the footer sign-up on, so the CSP sweep can
  use them. Web3Forms, Kit and `leads` are mocked; nothing is sent.
- `lighthouse` (`lhci autorun`) starts the mirror (`scripts/serve-mirror.ts --stub-analytics`) on
  `http://127.0.0.1:4173` and runs 3 mobile runs on each of six pages. The thresholds are in
  `apps/web/lighthouserc.json` and only there: Performance, Accessibility and Best Practices
  0.9, SEO 1, as medians (AC-6.6, AC-6.7). **Never lower them to pass.** Fix a small miss, or
  write it up for the Product Owner.
- Reports go to `apps/web/lighthouse-report/` (the `lighthouse-report` artifact in CI), never to
  LHCI's public temporary storage. Raw results are in `apps/web/.lighthouseci/`.
- `lighthouse:report` prints the median JavaScript per page and fails on any `supabase.co`
  request. Locally LHCI uses your installed Chrome. CI uses Playwright's Chromium instead
  (`CHROME_PATH`) with `--collect.settings.chromeFlags=--no-sandbox`; add both to match CI
  exactly.
- `test:csp` starts the mirror itself if 4173 is free. It needs none of the E2E settings.

## Structured data

```bash
VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= pnpm build
```

```bash
pnpm --filter web check:hosted-ref build/client
```

```bash
pnpm --filter web check:structured-data
```

- The check reads every `.html` file in `build/client`. It fails on JSON-LD that doesn't parse, on
  a missing type or required property, on a `url`/`item`/`logo`/`image`/`@id` that isn't an
  absolute `https://ajclasses.com.au` URL, on a `sameAs` that isn't absolute `https://`, and on
  any `Review` or `AggregateRating` (AC-6.9). Its unit tests run in the `web` job.
- Google's Rich Results Test has no API, so it stays a manual check on the live site after each
  production release (AC-6.11).

## Running the workflow itself with `act` (optional)

[`act`](https://github.com/nektos/act) runs a job from `ci.yml` in local Docker, on the working
tree as it is. It's a laptop tool (`brew install act`), not a repo dependency.

```bash
act pull_request -j structured-data -P ubuntu-latest=catthehacker/ubuntu:act-latest --artifact-server-path "$TMPDIR/act-artifacts" --env pnpm_config_store_dir=/root/.local/share/pnpm/store
```

- Swap `-j` for `web`, `database`, `e2e` or `lighthouse`.
- `--env pnpm_config_store_dir=…` keeps pnpm's store out of the copied workspace. Without it,
  `act` puts the store in `.pnpm-store/` and `pnpm format:check` fails on it. GitHub's runners
  don't need this.
- Before `database` or `e2e`, stop the local stack: they start containers with the same names
  and ports. Afterwards, clear what the job left and start the stack again:

  ```bash
  pnpm db:stop
  ```

  ```bash
  supabase stop --no-backup
  ```

  ```bash
  pnpm db:start
  ```

  `supabase stop --no-backup` deletes the local database volume: local data only, as
  `pnpm db:reset` does.
