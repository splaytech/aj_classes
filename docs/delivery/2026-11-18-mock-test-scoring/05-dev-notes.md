# 05 — Dev notes: mock test scoring

Stage 5 (Dev Lead), 18 Nov 2026. Branch `feature/mock-test-scoring`, on top of `796dbcb`. Local stack only (Supabase CLI, `supabase_db_aj_classes`, API 55321, DB 55322; the brief's 54321/54322 is not this repo's config). Nothing hosted was touched, nothing pushed or merged to `develop` or `main`. Raw evidence lives in `run-dev/` (excluded through `.git/info/exclude`).

Every number below comes from a command I ran on the integrated branch, not from a specialist's report.

## Who built what

| Slice | Built by | Worktree | Lead check |
|---|---|---|---|
| 1, 1.4 capture, 2.2 race, 3, 4 | Dev Lead | main checkout (sole owner of the DB) | ran |
| 2.1 pgTAP file | dev-ms | `.worktrees/scoring-pgtap` | cherry-picked, full pgTAP re-run |
| 5 | dev-web | `.worktrees/scoring-s5` | full vitest, lint, tsc re-run, diff read |
| 6, 7, 8 | three dev-web, in parallel | `.worktrees/scoring-s6/-s7/-s8` | full vitest, lint, tsc re-run on each; merged `--no-ff` |
| merge-time flips, 9 | Dev Lead | main checkout | ran |

All five worktrees are removed and their branches deleted.

## Commits (oldest first)

| Commit | Slice | What |
|---|---|---|
| `5dc52bc` | 1 | migration `20261121100000_mock_test_scoring.sql` (03 §1.3 verbatim) and the pinned pgTAP edits (categories UPDATE grant pin, taker regex/keys/reply/rename, open-signup array) |
| `acbafe0` | 3 | `database.types.ts` regenerated from the local DB |
| `7ef732a` | 4 | constants, route pattern and path helper, SEO title, additive optional types |
| `dd5dbb5` | 5 | service, mappers, `getMockTestResults`, helpers, parity test, wording pins (dev-web) |
| `dfbeef2` | 2.1 | `mock_tests_scoring.test.sql`, cases 1 to 15 (dev-ms) |
| `8575671`, merge `c3d3a1b` | 6 | Marks and pass mark fields, totals, Scoring card, Results button and list column (dev-web) |
| `8e36bcd`, merge `7f1c7f3` | 7 | marks under each question, start-page totals, `MockPassChip`, result and list wording (dev-web) |
| `16e1b7d`, merge `eeb0a73` | 8 | `MockResultsTable`, the Results route with its ErrorBoundary, `routes.ts`, load-error table (dev-web) |
| `cfd9e3c` | 5/6/7 flips | `MockTestInput.passMark`, `MockQuestionInput.marks`, `passMarkText`, `mockScoreText`'s percentage made required; `MOCK_RESULT.scoreOnly` removed |
| `e7f2e14` | 9 | e2e wording, selectors, the new end-to-end case, scope-test names |

This file and the ticked `04-plan.md` are committed together as the last commit on the branch.

## Slice 1: migration and pinned pgTAP

- Each replaced body was diffed against its source range (closing 405-453, categories 302-341 and 344-424, mock_tests 126-145). The only differences are the intended ones: sums of marks, `test_pass` from the `for share` select, the new reply keys, the two return columns, `marks`/`marks_earned`/`total_marks`/`pass_mark`, and in `check_mock_test` the locked re-read plus the `pass_mark` line, `security invoker`.
- Pinned edits re-grepped before editing: categories 74-77, taker 113/116, 153-157, 175-177, 182 ("the list shows the score" renamed "shows the marks"), open-signup array (`'mock_test_results(uuid)'` after `'mock_test_open(uuid)'`).
- `pnpm db:reset && pnpm db:test` after slice 1: Files=25, Tests=1954, PASS.

### 1.4 before and after capture (AC 40 to 44)

The migration file was kept in the scratchpad (not in `supabase/migrations/`) for the before-run; `pnpm db:reset` then `supabase migration list --local` ended at `20261120100000`. Seed (`run-dev/seed-legacy.sql`, superuser): a released, tagged test with two questions; the student's attempt submitted (1 of 2, two answers); the parent's attempt in progress (two right answers). Then the file was moved into `supabase/migrations/` and applied with `supabase migration up --local`.

`before.txt` (`after.txt` is the same):

