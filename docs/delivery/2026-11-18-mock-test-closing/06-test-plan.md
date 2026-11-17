# 06 — Test plan: mock test closing and categories

**Status: FROZEN at `1a1260a` (2026-11-18, after review-6a round 1).** Corrections after freeze are appended as rulings; rows above stay as written.

Stage 6a of `/deliver`, Test Manager. Branch `feature/mock-test-closing`. Date 2026-11-18.
Inputs: [00](00-decisions.md) (S-1, S-2, L-1 to L-4), [01](01-requirement.md) (ACs 1 to 29), [02](02-architecture.md),
[03](03-design.md), [04](04-plan.md) (definition of done, item 12), [05](05-dev-notes.md), the shared test-manager,
tester, tester-ui and tester-api roles, and the AJ Classes tester addendum. House format and set-up:
`docs/delivery/2026-11-17-mock-tests/06-test-plan.md` (with its §11 rulings) and its `TSR.md`.

Saurabh's words, verbatim:
1. "there should be an expiry as well, or way to deactivate test so its not visible to anyone anymore"
2. "along with deactivate, there should be category as to what subject and which grade and what stream of education as in VCE/NAPLAN etc the test belongs to so its easy for users to filter out based on those tags."

**Plan base: `1a1260a`** (written at `5cb0810`, re-synced to fix batch 1, `ffe68cc` and `e947687`, then to the
INSERT release trigger `1a1260a` and review-6a; §9). Every
expected value below was read from the code, the two migrations (`20261119100000_mock_test_closing.sql`,
`20261120100000_mock_test_categories.sql`) and `supabase/seed.sql` at `1a1260a`, and every database row was dry-run on
this machine on 2026-11-18, inside `begin … rollback`, as the role the row runs as, against the local database with
`1a1260a`'s migrations applied (§0.2). At run time, if `git diff --quiet 1a1260a HEAD -- apps/web/src supabase e2e package.json` fails,
re-derive every value marked **(count)** and every quoted string from the files at HEAD before comparing. A wrong
expected value found in the run is a plan error: the TSR records it and the lead rules on it. The run doesn't edit
this plan.

`/test-and-ship` writes `docs/delivery/2026-11-18-mock-test-closing/TSR.md` (plus `bugs/`). **Write each row's Actual
and Result into the TSR as soon as the row runs.** Evidence goes under a gitignored `run-*/` folder
(`docs/delivery/2026-11-18-mock-test-closing/run-*/` is in `.git/info/exclude`); commit only `TSR.md` and `bugs/`.

Rulings that are decided and not tested as open questions: S-1 (a submitter keeps the closed test and their result;
nobody else sees it), S-2 (the working answers C1 to C10), L-1 (Close now on a closed test is a silent no-op that keeps
the first closing time), L-2 (`mock_submit` returns `not_found` after closing even for a submitter; their result still
opens), L-3 (stream labels from `PROGRAMMES.items`), L-4 (`mockTagErrors(tags, required, kept)`), and the as-built
[ASSUMPTION] of 04-plan 7b.1 and design §0.2 (the Release button stays enabled with a tag missing; the dialog
refuses), confirmed by the lead for F-3.
Lessons carried from the last gate (its §11 and L-10, L-11): fixtures are checked against constraints and grants;
`not_found` prints in psql as `{"code":"P0002","message":"not_found",…}` with SQLSTATE `PGRST` and is HTTP 404; the
admin can't read attempts, so every attempt count runs as `postgres`.

Row counts are at the end (§10).

---

## 0. Set-up

### 0.1 Environment

- Repo `/Users/sjain/dev/work/aj_classes` at the plan base or HEAD (see above). Local Supabase only: API `:55321`,
  DB `:55322`, Studio `:55323`, Mailpit `:55324`. No hosted Supabase, Vercel or Google, not even read-only.
- **Start of run:** the run's single stack owner runs `pnpm db:reset` once (never while another agent reads the
  stack), then S-0. Nobody else resets, seeds or runs `db:test` during the run.
- Dev server (Sittings 3 and 4; S-8 and S-9 use their own webServer): `pnpm dev --port 5173 --strictPort` from `apps/web`; use
  `http://localhost:5173`; take the real URL from the run log. Stop it by PID (`lsof -tiTCP:5173 -sTCP:LISTEN`,
  confirm its cwd is this repo), never `pkill -f`.
- **Browser rows:** Playwright with the installed Chrome (`channel: 'chrome'`, a fresh profile, no real accounts),
  emulated viewports (never headless `--window-size`), a fresh context per account, `locale: 'en-AU'`,
  `timezoneId: 'Australia/Melbourne'` unless a row says otherwise. (No `window.confirm` stub: every confirmation here is an MUI dialog.) The lead's V rows
  use the AJClassesBrowser Chrome (Claude in Chrome, `switch_browser` first); the Tester takes their screenshots.
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
- **Dates:** a displayed date is checked against the page's own
  `new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(<closes_at ISO from the database>))`
  in the context's time zone (the format of `formatDateTime`, `apps/web/src/lib/format.ts:20`, "8 Oct 2026, 4:05 pm").

### 0.2 Helpers and dry-runs

Each tool call is a fresh zsh shell: start every block with `export S=<run folder>` and `. "$S/t7.sh"`.
Never run a `zsh -c` string that contains the letters of a removal command with a variable; run scripts from files
(the harness refused one during planning).

```sh
# One-off set-up: run folder, run id, and the publishable key in a 0600 header file (never on a command line)
export S=/Users/sjain/dev/work/aj_classes/docs/delivery/2026-11-18-mock-test-closing/run-1; mkdir -p "$S"; umask 077
echo "RUN=$(date +%s)" > "$S/run.env"
(cd /Users/sjain/dev/work/aj_classes && supabase status -o json > "$S/status.json")
python3 -I -c "import json; d=json.load(open('$S/status.json')); open('$S/anon.hdr','w').write('apikey: '+d['PUBLISHABLE_KEY']+'\n')"
# then write $S/t7.sh and the dr-*.sh scripts exactly as in Appendix A
```

`t7.sh` is the last gate's helper file with four changes: `mk_sql`/`mk_test` take tags and a `legacy` state;
`CLEAN` keeps `HINT` lines (the tag refusals name their field there) and drops the uuid echo of `set_config`;
`cc` accepts `postgres` as the person (the table-owner rows); and `TRY`, `who`, `rb`, `take`, `close_now`,
`tags_of`, `state_of`, `untagged_released` are new. `pg_temp.try(sql)` returns `ok` or
`<sqlstate>:<message>[:<hint>]`, so one rolled-back transaction checks several refusals in turn.

**Fixtures and the `legacy` state.** `mk_sql` inserts as `postgres` with tags (default `maths|naplan|{}|true`;
`none` = untagged), adds questions while the test is a draft (the question trigger refuses a released test), then
releases by a direct update (the release trigger needs the tags). `legacy` is a released test with no tags, the state
of a test made before this feature. It is built as a draft, then released with `mock_tests_release_needs_tags`
switched off for that one update, inside the fixture's own transaction (the pgTAP Legacy L form; `mk_test` wraps it in
`begin … commit`): `alter table public.mock_tests disable trigger mock_tests_release_needs_tags; update … set status='released' …; alter table public.mock_tests enable trigger mock_tests_release_needs_tags;`.
Every block that builds a legacy test ends with
`db "select tgname||':'||tgenabled::text from pg_trigger where tgname in ('mock_tests_release_needs_tags','mock_tests_insert_released_needs_tags') order by 1" | paste -sd' ' -`
→ `mock_tests_insert_released_needs_tags:O mock_tests_release_needs_tags:O` (both on; dry-run matched). The
removed-value fixture (TG-8, BG-10, `k-rv`) stores `interview-preparation` and `old-stream`, which the guard trigger
would refuse, by skipping triggers for that one update with `set local session_replication_role = replica` (it does
not change the status, so the release triggers are not involved).

Dry-run results (2026-11-18, local stack with `1a1260a`'s migrations, `clock_timestamp()` in the taker checks, `select version … order by 1 desc limit 3` →
`20261120100000 20261119100000 20261118100000`; nothing was committed: `select count(*) from public.mock_tests` → `0`
before and after):

| Dry-run | Result |
|---|---|
| S-0 queries | exactly S-0's expected values |
| `db "select nope()"` | `ERROR:  function nope() does not exist`, exit 1 (the helper fails loudly) |
| `rb` self-test: `try('select 1')`, `try('select nope()')`, as admin `try(mock_close_now(<random>))`, `current_user` then `reset role` | `ok`; `42883:function nope() does not exist:No function …`; `PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}`; `authenticated`; `postgres` |
| Fixture build: `rel` (released, 2 q), `legacy` (2 q, untagged), `draft` (1 q, untagged), `y5` (`english|vce|{5,6}|false`) | `t7-<RUN>-draft|draft|null|null|{}|false|1`, `…-legacy|released|null|null|{}|false|2`, `…-rel|released|maths|naplan|{}|true|2`, `…-y5|released|english|vce|{5,6}|false|1` |
| `dr-closing.sh`, `dr-s1.sh`, `dr-tags.sh`, `dr-removed.sh`, `dr-cc.sh` (sequential form of the TS rows), `dr-az.sh`, `dr-reg.sh`, `dr-cleanup.sh`, `dr-fx3.sh` | the exact outputs quoted in the rows that use them; no line starting `ERROR` |
| GR queries (`gr.sql`) | the exact values in GR-1 to GR-3 |

**Not dry-run** (they commit): the TS rows as real two-session runs, `tok`/`rest` (a password grant writes a session),
`mk_test`/`take`/`close_now` (their SQL is the dry-run SQL above, committed), the suites that use the stack (S-6 to
S-9) and every browser row. Each states its expected value from the code; the run records a mismatch as a plan error
or a bug.

### 0.3 Fixtures and restoring them

- Seed accounts (`supabase/seed.sql:4-13`): `admin@` (admin, verified TOTP, aal2 in the browser), `newadmin@`
  (admin, no authenticator), `tutor@`, `inactive@` (deactivated tutor), `parent@` (parent of Aarav and Noah),
  `student@` (Aarav Demo), `user@` (role `user`). All `@local.test`. The seed has **no** mock tests and no options
  other than the migration's 13. No row here needs a second admin with two-step (FX-NA of the last gate is not used).
- Every mock test fixture is titled `t7-<RUN>-<label>`. Fixture prompts, options and titles contain no `$`, "price"
  or "pay".
- **Shared seed state:** two rows change it, and each restores it in the same row and checks the restore:
  BG-6 switches `('subject','writing')` off in `private.mock_test_options`; nothing else touches that table outside
  a rolled-back transaction. S-0's options line must read the same after BG-6.
- Taker journeys (`take <e-mail> <test> submitted|in_progress`) start, answer question 1 with option 1 (correct),
  and submit when asked: a submitted fixture scores `1 of 2`.
- Clean-up CL-1 runs last in every sitting that wrote. `rm_t7` removes every t7 test with its attempts and answers
  (dry-run `dr-cleanup.sh` on a closed, a legacy and a removed-value test → `left|0`).

**S-0 start state (gate before any row).**

```sh
export S=…; . "$S/t7.sh"
db "select p.email||'|'||p.role||'|'||p.status||'|'||p.is_active from public.profiles p order by 1" | paste -sd' ' -
db "select count(*) from public.mock_tests"; db "select count(*) from public.mock_test_attempts"
db "select s.full_name||'|'||s.is_active from public.students s where s.profile_id=(select id from public.profiles where email='student@local.test')"
db "select count(*) from auth.mfa_factors f join auth.users u on u.id=f.user_id where u.email='newadmin@local.test'"
db "select kind||':'||key||':'||active from private.mock_test_options order by kind, key" | paste -sd' ' -
db "select version from supabase_migrations.schema_migrations order by 1 desc limit 3" | paste -sd' ' -
lsof -nP -iTCP:5173 -sTCP:LISTEN | wc -l
```

Expected (dry-run matched):
`admin@local.test|admin|active|true inactive@local.test|tutor|active|false newadmin@local.test|admin|active|true parent@local.test|parent|active|true student@local.test|student|active|true tutor@local.test|tutor|active|true user@local.test|user|active|true`;
`0`; `0`; `Aarav Demo|true`; `0`;
`stream:icas:true stream:maths-science-english:true stream:naplan:true stream:seal-and-scholarships:true stream:selective-entry:true stream:vce:true subject:english:true subject:maths:true subject:numerical-reasoning:true subject:reading:true subject:science:true subject:verbal-reasoning:true subject:writing:true`;
`20261120100000 20261119100000 20261118100000`; `0`.

### 0.4 Order, sittings and ownership

1. **Sitting 1, tester-api, owner of the local database (43 rows):** S-1 to S-5 and S-10 (no stack), then GR, AZ,
   CD, TV, TG (all rolled back), then TS and H (they commit and clean up after themselves), then CL-1.
2. **Sitting 2, tester-api, still the stack owner (4 rows):** S-6 to S-9. S-8 and S-9 use Playwright's own
   `webServer` (from the e2e config); nothing is started by hand on 5173 in Sitting 2. After each, check
   `lsof -nP -iTCP:5173 -sTCP:LISTEN` → nothing (stop a leftover by PID). Then CL-1 again.
3. **Sitting 3, tester-ui, the single owner of the local database, the dev server and the browser fixtures for
   Sittings 3 and 4 (33 rows); nobody else writes to the stack until Sitting 4's CL-1:** BF-1 to BF-8 first (they
   need an empty start), then in this order BC-1, BC-2, BC-3, BC-5, BC-4, BS-1 to BS-5, BC-6, BC-7, BC-8, then BG-1
   to BG-12, then CL-1.
