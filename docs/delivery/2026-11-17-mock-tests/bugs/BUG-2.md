# BUG-2 — mock test pages call the API for people the page is about to refuse

- Found in: BA-3 (round 1, 2026-11-18); the same cause gives the console errors in BA-4, BA-5, BA-6 and BA-7.
  Build `124d3db` (HEAD `24c0c5e`), local stack, dev server.
- Severity: **Minor**. The database refuses every one of these calls (403 `not_admin` / `not_taker`, 401 when signed
  out), so nothing leaks; but the page sends a request it shouldn't, the browser logs a
  `Failed to load resource` error, and BA-3's expected "no request" is not met.
- Kind: app bug. Other admin pages already avoid it.

## Steps

1. Sign in as `tutor@local.test` (or `parent@local.test`).
2. Open `/portal/admin/mock-tests`, then `/portal/admin/mock-tests/<a released t7 id>`.
3. Watch requests to `/rest/v1/`.

Also: tutor or admin opening `/portal/user/mock-tests/<id>`; `newadmin@` (no two-step) opening
`/portal/admin/mock-tests`; signed out opening either page.

## Expected

BA-3: heading `You don't have access to this page`, and **no** request to `rpc/mock_tests_admin_list` or `mock_tests?`.
Console errors `0` on every row (plan §0.1).

## Actual

The refusal page shows correctly, but the route's `clientLoader` has already called the API:

| Who, page | Request | Status |
|---|---|---|
| tutor@ / parent@, `/portal/admin/mock-tests` | `POST rpc/mock_tests_admin_list` | 403 |
| tutor@ / parent@, `/portal/admin/mock-tests/<id>` | `GET mock_tests?select=id,title,instructions,status&id=eq.<id>` | 403 for tutor (console) |
| tutor@, `/portal/user/mock-tests/<id>` | `POST rpc/mock_test_open` | 403 |
| newadmin@ (aal1), `/portal/admin/mock-tests` | `POST rpc/mock_tests_admin_list` | 403 |
| signed out, `/portal/admin/mock-tests` and `/portal/user/mock-tests/<id>` | same two RPCs | 401 |

Control (same run, same accounts): `/portal/admin/users`, `/portal/admin/students`, `/portal/admin/posts`,
and a parent on `/portal/student`, send **no** failing request. `users.service.ts:33-34` gets its client from
`getAdminClient()`, which returns `null` for anyone who isn't an admin with two-step (`staff-client.ts:16`), so the
loader returns before any request. `mock-tests.service.ts:30-36` (`listMockTestsAdmin`) and the taker loaders use
`getSupabase()` directly (comment in `admin-mock-tests.tsx:34`: "the database refuses anyone else").

## Evidence

`docs/delivery/2026-11-17-mock-tests/run-1/out/ba.json` (BA-3 `restCalls`, BA-4 to BA-7 `errors`),
`run-1/out/ba-diag.json` (failing requests per page, with the control pages), harness `run-1/h/ba.mjs`,
`run-1/h/ba-diag.mjs`.

## Round 2

**Fixed** at `ef5c571` (d7645f7). Same repro: tutor, parent, newadmin@ (aal1) and signed out send 0 mock requests, 0 console errors; BA-3 to BA-7 PASS (RB-2). Evidence `run-2/out/ba.json`, `run-2/out/ba-diag.json`.