```
                  id                  | score | total |         submitted_at          
--------------------------------------+-------+-------+-------------------------------
 33333333-3333-4333-8333-333333333331 |     1 |     2 | 2026-11-17 22:42:08.109808+00
 33333333-3333-4333-8333-333333333332 |       |       | 
(2 rows)
```

```
cmp exit=0
```

Questions after the migration:

```
 marks_1 | total 
---------+-------
       2 |     2
(1 row)
```

AC 44, the in-progress attempt submitted as the parent after the migration:

```
BEGIN
SET
                                     set_config                                     
------------------------------------------------------------------------------------
 {"sub":"ca6c85b1-2b4c-4f38-b169-d47931eab321","role":"authenticated","aal":"aal1"}
(1 row)

                         mock_submit                         
-------------------------------------------------------------
 {"score": 2, "total": 2, "passed": null, "percentage": 100}
(1 row)

COMMIT
                  id                  | score | total | submitted 
--------------------------------------+-------+-------+-----------
 33333333-3333-4333-8333-333333333331 |     1 |     2 | t
 33333333-3333-4333-8333-333333333332 |     2 |     2 | t
(2 rows)
```

## Slice 2: pgTAP file and the two-session race

- 2.1: dev-ms reported Files=1, Tests=230, PASS. After the cherry-pick, the full suite on a reset DB gave Files=26, Tests=2184, PASS (1954 + 230). I checked by grep that the boundary rows (400,400,90), (359,400,90), (0,0,50), the anon refusal and the attempts/answers no-grant cases are present.
- 2.2: run on the local DB with two real `psql` processes per order (`docker exec -i supabase_db_aj_classes psql -U postgres -d postgres`). Each session ran `set role authenticated` and set `request.jwt.claims`: the seed admin at aal2, or the seed student at aal1. A third psql read `pg_stat_activity` while session 2 waited. Scripts are in `run-dev/race/`. Setup and cleanup ran as superuser; cleanup used `session_replication_role = replica`, because a released test can't be deleted through the freeze trigger.
- **Result, all three must-pass rows:**
  - **Order A.** Session 2's `pass_mark = 80` waited on a `transactionid` lock (22:45:58 to 22:46:01) and returned `ERROR: mock_released` when session 1 committed the release. `pass_mark` stayed 50.
  - **Order B.** The release waited behind the uncommitted `pass_mark = 80` (lock seen) and then released with 80. A later `pass_mark = 60` was refused with `mock_released`; the value stayed 80.
  - **Mirror.** The admin's `pass_mark = 10` waited behind the student's open `mock_submit` (lock seen) and was refused with `mock_released` after the submit committed. `pass_mark` stayed 50; the submit returned `{"score": 2, "total": 2, "passed": true, "percentage": 100}`.
- **A first attempt was discarded.** Its label lines lost a byte to `sh` `echo`, and that swallowed the next statement (`set role authenticated`) in several sessions, so those sessions ran as superuser. The outcomes matched, but they did not meet the brief. It was re-run with clean scripts; only the clean run is below.

Raw transcript (`run-dev/race/transcript.txt`):