4. **Sitting 4, tester-ui, same single owner (19 rows):** S-0 again (Sitting 3's CL-1 left it clean), BR-2's
   empty-state page first, then the **Sitting 4 fixtures** block (§3.6a), then BK-1 to BK-3, BR-1 to BR-3,
   R-1 to R-13, the screenshots for V-1 to V-4, then CL-1.
5. Testers run one at a time on the stack; nothing in Sitting 3 or 4 runs while Sitting 1 or 2 writes. Sittings 1
   and 3 may run in either order only if each starts from S-0; the default is 1, 2, 3, 4.
6. Never mark a row BLOCKED for lack of budget: say NOT RUN and hand back.
7. **Lead's rows:** V-1 to V-4 (real-browser visual judgement). The Tester takes the screenshots; the lead gives the
   verdict. Every other row is a tester's.

---

## 1. Suites (Sittings 1 and 2, tester-api)

Each command as `cmd > "$S/<name>.log" 2>&1; echo "exit=$?"`, run separately.

**S-1 — format.** `pnpm format:check`. Expected: exit 1 listing only `actionItems.md` and
`supabase/.temp/linked-project.json` (05 checks). Both are pre-existing local files outside this change (untracked or
local CLI state, not in the diff); the TSR says so in the row. Check with
`grep -E '^\[warn\] ' "$S/format.log" | grep -vE 'actionItems.md|supabase/.temp/linked-project.json|Code style issues'` → no lines.

**S-2 — lint.** AC 27 (house rule: no raw JSX text). `pnpm lint`. Expected: `exit=0`.

**S-3 — typecheck.** `pnpm typecheck`. Expected: `exit=0`.

**S-4 — `pnpm test`.** ACs 10 to 29 (web side). Expected: web `Test Files  117 passed (117)`, `Tests  1144 passed (1144)`
**(count)** (05, fix batch 1 checks); e2e unit `ℹ tests 6`, `ℹ fail 0`; `test-deploy-order.mjs` exit 0. Files on disk
(`find apps/web -path '*/node_modules' -prune -o \( -name '*.test.ts' -o -name '*.test.tsx' \) -print | wc -l`) → `117`.
The feature files, each passed in the log: `lib/mock-tests.test.ts`, `lib/mock-test-options.parity.test.ts` (AC 10,
11, 12 lists equal the migration), `lib/mock-tests-scope.test.ts` (AC 29), `services/mock-tests.service.test.ts`,
`services/auth-errors.test.ts`, `components/portal/MockClosingDialogs.test.tsx`, `MockTagFields.test.tsx`,
`MockTagsDialog.test.tsx`, `MockTagLine.test.tsx`, `MockTestFilters.test.tsx`, `MockTestDialog.test.tsx`,
`routes/portal/admin-mock-test.test.tsx`, `admin-mock-tests.test.tsx`, `mock-test.test.tsx`, `mock-tests.test.tsx`.

**S-5 — production build and hosted-ref check.** `VITE_APP_ENV=production pnpm build`, then the CI-style gate build
from `docs/testing/ci-gates.md` and `pnpm --filter web check:hosted-ref build/client`. Expected: both builds `exit=0`;
`check-hosted-ref: 0 files (of 186 scanned)` **(count)**.

**S-6 — `pnpm db:test`.** ACs 1 to 18, 25, 27 (database side). Lift any cron pause first (addendum). Expected:
`Files=25, Tests=1954` **(count)** (05's 1951 after fix batch 1, plus the three INSERT cases of `1a1260a`), `Result: PASS`, with `mock_tests_admin.test.sql`, `mock_tests_taker.test.sql`,
`mock_tests_closing.test.sql` (run after the categories migration), `mock_tests_categories.test.sql` and
`open_sign_up_access.test.sql` each `ok`.

**S-7 — `pnpm test:functions`.** Restart the edge runtime first (`docker restart supabase_edge_runtime_aj_classes`).
Expected: `exit=0`, no `NOT OK`. Afterwards `db "select count(*) from private.sign_up_emails"` → `0`.

**S-8 — e2e smoke.** ACs 3, 5.1, 13, 14, 15, 20, 22. `node e2e/scripts/local-env.mjs > e2e/.env; pnpm --filter aj-classes-e2e test:smoke`
(Playwright starts and stops its own `webServer`).
Expected: `17 passed` **(count)** (admin-posts 5, invite-onboarding 2, mock-tests 2, open-sign-up 5, our-approach 1,
register-interest 1, staff-login 1). Afterwards `db "select count(*) from public.mock_tests where title like 'e2e-%'"` → `0`,
no `e2e-%` rows in posts, enquiries or profiles, nothing listening on 5173 (stop a leftover by PID).

**S-9 — CSP sweep.** Rebuild the gate build (S-5) first if another build ran since, then
`pnpm --filter aj-classes-e2e test:csp` (Playwright's own `webServer` serves the build). Expected: `23 passed` **(count)**;
nothing listening on 5173 afterwards.

**S-10 — deploy order and scope.** 04-plan deploy order. `node supabase/scripts/test-deploy-order.mjs` → exit 0.
Static: `grep -n 'run supabase db push' supabase/scripts/deploy.sh` → line `279`; `grep -n 'functions deploy' supabase/scripts/deploy.sh`
→ line `296`; `grep -n 'config push --project-ref' supabase/scripts/deploy.sh` → line `334`. Never run `deploy.sh`.
`git diff --stat develop...HEAD -- supabase/scripts supabase/functions supabase/config.toml` → empty;
`git diff --name-only develop...HEAD -- supabase/migrations` → exactly `supabase/migrations/20261119100000_mock_test_closing.sql`
and `supabase/migrations/20261120100000_mock_test_categories.sql`; `git diff develop...HEAD -- supabase/migrations/20261118100000_mock_tests.sql | wc -l` → `0`.

---

## 2. Database and raw API rows (Sitting 1, tester-api)

All of §2.1 to §2.5 is rolled back: run the named script from Appendix A and compare its output (with the run id
replaced by `<RUN>`: `sed "s/$RUN/<RUN>/g"`) with the expected lines, in order. Every expected line below was
produced by that script in the dry-run.

### 2.1 Catalogue

**GR-1 — functions: definer, search path, execute.** ACs 2, 3, 14 limits. `docker exec -i supabase_db_aj_classes psql -U postgres -At -q < "$S/gr.sql"`, first block.
Expected, exactly these nine lines:
```
private.check_mock_test_release_tags()|definer|search_path=""|anon=false|auth=false
private.check_mock_test_tags()|definer|search_path=""|anon=false|auth=false
public.mock_close_now(target uuid)|definer|search_path=""|anon=false|auth=true
public.mock_release(target uuid, closes timestamp with time zone)|definer|search_path=""|anon=false|auth=true
public.mock_set_closing(target uuid, closes timestamp with time zone)|definer|search_path=""|anon=false|auth=true
public.mock_test_open(target uuid)|definer|search_path=""|anon=false|auth=true
public.mock_tests_admin_list()|definer|search_path=""|anon=false|auth=true
public.mock_tests_for_me()|definer|search_path=""|anon=false|auth=true
public.mock_withdraw(target uuid)|definer|search_path=""|anon=false|auth=true
```
No `mock_release(target uuid)` line (the one-argument version is dropped).

**GR-2 — triggers and checks on `mock_tests`.** ACs 14, 15, 16. Second and third blocks of `gr.sql`.
Expected, exactly five triggers: `mock_tests_check` (BEFORE DELETE OR UPDATE, `private.check_mock_test()`),
`mock_tests_check_tags` (BEFORE INSERT OR UPDATE, `private.check_mock_test_tags()`),
`mock_tests_insert_released_needs_tags` (BEFORE INSERT, `WHEN ((new.status = 'released'::text))`,
`private.check_mock_test_release_tags()`), `mock_tests_release_needs_tags` (BEFORE UPDATE,
`WHEN (((old.status = 'draft'::text) AND (new.status = 'released'::text)))`, `private.check_mock_test_release_tags()`),
`mock_tests_set_updated_at`; each `tgenabled` `O`. Checks include
`mock_tests_any_year_alone|CHECK ((NOT (any_year AND (cardinality(year_levels) > 0))))`,
`mock_tests_closes_only_released|CHECK (((closes_at IS NULL) OR (status = 'released'::text)))` and
`mock_tests_year_levels_valid|CHECK (((year_levels <@ '{2,3,4,5,6,7,8,9,10,11,12}'::smallint[]) AND (array_ndims(year_levels) = 1) AND (array_lower(year_levels, 1) = 1)))`;
seven check lines in all.

**GR-3 — options table and column grants.** ACs 10, 11, 16, Part A/B limits. Fourth and fifth blocks of `gr.sql`,
plus the `colgrants` line of `dr-tags.sh`. Expected: `true|0` (RLS on, no policy); `0` grants to anon,
authenticated or PUBLIC on `private.mock_test_options`; the column grants of `authenticated` on `public.mock_tests`
are exactly INSERT and UPDATE on `any_year, instructions, stream, subject, title, year_levels` and SELECT on every
column; **no** INSERT or UPDATE on `status`, `closes_at`, `released_at`, `released_by`, `created_by`; nothing for anon
(the `colgrants` line quoted in TG-9).

### 2.2 Authorisation negatives

**AZ-1 — closing functions per role.** ACs 2, 3. `dr-az.sh` and `dr-reg.sh`. Expected: for each of `tutor@`,
`student@`, `parent@`, `user@` (aal1), `<e-mail> set|42501:not_admin` and `<e-mail> close|42501:not_admin`; from
`dr-reg.sh`, `aal1 close|42501:not_admin`, `aal1 set|42501:not_admin` (admin@ without two-step),
`anon close|42501:permission denied for function mock_close_now`, `anon set|42501:permission denied for function mock_set_closing`.
Admin@ at aal2 succeeds (CD-1 to CD-5).

**AZ-2 — tag writes per role.** ACs 15, 16. `dr-az.sh`. Expected: each of `tutor@`, `student@`, `parent@`,
`user@`: `<e-mail> upd|0` (RLS leaves no row to update, no error) and
`<e-mail> ins|42501:new row violates row-level security policy for table "mock_tests"`; `admin aal1 upd|0`;
`admin aal2 upd|1`; `anon ins|42501:permission denied for table mock_tests:Grant the required privileges to the current role with: GRANT INSERT ON public.mock_tests TO anon;`.

**AZ-3 — the admin can't read attempts; staff aren't takers; drafts stay hidden.** Lesson L-10. `dr-reg.sh`.
Expected: `admin attempts|42501:permission denied for table mock_test_attempts:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_attempts TO authenticated;`,
`tutor|42501:not_taker`, `admin as taker|42501:not_taker`, `draft|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}`,
`listdraft|0`. Every attempt count in this plan runs
as `postgres` for this reason.

### 2.3 Closing, admin side

**CD-1 — release with an optional closing date.** AC 1. `dr-closing.sh`, block 1, on a tagged draft with 2 questions.
Expected lines: `past|P0001:mock_closes_in_past`, `now|P0001:mock_closes_in_past` (now itself counts as closed),
`setdraft|P0001:invalid_status`, `closenowdraft|P0001:invalid_status` (a draft has no closing date), `future|ok`,
`st1|released|true|true` (closes_at equals the given time and is in the future), `again|P0001:invalid_status`.
Release with no date (`mock_release(X)` or `null`) leaves `closes_at` null: TG-1 `years|ok` then `st|released|…`,
and CD-2 `st3|null`.

**CD-2 — set, change and clear the date.** AC 2, 4. Same block. Expected: `change|ok`, `st2|t`,
`setpast|P0001:mock_closes_in_past`, `setnow|P0001:mock_closes_in_past`, `clear|ok`, `st3|null`,
`unknown|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}`.

**CD-3 — Close now, with a submitted attempt, and again.** AC 3, L-1. Block 2. Expected: `{"score": 0, "total": 2}`
(user@ submitted with no answer), `closenow|ok`, `st|true|true` (closes_at, stamped with `clock_timestamp()`, is at or after the transaction's start
and at or before the current time, so closed), `again|ok`, `kept|t` (the earlier closing
time is kept).

**CD-4 — reopen keeps an in-progress attempt as it was.** AC 4. Block 3 (student@ answered question 1 with option 2,
then the test closed). Expected: `closedlist|0`,
`closedsave|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}`, `reopen|ok`,
`list|in_progress`, `open|in_progress|2` (question 1 still shows option 2), `save2|ok`, `answers|2`.

**CD-5 — take-back on a closed test.** AC 7, 17. Block 4. Expected: closed with only parent@'s in-progress attempt:
`withdraw|ok`, `st|draft|null|0|maths|naplan|true` (draft, closing date cleared, attempts deleted, tags kept); closed
with parent@ submitted and student@ in progress: `{"score": 0, "total": 2}`, `withdraw|P0001:mock_has_attempts`,
`st|released|true|2` (unchanged).

**CD-6 — a closed test's questions stay frozen.** AC 6.3. `dr-closing.sh` block `CD-6`: a released test with
2 questions, closed with Close now, then admin@ at aal2 tries to add, edit and delete a question (the v1 question
trigger `private.check_mock_question`, `20261118100000_mock_tests.sql:179`). Expected: `qins|P0001:mock_released`,
`qupd|P0001:mock_released`, `qdel|P0001:mock_released`, `qcount|2` (unchanged, counted as postgres).

### 2.4 Closing, taker side (S-1)

`dr-s1.sh`: three released tests closed by admin@ with Close now. TA (`s1a`): student@, parent@ and user@ each
submitted (question 1 right: `{"score": 1, "total": 2}` three times). TB (`s1b`): each in progress with question 1
answered. TC (`s1c`): nobody started.

**TV-1 — a submitter still sees the closed test and their result, in each role.** AC 5.1. Expected for each of
`student@local.test`, `parent@local.test`, `user@local.test`:
`<e-mail> list|t7-<RUN>-s1a:submitted:true` (TA listed, closed; TB and TC absent);
`<e-mail> openA|submitted|1|2|1|1|Because B1.` (status, score, total, correct option, their option, explanation);
`<e-mail> startA|PGRST:{…not_found…}` and `<e-mail> submitA|PGRST:{…not_found…}` (can't start again; L-2).

**TV-2 — an in-progress taker doesn't see it, can't save or submit, in each role.** AC 5.2, 5.3. Expected for each
role: `<e-mail> openB|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}`,
`<e-mail> saveB|PGRST:{…}`, `<e-mail> submitB|PGRST:{…}` (same text each time).

**TV-3 — a taker who never started doesn't see it, in each role.** AC 5.2. Expected for each role:
`<e-mail> openC|PGRST:{…not_found…}`, `<e-mail> startC|PGRST:{…not_found…}`.

**TV-4 — never auto-submitted.** AC 5.3. Expected: `after B|null:1:1 null:1:1 null:1:1` (three attempts on TB, each
`submitted_at` null, one answer, option 1 kept).

**TV-5 — the boundary.** AC 8. `dr-s1.sh` last block: as postgres, `bd` gets `closes_at = now()` (the transaction's
start, so already past when the taker reads) and `bd1m` `closes_at = now() + 1 minute`. Expected: `list|t7-<RUN>-bd1m`
(only the one closing later), `startA|PGRST:{…not_found…}`, `startB|ok`.

**TV-6 — admins still see closed tests.** AC 6. Expected:
`admin list|t7-<RUN>-s1a:released:true:3 t7-<RUN>-s1b:released:true:0 t7-<RUN>-s1c:released:true:0`
(status, closed, submitted count).

### 2.5 Tags

**TG-1 — release refused until all three tags are set; check order.** AC 14. `dr-tags.sh` block 1. Expected:
`untagged|P0001:mock_tags_missing`, `zeroq|P0001:mock_no_questions` (an untagged draft with no questions reports the
questions first), `pastfirst|P0001:mock_closes_in_past` (a past date is reported before the tags),
`nosubject|P0001:mock_tags_missing`, `nostream|P0001:mock_tags_missing`, `noyears|P0001:mock_tags_missing`,
`years|ok`, `st|released|maths|naplan|{7,8}|false`. Any year alone counts as set: TG-4 `toany|ok` and the fixtures.

**TG-2 — the release trigger for every writer.** AC 14. Block 2. Expected:
`authstatus|42501:permission denied for table mock_tests:Grant the required privileges to the current role with: GRANT UPDATE ON public.mock_tests TO authenticated;`
(no grant on `status`), `pgdraftuntagged|P0001:mock_tags_missing` (table owner, untagged), `pgdrafttagged|ok`.

**TG-2b — an INSERT that is already released needs the tags too.** AC 14 ("every writer"; lead ruling on
review-6a #3, option (a): the release trigger is extended to INSERT and judges NEW). `dr-tags.sh` block `TG-2b`, as
postgres. Expected: `insrelnone|P0001:mock_tags_missing` (released row, no tags),
`insrelsub|P0001:mock_tags_missing` (released, stream and Any year but no subject), `insreltagged|ok`,
`insdraftnone|ok` (an untagged draft is still fine), `madeb|2`.

**TG-3 — the guard: only values from the current lists.** ACs 10, 11, 12, 16. Block 3, inserts as admin@ aal2.
Expected: `ok|ok`, `okyears|ok` (`verbal-reasoning`, `maths-science-english`, `{2,12}`), `untagged|ok` (a draft may
have no tags, AC 13), then `23514:invalid_mock_tag:subject` for `interview`, `unknownsub` (`chemistry`) and `label`
(`Maths`, a label, not a key); `23514:invalid_mock_tag:stream` for `ucat` and `interviews`;
`23514:invalid_mock_tag:year_levels` for `y1`, `y13`, `dup` (`{5,5}`), `desc` (`{6,5}`), `yany` (`{5}` with Any year),
`ynull` (`array[3,null]`), `y0based` (`[0:0]={7}`) and `y2d` (`{{7,8}}`); `23514:invalid_mock_tag:stream` also for
`vcesel` (`vce-subject-selection`, a programme that is not a stream, AC 11); `made|3` (only the three accepted rows exist).

**TG-4 — released and closed: change yes, clear no; content stays frozen; attempts untouched.** AC 15. Block 4 on X
(released, `maths|naplan|{5,6}|false`, closing in 5 days, user@ in progress with question 1 = option 2) and Y
(closed, `english|vce|{}|true`). Expected: `subj|ok`, `stream|ok`, `years|ok`, `toany|ok`,
`clrsub|23514:mock_tag_kept:subject`, `clrstream|23514:mock_tag_kept:stream`, `clryears|23514:mock_tag_kept:year_levels`,
`title|P0001:mock_released`, `instr|P0001:mock_released`, `badsub|23514:invalid_mock_tag:subject`; on the closed test
`csubj|ok`, `cyears|ok`, `cclrsub|23514:mock_tag_kept:subject`, `cclryears|23514:mock_tag_kept:year_levels`; then
`X|english|icas|{}|true|t7-<RUN>-rel|true` (title unchanged, closing time unchanged),
`Y|science|vce|{9,10,11}|false|true` (still closed), `attempt|1|2|1` (one attempt, answer still 2, still in progress).

**TG-5 — draft clear; take-back, close and reopen keep tags.** AC 13, 17. Block 5. Expected: `dclr|ok`,
`withdraw|ok`, `X|null|null|{}|false`, `Y|draft|reading|icas|{4,5}|false`, `Y2|released|reading|icas|{4,5}|false`
(after release with a date, Close now and clear).

**TG-6 — a released test made before this feature.** AC 18, 15. Block 6 on a `legacy` fixture. Expected:
`taker|t7-<RUN>-legacy|null|null|{}|false` (listed to student@ with no tags),
`open|{"stream": null, "subject": null, "any_year": false, "year_levels": []}`, `admin|null|null|{}|false`,
`closenow|ok`, `reopen|ok` (closing works on an untagged test), `s1|ok` (subject alone), `s2|ok` (years alone),
`s3|23514:mock_tag_kept:subject` (once set, not cleared), `L|reading|null|{3,5}|false`.

**TG-7 — a value switched off later.** AC 27. Block 7: as postgres in the transaction,
`update private.mock_test_options set active=false where kind='subject' and key='writing'`. X is a draft with
`writing`, Z a released test with `writing`, Y untagged. Expected: `keepdraft|ok` (X renamed and given another stream
while keeping `writing`), `keeprel|ok`, `other|23514:invalid_mock_tag:subject` (can't be set on Y),
`away|ok`, `back|23514:invalid_mock_tag:subject` (once changed, it can't come back), `X|maths|vce`, `Z|writing|naplan`.

**TG-8 — values not in the lists at all, held by a test.** AC 27. `dr-removed.sh` (fixture stores
`interview-preparation` and `old-stream` past the guard). Expected: `fx|interview-preparation|old-stream`,
`same|ok` (a save sending the same values passes), `years|ok`, `stream|ok` (to `naplan`),
`streamback|23514:invalid_mock_tag:stream`, `taker|interview-preparation|naplan|{8}`.

**TG-9 — no tag writes outside the admin.** AC 16, limits. `dr-tags.sh` block 8. Expected: `student|ok`, `tutor|ok`,
`adminaal1|ok` (each updates no row), `anon|42501:permission denied for table mock_tests:…`, `X|null`, and the
`colgrants|…` line exactly as quoted in the dry-run output of Appendix B.

### 2.6 Two-session checks (re-run of 05 Part B, plus two closing races)

Real concurrency through `cc` (background) and `wait`. Each row below writes its full A and B commands, with the
`pg_sleep` in each. Wall-clock values (`elapsed=`, timestamps) are **compare shape**: a number in the stated range or
a timestamp, never an exact value. Session A holds its locks with `pg_sleep(4)` after its write;
session B starts with `pg_sleep(1)`, so A is first. **B's elapsed time proves it waited** (expected 2.5 to 6 s); A's is
4 to 6 s. Each row builds its own fixture with `mk_test`, ends with `untagged_released` → `0` and `invariant` → `0`,
and removes its fixture by id:
`db "delete from public.mock_test_attempts where test_id='$X'; update public.mock_tests set status='draft', released_at=null, released_by=null, closes_at=null where id='$X'; delete from public.mock_tests where id='$X'"`.
Never run two TS rows at once. Paste the raw `cc-*.txt` lines into the TSR (AC 14 needs the transcript, 04 DoD 11).
`dr-cc.sh` ran each pair one after the other inside a rollback, which proves the SQL and the final error; only the
real run proves the wait.

```sh
export S=…; . "$S/t7.sh"
X=$(mk_test <label> 1 <draft|released>)
cc A <person A> <aal> "<A's write>; select pg_sleep(4)"     # person: admin@local.test aal2, user@local.test aal1, or postgres
cc B <person B> <aal> "select pg_sleep(1); <B's write>"
wait; cat "$S/cc-A.txt" "$S/cc-B.txt"; state_of "$X"; tags_of "$X"; untagged_released; invariant
```

**TS-1 — order A: release first, then a clear.** AC 14, 15. `X=$(mk_test tsa 1 draft)`. A (admin@):
`select public.mock_release('$X')`; B (admin@): `update public.mock_tests set subject=null where id='$X'`.
`cc A admin@local.test aal2 "select public.mock_release('$X'); select pg_sleep(4)"`;
`cc B admin@local.test aal2 "select pg_sleep(1); update public.mock_tests set subject=null where id='$X'"`.
Expected: A `A||elapsed=` 4 to 6; B `B|ERROR:  mock_tag_kept;HINT:  subject|elapsed=` 2.5 to 6;
`tags_of` → `maths|naplan|{}|true`; status `released`.

**TS-2 — order B: a clear first, then release.** AC 14. `X=$(mk_test tsb 1 draft)`.
`cc A admin@local.test aal2 "update public.mock_tests set subject=null where id='$X'; select pg_sleep(4)"`;
`cc B admin@local.test aal2 "select pg_sleep(1); select public.mock_release('$X')"`. Expected: B `ERROR:  mock_tags_missing` after waiting; `tags_of` → `null|naplan|{}|true`; status `draft`.

**TS-3 — order C: a clear first, then a direct release by the table owner.** AC 14. `X=$(mk_test tsc 1 draft)`.
`cc A admin@local.test aal2 "update public.mock_tests set subject=null where id='$X'; select pg_sleep(4)"`;
`cc B postgres - "select pg_sleep(1); update public.mock_tests set status='released', released_at=now() where id='$X'"`.
Expected: B `ERROR:  mock_tags_missing` after waiting; status `draft`; subject `null`.

**TS-4 — order C mirror: a direct release first, then a clear.** AC 14, 15. `X=$(mk_test tscm 1 draft)`.
`cc A postgres - "update public.mock_tests set status='released', released_at=now() where id='$X'; select pg_sleep(4)"`;
`cc B admin@local.test aal2 "select pg_sleep(1); update public.mock_tests set subject=null where id='$X'"`. Expected: B `ERROR:  mock_tag_kept;HINT:  subject` after
waiting; status `released`; `tags_of` → `maths|naplan|{}|true`.

**TS-5 — Close now holds, a save waits and is refused.** AC 5.3, 8. `X=$(mk_test tsd 2 released)`, then
`take user@local.test $X in_progress`; `Q2=$(qids $X | cut -d' ' -f2)`.
`cc A admin@local.test aal2 "select public.mock_close_now('$X'); select pg_sleep(4)"`;
`cc B user@local.test aal1 "select pg_sleep(1); select public.mock_save_answer('$X', '$Q2', 0)"`.
Expected: B `ERROR:  {"code":"P0002","message":"not_found","details":null,"hint":null}` after waiting; the attempt
stays in progress with one answer (`db "select count(*)||'|'||bool_and(a.submitted_at is null) from public.mock_test_answers ans join public.mock_test_attempts a on a.id=ans.attempt_id where a.test_id='$X'"` → `1|t`).

**TS-6 — a submit holds, Close now waits, the submitter keeps the result.** AC 3, 5.1. `X=$(mk_test tse 2 released)`,
then `take user@local.test $X in_progress`.
`cc A user@local.test aal1 "select public.mock_submit('$X'); select pg_sleep(4)"`;
`cc B admin@local.test aal2 "select pg_sleep(1); select public.mock_close_now('$X')"`. Expected: A `{"score": 1, "total": 2}`; B no error after
waiting; `state_of` → `released|<ts>|true`; `as_user user@local.test aal1 "select title||'|'||status from public.mock_tests_for_me() where id='$X'"` → `t7-<RUN>-tse|submitted`.

**TS-7 — a submit that began before Close now, and waited on it, is refused.** AC 5.3, 8 (review-5 #2, fix batch 1).
`X=$(mk_test tsf 2 released); take user@local.test $X in_progress`. Launch B first, then A one second later:
`cc B user@local.test aal1 "select pg_sleep(3); select public.mock_submit('$X')"`;
`python3 -I -c 'import time; time.sleep(1)'`;
`cc A admin@local.test aal2 "select public.mock_close_now('$X'); select pg_sleep(4)"`; `wait`.
B's transaction starts before A's close and its submit reaches the row while A holds it. (here B sleeps 3 s and A 4 s, by design). Expected: A no error;
B `ERROR:  {"code":"P0002","message":"not_found","details":null,"hint":null}`, B elapsed 4.5 to 7 s; TS-5's answer
query → `1|t` (not submitted); `as_user user@local.test aal1 "select count(*) from public.mock_tests_for_me() where id='$X'"` → `0`.
This is review-5 #2, fixed in `e947687` (`clock_timestamp()`); a `{"score": 1, "total": 2}` from B is a FAIL.

### 2.7 Through PostgREST (commits; Sitting 1, after TS)

Fixtures: `HX=$(mk_test hx 2 released)`, `HY=$(mk_test hy 2 released)`; `take user@local.test $HX in_progress`;
`take user@local.test $HY submitted`; `close_now $HX; close_now $HY`; `tok user@local.test; tok parent@local.test`.
Removed by CL-1.

**H-1 — the taker's calls after closing, by HTTP status.** AC 5, 8 (L-8: not_found is 404). Calls with `rest POST user@local.test rpc/<fn> '<json>'`:
`mock_save_answer {"target_test":"$HX","target_question":"<HX q1>","chosen_option":0}`, `mock_submit {"target":"$HX"}`,
`mock_test_open {"target":"$HX"}`, `mock_start {"target":"$HY"}` → each
`404 {"code":"P0002","message":"not_found","details":null,"hint":null}`; `mock_test_open {"target":"$HY"}` → `200`
with `status` `submitted`, `score` `1`, `total` `2`, `closes_at` not null, and `tags` holding subject `maths`,
stream `naplan`, year_levels `[]`, any_year `true`;
`mock_tests_for_me {}` → `200`, the t7 titles are exactly `t7-<RUN>-hy`. A 500 is a bug.

**H-2 — tag writes through PostgREST by non-admins.** AC 16. `rest PATCH parent@local.test "mock_tests?id=eq.$HX" '{"subject":"english"}'`
→ `200 []`; `rest PATCH anon "mock_tests?id=eq.$HX" '{"subject":"english"}'` → `401` with `"code":"42501"`; then
`tags_of $HX` → `maths|naplan|{}|true`.

---

## 3. Browser rows (Sittings 3 and 4, tester-ui)

Viewport 1280×800 and light unless a row says otherwise. Taker rows use the three taker accounts as stated. Select
controls are MUI selects: reach each by its label (`getByRole('combobox', { name })`), open it, and read the options
(`getByRole('option')` texts in order).

### 3.1 Filters (Sitting 3, first)

Fixtures, built in this order and saved to `$S/fx3.env` (dry-run `dr-fx3.sh`):
1. none yet (BF-1);
2. `F5=$(mk_test f5 2 released 'reading|icas|{5}|false'); close_now $F5` (closed, nobody submitted) (BF-2);
3. `F1=$(mk_test f1 2 released 'maths|naplan|{3,5}|false')`, `F2=$(mk_test f2 2 released 'english|naplan|{}|true')`,
   `F3=$(mk_test f3 2 released 'maths|selective-entry|{6}|false')`,
   `F4=$(mk_test f4 2 released 'science|vce|{11,12}|false'); take user@local.test $F4 submitted; close_now $F4`,
   `FL=$(mk_test legacy-f 2 legacy none)` (then the trigger line of §0.2 → both `:O`), `FD=$(mk_test fd 1 draft)`.
user@'s visible set is then exactly F1, F2, F3, F4 (closed, submitted) and FL: **5 cards**. F5 and FD are never shown.

**BF-1 — nothing to see at all.** AC 22a. Account: user@. Pre: `db "select count(*) from public.mock_tests where status='released'"` → `0`.
Expected on `/portal/user/mock-tests`: h1 `Mock tests`, intro `Free practice. You get one go at each mock test.`, text
`No mock tests yet.`; no element `section[aria-label="Filter mock tests"]`; no combobox; no `Clear filters`.

**BF-2 — only a closed test the person never submitted.** AC 22a, 5.2. Account: user@, after fixture 2. Expected: as
BF-1 (`No mock tests yet.`, no filter section); `t7-<RUN>-f5` is not on the page.

**BF-3 — all on All: every visible test, with its tags.** AC 18, 21, 23, 5.1. Account: user@, after fixture 3.
Expected: the filter section with three comboboxes, each showing `All`; exactly 5 cards, titles `t7-<RUN>-f1`, `-f2`,
`-f3`, `-f4`, `-legacy-f`, in the order `legacy-f, f4, f3, f2, f1` (newest release first); each card shows its tag line:
f1 `Subject: Maths` `Stream: NAPLAN` `Year level: Years 3, 5`; f2 `Subject: English` `Stream: NAPLAN` `Year level: Any year`;
f3 `Subject: Maths` `Stream: Selective Entry Exam` `Year level: Year 6`; f4 `Subject: Science` `Stream: VCE Tutoring`
`Year level: Years 11, 12` with chips `Submitted` and `Closed`, text `1 of 2 correct` and button `View result`;
legacy-f `Subject: Not set` `Stream: Not set` `Year level: Not set`. No `-f5`, no `-fd`.

**BF-4 — labels and choices.** AC 19, 27. Account: user@. Expected: the three comboboxes are named, in this order,
`Stream`, `Subject`, `Year level`. Options (items separated by `;`): Stream `All; VCE Tutoring; NAPLAN; Selective Entry Exam; SEAL and Scholarships; ICAS; Maths, Science and English`
(7); Subject `All; Maths; English; Science; Reading; Writing; Numerical reasoning; Verbal reasoning` (8, no
`Interview preparation`); Year level `All; Year 2; Year 3; …; Year 12` (12, no `Any year`, no `Other (e.g. UCAT, GAMSAT)`).

**BF-5 — AND, and the year rule.** AC 20, 18, 5.1. Account: user@. Set each combination from All, reading the card
titles (without `t7-<RUN>-`):

| Stream | Subject | Year level | Cards |
|---|---|---|---|
| NAPLAN | All | All | f1, f2 |
| All | Maths | All | f1, f3 |
| NAPLAN | Maths | All | f1 |
| All | All | Year 5 | f1, f2 |
| All | All | Year 6 | f2, f3 |
| All | All | Year 12 | f2, f4 |
| VCE Tutoring | All | All | f4 |
| Selective Entry Exam | Maths | Year 6 | f3 |

Expected: exactly those cards per line; `legacy-f` never appears with any filter set; f4 keeps its `Closed` chip.

**BF-6 — no match, and Clear filters.** AC 22b. Account: user@. Set Subject `Writing`. Expected: text
`No mock tests match these filters.` and an outlined button `Clear filters`; no card; no element with `role="alert"`;
the text colour is the secondary text colour (not the error colour); the page text has no `Error`, `null`,
`undefined` or `[object`. Press `Clear filters`: all three show `All`, 5 cards again, and focus is on the h1 `Mock tests`
(`document.activeElement` is the `H1`; review-5 #3).

**BF-7 — page state only: reload resets, nothing is sent.** AC 24, 25. Account: user@. Record requests to
`/rest/v1/` from the first filter change to the last. Steps: set Stream `NAPLAN` and Year level `Year 5` (2 cards:
f1, f2), read `location.search`; reload. Expected: `location.search` is `''` before and after; no `/rest/v1/` request
during the filter changes (0); after the reload all three show `All` and 5 cards.

**BF-8 — the other two roles.** AC 20, 21, 25. Accounts: student@ and parent@. Expected: each sees exactly 4 cards
(f1, f2, f3, legacy-f; f4 is closed and they never submitted it); Year level `Year 12` → f2 only; Stream `VCE Tutoring`
→ `No mock tests match these filters.` and `Clear filters`.

### 3.2 Closing, admin (Sitting 3)

Fixtures: `BC1=$(mk_test bc1 1 draft)` (tagged draft), `BC1B=$(mk_test bc1b 1 draft)`,
`BS1=$(mk_test s1 2 released 'english|vce|{11,12}|false')`, `BS2=$(mk_test s2 2 released 'science|icas|{5}|false')`,
`BS3=$(mk_test s3 2 released 'reading|naplan|{}|true')`, then the journeys: BS1 student@ submitted, parent@
in_progress; BS2 parent@ submitted, user@ in_progress; BS3 user@ submitted, student@ in_progress. (Each role:
submitted on one, in progress on one, never started on the third.) Account admin@ unless stated.

**BC-1 — release with a closing date, and without.** AC 1, 9. On BC1's page: `Release` → dialog `Release this mock test?`
with text `Students, parents and signed-up users will be able to take it free of cost. Questions and details can’t be changed after this.`,
`Takers filter mock tests by these, so set them before releasing.`, the three tag selects showing `Maths`, `NAPLAN`,
`Any year`, and the field `Closes (optional)` with hint `Leave empty and it never closes. Times are in your local time.`
Type a date two days ahead at 10:30 am (record the field's format and what was typed), press `Release`.
Expected: status `Released. People can take it now.`; focus on the h1; chips `Released`; bold line
`Closes <formatted>` (§0.1 Dates, from `closes_at`);
`db "select to_char(closes_at at time zone 'Australia/Melbourne', 'YYYY-MM-DD HH24:MI') from public.mock_tests where id='$BC1'"` →
the typed date at `10:30`. BC1B: release with the field empty → no `Closes`/`Closed` line; `state_of $BC1B` → `released|null|false`.

**BC-2 — a past or half-typed date is refused in the dialog.** AC 1, 2. On a fresh `mk_test bc2 1 draft`: open
Release, type yesterday's date at 10:30 am, press `Release`. Expected: helper text under the field
`The closing date and time must be in the future.`; dialog stays; no request to `rpc/mock_release`; `state_of` →
`draft|null|false`. Then clear the field and type only the day: `Enter a full date and time, or leave it empty.`; no
request. Close the dialog (Cancel). BC2 stays a draft for CL-1.

**BC-3 — set, change and clear the closing date.** AC 2, 4, 5.1, 9. On BC1 (released, closing in two days): `Set closing date`
→ dialog `Set closing date`, the field shows the saved time. Change to three days ahead
at 9:00 am, `Save`. Expected: the dialog text is exactly
`From this time, people who haven’t submitted it can’t see or take this mock test, and anyone part-way through can’t finish. People who submitted it still see their result. Clear the date or pick a later one to open it again.`;
after `Save`: `Closing date saved.`; `Closes <new formatted>`; focus back on `Set closing date`;
database time = the typed one. Then a past date → `The closing date and time must be in the future.`, no request to
`rpc/mock_set_closing`. Then `Clear closing date`, `Save` → `Closing date cleared. It never closes.`; no Closes line;
`state_of $BC1` → `released|null|false`.

**BC-4 — the admin list shows closing dates and tags.** AC 6, 9, 28. Runs after BC-5. First re-set BC1's closing
date to two days ahead at 10:30 am with `Set closing date` (BC-8 uses it). On `/portal/admin/mock-tests`:
BS1's Status cell has chips `Released` and `Closed` and the line `Closed <formatted>`; BC1 shows `Closes <formatted>` and no Closed chip; BC1B shows neither
line; drafts show `Draft`. The Tags column header is `Tags`, between `Status` and `Questions`.

**BC-5 — Close now.** AC 3, 5.1, 6. On BS1 (student@ has submitted): `Close now` → confirm dialog `Close this mock test now?`
with the text exactly
`People who haven’t submitted it won’t see it any more, and anyone part-way through can’t finish. People who submitted it still see their result. You can open it again with Set closing date.`;
press `Close now`. Expected: `Closed. Only people who submitted it can still see their result.`; focus on the h1; chip
`Closed`; line `Closed <formatted>`; the `Close now` button is gone; `Edit tags`, `Set closing date` and
`Take back to draft` remain; the questions show `This mock test is released, so its questions can’t change.` and no
edit controls; `state_of $BS1` → `released|<ts>|true`. Then close BS2 and BS3 with `close_now` (fixture).

**BC-6 — reopen.** AC 4. After BS-1 to BS-5. On BS1: `Set closing date` → `Clear closing date` → `Save`.
Expected: `Closing date cleared. It never closes.`; no Closed chip; `Close now` is back. As parent@ (in progress on
BS1): the card is back with `In progress` and `Continue`; the take page shows question 1 with their saved answer
selected (B); choose B on question 2, `Submit`, confirm → `2 of 2 correct`. On BS2 set a closing date one
day ahead → user@ (in progress) sees BS2 again with `Continue`.

**BC-7 — take-back on a closed test.** AC 7, 17. Fixture `BC7=$(mk_test bc7 2 released 'maths|icas|{7}|false'); take student@local.test $BC7 in_progress; close_now $BC7`.
On BC7: `Take back to draft` → confirm `Take this mock test back to draft?` → `Take back to draft`. Expected:
`Back to draft.`; chip `Draft`; Tags card `Subject: Maths` `Stream: ICAS` `Year level: Year 7`; `state_of $BC7` →
`draft|null|false`; attempts (as postgres) → `0`. On BS3 (closed, user@ submitted): the same steps → alert
`Someone has already submitted this mock test, so it can’t go back to draft.`; `state_of $BS3` → `released|<ts>|true`.

**BC-8 — the viewer's local time.** AC 9. BC1 with a closing date two days ahead at 10:30 am Melbourne: open its admin
page in a context with `timezoneId: 'UTC'`. Expected: the line equals the §0.1 formatting in UTC and differs from the
Melbourne text by the offset (11 hours on that date, AEDT); no time-zone setting on the page.

### 3.3 Closing, taker (Sitting 3, after BC-5)

**BS-1 — a submitter sees the closed test and their result, in each role.** AC 5.1, 23. student@ (BS1), parent@
(BS2), user@ (BS3). Expected on each list: the card with chips `Submitted` and `Closed`, `1 of 2 correct`, its tag
line, and an outlined `View result`; pressing it opens the result: `Your result`, `1 of 2 correct`; question 1
`Your answer: B. B1`, `Correct answer: B. B1`, `Explanation: Because B1.`; question 2 `Your answer: No answer.`,
`Correct answer: B. B2`, no explanation line; no `Start`, `Continue` or `Submit` button.

**BS-2 — an unsubmitted taker doesn't see it, in each role.** AC 5.2. student@: BS3 (in progress) and BS2 (never
started); parent@: BS1 and BS3; user@: BS2 and BS1. Expected: those titles are not on the list; a direct link
`/portal/<area>/mock-tests/<id>` shows heading `Not found` and `This page doesn't exist, or you don't have access to it.`;
no `Start` or `Continue`; the `rpc/mock_test_open` response status is `404`.

**BS-3 — the take page open across the close.** AC 5.3, 8. Fixture `BT3=$(mk_test bt3 2 released); take user@local.test $BT3 in_progress`.
user@ opens BT3's take page (question 1 shown). Then `close_now $BT3`. Choose an option on question 2. Expected:
`Not saved` next to it and the alert `We couldn't find that. It may have been removed, or you may not have access.`;
`rpc/mock_save_answer` → `404`. Press `Submit`, confirm. Expected: the same alert text; `rpc/mock_submit` → `404`;
the database attempt is still in progress with one answer (TS-5's query → `1|t`).

**BS-4 — the list or intro open across the close.** AC 8. Fixtures `BT4=$(mk_test bt4 2 released)`,
`BT4B=$(mk_test bt4b 2 released)`. student@ opens the list (BT4 and BT4B shown, `Not started`) and, in a second tab,
BT4B's intro. `close_now $BT4; close_now $BT4B`. On the list press BT4's `Start`. Expected: the take page shows
`Not found`. On the intro tab press `Start`. Expected: alert `We couldn't find that. It may have been removed, or you may not have access.`;
`rpc/mock_start` → `404`; attempts on BT4B (postgres) → `0`.

**BS-5 — the boundary in real time.** AC 8. Fixture `BT5=$(mk_test bt5 2 released)`, then as postgres
`db "update public.mock_tests set closes_at = now() + interval '60 seconds' where id='$BT5'"`. user@ opens the list:
BT5 shown. Wait until `db "select closes_at <= now() from public.mock_tests where id='$BT5'"` → `t`, plus 5 s; reload.
Expected: BT5 is gone; its direct link shows `Not found`.

### 3.4 Tags, admin (Sitting 3)

**BG-1 — the New mock test dialog offers the lists.** AC 10, 11, 12, 13. `New mock test`. Expected: fields `Title`,
`Instructions (optional)`, `Subject`, `Stream`, `Year level`; Subject and Stream boxes show `Not set`, Year level
shows `Not set` with helper `Choose one or more years, or Any year.`. Options (items separated by `;`): Subject
`Not set; Maths; English; Science; Reading; Writing; Numerical reasoning; Verbal reasoning` (8); Stream
`Not set; VCE Tutoring; NAPLAN; Selective Entry Exam; SEAL and Scholarships; ICAS; Maths, Science and English` (7);
Year level `Any year; Year 2; …; Year 12` (12, each with a checkbox; no `Other (e.g. UCAT, GAMSAT)`).

**BG-2 — Any year and years exclude each other.** AC 12. Same dialog, Year level menu, in turn: tick Year 5 → box
`Year 5`; tick Year 7 → `Years 5, 7`; tick Year 6 → `Years 5–7` (en dash); tick Any year → `Any year`, the Year 5, 6, 7
boxes unticked; tick Year 3 → `Year 3`, Any year unticked; untick Year 3 → `Not set`.

**BG-3 — a draft saves with no tags.** AC 13, 14 hint. Title `t7-<RUN>-ui1`, no tags, `Create mock test`. Expected:
the edit page, chip `Draft`; Tags card `Subject: Not set` `Stream: Not set` `Year level: Not set` (before
Instructions); hints `Add at least one question to release this mock test.` and
`Set the subject, stream and year level to release this mock test.`; `Release` disabled (no questions);
`db "select coalesce(subject,'null')||'|'||coalesce(stream,'null')||'|'||year_levels::text||'|'||any_year from public.mock_tests where title='t7-$RUN-ui1'"`
→ `null|null|{}|false`.

**BG-4 — tags set, changed and cleared on a draft.** AC 13. On ui1: `Edit details` → Subject Maths, Stream NAPLAN,
Year level Years 5–7, `Save`. Expected: `Details saved.`; card `Subject: Maths` `Stream: NAPLAN` `Year level: Years 5–7`;
database `maths|naplan|{5,6,7}|false`; only the hints for questions remain. `Edit details` → Subject `Not set`,
`Save` → database `null|naplan|{5,6,7}|false`; hint `Set the subject to release this mock test.`.

**BG-5 — release is refused until tagged.** AC 14. Fixture `UI2=$(mk_test ui2 1 draft none)`. Expected on its page:
`Release` enabled (it has a question). This is the design §0.2 / 04-plan 7b.1 [ASSUMPTION], ruled by the lead for
F-3: the button stays enabled and the dialog refuses; the TSR carries it as an [ASSUMPTION] for Saurabh's staging check; hint `Set the subject, stream and year level to release this mock test.`.
`Release` → the dialog's three selects show `Not set`, and the Subject and Stream menus have a disabled `Not set`
item. Press `Release`. Expected: helper texts `Please choose a subject.`, `Please choose a stream.`,
`Please choose one or more years, or Any year.`; dialog stays; no request to `mock_tests?` (PATCH) or
`rpc/mock_release`; `state_of $UI2` → `draft|null|false`. Set Science, ICAS, Year 4, `Release`. Expected:
`Released. People can take it now.`; focus on the h1; card `Subject: Science` `Stream: ICAS` `Year level: Year 4`;
`tags_of $UI2` → `science|icas|{4}|false`; status `released`.

**BG-6 — a value the database refuses (list drift).** AC 16. On UI2 (released): as postgres
`db "update private.mock_test_options set active=false where kind='subject' and key='writing'"`. `Edit tags` →
Subject `Writing`, `Save`. Expected: the dialog's alert `That subject isn’t on the list. Please choose another.`
(no raw database text, design decision 6); dialog stays; `tags_of $UI2` → `science|icas|{4}|false`. Restore in the
same row: `db "update private.mock_test_options set active=true where kind='subject' and key='writing'"`, then S-0's
options line → identical.

**BG-7 — Edit tags on a released test.** AC 15. Fixture `BG7=$(mk_test bg7 2 released 'maths|naplan|{5,6}|false'); take user@local.test $BG7 in_progress`.
On BG7: buttons `Edit tags`, `Set closing date`, `Close now`, `Take back to draft`; no `Edit details`. `Edit tags` →
dialog `Edit tags`; Subject and Stream menus have no `Not set` item. Change Subject to English, Year level to Any year,
`Save`. Expected: `Tags saved.`; focus back on `Edit tags`; card `Subject: English` `Stream: NAPLAN` `Year level: Any year`;
`tags_of $BG7` → `english|naplan|{}|true`; title and instructions unchanged; questions unchanged
(`qids $BG7` equal before and after); attempts (postgres) still `1`, in progress, one answer. Then try to clear the
years: `Edit tags` → in Year level untick Any year. Expected (AC 15, design §5.1, review-5 #5): the pick is ignored,
the box still shows `Any year` and its item stays ticked; ticking Year 8 → `Year 8` with Any year unticked, and
unticking Year 8 is ignored (box `Year 8`). `Cancel`; no PATCH request was sent; `tags_of` unchanged.

**BG-8 — Edit tags on a closed test.** AC 15. On BS3 (closed): `Edit tags` → Stream `ICAS`, `Save`. Expected:
`Tags saved.`; `tags_of $BS3` → `reading|icas|{}|true`; `state_of $BS3` still closed with the same `closes_at`.

**BG-9 — an old untagged released test.** AC 18, 15, 28. On FL (`legacy-f`). Expected: the admin list row's Tags
cell reads, one per line, `Subject: Not set`, `Stream: Not set`, `Year level: Not set`; the edit page's Tags card the
same; `Edit tags` → Subject and Stream show `Not set` (a disabled item), Year level `Not set`; `Save` with nothing
changed → `Tags saved.` (an unset tag may stay unset); then Subject `Reading` only, `Save` →
`tags_of $FL` → `reading|null|{}|false`; as user@ the card reads `Subject: Reading` `Stream: Not set` `Year level: Not set`.

**BG-10 — values no longer offered.** AC 27. Fixture `RV=$(mk_test rv 2 released)`, then as postgres in one
statement block: `db "begin; set local session_replication_role = replica; update public.mock_tests set subject='interview-preparation', stream='old-stream' where id='$RV'; commit;"`
(dry-run `dr-removed.sh`). Expected: admin list and edit card `Subject: Interview preparation` (saved label)
`Stream: old-stream` (no label: its key) `Year level: Any year`; `Edit tags`: Subject box
`Interview preparation (no longer offered)`, a disabled option; Stream box `old-stream (no longer offered)`, disabled;
`Save` unchanged → `Tags saved.`, `tags_of` unchanged; Stream → NAPLAN, `Save` → `interview-preparation|naplan|{}|true`;
reopening Edit tags, the Stream menu has no `old-stream` item. As user@: the card reads
`Subject: Interview preparation`, and BF-4's option lists are unchanged (no `Interview preparation`, no `old-stream`).

**BG-11 — take-back keeps the tags.** AC 17. Fixture `BG11=$(mk_test bg11 2 released 'english|seal-and-scholarships|{9}|false'); take student@local.test $BG11 in_progress`.
`Take back to draft` → confirm. Expected: `Back to draft.`; card `Subject: English` `Stream: SEAL and Scholarships`
`Year level: Year 9`; `tags_of` → `english|seal-and-scholarships|{9}|false`; attempts (postgres) `0`.

**BG-12 — the admin list: a Tags column and no filter.** AC 28. Expected: headers in order `Title, Status, Tags,
Questions, Submitted, Created by, Last changed`; every row's Tags cell has three lines; `getAllByRole('combobox')` on
the list page → 0; no `Filter mock tests` section.

### 3.5 Keyboard (Sitting 4)

**BK-1 — admin dialogs by keyboard.** AC 26. Account admin@ on a draft with a question, a released test, and a closed
test. Expected: Tab reaches `Edit details`/`Release`/`Delete draft` (draft) and `Edit tags`, `Set closing date`,
`Close now` (open only), `Take back to draft` (released) in visual order; each opens by Enter or Space; inside, each
tag select opens with Enter, Space or ArrowDown, ArrowDown/ArrowUp move, Enter chooses; in Year level, Space toggles an
item and Escape closes the menu with focus back on the select; Escape closes a dialog with focus on its opener; the
closing field takes typed digits section by section. After Release and after Close now focus is on the h1; after Edit
tags and Set closing date it is on that button; after Take back to draft (`k-tb`) it is on the h1 (review-5 #4). Focus is visible on every stop (outline or ring with non-zero width).
A focus that lands on `body` is a FAIL.

**BK-2 — the filter bar by keyboard.** AC 22b, 26. Account user@ with BF's fixtures. Expected: after the header and
nav, Tab reaches `Stream`, `Subject`, `Year level` in that order; each opens with Enter, Space or ArrowDown and chooses
with Enter; the list updates; with a no-match filter Tab reaches `Clear filters` and Enter clears; afterwards
`document.activeElement` is the h1 `Mock tests` (review-5 #3), and the next Tab moves on into the page in order.

**BK-3 — names and roles.** AC 19, 26. Expected: `getByRole('combobox', { name: 'Stream' | 'Subject' | 'Year level' })`
each resolves once on the taker list and in the New mock test dialog; the filter section has `aria-label`
`Filter mock tests`; each tag line is plain text (no button or link role).

### 3.6 Widths and appearance (Sitting 4)

For each page or dialog, at 375×800 and 1280×800, light and dark (Playwright `colorScheme`, and the header toggle
`Switch to dark mode` once to confirm it agrees), record:
`document.documentElement.scrollWidth - document.documentElement.clientWidth` → `0`;
`document.documentElement.getAttribute('data-portal-theme')` → `light` / `dark`;
`getComputedStyle(document.body).backgroundColor` → `rgb(255, 255, 255)` light / `rgb(11, 18, 32)` dark; console
errors `0`. Screenshot each (`run-*/shots/<row>-<page>-<width>-<theme>.png`).

**BR-1 — admin pages and dialogs.** AC 26. Six pages (§3.6a titles): 1. the list (with `k-closed`, `k-later`,
`legacy-f`, `k-rv` and the 150-character title `L`); 2. `k-closed`'s edit page; 3. the Release dialog on `k-draft`
with the tags and the date picker's popup open; 4. the Edit tags dialog on `k-later` with the Year level menu open;
5. Set closing date on `k-later`; 6. the Close now confirm on `k-later`. Check `L` first:
`db "select char_length(title)||'|'||status from public.mock_tests where id='$L'"` → `150|released`.
6 × 2 widths × 2 themes = 24 measurements, all `0`; the table may scroll inside its own container (record `TableContainer` `scrollWidth > clientWidth`).

**BR-2 — taker pages.** AC 26. Account user@. Pages: the empty state (measured first in Sitting 4, before §3.6a's
block, when no released test exists); then the list on All (§3.6a's set: 10 cards, `t7-<RUN>-` + `long`'s title,
`k-rv`, `k-tb`, `k-later`, `r6b`, `legacy-f`, `f4`, `f3`, `f2`, `f1`); the no-match state (Subject `Writing`);
`f4`'s closed result page; the Not found page (`fd`'s link). 5 × 2 × 2 = 20 measurements, all `0`.

**BR-3 — the filter bar's layout.** AC 26. Account user@. At 375: the three selects stack (each `top` greater than the
previous; widths equal the section's). At 1280: one row (the same `top`, `left` increasing). Both themes; overflow `0`.

### 3.6a Sitting 4 fixtures (committed; dry-run `dr-fx4.sh`)

Built after S-0 and BR-2's empty-state page, saved to `$S/fx4.env`, removed by Sitting 4's CL-1. Rows name these
titles (all `t7-<RUN>-<label>` except `L`):

```sh
export S=…; . "$S/t7.sh"
F5=$(mk_test f5 2 released 'reading|icas|{5}|false'); close_now $F5                       # BK-2, BF set
F1=$(mk_test f1 2 released 'maths|naplan|{3,5}|false')                                     # BK-2, BR-2, R-2
F2=$(mk_test f2 2 released 'english|naplan|{}|true')                                       # BK-2, BR-2
F3=$(mk_test f3 2 released 'maths|selective-entry|{6}|false')                              # BK-2, BR-2
F4=$(mk_test f4 2 released 'science|vce|{11,12}|false'); take user@local.test $F4 submitted; close_now $F4   # BR-2 result
FL=$(mk_test legacy-f 2 legacy none)                                                       # BR-1, BR-2
db "select tgname||':'||tgenabled::text from pg_trigger where tgname in ('mock_tests_release_needs_tags','mock_tests_insert_released_needs_tags') order by 1" | paste -sd' ' -   # both :O
FD=$(mk_test fd 1 draft)                                                                   # BR-2 Not found, R-7
UI1=$(mk_test ui1 0 draft none)                                                            # R-3
R6B=$(mk_test r6b 2 released); take user@local.test $R6B submitted                         # R-6
KD=$(mk_test k-draft 1 draft)                                                              # BK-1, BR-1 page 3
KL=$(mk_test k-later 2 released); db "update public.mock_tests set closes_at = now() + interval '2 days' where id='$KL'"   # BK-1, BR-1 pages 4-6
KC=$(mk_test k-closed 2 released 'english|vce|{11,12}|false'); take student@local.test $KC submitted; close_now $KC         # BK-1, BR-1 page 2
KT=$(mk_test k-tb 2 released); take student@local.test $KT in_progress                      # BK-1 take-back focus
KR=$(mk_test k-rv 2 released); db "begin; set local session_replication_role = replica; update public.mock_tests set subject='interview-preparation', stream='old-stream' where id='$KR'; commit;"   # BR-1
L=$(mk_test long 2 draft); db "update public.mock_tests set title=repeat('w', 150 - length('-$RUN'))||'-$RUN' where id='$L'"; db "update public.mock_tests set status='released', released_at=now(), released_by=created_by where id='$L'"   # BR-1 (renamed while a draft: the v1 freeze trigger refuses renaming a released test)
for v in F5 F1 F2 F3 F4 FL FD UI1 R6B KD KL KC KT KR L; do eval "echo $v=\$$v"; done > "$S/fx4.env"
db "select count(*) from public.mock_tests where title like 't7-%' or title like 'w%-$RUN'"
```

Expected: the last line `15`; `db "select string_agg(title||':'||status||':'||coalesce(closes_at <= clock_timestamp(), false), ' ' order by title) from public.mock_tests where title like 't7-%'"`
→ `t7-<RUN>-f1:released:false t7-<RUN>-f2:released:false t7-<RUN>-f3:released:false t7-<RUN>-f4:released:true t7-<RUN>-f5:released:true t7-<RUN>-fd:draft:false t7-<RUN>-k-closed:released:true t7-<RUN>-k-draft:draft:false t7-<RUN>-k-later:released:false t7-<RUN>-k-rv:released:false t7-<RUN>-k-tb:released:false t7-<RUN>-legacy-f:released:false t7-<RUN>-r6b:released:false t7-<RUN>-ui1:draft:false`
(14 t7 tests plus `L`); the trigger line `mock_tests_insert_released_needs_tags:O mock_tests_release_needs_tags:O`;
`as_user user@local.test aal1 "select count(*) from public.mock_tests_for_me() where title like 't7-%' or title like 'w%-$RUN'"` → `10`
(dry-run `dr-fx4.sh`: `count|15`, `L|150|released`, the same `all` line, `user sees|10`). BK-1 uses `k-draft` (draft with a question), `k-later` (released, open), `k-closed`
(closed) and `k-tb` (Take back focus); BK-2 and BK-3 use user@'s list; R-6's `R6` is built in its row.

### 3.7 Lead's visual rows (from the Tester's BR screenshots)

- **V-1** — the Release dialog with tags and date, Edit tags, Set closing date and the Close now confirm: look right,
  consistent with the other portal dialogs, readable at 375 and 1280, light and dark; the disabled `Not set` and
  `(no longer offered)` items read as unavailable. AC 26, 27.
- **V-2** — the taker filter bar, the no-match state with `Clear filters`, and the empty state: calm, not an error;
  the bar's weight against the list. AC 22, 26.
- **V-3** — the closed states: the admin list's Closed chip and line, the edit page after Close now, the taker's
  Closed card and result. AC 5.1, 6.
- **V-4** — the tag lines: the admin list's stacked column, the edit page card, the taker row, the take page header;
  with `Not set` and a removed value. AC 18, 23, 27, 28.

---

## 4. Regression (Sitting 4, tester-ui unless stated)

The key flows of the 140-row mock tests gate, as a smaller set, on fixtures with tags and no closing date.

**R-1 — nav and the way in.** Accounts tutor@, admin@, student@, parent@, user@. Expected (`PortalLayout.tsx`):
student `My work, Timetable, Mock tests, Account`; parent `My children, Mock tests, Account`; user
`Latest news, Mock tests, Account`; tutor and admin unchanged (no `Mock tests` item); the link card (`Mock tests`,
`Practise for free with the mock tests we have released.`, `See mock tests`) on the three taker homes opens the list
in the app; admin dashboard shortcut `Mock tests` opens `/portal/admin/mock-tests`.

**R-2 — refused and signed out.** tutor@ and parent@ on `/portal/admin/mock-tests` → `You don't have access to this page`,
no `rpc/mock_tests_admin_list` request; signed out `/portal/user/mock-tests/<id>` →
`/portal/login?next=%2Fportal%2Fuser%2Fmock-tests%2F<id>`.

**R-3 — questions on a draft.** admin@ on `t7-<RUN>-ui1`: add a question (prompt `What is 2 + 2?`, options `4`, `5`,
`Option A is correct`), add a second, move question 2 up, edit it, delete it. Expected: `Questions` shows
`1 of 100 questions` at the end; positions contiguous (`db "select string_agg(position::text, ',' order by position) from public.mock_test_questions q join public.mock_tests t on t.id=q.test_id where t.title='t7-$RUN-ui1'"` → `1`).

**R-4 — take, submit, result.** user@ on `R4=$(mk_test r4 2 released 'maths|naplan|{}|true')`: card `Not started`,
`Start` → `Question 1 of 2`, choose B → `Saved`; `Next`; leave question 2; `Submit` → dialog
`Submit this mock test?` with `1 question isn’t answered yet and will count as incorrect. You can’t change your answers after this.`
→ `Submit` → `Your result`, `1 of 2 correct`; the list card `Submitted`, `View result`. The take page header shows the
tag line `Subject: Maths` `Stream: NAPLAN` `Year level: Any year`.

**R-5 — the answer key stays hidden until submit.** user@ on `R5=$(mk_test r5 2 released)`, in progress: the
`rpc/mock_test_open` response body has no `correct_option` and no `explanation`; database side, `dr-reg.sh`
`keys|id,options,position,prompt,selected_option` (rolled back; the tester-ui runs it in this row).

**R-6 — take-back on an open test (L-5).** admin@ on `R6=$(mk_test r6 2 released)` with student@ in progress:
`Take back to draft` → `Back to draft.`; attempts `0`. With `R6B` where user@ submitted: refused with
`Someone has already submitted this mock test, so it can’t go back to draft.`.

**R-7 — draft and unknown ids are not found.** student@ opens `/portal/student/mock-tests/<FD>` (draft) and a random
uuid → `Not found` each, `rpc/mock_test_open` → `404`.

**R-8 — sign-in and reload for each role.** admin@, tutor@, student@, parent@, user@ land on their homes and a reload
keeps them; inactive@ is refused (addendum); console `0`.

**R-9 — public pages carry no tags or mock tests.** AC 29. Every `sitemap.xml` URL at 375 and 1280: status 200,
console 0, no sideways scroll, one `h1`, one `meta[name="robots"]`, and `document.body.innerText` has none of
`mock test`, `Stream:`, `Year level:`, `Not set` (case-insensitive). Static:
`git diff --name-only develop...HEAD -- apps/web/src/routes apps/web/src/sections apps/web/public` → only
`apps/web/src/routes/portal/*` files (eight, all mock test pages and their tests);
`grep -c mock apps/web/build/client/sitemap.xml` → `0` (S-5 build);
`git grep -nE "MockTagLine|MockTestFilters|MOCK_TAGS|MOCK_TEST_FILTERS" -- apps/web/src supabase/functions | grep -vE "apps/web/src/(routes/portal|components/portal|constants|lib/mock-tests)"`
→ no lines (the scope test in S-4 holds the same rule).

**R-10 — mobile and roles untouched.** Static: `git -C ~/dev/work/aj_classes_mobile log -1 --format=%H` →
`bf14460174abb00978b3ec1631d0c23204235807` and `git -C ~/dev/work/aj_classes_mobile status --short` unchanged from the
start of the run; `git diff develop...HEAD -- supabase/migrations | grep -c 'app_role'` → `0`.

**R-11 — students' and parents' other pages.** student@ home shows `My work` with the seed's work
(`Fractions quick quiz`, `Word problems set 1`, `Number patterns check`) and the link card; parent@ home lists Aarav
and Noah; console `0`.

**R-12 — Delete draft.** admin@ on `R12=$(mk_test r12 2 draft)` (built in the row): `Delete draft` → confirm
`Delete this draft?` with `“t7-<RUN>-r12” and its questions will be removed.` → `Delete draft`. Expected: back on
`/portal/admin/mock-tests`, the title gone from the list; `db "select count(*) from public.mock_tests where id='$R12'"`
→ `0`; its questions `0`. A released test has no `Delete draft` button (`k-later`).

**R-13 — an in-progress answer survives a reload.** user@ on `R13=$(mk_test r13 2 released)` (built in the row):
`Start`, choose B on question 1 (`Saved`), reload. Expected: `In progress`; question 1 shows B selected;
`Answered 1 of 2`; database (postgres) one answer with `selected_option` `1`.

**CL-1 — clean-up (end of every writing sitting).** Owner: that sitting's tester. Remove BR-1's long title `L` first,
the way `rm_t7` removes a released test (back to draft, then delete):
`db "delete from public.mock_test_attempts where test_id in (select id from public.mock_tests where title like 'w%-$RUN')"`;
`db "update public.mock_tests set status='draft', released_at=null, released_by=null, closes_at=null where title like 'w%-$RUN' and status='released'"`;
`db "delete from public.mock_tests where title like 'w%-$RUN'"`; then `rm_t7` → `0`; `db "select count(*) from public.mock_tests"` → `0`; `db "select count(*) from public.mock_test_attempts"` → `0`;
S-0 re-run → identical to the start (including the options line); nothing listening on 5173 (stopped by PID).

---

## 5. Not covered here (outside the pass/fail set)

The TSR words these as "partly verified" or "not run", never a plain PASS:

- **NC-1 — Saurabh verifies in staging** (S-2). After the gate the team lead merges to `develop`; Saurabh checks
  staging himself.
- **NC-2 — the hosted migrations** (04 deploy order 2 to 4: `main` has no caller, the pending set is exactly
  `20261119100000` and `20261120100000`, then `supabase db push`). Team lead, read-only pre-check then apply under S-2.
  S-10 pins only the repository side. No row here touches hosted.
- **NC-3 — production web deploy** from `main`: Saurabh's.
- **NC-4 — long real-time closes and time-zone transitions.** BS-5 proves a close in real time over 60 s; a date days
  ahead closing on the wall clock, and a daylight-saving change between setting and closing, are not run.
- **NC-5 — other browsers and screen readers.** Installed Chrome only; names and roles are measured (BK-3), spoken
  output is not.
- **NC-6 — mobile app** (D-C7): out of v1; R-10 proves nothing changed.
- **NC-7 — the deferred items** D-A1 to D-A3 and D-C1 to D-C8 are not built and not tested.

## 6. Pre-freeze findings for the lead

Found while reading the code for this plan at `5cb0810`. All are resolved at `e947687`; nothing is open before freeze.

- **F-1 — [fixed in `e947687`] the closing copy contradicted S-1 (AC 5.1).**
  `apps/web/src/constants/mock-tests.constants.ts`:
  `MOCK_CLOSING.setClosingText` = "From this time students, parents and signed-up users can’t see this mock test or their results. …"
  and `MOCK_CLOSING.confirmCloseNowText` = "Students, parents and signed-up users won’t see it any more, including their results, and anyone part-way through can’t finish. …".
  Since S-1 (commit `e584243`), a taker who submitted keeps the test and the result. The admin is told something
  untrue at the moment of closing. The comment above `MOCK_CLOSING` ("Closed means hidden from every taker, results
  included") and `MockClosedChip`'s doc comment ("takers can no longer see") are stale the same way.
  Fixed; BC-3 and BC-5 now pin the new texts and the new Close now notice.
- **F-2 — [fixed in `ffe68cc`] focus dropped to `body` after Clear filters (AC 26).** In
  `routes/portal/mock-tests.tsx` the `Clear filters` button sits inside the no-match block, which unmounts as soon as
  the filters clear, so keyboard focus falls to the page body. The last gate filed the same class of bug as BUG-4.
  Fixed: focus goes to the h1; BF-6 and BK-2 pin it.
- **F-3 — AC 14 reading: the Release button stays enabled with a tag missing.** AC 14 says the control says which tag
  is missing "the same way it does for zero questions" (disabled with a hint). As built (04-plan 7b.1 [ASSUMPTION],
  05 deviation 3), the hint shows and the button is enabled; the dialog refuses. BG-5 freezes the as-built reading.
  **Ruled by the lead:** yes, BG-5 tests the enabled button (design §0.2 [ASSUMPTION]).
- **F-4 — AC 16 "field-level message":** a database refusal shows as the dialog's alert naming the field
  (`That subject isn’t on the list. Please choose another.`), not as helper text under the field (design decision 6).
  BG-6 freezes the alert. Recommendation: accept the design reading.
- **F-5 — AC 27 has no real removed value to test.** Every current list value is active, so TG-7, TG-8 and BG-10 use
  fixtures (an option switched off inside a rollback; a stored key the guard would refuse, written past the triggers
  with `session_replication_role = replica`). Recommendation: accept the method.
- **F-6 — review-5 overlaps.** F-2 is review-5 #3, and TS-7 is the two-session check review-5 #2 asks for. Fix batch
  1 is committed (`ffe68cc`, `e947687`) and this plan is re-synced to it (§9).
- No other contradiction with the ACs was found. The closing and tag rules in both migrations, the four replaced
  functions, the error mapping and the filter logic match 01 and 03 (dry-runs in §2).

## 7. Traceability (AC → rows)

| AC | Rows |
|---|---|
| 1 | CD-1, BC-1, BC-2 |
| 2 | CD-2, BC-3, AZ-1, GR-1 |
| 3 | CD-3, TS-6, BC-5, AZ-1, S-8 |
| 4 | CD-2, CD-4, BC-6 |
| 5.1 | TV-1, TS-6, H-1, BF-3, BS-1, S-8 |
| 5.2 | TV-2, TV-3, H-1, BF-2, BS-2 |
| 5.3 | TV-2, TV-4, TS-5, TS-7, H-1, BS-3 |
| 6 | TV-6, CD-6, BC-4, BC-5 |
| 7 | CD-5, BC-7 |
| 8 | TV-5, TS-5, TS-7, BS-3, BS-4, BS-5 |
| 9 | BC-1, BC-3, BC-4, BC-8 |
| 10 | TG-3, GR-3, BG-1, BF-4, S-4 |
| 11 | TG-3 (incl. `vce-subject-selection`), GR-3, BG-1, BF-4, S-4 |
| 12 | TG-3, BG-1, BG-2 |
| 13 | TG-3, TG-5, BG-3, BG-4, S-8 |
| 14 | TG-1, TG-2, TG-2b, TS-1 to TS-4, BG-5, S-8 |
| 15 | TG-4, TG-6, TS-1, TS-4, BG-7, BG-8, BG-9, S-8 |
| 16 | TG-3, TG-9, AZ-2, H-2, BG-6 |
| 17 | CD-5, TG-5, BC-7, BG-11 |
| 18 | TG-6, BF-3, BF-5, BG-9 |
| 19 | BF-4, BK-3 |
| 20 | BF-5, BF-8, S-8 |
| 21 | BF-3, BF-8 |
| 22 | BF-1, BF-2, BF-6, S-8 |
| 23 | BF-3, BS-1, BG-9 |
| 24 | BF-7 |
| 25 | BF-7, BF-8 |
| 26 | BK-1, BK-2, BK-3, BR-1, BR-2, BR-3, V-1, V-2 |
| 27 | TG-7, TG-8, BG-10, BF-4, V-4, S-2 |
| 28 | BG-9, BG-12, BC-4, V-4 |
| 29 | R-9, S-4 |

Every AC 1 to 29 has at least one row. Regression of the 2026-11-17 gate: R-1 to R-13, S-1 to S-10.

## 8. Who runs what

- **tester-api:** S-1 to S-10, GR-1 to GR-3, AZ-1 to AZ-3, CD-1 to CD-6, TV-1 to TV-6, TG-1 to TG-9 and TG-2b, TS-1 to TS-7,
  H-1, H-2, CL-1 (Sittings 1 and 2).
- **tester-ui:** BF-1 to BF-8, BC-1 to BC-8, BS-1 to BS-5, BG-1 to BG-12, BK-1 to BK-3, BR-1 to BR-3, R-1 to R-13,
  CL-1 (Sittings 3 and 4), and the screenshots for V-1 to V-4.
- **Lead:** V-1 to V-4 (verdict), and rulings on §6.

## 9. Re-sync to fix batch 1 (`ffe68cc`, `e947687`), and changes from the last gate's set-up

Written at `5cb0810`; re-synced to `e947687` after review-5 fix batch 1. Changed rows: S-4 (`1144` tests), S-6
(`Tests=1951`), CD-3 (the note on `clock_timestamp()`), TS-7 (now expected to pass), BC-3 and BC-5 (the S-1 copy and
the new Close now notice), BF-6 and BK-2 (focus to the h1 after Clear filters), BK-1 (focus to the h1 after Take back),
BG-7 (a released test's years can't be emptied: the pick is ignored), §6 (F-1, F-2 fixed; F-3 ruled). No frozen row
quotes `mockTagsMissing` (now `Set the missing tags to release this mock test.`).
Every database dry-run was re-run on the local database with `e947687`'s migrations applied (`mock_close_now`,
`mock_tests_for_me` and `mock_submit` read `clock_timestamp()`): the outputs in Appendix B are unchanged, apart from
wall-clock timestamps in `dr-cc.sh`. The planning-only check that loaded the then-uncommitted bodies is superseded.

**Re-sync to `1a1260a` and review-6a round 1.** The release trigger also fires on INSERT (new trigger
`mock_tests_insert_released_needs_tags`): new row TG-2b, GR-2 lists five triggers, S-6 `Tests=1954`, and the
`legacy` fixture now switches `mock_tests_release_needs_tags` off and on inside its own transaction. Also added: CD-6
(questions frozen on a closed test), `vcesel` in TG-3, the Sitting 4 fixtures block (§3.6a), R-12, R-13; BR-1 builds
`L` as a draft before renaming and releasing it, and CL-1 resets `w%` tests to draft before deleting them; BR-1 is
6 pages × 4; every TS row writes its `pg_sleep`; `dr-closing.sh` headers match CD-1 to CD-6; no `window.confirm` stub.
Every dry-run was re-run on `1a1260a`: unchanged outputs except the renamed headers and the new lines.

Set-up changes from the last gate: `t7.sh` gains tags, `legacy`, `TRY`/`who`/`rb`, `take`, `close_now`; `CLEAN` keeps
`HINT`. FX-NA and FX-INV are not needed. The browser context gains `locale` and `timezoneId`. The two-session rows
hold for 4 s (05's transcript used 4 s) instead of 5 s.


## 10. Counts

| Area | Rows |
|---|---|
| Suites (S) | 10 |
| Catalogue (GR) | 3 |
| Authorisation negatives (AZ) | 3 |
| Closing, database (CD) | 6 |
| Closing, takers in the database (TV) | 6 |
| Tags, database (TG) | 10 |
| Two-session (TS) | 7 |
| Through PostgREST (H) | 2 |
| Browser: filters (BF) | 8 |
| Browser: closing, admin (BC) | 8 |
| Browser: closing, takers (BS) | 5 |
| Browser: tags, admin (BG) | 12 |
| Browser: keyboard (BK) | 3 |
| Browser: widths and appearance (BR) | 3 |
| Lead visual (V) | 4 |
| Regression (R) | 13 |
| Clean-up (CL) | 1 |
| **Total** | **104** |

By sitting: Sitting 1 = 43 (S-1 to S-5, S-10, GR 3, AZ 3, CD 6, TV 6, TG 10, TS 7, H 2), Sitting 2 = 4 (S-6 to S-9),
Sitting 3 = 33 (BF 8, BC 8, BS 5, BG 12), Sitting 4 = 19 (BK 3, BR 3, R 13), lead 4, CL-1 once (it runs at the end of
each writing sitting, one row): 43 + 4 + 33 + 19 + 4 + 1 = 104. S-0 is a start-state gate, not a row. NC-1 to NC-7 sit outside the pass/fail set.

---

## Appendix A. Scripts (write each to `$S` exactly as here)

### `t7.sh`

```sh
# t7.sh, mock test closing and categories gate (06-test-plan.md §0.2). Source it: . "$S/t7.sh"
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
# Writes that are rolled back: $1 e-mail, $2 aal, $3 SQL run as postgres first (fixture, may be ''), $4 SQL as the person
as_rb() { docker exec supabase_db_aj_classes psql -U postgres -At -q -c "begin; $3; select set_config('request.jwt.claims', '$(claims "$1" "$2")', true); set local role authenticated; $4; rollback;" 2>&1 | grep -vE "$CLEAN"; }
# Writes that commit (fixtures and taker journeys on t7 tests only): $1 e-mail, $2 aal, $3 SQL
as_w() { docker exec supabase_db_aj_classes psql -U postgres -At -q -c "begin; select set_config('request.jwt.claims', '$(claims "$1" "$2")', true); set local role authenticated; $3; commit;" 2>&1 | grep -vE "$CLEAN"; }
as_anon() { docker exec supabase_db_aj_classes psql -U postgres -At -q -c "begin read only; select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true); set local role anon; $1; rollback;" 2>&1 | grep -vE "$CLEAN"; }
# SQL for a t7 mock test, no transaction of its own. $1 id, $2 label, $3 question count,
# $4 draft|released|legacy, $5 tags 'subject|stream|years|any_year' (default 'maths|naplan|{}|true';
# 'none' = untagged). 'legacy' = released with no tags, the state of a test made before categories:
# the release trigger is switched off for that one update only, inside the fixture's own transaction, and switched
# back on before commit (the pgTAP Legacy L form). mk_test wraps mk_sql in begin ... commit.
# Question g: prompt 'Q<g> of <label>?', options A<g>,B<g>,C<g>, correct option 1 (B),
# explanation 'Because B<g>.' on odd g, '' on even.
mk_sql() {
  tg="$5"; [ -z "$tg" ] && tg='maths|naplan|{}|true'; [ "$tg" = none ] && tg='null|null|{}|false'
  su=$(echo "$tg" | cut -d'|' -f1); st=$(echo "$tg" | cut -d'|' -f2); yl=$(echo "$tg" | cut -d'|' -f3); ay=$(echo "$tg" | cut -d'|' -f4)
  [ "$su" = null ] || su="'$su'"; [ "$st" = null ] || st="'$st'"
  echo "insert into public.mock_tests (id, title, instructions, created_by, subject, stream, year_levels, any_year) values ('$1', 't7-$RUN-$2', 'Fixture instructions for $2.', (select id from public.profiles where email='admin@local.test'), $su, $st, '$yl', $ay);"
  [ "${3:-0}" -gt 0 ] && echo "insert into public.mock_test_questions (test_id, prompt, options, correct_option, explanation) select '$1', 'Q'||g||' of $2?', array['A'||g,'B'||g,'C'||g], 1, case when g % 2 = 1 then 'Because B'||g||'.' else '' end from generate_series(1,$3) g;"
  [ "$4" = released ] && echo "update public.mock_tests set status='released', released_at=now(), released_by=created_by where id='$1';"
  [ "$4" = legacy ] && echo "alter table public.mock_tests disable trigger mock_tests_release_needs_tags; update public.mock_tests set status='released', released_at=now(), released_by=created_by where id='$1'; alter table public.mock_tests enable trigger mock_tests_release_needs_tags;"
  true; }
# Commits a t7 mock test (same arguments as mk_sql without the id). Prints its id.
mk_test() { id=$(db "select gen_random_uuid()"); db "begin; $(mk_sql "$id" "$@") commit;" > /dev/null && echo "$id"; }
qids() { db "select id from public.mock_test_questions where test_id='$1' order by position" | paste -sd' ' -; }
tags_of() { db "select coalesce(subject,'null')||'|'||coalesce(stream,'null')||'|'||year_levels::text||'|'||any_year from public.mock_tests where id='$1'"; }
state_of() { db "select status||'|'||coalesce(closes_at::text,'null')||'|'||(closes_at is not null and closes_at <= clock_timestamp()) from public.mock_tests where id='$1'"; }
# Removes every t7 mock test, its attempts and answers (released ones go back to draft before delete)
rm_t7() {
  db "delete from public.mock_test_attempts where test_id in (select id from public.mock_tests where title like 't7-%')"
  db "update public.mock_tests set status='draft', released_at=null, released_by=null, closes_at=null where title like 't7-%' and status='released'"
  db "delete from public.mock_tests where title like 't7-%'"
  db "select count(*) from public.mock_tests where title like 't7-%'"; }
# Real tokens for PostgREST (password grant gives aal1). The token goes to a 0600 file, never a command line.
tok() { curl -s -X POST -H @"$S/anon.hdr" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"local-password-123\",\"gotrue_meta_security\":{\"captcha_token\":\"$CAPTCHA\"}}" "$API/auth/v1/token?grant_type=password" | python3 -I -c 'import json,sys; print("Authorization: Bearer "+json.load(sys.stdin).get("access_token",""))' > "$S/$1.hdr"; }
# $1 METHOD, $2 e-mail or 'anon', $3 path under /rest/v1/, $4 JSON body (optional). Prints "<status> <body>".
rest() { h="$S/$2.hdr"; [ "$2" = anon ] && h=/dev/null; curl -s -o "$S/last.json" -w '%{http_code}' -X "$1" -H @"$S/anon.hdr" -H @"$h" -H 'Content-Type: application/json' -H 'Prefer: return=representation' ${4:+-d "$4"} "$API/rest/v1/$3"; echo " $(cat "$S/last.json")"; }
# Two sessions at once. $1 label, $2 e-mail or 'postgres', $3 aal, $4 SQL. Writes $S/cc-<label>.txt with output and elapsed seconds.
cc() { ( t0=$(python3 -I -c 'import time;print(time.time())'); if [ "$2" = postgres ]; then pre="begin;"; else pre="begin; select set_config('request.jwt.claims', '$(claims "$2" "$3")', true); set local role authenticated;"; fi; out=$(docker exec supabase_db_aj_classes psql -U postgres -At -q -c "$pre $4; commit;" 2>&1 | grep -vE "$CLEAN" | paste -sd';' -); t1=$(python3 -I -c 'import time;print(time.time())'); echo "$1|$out|elapsed=$(python3 -I -c "print(round($t1-$t0,1))")" > "$S/cc-$1.txt" ) & }
# No released test without all three tags, except legacy fixtures (checked after every CC row)
untagged_released() { db "select count(*) from public.mock_tests where status='released' and title like 't7-%' and title not like '%legacy%' and not (subject is not null and stream is not null and (any_year or cardinality(year_levels) > 0))"; }
invariant() { db "select count(*) from public.mock_test_attempts a join public.mock_tests t on t.id=a.test_id where t.status='draft'"; }
# --- Rolled-back scenario rows (dry-runnable). TRY makes pg_temp.try(sql), which runs sql and returns
# 'ok' or '<sqlstate>:<message>[:<hint>]', so one transaction can check several refusals in turn.
TRY='create function pg_temp.try(q text) returns text language plpgsql as $f$ declare m text; h text; s text; begin execute q; return $o$ok$o$; exception when others then get stacked diagnostics m = message_text, h = pg_exception_hint, s = returned_sqlstate; return s||$o$:$o$||m||coalesce($o$:$o$||nullif(h,$o$$o$),$o$$o$); end $f$;'
# who <e-mail> <aal>: switch the rest of the transaction to that person (reset role; returns to postgres)
who() { echo "reset role; select set_config('request.jwt.claims', '$(claims "$1" "$2")', true); set local role authenticated;"; }
# rb <SQL>: run SQL as postgres inside begin ... rollback, with pg_temp.try available
rb() { docker exec supabase_db_aj_classes psql -U postgres -At -q -v ON_ERROR_STOP=1 -c "begin; $TRY $1; rollback;" 2>&1 | grep -vE "$CLEAN"; }
# Taker journeys (fixtures that commit). take_sql <test id> <submitted|in_progress> prints the SQL the
# taker runs: start, answer question 1 with option 1 (correct), and submit when asked (score 1 of n).
take_sql() { q1=$(db "select id from public.mock_test_questions where test_id='$1' and position=1"); echo "select public.mock_start('$1'); select public.mock_save_answer('$1', '$q1', 1);"; [ "$2" = submitted ] && echo "select public.mock_submit('$1');"; true; }
# take <e-mail> <test id> <submitted|in_progress>
take() { as_w "$1" aal1 "$(take_sql "$2" "$3")"; }
# close_now <test id>: admin@ at aal2 presses Close now (commits)
close_now() { as_w admin@local.test aal2 "select public.mock_close_now('$1')"; }
```

### `gr.sql`

```sql
select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')|'||case when p.prosecdef then 'definer' else 'invoker' end||'|'||coalesce(array_to_string(p.proconfig, ','),'')||'|anon='||has_function_privilege('anon', p.oid, 'execute')||'|auth='||has_function_privilege('authenticated', p.oid, 'execute') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('mock_release','mock_set_closing','mock_close_now','mock_withdraw','mock_tests_admin_list','mock_tests_for_me','mock_test_open','check_mock_test_tags','check_mock_test_release_tags') order by 1;
select tgname||'|'||pg_get_triggerdef(t.oid) from pg_trigger t where tgrelid='public.mock_tests'::regclass and not tgisinternal order by 1;
select conname||'|'||pg_get_constraintdef(oid) from pg_constraint where conrelid='public.mock_tests'::regclass and contype='c' order by 1;
select relrowsecurity||'|'||(select count(*) from pg_policies where schemaname='private' and tablename='mock_test_options') from pg_class where oid='private.mock_test_options'::regclass;
select count(*) from information_schema.role_table_grants where table_schema='private' and table_name='mock_test_options' and grantee in ('anon','authenticated','PUBLIC');
```

### `dr-closing.sh`

```sh
. "$S/t7.sh"
X=00000000-0000-0000-0000-0000000c0001
echo '=== CD-1 and CD-2 release and set closing'
rb "$(mk_sql $X cd 2 draft) $(who admin@local.test aal2)
select 'past', pg_temp.try(\$\$select public.mock_release('$X', now() - interval '1 minute')\$\$);
select 'now', pg_temp.try(\$\$select public.mock_release('$X', now())\$\$);
select 'setdraft', pg_temp.try(\$\$select public.mock_set_closing('$X', now() + interval '1 day')\$\$);
select 'closenowdraft', pg_temp.try(\$\$select public.mock_close_now('$X')\$\$);
select 'future', pg_temp.try(\$\$select public.mock_release('$X', now() + interval '2 days')\$\$);
reset role; select 'st1', status||'|'||(closes_at = now() + interval '2 days')||'|'||(closes_at > now()) from public.mock_tests where id='$X';
$(who admin@local.test aal2)
select 'again', pg_temp.try(\$\$select public.mock_release('$X', null)\$\$);
select 'change', pg_temp.try(\$\$select public.mock_set_closing('$X', now() + interval '3 days')\$\$);
reset role; select 'st2', (closes_at = now() + interval '3 days') from public.mock_tests where id='$X';
$(who admin@local.test aal2)
select 'setpast', pg_temp.try(\$\$select public.mock_set_closing('$X', now() - interval '1 second')\$\$);
select 'setnow', pg_temp.try(\$\$select public.mock_set_closing('$X', now())\$\$);
select 'clear', pg_temp.try(\$\$select public.mock_set_closing('$X', null)\$\$);
reset role; select 'st3', coalesce(closes_at::text,'null') from public.mock_tests where id='$X';
$(who admin@local.test aal2)
select 'unknown', pg_temp.try(\$\$select public.mock_set_closing(gen_random_uuid(), null)\$\$);
"
echo '=== CD-3 close now with a submitted attempt, then a no-op'
rb "$(mk_sql $X cn 2 released) $(who user@local.test aal1)
select public.mock_start('$X'); select public.mock_submit('$X');
$(who admin@local.test aal2)
select 'closenow', pg_temp.try(\$\$select public.mock_close_now('$X')\$\$);
reset role; select 'st', (closes_at >= now())||'|'||(closes_at <= clock_timestamp()) from public.mock_tests where id='$X';
update public.mock_tests set closes_at = now() - interval '1 hour' where id='$X';
$(who admin@local.test aal2)
select 'again', pg_temp.try(\$\$select public.mock_close_now('$X')\$\$);
reset role; select 'kept', (closes_at = now() - interval '1 hour') from public.mock_tests where id='$X';
"
echo '=== CD-4 reopen keeps an in-progress attempt'
rb "$(mk_sql $X ro 2 released) select set_config('t7.q1', (select id::text from public.mock_test_questions where test_id='$X' and position=1), false), set_config('t7.q2', (select id::text from public.mock_test_questions where test_id='$X' and position=2), false); $(who student@local.test aal1)
select public.mock_start('$X'); select public.mock_save_answer('$X', current_setting('t7.q1')::uuid, 2);
$(who admin@local.test aal2) select public.mock_close_now('$X');
$(who student@local.test aal1)
select 'closedlist', count(*) from public.mock_tests_for_me() where id='$X';
select 'closedsave', pg_temp.try(\$\$select public.mock_save_answer('$X', current_setting('t7.q2')::uuid, 0)\$\$);
reset role; update public.mock_tests set closes_at = now() - interval '1 minute' where id='$X';
$(who admin@local.test aal2)
select 'reopen', pg_temp.try(\$\$select public.mock_set_closing('$X', null)\$\$);
$(who student@local.test aal1)
select 'list', status from public.mock_tests_for_me() where id='$X';
select 'open', (public.mock_test_open('$X'))->>'status', (public.mock_test_open('$X'))->'questions'->0->>'selected_option';
select 'save2', pg_temp.try(\$\$select public.mock_save_answer('$X', current_setting('t7.q2')::uuid, 0)\$\$);
reset role; select 'answers', count(*) from public.mock_test_answers ans join public.mock_test_attempts a on a.id=ans.attempt_id where a.test_id='$X';
"
echo '=== CD-5 take-back on a closed test'
rb "$(mk_sql $X tb 2 released) $(who parent@local.test aal1) select public.mock_start('$X');
$(who admin@local.test aal2) select public.mock_close_now('$X');
select 'withdraw', pg_temp.try(\$\$select public.mock_withdraw('$X')\$\$);
reset role; select 'st', status||'|'||coalesce(closes_at::text,'null')||'|'||(select count(*) from public.mock_test_attempts where test_id='$X')||'|'||coalesce(subject,'null')||'|'||coalesce(stream,'null')||'|'||any_year from public.mock_tests where id='$X';
"
rb "$(mk_sql $X tb2 2 released) $(who parent@local.test aal1) select public.mock_start('$X'); select public.mock_submit('$X');
$(who student@local.test aal1) select public.mock_start('$X');
$(who admin@local.test aal2) select public.mock_close_now('$X');
select 'withdraw', pg_temp.try(\$\$select public.mock_withdraw('$X')\$\$);
reset role; select 'st', status||'|'||(closes_at is not null)||'|'||(select count(*) from public.mock_test_attempts where test_id='$X') from public.mock_tests where id='$X';
"
echo '=== CD-6 a closed test keeps its questions frozen'
rb "$(mk_sql $X fq 2 released) select set_config('t7.q1', (select id::text from public.mock_test_questions where test_id='$X' and position=1), false);
$(who admin@local.test aal2) select public.mock_close_now('$X');
select 'qins', pg_temp.try(\$\$insert into public.mock_test_questions (test_id, prompt, options, correct_option) values ('$X', 'Late?', array['a','b'], 0)\$\$);
select 'qupd', pg_temp.try(\$\$update public.mock_test_questions set prompt='Changed?' where id=current_setting('t7.q1')::uuid\$\$);
select 'qdel', pg_temp.try(\$\$delete from public.mock_test_questions where id=current_setting('t7.q1')::uuid\$\$);
reset role; select 'qcount', count(*) from public.mock_test_questions where test_id='$X';
"
```

### `dr-s1.sh`

```sh
. "$S/t7.sh"
TA=00000000-0000-0000-0000-0000000c0a01; TB=00000000-0000-0000-0000-0000000c0b01; TC=00000000-0000-0000-0000-0000000c0c01
Q="select set_config('t7.b1', (select id::text from public.mock_test_questions where test_id='$TB' and position=1), false), set_config('t7.a1', (select id::text from public.mock_test_questions where test_id='$TA' and position=1), false);"
pre=""
for E in student@local.test parent@local.test user@local.test; do
  pre="$pre $(who $E aal1) select public.mock_start('$TA'); select public.mock_save_answer('$TA', current_setting('t7.a1')::uuid, 1); select public.mock_submit('$TA'); select public.mock_start('$TB'); select public.mock_save_answer('$TB', current_setting('t7.b1')::uuid, 1);"
done
checks=""
for E in student@local.test parent@local.test user@local.test; do
  checks="$checks $(who $E aal1)
select '$E list', string_agg(title||':'||status||':'||(closes_at <= clock_timestamp()), ' ' order by title) from public.mock_tests_for_me() where title like 't7-%';
select '$E openA', (public.mock_test_open('$TA'))->>'status', (public.mock_test_open('$TA'))->>'score', (public.mock_test_open('$TA'))->>'total', (public.mock_test_open('$TA'))->'questions'->0->>'correct_option', (public.mock_test_open('$TA'))->'questions'->0->>'selected_option', (public.mock_test_open('$TA'))->'questions'->0->>'explanation';
select '$E startA', pg_temp.try(\$\$select public.mock_start('$TA')\$\$);
select '$E submitA', pg_temp.try(\$\$select public.mock_submit('$TA')\$\$);
select '$E openB', pg_temp.try(\$\$select public.mock_test_open('$TB')\$\$);
select '$E saveB', pg_temp.try(\$\$select public.mock_save_answer('$TB', current_setting('t7.b1')::uuid, 0)\$\$);
select '$E submitB', pg_temp.try(\$\$select public.mock_submit('$TB')\$\$);
select '$E openC', pg_temp.try(\$\$select public.mock_test_open('$TC')\$\$);
select '$E startC', pg_temp.try(\$\$select public.mock_start('$TC')\$\$);"
done
rb "$(mk_sql $TA s1a 2 released) $(mk_sql $TB s1b 2 released) $(mk_sql $TC s1c 2 released) $Q $pre
$(who admin@local.test aal2) select public.mock_close_now('$TA'); select public.mock_close_now('$TB'); select public.mock_close_now('$TC');
$checks
reset role; select 'after B', string_agg(coalesce(a.submitted_at::text,'null')||':'||(select count(*) from public.mock_test_answers ans where ans.attempt_id=a.id)||':'||(select selected_option from public.mock_test_answers ans where ans.attempt_id=a.id), ' ') from public.mock_test_attempts a where a.test_id='$TB';
$(who admin@local.test aal2) select 'admin list', string_agg(title||':'||status||':'||(closes_at <= clock_timestamp())||':'||submitted_count, ' ' order by title) from public.mock_tests_admin_list() where title like 't7-%';
"
echo '=== boundary'
rb "$(mk_sql $TA bd 2 released) $(mk_sql $TB bd1m 2 released)
update public.mock_tests set closes_at = now() where id='$TA'; update public.mock_tests set closes_at = now() + interval '1 minute' where id='$TB';
$(who user@local.test aal1)
select 'list', string_agg(title, ' ' order by title) from public.mock_tests_for_me() where title like 't7-%';
select 'startA', pg_temp.try(\$\$select public.mock_start('$TA')\$\$);
select 'startB', pg_temp.try(\$\$select public.mock_start('$TB')\$\$);
"
```

### `dr-tags.sh`

```sh
. "$S/t7.sh"
X=00000000-0000-0000-0000-0000000d0001; Y=00000000-0000-0000-0000-0000000d0002; Z=00000000-0000-0000-0000-0000000d0003; L=00000000-0000-0000-0000-0000000d0004
echo '=== TG release refused'
rb "$(mk_sql $X un 1 draft none) $(mk_sql $Y un0 0 draft none) $(who admin@local.test aal2)
select 'untagged', pg_temp.try(\$\$select public.mock_release('$X')\$\$);
select 'zeroq', pg_temp.try(\$\$select public.mock_release('$Y')\$\$);
select 'pastfirst', pg_temp.try(\$\$select public.mock_release('$X', now() - interval '1 minute')\$\$);
update public.mock_tests set stream='naplan', any_year=true where id='$X';
select 'nosubject', pg_temp.try(\$\$select public.mock_release('$X')\$\$);
update public.mock_tests set subject='maths', stream=null where id='$X';
select 'nostream', pg_temp.try(\$\$select public.mock_release('$X')\$\$);
update public.mock_tests set stream='naplan', any_year=false where id='$X';
select 'noyears', pg_temp.try(\$\$select public.mock_release('$X')\$\$);
update public.mock_tests set year_levels='{7,8}' where id='$X';
select 'years', pg_temp.try(\$\$select public.mock_release('$X')\$\$);
reset role; select 'st', status||'|'||subject||'|'||stream||'|'||year_levels::text||'|'||any_year from public.mock_tests where id='$X';
"
echo '=== TG direct status writes'
rb "$(mk_sql $X ds 1 draft none) $(mk_sql $Y ds2 1 draft) $(who admin@local.test aal2)
select 'authstatus', pg_temp.try(\$\$update public.mock_tests set status='released', released_at=now() where id='$Y'\$\$);
reset role;
select 'pgdraftuntagged', pg_temp.try(\$\$update public.mock_tests set status='released', released_at=now() where id='$X'\$\$);
select 'pgdrafttagged', pg_temp.try(\$\$update public.mock_tests set status='released', released_at=now() where id='$Y'\$\$);
"
echo '=== TG guard values (as admin aal2)'
ins() { echo "select '$1', pg_temp.try(\$\$insert into public.mock_tests (title, subject, stream, year_levels, any_year) values ('t7-$RUN-g', $2)\$\$);"; }
rb "$(who admin@local.test aal2)
$(ins ok "'maths','naplan','{}',true")
$(ins okyears "'verbal-reasoning','maths-science-english','{2,12}',false")
$(ins untagged "null,null,'{}',false")
$(ins interview "'interview-preparation','naplan','{}',true")
$(ins unknownsub "'chemistry','naplan','{}',true")
$(ins ucat "'maths','ucat-and-gamsat','{}',true")
$(ins interviews "'maths','interviews','{}',true")
$(ins label "'Maths','naplan','{}',true")
$(ins y1 "'maths','naplan','{1}',false")
$(ins y13 "'maths','naplan','{13}',false")
$(ins dup "'maths','naplan','{5,5}',false")
$(ins desc "'maths','naplan','{6,5}',false")
$(ins yany "'maths','naplan','{5}',true")
$(ins ynull "'maths','naplan',array[3,null]::smallint[],false")
$(ins y0based "'maths','naplan','[0:0]={7}',false")
$(ins y2d "'maths','naplan','{{7,8}}',false")
$(ins vcesel "'maths','vce-subject-selection','{}',true")
reset role; select 'made', count(*) from public.mock_tests where title like 't7-%';
"
echo '=== TG released and closed: change yes, clear no'
upd() { echo "select '$1', pg_temp.try(\$\$update public.mock_tests set $2 where id='$3'\$\$);"; }
rb "$(mk_sql $X rel 2 released 'maths|naplan|{5,6}|false') $(mk_sql $Y cls 2 released 'english|vce|{}|true')
select set_config('t7.q1', (select id::text from public.mock_test_questions where test_id='$X' and position=1), false);
$(who user@local.test aal1) select public.mock_start('$X'); select public.mock_save_answer('$X', current_setting('t7.q1')::uuid, 2);
$(who admin@local.test aal2) select public.mock_set_closing('$X', now() + interval '5 days'); select public.mock_close_now('$Y');
$(upd subj "subject='english'" $X)
$(upd stream "stream='icas'" $X)
$(upd years "year_levels='{7}'" $X)
$(upd toany "year_levels='{}', any_year=true" $X)
$(upd clrsub "subject=null" $X)
$(upd clrstream "stream=null" $X)
$(upd clryears "any_year=false" $X)
$(upd title "title='t7-$RUN-renamed'" $X)
$(upd instr "instructions='x'" $X)
$(upd badsub "subject='interview-preparation'" $X)
$(upd csubj "subject='science'" $Y)
$(upd cyears "any_year=false, year_levels='{9,10,11}'" $Y)
$(upd cclrsub "subject=null" $Y)
$(upd cclryears "any_year=false, year_levels='{}'" $Y)
reset role;
select 'X', subject||'|'||stream||'|'||year_levels::text||'|'||any_year||'|'||title||'|'||(closes_at = now() + interval '5 days') from public.mock_tests where id='$X';
select 'Y', subject||'|'||stream||'|'||year_levels::text||'|'||any_year||'|'||(closes_at <= clock_timestamp()) from public.mock_tests where id='$Y';
select 'attempt', (select count(*) from public.mock_test_attempts where test_id='$X')||'|'||(select string_agg(ans.selected_option::text, ',') from public.mock_test_answers ans join public.mock_test_attempts a on a.id=ans.attempt_id where a.test_id='$X')||'|'||(select count(*) from public.mock_test_attempts where test_id='$X' and submitted_at is null);
"
echo '=== TG draft clear allowed, take-back keeps tags, close/reopen keeps tags'
rb "$(mk_sql $X dr 1 draft 'maths|naplan|{3}|false') $(mk_sql $Y tk 1 released 'reading|icas|{4,5}|false') $(who admin@local.test aal2)
$(upd dclr "subject=null, stream=null, year_levels='{}'" $X)
select 'withdraw', pg_temp.try(\$\$select public.mock_withdraw('$Y')\$\$);
reset role; select 'X', coalesce(subject,'null')||'|'||coalesce(stream,'null')||'|'||year_levels::text||'|'||any_year from public.mock_tests where id='$X';
select 'Y', status||'|'||subject||'|'||stream||'|'||year_levels::text||'|'||any_year from public.mock_tests where id='$Y';
$(who admin@local.test aal2) select public.mock_release('$Y', now() + interval '1 day'); select public.mock_close_now('$Y'); select public.mock_set_closing('$Y', null);
reset role; select 'Y2', status||'|'||subject||'|'||stream||'|'||year_levels::text||'|'||any_year from public.mock_tests where id='$Y';
"
echo '=== TG legacy'
rb "$(mk_sql $L legacy 2 legacy none) $(who student@local.test aal1)
select 'taker', title||'|'||coalesce(subject,'null')||'|'||coalesce(stream,'null')||'|'||year_levels::text||'|'||any_year from public.mock_tests_for_me() where id='$L';
select 'open', (public.mock_test_open('$L'))->'tags';
$(who admin@local.test aal2)
select 'admin', coalesce(subject,'null')||'|'||coalesce(stream,'null')||'|'||year_levels::text||'|'||any_year from public.mock_tests_admin_list() where id='$L';
select 'closenow', pg_temp.try(\$\$select public.mock_close_now('$L')\$\$);
select 'reopen', pg_temp.try(\$\$select public.mock_set_closing('$L', null)\$\$);
$(upd s1 "subject='reading'" $L)
$(upd s2 "year_levels='{3,5}'" $L)
$(upd s3 "subject=null" $L)
reset role; select 'L', coalesce(subject,'null')||'|'||coalesce(stream,'null')||'|'||year_levels::text||'|'||any_year from public.mock_tests where id='$L';
"
echo '=== TG removed value'
rb "$(mk_sql $X wr 1 draft 'writing|naplan|{}|true') $(mk_sql $Y wr2 1 draft none) $(mk_sql $Z wr3 1 released 'writing|icas|{}|true')
update private.mock_test_options set active=false where kind='subject' and key='writing';
$(who admin@local.test aal2)
$(upd keepdraft "title='t7-$RUN-wr-renamed', stream='vce'" $X)
$(upd keeprel "stream='naplan'" $Z)
$(upd other "subject='writing'" $Y)
$(upd away "subject='maths'" $X)
$(upd back "subject='writing'" $X)
reset role; select 'X', subject||'|'||stream from public.mock_tests where id='$X';
select 'Z', subject||'|'||stream from public.mock_tests where id='$Z';
"
echo '=== TG who can write tags'
rb "$(mk_sql $X who 1 draft none)
$(who student@local.test aal1) select 'student', pg_temp.try(\$\$update public.mock_tests set subject='maths' where id='$X'\$\$);
$(who tutor@local.test aal1) select 'tutor', pg_temp.try(\$\$update public.mock_tests set subject='maths' where id='$X'\$\$);
$(who admin@local.test aal1) select 'adminaal1', pg_temp.try(\$\$update public.mock_tests set subject='maths' where id='$X'\$\$);
reset role; select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true); set local role anon; select 'anon', pg_temp.try(\$\$update public.mock_tests set subject='maths' where id='$X'\$\$);
reset role; select 'X', coalesce(subject,'null') from public.mock_tests where id='$X';
select 'options', grantee||':'||privilege_type from information_schema.role_table_grants where table_schema='private' and table_name='mock_test_options' and grantee in ('anon','authenticated','public');
select 'colgrants', string_agg(grantee||':'||privilege_type||':'||column_name, ' ' order by grantee, privilege_type, column_name) from information_schema.column_privileges where table_schema='public' and table_name='mock_tests' and grantee in ('anon','authenticated');
"
echo '=== TG-2b an insert that is already released'
insr() { echo "select '$1', pg_temp.try(\$\$insert into public.mock_tests (title, status, released_at, subject, stream, year_levels, any_year) values ('t7-$RUN-ib', $2)\$\$);"; }
rb "$(insr insrelnone "'released', now(), null, null, '{}', false")
$(insr insrelsub "'released', now(), null, 'naplan', '{}', true")
$(insr insreltagged "'released', now(), 'maths', 'naplan', '{}', true")
$(insr insdraftnone "'draft', null, null, null, '{}', false")
select 'madeb', count(*) from public.mock_tests where title like 't7-%';
"
```

### `dr-removed.sh`

```sh
. "$S/t7.sh"
X=00000000-0000-0000-0000-0000000f0101
FXR="set local session_replication_role = replica; update public.mock_tests set subject='interview-preparation', stream='old-stream' where id='$X'; set local session_replication_role = origin;"
up() { echo "select '$1', pg_temp.try(\$q\$update public.mock_tests set $2 where id='$X'\$q\$);"; }
rb "$(mk_sql $X rv 2 released) $FXR
select 'fx', subject||'|'||stream from public.mock_tests where id='$X';
$(who admin@local.test aal2)
$(up same "subject='interview-preparation', stream='old-stream', year_levels='{}', any_year=true")
$(up years "subject='interview-preparation', stream='old-stream', year_levels='{8}', any_year=false")
$(up stream "stream='naplan'")
$(up streamback "stream='old-stream'")
$(who user@local.test aal1) select 'taker', subject||'|'||stream||'|'||year_levels::text from public.mock_tests_for_me() where id='$X';
"
```

### `dr-cc.sh`

```sh
. "$S/t7.sh"
X=00000000-0000-0000-0000-0000000e0001
seq() { rb "$(mk_sql $X $1 1 $2) select set_config('t7.q1', (select id::text from public.mock_test_questions where test_id='$X' and position=1), false); $3 $(who admin@local.test aal2) select '$1 S1', pg_temp.try(\$\$$4\$\$); $5 select '$1 S2', pg_temp.try(\$\$$6\$\$); reset role; select '$1 after', status||'|'||coalesce(subject,'null')||'|'||coalesce(closes_at::text,'null') from public.mock_tests where id='$X';"; }
ADM="$(who admin@local.test aal2)"
seq ccA draft '' "select public.mock_release('$X')" "$ADM" "update public.mock_tests set subject=null where id='$X'"
seq ccB draft '' "update public.mock_tests set subject=null where id='$X'" "$ADM" "select public.mock_release('$X')"
seq ccC draft '' "update public.mock_tests set subject=null where id='$X'" "reset role;" "update public.mock_tests set status='released', released_at=now() where id='$X'"
rb "$(mk_sql $X ccCm 1 draft) reset role; select 'ccCm S1', pg_temp.try(\$\$update public.mock_tests set status='released', released_at=now() where id='$X'\$\$); $ADM select 'ccCm S2', pg_temp.try(\$\$update public.mock_tests set subject=null where id='$X'\$\$);"
seq ccD released "$(who user@local.test aal1) select public.mock_start('$X');" "select public.mock_close_now('$X')" "$(who user@local.test aal1)" "select public.mock_save_answer('$X', current_setting('t7.q1')::uuid, 1)"
seq ccE released "$(who user@local.test aal1) select public.mock_start('$X'); select public.mock_save_answer('$X', current_setting('t7.q1')::uuid, 1);" "select 1" "$(who user@local.test aal1) select public.mock_submit('$X'); $ADM" "select public.mock_close_now('$X')"
```

### `dr-az.sh`

```sh
. "$S/t7.sh"
X=00000000-0000-0000-0000-0000000b0001
out=""
for E in tutor@local.test student@local.test parent@local.test user@local.test; do
out="$out $(who $E aal1)
select '$E set', pg_temp.try(\$\$select public.mock_set_closing('$X', null)\$\$);
select '$E close', pg_temp.try(\$\$select public.mock_close_now('$X')\$\$);
with u as (update public.mock_tests set subject='english' where id='$X' returning 1) select '$E upd', count(*) from u;
select '$E ins', pg_temp.try(\$\$insert into public.mock_tests (title, subject, stream, any_year) values ('t7-x', 'maths', 'naplan', true)\$\$);"
done
rb "$(mk_sql $X az 1 released) $out
$(who admin@local.test aal1) with u as (update public.mock_tests set subject='english' where id='$X' returning 1) select 'admin aal1 upd', count(*) from u;
$(who admin@local.test aal2) with u as (update public.mock_tests set subject='english' where id='$X' returning 1) select 'admin aal2 upd', count(*) from u;
select 'admin attempts', pg_temp.try(\$\$select count(*) from public.mock_test_attempts\$\$);
reset role; select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true); set local role anon;
select 'anon ins', pg_temp.try(\$\$insert into public.mock_tests (title, subject) values ('t7-x', 'maths')\$\$);
"
```

### `dr-reg.sh`

```sh
. "$S/t7.sh"
X=00000000-0000-0000-0000-0000000f0001; D=00000000-0000-0000-0000-0000000f0002
rb "$(mk_sql $X rg 2 released) $(mk_sql $D rgd 1 draft) $(who student@local.test aal1) select public.mock_start('$X');
select 'keys', (select string_agg(k, ',' order by k) from jsonb_object_keys((public.mock_test_open('$X'))->'questions'->0) k);
select 'draft', pg_temp.try(\$\$select public.mock_test_open('$D')\$\$);
select 'listdraft', count(*) from public.mock_tests_for_me() where id='$D';
$(who tutor@local.test aal1) select 'tutor', pg_temp.try(\$\$select count(*) from public.mock_tests_for_me()\$\$);
$(who admin@local.test aal2) select 'admin as taker', pg_temp.try(\$\$select count(*) from public.mock_tests_for_me()\$\$);
select 'admin attempts', pg_temp.try(\$\$select count(*) from public.mock_test_attempts\$\$);
$(who admin@local.test aal1) select 'aal1 close', pg_temp.try(\$\$select public.mock_close_now('$X')\$\$); select 'aal1 set', pg_temp.try(\$\$select public.mock_set_closing('$X', null)\$\$);
reset role; select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true); set local role anon;
select 'anon close', pg_temp.try(\$\$select public.mock_close_now('$X')\$\$); select 'anon set', pg_temp.try(\$\$select public.mock_set_closing('$X', null)\$\$);
"
```

### `dr-cleanup.sh`

```sh
. "$S/t7.sh"
X=00000000-0000-0000-0000-0000000a1001; L=00000000-0000-0000-0000-0000000a1002; R=00000000-0000-0000-0000-0000000a1003
rb "$(mk_sql $X cl 2 released) $(mk_sql $L legacy 1 legacy none) $(mk_sql $R rv 1 released)
set local session_replication_role = replica; update public.mock_tests set subject='interview-preparation', stream='old-stream' where id='$R'; set local session_replication_role = origin;
$(who user@local.test aal1) select public.mock_start('$X'); select public.mock_submit('$X');
$(who admin@local.test aal2) select public.mock_close_now('$X');
reset role;
delete from public.mock_test_attempts where test_id in (select id from public.mock_tests where title like 't7-%');
update public.mock_tests set status='draft', released_at=null, released_by=null, closes_at=null where title like 't7-%' and status='released';
delete from public.mock_tests where title like 't7-%';
select 'left', count(*) from public.mock_tests where title like 't7-%';
"
```

### `dr-fx3.sh`

```sh
. "$S/t7.sh"
# Sitting 3 fixtures, rolled back: same SQL as the committed build, with take_sql run as each taker.
# take_sql reads question ids as postgres, so the tests must exist first: build them in one committed
# step in the real run; here they are built inside the transaction and take_sql's lookup is replaced
# by the in-transaction id (the q1 lookup is the only difference).
F5=00000000-0000-0000-0000-0000000f3005; F1=00000000-0000-0000-0000-0000000f3001; F4=00000000-0000-0000-0000-0000000f3004
q() { echo "(select id from public.mock_test_questions where test_id='$1' and position=1)"; }
rb "$(mk_sql $F5 f5 2 released 'reading|icas|{5}|false') $(mk_sql $F1 f1 2 released 'maths|naplan|{3,5}|false') $(mk_sql $F4 f4 2 released 'science|vce|{11,12}|false')
select set_config('t7.q4', $(q $F4)::text, false), set_config('t7.q1', $(q $F1)::text, false);
$(who user@local.test aal1) select public.mock_start('$F4'); select public.mock_save_answer('$F4', current_setting('t7.q4')::uuid, 1); select public.mock_submit('$F4');
$(who student@local.test aal1) select public.mock_start('$F1'); select public.mock_save_answer('$F1', current_setting('t7.q1')::uuid, 1);
$(who admin@local.test aal2) select public.mock_close_now('$F5'); select public.mock_close_now('$F4');
$(who user@local.test aal1) select 'user list', string_agg(title||':'||status, ' ' order by title) from public.mock_tests_for_me() where title like 't7-%';
$(who student@local.test aal1) select 'student list', string_agg(title||':'||status, ' ' order by title) from public.mock_tests_for_me() where title like 't7-%';
"
echo '=== take_sql text'; take_sql 00000000-0000-0000-0000-000000000000 submitted
```

### `dr-fx4.sh`

```sh
. "$S/t7.sh"
# Sitting 4 fixtures, rolled back: the same tests as §3.6a, with the journeys run as each taker inside the transaction.
F5=00000000-0000-0000-0000-0000000f4005; F1=00000000-0000-0000-0000-0000000f4001; F2=00000000-0000-0000-0000-0000000f4002; F3=00000000-0000-0000-0000-0000000f4003; F4=00000000-0000-0000-0000-0000000f4004
FL=00000000-0000-0000-0000-0000000f400a; FD=00000000-0000-0000-0000-0000000f400d; UI1=00000000-0000-0000-0000-0000000f4011; R6B=00000000-0000-0000-0000-0000000f4016
KD=00000000-0000-0000-0000-0000000f4021; KL=00000000-0000-0000-0000-0000000f4022; KC=00000000-0000-0000-0000-0000000f4023; KT=00000000-0000-0000-0000-0000000f4024; KR=00000000-0000-0000-0000-0000000f4025; L=00000000-0000-0000-0000-0000000f4026
q() { echo "select set_config('t7.$1', (select id::text from public.mock_test_questions where test_id='$2' and position=1), false);"; }
j() { echo "$(who $1 aal1) select public.mock_start('$2'); select public.mock_save_answer('$2', current_setting('t7.$3')::uuid, 1);"; [ "$4" = submitted ] && echo "select public.mock_submit('$2');"; true; }
rb "$(mk_sql $F5 f5 2 released 'reading|icas|{5}|false') $(mk_sql $F1 f1 2 released 'maths|naplan|{3,5}|false') $(mk_sql $F2 f2 2 released 'english|naplan|{}|true') $(mk_sql $F3 f3 2 released 'maths|selective-entry|{6}|false') $(mk_sql $F4 f4 2 released 'science|vce|{11,12}|false')
$(mk_sql $FL legacy-f 2 legacy none) $(mk_sql $FD fd 1 draft) $(mk_sql $UI1 ui1 0 draft none) $(mk_sql $R6B r6b 2 released)
$(mk_sql $KD k-draft 1 draft) $(mk_sql $KL k-later 2 released) update public.mock_tests set closes_at = now() + interval '2 days' where id='$KL';
$(mk_sql $KC k-closed 2 released 'english|vce|{11,12}|false') $(mk_sql $KT k-tb 2 released) $(mk_sql $KR k-rv 2 released)
set local session_replication_role = replica; update public.mock_tests set subject='interview-preparation', stream='old-stream' where id='$KR'; set local session_replication_role = origin;
$(mk_sql $L long 2 draft) update public.mock_tests set title=repeat('w', 150 - length('-$RUN'))||'-$RUN' where id='$L'; update public.mock_tests set status='released', released_at=now(), released_by=created_by where id='$L';
$(q a $F4) $(q b $R6B) $(q c $KC) $(q d $KT)
$(j user@local.test $F4 a submitted) $(j user@local.test $R6B b submitted) $(j student@local.test $KC c submitted) $(j student@local.test $KT d in_progress)
$(who admin@local.test aal2) select public.mock_close_now('$F5'); select public.mock_close_now('$F4'); select public.mock_close_now('$KC');
reset role;
select 'count', count(*) from public.mock_tests where title like 't7-%' or title like 'w%-$RUN';
select 'L', char_length(title)||'|'||status from public.mock_tests where id='$L';
select 'all', string_agg(title||':'||status||':'||coalesce(closes_at <= clock_timestamp(), false), ' ' order by title) from public.mock_tests where title like 't7-%';
$(who user@local.test aal1) select 'user sees', count(*) from public.mock_tests_for_me() where title like 't7-%' or title like 'w%-$RUN';
"
```


## Appendix B. Dry-run output (2026-11-18, `<RUN>` for the run id)

### `dr-closing.sh`

```
=== CD-1 and CD-2 release and set closing
past|P0001:mock_closes_in_past
now|P0001:mock_closes_in_past
setdraft|P0001:invalid_status
closenowdraft|P0001:invalid_status
future|ok
st1|released|true|true
again|P0001:invalid_status
change|ok
st2|t
setpast|P0001:mock_closes_in_past
setnow|P0001:mock_closes_in_past
clear|ok
st3|null
unknown|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
=== CD-3 close now with a submitted attempt, then a no-op
{"score": 0, "total": 2}
closenow|ok
st|true|true
again|ok
kept|t
=== CD-4 reopen keeps an in-progress attempt
closedlist|0
closedsave|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
reopen|ok
list|in_progress
open|in_progress|2
save2|ok
answers|2
=== CD-5 take-back on a closed test
withdraw|ok
st|draft|null|0|maths|naplan|true
{"score": 0, "total": 2}
withdraw|P0001:mock_has_attempts
st|released|true|2
=== CD-6 a closed test keeps its questions frozen
qins|P0001:mock_released
qupd|P0001:mock_released
qdel|P0001:mock_released
qcount|2
```

### `dr-s1.sh`

```
{"score": 1, "total": 2}
{"score": 1, "total": 2}
{"score": 1, "total": 2}
student@local.test list|t7-<RUN>-s1a:submitted:true
student@local.test openA|submitted|1|2|1|1|Because B1.
student@local.test startA|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
student@local.test submitA|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
student@local.test openB|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
student@local.test saveB|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
student@local.test submitB|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
student@local.test openC|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
student@local.test startC|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
parent@local.test list|t7-<RUN>-s1a:submitted:true
parent@local.test openA|submitted|1|2|1|1|Because B1.
parent@local.test startA|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
parent@local.test submitA|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
parent@local.test openB|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
parent@local.test saveB|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
parent@local.test submitB|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
parent@local.test openC|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
parent@local.test startC|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
user@local.test list|t7-<RUN>-s1a:submitted:true
user@local.test openA|submitted|1|2|1|1|Because B1.
user@local.test startA|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
user@local.test submitA|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
user@local.test openB|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
user@local.test saveB|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
user@local.test submitB|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
user@local.test openC|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
user@local.test startC|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
after B|null:1:1 null:1:1 null:1:1
admin list|t7-<RUN>-s1a:released:true:3 t7-<RUN>-s1b:released:true:0 t7-<RUN>-s1c:released:true:0
=== boundary
list|t7-<RUN>-bd1m
startA|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
startB|ok
```

### `dr-tags.sh`

```
=== TG release refused
untagged|P0001:mock_tags_missing
zeroq|P0001:mock_no_questions
pastfirst|P0001:mock_closes_in_past
nosubject|P0001:mock_tags_missing
nostream|P0001:mock_tags_missing
noyears|P0001:mock_tags_missing
years|ok
st|released|maths|naplan|{7,8}|false
=== TG direct status writes
authstatus|42501:permission denied for table mock_tests:Grant the required privileges to the current role with: GRANT UPDATE ON public.mock_tests TO authenticated;
pgdraftuntagged|P0001:mock_tags_missing
pgdrafttagged|ok
=== TG guard values (as admin aal2)
ok|ok
okyears|ok
untagged|ok
interview|23514:invalid_mock_tag:subject
unknownsub|23514:invalid_mock_tag:subject
ucat|23514:invalid_mock_tag:stream
interviews|23514:invalid_mock_tag:stream
label|23514:invalid_mock_tag:subject
y1|23514:invalid_mock_tag:year_levels
y13|23514:invalid_mock_tag:year_levels
dup|23514:invalid_mock_tag:year_levels
desc|23514:invalid_mock_tag:year_levels
yany|23514:invalid_mock_tag:year_levels
ynull|23514:invalid_mock_tag:year_levels
y0based|23514:invalid_mock_tag:year_levels
y2d|23514:invalid_mock_tag:year_levels
vcesel|23514:invalid_mock_tag:stream
made|3
=== TG released and closed: change yes, clear no
subj|ok
stream|ok
years|ok
toany|ok
clrsub|23514:mock_tag_kept:subject
clrstream|23514:mock_tag_kept:stream
clryears|23514:mock_tag_kept:year_levels
title|P0001:mock_released
instr|P0001:mock_released
badsub|23514:invalid_mock_tag:subject
csubj|ok
cyears|ok
cclrsub|23514:mock_tag_kept:subject
cclryears|23514:mock_tag_kept:year_levels
X|english|icas|{}|true|t7-<RUN>-rel|true
Y|science|vce|{9,10,11}|false|true
attempt|1|2|1
=== TG draft clear allowed, take-back keeps tags, close/reopen keeps tags
dclr|ok
withdraw|ok
X|null|null|{}|false
Y|draft|reading|icas|{4,5}|false
Y2|released|reading|icas|{4,5}|false
=== TG legacy
taker|t7-<RUN>-legacy|null|null|{}|false
open|{"stream": null, "subject": null, "any_year": false, "year_levels": []}
admin|null|null|{}|false
closenow|ok
reopen|ok
s1|ok
s2|ok
s3|23514:mock_tag_kept:subject
L|reading|null|{3,5}|false
=== TG removed value
keepdraft|ok
keeprel|ok
other|23514:invalid_mock_tag:subject
away|ok
back|23514:invalid_mock_tag:subject
X|maths|vce
Z|writing|naplan
=== TG who can write tags
student|ok
tutor|ok
adminaal1|ok
anon|42501:permission denied for table mock_tests:Grant the required privileges to the current role with: GRANT SELECT, UPDATE ON public.mock_tests TO anon;
X|null
colgrants|authenticated:INSERT:any_year authenticated:INSERT:instructions authenticated:INSERT:stream authenticated:INSERT:subject authenticated:INSERT:title authenticated:INSERT:year_levels authenticated:SELECT:any_year authenticated:SELECT:closes_at authenticated:SELECT:created_at authenticated:SELECT:created_by authenticated:SELECT:id authenticated:SELECT:instructions authenticated:SELECT:released_at authenticated:SELECT:released_by authenticated:SELECT:status authenticated:SELECT:stream authenticated:SELECT:subject authenticated:SELECT:title authenticated:SELECT:updated_at authenticated:SELECT:year_levels authenticated:UPDATE:any_year authenticated:UPDATE:instructions authenticated:UPDATE:stream authenticated:UPDATE:subject authenticated:UPDATE:title authenticated:UPDATE:year_levels
=== TG-2b an insert that is already released
insrelnone|P0001:mock_tags_missing
insrelsub|P0001:mock_tags_missing
insreltagged|ok
insdraftnone|ok
madeb|2
```

### `dr-removed.sh`

```
fx|interview-preparation|old-stream
same|ok
years|ok
stream|ok
streamback|23514:invalid_mock_tag:stream
taker|interview-preparation|naplan|{8}
```

### `dr-cc.sh`

```
ccA S1|ok
ccA S2|23514:mock_tag_kept:subject
ccA after|released|maths|null
ccB S1|ok
ccB S2|P0001:mock_tags_missing
ccB after|draft|null|null
ccC S1|ok
ccC S2|P0001:mock_tags_missing
ccC after|draft|null|null
ccCm S1|ok
ccCm S2|23514:mock_tag_kept:subject
ccD S1|ok
ccD S2|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
ccD after|released|maths|2026-11-17 19:50:44.433575+00
ccE S1|ok
{"score": 1, "total": 1}
ccE S2|ok
ccE after|released|maths|2026-11-17 19:50:44.68573+00
```

### `dr-az.sh`

```
tutor@local.test set|42501:not_admin
tutor@local.test close|42501:not_admin
tutor@local.test upd|0
tutor@local.test ins|42501:new row violates row-level security policy for table "mock_tests"
student@local.test set|42501:not_admin
student@local.test close|42501:not_admin
student@local.test upd|0
student@local.test ins|42501:new row violates row-level security policy for table "mock_tests"
parent@local.test set|42501:not_admin
parent@local.test close|42501:not_admin
parent@local.test upd|0
parent@local.test ins|42501:new row violates row-level security policy for table "mock_tests"
user@local.test set|42501:not_admin
user@local.test close|42501:not_admin
user@local.test upd|0
user@local.test ins|42501:new row violates row-level security policy for table "mock_tests"
admin aal1 upd|0
admin aal2 upd|1
admin attempts|42501:permission denied for table mock_test_attempts:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_attempts TO authenticated;
anon ins|42501:permission denied for table mock_tests:Grant the required privileges to the current role with: GRANT INSERT ON public.mock_tests TO anon;
```

### `dr-reg.sh`

```
keys|id,options,position,prompt,selected_option
draft|PGRST:{"code":"P0002","message":"not_found","details":null,"hint":null}
listdraft|0
tutor|42501:not_taker
admin as taker|42501:not_taker
admin attempts|42501:permission denied for table mock_test_attempts:Grant the required privileges to the current role with: GRANT SELECT ON public.mock_test_attempts TO authenticated;
aal1 close|42501:not_admin
aal1 set|42501:not_admin
anon close|42501:permission denied for function mock_close_now
anon set|42501:permission denied for function mock_set_closing
```

### `dr-cleanup.sh`

```
{"score": 0, "total": 2}
left|0
```

### `dr-fx4.sh`

```
{"score": 1, "total": 2}
{"score": 1, "total": 2}
{"score": 1, "total": 2}
count|15
L|150|released
all|t7-<RUN>-f1:released:false t7-<RUN>-f2:released:false t7-<RUN>-f3:released:false t7-<RUN>-f4:released:true t7-<RUN>-f5:released:true t7-<RUN>-fd:draft:false t7-<RUN>-k-closed:released:true t7-<RUN>-k-draft:draft:false t7-<RUN>-k-later:released:false t7-<RUN>-k-rv:released:false t7-<RUN>-k-tb:released:false t7-<RUN>-legacy-f:released:false t7-<RUN>-r6b:released:false t7-<RUN>-ui1:draft:false
user sees|10
```

### `dr-fx3.sh`

```
{"score": 1, "total": 2}
user list|t7-<RUN>-f1:not_started t7-<RUN>-f4:submitted
student list|t7-<RUN>-f1:in_progress
```

### `gr.sql`

```
private.check_mock_test_release_tags()|definer|search_path=""|anon=false|auth=false
private.check_mock_test_tags()|definer|search_path=""|anon=false|auth=false
public.mock_close_now(target uuid)|definer|search_path=""|anon=false|auth=true
public.mock_release(target uuid, closes timestamp with time zone)|definer|search_path=""|anon=false|auth=true
public.mock_set_closing(target uuid, closes timestamp with time zone)|definer|search_path=""|anon=false|auth=true
public.mock_test_open(target uuid)|definer|search_path=""|anon=false|auth=true
public.mock_tests_admin_list()|definer|search_path=""|anon=false|auth=true
public.mock_tests_for_me()|definer|search_path=""|anon=false|auth=true
public.mock_withdraw(target uuid)|definer|search_path=""|anon=false|auth=true
mock_tests_check_tags|CREATE TRIGGER mock_tests_check_tags BEFORE INSERT OR UPDATE ON public.mock_tests FOR EACH ROW EXECUTE FUNCTION private.check_mock_test_tags()
mock_tests_check|CREATE TRIGGER mock_tests_check BEFORE DELETE OR UPDATE ON public.mock_tests FOR EACH ROW EXECUTE FUNCTION private.check_mock_test()
mock_tests_insert_released_needs_tags|CREATE TRIGGER mock_tests_insert_released_needs_tags BEFORE INSERT ON public.mock_tests FOR EACH ROW WHEN ((new.status = 'released'::text)) EXECUTE FUNCTION private.check_mock_test_release_tags()
mock_tests_release_needs_tags|CREATE TRIGGER mock_tests_release_needs_tags BEFORE UPDATE ON public.mock_tests FOR EACH ROW WHEN (((old.status = 'draft'::text) AND (new.status = 'released'::text))) EXECUTE FUNCTION private.check_mock_test_release_tags()
mock_tests_set_updated_at|CREATE TRIGGER mock_tests_set_updated_at BEFORE UPDATE ON public.mock_tests FOR EACH ROW EXECUTE FUNCTION private.set_updated_at()
mock_tests_any_year_alone|CHECK ((NOT (any_year AND (cardinality(year_levels) > 0))))
mock_tests_check|CHECK (((status = 'released'::text) = (released_at IS NOT NULL)))
mock_tests_closes_only_released|CHECK (((closes_at IS NULL) OR (status = 'released'::text)))
mock_tests_instructions_check|CHECK ((char_length(instructions) <= 4000))
mock_tests_status_check|CHECK ((status = ANY (ARRAY['draft'::text, 'released'::text])))
mock_tests_title_check|CHECK (((char_length(btrim(title)) >= 2) AND (char_length(title) <= 150)))
mock_tests_year_levels_valid|CHECK (((year_levels <@ '{2,3,4,5,6,7,8,9,10,11,12}'::smallint[]) AND (array_ndims(year_levels) = 1) AND (array_lower(year_levels, 1) = 1)))
true|0
0
```

Timestamps (`ccD after`, `ccE after`) and `elapsed=` values: compare shape, not value.


## 11. Lead rulings after TSR round 1 (appended; frozen rows above unchanged)

1. **R-3 (BUG-2): plan error.** The v1 gate froze "gap kept" on delete (2026-11-17 `06-test-plan.md` BM-7: positions `1` and `3`), and the UI numbers questions by order, not by stored position. R-3's expected value `1` copied "contiguous" in error. Corrected expected value: the surviving question's stored position (`2` with the frozen steps). Every other check in R-3 stays. Round 1 records R-3 as PASS on this ruling.
2. **BR-1 (BUG-1): app bug, Minor, fixed in round 2.** A 375 px window with a fine pointer must not overflow when the closing date picker is open. Added row **BR-1b**: at 375 × 800 with `isMobile: false`, open the picker in both the Release dialog and Set closing date, in light and dark → `scrollWidth - clientWidth` = `0`; at 1280 the desktop picker still opens.
3. **`1|true` vs `1|t` (TS-5, TS-7, BS-3):** the same boolean, printed by a different client. Accepted as matching.
4. **Order changes (BR before BK) and recording the mobile repo state at Sitting 4:** accepted; neither changes a result.
5. **V-3 (BUG-3): app bug, Minor, fixed in round 2.** A closed test's edit page shows the released notice ("… can take it"). Added row **BR-1c**: on the edit page of a closed test (`k-closed`) the notice no longer says people can take it and states S-1 (those who submitted still see their result); a released, not-closed test (`k-later`) still shows the released notice; a draft still shows the draft notice.
