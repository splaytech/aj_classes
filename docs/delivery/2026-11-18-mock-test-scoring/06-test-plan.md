# 06 — Test plan: mock test scoring (marks, pass mark, percentage, admin results)

**Status: TO BE FROZEN** (revised after review-6a round 1 and ruling L-13; the lead freezes and commits it). Corrections after freeze are appended as
rulings; rows above stay as written.

Stage 6a of `/deliver`, Test Manager. Branch `feature/mock-test-scoring`. Date 2026-11-18.
Inputs: [00](00-decisions.md) (L-1 to L-13, S-1, S-2), [01](01-requirement.md) (ACs 1 to 50 and the release gate),
[02](02-architecture.md), [03](03-design.md), [04](04-plan.md), [05](05-dev-notes.md) (with "Fix batch 1"),
[review-5](review-5.md), [06-security](06-security.md), the shared test-manager, tester, tester-ui and tester-api
roles, and the AJ Classes tester addendum. House format and set-up:
`docs/delivery/2026-11-18-mock-test-closing/06-test-plan.md` (with its §11 rulings) and its `TSR.md`.

Saurabh's words, verbatim: "how do i set scoring as well in mock tests?" and "do 1-4".

**Plan base: `031e552`** (the scoring code at `3f181a9`, the docs commits `0bbc63a` and `5941c36`, the privacy
sentence `bedbffe` (constants and `privacy.test.tsx` only), and `031e552`, a comment-only change in
`mock-tests.constants.ts` (review-6a #12); `a454798` after it is docs only). `git diff --stat 3f181a9 031e552 -- supabase e2e`
is empty, so every database value below holds for all of them. Every expected value was read from the code, the
migration `20261121100000_mock_test_scoring.sql` and `supabase/seed.sql` at `031e552`, and every database row was dry-run on
this machine on 2026-11-18, inside `begin … rollback`, as the role the row runs as (§0.2, Appendix B). At run time, if
`git diff --quiet 031e552 HEAD -- apps/web/src supabase e2e package.json` fails, re-derive every value marked
**(count)** and every quoted string from the files at HEAD before comparing. A wrong expected value found in the run
is a plan error: the TSR records it and the lead rules on it. The run doesn't edit this plan.

`/test-and-ship` writes `docs/delivery/2026-11-18-mock-test-scoring/TSR.md` (plus `bugs/`). **Write each row's Actual
and Result into the TSR as soon as the row runs.** Evidence goes under a gitignored `run-*/` folder
(`docs/delivery/2026-11-18-mock-test-scoring/run-*/` is in `.git/info/exclude`); commit only `TSR.md` and `bugs/`.

Rulings that are decided and not tested as open questions: L-1 (names shown), L-2 (admins only), L-3 (freeze at
release), L-4 ("N of M marks", Pass / Not yet, rounded down), L-5 (per-question marks on the result), L-8 (name =
profile, else roster, else "Name not set"), L-9 (no practice note), L-10 (service_role execute), L-12 (plural on a
total of 1, total marks once in the Scoring card, digits-only parsing; a decimal written straight to the database is
rounded: a known limit), L-13 (the rulings on §6: F-1 to F-5), S-1 (hosted apply approved; admins see names and
scores), S-2 (the privacy sentence), and,
carried from the closing gate, its S-1 (a submitter keeps a closed test and their result; nobody else sees it) and
L-2 (`mock_submit` is `not_found` after closing, even for a submitter).
Lessons carried: `not_found` prints in psql as `PGRST:{"code":"P0002","message":"not_found",…}` and is HTTP 404;
the admin can't read attempts, so every attempt count runs as `postgres`; a taker can't read questions either, so
the helpers keep question ids in session settings (`qset`) before switching role; a new state gets a row per screen
asserting every notice and button text (BE-1 to BE-3, BT-1, BT-2, BA-2 to BA-5); regression rows are checked
against the earlier gates' frozen rows (R-3 uses the closing gate's §11.1 ruling: the gap is kept).

**Earlier frozen rows superseded by this release** (AC 12, AC 15, L-4; design §2.1). They are not re-run as written;
where their flow is regression, this plan's row with the new value replaces them:
- the old reply shape `{"score": n, "total": m}` of `mock_submit`: v1 TK-6, TK-7, TK-8, TK-10, CC-7; closing CD-3,
  CD-5, TV-1 (`dr-s1.sh` replies), TS-6, TS-7 (now `{"score", "total", "passed", "percentage"}`: SC-2, SH-3, TS-3);
- the in-progress question keys without `marks`: v1 TK-4, closing R-5 (`keys|id,options,position,prompt,selected_option`;
  now SH-2 and R-5 here, with `marks`);
- the wording "N of M correct": v1 BM-20, BT-8, BT-9, BT-13, BT-16; closing BF-3, BS-1, BC-6, R-4 (now "N of M marks
  (P%)", "1 of 1 mark" on a total of 1: BT-4 to BT-7, R-4).

Row counts are at the end (§10).

---

## 0. Set-up

### 0.1 Environment

- Repo `/Users/sjain/dev/work/aj_classes` at the plan base or HEAD. Local Supabase only: API `:55321`, DB `:55322`,
  Studio `:55323`, Mailpit `:55324`. No hosted Supabase, Vercel or Google, not even read-only.
- **Start of run:** the run's single stack owner runs LG-1 first (it resets the local database to `20261120100000`
  and migrates it forward), then `pnpm db:reset` once, then S-0. Nobody else resets, seeds or runs `db:test` during
  the run.
- Dev server (Sittings 3 and 4; S-8 and S-9 use their own webServer): `pnpm dev --port 5173 --strictPort` from
  `apps/web`; use `http://localhost:5173`; take the real URL from the run log. Stop it by PID
  (`lsof -tiTCP:5173 -sTCP:LISTEN`, confirm its cwd is this repo), never `pkill -f`.
- **Browser rows:** Playwright with the installed Chrome (`channel: 'chrome'`, a fresh profile, no real accounts),
  emulated viewports (never headless `--window-size`), a fresh context per account, `locale: 'en-AU'`,
  `timezoneId: 'Australia/Melbourne'`. No `window.confirm` stub is needed: every confirmation is an MUI dialog. The
  lead's V rows are judged from the Tester's screenshots (taken on the final build at 375 and 1280, light and dark).
- **Request guard.** One shared guard in the harness aborts every host except `localhost`, `127.0.0.1` and
  `challenges.cloudflare.com` (the sign-in page's Turnstile widget, local test site key) and counts what it aborted.
  Self-test first: a `fetch('https://example.com')` must be counted as aborted, and a request to
  `challenges.cloudflare.com` must not.
- **Sign in (browser):** `/portal/login`, fill Email and Password (`local-password-123`, `supabase/seed.sql:13`),
  wait for the Turnstile widget's `Success!`, press **Sign in**. `admin@local.test` then passes `/portal/login/verify`
  by itself (the dev server enters the code from `VITE_LOCAL_ADMIN_TWO_STEP_KEY`, `apps/web/src/lib/local-dev-two-step.ts`).
- **Console errors** (every browser row): count `pageerror` events and `console.error` messages, excluding the
  browser's own `Failed to load resource` line for a request the row itself makes fail (list those in the Actual).
  Expected `0` unless a row says otherwise. Each browser row also checks
  `document.querySelectorAll('meta[name="robots"]').length` → `1`.
- **Requests** (rows that say "no request"): record every request to `/rest/v1/` during the step; the row names the
  path that must not appear.
- **Dates:** a displayed time is checked against the page's own
  `new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(<ISO from the database>))`
  in the context's time zone (`formatDateTime`, `apps/web/src/lib/format.ts:20`).
- **Exact text:** "exactly" means `textContent` after collapsing runs of white space, compared with `===`. Curly
  apostrophes (`’`) are as quoted.

### 0.2 Helpers and dry-runs

Each tool call is a fresh zsh shell: start every block with `export S=<run folder>` and `. "$S/t8.sh"`. Run scripts
from files, never as a `zsh -c` string.

```sh
# One-off set-up: run folder, run id, and the publishable key in a 0600 header file (never on a command line)
export S=/Users/sjain/dev/work/aj_classes/docs/delivery/2026-11-18-mock-test-scoring/run-1; mkdir -p "$S"; umask 077
echo "RUN=$(date +%s)" > "$S/run.env"
(cd /Users/sjain/dev/work/aj_classes && supabase status -o json > "$S/status.json")
python3 -I -c "import json; d=json.load(open('$S/status.json')); open('$S/anon.hdr','w').write('apikey: '+d['PUBLISHABLE_KEY']+'\n')"
rm -f "$S/status.json"   # it holds every local key; only anon.hdr is kept
# then write $S/t8.sh, $S/aal2tok.py, $S/gr.sql and the dr-*.sh / lg.sh scripts exactly as in Appendix A
```

`t8.sh` is the closing gate's `t7.sh` with these changes: titles are `t8-<RUN>-<label>`; `mk_sql` takes a marks
list (`'3,2,5'`, or `'NxM'` for N questions of M marks), a pass mark and tags (default `maths|naplan|{}|true`, so the
release trigger is satisfied; the closing gate's untagged `legacy` state is not needed here); `mk_sql` and `take`
keep each question id in a session setting (`qset`), because a taker can't read `mock_test_questions` (RLS: the
first dry-run of `take_sql` failed with `invalid_question` until this was added); `take` takes an answer list
(`'1,0,-'`: option per position, `1` = B = correct, `-` = no answer); new `marks_of`, `attempts_of`,
`results_of`, `anon`, `tok2` (an aal2 admin token, `aal2tok.py`); `rest` also saves the response headers;
`rm_t8` also removes the BA-7 / H-5 bulk accounts; `tok` sends its sign-in body from a 0600 file (deleted at once)
instead of the command line, and writes `<e-mail>.tokstatus` (`ok` or GoTrue's error code and status).

**The aal2 admin token (H rows).** A password grant gives aal1. `aal2tok.py` signs in as `admin@local.test`, reads
the local-only authenticator key in-process from `apps/web/.env.development.local`
(`VITE_LOCAL_ADMIN_TWO_STEP_KEY`, the seed's own local key), answers the TOTP challenge and writes the aal2 token to
`$S/admin2.hdr` (0600). It prints only `admin2 aal=aal2`. Delete every `*.hdr`, `*.tokstatus` and `last.hdrs` except `anon.hdr` at the
end of the sitting, then `anon.hdr` too.

Dry-run results (2026-11-18, local stack with `bedbffe`'s migrations, `select version … order by 1 desc limit 1` →
`20261121100000`; nothing was committed by a dry-run: `select count(*) from public.mock_tests` → `0` before and after):

| Dry-run | Result |
|---|---|
| S-0 queries | exactly S-0's expected values |
| `db "select nope()"` | `ERROR:  function nope() does not exist`, exit 1 (the helper fails loudly) |
| `rb` self-test: `try('select 1')`, `try('select nope()')`, as admin@ aal2 `try(mock_test_results(<random>))`, `current_user` then `reset role` | `ok`; `42883:function nope() does not exist:No function …`; `PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}`; `authenticated`; `postgres` |
| `gr.sql`, `dr-marks.sh`, `dr-score.sh`, `dr-shapes.sh`, `dr-sum.sh`, `dr-closed.sh`, `dr-results.sh`, `dr-az.sh`, `dr-reg.sh`, `dr-cc.sh`, `dr-bulk.sh`, `dr-fx.sh`, `dr-r14.sh` | the exact outputs in Appendix B and quoted in the rows; no line starting `ERROR` except where a row expects one |

**Run for real during planning, then cleaned up** (they commit, so they can't be rolled back; recorded so the run
knows the expected shape): LG-1 (`lg.sh`, then `pnpm db:reset`), TS-1 to TS-6 (`ts-real.sh`: every B waited, `elapsed`
4.2 to 4.3 s against A's 4.2 to 4.3 s, outcomes as the rows say), H-1 to H-5 (`h-real.sh`: the statuses and bodies
quoted in the rows), S-1 to S-10. Each ended with `rm_t8` → `0` and no token file left. Not run in planning: the
browser rows (they state their expected value from the code; a mismatch is a plan error or a bug).

### 0.3 Fixtures and restoring them

- Seed accounts (`supabase/seed.sql:27-34`, names in the profile): `admin@` (Local Admin; admin, verified TOTP,
  aal2 in the browser), `newadmin@` (New Admin; admin, no authenticator), `tutor@` (Local Tutor), `inactive@`
  (Inactive Tutor, deactivated), `parent@` (Local Parent, parent of Aarav and Noah), `student@` (Aarav Demo; roster
  row `Aarav Demo`), `user@` (Local User, role `user`). All `@local.test`. The seed has **no** mock tests and no
  attempts.
- Every mock test fixture is titled `t8-<RUN>-<label>`. Fixture prompts, options and titles contain no `$`, "price"
  or "pay".
- **Shared seed state:** two rows change it, and each restores it in the same row and checks the restore: BA-6
  blanks `student@`'s and `user@`'s profile names (and the restore puts back `Aarav Demo` and `Local User`); BA-7
  adds 1003 throwaway accounts `t8-bulk-NNNN@local.test` and removes them (`rm_t8` → `0`, then
  `db "select count(*) from public.profiles"` → `7`). Every other seed change happens inside a rolled-back
  transaction.
- Clean-up CL-1 runs last in every sitting that wrote: `rm_t8` → `0`, then S-0 → identical to the start.

**S-0 start state (gate before any row).**

```sh
export S=…; . "$S/t8.sh"
db "select p.email||'|'||p.role||'|'||p.status||'|'||p.is_active||'|'||p.full_name from public.profiles p order by 1" | paste -sd' ' -
db "select count(*) from public.mock_tests"; db "select count(*) from public.mock_test_attempts"
db "select s.full_name||'|'||s.is_active from public.students s where s.profile_id=(select id from public.profiles where email='student@local.test')"
db "select version from supabase_migrations.schema_migrations order by 1 desc limit 4" | paste -sd' ' -
db "select count(*) from auth.users"
lsof -nP -iTCP:5173 -sTCP:LISTEN | wc -l
```

Expected (dry-run matched):
`admin@local.test|admin|active|true|Local Admin inactive@local.test|tutor|active|false|Inactive Tutor newadmin@local.test|admin|active|true|New Admin parent@local.test|parent|active|true|Local Parent student@local.test|student|active|true|Aarav Demo tutor@local.test|tutor|active|true|Local Tutor user@local.test|user|active|true|Local User`;
`0`; `0`; `Aarav Demo|true`; `20261121100000 20261120100000 20261119100000 20261118100000`; `7`; `0`.

### 0.4 Order, sittings and ownership

1. **Sitting 1, tester-api, owner of the local database (36 rows):** LG-1 first (it resets), `pnpm db:reset`, S-0,
   then S-1 to S-5 and S-10 (no stack), GR, MK, SC, SH, SU, CS, RS, AZ, PV (all rolled back), then CL-1.
2. **Sitting 2, tester-api, still the stack owner (15 rows):** TS-1 to TS-6 and H-1 to H-5 (they commit), then the
   **mid-sitting clean-up** (the CL-1 steps: `rm_t8` → `0`, which also deletes the 1003 `t8-bulk` accounts;
   `db "select count(*) from public.profiles"` → `7`; `db "select count(*) from private.sign_up_emails"` → `0`; S-0 → identical), and only then S-6 to S-9: pgTAP asserts
   empty mock tables and seed-only accounts (`mock_tests_admin.test.sql:68`, `:458`; `mock_tests_closing.test.sql:337`),
   so S-6 on a stack still holding TS or H fixtures fails for the wrong reason. S-8 and S-9 use Playwright's own
   `webServer`; nothing is started by hand on 5173 in Sitting 2. After each, check `lsof -nP -iTCP:5173 -sTCP:LISTEN`
   → nothing (stop a leftover by PID). Then CL-1 (the row) at the end.
3. **Sitting 3, tester-ui, the single owner of the local database, the dev server and the browser fixtures for
   Sittings 3 and 4 (24 rows); nobody else writes to the stack until Sitting 4's CL-1:** S-0, the fixture block FX
   (§3.0), then BM-1 to BM-5, BP-1 to BP-5, BE-1 to BE-3, BA-1 to BA-10, PR-1.
4. **Sitting 4, tester-ui, same single owner (33 rows):** BT-1 to BT-11, BK-1 to BK-3, BR-1 to BR-3, R-1 to R-16,
   the screenshots for V-1 to V-4, then CL-1.
5. Testers run one at a time on the stack. The default order is 1, 2, 3, 4.
6. Never mark a row BLOCKED for lack of budget: say NOT RUN and hand back.
7. **Lead's rows:** V-1 to V-4 (visual judgement from the Tester's screenshots). Every other row is a tester's.

---

## 1. Suites (Sittings 1 and 2, tester-api)

Each command as `cmd > "$S/<name>.log" 2>&1; echo "exit=$?"`, run separately. All were run during planning at
`bedbffe`, with the results below; `031e552` changes one comment only (prettier and eslint on that file: clean).

**S-1 — format.** AC 47 (house check). `pnpm format:check`. Expected, exactly: **exit 1, listing only
`actionItems.md` and `supabase/.temp/*`** (the accepted 2026-11-17 L-4 rule; review-6a #3 ruling). PASS when that is
what is seen. Planning saw `actionItems.md` and `supabase/.temp/linked-project.json`. Check:
`grep -E '^\[warn\] ' "$S/format.log" | grep -vE 'actionItems.md|supabase/\.temp/|Code style issues'` → no lines.

**S-2 — lint.** AC 47 (no raw JSX text, `react/jsx-no-literals`). `pnpm lint`. Expected: `exit=0`.

**S-3 — typecheck.** `pnpm typecheck`. Expected: `exit=0`.

**S-4 — `pnpm test`.** ACs 1 to 50 (web side). Expected: web `Test Files  121 passed (121)`,
`Tests  1255 passed (1255)` **(count)** (05's 1254 after fix batch 1, plus one privacy case in `bedbffe`); e2e unit
`ℹ tests 6`, `ℹ fail 0`; `All checks passed.` (deploy order). Files on disk
(`find apps/web -path '*/node_modules' -prune -o \( -name '*.test.ts' -o -name '*.test.tsx' \) -print | wc -l`) →
`121`. The feature files, each passed in the log: `lib/mock-tests.test.ts`, `lib/mock-test-scoring.parity.test.ts`
(AC 1, 7 limits equal the migration; AC 41 one attempts write), `lib/mock-tests-scope.test.ts` (AC 50),
`services/mock-tests.service.test.ts`, `components/portal/MockResultsTable.test.tsx`,
`MockTestStatusChips.test.tsx`, `MockQuestionDialog.test.tsx`, `MockTestDialog.test.tsx`,
`MockTestTakeForm.test.tsx`, `MockTestResult.test.tsx`, `routes/portal/admin-mock-test-results.test.tsx`,
`admin-mock-test.test.tsx`, `admin-mock-tests.test.tsx`, `mock-test.test.tsx`, `mock-tests.test.tsx`,
`mock-tests-load-error.test.tsx` (AC 46), `routes/privacy.test.tsx` (S-2).

**S-5 — production build and hosted-ref check.** `VITE_APP_ENV=production pnpm build`, then the CSP gate build
`VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 pnpm build`
(`docs/testing/ci-gates.md:127`; the placeholders turn the enquiry form and footer sign-up on, which the CSP sweep
fills in) and `pnpm --filter web check:hosted-ref build/client`. Expected: both builds
`exit=0`; `check-hosted-ref: 0 files (of 188 scanned)` **(count)**.

**S-6 — `pnpm db:test`.** ACs 1 to 45 (database side). Lift any cron pause first (addendum). Expected:
`Files=26, Tests=2184` **(count)** (05; no SQL changed since; planning matched), `Result: PASS`, with `mock_tests_admin.test.sql`,
`mock_tests_taker.test.sql`, `mock_tests_closing.test.sql`, `mock_tests_categories.test.sql`,
`mock_tests_scoring.test.sql` and `open_sign_up_access.test.sql` each `ok`.

**S-7 — `pnpm test:functions`.** Restart the edge runtime first (`docker restart supabase_edge_runtime_aj_classes`).
Expected: `exit=0`, no `NOT OK` (planning matched). Afterwards `db "select count(*) from private.sign_up_emails"` → `0`.

**S-8 — e2e smoke.** ACs 1, 6, 15, 19, 28 (the end-to-end scoring case). `node e2e/scripts/local-env.mjs > e2e/.env; pnpm --filter aj-classes-e2e test:smoke`
(Playwright starts and stops its own `webServer`). Expected: `18 passed` **(count)** (05; planning matched),
including `scores marks and a pass mark end to end`. Afterwards `db "select count(*) from public.mock_tests where title like 'e2e-%'"`
→ `0`, no `e2e-%` rows in posts, enquiries or profiles, nothing listening on 5173 (stop a leftover by PID: in planning the smoke's dev server stayed on `[::1]:5173`
and was stopped by PID after checking its cwd, as the addendum warns).

**S-9 — CSP sweep.** Rebuild the CSP gate build (S-5, `ci-gates.md:127`) first if another build ran since, then
`pnpm --filter aj-classes-e2e test:csp`. Expected: `23 passed` **(count)**; nothing listening on 4173 or 5173
afterwards. (Planning first ran it on the structured-data build of `ci-gates.md:167`, which has no lead form: every
case timed out waiting for `parent or guardian email`. That was a method error, not an app bug; on the `:127` build
23 passed.)

**S-10 — deploy order and scope.** AC 40 (no applied migration edited), R-S8. `node supabase/scripts/test-deploy-order.mjs`
→ exit 0. Static: `grep -n 'run supabase db push' supabase/scripts/deploy.sh` → line `279`;
`grep -n 'functions deploy' supabase/scripts/deploy.sh` → line `296`;
`grep -n 'config push --project-ref' supabase/scripts/deploy.sh` → line `334`. Never run `deploy.sh`.
`git diff --stat develop...HEAD -- supabase/scripts supabase/functions supabase/config.toml` → empty;
`git diff --name-only develop...HEAD -- supabase/migrations` → exactly
`supabase/migrations/20261121100000_mock_test_scoring.sql`;
`git diff develop...HEAD -- supabase/migrations/20261118100000_mock_tests.sql supabase/migrations/20261119100000_mock_test_closing.sql supabase/migrations/20261120100000_mock_test_categories.sql | wc -l`
→ `0`; `grep -cE 'update public\.mock_test_attempts|insert into public\.mock_test_attempts|delete from public\.mock_test_attempts' supabase/migrations/20261121100000_mock_test_scoring.sql`
→ `1` (the one write inside `mock_submit`, AC 41).

---

## 2. Database and raw API rows (Sittings 1 and 2, tester-api)

§2.2 to §2.9 are rolled back: run the named script from Appendix A and compare its output (with the run id
replaced by `<RUN>`: `sed "s/$RUN/<RUN>/g"`) with the expected lines, in order. Every expected line below was
produced by that script in the dry-run. JSON from `mock_submit` prints with keys in the order
`score, total, passed, percentage` (jsonb order); compare as printed.

### 2.1 Legacy: the real before and after (Sitting 1, first)

**LG-1 — the migration keeps every existing attempt and scores an old in-progress one at submit.** ACs 40, 41, 42,
44, 45, 31. `zsh "$S/lg.sh"` (Appendix A). It runs `supabase db reset --version 20261120100000` (the seed included),
builds a released, tagged test `t8-<RUN>-legacy` with 2 questions as postgres (no `marks` column exists yet),
`student@` submits (question 1 right, question 2 wrong), `parent@` answers both right and stays in progress, saves
every attempt (`email|score|total|submitted_at|id`) to `lg-before.txt`, runs `supabase migration up --local`, saves
the same query to `lg-after.txt`, and compares. Expected, in order:
`reset exit=0`; `20261120100000`; `0` (no `marks` column before); `{"score": 1, "total": 2}` (the old reply shape);
`parent@local.test|null|null`, `student@local.test|1|2`; `up exit=0`; `20261121100000`; `cmp exit=0` (byte-identical);
`2|2` (every question reads 1 mark); `null` (no pass mark);
`list|submitted|1|2|50|null` (student@'s list row: same N and M, 50%, no label);
`earned|1/1,0/1` (per-question marks add up to the stored score);
`parent submit|{"score": 2, "total": 2, "passed": null, "percentage": 100}` (scored at submit from the frozen
1-mark questions and key); `results|Aarav Demo|1/2|50|null Local Parent|2/2|100|null`.
It compares two attempts (one submitted, one in progress); the TSR says so. Afterwards run `pnpm db:reset` (the run's
one reset) and S-0.

### 2.2 Catalogue

**GR-1 — functions: definer, volatility, search path, execute.** ACs 36, 37 (grants), arch 3.1.
`docker exec -i supabase_db_aj_classes psql -U postgres -At -q < "$S/gr.sql"`, block `GR-1 functions`. Expected,
exactly these eight lines:
```
private.check_mock_question()|definer|v|strict=false|search_path=""|anon=false|auth=false|public=false
private.check_mock_test()|invoker|v|strict=false|search_path=""|anon=false|auth=false|public=false
private.mock_passed(score integer, total integer, pass_mark integer)|invoker|i|strict=true|search_path=""|anon=false|auth=false|public=false
private.mock_percentage(score integer, total integer)|invoker|i|strict=true|search_path=""|anon=false|auth=false|public=false
public.mock_submit(target uuid)|definer|v|strict=false|search_path=""|anon=false|auth=true|public=false
public.mock_test_open(target uuid)|definer|s|strict=false|search_path=""|anon=false|auth=true|public=false
public.mock_test_results(target uuid)|definer|s|strict=false|search_path=""|anon=false|auth=true|public=false
public.mock_tests_for_me()|definer|s|strict=false|search_path=""|anon=false|auth=true|public=false
```
Block `GR-1 return shapes`: `for_me|TABLE(id uuid, title text, question_count integer, status text, score integer, total integer, submitted_at timestamp with time zone, released_at timestamp with time zone, closes_at timestamp with time zone, subject text, stream text, year_levels smallint[], any_year boolean, percentage integer, passed boolean)`
and `results|TABLE(attempt_id uuid, taker_name text, submitted_at timestamp with time zone, score integer, total integer, percentage integer, passed boolean, total_rows bigint)`
(no e-mail, profile id or answer column, AC 35).

**GR-2 — columns, checks and triggers.** ACs 1, 6, 17, R-S7. Blocks `GR-2 columns` and `GR-2 triggers`. Expected:
`mock_test_attempts.score|smallint|YES|null`, `mock_test_attempts.total|smallint|YES|null` (unchanged type),
`mock_test_questions.marks|smallint|NO|1`, `mock_tests.pass_mark|smallint|YES|null`;
`mock_test_questions|mock_test_questions_marks_range|CHECK (((marks >= 1) AND (marks <= 100)))`,
`mock_tests|mock_tests_pass_mark_range|CHECK (((pass_mark >= 1) AND (pass_mark <= 100)))`; triggers, each `O`:
`mock_test_questions|mock_test_questions_check`, `mock_test_questions|mock_test_questions_set_updated_at`,
`mock_tests|mock_tests_check`, `mock_tests|mock_tests_check_tags`, `mock_tests|mock_tests_insert_released_needs_tags`,
`mock_tests|mock_tests_release_needs_tags`, `mock_tests|mock_tests_set_updated_at` (seven; no new trigger, arch §4).

**GR-3 — grants, policies, comment.** ACs 35, 38, arch 3.2. Block `GR-3`. Expected exactly:
`colgrants_tests|INSERT:any_year INSERT:instructions INSERT:pass_mark INSERT:stream INSERT:subject INSERT:title INSERT:year_levels UPDATE:any_year UPDATE:instructions UPDATE:pass_mark UPDATE:stream UPDATE:subject UPDATE:title UPDATE:year_levels`;
`colgrants_questions|INSERT:correct_option INSERT:explanation INSERT:marks INSERT:options INSERT:prompt INSERT:test_id UPDATE:correct_option UPDATE:explanation UPDATE:marks UPDATE:options UPDATE:prompt`;
`anon_cols|0`; `attempts_answers_grants|0`; `attempts_answers_policies|0`;
`questions_policies|mock_test_questions_admin_delete:DELETE:authenticated mock_test_questions_admin_insert:INSERT:authenticated mock_test_questions_admin_select:SELECT:authenticated mock_test_questions_admin_update:UPDATE:authenticated`;
`comment_score|Marks earned: the sum of the marks of the questions answered correctly. Written once, at submit.`

### 2.3 Marks and pass mark (admin side)

**MK-1 — marks on a draft.** ACs 1, 2, 3 (database side). `dr-marks.sh` block `MK-1`, inserts as admin@ aal2.
Expected: `nomarks|ok` (default), `m1|ok`, `m100|ok`;
`m0|23514:new row for relation "mock_test_questions" violates check constraint "mock_test_questions_marks_range"`,
and the same for `mneg` (-1) and `m101`;
`mnull|23502:null value in column "marks" of relation "mock_test_questions" violates not-null constraint`;
`mdec|ok` and `stored|1,1,100,3` (a direct `2.5` is rounded to 3: the known limit of L-12 #1; the web refuses
decimals, BM-2); `upd|ok`, `upd0|23514:…mock_test_questions_marks_range"`, `after|7,1,100,3`.

**MK-2 — pass mark on a draft.** ACs 6, 7 (database side). Block `MK-2`. Expected: `pnull|ok`, `p1|ok`, `p100|ok`;
`p0|23514:new row for relation "mock_tests" violates check constraint "mock_tests_pass_mark_range"`, the same for
`pneg` and `p101`; `pdec|ok`; `u60|ok`, `u0|23514:…mock_tests_pass_mark_range"`, `unull|ok`, `u75|ok`;
`made|p1:1 p100:100 pdec:61 pnull:null` (60.5 stored as 61, the known limit); `X|75`.

**MK-3 — frozen on a released and on a closed test.** ACs 3, 9, SC3, L-3. Block `MK-3` (X released, marks 3,2,
pass mark 60; Y released with marks 3,2 and no pass mark, then Close now). Expected as admin@ aal2:
`pchg|P0001:mock_released`, `psame|ok` (the same value is allowed), `pnull|P0001:mock_released` (can't be cleared),
`qmarks|P0001:mock_released`, `qsame|P0001:mock_released` (any question write, same value included: the question
trigger is column-agnostic), `qins|P0001:mock_released`, `qdel|P0001:mock_released`, `cset|P0001:mock_released`
(closed, null to 50), `cqmarks|P0001:mock_released`, `ctag|ok` (tags keep their own exception); as the table owner
`owner|P0001:mock_released`, `ownerq|P0001:mock_released`; then `X|released|60`, `Xmarks|3,2`,
`Y|released|null|true|english`, `Ymarks|3,2`.

**MK-4 — take back to draft: both editable again, the pass mark kept.** AC 9, arch §4 (take-back row). Block
`MK-4` (student@ in progress). Expected: `withdraw|ok`, `kept|draft|60`, `p80|ok`, `qm|ok`, `after|80|3,4`.

**MK-5 — release needs a question, not a pass mark.** ACs 5, 8, 17. Block `MK-5`. Expected:
`zeroq|P0001:mock_no_questions`, `nopass|ok`, `withpass|ok`, `st|r0:draft:60 r1:released:null r2:released:100`.

### 2.4 Score, percentage and Pass

**SC-1 — the two helpers, and who may call them.** ACs 14, 18, 21, SC5. `dr-score.sh` block `SC-1`, as postgres.
Inputs for `pct` (score, total): (2,3) (0,5) (5,5) (1,3) (59,100) (3,5) (10000,10000) (1,10000) (null,5) (3,null)
(0,0). Expected `pct|66 0 100 33 59 60 100 0 null null 0`. Inputs for `pass` (score, total, pass mark): (3,5,60)
(59,100,60) (2,3,67) (2,3,66) (400,400,90) (359,400,90) (360,400,90) (10000,10000,100) (9999,10000,100) (0,0,50)
(1,1,null) (null,5,50) (0,5,1) (1,100,1). Expected
`pass|true false false true true false true true false false null null false true`. Then
`auth pct|42501:permission denied for function mock_percentage`,
`auth pass|42501:permission denied for function mock_passed`, `anon pct|42501:permission denied for schema private`.

**SC-2 — the score is the sum of the marks answered correctly; blanks add 0; a repeat submit is identical.**
ACs 13, 15, 24. Block `SC-2` (marks 3, 2, 5; pass mark 60 on the first two tests, none on the third). Expected:
`q1+q3 right, q2 wrong|{"score": 8, "total": 10, "passed": true, "percentage": 80}`,
`repeat|{"score": 8, "total": 10, "passed": true, "percentage": 80}`,
`only q2, two blanks|{"score": 2, "total": 10, "passed": false, "percentage": 20}`,
`nothing answered|{"score": 0, "total": 10, "passed": false, "percentage": 0}`,
`no pass mark|{"score": 1, "total": 2, "passed": null, "percentage": 50}`,
`stored|parent@local.test:2/10 student@local.test:8/10 student@local.test:1/2 user@local.test:0/10`.

**SC-3 — boundaries end to end.** ACs 14, 17, 18, 21, R-S7. Block `SC-3`. Expected:
`3 of 5 at 60|{"score": 3, "total": 5, "passed": true, "percentage": 60}` (exact Pass),
`59 of 100 at 60|{"score": 59, "total": 100, "passed": false, "percentage": 59}`, `saved|100`,
`100x100 all right|{"score": 10000, "total": 10000, "passed": true, "percentage": 100}` (no smallint overflow),
`saved|4`, `4x100 at 90|{"score": 400, "total": 400, "passed": true, "percentage": 100}`,
`3x100 of 400 at 90|{"score": 300, "total": 400, "passed": false, "percentage": 75}`,
`2 of 3 at 67|{"score": 2, "total": 3, "passed": false, "percentage": 66}` (66.67% is below 67: floor and Pass
agree), `0 of 5|{"score": 0, "total": 5, "passed": false, "percentage": 0}`,
`5 of 5|{"score": 5, "total": 5, "passed": true, "percentage": 100}`,
`3 of 3 at 67|{"score": 3, "total": 3, "passed": true, "percentage": 100}`.

**SC-4 — a total of 1.** ACs 14, 15 (L-12 #2). Block `SC-4`. Expected:
`1 of 1|{"score": 1, "total": 1, "passed": true, "percentage": 100}`,
`0 of 1|{"score": 0, "total": 1, "passed": false, "percentage": 0}`, `list|submitted|1|1|100|true`,
`open q|1|1|1` (marks, marks earned, total marks).

### 2.5 What the taker sees, by state

`dr-shapes.sh` (test A: marks 3,2, pass mark 60; test B: marks 1,1, no pass mark; student@).

**SH-1 — before Start: test facts only, no result.** ACs 11, 12, strict nulls. Expected:
`ns top|closes_at,id,instructions,pass_mark,passed,percentage,question_count,questions,score,status,submitted_at,tags,title,total,total_marks`;
`ns vals|not_started|2|5|60|null|null|null|null|[]` (status, question count, total marks, pass mark, then score,
total, percentage, passed all null, no questions); `ns list|not_started|null|null|null|null|2`;
`nopass ns|null|2` (no pass mark: `pass_mark` null).

**SH-2 — in progress: marks per question, nothing else.** ACs 10, 12, strict nulls. Expected:
`ip vals|in_progress|null|null|null|5`; `ip qkeys|id,marks,options,position,prompt,selected_option`;
`ip marks|3,2`; `ip leak|f` (no `correct_option`, `explanation` or `marks_earned` anywhere in the reply);
`ip list|in_progress|null|null|null|null`.

**SH-3 — submitted: percentage, label and marks earned; no label without a pass mark.** ACs 15, 19, 20, 22.
Expected: `submit|{"score": 3, "total": 5, "passed": true, "percentage": 60}`;
`sub vals|submitted|3|5|60|true|5|60`;
`sub qkeys|correct_option,explanation,id,marks,marks_earned,options,position,prompt,selected_option`;
`sub earned|3/3,0/2`; `sub list|submitted|3|5|60|true`; on B
`{"score": 1, "total": 2, "passed": null, "percentage": 50}`, `nopass sub|50|null`,
`nopass list|submitted|1|2|50|null`.

**SU-1 — per-question marks add up to the score, new and legacy-shaped.** ACs 22, 23, 31. `dr-sum.sh` (A: marks
3,2,5, pass mark 60; L: three 1-mark questions, no pass mark, with a legacy-shaped attempt for parent@ written as
postgres: score 2, total 3, answers right, right, wrong, submitted two days ago). Each check line is
`<who>|sum of marks_earned|score in mock_test_open|score in mock_tests_for_me`. Expected:
`student A|8|8|8`, `parent A|7|7|7`, `parent legacy|2|2|2`, `legacy list|submitted|2|3|66|null`,
`legacy earned|1/1,1/1,0/1`, `legacy repeat|ok|{"score": 2, "total": 3, "passed": null, "percentage": 66}`,
`user A|0|0|0`; the three submit replies before them as in Appendix B.

**SU-2 — nothing recalculates after close, reopen or a tag edit.** AC 43. Same script. Expected: `rows|4`,
`close|ok|ok`, `reopen|ok|ok`, `tags|ok`, `changed|0` (every attempt's score, total and submitted_at identical
before and after, compared both ways with `except`).

### 2.6 Closed tests (closing S-1, with scores)

`dr-closed.sh`: A (marks 3,2, pass mark 60) submitted by student@, parent@ and user@ (question 1 right: 3 of 5);
B the same marks, each in progress with question 1 answered; C nobody started. All three closed with Close now.

**CS-1 — a submitter keeps the closed test with score, percentage and label, in each role.** ACs 25, 27.
Expected for each of `student@local.test`, `parent@local.test`, `user@local.test`:
`<e-mail> list|ca:submitted:true:3/5:60:true` (only A listed, closed);
`<e-mail> open|submitted|3|5|60|true|3/3:1:Because B1.,0/2:1:` (per question marks earned/marks, correct option,
explanation; question 2 has none);
`<e-mail> again|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}|PGRST:{…same…}` (repeat
submit and start: not found, L-2).

**CS-2 — an in-progress taker can't open, save or submit.** AC 26. Expected for each role:
`<e-mail> B|PGRST:{…not_found…}|PGRST:{…not_found…}|PGRST:{…not_found…}` (open, submit, save, same text each), then
`B attempts|true:1 true:1 true:1` (three attempts, none submitted, one answer each).

**CS-3 — a taker who never started sees nothing.** AC 26. Expected for each role:
`<e-mail> C|PGRST:{…not_found…}|PGRST:{…not_found…}` (open, start).

**CS-4 — the admin's results for closed tests.** ACs 32, 33. Expected:
`admin|Aarav Demo|3/5|60|true Local Parent|3/5|60|true Local User|3/5|60|true`, `admin B|0` (in-progress attempts
are not rows), `admin list|ca:3 cb:0 cc:0` (submitted counts equal the row counts).

### 2.7 The admin results function

**RS-1 — rows, order, count, shape, empty cases.** ACs 28, 29, 33, 34, 35. `dr-results.sh` block `RS-1` (A: marks
3,2, pass mark 60; student@ 5 of 5 submitted an hour earlier, parent@ 2 of 5, user@ in progress; D a draft; N
released, nobody submitted). Each row line is `name|score|total|percentage|passed|total_rows`, newest first.
Expected: `cols|attempt_id,taker_name,submitted_at,score,total,percentage,passed,total_rows`;
`rows|Local Parent|2|5|40|false|2 Aarav Demo|5|5|100|true|2`; `count|2|2` (rows = the admin list's
`submitted_count`); `draft|none`; `nobody|none`;
`unknown|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}`; `no at|0` (no row text has `@`);
`list keys|any_year,closes_at,created_at,created_by_name,id,question_count,released_at,status,stream,subject,submitted_count,title,updated_at,year_levels`
(the admin list still has no taker name or score, AC 39).

**RS-2 — equal times break on the attempt id; closing changes no row.** ACs 32, 34. Same block. Expected:
`tie|t` (with both submit times equal, the order equals `order by attempt id`); `close|ok`; `closed rows|t|2` (the
row text after Close now equals the text before it).

**RS-3 — the name: profile, else roster, else null; never the e-mail.** AC 30, L-8. Block `RS-2` of the script
(three 1-mark submissions, user@ newest, student@ oldest; student@'s profile name set to `Profile Aarav`, roster
name to `Roster Aarav`, inside the rollback). Expected:
`named|Local User|1|1|100|null|3 Local Parent|0|1|0|null|3 Profile Aarav|1|1|100|null|3`; then with student@'s and
parent@'s profile names `''` and user@'s `'   '`:
`blank|null|1|1|100|null|3 null|0|1|0|null|3 Roster Aarav|1|1|100|null|3` (null shows as "Name not set" in the web,
BA-6).

### 2.8 Who can see results, and who can write marks

**AZ-1 — `mock_test_results` refuses everyone but an active admin at aal2.** ACs 36, 37. `dr-az.sh`. Expected:
`<who> results|42501:not_admin` for each of `tutor@local.test aal1`, `tutor@local.test aal2`,
`parent@local.test aal1`, `student@local.test aal1`, `user@local.test aal1`, `user@local.test aal2`,
`inactive@local.test aal2`, `newadmin@local.test aal1`, `admin@local.test aal1`;
`admin aal2 results|ok|1`; `inactive admin aal2 results|42501:not_admin` (admin@ deactivated inside the rollback);
`anon results|42501:permission denied for function mock_test_results`.

**AZ-2 — nobody reads attempts or answers directly.** AC 38, ADR-0012 decision 3. Same script. Expected for each of
the nine `<who>` above:
`<who> attempts|42501:permission denied for table mock_test_attempts:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_attempts TO authenticated;|42501:permission denied for table mock_test_answers:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_answers TO authenticated;`.

**AZ-3 — non-admins and an aal1 admin can't write marks or the pass mark.** ACs 3, 9. Same script (a draft, pass
mark 50, one question at 1 mark). Expected for each of the nine: `<who> passmark|0` and `<who> marks|0` (RLS leaves
no row, no error); `anon passmark|42501:permission denied for table mock_tests:Grant the required privileges to the current role with: GRANT SELECT, UPDATE ON public.mock_tests TO anon;`;
`D|50|1` (unchanged).

**PV-1 — each taker sees only their own result.** AC 38 (parents see their own attempts, not a child's). `dr-reg.sh`
(marks 3,2,5, pass mark 60; student@ 10 of 10, parent@ 2 of 10, user@ in progress). Expected:
`student|10/10|100|true|10`, `parent|2/10|20|false|2`, `parent sees 10|0|0` (no list row and no open reply carries
10), `user|in_progress|null|null|null`.

**PV-2 — the taker gate is unchanged.** Regression of the v1 and closing gates (AZ-3 there). Same script. Expected:
`draft|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}`, `listdraft|0`,
`tutor|42501:not_taker`, `admin as taker|42501:not_taker`.

### 2.9 Two sessions (Sitting 2; real concurrency, commits)

Real concurrency through `cc` (background) and `wait`. Wall-clock values are **compare shape**. Session A holds
its locks with `pg_sleep(4)` after its write; session B starts with `pg_sleep(1)`, so A is first. **B's elapsed
time proves it waited**: expected 2.5 to 6 s (without a wait it would be about 1.1 s); A's is 4 to 6 s. Each row
builds its own fixture and ends with `invariant` → `0`; the mid-sitting clean-up (§0.4 item 2) removes them all
before S-6. Never run two TS rows at once. Paste the
raw `cc-*.txt` lines into the TSR (arch §4 calls this the must-pass gate). `dr-cc.sh` ran each pair one after the
other inside a rollback, which proves the SQL and the outcome; planning also ran each pair for real
(`ts-real.sh`): every B waited (4.2 to 4.3 s).

```sh
export S=…; . "$S/t8.sh"
row() { cat "$S/cc-A.txt" "$S/cc-B.txt"; echo "after|$(state_of "$X")|$(marks_of "$X")|inv=$(invariant)"; }
```

**TS-1 — release holds; a pass-mark write waits, then is refused.** ACs 9, SC3, arch §4 order A.
`X=$(mk_test ts1 '2' draft 50)`; `cc A admin@local.test aal2 "select public.mock_release('$X'); select pg_sleep(4)"`;
`cc B admin@local.test aal2 "select pg_sleep(1); update public.mock_tests set pass_mark=80 where id='$X'"`; `wait; row`.
Expected: `A||elapsed=` 4 to 6; `B|ERROR:  mock_released|elapsed=` 2.5 to 6; `after|released|50|null|false|2|inv=0`.
A `B||elapsed=…` (the write landed) is a FAIL.

**TS-2 — a pass-mark write holds; release waits, then releases with the new value, which is then frozen.** Order B.
`X=$(mk_test ts2 '2' draft 50)`; `cc A admin@local.test aal2 "update public.mock_tests set pass_mark=80 where id='$X'; select pg_sleep(4)"`;
`cc B admin@local.test aal2 "select pg_sleep(1); select public.mock_release('$X')"`; `wait; row`; then
`as_w admin@local.test aal2 "update public.mock_tests set pass_mark=60 where id='$X'"`; `state_of $X`. Expected: A and
B no error, B 2.5 to 6 s; `after|released|80|null|false|2|inv=0`; then `ERROR:  mock_released` and
`released|80|null|false`.

**TS-3 — a submit holds the test; a pass-mark write waits, then is refused; the label stays.** 03 §9 mirror.
`X=$(mk_test ts3 '2' released 50); take student@local.test $X in_progress 1`;
`cc A student@local.test aal1 "select public.mock_submit('$X'); select pg_sleep(4)"`;
`cc B admin@local.test aal2 "select pg_sleep(1); update public.mock_tests set pass_mark=10 where id='$X'"`; `wait; row`.
Expected: `A|{"score": 2, "total": 2, "passed": true, "percentage": 100}|elapsed=` 4 to 6;
`B|ERROR:  mock_released|elapsed=` 2.5 to 6; `after|released|50|null|false|2|inv=0`.

**TS-4 — release holds; a marks write waits, then is refused.** AC 3. `X=$(mk_test ts4 '2' draft 50)`;
`cc A admin@local.test aal2 "select public.mock_release('$X'); select pg_sleep(4)"`;
`cc B admin@local.test aal2 "select pg_sleep(1); update public.mock_test_questions set marks=7 where test_id='$X'"`; `wait; row`.
Expected: `B|ERROR:  mock_released|elapsed=` 2.5 to 6; `after|released|50|null|false|2|inv=0`.

**TS-5 — a marks write holds; release waits and keeps it; the score uses it.** ACs 3, 13.
`X=$(mk_test ts5 '2' draft 50)`; `cc A admin@local.test aal2 "update public.mock_test_questions set marks=7 where test_id='$X'; select pg_sleep(4)"`;
`cc B admin@local.test aal2 "select pg_sleep(1); select public.mock_release('$X')"`; `wait; row`; then
`take student@local.test $X submitted 1`. Expected: no errors, B 2.5 to 6 s; `after|released|50|null|false|7|inv=0`;
`{"score": 7, "total": 7, "passed": true, "percentage": 100}`.

**TS-6 — take back to draft holds; a pass-mark write waits, then lands on the draft.** AC 9 (editable again).
`X=$(mk_test ts6 '2' released 50); take parent@local.test $X in_progress 1`;
`cc A admin@local.test aal2 "select public.mock_withdraw('$X'); select pg_sleep(4)"`;
`cc B admin@local.test aal2 "select pg_sleep(1); update public.mock_tests set pass_mark=80 where id='$X'"`; `wait; row`;
`attempts_of $X`. Expected: no errors, B 2.5 to 6 s; `after|draft|80|null|false|2|inv=0`; attempts `` (empty: the
in-progress attempt went with the take-back).

### 2.10 Through PostgREST (Sitting 2, after TS; commits)

Fixtures: `HX=$(mk_test hx '3,2' released 60); take student@local.test $HX submitted '1,0'`; tokens
`for E in tutor@local.test parent@local.test student@local.test user@local.test admin@local.test inactive@local.test; do tok $E; done; tok2`
(`tok2` prints `admin2 aal=aal2`). Bodies below are as PostgREST returns them (key order `code, details, hint,
message`). Removed by the mid-sitting clean-up before S-6 (§0.4 item 2); token files deleted at the end of the
sitting.

**H-1 — the role matrix by HTTP.** AC 37. `rest POST <who> rpc/mock_test_results "{\"target\":\"$HX\"}"` for each of
`tutor@`, `parent@`, `student@`, `user@` and `admin@` (password grant, aal1) →
`403 {"code":"42501","details":null,"hint":null,"message":"not_admin"}`; `anon` →
`401 {"code":"42501","details":null,"hint":null,"message":"permission denied for function mock_test_results"}`;
`inactive@`'s token is empty and `inactive@local.test.tokstatus` reads `user_banned 400` (refused before any call). A 200
for any of them is a FAIL.

**H-2 — an admin at aal2 gets the row, and not-found by id.** ACs 29, 35, 36. `rest POST admin2 …` → `200` with 1 row
whose keys are exactly `attempt_id, passed, percentage, score, submitted_at, taker_name, total, total_rows`
(sorted), `taker_name` `Aarav Demo`, `score` 3, `total` 5, `percentage` 60, `passed` true, `total_rows` 1; with
target `00000000-0000-4000-8000-000000000000` →
`404 {"code":"P0002","details":null,"hint":null,"message":"not_found"}`.

**H-3 — the taker's calls carry the new keys.** ACs 15, 19, 22, 24. As student@: `rpc/mock_test_open` → `200`,
`score` 3, `total` 5, `percentage` 60, `passed` true, `total_marks` 5, `pass_mark` 60, questions
`[(3, 3), (2, 0)]` (marks, marks_earned); `rpc/mock_tests_for_me {}` → `200`, the t8 rows exactly
`[('submitted', 3, 5, 60, True)]`; `rpc/mock_submit` again →
`200 {"score": 3, "total": 5, "passed": true, "percentage": 60}`; as parent@ `rpc/mock_tests_for_me` → t8 rows
`[('not_started', None, None, None)]` (status, score, percentage, passed).

**H-4 — no pass-mark write by a taker or anon.** ACs 9, 38. `rest PATCH parent@local.test "mock_tests?id=eq.$HX" '{"pass_mark":10}'`
→ `204` and `state_of $HX` → `released|60|null|false`; `rest PATCH anon …` →
`401 {"code":"42501","details":null,"hint":"Grant the required privileges to the current role with: GRANT SELECT, UPDATE ON public.mock_tests TO anon;","message":"permission denied for table mock_tests"}`.

**H-5 — more than 1000 submissions: PostgREST stops at 1000, the true count comes along.** Arch 3.4 ("showing 1000
of N"). **Method:** a real fixture larger than PostgREST's `max_rows = 1000` (`supabase/config.toml:19`):
`HB=$(mk_test hb '1,1' released 50)`, then the bulk block of §3.0 step 9 on `$HB` (1003 throwaway accounts
`t8-bulk-0001` … `t8-bulk-1003@local.test`, names `Bulk 0001` … `Bulk 1003`, each with one submitted attempt,
`Bulk 0001` first at 10:01 on 1 Nov 2026 Melbourne time, one minute apart, score `n % 3` of 2; dry-run
`dr-bulk.sh`). Then `rest POST admin2 rpc/mock_test_results "{\"target\":\"$HB\"}"` and read `$S/last.json` and
`$S/last.hdrs`. Expected: `200`; 1000 rows; `total_rows` `1003` on the first row; first row `Bulk 1003`, last row
`Bulk 0004` (the three oldest are cut); header `Content-Range: 0-999/*`. In the database the function itself is not
cut: `dr-bulk.sh` `fn|1003|1003|1003|Bulk 1003|Bulk 0001`. The mid-sitting clean-up removes the accounts (cascade), then
`db "select count(*) from public.profiles where email like 't8-bulk-%'"` → `0`.

---

## 3. Browser rows (Sittings 3 and 4, tester-ui)

Viewport 1280×800 and light unless a row says otherwise. Account `admin@` unless stated. Texts are from
`apps/web/src/constants/mock-tests.constants.ts` (`MOCK_SCORING`, `MOCK_PASS_LABELS`, `MOCK_RESULT`,
`MOCK_RESULTS_PAGE`, `MOCK_TAKE_PAGE`, `MOCK_VALIDATION`) and `online-assignments.constants.ts`
(`QUESTION_BUILDER.marks`/`total`, `QUESTION_DIALOG.marksLabel`, `QUESTION_VALIDATION.marksRange`).

### 3.0 Fixtures (committed at the start of Sitting 3; dry-run `dr-fx.sh`)

```sh
export S=…; . "$S/t8.sh"
BS=$(mk_test bs '3,2' released 60)                       # 1  results rows, Pass / Not yet
B59=$(mk_test b59 '59,41' released 60)                   # 2  59 of 100, Not yet
BNP=$(mk_test bnp '1,1' released)                        # 3  no pass mark
B1=$(mk_test b1 '1' released 50)                         # 4  a total of 1
BCL=$(mk_test bcl '3,2' released 60 'english|vce|{11,12}|false')   # 5  closed
BNEW=$(mk_test bnew '3,2' released 60)                   # 6  taken in the browser (BT-1, BT-3, BT-4)
BNEW2=$(mk_test bnew2 '1,1' released)                    # 7  intro with no pass mark (BT-2)
BLEG=$(mk_test bleg '1,1' released)                      # 8  legacy-shaped attempt (BT-10)
db "insert into public.mock_test_attempts (test_id, profile_id, started_at, submitted_at, score, total) values ('$BLEG', (select id from public.profiles where email='student@local.test'), now() - interval '2 days', now() - interval '2 days', 1, 2)"
db "insert into public.mock_test_answers (attempt_id, question_id, selected_option) select a.id, q.id, case q.position when 1 then 1 else 0 end from public.mock_test_attempts a join public.mock_test_questions q on q.test_id=a.test_id where a.test_id='$BLEG'"
BDR=$(mk_test bdr '2,3' draft 60)                        # 9  draft with marks and a pass mark
BDR1=$(mk_test bdr1 '1' draft)                           # 10 draft, 1 mark, no pass mark
take student@local.test $BS submitted '1,0'; take parent@local.test $BS submitted '-,1'; take user@local.test $BS in_progress '1'
take user@local.test $B59 submitted '1,0'; take parent@local.test $BNP submitted '1,0'
take student@local.test $B1 submitted '1'; take user@local.test $B1 submitted '0'
take student@local.test $BCL submitted '1,1'; take parent@local.test $BCL in_progress '1'; close_now $BCL
for v in BS B59 BNP B1 BCL BNEW BNEW2 BLEG BDR BDR1; do eval "echo $v=\$$v"; done > "$S/fx.env"
db "select count(*) from public.mock_tests where title like 't8-%'"
```

Expected: the last line `10`;
`db "select string_agg(replace(title, 't8-$RUN-', '')||':'||submitted_count, ' ' order by title) from public.mock_tests_admin_list() …"`
is admin-only, so check as admin: `as_user admin@local.test aal2 "select string_agg(replace(title, 't8-$RUN-', '')||':'||submitted_count, ' ' order by title) from public.mock_tests_admin_list() where title like 't8-%'"`
→ `b1:2 b59:1 bcl:1 bdr:0 bdr1:0 bleg:1 bnew:0 bnew2:0 bnp:1 bs:2`. Each taker's view
(`as_user <e-mail> aal1 "select string_agg(replace(title, 't8-$RUN-', '')||':'||status||coalesce(':'||score||'/'||total||':'||percentage||':'||coalesce(passed::text,'-'), ''), ' ' order by title) from public.mock_tests_for_me() where title like 't8-%'"`):
student@ `b1:submitted:1/1:100:true b59:not_started bcl:submitted:5/5:100:true bleg:submitted:1/2:50:- bnew:not_started bnew2:not_started bnp:not_started bs:submitted:3/5:60:true`;
parent@ `b1:not_started b59:not_started bleg:not_started bnew:not_started bnew2:not_started bnp:submitted:1/2:50:- bs:submitted:2/5:40:false`;
user@ `b1:submitted:0/1:0:false b59:submitted:59/100:59:false bleg:not_started bnew:not_started bnew2:not_started bnp:not_started bs:in_progress`
(dry-run `dr-fx.sh` gave these lines). Times: `bs`'s parent@ submit is newer than student@'s (the `take` lines run in order).

Step 9, the bulk block (BA-7 only; built right before BA-7 and removed in the same row):
```sh
BB=$(mk_test bulk '1,1' released 50)
db "insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) select gen_random_uuid(), 'authenticated', 'authenticated', 't8-bulk-'||lpad(g::text, 4, '0')||'@local.test', '{\"provider\":\"email\",\"providers\":[\"email\"]}', jsonb_build_object('full_name', 'Bulk '||lpad(g::text, 4, '0')) from generate_series(1, 1003) g"
db "insert into public.mock_test_attempts (test_id, profile_id, started_at, submitted_at, score, total) select '$BB', p.id, timestamptz '2026-11-01 09:00+11', timestamptz '2026-11-01 10:00+11' + p.n * interval '1 minute', p.n % 3, 2 from (select id, row_number() over (order by email) as n from public.profiles where email like 't8-bulk-%') p"
```

### 3.1 Marks (admin; Sitting 3)

**BM-1 — the Marks field, default 1, on a new question.** ACs 1, 2, 4, 10. On `bdr1`'s page, `Add question`. Expected:
dialog `New question` with a field labelled `Marks` (`getByRole('spinbutton', { name: 'Marks' })`), value `1`,
attributes `min="1"`, `max="100"`, `step="1"`, placed after the options and before `Explanation (optional)`. Fill
prompt `What is 3 + 4?`, options `7`, `8`, correct A, Marks `3`, `Save question`. Expected: the new card reads
`Question 2` with `3 marks` next to it; question 1's card reads `1 mark`;
`marks_of $BDR1` → `1,3`; the Scoring card reads `Total 4 marks`.

**BM-2 — Marks values refused in the dialog.** ACs 2, 7 (field-level message from the constants), L-12 #5. On
`bdr1`, `Add question`, prompt and two options filled, correct A. For each Marks value in turn: empty, `0`, `-1`,
`2.5`, `101`, `1e2` → press `Save question`. Expected each time: helper text under Marks exactly
`Marks must be a whole number from 1 to 100.`, the field in its error state (`aria-invalid="true"`), the dialog
stays, no POST to `/rest/v1/mock_test_questions`. Then `100` → saves; `marks_of $BDR1` → `1,3,100`. Then delete
that question again (R-3's delete flow) → `1,3`.

**BM-3 — edit a question's marks on a draft.** ACs 1, 4. On `bdr`: question 2 (`3 marks`) `Edit` → Marks shows
`3`; change to `5`, `Save question`. Expected: `5 marks` on the card; Scoring card `Total 7 marks`;
`marks_of $BDR` → `2,5`. Change it back to `3` (`Total 5 marks`).

**BM-4 — the Scoring card: total marks once, and the pass mark.** ACs 4, 9, L-12 #3. On `bdr`: card headed
`Scoring` after `Tags` and before `Instructions`, with exactly two lines `Total 5 marks` and `Pass mark: 60%`; the
text `Total 5 marks` appears once on the page (`getAllByText('Total 5 marks')` → 1); the Questions header shows
`2 of 100 questions`; each card shows `2 marks` and `3 marks`. On `bdr1`: `Total 4 marks` (after BM-1) and
`No pass mark`. On a fresh draft `mk_test bm4 '1' draft`: `Total 1 mark` (singular).

**BM-5 — no marks control on a released or a closed test.** AC 3. On `bs` (released) and `bcl` (closed): no
`Add question`, no `Edit` or `Delete` on any card, no spinbutton named `Marks` anywhere, the note
`This mock test is released, so its questions can’t change.`; cards show `3 marks` and `2 marks`; Scoring card
`Total 5 marks`, `Pass mark: 60%`. (The database refusal is MK-3.)

### 3.2 Pass mark (admin; Sitting 3)

**BP-1 — the pass mark in New mock test.** ACs 6, 8. `/portal/admin/mock-tests` → `New mock test`. Expected:
field `Pass mark (%, optional)` (spinbutton, empty, `min="1"`, `max="100"`, `step="1"`) after
`Instructions (optional)` and before the tag selects, with helper text exactly
`A whole number from 1 to 100. Leave it empty for no pass mark. It can’t be changed after release.`. Title
`t8-<RUN>-bp1`, tags Maths / NAPLAN / Any year, pass mark `60`, `Create mock test`. Expected: the edit page, Scoring
card `Total 0 marks` and `Pass mark: 60%`; `db "select pass_mark from public.mock_tests where title='t8-$RUN-bp1'"`
→ `60`. A second one, `t8-<RUN>-bp1b`, with the same tags (Maths / NAPLAN / Any year) and the field left empty →
`No pass mark`, database `null` (`-At` prints an empty line).

**BP-2 — pass mark values refused.** AC 7, L-12 #5. `New mock test`, title `t8-<RUN>-bp2`, then for each value in
turn: `0`, `-1`, `60.5`, `101`, `1e2` → `Create mock test`. Expected each time: helper text exactly
`Please enter a whole number from 1 to 100, or leave the pass mark empty.` (replacing the hint), field
`aria-invalid="true"`, dialog stays, no POST to `/rest/v1/mock_tests`. Then `1` → created; `100` on another
(`t8-<RUN>-bp2b`) → created; database `1` and `100`.

**BP-3 — change and clear the pass mark on a draft.** AC 6. On `bp1`: `Edit details` → the field shows `60`;
change to `75`, `Save` → `Details saved.`, `Pass mark: 75%`, database `75`; `Edit details`, clear the field,
`Save` → `No pass mark`, database null.

**BP-4 — release with or without a pass mark; the dialog is unchanged.** ACs 5, 8. On `bp1b` (no pass mark): add
one question (prompt `Q?`, options `a`, `b`, correct A, marks default), `Release` → dialog `Release this mock test?`
with text exactly
`Students, parents and signed-up users will be able to take it free of cost. Questions and details can’t be changed after this.`
and no pass-mark field; `Release` → `Released. People can take it now.`; Scoring card `Total 1 mark`,
`No pass mark`. As student@ its card shows no `Pass mark` line anywhere (BT-2 covers the intro).

**BP-5 — take back to draft keeps the pass mark and makes it editable.** AC 9, MK-4. Fixture
`BP5=$(mk_test bp5 '3,2' released 70); take student@local.test $BP5 in_progress 1`. On `bp5`: no `Edit details`
(released); Scoring `Pass mark: 70%`. `Take back to draft` → confirm → `Back to draft.`; Scoring still
`Pass mark: 70%`; `Edit details` → field `70`; change to `65`, `Save` → `Pass mark: 65%`; `state_of $BP5` →
`draft|65|null|false`.

### 3.3 The edit page in each state (Sitting 3)

Every status line, notice and button text (lesson from the closing gate: a new state gets a row per screen).

**BE-1 — draft (`bdr`).** Expected, exactly: chip `Draft`; info notice
`Draft: only admins can see this mock test. Release it when it is ready.`; header buttons in order `Results`,
`Edit details`, `Release`, `Delete draft`; no tag or question hint (it is tagged and has questions); cards in
order `Tags`, `Scoring` (`Total 5 marks`, `Pass mark: 60%`), `Instructions` (`Fixture instructions for bdr.`),
then `Questions` with `2 of 100 questions`, `Add question`.

**BE-2 — released, open (`bs`).** Expected, exactly: chip `Released`; notice
`Released: students, parents and signed-up users can take it. It can only go back to draft until someone submits it.`;
buttons in order `Results`, `Edit tags`, `Set closing date`, `Close now`, `Take back to draft`; no `Edit details`;
Scoring `Total 5 marks`, `Pass mark: 60%`; the locked note
`This mock test is released, so its questions can’t change.`.

**BE-3 — closed (`bcl`).** Expected, exactly: chips `Released` and `Closed`; a line `Closed <formatted>`; notice
`Closed: people who haven’t submitted it can’t see or take it. People who submitted it still see their result. Open it again with Set closing date.`;
buttons in order `Results`, `Edit tags`, `Set closing date`, `Take back to draft` (no `Close now`); Scoring
`Total 5 marks`, `Pass mark: 60%`; the locked note as BE-2. No text on the page says people "can take it".

### 3.4 The admin Results view (Sitting 3)

**BA-1 — the list: a Results link on every row, no names or scores.** ACs 28, 39. `/portal/admin/mock-tests`.
Expected: column headers in order `Title, Status, Tags, Questions, Submitted, Created by, Last changed, Results`;
every row (drafts `bdr`, `bdr1` included) has a link `Results` whose accessible name is
`Results for t8-<RUN>-<label>` and whose `href` ends with `/portal/admin/mock-tests/<id>/results`; `bs`'s Submitted
cell `2`; the page text contains none of `Aarav Demo`, `Local Parent`, `Local User`, `of 5 marks`, `%`, `Pass`,
`Not yet` (case-sensitive), and no `@`.

**BA-2 — the Results page with rows.** ACs 29, 34, 35, 48. Press `bs`'s `Results`. Expected: URL
`/portal/admin/mock-tests/<BS>/results`; `document.title` contains `Mock test results`; h1 exactly `Results: t8-<RUN>-bs`; intro exactly
`Everyone who has submitted this mock test, newest first. Names and scores only. Answers are not shown.`; back link
`← Back to mock test` to `/portal/admin/mock-tests/<BS>`; meta line `Pass mark: 60%`, no `Closed` chip; table with
accessible name `Mock test results`, five column headers `Name`, `Submitted`, `Score`, `Percentage`, `Result`
(`getAllByRole('columnheader')` → 5); exactly two body rows, in order
`Local Parent | <parent's submitted_at formatted> | 2 of 5 marks | 40% | Not yet` and
`Aarav Demo | <student's submitted_at formatted> | 3 of 5 marks | 60% | Pass` (times per §0.1 from
`db "select p.email||'|'||a.submitted_at from public.mock_test_attempts a join public.profiles p on p.id=a.profile_id where a.test_id='$BS' and a.submitted_at is not null order by 1"`);
no `Local User` (in progress); inside `main`: no `button`, `input`, `select`, `textarea` or `form`, and no link
other than the back link; no `@` in the page text; requests to `/rest/v1/` are exactly two: a `GET mock_tests` whose decoded
`select` parameter is `id,title,status,closes_at,pass_mark`, and `POST rpc/mock_test_results`.

**BA-3 — a draft, and a test nobody submitted.** ACs 28, 34. `bdr`'s Results (via the edit page's `Results`
button). Expected: h1 `Results: t8-<RUN>-bdr`; meta `Pass mark: 60%`; text exactly
`No one has submitted this test yet.` in the secondary text colour; no `table`; no `Showing` note. `bnew`'s Results:
the same empty text, meta `Pass mark: 60%`. `bdr1`'s Results: the empty text and **no** meta line (no pass mark, not
closed).

**BA-4 — a closed test.** AC 32. `bcl`'s Results. Expected: meta has the chip `Closed` and `Pass mark: 60%`; one row
`Aarav Demo | … | 5 of 5 marks | 100% | Pass`; no `Local Parent` (in progress). Screenshot the page at 375 and 1280, light and dark (V-2). Then reopen it as a fixture
(`as_w admin@local.test aal2 "select public.mock_set_closing('$BCL', null)"`), reload: the same row text, no
`Closed` chip; close it again (`close_now $BCL`) for later rows.

**BA-5 — no pass mark, and a legacy-shaped attempt.** ACs 20, 31, 45. `bnp`'s Results: no meta line; one row
`Local Parent | … | 1 of 2 marks | 50% | ` with an empty Result cell (`textContent` `''`). `bleg`'s Results: one row
`Aarav Demo | <two days ago, formatted> | 1 of 2 marks | 50% | ` (empty Result). `b1`'s Results (pass mark 50,
total 1): rows `Local User | … | 0 of 1 mark | 0% | Not yet` then `Aarav Demo | … | 1 of 1 mark | 100% | Pass`
(singular, L-12 #2).

**BA-6 — the name fallback.** AC 30, L-8. Shared seed state, restored in the row:
`db "update public.profiles set full_name='' where email='student@local.test'"`,
`db "update public.profiles set full_name='   ' where email='user@local.test'"`. Reload `b1`'s Results. Expected:
rows `Name not set | … | 0 of 1 mark | 0% | Not yet` (user@: no roster row) and
`Aarav Demo | … | 1 of 1 mark | 100% | Pass` (student@: the roster name); no `@` anywhere. Restore:
`db "update public.profiles set full_name='Aarav Demo' where email='student@local.test'"`,
`db "update public.profiles set full_name='Local User' where email='user@local.test'"`, then S-0's profiles line →
identical.

**BA-7 — more than 1000 submissions.** Arch 3.4, design §6.3 ("More than 1000"). Build step 9 of §3.0 (`BB`), open
its Results. Expected: text exactly
`Showing 1000 of 1003 submissions. The oldest are not listed.` above the table; exactly 1000 body rows; first row
name `Bulk 1003`, last `Bulk 0004`; `Bulk 0001`, `Bulk 0002`, `Bulk 0003` absent; the first row's Submitted is
`2 Nov 2026, 2:43 am` (10:00 on 1 Nov AEDT plus 1003 minutes, formatted per §0.1) and the last row's
`1 Nov 2026, 10:04 am`; console `0`. Then `bs`'s Results shows no `Showing` text. Remove in the row:
`db "delete from public.mock_test_attempts where test_id='$BB'"`; `db "delete from auth.users where email like 't8-bulk-%@local.test'"`;
`db "update public.mock_tests set status='draft', released_at=null, released_by=null where id='$BB'"`;
`db "delete from public.mock_tests where id='$BB'"`; `db "select count(*) from public.profiles"` → `7`.

**BA-8 — not found, and a failed load.** AC 46. `/portal/admin/mock-tests/00000000-0000-4000-8000-000000000000/results`
→ heading `Not found` and `This page doesn't exist, or you don't have access to it.`; no `rpc/mock_test_results`
request (the header read finds no test). Then on `bs`'s Results with Playwright
`page.route('**/rest/v1/rpc/mock_test_results', r => r.abort('failed'))`, reload. Expected: an error alert with text
exactly `We couldn't reach the server. Check your connection and try again.` and a button `Try again`; unroute,
press `Try again` → the table of BA-2. (The route's own `Failed to load resource` line is excluded from the console
count, §0.1.)

**BA-9 — nobody else gets in.** ACs 36, 37. `bs`'s Results URL, each in a fresh context:
`tutor@`, `parent@`, `student@`, `user@` → heading exactly `You don't have access to this page` and
`This page isn't part of your account.`; no request to `rpc/mock_test_results` or `mock_tests?`; `newadmin@` (admin
with no authenticator) → stays on a `/portal/login/verify` page, no `rpc/mock_test_results` request; signed out →
`/portal/login?next=%2Fportal%2Fadmin%2Fmock-tests%2F<BS>%2Fresults`; `inactive@` → the sign-in refuses with
`Email or password is incorrect.` (`user_banned` maps to `invalidCredentials`, `services/auth-errors.ts:29`).
Each role separately, one screenshot each.

**BA-10 — the Results button on the edit page, and back.** ACs 28, 48. On `bdr`, `bs` and `bcl`: the outlined
`Results` button (the first header button) opens `/…/<id>/results`; on the Results page `← Back to mock test`
returns to the edit page with its h1.

**PR-1 — the privacy sentence.** S-2, release gate. `/privacy` signed out, at 375×800 and 1280×800. Expected: the
`Portal accounts` section's text contains exactly (as one substring)
`If you take a mock test, we keep your answers and score until your account is deleted, and AJ Classes admins can see your name and score.`;
status 200; one `h1`; overflow `0`; console `0`. Static: `grep -c 'If you take a mock test, we keep your answers and score until your account is deleted, and AJ Classes admins can see your name and score.' apps/web/src/constants/content.constants.ts`
→ `1`; and the built page: `grep -c 'AJ Classes admins can see your name and score' apps/web/build/client/privacy/index.html`
→ `1` (S-5 build).

### 3.5 The taker (Sitting 4)

**BT-1 — the start page with a pass mark.** ACs 11, 12. user@ opens `bnew` from the list (card `Not started`,
`Start`). Expected on the intro: lines exactly `2 questions`, `Total 5 marks`, `Pass mark: 60%`; the instructions
`Fixture instructions for bnew.`; button `Start`; the page text contains no `of 5 marks`, `Not yet`,
`Your result` or `Correct answer`, no element whose whole text is `Pass`, and its only `%` is in `Pass mark: 60%`.

**BT-2 — the start page with no pass mark, and a total of 1.** ACs 8, 11. user@ on `bnew2`: lines `2 questions`,
`Total 2 marks`, and **no** `Pass mark` text. parent@ on `b1` (not started): `1 question`, `Total 1 mark`,
`Pass mark: 50%`.

**BT-3 — marks on each question before submit.** ACs 10, 12, SC13. First user@'s list: the `bs` card (in progress)
shows the chip `In progress` and the button `Continue`, and no `of 5 marks`, `%`, `Pass` or `Not yet` text (AC 12 on
a list card). Then on `bnew`: `Start`. Expected: heading
`Question 1 of 2` with the line `3 marks` under it; `Next` → `Question 2 of 2`, `2 marks`; no `%`, `Pass`, `Not yet`
or `Correct answer` on the page; the `rpc/mock_test_open` response (in progress) has no `correct_option`,
`explanation` or `marks_earned` key in any question, and `percentage` and `passed` are `null`.

**BT-4 — submit: score, percentage and Pass, the same in the list and on the result.** ACs 13, 15, 16, 19, 21,
22. Continue BT-3: `Previous`, choose B on question 1 (`Saved`), leave question 2, `Submit` → dialog
`Submit this mock test?` with
`1 question isn’t answered yet and will count as incorrect. You can’t change your answers after this.` →
`Submit`. Expected: `Your result` with exactly `3 of 5 marks (60%)` and a chip `Pass` beside it; under question 1
`3 of 3 marks`, `Your answer: B. B1`, `Correct answer: B. B1`, `Explanation: Because B1.`; under question 2
`0 of 2 marks`, `Your answer: No answer.`, `Correct answer: B. B2`, no explanation line. Back to the list: the card
`Submitted`, `3 of 5 marks (60%)`, chip `Pass`, `View result`. The Pass chip is neutral (AC 16): its element has
class `MuiChip-outlined` and none of `MuiChip-colorSuccess`, `-colorError`, `-colorWarning`, `-colorPrimary`,
`-colorSecondary`, `-colorInfo` (record its computed `color` and `border-color` for V-3). Database: `attempts_of $BNEW` →
`user@local.test|true|3|5`.

**BT-5 — Not yet.** ACs 18, 19, 21. user@ on `b59` (submitted 59 of 100): card `59 of 100 marks (59%)` and chip
`Not yet`; result page the same, question 1 `59 of 59 marks`, question 2 `0 of 41 marks`. parent@ on `bs`: card and
result `2 of 5 marks (40%)`, `Not yet`; question 1 `0 of 3 marks` with `Your answer: No answer.`, question 2
`2 of 2 marks`.

**BT-6 — no pass mark: percentage, no label.** AC 20. parent@ on `bnp`: card and result exactly
`1 of 2 marks (50%)` and no chip with text `Pass` or `Not yet` (`getByText(/^(Pass|Not yet)$/)` → 0); per question
`1 of 1 mark`, `0 of 1 mark`.

**BT-7 — a total of 1 reads "mark".** AC 15, L-12 #2. student@ on `b1`: `1 of 1 mark (100%)`, `Pass`, question
`1 of 1 mark`. user@ on `b1`: `0 of 1 mark (0%)`, `Not yet`, question `0 of 1 mark`. No text `1 marks` on either.

**BT-8 — a closed test, for its submitter.** AC 25. student@: the `bcl` card has chips `Submitted` and `Closed`,
`5 of 5 marks (100%)`, `Pass`, the tag line `Subject: English` `Stream: VCE Tutoring` `Year level: Years 11, 12`,
and an outlined `View result`; the result: `5 of 5 marks (100%)`, `Pass`, question 1 `3 of 3 marks` with
`Correct answer: B. B1` and `Explanation: Because B1.`, question 2 `2 of 2 marks`; no `Start`, `Continue` or `Submit`.

**BT-9 — a closed test, for everyone else.** AC 26. parent@ (in progress on `bcl`) and user@ (never started): `bcl`
is not on their list; its direct link `/portal/<area>/mock-tests/<BCL>` shows `Not found` and
`This page doesn't exist, or you don't have access to it.`; `rpc/mock_test_open` → `404`.

**BT-10 — a legacy-shaped attempt.** ACs 31, 42, 45. student@ on `bleg`: card `1 of 2 marks (50%)`, no Pass or Not
yet chip; result `1 of 2 marks (50%)`, question 1 `1 of 1 mark`, question 2 `0 of 1 mark`.

**BT-11 — a parent sees only their own result.** AC 38. parent@'s list and `bs` result show `2 of 5 marks (40%)`;
the page text never contains `3 of 5 marks` or `60%` (student@'s result) on the list, the `bs` result or the `bnp`
result; the `rpc/mock_tests_for_me` response's `bs` row has `score` 2.

### 3.6 Keyboard (Sitting 4)

**BK-1 — the new admin fields by keyboard.** AC 48. On `bdr1`: Tab to `Add question`, Enter; Tab through the dialog
to `Marks` (focus visible, the field's label `Marks`), type `4`, Tab on to `Explanation (optional)` and
`Save question`, Enter → `4 marks` on the new card, focus back on the page (not `body`). `New mock test` by Enter →
Tab reaches `Pass mark (%, optional)` after `Instructions (optional)`; press the keys `5` then `0`, and the field
reads `50`; Escape closes the dialog with
focus on `New mock test`. Delete the added question afterwards (`marks_of $BDR1` → `1,3`).

**BK-2 — Results by keyboard.** ACs 28, 48. On the list, Tab reaches each row's `Results` link (accessible name
`Results for …`), Enter opens the page; first Tab stop inside `main` is `← Back to mock test`; no other stop in
`main`; on the edit page `Results` is the first header button and opens by Enter or Space. Focus is visible on
every stop (outline or ring with non-zero width).

**BK-3 — names and roles.** ACs 29, 48. On BA-2's page: `getByRole('table', { name: 'Mock test results' })`
resolves; `getAllByRole('columnheader')` names `Name, Submitted, Score, Percentage, Result`; each body row has 5
`cell`s; `getByRole('spinbutton', { name: 'Marks' })` in the question dialog and
`getByRole('spinbutton', { name: 'Pass mark (%, optional)' })` in the test dialog resolve once each.

### 3.7 Widths and appearance (Sitting 4)

For each page or dialog, at 375×800 and 1280×800, light and dark (Playwright `colorScheme`, and the header toggle
`Switch to dark mode` once to confirm it agrees), record:
`document.documentElement.scrollWidth - document.documentElement.clientWidth` → `0`;
`document.documentElement.getAttribute('data-portal-theme')` → `light` / `dark`;
`getComputedStyle(document.body).backgroundColor` → `rgb(255, 255, 255)` light / `rgb(11, 18, 32)` dark; console
errors `0`. Screenshot each (`run-*/shots/<row>-<page>-<width>-<theme>.png`).

**BR-1 — admin pages and dialogs.** AC 49. Six: 1. the list (Results column); 2. `bdr`'s edit page (Scoring card);
3. New question dialog on `bdr1` with BM-2's Marks error showing; 4. New mock test dialog with BP-2's pass-mark error
showing; 5. `bs`'s Results page; 6. `bdr`'s empty Results page. 6 × 2 × 2 = 24 measurements, all `0`; a table may
scroll inside its own `TableContainer` (record `scrollWidth > clientWidth` of the container at 375).

**BR-2 — taker pages.** AC 49. user@ and student@: 1. `bnew2`'s intro (no pass mark) and `b1`'s intro as parent@
(pass mark) count as one page each; 2. a question page (`bs`, user@ in progress: `3 marks` line); 3. `bs`'s result as
student@ (Pass chip, per-question marks); 4. the list as student@ (chips `Pass`, `Closed`). 5 pages × 2 × 2 = 20,
all `0`.

**BR-3 — the result line wraps, it doesn't overflow.** AC 49. At 375, light and dark: on `b59`'s result (user@) and
card, the score text and the chip either share a line or the chip wraps below (`flex-wrap: wrap`); neither element's
right edge exceeds the viewport width (`getBoundingClientRect().right <= 375`).

### 3.8 Lead's visual rows (from the Tester's BR screenshots)

- **V-1** — the Marks field and the pass-mark field in their dialogs, with and without the error; the Scoring card
  and the marks beside each question card: consistent with the other portal dialogs and cards, readable at 375 and
  1280, light and dark. ACs 2, 4, 7, 49.
- **V-2** — the Results page: rows (BR-1 page 5), empty state (page 6), Closed and pass-mark meta (`bcl`'s Results,
  screenshot in BA-4 at 375 and 1280, light and dark), and the "Showing 1000 of 1003" note (BA-7's page, screenshot
  at 375 and 1280, light and dark, taken before its clean-up): plain, private-looking, nothing that invites an edit. ACs 29, 34, 35, 49.
- **V-3** — the taker's result and list cards with `Pass` / `Not yet` and the per-question marks: neutral (no grade
  colour, nothing certificate-like), the percentage not presented as more exact than it is. ACs 16, 22, R-S5, R-S6.
- **V-4** — the start page totals and the marks line on the question page: calm, secondary text, not mistaken for a
  score. ACs 10, 11, 12.

---

## 4. Regression (Sitting 4, tester-ui unless stated)

The key flows of the mock tests, closing and categories gates, as a smaller set, plus the main portal flows. Each
expected value below was checked against the earlier gate's frozen row for the same behaviour (closing plan R-1 to
R-13 and its §11; v1 BM-7), with the scoring wording where it changed.

**R-1 — nav and the way in.** Accounts tutor@, admin@, student@, parent@, user@. Expected (`PortalLayout.tsx`, as
closing R-1): student `My work, Timetable, Mock tests, Account`; parent `My children, Mock tests, Account`; user
`Latest news, Mock tests, Account`; tutor and admin with no `Mock tests` item; the link card (`Mock tests`,
`Practise for free with the mock tests we have released.`, `See mock tests`) on the three taker homes opens the
list; the admin dashboard shortcut `Mock tests` opens `/portal/admin/mock-tests`.

**R-2 — refused and signed out (admin list).** tutor@ and parent@ on `/portal/admin/mock-tests` →
`You don't have access to this page`, no `rpc/mock_tests_admin_list` request; signed out
`/portal/user/mock-tests/<BS>` → `/portal/login?next=%2Fportal%2Fuser%2Fmock-tests%2F<BS>`.

**R-3 — questions on a draft.** `R3=$(mk_test r3 '' draft)`. admin@ on `r3`: add a question (prompt
`What is 2 + 2?`, options `4`, `5`, correct A), add a second, move question 2 up, edit it, delete it. Expected:
`Questions` shows `1 of 100 questions` at the end; the gap is kept (closing gate §11.1, v1 BM-7):
`db "select string_agg(position::text, ',' order by position) from public.mock_test_questions where test_id='$R3'"`
→ `2`; the card reads `Question 1` and `1 mark`; Scoring `Total 1 mark`.

**R-4 — take, submit, result.** user@ on `R4=$(mk_test r4 '1,1' released '' 'maths|naplan|{}|true')`: card
`Not started`, `Start` → `Question 1 of 2`, `1 mark`, choose B → `Saved`; `Next`; leave question 2; `Submit` →
`1 question isn’t answered yet and will count as incorrect. You can’t change your answers after this.` → `Submit`
→ `Your result`, `1 of 2 marks (50%)` (was `1 of 2 correct` in the closing gate's R-4; L-4 wording), no Pass chip;
the list card `Submitted`, `View result`; the take page header shows `Subject: Maths` `Stream: NAPLAN`
`Year level: Any year`.

**R-5 — the answer key stays hidden until submit.** user@ on `R5=$(mk_test r5 '1,1' released)`, in progress: the
`rpc/mock_test_open` response has no `correct_option`, `explanation` or `marks_earned`; database side `dr-shapes.sh`
`ip qkeys|id,marks,options,position,prompt,selected_option` (the closing gate's `keys|id,options,position,prompt,selected_option`
plus `marks`, design §2.1).

**R-6 — take-back on an open test.** admin@ on `R6=$(mk_test r6 '1,1' released)` with student@ in progress
(`take student@local.test $R6 in_progress`): `Take back to draft` → `Back to draft.`; attempts (postgres) `0`. On
`bs` (submitted by two): refused with `Someone has already submitted this mock test, so it can’t go back to draft.`.

**R-7 — draft and unknown ids are not found.** student@ opens `/portal/student/mock-tests/<BDR>` (draft) and a
random uuid → `Not found` each, `rpc/mock_test_open` → `404`.

**R-8 — sign-in and reload for each role.** admin@, tutor@, student@, parent@, user@ land on their homes and a
reload keeps them; inactive@ is refused with `Email or password is incorrect.`; console `0`.

**R-9 — public pages carry no results.** AC 50. Every `sitemap.xml` URL at 375 and 1280: status 200, console 0, no
sideways scroll, one `h1`, one `meta[name="robots"]`, and `document.body.innerText` has none of `Pass mark`,
`Not yet`, `of 5 marks`, `Results:` (case-sensitive), and none of `mock test` (case-insensitive) **except on
`/privacy`**, whose one mention is the S-2 sentence (PR-1): there,
`innerText.toLowerCase().split('mock test').length - 1` → `1`. Static (S-5 build, dry-run matched):
`grep -rlis 'mock test' --include='*.html' apps/web/build/client` → only `apps/web/build/client/privacy/index.html`;
`grep -rlE 'Pass mark|Not yet|Results: |of [0-9]+ marks' --include='*.html' apps/web/build/client` → no lines;
`grep -c mock apps/web/build/client/sitemap.xml` → `0`;
`git diff --name-only develop...HEAD -- apps/web/src/routes apps/web/src/sections apps/web/public` → exactly the
eleven `apps/web/src/routes/portal/` files (`admin-mock-test-results.tsx` and `.test.tsx`, `admin-mock-test.tsx` and
`.test.tsx`, `admin-mock-tests.tsx` and `.test.tsx`, `mock-test.tsx` and `.test.tsx`, `mock-tests-load-error.test.tsx`,
`mock-tests.tsx` and `.test.tsx`) plus `apps/web/src/routes/privacy.test.tsx`;
`git grep -nE "MOCK_SCORING|MOCK_RESULTS_PAGE|MOCK_PASS_LABELS|MockResultsTable|MockPassChip|mock_test_results" -- apps/web/src supabase/functions | grep -vE "apps/web/src/(routes/portal|components/portal|constants|lib/mock-test|services)"`
→ no lines. No e-mail template mentions scores: `git diff --name-only develop...HEAD -- supabase/functions supabase/templates`
→ empty.

**R-10 — mobile and roles untouched.** Static: `git -C ~/dev/work/aj_classes_mobile log -1 --format=%H` →
`bf14460174abb00978b3ec1631d0c23204235807` and `git -C ~/dev/work/aj_classes_mobile status --short` unchanged from
the start of the run; `git diff develop...HEAD -- supabase/migrations | grep -c 'app_role'` → `0`.

**R-11 — students' and parents' other pages.** student@ home shows `My work` with the seed's work
(`Fractions quick quiz`, `Word problems set 1`, `Number patterns check`) and the mock tests link card; parent@ home
lists Aarav and Noah; console `0`.

**R-12 — Delete draft.** admin@ on `R12=$(mk_test r12 '2,3' draft 60)`: `Delete draft` → confirm
`Delete this draft?` with `“t8-<RUN>-r12” and its questions will be removed.` → `Delete draft`. Expected: back on
`/portal/admin/mock-tests`, the title gone; `db "select count(*) from public.mock_tests where id='$R12'"` → `0`; its
questions `0`. A released test (`bs`) has no `Delete draft` button.

**R-13 — an in-progress answer survives a reload.** user@ on `R13=$(mk_test r13 '1,1' released)`: `Start`, choose B on
question 1 (`Saved`), reload. Expected: `In progress`; question 1 shows B selected; `Answered 1 of 2`; database
(postgres) one answer with `selected_option` `1`.

**R-14 — the taker filters still work.** Categories ACs 20, 22. Pre-check:
`as_user student@local.test aal1 "select count(*) from public.mock_tests_for_me() where title like 't8-%'"` → `12`
(dry-run `dr-r14.sh`). student@'s list on All shows exactly 12 t8 cards: `b1`, `b59`, `bcl`, `bleg`, `bnew`,
`bnew2`, `bnp`, `bp1b` (released in BP-4), `bs`, `r13`, `r4`, `r5` (r3 and r6 are drafts, r12 is deleted, r15 is
not built yet); Subject `English` → only `bcl`; Stream `VCE Tutoring` → only `bcl`; Subject `Writing` →
`No mock tests match these filters.` and `Clear filters`; `Clear filters` → all back, focus on the h1 `Mock tests`.

**R-15 — Close now and reopen still work, scores untouched.** Closing ACs 3, 4, 5.1. Fixture
`R15=$(mk_test r15 '3,2' released 60); take user@local.test $R15 submitted '1,0'`. admin@ on `r15`: `Close now` →
confirm text exactly
`People who haven’t submitted it won’t see it any more, and anyone part-way through can’t finish. People who submitted it still see their result. You can open it again with Set closing date.`
→ `Close now` → `Closed. Only people who submitted it can still see their result.`; user@ still sees the card with
`3 of 5 marks (60%)`, `Pass`, `Closed`. `Set closing date` → `Clear closing date` → `Save` →
`Closing date cleared. It never closes.`; `attempts_of $R15` → `user@local.test|true|3|5` before and after.

**R-16 — Edit tags on a released test with a pass mark.** Categories AC 15, AC 9. On `bs`: `Edit tags` → Subject
`English`, `Save` → `Tags saved.`; Scoring still `Pass mark: 60%`; `state_of $BS` → `released|60|null|false`;
`results_of $BS` unchanged from BA-2 (`Local Parent|2|5|40|false|2 Aarav Demo|3|5|60|true|2`).

**CL-1 — clean-up (end of every writing sitting).** Owner: that sitting's tester. `rm_t8` → `0`;
`db "select count(*) from public.mock_tests"` → `0`; `db "select count(*) from public.mock_test_attempts"` → `0`;
`db "select count(*) from public.profiles"` → `7`; S-0 re-run → identical to the start; no `*.hdr`, `*.tokstatus` or `last.hdrs` other
than `anon.hdr` in `$S` (then delete `anon.hdr` at the end of the run); nothing listening on 5173 (stopped by PID).

---

## 5. Not covered here (outside the pass/fail set)

The TSR words these as "partly verified" or "not run", never a plain PASS:

- **NC-1 — Saurabh checks staging** after the merge to `develop`.
- **NC-2 — the hosted migration** `20261121100000` (S-1: the team lead applies it after the gate, before the merge).
  No row here touches hosted. S-10 pins only the repository side.
- **NC-3 — production web deploy** from `main`: Saurabh's (S-2 is his sign-off on the privacy sentence).
- **NC-4 — other browsers and screen readers.** Installed Chrome only; names and roles are measured (BK-3), spoken
  output is not.
- **NC-5 — mobile app** (D-S9): out of v1; R-10 proves nothing changed.
- **NC-6 — the deferred items** D-S1 to D-S11 are not built and not tested.
- **NC-7 — the decimal limit** (L-12 #1): a decimal written straight to the database is rounded (MK-1 `3`, MK-2
  `61`). Frozen as the known limit, not tested as a refusal.
- **NC-8 — the race for a pass mark written by the table owner** (postgres) is covered only by MK-3's sequential
  refusal; the two-session rows use admin@ at aal2, the only real writer.

## 6. Pre-freeze findings for the lead (ruled: L-13)

Found while reading the code and dry-running at `bedbffe`. All five are ruled in `00-decisions.md` L-13; the ruling
follows each one.

- **F-1 — AC 4 "next to the question count" vs L-12 #3.** After fix batch 1 the total marks show only in the
  Scoring card (after Tags, before Instructions), and the question count stays in the Questions header further down.
  BM-4 freezes the as-built reading (total once, in the Scoring card). **L-13:** AC 4 is read as "the total marks
show on the admin edit view", once, in the Scoring card; frozen as built.
- **F-2 — a tab-only profile name is not treated as blank (AC 30, design §2.2 case 11 "whitespace-only counts as
  blank").** `mock_test_results` uses `btrim(p.full_name)`, which trims spaces only. Planning probe
  (`ws-probe.sh`, rolled back): a student whose profile name is `E'\t '` gets `taker_name` = a tab, so the Name cell
  would look empty instead of showing the roster name. Spaces-only names work (RS-3, BA-6). No UI path I know of
  stores a tab-only name (the forms trim), so the risk is low. Not frozen. **L-13:** accepted (very low risk), deferred; recorded as a
  deviation in 03 §2.2 case 11 and as a known limit in ADR-0012 Amendment 3 point 9.
- **F-3 — a pass-mark field Chrome can't parse saves as "no pass mark".** In a `type="number"` input, text such as
  `1e`, `-` or `e` gives `value === ''` (HTML number sanitising), and `validatePassMarkText('')` accepts a blank, so
  `Save` stores null with `Details saved.` while the field still shows the typed text. The Marks field refuses the
  same input (blank → NaN). Not frozen (BP-2 uses only values Chrome keeps: `0`, `-1`, `60.5`, `101`, `1e2`).
  **L-13:** accepted as a known limit (the field refuses everything else, and the admin sees "No pass mark" on save).
- **F-4 — R-9 and the privacy sentence.** Since `bedbffe`, `/privacy` says "mock test" once. The closing gate's R-9
  forbade `mock test` on every public page; this plan's R-9 exempts `/privacy` and counts that one mention (PR-1 pins
  the sentence). **L-13:** accepted (`/privacy` mentions mock tests by design, S-2).
- **F-5 — the "showing 1000 of N" method.** H-5 and BA-7 use a real 1003-account fixture (PostgREST's `max_rows`
  1000 is the cut), not a stubbed response, so the true cut, the order (oldest cut) and `total_rows` are all
  observed. It changes shared seed state only within the row and is removed by cascade. **L-13:** accepted.
- **F-6 — stale comment, not user-facing.** The comment above `MOCK_CLOSING` said "Closed means hidden from every
  taker, results included" (contradicts closing S-1). Fixed in `031e552` (review-6a #12); no row.
- No other contradiction with the ACs was found. The four replaced functions, the freeze, the helpers, the role gate
  and the web wording match 01, 03 and L-12 (dry-runs in §2, Appendix B).

## 7. Traceability (AC → rows)

| AC | Rows |
|---|---|
| 1 | MK-1, GR-2, BM-1, BM-3, S-4 |
| 2 | MK-1, BM-2, S-4 |
| 3 | MK-3, AZ-3, TS-4, TS-5, BM-5 |
| 4 | BM-1, BM-3, BM-4 |
| 5 | MK-5, BP-4 |
| 6 | MK-2, BP-1, BP-3, S-8 |
| 7 | MK-2, BP-2, S-4 |
| 8 | MK-5, BP-4, BT-2 |
| 9 | MK-3, MK-4, AZ-3, TS-1, TS-2, TS-3, TS-6, H-4, BP-5, BM-5, R-16 |
| 10 | SH-2, BT-3 |
| 11 | SH-1, BT-1, BT-2 |
| 12 | SH-1, SH-2, BT-1, BT-3 |
| 13 | SC-2, TS-5, BT-4 |
| 14 | SC-1, SC-3, SC-4 |
| 15 | SC-2, SC-4, SH-3, H-3, BT-4, BT-7, S-8 |
| 16 | BT-4, V-3 |
| 17 | MK-5, SC-3 |
| 18 | SC-1, SC-3, BT-5 |
| 19 | SH-3, H-3, BT-4, BT-5 |
| 20 | SH-3, BT-6, BA-5 |
| 21 | SC-1, SC-3, BT-4, BT-5 |
| 22 | SH-3, SU-1, H-3, BT-4, BT-5 |
| 23 | SU-1, LG-1 |
| 24 | SC-2, H-3 |
| 25 | CS-1, BT-8 |
| 26 | CS-2, CS-3, BT-9 |
| 27 | CS-1 |
| 28 | RS-1, BA-1, BA-3, BA-10, BK-2, S-8 |
| 29 | GR-1, RS-1, H-2, BA-2, BK-3 |
| 30 | RS-3, BA-6 |
| 31 | SU-1, LG-1, BA-5, BT-10 |
| 32 | CS-4, RS-2, BA-4 |
| 33 | CS-4, RS-1 |
| 34 | RS-1, RS-2, BA-2, BA-3 |
| 35 | GR-1, GR-3, RS-1, H-2, BA-2 |
| 36 | AZ-1, H-1, H-2, BA-9 |
| 37 | AZ-1, H-1, BA-9 |
| 38 | AZ-2, PV-1, H-4, BT-11 |
| 39 | RS-1, BA-1 |
| 40 | LG-1, S-10 |
| 41 | LG-1, S-10, S-4 |
| 42 | LG-1, BT-10 |
| 43 | SU-2 |
| 44 | LG-1 |
| 45 | LG-1, BA-5, BT-10 |
| 46 | BA-8, S-4 |
| 47 | S-1, S-2, S-4 |
| 48 | BK-1, BK-2, BK-3, BA-2 |
| 49 | BR-1, BR-2, BR-3, V-1, V-2 |
| 50 | R-9, S-4, PR-1 |
| Release gate (S-2) | PR-1 |

Every AC 1 to 50 has at least one row. The brief's named cases: legacy (LG-1, SU-1, BT-10); the role matrix (AZ-1,
H-1, BA-9: aal1 admin, tutor, parent, student, user, inactive admin, anon); the freeze (MK-3, MK-4); the race
(TS-1 to TS-6, both orders for release and for marks, the submit mirror, take-back); boundaries (SC-1, SC-3, SC-4,
SH-1, SH-2: floor, exact Pass, 100×100, strict nulls); "showing 1000 of N" (H-5, BA-7); closed tests (CS-1 to CS-4,
BT-8, BT-9, BA-4); plurals (SC-4, BT-7, BA-5, BM-4).

## 8. Who runs what

- **tester-api:** LG-1, S-1 to S-10, GR-1 to GR-3, MK-1 to MK-5, SC-1 to SC-4, SH-1 to SH-3, SU-1, SU-2, CS-1 to CS-4,
  RS-1 to RS-3, AZ-1 to AZ-3, PV-1, PV-2, TS-1 to TS-6, H-1 to H-5, CL-1 (Sittings 1 and 2).
- **tester-ui:** BM-1 to BM-5, BP-1 to BP-5, BE-1 to BE-3, BA-1 to BA-10, PR-1, BT-1 to BT-11, BK-1 to BK-3, BR-1 to
  BR-3, R-1 to R-16, CL-1 (Sittings 3 and 4), and the screenshots for V-1 to V-4.
- **Lead:** V-1 to V-4 (verdict), and rulings on §6.

## 9. State left by planning

Every dry-run rolled back. The planning runs that commit (LG-1, TS-1 to TS-6, H-1 to H-5, S-6 to S-9) were cleaned
up (`rm_t8` → `0`, token and key files deleted, `status.json` included), and the local database was then reset with
`pnpm db:reset` and left at the seed state with `20261121100000` applied (S-0 matched). Nothing listens on 4173 or
5173. Review-6a round 1 changes: R-14 (12 cards, pre-check, `dr-r14.sh`), the Sitting 2 order, S-1, BP-1, BK-1, the
superseded-rows list, L-13 in the header and §6, `tok` from a 0600 file (H rows re-run for real), V-2, BT-3, LG-1's
note; the plan re-pinned to `031e552`. Row count unchanged.

## 10. Counts

| Area | Rows |
|---|---|
| Suites (S) | 10 |
| Legacy before and after (LG) | 1 |
| Catalogue (GR) | 3 |
| Marks and pass mark, database (MK) | 5 |
| Score, percentage, Pass (SC) | 4 |
| Taker shapes (SH) | 3 |
| Per-question sums and no recalculation (SU) | 2 |
| Closed tests, database (CS) | 4 |
| Results function (RS) | 3 |
| Authorisation (AZ) | 3 |
| Taker privacy and gate (PV) | 2 |
| Two-session (TS) | 6 |
| Through PostgREST (H) | 5 |
| Browser: marks (BM) | 5 |
| Browser: pass mark (BP) | 5 |
| Browser: edit page states (BE) | 3 |
| Browser: Results view (BA) | 10 |
| Browser: privacy sentence (PR) | 1 |
| Browser: taker (BT) | 11 |
| Browser: keyboard (BK) | 3 |
| Browser: widths and appearance (BR) | 3 |
| Lead visual (V) | 4 |
| Regression (R) | 16 |
| Clean-up (CL) | 1 |
| **Total** | **113** |

By sitting: Sitting 1 = 36 (LG-1, S-1 to S-5, S-10, GR 3, MK 5, SC 4, SH 3, SU 2, CS 4, RS 3, AZ 3, PV 2), Sitting 2 =
15 (TS 6, H 5, S-6 to S-9), Sitting 3 = 24 (BM 5, BP 5, BE 3, BA 10, PR 1), Sitting 4 = 33 (BT 11, BK 3, BR 3,
R 16), lead 4, CL-1 once (it runs at the end of each writing sitting, one row): 36 + 15 + 24 + 33 + 4 + 1 = 113. S-0
is a start-state gate, not a row. NC-1 to NC-8 sit outside the pass/fail set.

---

## Appendix A. Scripts (write each to `$S` exactly as here)

`ts-real.sh` and `h-real.sh` are the planning runs of §2.9 and §2.10 in one file each (they commit and clean up); the run may use them or type the rows. `ws-probe.sh` is the planning probe for F-2, not a row.

### `t8.sh`

```sh
# t8.sh, mock test scoring gate (06-test-plan.md §0.2). Source it: . "$S/t8.sh"
. "$S/run.env"
API=http://127.0.0.1:55321
CAPTCHA='XXXX.DUMMY.TOKEN.XXXX'
# Drops psql noise and the uuid echo of set_config lines; keeps ERROR and HINT lines.
CLEAN='^[{]"(sub|role)"|^(CONTEXT|LINE|PL/pgSQL|DETAIL)|^ +|^$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}([|][0-9a-f-]{36})*$'
db() { docker exec supabase_db_aj_classes psql -U postgres -At -q -v ON_ERROR_STOP=1 -c "$1"; }
pid() { db "select id from public.profiles where email='$1'"; }
claims() { echo "{\"sub\":\"$(pid "$1")\",\"role\":\"authenticated\",\"aal\":\"$2\"}"; }
# Read-only, as someone: $1 e-mail, $2 aal, $3 SQL
as_user() { docker exec supabase_db_aj_classes psql -U postgres -At -q -c "begin read only; select set_config('request.jwt.claims', '$(claims "$1" "$2")', true); set local role authenticated; $3; rollback;" 2>&1 | grep -vE "$CLEAN"; }
# Writes that commit (fixtures and taker journeys on t8 tests only): $1 e-mail, $2 aal, $3 SQL
# $4 (optional) runs as postgres first, inside the same transaction.
as_w() { docker exec supabase_db_aj_classes psql -U postgres -At -q -c "begin; $4 select set_config('request.jwt.claims', '$(claims "$1" "$2")', true); set local role authenticated; $3; commit;" 2>&1 | grep -vE "$CLEAN"; }
# SQL for a t8 mock test, no transaction of its own (run as postgres).
#   $1 id, $2 label, $3 marks: '' (no questions), a list '3,2,5' (one question per item, in order),
#      or 'NxM' (N questions of M marks), $4 draft|released, $5 pass mark ('' = none),
#   $6 tags 'subject|stream|years|any_year' (default 'maths|naplan|{}|true'; the release trigger needs them).
# Question g: prompt 'Q<g> of <label>?', options A<g>,B<g>,C<g>, correct option 1 (B),
# explanation 'Because B<g>.' on odd g, '' on even. Released by a direct update after the questions
# (the question trigger refuses a released test).
mk_sql() {
  tg="$6"; [ -z "$tg" ] && tg='maths|naplan|{}|true'
  su=$(echo "$tg" | cut -d'|' -f1); st=$(echo "$tg" | cut -d'|' -f2); yl=$(echo "$tg" | cut -d'|' -f3); ay=$(echo "$tg" | cut -d'|' -f4)
  pm="${5:-null}"
  echo "insert into public.mock_tests (id, title, instructions, created_by, subject, stream, year_levels, any_year, pass_mark) values ('$1', 't8-$RUN-$2', 'Fixture instructions for $2.', (select id from public.profiles where email='admin@local.test'), '$su', '$st', '$yl', $ay, $pm);"
  case "$3" in
    '') ;;
    *x*) n=${3%x*}; m=${3#*x}; echo "insert into public.mock_test_questions (test_id, prompt, options, correct_option, explanation, marks) select '$1', 'Q'||g||' of $2?', array['A'||g,'B'||g,'C'||g], 1, case when g % 2 = 1 then 'Because B'||g||'.' else '' end, $m from generate_series(1,$n) g;" ;;
    *) echo "insert into public.mock_test_questions (test_id, prompt, options, correct_option, explanation, marks) select '$1', 'Q'||g||' of $2?', array['A'||g,'B'||g,'C'||g], 1, case when g % 2 = 1 then 'Because B'||g||'.' else '' end, m from unnest(array[$3]::smallint[]) with ordinality as u(m, g) order by g;" ;;
  esac
  [ "$4" = released ] && echo "update public.mock_tests set status='released', released_at=now(), released_by=created_by where id='$1';"
  qset "$1"; true; }
# qset <test id>: as postgres, keep each question id in a setting t8.q<hex>_<position> for the rest of
# the session, because a taker can't read questions (RLS). ans_sql reads them back.
qset() { echo "select set_config('t8.q'||replace('$1','-','')||'_'||position, id::text, false) from public.mock_test_questions where test_id='$1';"; }
# Commits a t8 mock test (same arguments as mk_sql without the id). Prints its id.
mk_test() { id=$(db "select gen_random_uuid()"); db "begin; $(mk_sql "$id" "$@") commit;" > /dev/null && echo "$id"; }
qids() { db "select id from public.mock_test_questions where test_id='$1' order by position" | paste -sd' ' -; }
state_of() { db "select status||'|'||coalesce(pass_mark::text,'null')||'|'||coalesce(closes_at::text,'null')||'|'||(closes_at is not null and closes_at <= clock_timestamp()) from public.mock_tests where id='$1'"; }
marks_of() { db "select coalesce(string_agg(marks::text, ',' order by position), '') from public.mock_test_questions where test_id='$1'"; }
# Every attempt of a test as postgres: e-mail|submitted|score|total, by e-mail
attempts_of() { db "select coalesce(string_agg(p.email||'|'||(a.submitted_at is not null)||'|'||coalesce(a.score::text,'null')||'|'||coalesce(a.total::text,'null'), ' ' order by p.email), '') from public.mock_test_attempts a join public.profiles p on p.id=a.profile_id where a.test_id='$1'"; }
# The admin Results rows as admin@ at aal2: name|score|total|percentage|passed|total_rows, newest first
results_of() { as_user admin@local.test aal2 "select coalesce(string_agg(coalesce(taker_name,'null')||'|'||score||'|'||total||'|'||percentage||'|'||coalesce(passed::text,'null')||'|'||total_rows, ' ' order by submitted_at desc, attempt_id), '') from public.mock_test_results('$1')"; }
# Removes every t8 mock test with its attempts and answers (released ones go back to draft first),
# then the bulk accounts of BA-7 (auth.users cascades to profiles and their attempts).
rm_t8() {
  db "delete from public.mock_test_attempts where test_id in (select id from public.mock_tests where title like 't8-%')"
  db "update public.mock_tests set status='draft', released_at=null, released_by=null, closes_at=null where title like 't8-%' and status='released'"
  db "delete from public.mock_tests where title like 't8-%'"
  db "delete from auth.users where email like 't8-bulk-%@local.test'"
  db "select count(*) from public.mock_tests where title like 't8-%'"; }
# Real tokens for PostgREST (password grant gives aal1). The request body goes in a 0600 file and the token to a
# 0600 header file, never on a command line; the body file is deleted straight after.
tok() { umask 077; printf '{"email":"%s","password":"local-password-123","gotrue_meta_security":{"captcha_token":"%s"}}' "$1" "$CAPTCHA" > "$S/tok-body.json"; curl -s -X POST -H @"$S/anon.hdr" -H 'Content-Type: application/json' -d @"$S/tok-body.json" "$API/auth/v1/token?grant_type=password" > "$S/tok-reply.json"; rm -f "$S/tok-body.json"; python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); print("Authorization: Bearer "+d.get("access_token",""))' "$S/tok-reply.json" > "$S/$1.hdr"; python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("error_code") or "ok", d.get("code") or "")' "$S/tok-reply.json" > "$S/$1.tokstatus"; rm -f "$S/tok-reply.json"; }
# admin@ at aal2: password grant, then the TOTP challenge with the local-only key read in-process
# from apps/web/.env.development.local. Writes $S/admin2.hdr (0600). Prints the token's aal only.
tok2() { python3 -I "$S/aal2tok.py" "$S" "$API" "$CAPTCHA"; }
# $1 METHOD, $2 header name (e-mail, 'admin2' or 'anon'), $3 path under /rest/v1/, $4 JSON body (optional).
# Prints "<status> <body>"; the response headers go to $S/last.hdrs.
rest() { h="$S/$2.hdr"; [ "$2" = anon ] && h=/dev/null; curl -s -D "$S/last.hdrs" -o "$S/last.json" -w '%{http_code}' -X "$1" -H @"$S/anon.hdr" -H @"$h" -H 'Content-Type: application/json' ${4:+-d "$4"} "$API/rest/v1/$3"; echo " $(head -c 400 "$S/last.json")"; }
# Two sessions at once. $1 label, $2 e-mail or 'postgres', $3 aal, $4 SQL. Writes $S/cc-<label>.txt with output and elapsed seconds.
cc() { ( t0=$(python3 -I -c 'import time;print(time.time())'); if [ "$2" = postgres ]; then pre="begin;"; else pre="begin; select set_config('request.jwt.claims', '$(claims "$2" "$3")', true); set local role authenticated;"; fi; out=$(docker exec supabase_db_aj_classes psql -U postgres -At -q -c "$pre $4; commit;" 2>&1 | grep -vE "$CLEAN" | paste -sd';' -); t1=$(python3 -I -c 'import time;print(time.time())'); echo "$1|$out|elapsed=$(python3 -I -c "print(round($t1-$t0,1))")" > "$S/cc-$1.txt" ) & }
# No attempt on a draft (a submitted attempt pins the test released)
invariant() { db "select count(*) from public.mock_test_attempts a join public.mock_tests t on t.id=a.test_id where t.status='draft'"; }
# --- Rolled-back scenario rows (dry-runnable). TRY makes pg_temp.try(sql), which runs sql and returns
# 'ok' or '<sqlstate>:<message>[:<hint>]', so one transaction can check several refusals in turn.
TRY='create function pg_temp.try(q text) returns text language plpgsql as $f$ declare m text; h text; s text; begin execute q; return $o$ok$o$; exception when others then get stacked diagnostics m = message_text, h = pg_exception_hint, s = returned_sqlstate; return s||$o$:$o$||m||coalesce($o$:$o$||nullif(h,$o$$o$),$o$$o$); end $f$;'
# who <e-mail> <aal>: switch the rest of the transaction to that person (reset role; returns to postgres)
who() { echo "reset role; select set_config('request.jwt.claims', '$(claims "$1" "$2")', true); set local role authenticated;"; }
anon() { echo "reset role; select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true); set local role anon;"; }
# rb <SQL>: run SQL as postgres inside begin ... rollback, with pg_temp.try available
rb() { docker exec supabase_db_aj_classes psql -U postgres -At -q -v ON_ERROR_STOP=1 -c "begin; $TRY $1; rollback;" 2>&1 | grep -vE "$CLEAN"; }
# Taker journeys. ans_sql <test id> <answers> prints the saves: answers is a comma list by position,
# a digit = the option chosen (1 = B, the correct one), '-' = no answer. The question ids come from
# the qset settings (mk_sql writes them; take writes them for a committed test).
ans_sql() { h=$(echo "$1" | tr -d '-'); i=0; for a in $(echo "$2" | tr ',' ' '); do i=$((i+1)); [ "$a" = - ] || echo "select public.mock_save_answer('$1', current_setting('t8.q${h}_$i')::uuid, $a);"; done; true; }
# take_sql <test id> <submitted|in_progress> [answers, default '1']: start, answer, submit when asked.
take_sql() { echo "select public.mock_start('$1');"; ans_sql "$1" "${3:-1}"; [ "$2" = submitted ] && echo "select public.mock_submit('$1');"; true; }
# take <e-mail> <test id> <submitted|in_progress> [answers] (commits)
take() { as_w "$1" aal1 "$(take_sql "$2" "$3" "$4")" "$(qset "$2")"; }
# close_now <test id>: admin@ at aal2 presses Close now (commits)
close_now() { as_w admin@local.test aal2 "select public.mock_close_now('$1')"; }
```

### `aal2tok.py`

```python
# aal2tok.py <run folder> <api> <captcha>: an aal2 token for admin@local.test, written to
# <run folder>/admin2.hdr (0600). The local-only authenticator key is read in-process from
# apps/web/.env.development.local (VITE_LOCAL_ADMIN_TWO_STEP_KEY); nothing secret is printed.
import base64, hashlib, hmac, json, os, struct, sys, time, urllib.request

run, api, captcha = sys.argv[1], sys.argv[2], sys.argv[3]
apikey = open(os.path.join(run, 'anon.hdr')).read().split(':', 1)[1].strip()
env = '/Users/sjain/dev/work/aj_classes/apps/web/.env.development.local'
key = [l.split('=', 1)[1].strip().strip('"') for l in open(env) if l.startswith('VITE_LOCAL_ADMIN_TWO_STEP_KEY=')][0]


def call(path, body, token=None):
    headers = {'apikey': apikey, 'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(api + path, data=json.dumps(body).encode(), headers=headers, method='POST')
    return json.load(urllib.request.urlopen(req))


def totp(secret):
    raw = base64.b32decode(secret + '=' * (-len(secret) % 8))
    digest = hmac.new(raw, struct.pack('>Q', int(time.time()) // 30), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    return '%06d' % ((struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1000000)


first = call('/auth/v1/token?grant_type=password',
             {'email': 'admin@local.test', 'password': 'local-password-123',
              'gotrue_meta_security': {'captcha_token': captcha}})
token = first['access_token']
factor = [f for f in first['user'].get('factors', []) if f.get('status') == 'verified'][0]['id']
challenge = call('/auth/v1/factors/%s/challenge' % factor, {}, token)['id']
second = call('/auth/v1/factors/%s/verify' % factor, {'challenge_id': challenge, 'code': totp(key)}, token)
out = os.path.join(run, 'admin2.hdr')
fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
os.write(fd, ('Authorization: Bearer ' + second['access_token'] + '\n').encode())
os.close(fd)
payload = second['access_token'].split('.')[1]
print('admin2 aal=' + json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))['aal'])
```

### `gr.sql`

```sql
\echo '--- GR-1 functions'
select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')|'||case when p.prosecdef then 'definer' else 'invoker' end||'|'||p.provolatile::text||'|strict='||p.proisstrict||'|'||coalesce(array_to_string(p.proconfig, ','),'')||'|anon='||has_function_privilege('anon', p.oid, 'execute')||'|auth='||has_function_privilege('authenticated', p.oid, 'execute')||'|public='||coalesce((select bool_or(a.grantee = 0) from aclexplode(p.proacl) a where a.privilege_type='EXECUTE'), true) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('mock_submit','mock_tests_for_me','mock_test_open','mock_test_results','mock_percentage','mock_passed','check_mock_test','check_mock_question') order by 1;
\echo '--- GR-1 return shapes'
select 'for_me|'||pg_get_function_result('public.mock_tests_for_me()'::regprocedure);
select 'results|'||pg_get_function_result('public.mock_test_results(uuid)'::regprocedure);
\echo '--- GR-2 columns'
select table_name||'.'||column_name||'|'||data_type||'|'||is_nullable||'|'||coalesce(column_default,'null') from information_schema.columns where table_schema='public' and ((table_name='mock_test_questions' and column_name='marks') or (table_name='mock_tests' and column_name='pass_mark') or (table_name='mock_test_attempts' and column_name in ('score','total'))) order by 1;
select conrelid::regclass||'|'||conname||'|'||pg_get_constraintdef(oid) from pg_constraint where conname in ('mock_test_questions_marks_range','mock_tests_pass_mark_range') order by conname;
\echo '--- GR-2 triggers'
select tgrelid::regclass||'|'||tgname||'|'||tgenabled::text from pg_trigger where tgrelid in ('public.mock_tests'::regclass,'public.mock_test_questions'::regclass) and not tgisinternal order by tgrelid::regclass::text, tgname;
\echo '--- GR-3 grants'
select 'colgrants_tests|'||string_agg(privilege_type||':'||column_name, ' ' order by privilege_type, column_name) from information_schema.column_privileges where table_schema='public' and table_name='mock_tests' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE');
select 'colgrants_questions|'||string_agg(privilege_type||':'||column_name, ' ' order by privilege_type, column_name) from information_schema.column_privileges where table_schema='public' and table_name='mock_test_questions' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE');
select 'anon_cols|'||count(*) from information_schema.column_privileges where table_schema='public' and table_name in ('mock_tests','mock_test_questions') and grantee='anon';
select 'attempts_answers_grants|'||count(*) from information_schema.role_table_grants where table_schema='public' and table_name in ('mock_test_attempts','mock_test_answers') and grantee in ('anon','authenticated','PUBLIC');
select 'attempts_answers_policies|'||count(*) from pg_policies where schemaname='public' and tablename in ('mock_test_attempts','mock_test_answers');
select 'questions_policies|'||string_agg(policyname||':'||cmd||':'||array_to_string(roles, ','), ' ' order by policyname) from pg_policies where schemaname='public' and tablename='mock_test_questions';
\echo '--- GR-3 comments'
select 'comment_score|'||col_description('public.mock_test_attempts'::regclass, (select attnum from pg_attribute where attrelid='public.mock_test_attempts'::regclass and attname='score'));
```

### `lg.sh`

```sh
. "$S/t8.sh"
# LG-1: the real before-and-after of the scoring migration (AC 40 to 44). Resets the local DB to
# 20261120100000 (with the seed), writes pre-feature attempts, applies 20261121100000, compares.
cd /Users/sjain/dev/work/aj_classes
supabase db reset --version 20261120100000 > "$S/lg-reset.log" 2>&1; echo "reset exit=$?"
db "select version from supabase_migrations.schema_migrations order by 1 desc limit 1"
db "select count(*) from information_schema.columns where table_name='mock_test_questions' and column_name='marks'"
T=00000000-0000-4000-8000-0000000a7001
db "begin;
insert into public.mock_tests (id, title, created_by, subject, stream, any_year) values ('$T', 't8-$RUN-legacy', (select id from public.profiles where email='admin@local.test'), 'maths', 'naplan', true);
insert into public.mock_test_questions (test_id, prompt, options, correct_option) select '$T', 'Q'||g||' of legacy?', array['A'||g,'B'||g,'C'||g], 1 from generate_series(1,2) g;
update public.mock_tests set status='released', released_at=now(), released_by=created_by where id='$T';
commit;" > /dev/null
take student@local.test $T submitted '1,0'
take parent@local.test $T in_progress '1,1'
Q="select p.email||'|'||coalesce(a.score::text,'null')||'|'||coalesce(a.total::text,'null')||'|'||coalesce(a.submitted_at::text,'null')||'|'||a.id from public.mock_test_attempts a join public.profiles p on p.id=a.profile_id order by p.email"
db "$Q" > "$S/lg-before.txt"; sed 's/|[^|]*|[^|]*$//' "$S/lg-before.txt"
supabase migration up --local > "$S/lg-up.log" 2>&1; echo "up exit=$?"
db "select version from supabase_migrations.schema_migrations order by 1 desc limit 1"
db "$Q" > "$S/lg-after.txt"; cmp "$S/lg-before.txt" "$S/lg-after.txt"; echo "cmp exit=$?"
db "select count(*) filter (where marks = 1)||'|'||count(*) from public.mock_test_questions"
db "select coalesce(pass_mark::text,'null') from public.mock_tests where id='$T'"
as_user student@local.test aal1 "select 'list', status||'|'||score||'|'||total||'|'||percentage||'|'||coalesce(passed::text,'null') from public.mock_tests_for_me() where id='$T'"
as_user student@local.test aal1 "select 'earned', string_agg((q->>'marks_earned')||'/'||(q->>'marks'), ',' order by (q->>'position')::int) from jsonb_array_elements((public.mock_test_open('$T'))->'questions') q"
as_w parent@local.test aal1 "select 'parent submit', public.mock_submit('$T')"
as_user admin@local.test aal2 "select 'results', string_agg(coalesce(taker_name,'null')||'|'||score||'/'||total||'|'||percentage||'|'||coalesce(passed::text,'null'), ' ' order by taker_name) from public.mock_test_results('$T')"
```

### `dr-marks.sh`

```sh
. "$S/t8.sh"
X=00000000-0000-0000-0000-0000000a0001; Y=00000000-0000-0000-0000-0000000a0002; Z=00000000-0000-0000-0000-0000000a0003
qi() { echo "select '$1', pg_temp.try(\$\$insert into public.mock_test_questions (test_id, prompt, options, correct_option$2) values ('$X', 'M?', array['a','b'], 0$3)\$\$);"; }
echo '=== MK-1 marks on a draft, as admin@ aal2'
rb "$(mk_sql $X mk '' draft) $(who admin@local.test aal2)
$(qi nomarks '' '')
$(qi m1 ', marks' ', 1')
$(qi m100 ', marks' ', 100')
$(qi m0 ', marks' ', 0')
$(qi mneg ', marks' ', -1')
$(qi m101 ', marks' ', 101')
$(qi mnull ', marks' ', null')
$(qi mdec ', marks' ', 2.5')
reset role; select 'stored', string_agg(marks::text, ',' order by position) from public.mock_test_questions where test_id='$X';
$(who admin@local.test aal2)
select 'upd', pg_temp.try(\$\$update public.mock_test_questions set marks=7 where test_id='$X' and position=1\$\$);
select 'upd0', pg_temp.try(\$\$update public.mock_test_questions set marks=0 where test_id='$X' and position=1\$\$);
reset role; select 'after', string_agg(marks::text, ',' order by position) from public.mock_test_questions where test_id='$X';
"
pi() { echo "select '$1', pg_temp.try(\$\$insert into public.mock_tests (title, subject, stream, any_year, pass_mark) values ('t8-$RUN-pm-$1', 'maths', 'naplan', true, $2)\$\$);"; }
pu() { echo "select '$1', pg_temp.try(\$\$update public.mock_tests set pass_mark = $2 where id='$3'\$\$);"; }
echo '=== MK-2 pass mark on a draft, as admin@ aal2'
rb "$(mk_sql $X pd '1' draft) $(who admin@local.test aal2)
$(pi pnull null)
$(pi p1 1)
$(pi p100 100)
$(pi p0 0)
$(pi pneg -1)
$(pi p101 101)
$(pi pdec 60.5)
$(pu u60 60 $X)
$(pu u0 0 $X)
$(pu unull null $X)
$(pu u75 75 $X)
reset role; select 'made', string_agg(replace(title, 't8-$RUN-pm-', '')||':'||coalesce(pass_mark::text,'null'), ' ' order by title) from public.mock_tests where title like 't8-$RUN-pm-%';
select 'X', coalesce(pass_mark::text,'null') from public.mock_tests where id='$X';
"
echo '=== MK-3 freeze on a released test and on a closed test'
rb "$(mk_sql $X fr '3,2' released 60) $(mk_sql $Y frc '3,2' released) $(who admin@local.test aal2) select public.mock_close_now('$Y');
$(pu pchg 70 $X)
$(pu psame 60 $X)
$(pu pnull null $X)
select 'qmarks', pg_temp.try(\$\$update public.mock_test_questions set marks=9 where test_id='$X' and position=1\$\$);
select 'qsame', pg_temp.try(\$\$update public.mock_test_questions set marks=3 where test_id='$X' and position=1\$\$);
select 'qins', pg_temp.try(\$\$insert into public.mock_test_questions (test_id, prompt, options, correct_option, marks) values ('$X', 'Late?', array['a','b'], 0, 5)\$\$);
select 'qdel', pg_temp.try(\$\$delete from public.mock_test_questions where test_id='$X' and position=2\$\$);
$(pu cset 50 $Y)
select 'cqmarks', pg_temp.try(\$\$update public.mock_test_questions set marks=9 where test_id='$Y' and position=1\$\$);
select 'ctag', pg_temp.try(\$\$update public.mock_tests set subject='english' where id='$Y'\$\$);
reset role;
select 'owner', pg_temp.try(\$\$update public.mock_tests set pass_mark = 10 where id='$X'\$\$);
select 'ownerq', pg_temp.try(\$\$update public.mock_test_questions set marks=9 where test_id='$X' and position=1\$\$);
select 'X', status||'|'||coalesce(pass_mark::text,'null') from public.mock_tests where id='$X';
select 'Xmarks', string_agg(marks::text, ',' order by position) from public.mock_test_questions where test_id='$X';
select 'Y', status||'|'||coalesce(pass_mark::text,'null')||'|'||(closes_at <= clock_timestamp())||'|'||subject from public.mock_tests where id='$Y';
select 'Ymarks', string_agg(marks::text, ',' order by position) from public.mock_test_questions where test_id='$Y';
"
echo '=== MK-4 take-back makes both editable again and keeps the pass mark'
rb "$(mk_sql $X tb '3,2' released 60) $(who student@local.test aal1) select public.mock_start('$X');
$(who admin@local.test aal2)
select 'withdraw', pg_temp.try(\$\$select public.mock_withdraw('$X')\$\$);
reset role; select 'kept', status||'|'||coalesce(pass_mark::text,'null') from public.mock_tests where id='$X';
$(who admin@local.test aal2)
$(pu p80 80 $X)
select 'qm', pg_temp.try(\$\$update public.mock_test_questions set marks=4 where test_id='$X' and position=2\$\$);
reset role; select 'after', coalesce(pass_mark::text,'null')||'|'||(select string_agg(marks::text, ',' order by position) from public.mock_test_questions where test_id='$X') from public.mock_tests where id='$X';
"
echo '=== MK-5 release needs a question only; a pass mark is optional'
rb "$(mk_sql $X r0 '' draft 60) $(mk_sql $Y r1 '1' draft) $(mk_sql $Z r2 '100' draft 100) $(who admin@local.test aal2)
select 'zeroq', pg_temp.try(\$\$select public.mock_release('$X')\$\$);
select 'nopass', pg_temp.try(\$\$select public.mock_release('$Y')\$\$);
select 'withpass', pg_temp.try(\$\$select public.mock_release('$Z')\$\$);
reset role; select 'st', string_agg(replace(title, 't8-$RUN-', '')||':'||status||':'||coalesce(pass_mark::text,'null'), ' ' order by title) from public.mock_tests where id in ('$X','$Y','$Z');
"
```

### `dr-score.sh`

```sh
. "$S/t8.sh"
A=00000000-0000-0000-0000-0000000b0001; B=00000000-0000-0000-0000-0000000b0002; C=00000000-0000-0000-0000-0000000b0003
D=00000000-0000-0000-0000-0000000b0004; E=00000000-0000-0000-0000-0000000b0005; F=00000000-0000-0000-0000-0000000b0006
G=00000000-0000-0000-0000-0000000b0007; H=00000000-0000-0000-0000-0000000b0008
sub() { echo "$(who $1 aal1) $(take_sql $2 in_progress "$3") select '$4', public.mock_submit('$2');"; }
echo '=== SC-1 helpers (as postgres) and who may call them'
rb "select 'pct', string_agg(coalesce(private.mock_percentage(s, t)::text,'null'), ' ' order by o) from (values (1,2,3),(2,0,5),(3,5,5),(4,1,3),(5,59,100),(6,3,5),(7,10000,10000),(8,1,10000),(9,null,5),(10,3,null),(11,0,0)) v(o,s,t);
select 'pass', string_agg(coalesce(private.mock_passed(s, t, p)::text,'null'), ' ' order by o) from (values (1,3,5,60),(2,59,100,60),(3,2,3,67),(4,2,3,66),(5,400,400,90),(6,359,400,90),(7,360,400,90),(8,10000,10000,100),(9,9999,10000,100),(10,0,0,50),(11,1,1,null),(12,null,5,50),(13,0,5,1),(14,1,100,1)) v(o,s,t,p);
$(who student@local.test aal1)
select 'auth pct', pg_temp.try(\$\$select private.mock_percentage(1, 2)\$\$);
select 'auth pass', pg_temp.try(\$\$select private.mock_passed(1, 2, 50)\$\$);
$(anon) select 'anon pct', pg_temp.try(\$\$select private.mock_percentage(1, 2)\$\$);
"
echo '=== SC-2 the score is the sum of the marks answered correctly'
rb "$(mk_sql $A sum '3,2,5' released 60) $(mk_sql $B blank '3,2,5' released 60) $(mk_sql $C none '1,1' released)
$(sub student@local.test $A '1,0,1' 'q1+q3 right, q2 wrong')
select 'repeat', public.mock_submit('$A');
$(sub parent@local.test $A '-,1,-' 'only q2, two blanks')
$(sub user@local.test $B '-,-,-' 'nothing answered')
$(sub student@local.test $C '1,-' 'no pass mark')
reset role; select 'stored', string_agg(p.email||':'||a.score||'/'||a.total, ' ' order by p.email) from public.mock_test_attempts a join public.profiles p on p.id=a.profile_id where a.test_id in ('$A','$B','$C');
"
echo '=== SC-3 boundaries end to end'
rb "$(mk_sql $D b35 '1,1,1,1,1' released 60) $(mk_sql $E b59 '59,41' released 60) $(mk_sql $F b100 '100x100' released 100) $(mk_sql $G b400 '4x100' released 90) $(mk_sql $H b23 '1,1,1' released 67)
$(sub student@local.test $D '1,1,1,0,-' '3 of 5 at 60')
$(sub student@local.test $E '1,0' '59 of 100 at 60')
$(who student@local.test aal1) select public.mock_start('$F'); select 'saved', count(public.mock_save_answer('$F', current_setting('t8.q'||replace('$F','-','')||'_'||g)::uuid, 1)) from generate_series(1,100) g; select '100x100 all right', public.mock_submit('$F');
select public.mock_start('$G'); select 'saved', count(public.mock_save_answer('$G', current_setting('t8.q'||replace('$G','-','')||'_'||g)::uuid, 1)) from generate_series(1,4) g; select '4x100 at 90', public.mock_submit('$G');
$(sub parent@local.test $G '1,1,1,0' '3x100 of 400 at 90')
$(sub student@local.test $H '1,1,0' '2 of 3 at 67')
$(sub user@local.test $D '0,0,0,0,0' '0 of 5')
$(sub parent@local.test $D '1,1,1,1,1' '5 of 5')
$(sub user@local.test $H '1,1,1' '3 of 3 at 67')
"
echo '=== SC-4 a total of 1'
rb "$(mk_sql $A one '1' released 50) $(sub student@local.test $A '1' '1 of 1') $(sub parent@local.test $A '0' '0 of 1')
$(who student@local.test aal1) select 'list', status||'|'||score||'|'||total||'|'||percentage||'|'||passed from public.mock_tests_for_me() where id='$A';
select 'open q', (public.mock_test_open('$A'))->'questions'->0->>'marks', (public.mock_test_open('$A'))->'questions'->0->>'marks_earned', (public.mock_test_open('$A'))->>'total_marks';
"
```

### `dr-shapes.sh`

```sh
. "$S/t8.sh"
A=00000000-0000-0000-0000-0000000c0001; B=00000000-0000-0000-0000-0000000c0002
keys() { echo "(select string_agg(k, ',' order by k) from jsonb_object_keys($1) k)"; }
O="public.mock_test_open('$A')"
echo '=== SH-1 open before Start, in progress, after submit (student@, pass mark 60, marks 3,2)'
rb "$(mk_sql $A sh '3,2' released 60) $(mk_sql $B shn '1,1' released)
$(who student@local.test aal1)
select 'ns top', $(keys "$O");
select 'ns vals', ($O)->>'status', ($O)->>'question_count', ($O)->>'total_marks', ($O)->>'pass_mark', coalesce(($O)->>'score','null'), coalesce(($O)->>'total','null'), coalesce(($O)->>'percentage','null'), coalesce(($O)->>'passed','null'), ($O)->'questions';
select 'ns list', status||'|'||coalesce(score::text,'null')||'|'||coalesce(total::text,'null')||'|'||coalesce(percentage::text,'null')||'|'||coalesce(passed::text,'null')||'|'||question_count from public.mock_tests_for_me() where id='$A';
$(take_sql $A in_progress '1')
select 'ip vals', ($O)->>'status', coalesce(($O)->>'score','null'), coalesce(($O)->>'percentage','null'), coalesce(($O)->>'passed','null'), ($O)->>'total_marks';
select 'ip qkeys', $(keys "($O)->'questions'->0");
select 'ip marks', string_agg(q->>'marks', ',' order by (q->>'position')::int) from jsonb_array_elements(($O)->'questions') q;
select 'ip leak', ($O)::text ~ '(correct_option|explanation|marks_earned)';
select 'ip list', status||'|'||coalesce(score::text,'null')||'|'||coalesce(total::text,'null')||'|'||coalesce(percentage::text,'null')||'|'||coalesce(passed::text,'null') from public.mock_tests_for_me() where id='$A';
select 'submit', public.mock_submit('$A');
select 'sub vals', ($O)->>'status', ($O)->>'score', ($O)->>'total', ($O)->>'percentage', ($O)->>'passed', ($O)->>'total_marks', ($O)->>'pass_mark';
select 'sub qkeys', $(keys "($O)->'questions'->0");
select 'sub earned', string_agg((q->>'marks_earned')||'/'||(q->>'marks'), ',' order by (q->>'position')::int) from jsonb_array_elements(($O)->'questions') q;
select 'sub list', status||'|'||score||'|'||total||'|'||percentage||'|'||passed from public.mock_tests_for_me() where id='$A';
select 'nopass ns', coalesce((public.mock_test_open('$B'))->>'pass_mark','null'), (public.mock_test_open('$B'))->>'total_marks';
$(take_sql $B submitted '1,0')
select 'nopass sub', (public.mock_test_open('$B'))->>'percentage', coalesce((public.mock_test_open('$B'))->>'passed','null');
select 'nopass list', status||'|'||score||'|'||total||'|'||percentage||'|'||coalesce(passed::text,'null') from public.mock_tests_for_me() where id='$B';
"
```

### `dr-sum.sh`

```sh
. "$S/t8.sh"
A=00000000-0000-0000-0000-0000000d0001; L=00000000-0000-0000-0000-0000000d0002
LA=00000000-0000-0000-0000-0000000d00a1
# <label>|sum of marks_earned|score in open|score in the list
sumrow() { echo "select '$1', (select sum((q->>'marks_earned')::int) from jsonb_array_elements((public.mock_test_open('$2'))->'questions') q)||'|'||((public.mock_test_open('$2'))->>'score')||'|'||(select score from public.mock_tests_for_me() where id='$2');"; }
echo '=== SU-1 per-question marks add up to the score, new and legacy-shaped'
rb "$(mk_sql $A su '3,2,5' released 60) $(mk_sql $L lg '1,1,1' released)
insert into public.mock_test_attempts (id, test_id, profile_id, started_at, submitted_at, score, total) values ('$LA', '$L', (select id from public.profiles where email='parent@local.test'), now() - interval '2 days', now() - interval '2 days', 2, 3);
insert into public.mock_test_answers (attempt_id, question_id, selected_option) select '$LA', id, case when position < 3 then 1 else 0 end from public.mock_test_questions where test_id='$L';
$(who student@local.test aal1) $(take_sql $A submitted '1,0,1')
$(sumrow 'student A' $A)
$(who parent@local.test aal1) $(take_sql $A submitted '-,1,1')
$(sumrow 'parent A' $A)
$(sumrow 'parent legacy' $L)
select 'legacy list', status||'|'||score||'|'||total||'|'||percentage||'|'||coalesce(passed::text,'null') from public.mock_tests_for_me() where id='$L';
select 'legacy earned', string_agg((q->>'marks_earned')||'/'||(q->>'marks'), ',' order by (q->>'position')::int) from jsonb_array_elements((public.mock_test_open('$L'))->'questions') q;
select 'legacy repeat', pg_temp.try(\$\$select public.mock_submit('$L')\$\$), public.mock_submit('$L');
$(who user@local.test aal1) $(take_sql $A submitted '-,-,-')
$(sumrow 'user A' $A)
reset role;
create temp table t8_before on commit drop as select id, score, total, submitted_at from public.mock_test_attempts where test_id in ('$A','$L');
select 'rows', count(*) from t8_before;
$(who admin@local.test aal2)
select 'close', pg_temp.try(\$\$select public.mock_close_now('$A')\$\$), pg_temp.try(\$\$select public.mock_close_now('$L')\$\$);
select 'reopen', pg_temp.try(\$\$select public.mock_set_closing('$A', null)\$\$), pg_temp.try(\$\$select public.mock_set_closing('$L', now() + interval '1 day')\$\$);
select 'tags', pg_temp.try(\$\$update public.mock_tests set subject='english', year_levels='{7}', any_year=false where id='$A'\$\$);
reset role;
select 'changed', (select count(*) from (select id, score, total, submitted_at from public.mock_test_attempts where test_id in ('$A','$L') except select * from t8_before) d) + (select count(*) from (select * from t8_before except select id, score, total, submitted_at from public.mock_test_attempts where test_id in ('$A','$L')) d);
"
```

### `dr-closed.sh`

```sh
. "$S/t8.sh"
A=00000000-0000-0000-0000-0000000c1001; B=00000000-0000-0000-0000-0000000c1002; C=00000000-0000-0000-0000-0000000c1003
O="public.mock_test_open('$A')"
pre=""; checks=""
for E in student@local.test parent@local.test user@local.test; do
  pre="$pre $(who $E aal1) $(take_sql $A submitted '1,0') $(take_sql $B in_progress '1')"
  checks="$checks $(who $E aal1)
select '$E list', string_agg(replace(title, 't8-$RUN-', '')||':'||status||':'||(closes_at <= clock_timestamp())||':'||score||'/'||total||':'||percentage||':'||coalesce(passed::text,'null'), ' ' order by title) from public.mock_tests_for_me() where title like 't8-%';
select '$E open', ($O)->>'status', ($O)->>'score', ($O)->>'total', ($O)->>'percentage', ($O)->>'passed', (select string_agg((q->>'marks_earned')||'/'||(q->>'marks')||':'||(q->>'correct_option')||':'||(q->>'explanation'), ',' order by (q->>'position')::int) from jsonb_array_elements(($O)->'questions') q);
select '$E again', pg_temp.try(\$\$select public.mock_submit('$A')\$\$), pg_temp.try(\$\$select public.mock_start('$A')\$\$);
select '$E B', pg_temp.try(\$\$select public.mock_test_open('$B')\$\$), pg_temp.try(\$\$select public.mock_submit('$B')\$\$), pg_temp.try(\$\$select public.mock_save_answer('$B', current_setting('t8.q$(echo $B | tr -d -)_2')::uuid, 1)\$\$);
select '$E C', pg_temp.try(\$\$select public.mock_test_open('$C')\$\$), pg_temp.try(\$\$select public.mock_start('$C')\$\$);"
done
echo '=== CL closed tests (S-1) with scores'
rb "$(mk_sql $A ca '3,2' released 60) $(mk_sql $B cb '3,2' released 60) $(mk_sql $C cc '1' released) $pre
$(who admin@local.test aal2) select public.mock_close_now('$A'); select public.mock_close_now('$B'); select public.mock_close_now('$C');
$checks
reset role; select 'B attempts', string_agg((submitted_at is null)::text||':'||(select count(*) from public.mock_test_answers ans where ans.attempt_id=a.id), ' ') from public.mock_test_attempts a where a.test_id='$B';
$(who admin@local.test aal2) select 'admin', string_agg(coalesce(taker_name,'null')||'|'||score||'/'||total||'|'||percentage||'|'||passed, ' ' order by taker_name) from public.mock_test_results('$A');
select 'admin B', count(*) from public.mock_test_results('$B');
select 'admin list', string_agg(replace(title, 't8-$RUN-', '')||':'||submitted_count, ' ' order by title) from public.mock_tests_admin_list() where title like 't8-%';
"
```

### `dr-results.sh`

```sh
. "$S/t8.sh"
A=00000000-0000-0000-0000-0000000e0001; D=00000000-0000-0000-0000-0000000e0002; N=00000000-0000-0000-0000-0000000e0003
R="select coalesce(string_agg(coalesce(taker_name,'null')||'|'||score||'|'||total||'|'||percentage||'|'||coalesce(passed::text,'null')||'|'||total_rows, ' ' order by ord), 'none') from (select r.*, row_number() over () as ord from public.mock_test_results"
echo '=== RS-1 rows, order, counts, shape (admin@ aal2)'
rb "$(mk_sql $A rs '3,2' released 60) $(mk_sql $D rsd '1' draft 50) $(mk_sql $N rsn '1,1' released)
$(who student@local.test aal1) $(take_sql $A submitted '1,1')
$(who parent@local.test aal1) $(take_sql $A submitted '-,1')
$(who user@local.test aal1) $(take_sql $A in_progress '1,-')
reset role;
update public.mock_test_attempts set submitted_at = now() - interval '1 hour' where test_id='$A' and profile_id=(select id from public.profiles where email='student@local.test');
$(who admin@local.test aal2)
select 'cols', string_agg(a, ',' order by n) from unnest((select proargnames from pg_proc where proname='mock_test_results')) with ordinality u(a, n) where n > 1;
select 'rows', ($R('$A') r) x);
select 'count', (select count(*) from public.mock_test_results('$A'))||'|'||(select submitted_count from public.mock_tests_admin_list() where id='$A');
select 'draft', ($R('$D') r) x);
select 'nobody', ($R('$N') r) x);
select 'unknown', pg_temp.try(\$\$select * from public.mock_test_results(gen_random_uuid())\$\$);
select 'no at', count(*) from public.mock_test_results('$A') r where r::text like '%@%';
select 'list keys', (select string_agg(k, ',' order by k) from jsonb_object_keys(to_jsonb((select l from public.mock_tests_admin_list() l where id='$A'))) k);
reset role;
update public.mock_test_attempts set submitted_at = (select submitted_at from public.mock_test_attempts where test_id='$A' and profile_id=(select id from public.profiles where email='parent@local.test')) where test_id='$A' and profile_id=(select id from public.profiles where email='student@local.test');
$(who admin@local.test aal2)
select from (select set_config('t8.tie', (select string_agg(attempt_id::text, ',') from public.mock_test_results('$A')), false)) s;
select from (select set_config('t8.open', ($R('$A') r) x), false)) s;
reset role; select 'tie', current_setting('t8.tie') = (select string_agg(id::text, ',' order by id) from public.mock_test_attempts where test_id='$A' and submitted_at is not null);
$(who admin@local.test aal2)
select 'close', pg_temp.try(\$\$select public.mock_close_now('$A')\$\$);
select 'closed rows', ($R('$A') r) x) = current_setting('t8.open'), (select count(*) from public.mock_test_results('$A'));
"
echo '=== RS-2 names: profile, else roster, else null; never the e-mail'
rb "$(mk_sql $A nm '1' released)
$(who student@local.test aal1) $(take_sql $A submitted '1')
$(who parent@local.test aal1) $(take_sql $A submitted '0')
$(who user@local.test aal1) $(take_sql $A submitted '1')
reset role; update public.mock_test_attempts a set submitted_at = now() - (case p.email when 'student@local.test' then 3 when 'parent@local.test' then 2 else 1 end) * interval '1 hour' from public.profiles p where p.id=a.profile_id and a.test_id='$A';
update public.profiles set full_name='Profile Aarav' where email='student@local.test'; update public.students set full_name='Roster Aarav' where profile_id=(select id from public.profiles where email='student@local.test');
$(who admin@local.test aal2) select 'named', ($R('$A') r) x);
reset role; update public.profiles set full_name='' where email in ('student@local.test','parent@local.test'); update public.profiles set full_name='   ' where email='user@local.test';
$(who admin@local.test aal2) select 'blank', ($R('$A') r) x);
"
```

### `dr-az.sh`

```sh
. "$S/t8.sh"
A=00000000-0000-0000-0000-0000000f0001; D=00000000-0000-0000-0000-0000000f0002
RES="pg_temp.try(\$\$select count(*) from public.mock_test_results('$A')\$\$)"
out=""
for P in 'tutor@local.test aal1' 'tutor@local.test aal2' 'parent@local.test aal1' 'student@local.test aal1' 'user@local.test aal1' 'user@local.test aal2' 'inactive@local.test aal2' 'newadmin@local.test aal1' 'admin@local.test aal1'; do
  E=${P% *}; L=${P#* }
  out="$out $(who $E $L)
select '$E $L results', $RES;
select '$E $L attempts', pg_temp.try(\$\$select count(*) from public.mock_test_attempts\$\$), pg_temp.try(\$\$select count(*) from public.mock_test_answers\$\$);
with u as (update public.mock_tests set pass_mark=10 where id='$D' returning 1) select '$E $L passmark', count(*) from u;
with u as (update public.mock_test_questions set marks=9 where test_id='$D' returning 1) select '$E $L marks', count(*) from u;"
done
rb "$(mk_sql $A az '1,1' released 50) $(mk_sql $D azd '1' draft 50)
$(who student@local.test aal1) $(take_sql $A submitted '1,0')
$out
$(who admin@local.test aal2) select 'admin aal2 results', $RES, (select count(*) from public.mock_test_results('$A'));
reset role; update public.profiles set is_active=false where email='admin@local.test';
$(who admin@local.test aal2) select 'inactive admin aal2 results', $RES;
reset role; update public.profiles set is_active=true where email='admin@local.test';
$(anon) select 'anon results', $RES;
select 'anon passmark', pg_temp.try(\$\$update public.mock_tests set pass_mark=10 where id='$D'\$\$);
reset role; select 'D', pass_mark||'|'||(select string_agg(marks::text, ',') from public.mock_test_questions where test_id='$D') from public.mock_tests where id='$D';
"
```

### `dr-reg.sh`

```sh
. "$S/t8.sh"
A=00000000-0000-0000-0000-0000000f1001; D=00000000-0000-0000-0000-0000000f1002
echo '=== PV taker privacy and regression of the taker gate'
rb "$(mk_sql $A pv '3,2,5' released 60) $(mk_sql $D pvd '1' draft)
$(who student@local.test aal1) $(take_sql $A submitted '1,1,1')
$(who parent@local.test aal1) $(take_sql $A submitted '-,1,-')
$(who user@local.test aal1) $(take_sql $A in_progress '1')
$(who student@local.test aal1) select 'student', (select score||'/'||total||'|'||percentage||'|'||passed from public.mock_tests_for_me() where id='$A'), (public.mock_test_open('$A'))->>'score';
$(who parent@local.test aal1) select 'parent', (select score||'/'||total||'|'||percentage||'|'||passed from public.mock_tests_for_me() where id='$A'), (public.mock_test_open('$A'))->>'score';
select 'parent sees 10', (select count(*) from public.mock_tests_for_me() where score = 10), position('\"score\": 10' in (public.mock_test_open('$A'))::text);
$(who user@local.test aal1) select 'user', (select status||'|'||coalesce(score::text,'null')||'|'||coalesce(percentage::text,'null') from public.mock_tests_for_me() where id='$A'), coalesce((public.mock_test_open('$A'))->>'score','null');
select 'draft', pg_temp.try(\$\$select public.mock_test_open('$D')\$\$);
select 'listdraft', count(*) from public.mock_tests_for_me() where id='$D';
$(who tutor@local.test aal1) select 'tutor', pg_temp.try(\$\$select count(*) from public.mock_tests_for_me()\$\$);
$(who admin@local.test aal2) select 'admin as taker', pg_temp.try(\$\$select count(*) from public.mock_tests_for_me()\$\$);
"
```

### `dr-cc.sh`

```sh
. "$S/t8.sh"
# Sequential form of TS-1 to TS-6: session A's statement, then session B's, in one rolled-back
# transaction. It proves the SQL and the final outcome; only the real two-session run proves the wait.
X=00000000-0000-0000-0000-0000000e1001
ADM="$(who admin@local.test aal2)"
st() { echo "reset role; select '$1 after', status||'|'||coalesce(pass_mark::text,'null')||'|'||(select string_agg(marks::text, ',' order by position) from public.mock_test_questions where test_id='$X') from public.mock_tests where id='$X';"; }
echo '=== TS-1 release first, then a pass-mark write'
rb "$(mk_sql $X ts1 '2' draft 50) $ADM select 'A', pg_temp.try(\$\$select public.mock_release('$X')\$\$); select 'B', pg_temp.try(\$\$update public.mock_tests set pass_mark=80 where id='$X'\$\$); $(st TS-1)"
echo '=== TS-2 pass-mark write first, then release'
rb "$(mk_sql $X ts2 '2' draft 50) $ADM select 'A', pg_temp.try(\$\$update public.mock_tests set pass_mark=80 where id='$X'\$\$); select 'B', pg_temp.try(\$\$select public.mock_release('$X')\$\$); select 'later', pg_temp.try(\$\$update public.mock_tests set pass_mark=60 where id='$X'\$\$); $(st TS-2)"
echo '=== TS-3 a submit first, then a pass-mark write'
rb "$(mk_sql $X ts3 '2' released 50) $(who student@local.test aal1) $(take_sql $X in_progress '1') select 'A', public.mock_submit('$X'); $ADM select 'B', pg_temp.try(\$\$update public.mock_tests set pass_mark=10 where id='$X'\$\$); $(st TS-3)"
echo '=== TS-4 release first, then a marks write'
rb "$(mk_sql $X ts4 '2' draft 50) $ADM select 'A', pg_temp.try(\$\$select public.mock_release('$X')\$\$); select 'B', pg_temp.try(\$\$update public.mock_test_questions set marks=7 where test_id='$X'\$\$); $(st TS-4)"
echo '=== TS-5 a marks write first, then release, then a submit scores with it'
rb "$(mk_sql $X ts5 '2' draft 50) $ADM select 'A', pg_temp.try(\$\$update public.mock_test_questions set marks=7 where test_id='$X'\$\$); select 'B', pg_temp.try(\$\$select public.mock_release('$X')\$\$); $(who student@local.test aal1) $(take_sql $X in_progress '1') select 'submit', public.mock_submit('$X'); $(st TS-5)"
echo '=== TS-6 take back to draft first, then a pass-mark write'
rb "$(mk_sql $X ts6 '2' released 50) $(who parent@local.test aal1) $(take_sql $X in_progress '1') $ADM select 'A', pg_temp.try(\$\$select public.mock_withdraw('$X')\$\$); select 'B', pg_temp.try(\$\$update public.mock_tests set pass_mark=80 where id='$X'\$\$); $(st TS-6)"
```

### `dr-bulk.sh`

```sh
. "$S/t8.sh"
# BA-7 / H-3 fixture, rolled back: 1003 throwaway accounts (t8-bulk-NNNN@local.test, name "Bulk NNNN")
# with a submitted attempt each on one released test; Bulk 0001 submitted first, Bulk 1003 last.
X=00000000-0000-0000-0000-0000000b1001
BULK="insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) select gen_random_uuid(), 'authenticated', 'authenticated', 't8-bulk-'||lpad(g::text, 4, '0')||'@local.test', '{\"provider\":\"email\",\"providers\":[\"email\"]}', jsonb_build_object('full_name', 'Bulk '||lpad(g::text, 4, '0')) from generate_series(1, 1003) g;
insert into public.mock_test_attempts (test_id, profile_id, started_at, submitted_at, score, total) select '$X', p.id, timestamptz '2026-11-01 09:00+11', timestamptz '2026-11-01 10:00+11' + p.n * interval '1 minute', p.n % 3, 2 from (select id, row_number() over (order by email) as n from public.profiles where email like 't8-bulk-%') p;"
rb "$(mk_sql $X bulk '1,1' released 50) select 'before', (select count(*) from private.sign_up_emails), (select count(*) from public.audit_log);
$BULK
select 'made', (select count(*) from public.profiles where email like 't8-bulk-%'), (select count(*) from public.mock_test_attempts where test_id='$X'), (select string_agg(distinct role::text||':'||status::text, ',') from public.profiles where email like 't8-bulk-%');
select 'side', (select count(*) from private.sign_up_emails), (select count(*) from public.audit_log);
$(who admin@local.test aal2)
select 'fn', count(*), min(total_rows), max(total_rows), (array_agg(taker_name))[1], (array_agg(taker_name))[1003] from public.mock_test_results('$X');
select 'first1000 oldest', (select taker_name from (select * from public.mock_test_results('$X') limit 1000) r order by submitted_at limit 1);
reset role; delete from auth.users where email like 't8-bulk-%@local.test';
select 'after delete', (select count(*) from public.profiles where email like 't8-bulk-%'), (select count(*) from public.mock_test_attempts where test_id='$X'), (select count(*) from private.sign_up_emails), (select count(*) from public.audit_log);
"
```

### `dr-fx.sh`

```sh
. "$S/t8.sh"
# Browser fixtures (§3.0), rolled back: the same tests and journeys as the committed block, each
# journey run as its taker inside the transaction. Ids are fixed here; the run uses mk_test's.
P=00000000-0000-0000-0000-0000000b90
BS=${P}01; B59=${P}02; BNP=${P}03; B1=${P}04; BCL=${P}05; BNEW=${P}06; BNEW2=${P}07; BLEG=${P}08; BDR=${P}09; BDR1=${P}10
LEG="insert into public.mock_test_attempts (id, test_id, profile_id, started_at, submitted_at, score, total) values ('00000000-0000-0000-0000-0000000b9a01', '$BLEG', (select id from public.profiles where email='student@local.test'), now() - interval '2 days', now() - interval '2 days', 1, 2);
insert into public.mock_test_answers (attempt_id, question_id, selected_option) select '00000000-0000-0000-0000-0000000b9a01', id, case position when 1 then 1 else 0 end from public.mock_test_questions where test_id='$BLEG';"
rb "$(mk_sql $BS bs '3,2' released 60) $(mk_sql $B59 b59 '59,41' released 60) $(mk_sql $BNP bnp '1,1' released) $(mk_sql $B1 b1 '1' released 50)
$(mk_sql $BCL bcl '3,2' released 60 'english|vce|{11,12}|false') $(mk_sql $BNEW bnew '3,2' released 60) $(mk_sql $BNEW2 bnew2 '1,1' released)
$(mk_sql $BLEG bleg '1,1' released) $(mk_sql $BDR bdr '2,3' draft 60) $(mk_sql $BDR1 bdr1 '1' draft) $LEG
$(who student@local.test aal1) $(take_sql $BS submitted '1,0') $(take_sql $B1 submitted '1') $(take_sql $BCL submitted '1,1')
$(who parent@local.test aal1) $(take_sql $BS submitted '-,1') $(take_sql $BNP submitted '1,0') $(take_sql $BCL in_progress '1')
$(who user@local.test aal1) $(take_sql $BS in_progress '1') $(take_sql $B59 submitted '1,0') $(take_sql $B1 submitted '0')
$(who admin@local.test aal2) select public.mock_close_now('$BCL');
reset role; select 'count', count(*) from public.mock_tests where title like 't8-%';
select 'all', string_agg(replace(title, 't8-$RUN-', '')||':'||status||':'||coalesce(pass_mark::text,'-')||':'||(select string_agg(marks::text, ',' order by position) from public.mock_test_questions q where q.test_id=t.id)||':'||coalesce(closes_at <= clock_timestamp(), false), ' ' order by title) from public.mock_tests t where title like 't8-%';
$(for E in student@local.test parent@local.test user@local.test; do echo "$(who $E aal1) select '$E', string_agg(replace(title, 't8-$RUN-', '')||':'||status||coalesce(':'||score||'/'||total||':'||percentage||':'||coalesce(passed::text,'-'), ''), ' ' order by title) from public.mock_tests_for_me() where title like 't8-%';"; done)
$(who admin@local.test aal2) select 'results bs', string_agg(coalesce(taker_name,'null')||'|'||score||'/'||total||'|'||percentage||'|'||coalesce(passed::text,'-'), ' ' order by taker_name) from public.mock_test_results('$BS');
select 'admin counts', string_agg(replace(title, 't8-$RUN-', '')||':'||submitted_count, ' ' order by title) from public.mock_tests_admin_list() where title like 't8-%';
"
```

### `dr-r14.sh`

```sh
. "$S/t8.sh"
# R-14's pre-check, rolled back: the tests that exist when R-14 runs (§3.0 fixtures, then Sitting 3's
# bp1 and bp1b with bp1b released, bp2 and bp2b drafts, bp5 taken back, bm4 draft, then R-3 to R-13).
P=00000000-0000-0000-0000-0000000b91
F="$(mk_sql ${P}01 bs '3,2' released 60) $(mk_sql ${P}02 b59 '59,41' released 60) $(mk_sql ${P}03 bnp '1,1' released) $(mk_sql ${P}04 b1 '1' released 50)
$(mk_sql ${P}05 bcl '3,2' released 60 'english|vce|{11,12}|false') $(mk_sql ${P}06 bnew '3,2' released 60) $(mk_sql ${P}07 bnew2 '1,1' released)
$(mk_sql ${P}08 bleg '1,1' released) $(mk_sql ${P}09 bdr '2,3' draft 60) $(mk_sql ${P}10 bdr1 '1' draft)
$(mk_sql ${P}11 bp1 '' draft 60) $(mk_sql ${P}12 bp1b '1' released) $(mk_sql ${P}13 bp2 '' draft 1) $(mk_sql ${P}14 bp2b '' draft 100)
$(mk_sql ${P}15 bp5 '3,2' draft 65) $(mk_sql ${P}16 bm4 '1' draft) $(mk_sql ${P}17 r3 '1' draft)
$(mk_sql ${P}18 r4 '1,1' released) $(mk_sql ${P}19 r5 '1,1' released) $(mk_sql ${P}20 r6 '1,1' draft) $(mk_sql ${P}21 r13 '1,1' released)"
rb "$F
$(who student@local.test aal1) $(take_sql ${P}05 submitted '1,1')
$(who admin@local.test aal2) select public.mock_close_now('${P}05');
$(who student@local.test aal1)
select 'R-14 all', count(*), string_agg(replace(title, 't8-$RUN-', ''), ', ' order by title) from public.mock_tests_for_me() where title like 't8-%';
select 'R-14 english', string_agg(replace(title, 't8-$RUN-', ''), ', ' order by title) from public.mock_tests_for_me() where title like 't8-%' and subject='english';
select 'R-14 vce', string_agg(replace(title, 't8-$RUN-', ''), ', ' order by title) from public.mock_tests_for_me() where title like 't8-%' and stream='vce';
select 'R-14 writing', count(*) from public.mock_tests_for_me() where title like 't8-%' and subject='writing';
"
```

### `ts-real.sh`

```sh
. "$S/t8.sh"
# Planning run of TS-1 to TS-6 as real two-session pairs (commits; rm_t8 at the end).
row() { cat "$S/cc-A.txt" "$S/cc-B.txt"; echo "after|$(state_of "$X")|$(marks_of "$X")|inv=$(invariant)"; }
echo '--- TS-1'; X=$(mk_test ts1 '2' draft 50)
cc A admin@local.test aal2 "select public.mock_release('$X'); select pg_sleep(4)"
cc B admin@local.test aal2 "select pg_sleep(1); update public.mock_tests set pass_mark=80 where id='$X'"; wait; row
echo '--- TS-2'; X=$(mk_test ts2 '2' draft 50)
cc A admin@local.test aal2 "update public.mock_tests set pass_mark=80 where id='$X'; select pg_sleep(4)"
cc B admin@local.test aal2 "select pg_sleep(1); select public.mock_release('$X')"; wait; row
as_w admin@local.test aal2 "update public.mock_tests set pass_mark=60 where id='$X'"; echo "later|$(state_of "$X")"
echo '--- TS-3'; X=$(mk_test ts3 '2' released 50); take student@local.test $X in_progress 1
cc A student@local.test aal1 "select public.mock_submit('$X'); select pg_sleep(4)"
cc B admin@local.test aal2 "select pg_sleep(1); update public.mock_tests set pass_mark=10 where id='$X'"; wait; row
echo '--- TS-4'; X=$(mk_test ts4 '2' draft 50)
cc A admin@local.test aal2 "select public.mock_release('$X'); select pg_sleep(4)"
cc B admin@local.test aal2 "select pg_sleep(1); update public.mock_test_questions set marks=7 where test_id='$X'"; wait; row
echo '--- TS-5'; X=$(mk_test ts5 '2' draft 50)
cc A admin@local.test aal2 "update public.mock_test_questions set marks=7 where test_id='$X'; select pg_sleep(4)"
cc B admin@local.test aal2 "select pg_sleep(1); select public.mock_release('$X')"; wait; row
take student@local.test $X submitted 1
echo '--- TS-6'; X=$(mk_test ts6 '2' released 50); take parent@local.test $X in_progress 1
cc A admin@local.test aal2 "select public.mock_withdraw('$X'); select pg_sleep(4)"
cc B admin@local.test aal2 "select pg_sleep(1); update public.mock_tests set pass_mark=80 where id='$X'"; wait; row
echo "attempts|$(attempts_of "$X")"
echo "clean|$(rm_t8)"
```

### `h-real.sh`

```sh
. "$S/t8.sh"
# H-1 to H-5 through PostgREST (commits: fixtures, tokens; CL-1 removes the fixtures, token files deleted at the end).
HX=$(mk_test hx '3,2' released 60); take student@local.test $HX submitted '1,0'
for E in tutor@local.test parent@local.test student@local.test user@local.test admin@local.test inactive@local.test; do tok $E; done
tok2
echo "--- H-1 and H-2"
for E in tutor@local.test parent@local.test student@local.test user@local.test admin@local.test anon; do echo "$E $(rest POST $E rpc/mock_test_results "{\"target\":\"$HX\"}")"; done
echo "inactive token $(awk '{print length($3)}' "$S/inactive@local.test.hdr")|$(cat "$S/inactive@local.test.tokstatus")"
echo "admin2 $(rest POST admin2 rpc/mock_test_results "{\"target\":\"$HX\"}" | python3 -I -c 'import sys,json; s,b=sys.stdin.read().split(" ",1); r=json.loads(b); print(s, len(r), sorted(r[0].keys()), r[0]["taker_name"], r[0]["score"], r[0]["total"], r[0]["percentage"], r[0]["passed"], r[0]["total_rows"])')"
echo "admin2 unknown $(rest POST admin2 rpc/mock_test_results '{"target":"00000000-0000-4000-8000-000000000000"}')"
echo "--- H-3 and H-4"
echo "student $(rest POST student@local.test rpc/mock_test_open "{\"target\":\"$HX\"}" | cut -c1-3) $(python3 -I -c 'import sys,json; r=json.load(open(sys.argv[1])); print(r["score"], r["total"], r["percentage"], r["passed"], r["total_marks"], r["pass_mark"], [(q["marks"], q["marks_earned"]) for q in r["questions"]])' "$S/last.json")"
echo "student list $(rest POST student@local.test rpc/mock_tests_for_me '{}' | python3 -I -c 'import sys,json; s,b=sys.stdin.read().split(" ",1); r=[x for x in json.loads(b) if x["title"].startswith("t8-")]; print(s, [(x["status"], x["score"], x["total"], x["percentage"], x["passed"]) for x in r])')"
echo "student repeat $(rest POST student@local.test rpc/mock_submit "{\"target\":\"$HX\"}")"
echo "parent list $(rest POST parent@local.test rpc/mock_tests_for_me '{}' | python3 -I -c 'import sys,json; s,b=sys.stdin.read().split(" ",1); r=[x for x in json.loads(b) if x["title"].startswith("t8-")]; print(s, [(x["status"], x["score"], x["percentage"], x["passed"]) for x in r])')"
echo "parent write $(rest PATCH parent@local.test "mock_tests?id=eq.$HX" '{"pass_mark":10}')|$(state_of $HX)"
echo "anon write $(rest PATCH anon "mock_tests?id=eq.$HX" '{"pass_mark":10}')"
echo "--- H-5"
HB=$(mk_test hb '1,1' released 50)
db "insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) select gen_random_uuid(), 'authenticated', 'authenticated', 't8-bulk-'||lpad(g::text, 4, '0')||'@local.test', '{\"provider\":\"email\",\"providers\":[\"email\"]}', jsonb_build_object('full_name', 'Bulk '||lpad(g::text, 4, '0')) from generate_series(1, 1003) g" 
db "insert into public.mock_test_attempts (test_id, profile_id, started_at, submitted_at, score, total) select '$HB', p.id, timestamptz '2026-11-01 09:00+11', timestamptz '2026-11-01 10:00+11' + p.n * interval '1 minute', p.n % 3, 2 from (select id, row_number() over (order by email) as n from public.profiles where email like 't8-bulk-%') p"
echo "admin2 bulk $(rest POST admin2 rpc/mock_test_results "{\"target\":\"$HB\"}" | python3 -I -c 'import sys,json; s,b=sys.stdin.read().split(" ",1); print(s)') $(python3 -I -c 'import json,sys; r=json.load(open(sys.argv[1])); print(len(r), r[0]["total_rows"], r[0]["taker_name"], r[-1]["taker_name"])' "$S/last.json") $(grep -i '^content-range' "$S/last.hdrs" | tr -d '\r')"
echo "clean|$(rm_t8)"
db "select count(*) from public.profiles where email like 't8-bulk-%'"
rm -f "$S"/*@local.test.hdr "$S"/*.tokstatus "$S/admin2.hdr"; ls "$S" | grep -E 'hdr|tok'
```

### `ws-probe.sh`

```sh
. "$S/t8.sh"
# Planning probe for finding F-2 (not a frozen row): a tab-only profile name.
A=00000000-0000-0000-0000-0000000e0009
rb "$(mk_sql $A ws '1' released) $(who student@local.test aal1) $(take_sql $A submitted '1')
reset role; update public.profiles set full_name=E'\t ' where email='student@local.test';
$(who admin@local.test aal2) select 'tab name', replace(replace(taker_name, E'\t', '<TAB>'), ' ', '<SP>') from public.mock_test_results('$A');"
```

## Appendix B. Dry-run output (2026-11-18, `bedbffe` and, for `dr-r14.sh` and the re-run `h-real.sh`, `031e552`; `<RUN>` for the run id)

Wall-clock values (`elapsed=`, timestamps) are compare shape. `lg.sh`, `ts-real.sh` and `h-real.sh` committed and were cleaned up; the others rolled back.

### `gr.sql`

```
--- GR-1 functions
private.check_mock_question()|definer|v|strict=false|search_path=""|anon=false|auth=false|public=false
private.check_mock_test()|invoker|v|strict=false|search_path=""|anon=false|auth=false|public=false
private.mock_passed(score integer, total integer, pass_mark integer)|invoker|i|strict=true|search_path=""|anon=false|auth=false|public=false
private.mock_percentage(score integer, total integer)|invoker|i|strict=true|search_path=""|anon=false|auth=false|public=false
public.mock_submit(target uuid)|definer|v|strict=false|search_path=""|anon=false|auth=true|public=false
public.mock_test_open(target uuid)|definer|s|strict=false|search_path=""|anon=false|auth=true|public=false
public.mock_test_results(target uuid)|definer|s|strict=false|search_path=""|anon=false|auth=true|public=false
public.mock_tests_for_me()|definer|s|strict=false|search_path=""|anon=false|auth=true|public=false
--- GR-1 return shapes
for_me|TABLE(id uuid, title text, question_count integer, status text, score integer, total integer, submitted_at timestamp with time zone, released_at timestamp with time zone, closes_at timestamp with time zone, subject text, stream text, year_levels smallint[], any_year boolean, percentage integer, passed boolean)
results|TABLE(attempt_id uuid, taker_name text, submitted_at timestamp with time zone, score integer, total integer, percentage integer, passed boolean, total_rows bigint)
--- GR-2 columns
mock_test_attempts.score|smallint|YES|null
mock_test_attempts.total|smallint|YES|null
mock_test_questions.marks|smallint|NO|1
mock_tests.pass_mark|smallint|YES|null
mock_test_questions|mock_test_questions_marks_range|CHECK (((marks >= 1) AND (marks <= 100)))
mock_tests|mock_tests_pass_mark_range|CHECK (((pass_mark >= 1) AND (pass_mark <= 100)))
--- GR-2 triggers
mock_test_questions|mock_test_questions_check|O
mock_test_questions|mock_test_questions_set_updated_at|O
mock_tests|mock_tests_check|O
mock_tests|mock_tests_check_tags|O
mock_tests|mock_tests_insert_released_needs_tags|O
mock_tests|mock_tests_release_needs_tags|O
mock_tests|mock_tests_set_updated_at|O
--- GR-3 grants
colgrants_tests|INSERT:any_year INSERT:instructions INSERT:pass_mark INSERT:stream INSERT:subject INSERT:title INSERT:year_levels UPDATE:any_year UPDATE:instructions UPDATE:pass_mark UPDATE:stream UPDATE:subject UPDATE:title UPDATE:year_levels
colgrants_questions|INSERT:correct_option INSERT:explanation INSERT:marks INSERT:options INSERT:prompt INSERT:test_id UPDATE:correct_option UPDATE:explanation UPDATE:marks UPDATE:options UPDATE:prompt
anon_cols|0
attempts_answers_grants|0
attempts_answers_policies|0
questions_policies|mock_test_questions_admin_delete:DELETE:authenticated mock_test_questions_admin_insert:INSERT:authenticated mock_test_questions_admin_select:SELECT:authenticated mock_test_questions_admin_update:UPDATE:authenticated
--- GR-3 comments
comment_score|Marks earned: the sum of the marks of the questions answered correctly. Written once, at submit.
```

### `dr-marks.sh`

```
=== MK-1 marks on a draft, as admin@ aal2
nomarks|ok
m1|ok
m100|ok
m0|23514:new row for relation "mock_test_questions" violates check constraint "mock_test_questions_marks_range"
mneg|23514:new row for relation "mock_test_questions" violates check constraint "mock_test_questions_marks_range"
m101|23514:new row for relation "mock_test_questions" violates check constraint "mock_test_questions_marks_range"
mnull|23502:null value in column "marks" of relation "mock_test_questions" violates not-null constraint
mdec|ok
stored|1,1,100,3
upd|ok
upd0|23514:new row for relation "mock_test_questions" violates check constraint "mock_test_questions_marks_range"
after|7,1,100,3
=== MK-2 pass mark on a draft, as admin@ aal2
pnull|ok
p1|ok
p100|ok
p0|23514:new row for relation "mock_tests" violates check constraint "mock_tests_pass_mark_range"
pneg|23514:new row for relation "mock_tests" violates check constraint "mock_tests_pass_mark_range"
p101|23514:new row for relation "mock_tests" violates check constraint "mock_tests_pass_mark_range"
pdec|ok
u60|ok
u0|23514:new row for relation "mock_tests" violates check constraint "mock_tests_pass_mark_range"
unull|ok
u75|ok
made|p1:1 p100:100 pdec:61 pnull:null
X|75
=== MK-3 freeze on a released test and on a closed test
pchg|P0001:mock_released
psame|ok
pnull|P0001:mock_released
qmarks|P0001:mock_released
qsame|P0001:mock_released
qins|P0001:mock_released
qdel|P0001:mock_released
cset|P0001:mock_released
cqmarks|P0001:mock_released
ctag|ok
owner|P0001:mock_released
ownerq|P0001:mock_released
X|released|60
Xmarks|3,2
Y|released|null|true|english
Ymarks|3,2
=== MK-4 take-back makes both editable again and keeps the pass mark
withdraw|ok
kept|draft|60
p80|ok
qm|ok
after|80|3,4
=== MK-5 release needs a question only; a pass mark is optional
zeroq|P0001:mock_no_questions
nopass|ok
withpass|ok
st|r0:draft:60 r1:released:null r2:released:100
```

### `dr-score.sh`

```
=== SC-1 helpers (as postgres) and who may call them
pct|66 0 100 33 59 60 100 0 null null 0
pass|true false false true true false true true false false null null false true
auth pct|42501:permission denied for function mock_percentage
auth pass|42501:permission denied for function mock_passed
anon pct|42501:permission denied for schema private
=== SC-2 the score is the sum of the marks answered correctly
q1+q3 right, q2 wrong|{"score": 8, "total": 10, "passed": true, "percentage": 80}
repeat|{"score": 8, "total": 10, "passed": true, "percentage": 80}
only q2, two blanks|{"score": 2, "total": 10, "passed": false, "percentage": 20}
nothing answered|{"score": 0, "total": 10, "passed": false, "percentage": 0}
no pass mark|{"score": 1, "total": 2, "passed": null, "percentage": 50}
stored|parent@local.test:2/10 student@local.test:8/10 student@local.test:1/2 user@local.test:0/10
=== SC-3 boundaries end to end
3 of 5 at 60|{"score": 3, "total": 5, "passed": true, "percentage": 60}
59 of 100 at 60|{"score": 59, "total": 100, "passed": false, "percentage": 59}
saved|100
100x100 all right|{"score": 10000, "total": 10000, "passed": true, "percentage": 100}
saved|4
4x100 at 90|{"score": 400, "total": 400, "passed": true, "percentage": 100}
3x100 of 400 at 90|{"score": 300, "total": 400, "passed": false, "percentage": 75}
2 of 3 at 67|{"score": 2, "total": 3, "passed": false, "percentage": 66}
0 of 5|{"score": 0, "total": 5, "passed": false, "percentage": 0}
5 of 5|{"score": 5, "total": 5, "passed": true, "percentage": 100}
3 of 3 at 67|{"score": 3, "total": 3, "passed": true, "percentage": 100}
=== SC-4 a total of 1
1 of 1|{"score": 1, "total": 1, "passed": true, "percentage": 100}
0 of 1|{"score": 0, "total": 1, "passed": false, "percentage": 0}
list|submitted|1|1|100|true
open q|1|1|1
```

### `dr-shapes.sh`

```
=== SH-1 open before Start, in progress, after submit (student@, pass mark 60, marks 3,2)
ns top|closes_at,id,instructions,pass_mark,passed,percentage,question_count,questions,score,status,submitted_at,tags,title,total,total_marks
ns vals|not_started|2|5|60|null|null|null|null|[]
ns list|not_started|null|null|null|null|2
ip vals|in_progress|null|null|null|5
ip qkeys|id,marks,options,position,prompt,selected_option
ip marks|3,2
ip leak|f
ip list|in_progress|null|null|null|null
submit|{"score": 3, "total": 5, "passed": true, "percentage": 60}
sub vals|submitted|3|5|60|true|5|60
sub qkeys|correct_option,explanation,id,marks,marks_earned,options,position,prompt,selected_option
sub earned|3/3,0/2
sub list|submitted|3|5|60|true
nopass ns|null|2
{"score": 1, "total": 2, "passed": null, "percentage": 50}
nopass sub|50|null
nopass list|submitted|1|2|50|null
```

### `dr-sum.sh`

```
=== SU-1 per-question marks add up to the score, new and legacy-shaped
{"score": 8, "total": 10, "passed": true, "percentage": 80}
student A|8|8|8
{"score": 7, "total": 10, "passed": true, "percentage": 70}
parent A|7|7|7
parent legacy|2|2|2
legacy list|submitted|2|3|66|null
legacy earned|1/1,1/1,0/1
legacy repeat|ok|{"score": 2, "total": 3, "passed": null, "percentage": 66}
{"score": 0, "total": 10, "passed": false, "percentage": 0}
user A|0|0|0
rows|4
close|ok|ok
reopen|ok|ok
tags|ok
changed|0
```

### `dr-closed.sh`

```
=== CL closed tests (S-1) with scores
{"score": 3, "total": 5, "passed": true, "percentage": 60}
{"score": 3, "total": 5, "passed": true, "percentage": 60}
{"score": 3, "total": 5, "passed": true, "percentage": 60}
student@local.test list|ca:submitted:true:3/5:60:true
student@local.test open|submitted|3|5|60|true|3/3:1:Because B1.,0/2:1:
student@local.test again|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
student@local.test B|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
student@local.test C|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
parent@local.test list|ca:submitted:true:3/5:60:true
parent@local.test open|submitted|3|5|60|true|3/3:1:Because B1.,0/2:1:
parent@local.test again|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
parent@local.test B|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
parent@local.test C|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
user@local.test list|ca:submitted:true:3/5:60:true
user@local.test open|submitted|3|5|60|true|3/3:1:Because B1.,0/2:1:
user@local.test again|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
user@local.test B|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
user@local.test C|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
B attempts|true:1 true:1 true:1
admin|Aarav Demo|3/5|60|true Local Parent|3/5|60|true Local User|3/5|60|true
admin B|0
admin list|ca:3 cb:0 cc:0
```

### `dr-results.sh`

```
=== RS-1 rows, order, counts, shape (admin@ aal2)
{"score": 5, "total": 5, "passed": true, "percentage": 100}
{"score": 2, "total": 5, "passed": false, "percentage": 40}
cols|attempt_id,taker_name,submitted_at,score,total,percentage,passed,total_rows
rows|Local Parent|2|5|40|false|2 Aarav Demo|5|5|100|true|2
count|2|2
draft|none
nobody|none
unknown|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
no at|0
list keys|any_year,closes_at,created_at,created_by_name,id,question_count,released_at,status,stream,subject,submitted_count,title,updated_at,year_levels
tie|t
close|ok
closed rows|t|2
=== RS-2 names: profile, else roster, else null; never the e-mail
{"score": 1, "total": 1, "passed": null, "percentage": 100}
{"score": 0, "total": 1, "passed": null, "percentage": 0}
{"score": 1, "total": 1, "passed": null, "percentage": 100}
named|Local User|1|1|100|null|3 Local Parent|0|1|0|null|3 Profile Aarav|1|1|100|null|3
blank|null|1|1|100|null|3 null|0|1|0|null|3 Roster Aarav|1|1|100|null|3
```

### `dr-az.sh`

```
{"score": 1, "total": 2, "passed": true, "percentage": 50}
tutor@local.test aal1 results|42501:not_admin
tutor@local.test aal1 attempts|42501:permission denied for table mock_test_attempts:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_attempts TO authenticated;|42501:permission denied for table mock_test_answers:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_answers TO authenticated;
tutor@local.test aal1 passmark|0
tutor@local.test aal1 marks|0
tutor@local.test aal2 results|42501:not_admin
tutor@local.test aal2 attempts|42501:permission denied for table mock_test_attempts:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_attempts TO authenticated;|42501:permission denied for table mock_test_answers:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_answers TO authenticated;
tutor@local.test aal2 passmark|0
tutor@local.test aal2 marks|0
parent@local.test aal1 results|42501:not_admin
parent@local.test aal1 attempts|42501:permission denied for table mock_test_attempts:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_attempts TO authenticated;|42501:permission denied for table mock_test_answers:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_answers TO authenticated;
parent@local.test aal1 passmark|0
parent@local.test aal1 marks|0
student@local.test aal1 results|42501:not_admin
student@local.test aal1 attempts|42501:permission denied for table mock_test_attempts:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_attempts TO authenticated;|42501:permission denied for table mock_test_answers:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_answers TO authenticated;
student@local.test aal1 passmark|0
student@local.test aal1 marks|0
user@local.test aal1 results|42501:not_admin
user@local.test aal1 attempts|42501:permission denied for table mock_test_attempts:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_attempts TO authenticated;|42501:permission denied for table mock_test_answers:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_answers TO authenticated;
user@local.test aal1 passmark|0
user@local.test aal1 marks|0
user@local.test aal2 results|42501:not_admin
user@local.test aal2 attempts|42501:permission denied for table mock_test_attempts:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_attempts TO authenticated;|42501:permission denied for table mock_test_answers:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_answers TO authenticated;
user@local.test aal2 passmark|0
user@local.test aal2 marks|0
inactive@local.test aal2 results|42501:not_admin
inactive@local.test aal2 attempts|42501:permission denied for table mock_test_attempts:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_attempts TO authenticated;|42501:permission denied for table mock_test_answers:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_answers TO authenticated;
inactive@local.test aal2 passmark|0
inactive@local.test aal2 marks|0
newadmin@local.test aal1 results|42501:not_admin
newadmin@local.test aal1 attempts|42501:permission denied for table mock_test_attempts:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_attempts TO authenticated;|42501:permission denied for table mock_test_answers:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_answers TO authenticated;
newadmin@local.test aal1 passmark|0
newadmin@local.test aal1 marks|0
admin@local.test aal1 results|42501:not_admin
admin@local.test aal1 attempts|42501:permission denied for table mock_test_attempts:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_attempts TO authenticated;|42501:permission denied for table mock_test_answers:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_answers TO authenticated;
admin@local.test aal1 passmark|0
admin@local.test aal1 marks|0
admin aal2 results|ok|1
inactive admin aal2 results|42501:not_admin
anon results|42501:permission denied for function mock_test_results
anon passmark|42501:permission denied for table mock_tests:Grant the required privileges to the current role with: GRANT SELECT, UPDATE ON public.mock_tests TO anon;
D|50|1
```

### `dr-reg.sh`

```
=== PV taker privacy and regression of the taker gate
{"score": 10, "total": 10, "passed": true, "percentage": 100}
{"score": 2, "total": 10, "passed": false, "percentage": 20}
student|10/10|100|true|10
parent|2/10|20|false|2
parent sees 10|0|0
user|in_progress|null|null|null
draft|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
listdraft|0
tutor|42501:not_taker
admin as taker|42501:not_taker
```

### `dr-cc.sh`

```
=== TS-1 release first, then a pass-mark write
A|ok
B|P0001:mock_released
TS-1 after|released|50|2
=== TS-2 pass-mark write first, then release
A|ok
B|ok
later|P0001:mock_released
TS-2 after|released|80|2
=== TS-3 a submit first, then a pass-mark write
A|{"score": 2, "total": 2, "passed": true, "percentage": 100}
B|P0001:mock_released
TS-3 after|released|50|2
=== TS-4 release first, then a marks write
A|ok
B|P0001:mock_released
TS-4 after|released|50|2
=== TS-5 a marks write first, then release, then a submit scores with it
A|ok
B|ok
submit|{"score": 7, "total": 7, "passed": true, "percentage": 100}
TS-5 after|released|50|7
=== TS-6 take back to draft first, then a pass-mark write
A|ok
B|ok
TS-6 after|draft|80|2
```

### `dr-bulk.sh`

```
before|0|61
made|1003|1003|user:invited
side|0|61
fn|1003|1003|1003|Bulk 1003|Bulk 0001
first1000 oldest|Bulk 0004
after delete|0|0|0|61
```

### `dr-fx.sh`

```
{"score": 3, "total": 5, "passed": true, "percentage": 60}
{"score": 1, "total": 1, "passed": true, "percentage": 100}
{"score": 5, "total": 5, "passed": true, "percentage": 100}
{"score": 2, "total": 5, "passed": false, "percentage": 40}
{"score": 1, "total": 2, "passed": null, "percentage": 50}
{"score": 59, "total": 100, "passed": false, "percentage": 59}
{"score": 0, "total": 1, "passed": false, "percentage": 0}
count|10
all|b1:released:50:1:false b59:released:60:59,41:false bcl:released:60:3,2:true bdr:draft:60:2,3:false bdr1:draft:-:1:false bleg:released:-:1,1:false bnew:released:60:3,2:false bnew2:released:-:1,1:false bnp:released:-:1,1:false bs:released:60:3,2:false
student@local.test|b1:submitted:1/1:100:true b59:not_started bcl:submitted:5/5:100:true bleg:submitted:1/2:50:- bnew:not_started bnew2:not_started bnp:not_started bs:submitted:3/5:60:true
parent@local.test|b1:not_started b59:not_started bleg:not_started bnew:not_started bnew2:not_started bnp:submitted:1/2:50:- bs:submitted:2/5:40:false
user@local.test|b1:submitted:0/1:0:false b59:submitted:59/100:59:false bleg:not_started bnew:not_started bnew2:not_started bnp:not_started bs:in_progress
results bs|Aarav Demo|3/5|60|true Local Parent|2/5|40|false
admin counts|b1:2 b59:1 bcl:1 bdr:0 bdr1:0 bleg:1 bnew:0 bnew2:0 bnp:1 bs:2
```

### `dr-r14.sh`

```
{"score": 5, "total": 5, "passed": true, "percentage": 100}
R-14 all|12|b1, b59, bcl, bleg, bnew, bnew2, bnp, bp1b, bs, r13, r4, r5
R-14 english|bcl
R-14 vce|bcl
R-14 writing|0
```

### `lg.sh`

```
reset exit=0
20261120100000
0
{"score": 1, "total": 2}
parent@local.test|null|null
student@local.test|1|2
up exit=0
20261121100000
cmp exit=0
2|2
null
list|submitted|1|2|50|null
earned|1/1,0/1
parent submit|{"score": 2, "total": 2, "passed": null, "percentage": 100}
results|Aarav Demo|1/2|50|null Local Parent|2/2|100|null
```

### `ts-real.sh`

```
--- TS-1
A||elapsed=4.2
B|ERROR:  mock_released|elapsed=4.2
after|released|50|null|false|2|inv=0
--- TS-2
A||elapsed=4.2
B||elapsed=4.2
after|released|80|null|false|2|inv=0
ERROR:  mock_released
later|released|80|null|false
--- TS-3
A|{"score": 2, "total": 2, "passed": true, "percentage": 100}|elapsed=4.2
B|ERROR:  mock_released|elapsed=4.2
after|released|50|null|false|2|inv=0
--- TS-4
A||elapsed=4.2
B|ERROR:  mock_released|elapsed=4.2
after|released|50|null|false|2|inv=0
--- TS-5
A||elapsed=4.2
B||elapsed=4.2
after|released|50|null|false|7|inv=0
{"score": 7, "total": 7, "passed": true, "percentage": 100}
--- TS-6
A||elapsed=4.2
B||elapsed=4.2
after|draft|80|null|false|2|inv=0
attempts|
clean|0
```

### `h-real.sh`

```
{"score": 3, "total": 5, "passed": true, "percentage": 60}
admin2 aal=aal2
--- H-1 and H-2
tutor@local.test 403 {"code":"42501","details":null,"hint":null,"message":"not_admin"}
parent@local.test 403 {"code":"42501","details":null,"hint":null,"message":"not_admin"}
student@local.test 403 {"code":"42501","details":null,"hint":null,"message":"not_admin"}
user@local.test 403 {"code":"42501","details":null,"hint":null,"message":"not_admin"}
admin@local.test 403 {"code":"42501","details":null,"hint":null,"message":"not_admin"}
anon 401 {"code":"42501","details":null,"hint":null,"message":"permission denied for function mock_test_results"}
inactive token 0|user_banned 400
admin2 200 1 ['attempt_id', 'passed', 'percentage', 'score', 'submitted_at', 'taker_name', 'total', 'total_rows'] Aarav Demo 3 5 60 True 1
admin2 unknown 404 {"code":"P0002","details":null,"hint":null,"message":"not_found"}
--- H-3 and H-4
student 200 3 5 60 True 5 60 [(3, 3), (2, 0)]
student list 200 [('submitted', 3, 5, 60, True)]
student repeat 200 {"score": 3, "total": 5, "passed": true, "percentage": 60}
parent list 200 [('not_started', None, None, None)]
parent write 204 |released|60|null|false
anon write 401 {"code":"42501","details":null,"hint":"Grant the required privileges to the current role with: GRANT SELECT, UPDATE ON public.mock_tests TO anon;","message":"permission denied for table mock_tests"}
--- H-5
admin2 bulk 200 1000 1003 Bulk 1003 Bulk 0004 Content-Range: 0-999/*
clean|0
0
aal2tok.py
anon.hdr
last.hdrs
```

### `ws-probe.sh`

```
{"score": 1, "total": 1, "passed": null, "percentage": 100}
tab name|<TAB>
```

## 12. Lead rulings after TSR round 1 (appended; frozen rows above unchanged)

1. **S-1 (BUG-1): environment error caused by the team lead.** `review-1.md` and `00-decisions.md` at the repo root were the lead's stray writes for the other pipeline (a command run from the wrong directory). Both have been removed. The build is unchanged (`git diff 399c8cf HEAD -- apps supabase e2e` is empty), so S-1 alone is re-run on the same build.
2. **SC-2 (BUG-2): plan error.** `string_agg(… order by p.email)` ties student@'s two attempts. The expected value is the same four values in either order. PASS. A later plan orders by `p.email, a.total`.
3. **BA-2 (BUG-3): plan error.** The portal layout's own-profile read (`auth.service.ts:168`, the caller's row: name, role, active) happens on every portal page. The page's own two requests match exactly, and no taker data is in the extra one. PASS.
4. **BA-9 (BUG-4): plan error.** An admin with no authenticator is sent to `/portal/account/two-step/setup` (`ROUTES.twoStepSetup`; seed line 6). The point of the row holds: no aal2, no results, no RPC. PASS with that page.
5. **BK-2 (BUG-5): plan error.** `Results` is a link (`Button component={RouterLink}`, admin-mock-test.tsx:157), which Enter activates. Space is the button pattern. It's consistent with the portal's other link-buttons. PASS on Enter. Space on link-buttons portal-wide is not this feature; noted, not deferred work.