```
select '== setup (superuser, committed): three tagged drafts, one question each, pass_mark 50' as step;
                                         step                                          
---------------------------------------------------------------------------------------
 == setup (superuser, committed): three tagged drafts, one question each, pass_mark 50
(1 row)

insert into public.mock_tests (id, title, created_by, subject, stream, any_year, pass_mark) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'Race A', 'a0d056b1-b42b-486e-b9ff-16a0c358be11', 'maths', 'naplan', true, 50),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'Race B', 'a0d056b1-b42b-486e-b9ff-16a0c358be11', 'maths', 'naplan', true, 50),
  ('cccccccc-0000-4000-8000-00000000000c', 'Race C', 'a0d056b1-b42b-486e-b9ff-16a0c358be11', 'maths', 'naplan', true, 50);
INSERT 0 3
insert into public.mock_test_questions (id, test_id, position, prompt, options, correct_option, marks) values
  (gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-00000000000a', 1, 'Q?', array['a','b'], 0, 1), (gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-00000000000b', 1, 'Q?', array['a','b'], 0, 1), ('cccccccc-1111-4000-8000-00000000000c', 'cccccccc-0000-4000-8000-00000000000c', 1, 'Q?', array['a','b'], 0, 2);
INSERT 0 3
select id, title, status, pass_mark from public.mock_tests where title like 'Race %' order by title;
                  id                  | title  | status | pass_mark 
--------------------------------------+--------+--------+-----------
 aaaaaaaa-0000-4000-8000-00000000000a | Race A | draft  |        50
 bbbbbbbb-0000-4000-8000-00000000000b | Race B | draft  |        50
 cccccccc-0000-4000-8000-00000000000c | Race C | draft  |        50
(3 rows)


select '== A session 1 (admin aal2)' as step;
            step             
-----------------------------
 == A session 1 (admin aal2)
(1 row)

set role authenticated;
SET
select set_config('request.jwt.claims', '{"sub":"a0d056b1-b42b-486e-b9ff-16a0c358be11","role":"authenticated","aal":"aal2"}', false) is not null as claims_set;
 claims_set 
------------
 t
(1 row)

begin;
BEGIN
select now()::time(0) as t, public.mock_release('aaaaaaaa-0000-4000-8000-00000000000a') is not null as released_in_txn;
    t     | released_in_txn 
----------+-----------------
 22:45:57 | t
(1 row)

select pg_sleep(4);
 pg_sleep 
----------
 
(1 row)

select clock_timestamp()::time(0) as commit_at;
 commit_at 
-----------
 22:46:01
(1 row)

commit;
COMMIT

select '== A session 2 (admin aal2)' as step;
            step             
-----------------------------
 == A session 2 (admin aal2)
(1 row)

set role authenticated;
SET
select set_config('request.jwt.claims', '{"sub":"a0d056b1-b42b-486e-b9ff-16a0c358be11","role":"authenticated","aal":"aal2"}', false) is not null as claims_set;
 claims_set 
------------
 t
(1 row)

select clock_timestamp()::time(0) as update_sent_at;
 update_sent_at 
----------------
 22:45:58
(1 row)

update public.mock_tests set pass_mark = 80 where id = 'aaaaaaaa-0000-4000-8000-00000000000a';
select clock_timestamp()::time(0) as update_returned_at;
ERROR:  mock_released
CONTEXT:  PL/pgSQL function private.check_mock_test() line 15 at RAISE
 update_returned_at 
--------------------
 22:46:01
(1 row)

select status, pass_mark from public.mock_tests where id = 'aaaaaaaa-0000-4000-8000-00000000000a';
  status  | pass_mark 
----------+-----------
 released |        50
(1 row)


== observer while session 2 waits (A)
 pid | wait_event_type |  wait_event   | state  |                                 query                                  
-----+-----------------+---------------+--------+------------------------------------------------------------------------
 825 | Lock            | transactionid | active | update public.mock_tests set pass_mark = 80 where id = 'aaaaaaaa-0000-
(1 row)


select '== B session 1 (admin aal2)' as step;
            step             
-----------------------------
 == B session 1 (admin aal2)
(1 row)

set role authenticated;
SET
select set_config('request.jwt.claims', '{"sub":"a0d056b1-b42b-486e-b9ff-16a0c358be11","role":"authenticated","aal":"aal2"}', false) is not null as claims_set;
 claims_set 
------------
 t
(1 row)

begin;
BEGIN
update public.mock_tests set pass_mark = 80 where id = 'bbbbbbbb-0000-4000-8000-00000000000b';
UPDATE 1
select pg_sleep(4);
 pg_sleep 
----------
 
(1 row)

select clock_timestamp()::time(0) as commit_at;
 commit_at 
-----------
 22:46:05
(1 row)

commit;
COMMIT

select '== B session 2 (admin aal2)' as step;
            step             
-----------------------------
 == B session 2 (admin aal2)
(1 row)

set role authenticated;
SET
select set_config('request.jwt.claims', '{"sub":"a0d056b1-b42b-486e-b9ff-16a0c358be11","role":"authenticated","aal":"aal2"}', false) is not null as claims_set;
 claims_set 
------------
 t
(1 row)

select clock_timestamp()::time(0) as release_sent_at;
 release_sent_at 
-----------------
 22:46:02
(1 row)

select public.mock_release('bbbbbbbb-0000-4000-8000-00000000000b') is not null as released;
 released 
----------
 t
(1 row)

select clock_timestamp()::time(0) as release_returned_at;
 release_returned_at 
---------------------
 22:46:05
(1 row)

select status, pass_mark from public.mock_tests where id = 'bbbbbbbb-0000-4000-8000-00000000000b';
  status  | pass_mark 
----------+-----------
 released |        80
(1 row)

select '== B later write of 60 (session 2)' as step;
                step                
------------------------------------
 == B later write of 60 (session 2)
(1 row)

update public.mock_tests set pass_mark = 60 where id = 'bbbbbbbb-0000-4000-8000-00000000000b';
ERROR:  mock_released
CONTEXT:  PL/pgSQL function private.check_mock_test() line 15 at RAISE
select status, pass_mark from public.mock_tests where id = 'bbbbbbbb-0000-4000-8000-00000000000b';
  status  | pass_mark 
----------+-----------
 released |        80
(1 row)


== observer while session 2 waits (B)
 pid | wait_event_type |  wait_event   | state  |                                 query                                  
-----+-----------------+---------------+--------+------------------------------------------------------------------------
 859 | Lock            | transactionid | active | select public.mock_release('bbbbbbbb-0000-4000-8000-00000000000b') is 
(1 row)


select '== C prep: admin releases C, student starts and answers' as step;
                          step                           
---------------------------------------------------------
 == C prep: admin releases C, student starts and answers
(1 row)

set role authenticated;
SET
select set_config('request.jwt.claims', '{"sub":"a0d056b1-b42b-486e-b9ff-16a0c358be11","role":"authenticated","aal":"aal2"}', false) is not null as claims_set;
 claims_set 
------------
 t
(1 row)

select public.mock_release('cccccccc-0000-4000-8000-00000000000c') is not null as released;
 released 
----------
 t
(1 row)

reset role;
RESET
set role authenticated;
SET
select set_config('request.jwt.claims', '{"sub":"1c31d29b-5c90-4547-944c-11c07389f9b1","role":"authenticated","aal":"aal1"}', false) is not null as claims_set;
 claims_set 
------------
 t
(1 row)

select public.mock_start('cccccccc-0000-4000-8000-00000000000c') is not null as started;
 started 
---------
 t
(1 row)

select public.mock_save_answer('cccccccc-0000-4000-8000-00000000000c', 'cccccccc-1111-4000-8000-00000000000c', 0) is not null as answered;
 answered 
----------
 t
(1 row)


select '== C session 1 (student): submit holds the test for share' as step;
                           step                            
-----------------------------------------------------------
 == C session 1 (student): submit holds the test for share
(1 row)

set role authenticated;
SET
select set_config('request.jwt.claims', '{"sub":"1c31d29b-5c90-4547-944c-11c07389f9b1","role":"authenticated","aal":"aal1"}', false) is not null as claims_set;
 claims_set 
------------
 t
(1 row)

begin;
BEGIN
select public.mock_submit('cccccccc-0000-4000-8000-00000000000c');
                         mock_submit                         
-------------------------------------------------------------
 {"score": 2, "total": 2, "passed": true, "percentage": 100}
(1 row)

select pg_sleep(4);
 pg_sleep 
----------
 
(1 row)

select clock_timestamp()::time(0) as commit_at;
 commit_at 
-----------
 22:46:09
(1 row)

commit;
COMMIT

select '== C session 2 (admin aal2)' as step;
            step             
-----------------------------
 == C session 2 (admin aal2)
(1 row)

set role authenticated;
SET
select set_config('request.jwt.claims', '{"sub":"a0d056b1-b42b-486e-b9ff-16a0c358be11","role":"authenticated","aal":"aal2"}', false) is not null as claims_set;
 claims_set 
------------
 t
(1 row)

select clock_timestamp()::time(0) as update_sent_at;
 update_sent_at 
----------------
 22:46:06
(1 row)

update public.mock_tests set pass_mark = 10 where id = 'cccccccc-0000-4000-8000-00000000000c';
ERROR:  mock_released
CONTEXT:  PL/pgSQL function private.check_mock_test() line 15 at RAISE
select clock_timestamp()::time(0) as update_returned_at;
 update_returned_at 
--------------------
 22:46:09
(1 row)

reset role;
RESET
select status, pass_mark from public.mock_tests where id = 'cccccccc-0000-4000-8000-00000000000c';
  status  | pass_mark 
----------+-----------
 released |        50
(1 row)


== observer while session 2 waits (C)
 pid | wait_event_type |  wait_event   | state  |                                 query                                  
-----+-----------------+---------------+--------+------------------------------------------------------------------------
 909 | Lock            | transactionid | active | update public.mock_tests set pass_mark = 10 where id = 'cccccccc-0000-
(1 row)
```

