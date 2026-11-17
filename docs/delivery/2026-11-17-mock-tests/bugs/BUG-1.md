# BUG-1 — `not_found` from the mock test functions reaches the browser as HTTP 500

- Found in: TK-13 (round 1, 2026-11-18), build `124d3db` (HEAD `24c0c5e`), local stack.
- Severity: **Minor** (the body is correct and the page maps it to the right message; the status is wrong, so
  logs and monitoring count a user's ordinary "not found" as a server error). The plan (L-8, F-4) says a 500 is a bug.
- Kind: app bug (the plan's expected value comes from ruling L-8).

## Steps

1. Local stack, run-1 helpers (`run-1/t7.sh`): make a draft mock test (`mk_test draft2 2 draft`).
2. `tok parent@local.test` (real password-grant token, in a 0600 header file).
3. `POST /rest/v1/rpc/mock_test_open` with body `{"target":"<draft id>"}` as parent@.

## Expected

A 4xx status (L-8: "a 4xx passes; a 500 is a bug") with body `"code":"P0002","message":"not_found"`.

## Actual

`HTTP 500` with body `{"code":"P0002","details":null,"hint":null,"message":"not_found"}`.
PostgREST maps SQLSTATE class `P0` other than `P0001` to 500; the migration raises
`not_found` with `errcode = 'P0002'` (`supabase/migrations/20261118100000_mock_tests.sql:158, 282, 312, 356, 364, 443,
502, 528`). Older migrations use the same code (`20261006004522_staff_accounts.sql:346`), so this may be a
house-wide pattern rather than new to mock tests; the lead decides scope.

Seen again in the browser (same body, same 500):

- BM-21: stale page saving a question to a deleted draft, `POST /rest/v1/mock_test_questions` → 500
  `{"code":"P0002","message":"not_found"}` (`run-1/out/bm.json`).
- BE-3: `/portal/user/mock-tests/<zero uuid>` and `/<draft id>`, `rpc/mock_test_open` → 500 twice (`run-1/out/be.json`).
- BM-17: the save after a take-back, `rpc/mock_save_answer` → 500 (`run-1/out/bm.json`; that row doesn't freeze the status).

In every case the page still shows the right message (`We couldn't find that…` / `Not found`).

## Evidence

`docs/delivery/2026-11-17-mock-tests/run-1/tk13.txt`, `run-1/tk13-hdr.txt` (response headers).

## Round 2

**Fixed** at `ef5c571` (2d84344). TK-13 repro: `rpc/mock_test_open` on a draft and an unknown id → HTTP 404 with the same body; BE-3 404 ×2, BM-21 404, BM-17 404 (RB-1). Side effect for the lead: in the database the error is now SQLSTATE `PGRST` and psql prints `ERROR:  {"code":"P0002","message":"not_found",…}`, so frozen DB rows expecting `ERROR:  not_found` fail on text (claim PE-1 in the TSR). Evidence `run-2/tk.txt`, `run-2/pgrst-verbose.txt`.
