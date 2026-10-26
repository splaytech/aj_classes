# BUG-14 — The runbook doesn't say `act` leaves job containers running

- **Item / case:** item 6, TSR-item-6 round 1, case **E-82** (hygiene; AC-6.12)
- **Severity:** Low (docs only; CI itself is correct)
- **Build:** `feature/ci-quality-gates` @ `e83b81e`
- **Found:** 26 Oct 2026, Tester (proposed as ruling PR-3; the team lead ruled it a FAIL, because the case's intent is that following the runbook leaves the machine clean, and it didn't)

## Steps to reproduce

1. Follow `docs/testing/ci-gates.md` "Running the workflow itself with `act`" for `lighthouse` and `e2e`.
2. `docker ps -a --filter name=act- -q | wc -l`.

## Expected

`0`: following the runbook leaves no `act` containers.

## Actual

`2` (the last Lighthouse and E2E smoke job containers, left running by `act` 0.2.89). No host ports held. The runbook says nothing about removing them.

## Evidence

TSR-item-6 round 1, E-82 row and run note 4.

## Fix

Add a clean-up step to the `act` section: `docker ps -aq --filter name=act- | xargs docker rm -f`. Re-test: E-82.