## Slices 3 to 9

- 3: `pnpm db:types` diff was exactly the expected fields: `marks` on questions (Row, Insert, Update), `pass_mark` on tests (Row, Insert, Update), `mock_test_results`, and `percentage`/`passed` on `mock_tests_for_me`. There was no other change. The local list ends at `20261121100000`.
- 4: lint and typecheck green with optional fields only.
- 5 to 8: each hand-back re-run by me in its worktree. Full web vitest: 1192 (s5), 1216 (s6), 1205 (s7), 1208 (s8), all passing; lint and tsc clean on each.
- Merge-time flips (`cfd9e3c`): the required fields broke fixtures in `lib/mock-tests.test.ts` and `services/mock-tests.service.test.ts`, as planned. I fixed them and removed the "absent is skipped" and "no percentage" cases, which no longer exist as behaviour.
- 9.2: `playwright test tests/mock-tests.spec.ts`: 3 passed, including "scores marks and a pass mark end to end".
- 9.4: `grep -rn "of [^ ]* correct" apps/web/src e2e/tests` gives **0 hits** (the plan allowed three; none match this pattern).

## Full check (integrated branch, HEAD `e7f2e14`)

| Step | Result |
|---|---|
| 1. `prettier --check` on the 41 touched non-SQL files | all formatted |
| 1b. repo-wide `prettier --check .` | fails only on `actionItems.md` and `supabase/.temp/linked-project.json` (accepted) |
| 2. `pnpm db:reset && pnpm db:test` | Files=26, Tests=2184, PASS (all five mock files and `open_sign_up_access` ok) |
| 3. two-session race | 3 of 3 refused or ordered as required (above) |
| 4. `pnpm lint` | exit 0 |
| 5. `pnpm typecheck` (web and e2e) | exit 0 |
| 6. `pnpm test` | web 121 files / 1242 tests passed; e2e unit 6 pass / 0 fail; `test-deploy-order.mjs` "All checks passed." |
| 7. `VITE_APP_ENV=production pnpm build` | exit 0 |
| 7b. CI-style build (no Supabase config) and `check:hosted-ref build/client` | 0 files of 188 |
| 8. `test:smoke` | 18 passed |
| 8b. `test:csp` (on the CI-style build) | 23 passed |
| 9. `pnpm db:types` again | 0 diff lines |

