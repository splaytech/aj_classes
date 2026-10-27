# BUG-3 — Admin sign-in on the dev server sometimes logs a 500 from the two-step challenge

- **Found:** 2026-10-25, `/test-and-ship` item 1, case N-54 · **Build:** `feature/pending-requirements` @ `ea18539`
- **Severity:** Low. Dev server only, and the sign-in still succeeds. It isn't item-1 code: `TwoStepCodeForm.tsx` and `lib/local-dev-two-step.ts` haven't changed since `c4e9447`. The auto-entry came in with `69d22f4`. It fails N-54's "0 console errors" bar, and it puts noise in every admin E2E run.

## Steps to reproduce

1. Local stack up, dev server on :5173.
2. Open `http://localhost:5173/portal/login`, sign in as `admin@local.test` with the seed password. The dev server enters the two-step code itself.
3. Watch the console and network.

## Expected

The sign-in lands on `/portal/admin` with 0 console errors.

## Actual

It lands on `/portal/admin` every time. In **4 of 10** repeated sign-ins (plus 2 more in other sessions of this run), the console logs
`Failed to load resource: the server responded with a status of 500 (Internal Server Error)` for
`POST http://127.0.0.1:55321/auth/v1/factors/<admin factor id>/challenge`.

The GoTrue log for the same request says:
`"error":"Unhandled server error: ERROR: deadlock detected (SQLSTATE 40P01)","path":"/factors/…/challenge","status":500`.
Each time, a second challenge for the same factor at the same second succeeded.

Likely cause: in `components/portal/TwoStepCodeForm.tsx`, the mount effect (`useEffect(..., [])`) calls `enteredLocalCode(firstId)`, which calls `supabase.auth.mfa.challengeAndVerify`. React Router's dev entry renders in `<StrictMode>`, which runs mount effects twice in development. So two challenge-and-verify calls race, and GoTrue deadlocks one of them.

Production builds have no auto-entry (`hasLocalTwoStepKey()` is false), so the live site isn't affected.

## Suggested fix

Guard the auto-entry so it runs once, with a `useRef` "started" flag. Or ignore the second effect run with a cleanup and abort flag.

## Evidence

- Run log: 10 sign-ins, `challenge500` = 1,1,0,0,0,1,0,0,1,0.
- GoTrue log lines from `docker logs supabase_auth_aj_classes` at 07:37:11Z and 07:37:42Z (UTC, 25 Oct 2026).

## Retest — round 2 (2026-10-25)

- **Status: Fixed / verified.**
- **Build:** `4ef23a4`. The fix is `f64518c`: a `loadStarted` ref in `TwoStepCodeForm.tsx`, plus a new StrictMode unit test (`TwoStepCodeForm.test.tsx`, part of the 45 files / 327 tests).
- **N-74:** 30 `admin@local.test` sign-ins on the dev server, in 3 batches of 10.
  - All 30 landed on `/portal/admin`.
  - **0** challenge 500s and **0** console errors (round 1: 4 of 10).
  - The last batch counted `POST /auth/v1/factors/<id>/challenge` requests: exactly **1** per sign-in.
- **N-54:** all 5 roles signed in and survived a reload with 0 console errors and 0 failed responses.
- The admin compose session (N-45 to N-66) also logged 0 console errors. In round 1 it logged the 500.
