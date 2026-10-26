# BUG-13 — The runbook's "E2E smoke" section leaves out the job's e2e typecheck step

- **Item / case:** item 6, TSR-item-6 round 1, case **E-18** step 2 (AC-6.12)
- **Severity:** Low (docs only; CI itself is correct)
- **Build:** `feature/ci-quality-gates` @ `e83b81e` (code `815135d`)
- **Found:** 26 Oct 2026, Tester

## Steps to reproduce

1. List the `E2E smoke` job's commands: `sed -n '/^  e2e:/,/^  lighthouse:/p' .github/workflows/ci.yml | grep -E 'run:'`.
2. Look for each one in the runbook: `grep -cF 'aj-classes-e2e typecheck' docs/testing/ci-gates.md`.

## Expected

AC-6.12: `docs/testing/ci-gates.md` says how to run each gate locally "with the same commands CI
uses". The test plan's E-18 expects every gate script, `typecheck` included, to be in the doc,
with only three documented differences allowed (`> e2e/.env`, `playwright install` without
`--with-deps`, and the CI-only `CHROME_PATH` / `--no-sandbox`).

## Actual

The `E2E smoke` job runs `pnpm --filter aj-classes-e2e typecheck` (`ci.yml`, after the hosted-ref
step and before `setup-cli`; moved there in `b57e464`). The runbook's "E2E smoke" section has
no such step: the grep prints `0`. The only `typecheck` in the file is the summary table's `web`
row ("format, lint, typecheck, unit tests, production build"). Root `pnpm typecheck` covers e2e
(README), but the E2E section doesn't say so. Someone following the section can pass locally and
still have CI fail at the typecheck step.

## Evidence

- `docs/delivery/2026-10-25-pending-requirements/evidence-item-6/phase1c.txt` (the `== E-18` block:
  `aj-classes-e2e typecheck 0`, and the job's `run:` lines).

## Suggested fix

Add the step to the "E2E smoke" section, before `pnpm db:start`, as CI orders it:

```bash
pnpm --filter aj-classes-e2e typecheck
```

Or add one line saying root `pnpm typecheck` covers it. Re-test: E-18.