## Deviations from 03 and 04

1. **The e2e in-progress key pin.** The first mock e2e case (`mock-tests.spec.ts`, the `Object.keys(inProgress.questions[0])` pin) needed `'marks'` added. 03 §7 and 04 §9 did not list it. Without the change the existing case fails on the new key.
2. **`saveMockQuestion`** briefly omitted `marks` when undefined (slice 5, so an update kept the stored marks); since `cfd9e3c` it always sends `marks`, as 03 §3.3 says.
3. **The CSP run** needs the CI-style build (empty Supabase env). The mirror refuses a build carrying the hosted ref, and the plain production build reads `apps/web/.env.production`. 04's step 7 names only the plain build.
4. **A comment in `services/types.ts`** named `MOCK_RESULTS_PAGE`, which the extended scope test (AC 50) flagged. The comment was reworded rather than allow-listed.
5. **Admin dialogs (slice 6):** `MockTestDialog`'s `existing` prop requires `passMark`. The pass-mark field takes `min`/`max`/`step` from `MOCK_TEST_LIMITS`. `MockQuestionList` has no test file of its own; the admin page tests cover its marks and totals.
6. **The Pass chip (slice 7)** renders only when `passed !== null` and the percentage is not null.

## Known limits

- **No real-browser pass** at 375 and 1280 px, light and dark, and no keyboard walk (AC 48, 49). Those are the Tester's rows. The e2e run only shows the pages work in headless Chromium.
- **Role checks.** Tutor, parent, student and user opening the Results URL are proved in pgTAP (case 12) and by the layout. No browser run per role (Tester).
- **The 1000-row note** is proved by vitest and the RPC's `total_rows` only. No seeded 1500-row set was run.
- **Decimal pass mark:** a direct write of 60.5 stores 61 (design decision 9). The web refuses decimals.
- **Local state left behind.** The local DB is reset and seeded, with no race or legacy fixtures (`db:test` ran after them). `e2e/.env` was generated by `e2e/scripts/local-env.mjs` (gitignored, 0600, local keys only). The dev server started by e2e global setup was stopped at close-out.
