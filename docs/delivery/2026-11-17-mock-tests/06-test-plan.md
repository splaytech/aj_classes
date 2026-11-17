# 06 — Test plan: mock tests (v1)

Stage 6a of `/deliver`, Test Manager. Branch `feature/mock-tests`. Date 2026-11-18.
Inputs: [00](00-decisions.md) (L-1 to L-6, security #3), [01](01-requirement.md) (AC 1 to 44), [03](03-design.md),
[04](04-plan.md) (S8), [05](05-dev-notes.md), [06-security](06-security.md), the shared test-manager, tester,
tester-ui and tester-api roles, and the AJ Classes tester addendum (`~/second-brain/Projects/AJClasses/_agents/tester.md`).
House format: `docs/delivery/2026-11-13-open-sign-up/06-test-plan.md` and its `TSR.md`.

**Plan base: `124d3db`** (written at `4a402b4`, re-synced after fix batch 1 `736f987`/`893bba1`, fix batch 2
`3e20c19` and fix batch 3 `124d3db`). Every expected value below was read from the code and seed at `124d3db`
(file:line where it matters; migration line numbers are of `supabase/migrations/20261118100000_mock_tests.sql`,
unchanged since `3e20c19`).
At run time, if `git diff --quiet 124d3db HEAD -- apps/web/src supabase e2e package.json` fails, re-derive every
value marked **(count)** and every quoted string from the files at HEAD before comparing. A wrong expected value found
in the run is a plan error: the TSR records it and the lead rules on it. The run doesn't edit this plan.

`/test-and-ship` writes `docs/delivery/2026-11-17-mock-tests/TSR.md` (plus `bugs/`). **Write each row's Actual and
Result into the TSR as soon as the row runs.** Keep screenshots, HARs and traces under a gitignored `run-*/` folder;
commit only `TSR.md` and `bugs/`.

Row counts are at the end (§10). Lead rulings L-1 (takers are student, parent and user; tutors excluded), L-2
(prompt 1–2000), L-3 (any admin edits, releases and takes back), D-2 (answers shown after submit), L-5 (take-back
allowed until an attempt is submitted; it deletes in-progress attempts), L-6 (a zero-answer submit reveals the key,
accepted) and L-7 (AC 8 is the home link card; the top-bar item and the admin tile stay) are decided
(`00-decisions.md`, 01 appendix); no row tests them as open questions.

---

## 0. Set-up

### 0.1 Environment

- Repo `/Users/sjain/dev/work/aj_classes` at the plan base or HEAD (see above). Local Supabase only: API `:55321`,
  DB `:55322`, Studio `:55323`, Mailpit `:55324`. No hosted Supabase, Vercel or Google, not even read-only.
- **Start of run:** the run's single stack owner runs `pnpm db:reset` once (never while another agent reads the
  stack), then S-0. Nobody else resets, seeds or runs `db:test` during the run.
- Dev server (Sitting 3 only): `pnpm dev --port 5173 --strictPort` from `apps/web`; use `http://localhost:5173`; take
  the real URL from the run log. Stop it by PID (`lsof -tiTCP:5173 -sTCP:LISTEN`, confirm its cwd is this repo),
  never `pkill -f`.
- Browser rows (tester's, L-9): Playwright with the installed Chrome (`channel: 'chrome'`, a fresh profile, no real
  accounts), emulated viewports (never headless `--window-size`), a fresh context per account. Stub `window.confirm`
  in-page. The lead's V rows use the AJClassesBrowser Chrome (Claude in Chrome, `switch_browser` first), L-9.
- **Request guard.** One shared guard in the harness aborts every host except `localhost`, `127.0.0.1` and
  **`challenges.cloudflare.com`** and counts what it aborted. That one outside host is allowed on purpose (review-6a
  #1): the sign-in page's Turnstile widget (`@marsidev/react-turnstile`, local test site key from `apps/web/.env.local`)
  loads `https://challenges.cloudflare.com/turnstile/v0/api.js`, and without it the widget never reaches `Success!`
  and no browser row can sign in. Supabase hosted, Vercel and Google stay blocked. Self-test first: a
  `fetch('https://example.com')` must be counted as aborted, and a request to `challenges.cloudflare.com` must not.
- **Sign in (browser):** `/portal/login`, fill Email and Password (`local-password-123`, `supabase/seed.sql:13`),
  wait for the Turnstile widget's `Success!` (the local site key passes by itself), press **Sign in**.
  `admin@local.test` then passes `/portal/login/verify` by itself (the dev server enters the code from
  `VITE_LOCAL_ADMIN_TWO_STEP_KEY`, `apps/web/src/lib/local-dev-two-step.ts:10-18`).
- **Console errors** (every browser row): count `pageerror` events and `console.error` messages, **excluding** the
  browser's own `Failed to load resource` line for a request the row deliberately makes fail or be refused (list
  those in the Actual). Expected `0` unless a row says otherwise.

### 0.2 Helpers (dry-run on this machine, 2026-11-18, read-only; the local stack had the `3e20c19` migration)

Each tool call is a fresh zsh shell: start every block with the `export S=…` and `. "$S/t7.sh"` lines.

```sh
# One-off set-up: scratch dir, run id, and the publishable key in a 0600 header file (never on a command line)
export S=/path/to/run-scratch; mkdir -p "$S"; umask 077
echo "RUN=$(date +%s)" > "$S/run.env"
(cd /Users/sjain/dev/work/aj_classes && supabase status -o json > "$S/status.json")
python3 -I -c "import json; d=json.load(open('$S/status.json')); open('$S/anon.hdr','w').write('apikey: '+d['PUBLISHABLE_KEY']+'\n')"
# then write $S/t7.sh exactly as below
```

```sh
# $S/t7.sh
. "$S/run.env"
API=http://127.0.0.1:55321
CAPTCHA='XXXX.DUMMY.TOKEN.XXXX'
CLEAN='^[{]"(sub|role)"|^(CONTEXT|HINT|LINE|PL/pgSQL|DETAIL)|^ +|^$'
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
# A t7 mock test made by admin@ as postgres: $1 label, $2 question count, $3 draft|released. Prints its id.
# Question g: prompt 'Q<g> of <label>?', options A<g>,B<g>,C<g>, correct option 1 (B), explanation 'Because B<g>.' on odd g, '' on even.
mk_test() {
  id=$(db "insert into public.mock_tests (title, instructions, created_by) values ('t7-$RUN-$1', 'Fixture instructions for $1.', (select id from public.profiles where email='admin@local.test')) returning id")
  [ "${2:-0}" -gt 0 ] && db "insert into public.mock_test_questions (test_id, prompt, options, correct_option, explanation) select '$id', 'Q'||g||' of $1?', array['A'||g,'B'||g,'C'||g], 1, case when g % 2 = 1 then 'Because B'||g||'.' else '' end from generate_series(1,$2) g" > /dev/null
  [ "$3" = released ] && db "update public.mock_tests set status='released', released_at=now(), released_by=created_by where id='$id'" > /dev/null
  echo "$id"; }
qids() { db "select id from public.mock_test_questions where test_id='$1' order by position" | paste -sd' ' -; }
# Removes every t7 mock test, its attempts and answers (a released test must go back to draft before delete)
rm_t7() {
  db "delete from public.mock_test_attempts where test_id in (select id from public.mock_tests where title like 't7-%')"
  db "update public.mock_tests set status='draft', released_at=null, released_by=null where title like 't7-%' and status='released'"
  db "delete from public.mock_tests where title like 't7-%'"
  db "select count(*) from public.mock_tests where title like 't7-%'"; }
# Real tokens for PostgREST (password grant gives aal1). The token goes to a 0600 file, never a command line.
tok() { curl -s -X POST -H @"$S/anon.hdr" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"local-password-123\",\"gotrue_meta_security\":{\"captcha_token\":\"$CAPTCHA\"}}" "$API/auth/v1/token?grant_type=password" | python3 -I -c 'import json,sys; print("Authorization: Bearer "+json.load(sys.stdin).get("access_token",""))' > "$S/$1.hdr"; }
# $1 METHOD, $2 e-mail or 'anon', $3 path under /rest/v1/, $4 JSON body (optional). Prints "<status> <body>".
rest() { h="$S/$2.hdr"; [ "$2" = anon ] && h=/dev/null; curl -s -o "$S/last.json" -w '%{http_code}' -X "$1" -H @"$S/anon.hdr" -H @"$h" -H 'Content-Type: application/json' -H 'Prefer: return=representation' ${4:+-d "$4"} "$API/rest/v1/$3"; echo " $(cat "$S/last.json")"; }
# Two sessions at once (concurrency rows). $1 label, $2 e-mail, $3 aal, $4 SQL. Writes $S/cc-<label>.txt with output and elapsed seconds.
cc() { ( t0=$(python3 -I -c 'import time;print(time.time())'); out=$(docker exec supabase_db_aj_classes psql -U postgres -At -q -c "begin; select set_config('request.jwt.claims', '$(claims "$2" "$3")', true); set local role authenticated; $4; commit;" 2>&1 | grep -vE "$CLEAN" | paste -sd';' -); t1=$(python3 -I -c 'import time;print(time.time())'); echo "$1|$out|elapsed=$(python3 -I -c "print(round($t1-$t0,1))")" > "$S/cc-$1.txt" ) & }
# Draft tests never hold attempts (checked after every concurrency row)
invariant() { db "select count(*) from public.mock_test_attempts a join public.mock_tests t on t.id=a.test_id where t.status='draft'"; }
```

Dry-run results (read-only; nothing was written to the shared stack):

| Dry-run | Result |
|---|---|
| S-0 profiles query | the seven seed rows, exactly as S-0 below |
| `db "select count(*) from public.mock_tests"`, `… mock_test_attempts` | `0`, `0` |
| `db "select nope()"` (planted bad query) | `ERROR: function nope() does not exist`, exit 1 (the helper fails loudly) |
| `as_user tutor@ aal1 'select count(*) from public.mock_tests_for_me()'`; same for `admin@`, `inactive@` | `ERROR:  not_taker` each |
| same for `user@`, `parent@`, `student@` | `0` each (positive control: no released test yet) |
| `as_user admin@ aal2 'select count(*) from public.mock_tests_admin_list()'` / `aal1` | `0` / `ERROR:  not_admin` |
| `as_user tutor@ aal1 'select count(*) from public.mock_tests'` | `0` (RLS, not an error: 05 deviation 7) |
| `as_user user@ aal1 '… mock_test_attempts'`, `as_user admin@ aal2 '… mock_test_answers'` | `ERROR:  permission denied for table mock_test_attempts` / `… mock_test_answers` |
| `as_anon 'select count(*) from public.mock_tests'`, `as_anon '… mock_tests_for_me()'` | `ERROR:  permission denied for table mock_tests`, `ERROR:  permission denied for function mock_tests_for_me` |
| GR-1 to GR-4 catalogue queries | the exact values in those rows |
| `pg_get_function_result` of the two table functions (TK-1, AD-13) | as quoted in those rows |
| `select char_length(btrim(E'\t\t'))`, `private.items_within_length(array[E'\t','a'],300)` | `2`, `true` (AD-3 pin) |
| `private.sign_up_settings` | `open = true`, `email_open = true` (seed line 321 turns e-mail sign-up on locally) |

**Not dry-run** (they write): every fixture, every `as_rb`/`as_w`/`cc` row, `tok`/`rest` rows (a password grant
writes a session), the suites that use the stack (S-6 to S-9) and every browser row. Each states its expected value
from the code; the run records a mismatch as a plan error or a bug.

### 0.3 Fixtures and restoring them

- Seed accounts (`supabase/seed.sql:4-13`): `admin@` (admin, verified TOTP, aal2 in the browser), `newadmin@` (admin,
  **no** authenticator), `tutor@`, `inactive@` (tutor, `is_active = false`, auth-banned), `parent@` (parent of Aarav and
  Noah), `student@` (Aarav Demo, enrolled in Selective Entry Maths & Reasoning), `user@` (role `user`, active). All
  `@local.test`. There is **no** seeded invited user, inactive student, deactivated parent/user, student without a
  class, or second admin with two-step; the rows below build each one and restore it in the same row.
- **Mock tests:** every fixture title is `t7-<RUN>-<label>` (no seed mock tests exist). Fixture prompts, options and
  titles contain no `$`, "price", "pay" or the word "test" on its own (BW rows scan page text).
- **Seed account changes** (deactivate, inactive student row, unenrol, invited status) are done inside a rolled-back
  transaction (`as_rb`) for database rows. Browser rows that need them apply the change right before the step and
  restore it by e-mail in the same row; the row's last step checks the restore (S-0's profile line for that account).
- **Second admin with two-step (FX-NA).** `newadmin@` has no authenticator in the seed, so GoTrue would never give it
  an `aal2` token, and a crafted `aal2` claim for it is a state that can't happen (review-6a #2). FX-NA gives it a
  verified factor. **Sitting 1** applies FX-NA at the start of §2 (before the fixtures block) and removes it in CL-1;
  every `newadmin@ … aal2` row (AZ-9, AD-9, AD-12, AD-16, AD-17, CC-1 to CC-8) runs only while it is applied.
  **Sitting 3** keeps it off for BA-5 (which needs no authenticator), applies it at the start of BM-11, and removes it
  at the end of BM-13.
  Apply: `db "insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret) select gen_random_uuid(), id, 't7 second admin', 'totp', 'verified', now(), now(), 'LOCALDEVADMINKEYLOCALDEVADMINKEY' from auth.users where email='newadmin@local.test' returning id"` (save the id; the dev server's
  automatic code uses this key, so `newadmin@` passes the code step by itself).
  Restore: `db "delete from auth.mfa_factors where id='<saved id>'"`, then
  `db "select count(*) from auth.mfa_factors f join auth.users u on u.id=f.user_id where u.email='newadmin@local.test'"` → `0`.
- **Invited user (FX-INV):** a real e-mail sign-up, local only (e-mail sign-up is on locally: `seed.sql:321`).
  `curl … /auth/v1/signup` with `{"email":"t7-<RUN>-inv@local.test","password":"t7-throwaway-password-1","data":{"full_name":"Invited Tester"},"gotrue_meta_security":{"captcha_token":"XXXX.DUMMY.TOKEN.XXXX"}}`
  and the anon header file; open the newest `Confirm your e-mail for AJ Classes` link for that address in Mailpit
  (`:55324`). The account is `user|invited` until the finish step is saved. Removed by CL-1.
- **Concurrency rows** each build their own fixture and remove it at the end of the row (`rm_t7` removes all t7
  tests; run it only at the end of a sitting, or delete the row's own test by id).
- Clean-up CL-1 runs last in every sitting that wrote.

**S-0 start state (gate before any row).**

```sh
export S=…; . "$S/t7.sh"
db "select p.email||'|'||p.role||'|'||p.status||'|'||p.is_active from public.profiles p order by 1" | paste -sd' ' -
db "select count(*) from public.mock_tests"; db "select count(*) from public.mock_test_attempts"
db "select s.full_name||'|'||s.is_active from public.students s where s.profile_id=(select id from public.profiles where email='student@local.test')"
db "select open||'|'||email_open from private.sign_up_settings"
lsof -nP -iTCP:5173 -sTCP:LISTEN | wc -l
```

Expected (dry-run matched): `admin@local.test|admin|active|true inactive@local.test|tutor|active|false newadmin@local.test|admin|active|true parent@local.test|parent|active|true student@local.test|student|active|true tutor@local.test|tutor|active|true user@local.test|user|active|true`;
`0`; `0`; `Aarav Demo|true`; `true|true`; `0` (no dev server yet).

### 0.4 Sittings and ownership

- **Sitting 1, tester-api (~65 rows), owner of the local database for the sitting:** S-1 to S-5 and S-10 (no stack),
  then GR, AZ, AD (except AD-12), TK, AD-12, CC, then CL-1.
- **Sitting 2, tester-api (4 rows), still the stack owner:** S-6 to S-9 (they start their own dev server; stop it by
  PID afterwards), then CL-1 again.
- **Sitting 3, tester-ui (~70 rows), owner of the dev server and of browser fixtures:** BA, BM (except BM-20), BT,
  then BM-20 (it needs BT-1 to BT-18's attempts), BE, BW, BK, BR, R, then CL-1. Builds its own fixtures (Sitting 1's are gone). Takes the screenshots for V-1 to V-4.
- Testers run one at a time on the stack; nothing in Sitting 3 runs while Sitting 1 or 2 writes.
- Never mark a row BLOCKED for lack of budget: say NOT RUN and hand back.
- **Lead's rows:** V-1 to V-4 (real-browser visual judgement: does it look right and consistent, is it readable, in
  light and dark, at 375 and 1280 px). The Tester takes the screenshots; the lead gives the verdict. **Every other
  row is a tester's.**

---

## 1. Suites (Sitting 1 and 2, tester-api)

Each command as `cmd > "$S/<name>.log" 2>&1; echo "exit=$?"`, run separately (the root `pnpm check` stops at the first
failure, `04-plan.md` §6 note).

**S-1 — format.** AC 42. `pnpm format:check`.
Expected: exit 1 listing only `actionItems.md` and `supabase/.temp/linked-project.json` (L-4; `.prettierignore` has
`.worktrees/`). Any other file is a failure. Check the list with
`grep -E '^\[warn\] ' "$S/format.log" | grep -vE 'actionItems.md|supabase/.temp/linked-project.json|Code style issues'` → no lines.

**S-2 — lint.** AC 40, 42. `pnpm lint`. Expected: `exit=0` (eslint includes the no-raw-JSX-text rule that holds
house rule 2).

**S-3 — typecheck.** AC 42. `pnpm typecheck` (web and e2e). Expected: `exit=0`.

**S-4 — `pnpm test`.** AC 9, 11, 12, 14, 30, 39, 40, 41, 42, 43. Expected: web `Test Files  108 passed (108)`,
`Tests  999 passed (999)` **(count)**; e2e unit `ℹ tests 6`, `ℹ fail 0`; `test-deploy-order.mjs` ends `All checks passed.`
(05, fix batch 3 checks). The feature files in it (each must appear in the log as passed): `mock-tests.service.test.ts`,
`lib/mock-tests.test.ts`, `auth-errors.test.ts`, `MockQuestionDialog.test.tsx`, `MockTestResult.test.tsx`,
`MockTestTakeForm.test.tsx`, `MockTestsErrorBoundary.test.tsx`, `MockTestsLinkCard.test.tsx`, `PortalLayout.test.tsx`,
`admin-mock-test.test.tsx`, `admin-mock-tests.test.tsx`, `mock-test.test.tsx`, `mock-tests.test.tsx`,
`parent-home.test.tsx`, `student-home.test.tsx`, `user-home.test.tsx`, `Panels.test.tsx` and
`mock-tests-load-error.test.tsx` (fix batch 2: Try again on the four pages). Files on disk at the plan base
(`find apps/web -path '*/node_modules' -prune -o \( -name '*.test.ts' -o -name '*.test.tsx' \) -print | wc -l`): `108`.

**S-5 — production build and hosted-ref check.** AC 42. `VITE_APP_ENV=production pnpm build`, then the CI-style gate
build from `docs/testing/ci-gates.md` and `pnpm --filter web check:hosted-ref build/client`.
Expected: both builds `exit=0`; `check-hosted-ref: 0 files (of 186 scanned)` **(count)** (05 row 9).

**S-6 — `pnpm db:test`.** AC 1–7, 10–38 (database side), 42. Expected: `Files=23, Tests=1697` **(count)**,
`Result: PASS` (05, fix batch 2 checks), including `mock_tests_admin.test.sql`, `mock_tests_taker.test.sql` and
`open_sign_up_access.test.sql` (its allowlist of `authenticated` functions now includes the nine mock functions,
05 deviation 2), the L-5 cases (take-back deletes in-progress attempts; save, start and submit after it get
`not_found`) and the pin that `mock_test_questions` has exactly the four admin policies. Lift any cron pause first
(addendum).

**S-7 — `pnpm test:functions`.** AC 42. Restart the edge runtime first (`docker restart supabase_edge_runtime_aj_classes`;
05 notes a stale auth container failed 17 checks). Expected: `exit=0`, no `NOT OK`, `test-open-sign-up.mjs` prints
`All checks passed`. Afterwards `db "select count(*) from private.sign_up_emails"` → `0`.

**S-8 — e2e smoke.** AC 1, 18, 25, 26, 32, 36, 42. `node e2e/scripts/local-env.mjs > e2e/.env; pnpm --filter aj-classes-e2e test:smoke`.
Expected: `17 passed` **(count)** (7 spec files: admin-posts 5, invite-onboarding 2, mock-tests 2, open-sign-up 5,
our-approach 1, register-interest 1, staff-login 1), including both tests in `e2e/tests/mock-tests.spec.ts` and the
user nav assertion `['Latest news', 'Mock tests', 'Account']` in `open-sign-up.spec.ts`. Afterwards no `e2e-%` rows in
`mock_tests`, posts, enquiries or profiles, and nothing listening on 5173 (stop a leftover by PID).

**S-9 — CSP sweep.** AC 42. Rebuild the gate build (S-5) first if another build ran since, then
`pnpm --filter aj-classes-e2e test:csp`. Expected: `23 passed` **(count)** (05 row 9).

**S-10 — deploy order.** Deploy order (03 §9, 04 §7). `node supabase/scripts/test-deploy-order.mjs` (also inside S-4).
Expected: exit 0, `All checks passed.`, and the line confirming `db push` runs before `functions deploy` and
`config push`. Static: `grep -n 'run supabase db push' supabase/scripts/deploy.sh` → line `279`;
`grep -n 'functions deploy' supabase/scripts/deploy.sh` → line `296`; `grep -n 'config push --project-ref' supabase/scripts/deploy.sh` → line `334`
(279 < 296 < 334). Never run `deploy.sh` itself. `git diff --stat develop...HEAD -- supabase/scripts supabase/functions supabase/config.toml`
→ empty (this feature changes no deploy script, function or config).

---

## 2. Database and raw API rows (Sitting 1, tester-api)

Fixtures for §2.1 to §2.4, built once at the start of §2 and saved to `$S/fx.env`. FX-NA is applied first and its id
saved as `NA=<id>`:

```sh
export S=…; . "$S/t7.sh"
NA=$(db "insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret) select gen_random_uuid(), id, 't7 second admin', 'totp', 'verified', now(), now(), 'LOCALDEVADMINKEYLOCALDEVADMINKEY' from auth.users where email='newadmin@local.test' returning id"); echo "NA=$NA" > "$S/fx.env"
{ echo "REL3=$(mk_test rel3 3 released)"; echo "REL1=$(mk_test rel1 1 released)"; echo "DRAFT2=$(mk_test draft2 2 draft)"; echo "DRAFT0=$(mk_test draft0 0 draft)"; } >> "$S/fx.env"; cat "$S/fx.env"
. "$S/fx.env"; db "select title||'|'||status||'|'||(select count(*) from public.mock_test_questions q where q.test_id=t.id) from public.mock_tests t where title like 't7-%' order by title" | paste -sd' ' -
```

Expected: `NA=` and four more uuids; `db "select count(*) from auth.mfa_factors f join auth.users u on u.id=f.user_id where u.email='newadmin@local.test' and f.status='verified'"` → `1`;
`t7-<RUN>-draft0|draft|0 t7-<RUN>-draft2|draft|2 t7-<RUN>-rel1|released|1 t7-<RUN>-rel3|released|3`.
Every later block also runs `. "$S/fx.env"`.

### 2.1 Grants and catalogue

**GR-1 — table grants.** AC 7, 24, 37. Method: DB (read-only).
`db "select grantee||':'||table_name||':'||privilege_type from information_schema.role_table_grants where table_name like 'mock_test%' and grantee in ('anon','authenticated','public') order by 1" | paste -sd' ' -`
Expected (dry-run matched): `authenticated:mock_test_questions:DELETE authenticated:mock_test_questions:SELECT authenticated:mock_tests:DELETE authenticated:mock_tests:SELECT`
(nothing for `anon`, nothing at all on `mock_test_attempts` or `mock_test_answers`; migration `:631-641`).

**GR-2 — column grants.** AC 11, 19. Method: DB (read-only).
`db "select grantee||':'||table_name||':'||column_name||':'||privilege_type from information_schema.column_privileges where table_name like 'mock_test%' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE') order by 1" | paste -sd' ' -`
Expected (dry-run matched): exactly `…questions:correct_option:INSERT`, `…:correct_option:UPDATE`, `…:explanation:INSERT`,
`…:explanation:UPDATE`, `…:options:INSERT`, `…:options:UPDATE`, `…:prompt:INSERT`, `…:prompt:UPDATE`,
`…:test_id:INSERT`, `mock_tests:instructions:INSERT`, `…:instructions:UPDATE`, `mock_tests:title:INSERT`,
`…:title:UPDATE` (13 items, all `authenticated`). No `status`, `created_by`, `released_by`, `released_at`, `position`
or `test_id:UPDATE`.

**GR-3 — functions: execute, security definer, search path.** AC 7. Method: DB (read-only).
`db "select p.proname||':'||has_function_privilege('anon', p.oid, 'execute')||':'||has_function_privilege('authenticated', p.oid, 'execute')||':'||p.prosecdef||':'||coalesce(array_to_string(p.proconfig,','),'') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname like '%mock%' order by n.nspname, 1" | paste -sd' ' -`
Expected (dry-run matched): `can_take_mock_tests:false:false:true:search_path=""`, `check_mock_question:false:false:true:…`,
`check_mock_test:false:false:false:search_path=""` (security invoker since fix batch 1 C: it only compares old and
new), `require_mock_taker:false:false:true:…` (private), then the nine public functions
`mock_move_question`, `mock_release`, `mock_save_answer`, `mock_start`, `mock_submit`, `mock_test_open`,
`mock_tests_admin_list`, `mock_tests_for_me`, `mock_withdraw`, each `:false:true:true:search_path=""`. 13 items.

**GR-4 — RLS on, admin-only policies.** AC 1, 7, 37. Method: DB (read-only).
`db "select relname||':'||relrowsecurity from pg_class where relname in ('mock_tests','mock_test_questions','mock_test_attempts','mock_test_answers') order by 1" | paste -sd' ' -`;
`db "select tablename||':'||policyname||':'||cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,'') from pg_policies where tablename like 'mock_test%' order by 1" | paste -sd' ' -`
Expected: all four `:true`; eight policies, four on each of `mock_tests` and `mock_test_questions`
(`…_admin_select:SELECT`, `…_admin_insert:INSERT`, `…_admin_update:UPDATE`, `…_admin_delete:DELETE`), each `qual`
and/or `with_check` = `( SELECT private.is_admin() AS is_admin)`; none on attempts or answers.

**GR-5 — no other way out.** AC 33, 36, 37. Method: DB (read-only).
`db "select count(*) from pg_publication_tables where tablename like 'mock_test%'"` → `0` (dry-run matched);
`db "select count(*) from pg_views where definition ilike '%mock_test%'"` → `0`;
`db "select count(*) from pg_proc where prosrc ilike '%mock_test_questions%' and proname not like '%mock%'"` → `0`
(no other function reads the questions table).

### 2.2 Authorisation negatives: every function and table, per role

Function calls use the fixture ids: `T=$REL3`, `Q=<first id of qids $REL3>`, `D=$DRAFT2`.
The **probe set** below is run for each role in AZ-1 to AZ-8 (one block per role); each line prints one result.

```sh
export S=…; . "$S/t7.sh"; . "$S/fx.env"; Q=$(qids $REL3 | cut -d' ' -f1); E=<e-mail>; A=<aal>
for sql in "select count(*) from public.mock_tests_for_me()" "select public.mock_test_open('$REL3')" \
  "select public.mock_start('$REL3')" "select public.mock_save_answer('$REL3','$Q',1)" "select public.mock_submit('$REL3')" \
  "select count(*) from public.mock_tests_admin_list()" "select public.mock_release('$DRAFT2')" \
  "select public.mock_withdraw('$REL3')" "select public.mock_move_question('$Q',1)"; do
  echo "$(echo "$sql" | grep -oE 'mock_[a-z_]+' | head -1) => $(as_rb "$E" "$A" '' "$sql" | head -1)"; done
for t in mock_tests mock_test_questions mock_test_attempts mock_test_answers; do
  echo "select $t => $(as_user "$E" "$A" "select count(*) from public.$t" | head -1)"; done
echo "insert test => $(as_rb "$E" "$A" '' "insert into public.mock_tests (title) values ('t7-x')" | head -1)"
echo "insert question => $(as_rb "$E" "$A" '' "insert into public.mock_test_questions (test_id, prompt, options, correct_option) values ('$DRAFT2','x',array['a','b'],0)" | head -1)"
echo "update test => $(as_rb "$E" "$A" '' "update public.mock_tests set title='t7-hacked' where id='$DRAFT2'" | head -1)"
echo "delete test => $(as_rb "$E" "$A" '' "delete from public.mock_tests where id='$DRAFT2'" | head -1)"
db "select title from public.mock_tests where id='$DRAFT2'"
```

(Writes run inside `as_rb`, so nothing commits even when a call is wrongly allowed. `psql -q` prints no command
tags, so an update or delete that RLS filters to zero rows prints nothing; the last line proves nothing changed.)

**AZ-1 — anonymous, in the database.** AC 7. Method: DB (rolled back). The e-mail-based probe set doesn't fit an
anonymous caller, so it runs as this loop:

```sh
export S=…; . "$S/t7.sh"; . "$S/fx.env"; Q=$(qids $REL3 | cut -d' ' -f1)
# as_anon is read-only, which would refuse the writes for the wrong reason; this one is a rolled-back write transaction
anon_rb() { docker exec supabase_db_aj_classes psql -U postgres -At -q -c "begin; select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true); set local role anon; $1; rollback;" 2>&1 | grep -vE "$CLEAN"; }
for sql in "select count(*) from public.mock_tests_for_me()" "select public.mock_test_open('$REL3')" \
  "select public.mock_start('$REL3')" "select public.mock_save_answer('$REL3','$Q',1)" "select public.mock_submit('$REL3')" \
  "select count(*) from public.mock_tests_admin_list()" "select public.mock_release('$DRAFT2')" \
  "select public.mock_withdraw('$REL3')" "select public.mock_move_question('$Q',1)" \
  "select count(*) from public.mock_tests" "select count(*) from public.mock_test_questions" \
  "select count(*) from public.mock_test_attempts" "select count(*) from public.mock_test_answers" \
  "insert into public.mock_tests (title) values ('t7-x')" \
  "insert into public.mock_test_questions (test_id, prompt, options, correct_option) values ('$DRAFT2','x',array['a','b'],0)" \
  "update public.mock_tests set title='t7-hacked' where id='$DRAFT2'" "delete from public.mock_tests where id='$DRAFT2'"; do
  echo "$(echo "$sql" | cut -c1-40) => $(anon_rb "$sql" | head -1)"; done
db "select title from public.mock_tests where id='$DRAFT2'"
```

(Dry-run note: under `as_anon`'s `begin read only` the four writes print `cannot execute INSERT/UPDATE/DELETE in a
read-only transaction`, which proves nothing about grants; hence `anon_rb`. The function lines were dry-run with
`as_anon`: `permission denied for function mock_start`.)
Expected: every function line `ERROR:  permission denied for function <name>` (9 lines); every table line
`ERROR:  permission denied for table <name>` (4); the insert, update and delete lines
`ERROR:  permission denied for table mock_tests` / `…mock_test_questions` (4); the last line `t7-<RUN>-draft2`.

**AZ-2 — anonymous, through PostgREST.** AC 7. Method: raw API (`rest … anon …`).
Steps: `rest POST anon rpc/mock_tests_for_me '{}'`; the same for `mock_test_open`, `mock_start`, `mock_submit`
(`{"target":"<REL3>"}`), `mock_save_answer` (`{"target_test":…,"target_question":…,"chosen_option":1}`),
`mock_tests_admin_list` (`{}`), `mock_release`, `mock_withdraw` (`{"target":…}`), `mock_move_question`
(`{"target":"<Q>","step":1}`); `rest GET anon 'mock_tests?select=id'`, `mock_test_questions?select=id`,
`mock_test_attempts?select=id`, `mock_test_answers?select=attempt_id`.
Expected: every reply `401` with `"code":"42501"` and `permission denied for function …` / `… for table …` (13 replies).

**AZ-3 — tutor.** AC 1, 7. Method: DB, probe set with `E=tutor@local.test A=aal1`.
Expected: the five taker functions `ERROR:  not_taker`; `mock_tests_admin_list`, `mock_release`, `mock_withdraw`,
`mock_move_question` `ERROR:  not_admin`; `select mock_tests => 0`, `select mock_test_questions => 0` (RLS);
attempts and answers `ERROR:  permission denied for table …`; insert test and insert question
`ERROR:  new row violates row-level security policy for table "mock_tests"` / `"mock_test_questions"`; update
and delete print nothing (RLS: zero rows); last line `t7-<RUN>-draft2`.
Repeat with `E=tutor@local.test A=aal2`: identical (aal2 does not make a tutor an admin).

**AZ-4 — invited (unfinished) user.** AC 5. Method: DB (rolled back). Run the probe set with the `as_rb` fixture
argument `update public.profiles set status='invited' where email='user@local.test'` on every line (and
`as_user` lines replaced by `as_rb … "<same fixture>" "<select>"`).
Expected: taker functions `ERROR:  not_taker` (5); admin functions `ERROR:  not_admin` (4); tests and questions `0`;
attempts and answers permission denied; inserts RLS errors; last line `t7-<RUN>-draft2`. Afterwards S-0's line for
`user@local.test` is `user|active|true`.

**AZ-5 — inactive student row (active profile).** AC 6. Method: DB (rolled back), fixture
`update public.students set is_active=false where profile_id=(select id from public.profiles where email='student@local.test')`,
`E=student@local.test A=aal1`. Expected: as AZ-4 (`not_taker` ×5, `not_admin` ×4, …). Positive control in the same
shell without the fixture: `as_user student@local.test aal1 'select count(*) from public.mock_tests_for_me()'` → `2`
(REL3 and REL1).

**AZ-6 — deactivated profile: student, parent, user.** AC 6. Method: DB (rolled back), fixture
`update public.profiles set is_active=false where email='<E>'`, for `E` = `student@`, `parent@`, `user@local.test`.
Expected for each: as AZ-4. Positive control without the fixture: `… mock_tests_for_me()` → `2` for each.
Also `inactive@local.test` (seed, deactivated tutor), no fixture: taker functions `not_taker`, admin `not_admin`.

**AZ-7 — admin without aal2.** AC 1, 7. Method: DB, probe set with `E=admin@local.test A=aal1`, and again with
`E=newadmin@local.test A=aal1`.
Expected: taker functions `ERROR:  not_taker` (5: an admin is never a taker, L-1); admin functions `ERROR:  not_admin`
(4: `private.is_admin()` needs `aal2`, `20261006004522_staff_accounts.sql:132-135`); tests and questions `0`;
attempts and answers permission denied; inserts RLS errors; last line `t7-<RUN>-draft2`.

**AZ-8 — admin at aal2 as a taker.** AC 7 (L-1). Method: DB, `E=admin@local.test A=aal2`, the five taker lines only.
Expected: `ERROR:  not_taker` ×5. Positive control: `as_user admin@local.test aal2 'select count(*) from public.mock_tests_admin_list()'` → `4`.

**AZ-9 — admins see every row; takers see released only.** AC 2, 3, 4. Method: DB (read-only).
Expected: `as_user newadmin@local.test aal2 "select count(*) from public.mock_tests where title like 't7-%'"` → `4`
(a test made by `admin@` is visible to the other admin, AC 2); `… mock_tests_admin_list() where title like 't7-%'` → `4`.
For each of `student@`, `parent@`, `user@`: `as_user <E> aal1 "select string_agg(title, ',' order by title) from public.mock_tests_for_me()"`
→ `t7-<RUN>-rel1,t7-<RUN>-rel3` (no draft); `select public.mock_test_open('$DRAFT2')` → `ERROR:  not_found`;
`select public.mock_test_open(gen_random_uuid())` → `ERROR:  not_found`.

**AZ-10 — real user token through PostgREST.** AC 3, 7, 37. Method: raw API. `tok user@local.test`, then
`rest GET user@local.test 'mock_tests?select=id'`, `'mock_test_questions?select=id,correct_option'`,
`'mock_test_attempts?select=id'`, `'mock_test_answers?select=attempt_id'`;
`rest POST user@local.test rpc/mock_tests_admin_list '{}'`; `rest PATCH user@local.test "mock_tests?id=eq.<REL3>" '{"title":"t7-hacked"}'`;
`rest POST user@local.test mock_tests '{"title":"t7-user-made"}'`.
Expected: `200 []`; `200 []`; `403 … "code":"42501" … permission denied for table mock_test_attempts`;
`403 … mock_test_answers`; `403 … "message":"not_admin"`; `200 []` (RLS, nothing changed); `403 … "code":"42501" … row-level security`.
Then `db "select title from public.mock_tests where id='$REL3'"` → `t7-<RUN>-rel3`;
`db "select count(*) from public.mock_tests where title='t7-user-made'"` → `0`.

**AZ-11 — real admin token at aal1 (password only).** AC 1, 7. Method: raw API. `tok admin@local.test` (a password
grant gives `aal1`; the TOTP step is not done).
Expected: `rest POST admin@local.test rpc/mock_tests_admin_list '{}'` → `403 … "message":"not_admin"`;
`rest GET admin@local.test 'mock_tests?select=id'` → `200 []`; `rest POST admin@local.test rpc/mock_release '{"target":"<DRAFT2>"}'`
→ `403 … not_admin`; `db "select status from public.mock_tests where id='$DRAFT2'"` → `draft`.

**AZ-12 — real tutor and parent tokens.** AC 1, 7. Method: raw API. `tok tutor@local.test`, `tok parent@local.test`.
Expected: tutor `rpc/mock_tests_for_me` → `403 … "message":"not_taker"`; tutor `rpc/mock_tests_admin_list` →
`403 … not_admin`; tutor `GET mock_tests?select=id` → `200 []`; parent `rpc/mock_tests_admin_list` → `403 … not_admin`;
parent `GET mock_test_questions?select=correct_option` → `200 []`; parent `rpc/mock_tests_for_me` → `200` with two
rows (positive control).

### 2.3 Admin writes (database)

All as `admin@local.test` at `aal2` unless a row says `newadmin@`. `as_rb` rows change nothing.

**AD-1 — create: defaults.** AC 11. Method: DB (rolled back).
`as_rb admin@local.test aal2 '' "insert into public.mock_tests (title) values ('t7-$RUN-new') returning status||'|'||(created_by = auth.uid())||'|'||instructions||'|'||coalesce(released_at::text,'-')||'|'||coalesce(released_by::text,'-')"`
Expected: `draft|true||-|-` (status default `'draft'`, `created_by` default `auth.uid()`, migration `:22-25`).

**AD-2 — create: forbidden columns.** AC 11, 19. Method: DB (rolled back), one `as_rb` each:
`insert … (title, status) values ('t7-x','released')`; `insert … (title, created_by) values ('t7-x', '<user@ id>')`;
`insert … (title, released_at) values ('t7-x', now())`; `update public.mock_tests set status='released', released_at=now() where id='$DRAFT2'`;
`insert into public.mock_test_questions (test_id, prompt, options, correct_option, position) values ('$DRAFT2','x',array['a','b'],0,7)`.
Expected: each `ERROR:  permission denied for table mock_tests` (or `mock_test_questions` for the last) (GR-2).

**AD-3 — title and instructions limits.** AC 11, 17. Method: DB (rolled back), one `as_rb` insert each.
Expected: title `'a'` → `ERROR: … violates check constraint "mock_tests_title_check"`; `repeat('a',151)` → same;
`'  '` → same; `' a '` (one letter padded) → same; `'ab'` → `INSERT` succeeds; `repeat('a',150)` → succeeds;
instructions `repeat('x',4001)` → `… "mock_tests_instructions_check"`; `repeat('x',4000)` → succeeds.
**Pin (ruled not a bug):** title `E'\t\t'` (tabs only) is **accepted** by the database (`btrim(title)` strips spaces
only, migration `:19`), the same rule as assignment titles (`char_length(trim(title)) between 2 and 150`,
`20261007061232_classes_timetable_assignments.sql:74`). The row fails only if the two rules drift apart without a
ruling. The browser trims all whitespace first (BM-2).

**AD-4 — question shape and limits.** AC 12, 14. Method: DB (rolled back), each an `as_rb` insert into
`mock_test_questions (test_id, prompt, options, correct_option, explanation)` on `$DRAFT2`.
Expected `ERROR: … violates check constraint "mock_test_questions_shape"` for: options `array['a']`; seven options;
`correct_option` `2` with two options; `correct_option` `-1`; an option of 301 `x`; an option `''`; an option `' '`.
Expected `… "mock_test_questions_prompt_check"` for: prompt `''`; prompt `E'\n\t '`; prompt `repeat('x',2001)`.
Expected `… "mock_test_questions_explanation_check"` for: explanation `repeat('x',2001)`.
Expected no error (prints nothing; rolled back) for: prompt `repeat('x',2000)` with options `array['a','b']`; six
options of 300 `x` each with `correct_option` 5; explanation `repeat('x',2000)`.
(Check the constraint names first: `db "select conname from pg_constraint where conrelid='public.mock_test_questions'::regclass and contype='c' order by 1"`;
use what it prints if the generated names differ, and record that.)
Also `correct_option` null → `ERROR: null value in column "correct_option"`. "Two correct options" can't be expressed
(one smallint column), recorded as such.
Pin: an option of only a tab `E'\t'` is accepted (`items_within_length` uses `trim`, spaces only, as for
assignment options); the browser trims it first (BM-3).

**AD-5 — 1 to 100 questions.** AC 13. Method: DB (rolled back).
`as_rb admin@local.test aal2 "insert into public.mock_test_questions (test_id, prompt, options, correct_option) select '$DRAFT0', 'P'||g, array['a','b'], 0 from generate_series(1,99) g" "insert into public.mock_test_questions (test_id, prompt, options, correct_option) values ('$DRAFT0','hundredth',array['a','b'],0); select count(*) from public.mock_test_questions where test_id='$DRAFT0'; insert into public.mock_test_questions (test_id, prompt, options, correct_option) values ('$DRAFT0','one-oh-one',array['a','b'],0)"`
Expected: `100`, then `ERROR:  mock_too_many_questions` (trigger `:165-167`). Afterwards
`db "select count(*) from public.mock_test_questions where test_id='$DRAFT0'"` → `0`.

**AD-6 — order: new last, gaps, moves.** AC 13. Method: DB (rolled back), one transaction:
fixture (postgres) `insert` three questions `'P1','P2','P3'` into `$DRAFT0`, then as admin:
`select string_agg(prompt||':'||position, ',' order by position) …` (a); `delete … where prompt='P2'`;
(a) again; `select public.mock_move_question((select id … where prompt='P1'), 1)`; (a);
`select public.mock_move_question((select id … where prompt='P1'), 1)` (now last); (a);
`select public.mock_move_question((select id … where prompt='P3'), -1)` (P3 is now first); (a); `select public.mock_move_question(<P1 id>, 2)`;
`select public.mock_move_question(gen_random_uuid(), 1)`.
Expected: `P1:1,P2:2,P3:3`; `P1:1,P3:3` (gap kept); `P3:1,P1:3` (swapped with the nearest, `:367-376`); unchanged
`P3:1,P1:3` (last moved down is a no-op, no error); `P3:1,P1:3` (first moved up: no-op, no error); step 2 →
`ERROR:  invalid_input`; unknown id → `ERROR:  not_found`.

**AD-7 — edit and delete a draft; delete cascades.** AC 13, 16. Method: DB (rolled back).
`update public.mock_test_questions set prompt='Edited?', options=array['x','y','z','w'], correct_option=3, explanation='E' where id=<first of DRAFT2> returning prompt||'|'||cardinality(options)||'|'||correct_option`
→ `Edited?|4|3`; `delete from public.mock_test_questions where id=<second of DRAFT2> returning 1` → `1`;
`delete from public.mock_tests where id='$DRAFT2' returning id` → the id; then
`select count(*) from public.mock_test_questions where test_id='$DRAFT2'` → `0` (cascade, `:40`). After rollback
`db "select count(*) from public.mock_test_questions where test_id='$DRAFT2'"` → `2`.

**AD-8 — a released test is frozen.** AC 16, 19. Method: DB (rolled back), each as `admin@ aal2` on `$REL3`:
update title; update instructions; insert a question; update a question's prompt; update a question's
`correct_option`; delete a question; `mock_move_question(<first of REL3>, 1)`; `delete from public.mock_tests where id='$REL3'`;
`update public.mock_tests set status='draft' where id='$REL3'`.
Expected: the first eight `ERROR:  mock_released` (triggers `:114-120`, `:160-162`); the last
`ERROR:  permission denied for table mock_tests` (no `status` grant). Afterwards REL3 unchanged:
`db "select status||'|'||title||'|'||(select string_agg(prompt||':'||correct_option, ',' order by position) from public.mock_test_questions where test_id='$REL3') from public.mock_tests where id='$REL3'"`
→ `released|t7-<RUN>-rel3|Q1 of rel3?:1,Q2 of rel3?:1,Q3 of rel3?:1`.
Note: moving the **last** question of a released test down returns no error and changes nothing (no neighbour,
`:374-376`); record it, not a failure.

**AD-9 — release.** AC 17, 18, 22. Method: DB (rolled back), as admin aal2:
`select public.mock_release('$DRAFT0')`; `select public.mock_release('$REL3')`; `select public.mock_release(gen_random_uuid())`;
`select public.mock_release('$DRAFT2'); select status||'|'||(released_at is not null)||'|'||(released_by = auth.uid()) from public.mock_tests where id='$DRAFT2'`.
Expected: `ERROR:  mock_no_questions`; `ERROR:  invalid_status`; `ERROR:  not_found`; `released|true|true`.
And with `newadmin@local.test aal2` (L-3): `select public.mock_release('$DRAFT2'); select released_by=auth.uid() …` → `true`.

**AD-10 — take back to draft.** AC 20, 21, 35 (as amended by L-5; migration `:310-331`). Method: DB (rolled back).
(a) No attempt: `select public.mock_withdraw('$REL1'); select status||'|'||coalesce(released_at::text,'-')||'|'||coalesce(released_by::text,'-') from public.mock_tests where id='$REL1'`
→ `draft|-|-`; then in the same transaction `update public.mock_tests set title='t7-edited' where id='$REL1' returning title` → `t7-edited`.
(b) In-progress attempts only: fixture (postgres) `insert into public.mock_test_attempts (test_id, profile_id) values ('$REL3', <user@ id>), ('$REL3', <parent@ id>) ; insert into public.mock_test_answers (attempt_id, question_id, selected_option) select a.id, <first of REL3>, 1 from public.mock_test_attempts a where a.test_id='$REL3'`;
as admin `select public.mock_withdraw('$REL3'); select (select count(*) from public.mock_test_attempts where test_id='$REL3')||'|'||(select count(*) from public.mock_test_answers ans join public.mock_test_questions q on q.id=ans.question_id where q.test_id='$REL3')||'|'||status from public.mock_tests where id='$REL3'`
→ `0|0|draft` (L-5: in-progress attempts and their answers deleted in the same transaction).
(c) One submitted attempt: fixture as (b) plus `update public.mock_test_attempts set submitted_at=now(), score=1, total=3 where profile_id=<user@ id> and test_id='$REL3'`;
`select public.mock_withdraw('$REL3')` → `ERROR:  mock_has_attempts`; then
`select status from public.mock_tests where id='$REL3'` → `released`, and both attempts still present (`2`: the
in-progress one is not deleted when the take-back is refused).
(d) `select public.mock_withdraw('$DRAFT2')` → `ERROR:  invalid_status`; unknown id → `ERROR:  not_found`.
(e) After (b) in the same transaction, as `user@ aal1`: `select public.mock_start('$REL3')`, `mock_save_answer('$REL3', <first of REL3>, 1)`
and `mock_submit('$REL3')` → `ERROR:  not_found` each (test no longer released; `:500-503`, `:526-529`, `:574-577`),
and attempts for REL3 stay `0`.

**AD-11 — only draft and released exist.** AC 22. Method: DB.
As an admin a `status` write is a grant refusal (AD-2), so check the constraint as postgres, rolled back:
`docker exec supabase_db_aj_classes psql -U postgres -At -c "begin; update public.mock_tests set status='archived' where id='$DRAFT2'; rollback;" 2>&1 | grep -o 'mock_tests_status_check'`
→ `mock_tests_status_check`. Columns:
`db "select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='mock_tests'"`
→ `id,title,instructions,status,created_by,released_by,created_at,updated_at,released_at` (dry-run matched; no
schedule or archive column).

**AD-12 — admin list: columns and counts.** AC 23, 24. Method: DB. **Runs after TK-13.** Pre: TK-1 to TK-13 have run (REL3 has three
submitted attempts; REL1 gets one in-progress attempt here:
`as_w user@local.test aal1 "select public.mock_start('$REL1')"`).
`as_user newadmin@local.test aal2 "select title||'|'||status||'|'||question_count||'|'||submitted_count||'|'||coalesce(created_by_name,'-') from public.mock_tests_admin_list() where title like 't7-%' order by title" | paste -sd' ' -`
Expected: `t7-<RUN>-draft0|draft|0|0|Local Admin t7-<RUN>-draft2|draft|2|0|Local Admin t7-<RUN>-rel1|released|1|0|Local Admin t7-<RUN>-rel3|released|3|3|Local Admin`
(in-progress attempts are not counted, `:257-258`). Order of the unfiltered list: `updated_at desc, id` (check the
first row is the test changed last).

**AD-13 — admin list shape: no taker data.** AC 24, 37. Method: DB (read-only).
`db "select pg_get_function_result('public.mock_tests_admin_list()'::regprocedure)"`
Expected (dry-run matched): `TABLE(id uuid, title text, status text, question_count integer, submitted_count integer, created_by_name text, created_at timestamp with time zone, updated_at timestamp with time zone, released_at timestamp with time zone)`
(no taker name, answer, score or e-mail column; the only name is the creator's).

**AD-14 — a question for a test that doesn't exist.** Security #3 (migration `:153-159`). Method: DB (rolled back).
`as_rb admin@local.test aal2 '' "insert into public.mock_test_questions (test_id, prompt, options, correct_option) values (gen_random_uuid(), 'x', array['a','b'], 0)"`
→ `ERROR:  not_found`. Cascade still works: AD-7's draft delete removes its questions with no error. The API half
is BM-21 (browser, stale page).
`db "select count(*) from public.mock_test_questions q left join public.mock_tests t on t.id=q.test_id where t.id is null"` → `0`.

**AD-15 — last changed follows question edits.** AC 23. Method: DB (rolled back).
`as_rb admin@local.test aal2 "update public.mock_tests set updated_at = now() - interval '1 day' where id='$DRAFT2'" "insert into public.mock_test_questions (test_id, prompt, options, correct_option) values ('$DRAFT2','new',array['a','b'],0); select (updated_at > now() - interval '1 minute') from public.mock_tests where id='$DRAFT2'"`
Expected: `t` (trigger `:175`).

**AD-16 — any admin edits; last save wins.** AC 15 (L-3). Method: DB (rolled back), one transaction:
as `admin@` `update public.mock_tests set title='t7-first' where id='$DRAFT2'`, then (same transaction, claims
switched to `newadmin@ aal2` with a second `set_config`) `update … set title='t7-second' …`, then
`select title, (created_by = (select id from public.profiles where email='admin@local.test'))`.
Expected (each update with `returning title`): `t7-first`, `t7-second`, then `t7-second|t` (no lock, creator unchanged).

**AD-17 — any admin takes back and moves.** AC 15, 20 (L-3). Method: DB (rolled back), as `newadmin@ aal2`:
`select public.mock_withdraw('$REL1')` → no error (REL1 made by `admin@`; it has no submitted attempt at this
point, so the take-back works whatever in-progress attempts exist); `select public.mock_move_question(<first of DRAFT2>, 1)` → no error.

### 2.4 Taker functions (database)

Journeys commit (`as_w`) on t7 fixtures; CL-1 removes them. `Qn` = the n-th id of `qids $REL3`.

**TK-1 — the list: shape and statuses.** AC 3, 4, 25, 33. Method: DB.
`db "select pg_get_function_result('public.mock_tests_for_me()'::regprocedure)"` → (dry-run matched)
`TABLE(id uuid, title text, question_count integer, status text, score integer, total integer, submitted_at timestamp with time zone, released_at timestamp with time zone)`.
For `user@ aal1`: `as_user … "select title||'|'||question_count||'|'||status||'|'||coalesce(score::text,'-')||'|'||coalesce(total::text,'-')||'|'||(submitted_at is null) from public.mock_tests_for_me() order by released_at desc, id" | paste -sd' ' -`
Expected before any start: two rows, each `…|not_started|-|-|true`, REL3 `|3|`, REL1 `|1|`, no draft. After TK-3:
REL3 `in_progress|-|-|true`. After TK-8: REL3 `submitted|1|3|false`.

**TK-2 — open, not started.** AC 26, 33. Method: DB (read-only), `user@ aal1`.
`as_user … "select string_agg(k, ',' order by k) from jsonb_object_keys(public.mock_test_open('$REL3')) k"` →
`id,instructions,question_count,questions,score,status,submitted_at,title,total`;
`… "select j->>'status'||'|'||jsonb_array_length(j->'questions')||'|'||(j->>'question_count')||'|'||coalesce(j->>'score','-')||'|'||(j->>'instructions') from public.mock_test_open('$REL3') j"`
→ `not_started|0|3|-|Fixture instructions for rel3.`

**TK-3 — start, save, open in progress.** AC 26, 27, 28, 33, 36. Method: DB.
`as_w user@local.test aal1 "select public.mock_start('$REL3'); select public.mock_start('$REL3')"` (double tap);
`db "select count(*) from public.mock_test_attempts where test_id='$REL3' and profile_id=(select id from public.profiles where email='user@local.test')"` → `1`.
`as_w user@local.test aal1 "select public.mock_save_answer('$REL3','$Q1',1); select public.mock_save_answer('$REL3','$Q2',2); select public.mock_save_answer('$REL3','$Q2',0)"`
(Q1 right; Q2 changed to a wrong option; Q3 left blank).
`db "select count(*) from public.mock_test_answers ans join public.mock_test_attempts a on a.id=ans.attempt_id join public.profiles p on p.id=a.profile_id where p.email='user@local.test' and a.test_id='$REL3'"` → `2` (upsert, one row per question).
`as_user user@local.test aal1 "select string_agg(k, ',' order by k) from (select distinct jsonb_object_keys(q) k from jsonb_array_elements(public.mock_test_open('$REL3')->'questions') q) s"`
→ `id,options,position,prompt,selected_option`;
`… "select string_agg(coalesce(q->>'selected_option','null'), ',' order by (q->>'position')::int) from jsonb_array_elements(public.mock_test_open('$REL3')->'questions') q"` → `1,0,null`;
`… "select j->>'status'||'|'||coalesce(j->>'score','-')||'|'||coalesce(j->>'total','-')||'|'||strpos(j::text,'correct_option')||'|'||strpos(j::text,'explanation')||'|'||strpos(j::text,'Because') from public.mock_test_open('$REL3') j"`
→ `in_progress|-|-|0|0|0`.

**TK-4 — answer-key leak sweep: every taker return shape before submit.** AC 33, 36. Method: DB (read-only, `user@`
in progress on REL3, `parent@` not started on REL3).
For each of `"select json_agg(t)::text from public.mock_tests_for_me() t"`,
`"select public.mock_test_open('$REL3')::text"` (user in progress), `"select public.mock_test_open('$REL1')::text"`
(not started), and as `parent@` `"select public.mock_test_open('$REL3')::text"`:
`as_user <E> aal1 "select strpos(x,'correct_option')||'|'||strpos(x,'explanation')||'|'||strpos(x,'Because') from (<query>) s(x)"`
Expected: `0|0|0` for all four. `mock_start` and `mock_save_answer` return `void` (empty output, checked in TK-3);
`mock_submit` returns only `{"score": …, "total": …}` (TK-8).
Positive control: after TK-8, the same check on `mock_test_open('$REL3')` as `user@` → three non-zero numbers.

**TK-5 — save refusals.** AC 28, 31. Method: DB (rolled back), each one `as_rb … ''` call as `user@ aal1` (in progress on REL3):
`mock_save_answer('$REL3', (select id from public.mock_test_questions where test_id='$REL1'), 0)` →
`ERROR:  invalid_question`; `mock_save_answer('$REL3','$Q1',-1)` → `invalid_option`; `…,3)` (three options) →
`invalid_option`; `…,null)` → `invalid_option`; `mock_save_answer('$REL1', <REL1 question>, 0)` (not started) →
`mock_not_started`; `mock_save_answer('$DRAFT2', <DRAFT2 question>, 0)` → `not_found`;
`mock_save_answer(gen_random_uuid(),'$Q1',0)` → `not_found`. As `parent@` (not started): `mock_submit('$REL3')` →
`ERROR:  mock_not_started`; `mock_submit('$DRAFT2')` → `ERROR:  not_found` (submit checks the test is released first,
`:574-577`).

**TK-6 — student journey, all correct.** AC 3, 10, 25, 32. Method: DB.
`as_w student@local.test aal1 "select public.mock_start('$REL3'); select public.mock_save_answer('$REL3','$Q1',1); select public.mock_save_answer('$REL3','$Q2',1); select public.mock_save_answer('$REL3','$Q3',1); select public.mock_submit('$REL3')"`
Expected: `{"score": 3, "total": 3}`.

**TK-7 — a student with no class, and a user with no student row.** AC 10. Method: DB (rolled back).
`as_rb student@local.test aal1 "delete from public.enrolments where student_id=(select id from public.students where profile_id=(select id from public.profiles where email='student@local.test'))" "select count(*) from public.mock_tests_for_me(); select public.mock_start('$REL1'); select public.mock_submit('$REL1')"`
→ `2`, then `{"score": 0, "total": 1}`. Afterwards
`db "select count(*) from public.enrolments where student_id=(select id from public.students where full_name='Aarav Demo')"`
→ same as before the row (record it before). `user@` has no `students` row
(`db "select count(*) from public.students where profile_id=(select id from public.profiles where email='user@local.test')"` → `0`)
and its journey is TK-3/TK-8.

**TK-8 — submit: score, blanks, idempotent.** AC 29, 31, 32, 34. Method: DB.
`as_w user@local.test aal1 "select public.mock_submit('$REL3')"` → `{"score": 1, "total": 3}` (Q1 right, Q2 wrong,
Q3 blank counts as incorrect). Save the time: `T1=$(db "select submitted_at from public.mock_test_attempts a join public.profiles p on p.id=a.profile_id where p.email='user@local.test' and a.test_id='$REL3'")`.
Then `as_w user@local.test aal1 "select public.mock_submit('$REL3'); select public.mock_start('$REL3')"` →
`{"score": 1, "total": 3}` (same); the attempt count for user@ on REL3 stays `1`, `submitted_at` equals `$T1`.
`as_rb user@local.test aal1 '' "select public.mock_save_answer('$REL3','$Q3',1)"` → `ERROR:  already_submitted`.

**TK-9 — open after submit reveals the key (D-2).** AC 32. Method: DB (read-only), `user@`.
`… "select string_agg(k, ',' order by k) from (select distinct jsonb_object_keys(q) k from jsonb_array_elements(public.mock_test_open('$REL3')->'questions') q) s"`
→ `correct_option,explanation,id,options,position,prompt,selected_option`;
`… "select string_agg((q->>'correct_option')||':'||(q->>'explanation')||':'||coalesce(q->>'selected_option','null'), ',' order by (q->>'position')::int) from jsonb_array_elements(public.mock_test_open('$REL3')->'questions') q"`
→ `1:Because B1.:1,1::0,1:Because B3.:null`; top level `status` `submitted`, `score` `1`, `total` `3`,
`submitted_at` not null.

**TK-10 — zero answers reveal the key (L-6, accepted, pinned).** AC 32, 33 (L-6). Method: DB, `parent@`.
`as_w parent@local.test aal1 "select public.mock_start('$REL3'); select public.mock_submit('$REL3')"` →
`{"score": 0, "total": 3}`; then
`as_user parent@local.test aal1 "select string_agg(q->>'correct_option', ',') from jsonb_array_elements(public.mock_test_open('$REL3')->'questions') q"`
→ `1,1,1`. This is the accepted behaviour (00-decisions L-6); the row fails only if it changes without a ruling.

**TK-11 — people never see each other's attempts.** AC 37, 38. Method: DB.
After TK-6, TK-8, TK-10: `db "select p.email||'|'||a.score||'/'||a.total from public.mock_test_attempts a join public.profiles p on p.id=a.profile_id where a.test_id='$REL3' order by 1" | paste -sd' ' -`
→ `parent@local.test|0/3 student@local.test|3/3 user@local.test|1/3`.
`as_user user@local.test aal1 "select string_agg(coalesce(q->>'selected_option','null'), ',' order by (q->>'position')::int) from jsonb_array_elements(public.mock_test_open('$REL3')->'questions') q"`
→ `1,0,null` (user's own, not the student's `1,1,1`); `as_user user@local.test aal1 "select score from public.mock_tests_for_me() where id='$REL3'"` → `1`.
No function takes an attempt or profile id: `db "select string_agg(pg_get_function_identity_arguments(oid), ' ; ') from pg_proc where proname in ('mock_tests_for_me','mock_test_open','mock_start','mock_save_answer','mock_submit')"`
→ only `target uuid` / `target_test uuid, target_question uuid, chosen_option integer` / empty (order may vary).
`strpos` of `@local.test`, `Local Admin`, `Aarav`, `Local Parent` in `mock_test_open('$REL3')::text` as `user@` → `0` each.

**TK-12 — a parent's attempt is the parent's own.** AC 38, M18. Method: DB.
`db "select (a.profile_id = (select id from public.profiles where email='parent@local.test'))||'|'||(select count(*) from public.students s where s.profile_id=a.profile_id) from public.mock_test_attempts a where a.test_id='$REL3' and a.profile_id=(select id from public.profiles where email='parent@local.test')"`
→ `true|0`. `db "select count(*) from public.mock_test_attempts a join public.students s on s.profile_id=a.profile_id where s.full_name in ('Aarav Demo','Noah Demo') and a.test_id='$REL3'"`
→ `1` (only `student@`'s own attempt from TK-6; nothing attached to a child by the parent).

**TK-13 — real token: the in-progress payload over HTTP.** AC 36. Method: raw API.
`tok student@local.test` is already submitted, so use REL1: `tok parent@local.test`;
`rest POST parent@local.test rpc/mock_start '{"target":"<REL1>"}'` → `204` (or `200` with empty body);
`rest POST parent@local.test rpc/mock_test_open '{"target":"<REL1>"}'` → `200`, body status `in_progress`, one question
with exactly the keys `id, options, position, prompt, selected_option`; `grep -c correct_option "$S/last.json"` → `0`;
`grep -c explanation "$S/last.json"` → `0`. Not-found over HTTP: `rest POST parent@local.test rpc/mock_test_open '{"target":"<DRAFT2>"}'`
→ `"code":"P0002","message":"not_found"`. Record the real HTTP status (L-8): a 4xx passes; **a 500 is a bug**
(file it; PostgREST's documented mapping sends class `P0` other than `P0001` to 500, not dry-run here).

### 2.5 Two-session concurrency (S8: AC 13, 19, 21)

Two psql sessions at once through `cc` (background) and `wait`. Session A holds its locks with `pg_sleep(5)` after its
write; session B starts with `pg_sleep(1)` so A is first. **B's elapsed time proves it waited** (expected 4.5 to 7 s);
A's elapsed is 5 to 7 s. Each row ends with `invariant` → `0` and removes its own fixture
(`db "delete from public.mock_test_attempts where test_id='<id>'; update public.mock_tests set status='draft', released_at=null, released_by=null where id='<id>'; delete from public.mock_tests where id='<id>'"`).
Never run two CC rows at once.

```sh
export S=…; . "$S/t7.sh"
# template: X=$(mk_test <label> <n> <draft|released>)
cc A admin@local.test aal2 "<A's write>; select pg_sleep(5)"
cc B newadmin@local.test aal2 "select pg_sleep(1); <B's write>"
wait; cat "$S/cc-A.txt" "$S/cc-B.txt"; invariant
```

**CC-1 — two admins add question 100 at once.** AC 13. Fixture `X=$(mk_test cc99 99 draft)`.
A (admin@): `insert into public.mock_test_questions (test_id, prompt, options, correct_option) values ('$X','A100',array['a','b'],0)`;
B (newadmin@): same with `'B100'`.
Expected: A no error; B `ERROR:  mock_too_many_questions` after waiting (elapsed 4.5–7); then
`db "select count(*)||'|'||max(position) from public.mock_test_questions where test_id='$X'"` → `100|100`; invariant `0`.

**CC-2 — positive control for CC-1.** AC 13. Fixture `X=$(mk_test cc98 98 draft)`, same two sessions.
Expected: both no error; B waited (4.5–7 s); count `100|100` and positions 99 and 100 taken once each
(`select count(distinct position) …` → `100`). Proves CC-1's refusal is the cap, not the method.

**CC-3 — release waits for an add, and sees it.** AC 17, 19. Fixture `X=$(mk_test ccrel1 1 draft)`.
A (admin@): insert question `'Second'`; B (newadmin@): `select public.mock_release('$X')`.
Expected: both no error; B waited; `db "select status||'|'||(select count(*) from public.mock_test_questions where test_id='$X')"` → `released|2`.

**CC-4 — an add after a release is refused.** AC 19. Fixture `X=$(mk_test ccrel2 1 draft)`.
A (admin@): `select public.mock_release('$X')`; B (newadmin@): insert question `'Late'`.
Expected: A no error; B `ERROR:  mock_released` after waiting; `released|1`.
Variant in the same row: A (admin@) deletes the only question of a fresh `mk_test ccrel3 1 draft`; B
`mock_release` → `ERROR:  mock_no_questions` after waiting; `draft|0`.

**CC-5 — take-back holds, start waits.** AC 21, 35 (L-5). Fixture `X=$(mk_test ccw1 2 released)`.
A (admin@ aal2): `select public.mock_withdraw('$X'); select pg_sleep(5)`; B (`user@local.test aal1`):
`select pg_sleep(1); select public.mock_start('$X')`.
Expected: A no error; B `ERROR:  not_found` after waiting (`mock_start` re-reads `status = 'released'` under
`for share`, `:500-503`); `draft`, attempts `0`; invariant `0`.

**CC-6 — start holds, take-back waits, then deletes the in-progress attempt.** AC 21, 35 (L-5). Fixture
`X=$(mk_test ccw2 2 released)`.
A (`user@ aal1`): `select public.mock_start('$X'); select public.mock_save_answer('$X', <first q>, 1); select pg_sleep(5)`;
B (admin@ aal2): `select pg_sleep(1); select public.mock_withdraw('$X')`.
Expected: A no error; B no error after waiting; then `draft`, attempts `0`, answers `0` (deleted under the test lock,
`:327`); invariant `0`.

**CC-7 — submit holds, take-back waits and is refused.** AC 21, 35 (L-5). Fixture `X=$(mk_test ccw3 2 released)`,
then `as_w user@local.test aal1 "select public.mock_start('$X')"` (committed, in progress).
A (`user@ aal1`): `select public.mock_submit('$X'); select pg_sleep(5)`; B (admin@ aal2):
`select pg_sleep(1); select public.mock_withdraw('$X')`.
Expected: A `{"score": 0, "total": 2}`; B `ERROR:  mock_has_attempts` after waiting (4.5–7 s; the submit holds the
test row `for share`, `:574`); `released`, one attempt with `submitted_at` set; invariant `0`. A submitted attempt on
a draft test, or a take-back that succeeds while the submitted attempt survives, is a FAIL.

**CC-8 — take-back holds, submit and save wait and are refused.** AC 21, 31, 35 (L-5). Fixture
`X=$(mk_test ccw4 2 released)` plus a committed `mock_start` and one `mock_save_answer` as `user@`.
A (admin@ aal2): `select public.mock_withdraw('$X'); select pg_sleep(5)`; B (`user@`):
`select pg_sleep(1); select public.mock_submit('$X')`.
Expected: A no error; B `ERROR:  not_found` after waiting (submit checks the test is still released before the
attempt, `:574-577`); `draft`, attempts `0`, answers `0`; invariant `0`.
Same row, fixture rebuilt (`ccw5`): B = `select pg_sleep(1); select public.mock_save_answer('$X', <second q>, 0)` →
`ERROR:  not_found` after waiting (`:526-529`); `draft`, attempts `0`; invariant `0`.

---

## 3. Browser rows (Sitting 3, tester-ui)

Sitting 3 fixtures (tester-ui, at the start, saved to `$S/fx3.env`): `B3=$(mk_test b3 3 released)`,
`B1=$(mk_test b1 1 released)`; others are made inside rows. Viewport 1280×800 and light unless a row says otherwise.
Each row: a fresh context per account, console errors per §0.1, and `document.querySelectorAll('meta[name="robots"]').length` → `1`.

### 3.1 Access, navigation and homes

**BA-1 — the portal nav per role.** AC 8. Accounts: tutor@, admin@, student@, parent@, user@.
Steps: sign in; read `nav[aria-label="Portal"] a` texts on the home page.
Expected (`PortalLayout.tsx:37-61`): tutor `Dashboard, Timetable, Classes, Assignments, My profile, Account`;
admin `Dashboard, Timetable, Classes, Assignments, My profile, Admin, Account`; student
`My work, Timetable, Mock tests, Account`; parent `My children, Mock tests, Account`; user
`Latest news, Mock tests, Account`.
Then open each taker's `…/mock-tests`: `Mock tests` has `aria-current="page"` and the home link has none
(`notUnder`, `:115-120`); on `/portal/student/timetable` only `Timetable` is current.

**BA-2 — admin reaches the page from the dashboard tile.** AC 1, 8. Account: admin@.
Steps: `/portal/admin` → Shortcuts → button `Mock tests` → URL `/portal/admin/mock-tests`; h1 `Mock tests`; intro
`Write mock tests here. Students, parents and signed-up users can take them once released.`; button `New mock test`.
Expected: as stated; the table lists `t7-<RUN>-b3` and `t7-<RUN>-b1` with status chips `Released`.

**BA-3 — tutor and parent are refused on the admin pages.** AC 1, 7. Accounts: tutor@, parent@.
Steps: open `/portal/admin/mock-tests` and `/portal/admin/mock-tests/<B3>`; record requests to `/rest/v1/`.
Expected: heading `You don't have access to this page`, text `This page isn't part of your account.`; no
`New mock test` button; no request to `rpc/mock_tests_admin_list` or `mock_tests?` is made.

**BA-4 — each area is its own role's only.** AC 1, 7, 8. Accounts: tutor@, admin@, student@, parent@, user@.
Steps: each opens the three taker lists `/portal/{student,parent,user}/mock-tests` and `/portal/<area>/mock-tests/<B3>`.
Expected: the own area loads (student → student, parent → parent, user → user); every other combination shows
`You don't have access to this page` — including tutor and admin on all three (AC 7, L-1). 

**BA-5 — admin without two-step is sent to set it up.** AC 1. Account: newadmin@ (no authenticator: FX-NA must be
off; check first `db "select count(*) from auth.mfa_factors f join auth.users u on u.id=f.user_id where u.email='newadmin@local.test'"` → `0`).
Steps: sign in, open `/portal/admin/mock-tests`.
Expected: URL `/portal/account/two-step/setup?next=%2Fportal%2Fadmin%2Fmock-tests` (`portal-access.ts:129-133`); no
mock test title on the page.

**BA-6 — signed out.** AC 7. No account.
Steps: open `/portal/admin/mock-tests`, `/portal/user/mock-tests/<B3>`.
Expected: URL `/portal/login?next=%2Fportal%2Fadmin%2Fmock-tests` and `/portal/login?next=%2Fportal%2Fuser%2Fmock-tests%2F<B3>`.

**BA-7 — an unfinished sign-up is held on the finish step.** AC 5. Account: FX-INV (`t7-<RUN>-inv@local.test`).
Steps: make FX-INV (§0.3); open the confirmation link in the browser; then go to `/portal/user/mock-tests` and
`/portal/user/mock-tests/<B3>`.
Expected: each lands on `/portal/join` (the finish step); no `rpc/mock_tests_for_me` or `rpc/mock_test_open` request
returns 200 (`db "select status from public.profiles where email='t7-<RUN>-inv@local.test'"` → `invited`).
Database half for the real invited account (moved here from AZ-4, which runs in Sitting 1 before FX-INV exists):
`as_user t7-$RUN-inv@local.test aal1 'select count(*) from public.mock_tests_for_me()'` → `ERROR:  not_taker`;
`as_user t7-$RUN-inv@local.test aal1 "select public.mock_test_open('<B3>')"` → `ERROR:  not_taker`.

**BA-8 — deactivated student, parent and user are signed out.** AC 6. Accounts: student@, parent@, user@.
Steps (each): sign in, open `…/mock-tests`; as postgres `db "update public.profiles set is_active=false where email='<E>'"`;
reload; then restore `db "update public.profiles set is_active=true where email='<E>'"` and check S-0's line.
Expected after the reload: URL `/portal/login?reason=inactive`, alert
`Your account is not active. Please contact hello@ajclasses.com.au.` (`login.tsx:54-55`, `error.constants.ts:37`);
no mock test title shown. After restore: `<E>|<role>|active|true`.

**BA-9 — a student whose roster row is inactive sees no mock tests.** AC 6. Account: student@.
Steps: as postgres `db "update public.students set is_active=false where profile_id=(select id from public.profiles where email='student@local.test')"`;
sign in; open `/portal/student/mock-tests` and `/portal/student/mock-tests/<B3>`; restore `… set is_active=true …`;
`db "select is_active from public.students where full_name='Aarav Demo'"` → `t`.
Expected: both pages show the error alert `You don't have permission to do that.` (`not_taker` → `notAllowed`,
`auth-errors.ts:63`); no `t7-` title on either page. (The profile is active, so the layout lets the student in; the
database refuses. Whether the student home itself behaves "as today" is unchanged by this feature.)

**BA-10 — the deactivated tutor can't sign in.** AC 7 (addendum). Account: inactive@.
Expected: sign-in refused, URL stays on `/portal/login` with an error alert; no portal page opens.

**BA-11 — the way in: link card on three homes only.** AC 8. Accounts: student@, parent@, user@, tutor@, admin@.
Steps: on `/portal/student`, `/portal/parent`, `/portal/user` find the card (heading `Mock tests`, text
`Practise for free with the mock tests we have released.`, button `See mock tests`); press it.
Expected: it opens `/portal/<area>/mock-tests` in the app (no full reload: `performance.getEntriesByType('navigation').length`
stays `1`). On `/portal/tutor`, `/portal/timetable`, `/portal/classes`, `/portal/student/timetable`,
`/portal/parent/children/<Aarav's student id>`: the text `See mock tests` is absent and no link to `/mock-tests`
exists. (L-7: AC 8 is this card. The top-bar `Mock tests` item, BA-1, and the admin dashboard tile, BA-2, stay.)

### 3.2 Admin: create, edit, reorder, release, take back, delete

Account `admin@` unless stated; FX-NA for the two-admin rows.

**BM-1 — an empty list.** AC 23. Pre: `rm_t7` (no mock tests at all; record and rebuild `B3`/`B1` after this row).
Expected: `/portal/admin/mock-tests` shows `No mock tests yet.` and the `New mock test` button; no table.

**BM-2 — create a draft.** AC 11, 17. Steps: `New mock test` → dialog `New mock test` with `Title` and
`Instructions (optional)`; type title `a`, press `Create mock test`.
Expected: field message `Please give the mock test a title (2–150 characters).`, the dialog stays,
`db "select count(*) from public.mock_tests where title='a'"` → `0`. The Title input has `maxlength="150"`, Instructions
`maxlength="4000"`. Then title `   ` (spaces) → same message. Then title `t7-<RUN>-made`, instructions two lines
`Line one` / `Line two` → `Create mock test` → URL `/portal/admin/mock-tests/<uuid>`; h1 `t7-<RUN>-made`; chip
`Draft`; info `Draft: only admins can see this mock test. Release it when it is ready.`; `Instructions` card shows the
two lines on two lines; Questions card `0 of 100 questions` and `No questions yet.`; `Release` button disabled with
text `Add at least one question to release this mock test.`; buttons `Edit details` and `Delete draft`.
DB: `… where title='t7-<RUN>-made'` → `draft|<admin@ id>`.

**BM-3 — question validation (nothing saved on refusal).** AC 12, 14. On `t7-<RUN>-made`.
Steps: `Add question` → dialog `New question`: two empty option rows `Option A`, `Option B`; their `Remove option A/B`
buttons are disabled. (a) Press `Save question` empty. (b) Prompt `What is 2 + 2?`, options `4`, `5`, no correct
radio, save. (c) Option B = three spaces, mark `Option A is correct`, save. (d) `Add option` four times.
Expected: (a) `Please write the question (up to 2000 characters).`, `Fill in every option (up to 300 characters each).`
shown under the options (the options message wins over the correct-option one, `MockQuestionDialog.tsx:146-147`);
(b) `Choose the correct option.`; (c) `Fill in every option (up to 300 characters each).`; (d) after four adds there
are six rows (`Option A` to `Option F`) and `Add option` is gone. Each refusal: dialog stays, no request to
`/rest/v1/mock_test_questions`, DB count for the test `0`. Prompt input `maxlength="2000"`, options `maxlength="300"`,
explanation `maxlength="2000"`.

**BM-4 — add three questions.** AC 12, 13. Add Q1 prompt `What is 2 + 2?` options `4`,`5` correct A, explanation
`Add them.`; Q2 `What is 3 + 3?` options `7`,`6` correct B, no explanation; Q3 `Pick C` options `x`,`y`,`z` correct C.
Expected: headings `Question 1`, `Question 2`, `Question 3` in that order; count `3 of 100 questions`; each card marks
its correct option (`Correct answer`), Q1 shows `Explanation: Add them.`; `Release` enabled and the hint gone.
DB: `select string_agg(prompt||':'||correct_option||':'||position, ',' order by position)` → `What is 2 + 2?:0:1,What is 3 + 3?:1:2,Pick C:2:3`.

**BM-5 — edit a question.** AC 13. `Edit` on Question 2 → dialog `Edit question` prefilled; change option A to `9`,
mark A correct, explanation `Nine is wrong on purpose`, save.
Expected: card shows the new option and correct answer; DB `What is 3 + 3?` → options `{9,6}`, `correct_option 0`.

**BM-6 — reorder.** AC 13. Buttons `Move question 1 up` and `Move question 3 down` are disabled; press
`Move question 1 down`, then `Move question 3 up`.
Expected: after the first press the order is `What is 3 + 3?`, `What is 2 + 2?`, `Pick C` (cards renumbered
`Question 1` to `3`); after the second `What is 3 + 3?`, `Pick C`, `What is 2 + 2?`. DB positions follow
(`string_agg(prompt, ',' order by position)`).

**BM-7 — delete a question.** AC 13. `Delete` on `Pick C` → dialog `Delete this question?` text
`Question 2 will be removed.` → confirm.
Expected: two cards, `2 of 100 questions`; DB count `2`, positions `1` and `3` (gap kept), UI numbers `Question 1`,
`Question 2`.

**BM-8 — edit details.** AC 11. `Edit details` → `Edit mock test` prefilled; title `t7-<RUN>-made2`, `Save`.
Expected: alert `Details saved.`; h1 `t7-<RUN>-made2`.

**BM-9 — the 100-question cap in the page.** AC 13. Pre: `X=$(mk_test b100 100 draft)`.
Expected: on `/portal/admin/mock-tests/<X>`: `100 of 100 questions`; `Add question` disabled; text
`You’ve reached the limit of 100 questions.`

**BM-10 — release with confirmation; read-only afterwards.** AC 18, 19, 22. On `t7-<RUN>-made2`.
Steps: `Release` → dialog `Release this mock test?`, text
`Students, parents and signed-up users will be able to take it free of cost. Questions and details can’t be changed after this.`;
first press `Cancel` (status stays `Draft`), then `Release` again and confirm `Release`.
Expected: alert `Released. People can take it now.`; chip `Released`; info
`Released: students, parents and signed-up users can take it. It can only go back to draft until someone submits it.`
(`mock-tests.constants.ts`, `releasedNote`); `This mock test is released, so its questions can’t change.`; **no** `Edit details`,
`Release`, `Delete draft`, `Add question`, `Edit`, `Delete` or `Move question …` controls (count `0` each); one
button `Take back to draft`; questions and correct answers still visible. DB `released` with `released_at` set.
No schedule or date field exists anywhere on the page (AC 22).

**BM-11 — every admin sees every test, with its creator.** AC 2, 23, 24. Accounts: admin@, newadmin@ (FX-NA).
Steps: **apply FX-NA now** (§0.3; save the id); newadmin@ signs in (its code is entered by the dev server) and
opens `/portal/admin/mock-tests`.
Expected: column headers exactly `Title, Status, Questions, Submitted, Created by, Last changed`; rows for every t7
test including `admin@`'s drafts; `Created by` `Local Admin` on each; `Last changed` a date and time. FX-NA stays on
through BM-12 and BM-13.

**BM-12 — last save wins between two admins.** AC 15. Accounts: admin@ and newadmin@ (FX-NA), two contexts on one
draft `Y=$(mk_test bm12 1 draft)`.
Steps: both open `/portal/admin/mock-tests/<Y>`; both press `Edit details`; A saves title `t7-<RUN>-fromA`; B (stale
dialog) saves `t7-<RUN>-fromB`; both reload.
Expected: both show `t7-<RUN>-fromB`; no lock or conflict message; DB `created_by` still `admin@`'s id.
Same for a question: both open `Edit` on Question 1; A saves prompt `From A`, B saves `From B` → `From B`.

**BM-13 — a stale page can't change a released test.** AC 19. Accounts: admin@ and newadmin@ on `Z=$(mk_test bm13 1 draft)`.
Steps: B opens the page (draft); A releases it; B (stale, still showing draft controls) presses `Add question`, fills
a valid question, saves; then `Edit details` → save; then `Delete draft` → confirm.
Expected: each time the alert `A released mock test can’t be changed. Take it back to draft first, if no one has submitted it.`
(`PORTAL_ERRORS.mockReleased`, `error.constants.ts:87-88`); DB unchanged (`released`, 1
question). **Remove FX-NA at the end of this row** (§0.3 restore → `0`).

**BM-14 — a stale page can't release twice.** AC 18, regression of `invalidStatus`. Accounts: admin@ in two tabs on
`W=$(mk_test bm14 1 draft)`.
Steps: tab A releases; tab B (stale) presses `Release` → confirm.
Expected: alert `That status change isn’t allowed.` (`error.constants.ts:82`, reworded from
`…allowed for this work.`, 05 deviation 6). DB `released`, `released_at` unchanged from tab A's.

**BM-15 — a stale page can't release a draft that lost its last question.** AC 17. Two tabs on
`V=$(mk_test bm15 1 draft)`: tab A deletes the only question; tab B (stale, Release enabled) → `Release` → confirm.
Expected: alert `Add at least one question before releasing.` (`mockNoQuestions`); DB `draft`, 0 questions.

**BM-16 — take back with no attempt, edit, release again.** AC 20. On `U=$(mk_test bm16 2 released)`.
Steps: `Take back to draft` → dialog `Take this mock test back to draft?`, text
`People won’t see it until you release it again. Anyone part-way through loses their answers. This only works while nobody has submitted it.`
→ confirm.
Expected: alert `Back to draft.`; chip `Draft`; edit controls back; edit Question 1's prompt to `Changed`; release
again → `Released`. DB `released`, Q1 prompt `Changed`, `released_at` newer than the first release.

**BM-17 — take back with an in-progress attempt.** AC 21, 35 (L-5). Accounts: admin@ and user@.
Pre: `U2=$(mk_test bm17 2 released)`; user@ starts it in the browser and answers Q1 (BT flow).
Steps: admin@ `Take back to draft` → confirm.
Expected: `Back to draft.`; chip `Draft`; DB attempts `0` and answers `0` for U2. The user's open page: choosing an
option now shows `We couldn't find that. It may have been removed, or you may not have access.` (`not_found` from
`mock_save_answer`, then `notFound`); reload → `Not found` panel; the user's list no longer shows U2. After the admin
releases it again, the user's list shows U2 as `Not started` (the attempt is gone).

**BM-18 — take back is refused once an attempt is submitted.** AC 21, 35 (L-5). Accounts:
admin@, user@. Pre: `U3=$(mk_test bm18 1 released)`; user@ starts and submits it.
Steps: admin@ `Take back to draft` → confirm.
Expected: alert `Someone has already submitted this mock test, so it can’t go back to draft.`
(`PORTAL_ERRORS.mockHasAttempts`, `error.constants.ts:90`); chip stays `Released`;
DB `released`, the attempt still `submitted`.

**BM-19 — delete a draft.** AC 16. On `t7-<RUN>-del` (`mk_test del 2 draft`).
Steps: `Delete draft` → dialog `Delete this draft?`, text `“t7-<RUN>-del” and its questions will be removed.` →
press `Cancel` first (still there), then confirm.
Expected: back on `/portal/admin/mock-tests`; the row is gone; DB tests `0` and questions `0` for its id. On a released
test the `Delete draft` button is absent (BM-10).

**BM-20 — list counts after people submit; no taker names.** AC 23, 24, 37. Pre: BT-1 to BT-12 done on `B3`
(student@ 2 of 3, parent@ submitted, user@ submitted) and `B1` (one in-progress attempt).
Expected: `B3` row `Released`, Questions `3`, Submitted `3`; `B1` Submitted `0`; page text contains none of
`Aarav Demo`, `Local Parent`, `Local User`, `student@local.test`, `parent@local.test`, `user@local.test`, and no score
text (`of 3 correct`). The only person name on the page apart from the header is `Local Admin` in `Created by`.

**BM-21 — a stale page adding to a deleted draft.** Security #3. Two tabs on
`T2=$(mk_test bm21 1 draft)`: tab A deletes the draft; tab B (stale) → `Add question` → valid question → save.
Expected: an error alert (not a silent success): the dialog stays open with
`We couldn't find that. It may have been removed, or you may not have access.` (`not_found` → `notFound`); the network
reply for `POST /rest/v1/mock_test_questions` carries `"code":"P0002"` and `"message":"not_found"` (not `201 []`);
record its HTTP status (L-8: a 500 is a bug); DB `select count(*) from public.mock_test_questions where test_id='<T2>'` → `0`.

### 3.3 Taking a mock test: student, parent, user

**BT-1 — the list.** AC 3, 25, 9. Account: student@.
Steps: `/portal/student/mock-tests`.
Expected: h1 `Mock tests`; intro `Free practice. You get one go at each mock test.`; one card per released test
(`B3`, `B1`, plus any other released t7 test; no draft), each with an `h2` title, `3 questions` / `1 question`, chip
`Not started`, a link `Start` to `/portal/student/mock-tests/<id>`; newest released first.

**BT-2 — the intro page and Start.** AC 26. Student@ opens `B3`.
Expected: h1 `t7-<RUN>-b3`, back link `← All mock tests`, chip `Not started`, card `Instructions` with
`Fixture instructions for b3.`, text `3 questions`, button `Start`; no question text on the page.
Press `Start`: DB one attempt for student@ on B3; the page shows `Question 1 of 3`, `Answered 0 of 3`, a fieldset whose
legend is `Q1 of b3?`, three radios `A A1`, `B B1`, `C C1`, buttons `Previous` (disabled), `Next`, `Submit`.
Then, still as student@, open `B1` in a second tab and double-click `Start` quickly: DB
`select count(*) from public.mock_test_attempts where test_id='<B1>' and profile_id=(select id from public.profiles where email='student@local.test')` → `1`.

**BT-3 — choose saves by itself.** AC 28. Student@ on B3: choose `B` (B1).
Expected: `Saving…` then `Saved` next to the heading; `Answered 1 of 3`; no save button exists; DB answer row
`selected_option 1` for Q1.

**BT-4 — move freely, leave blanks.** AC 29. `Next` → `Question 2 of 3`; `Next` → `Question 3 of 3` with `Next`
disabled; choose `A` (wrong); `Previous` twice → Question 1 still shows `B` chosen; Question 2 left blank.
Expected: as stated; `Answered 2 of 3`.

**BT-5 — the same attempt in another browser.** AC 27. A second context signed in as student@ opens B3.
Expected: `Question 1 of 3` with `B` checked; on Question 3 `A` checked; Question 2 none; `Answered 2 of 3`.

**BT-6 — a failed save keeps the choice.** AC 28. In context 1, route `**/rest/v1/rpc/mock_save_answer` to abort;
on Question 2 choose `C`.
Expected: `Not saved` next to the heading; alert `Not saved. Check your connection, then choose your answer again.`;
radio `C` stays checked; `Answered 2 of 3` (unchanged: the count uses saved answers only, fix batch 3); DB no answer
for Q2. Remove the route; choose `B` → `Saved`, alert gone, `Answered 3 of 3`; DB Q2 = 1.
Then choose nothing else (Q2 B right, Q1 B right, Q3 A wrong).

**BT-7 — submit asks, with the unanswered count.** AC 30. Account: user@ on `B3`, after `Start` with only Q1 answered.
Steps: `Submit` → dialog `Submit this mock test?` → `Cancel`; answer Q2; `Submit` again → read; `Cancel`.
Expected: first text `2 questions aren’t answered yet and will count as incorrect. You can’t change your answers after this.`;
second `1 question isn’t answered yet and will count as incorrect. You can’t change your answers after this.`;
`Cancel` leaves the attempt in progress (DB `submitted_at` null). Student@ (all three answered after BT-6) sees
`You’ve answered every question. You can’t change your answers after this.`

**BT-8 — submit and the result.** AC 31, 32, 33. Student@ confirms `Submit`.
Expected: the page shows card `Your result` with `2 of 3 correct`; card `Your answers` with `Question 1` to `3`, each
the prompt, `Your answer: B. B1` / `Your answer: B. B2` / `Your answer: A. A3`, `Correct answer: B. B1` etc., and
`Explanation: Because B1.` on Questions 1 and 3 only (Question 2's explanation is empty). Chip `Submitted`; no
radios, no `Submit`. DB score `2`, total `3`.

**BT-9 — the list after submit; no second attempt.** AC 25, 31, 34. Student@ on `/portal/student/mock-tests`.
Expected: B3 card chip `Submitted`, text `2 of 3 correct`, button `View result`; it opens the result (BT-8), not a
Start. Raw: `as_w student@local.test aal1 "select public.mock_start('$B3')"` → no error and DB still one attempt,
submitted.

**BT-10 — a stale tab after submit.** AC 31, regression of `alreadySubmitted`. Accounts: user@ in two tabs on B3
(in progress, Q1 and Q2 answered).
Steps: tab A submits; tab B (stale) chooses `C` on Question 3; then tab B presses `Submit` → confirm.
Expected: tab B alert `This has already been submitted, so answers can’t change.` (`error.constants.ts:85`); DB
answers unchanged (Q3 none); after tab B's submit it shows the same result as tab A (`mock_submit` returns the stored
score, `:587-589`), score unchanged in DB.

**BT-11 — no answer key on the wire before submit.** AC 33, 36. Account: parent@ on B3 (fresh).
Steps: capture every response body whose URL contains `/rest/v1/` from the list page through Start, three choices and
the submit dialog (before confirming).
Expected: none contains `correct_option`, `explanation` or `Because B`; no request to `/rest/v1/mock_test_questions`
is made by a taker page. **Positive control:** after confirming Submit, the next `rpc/mock_test_open` body contains
`correct_option` (the capture works).

**BT-12 — parent's whole journey.** AC 4, 10, 25 to 32, 38. Account: parent@ (continues BT-11).
Expected: list at `/portal/parent/mock-tests` (nav `Mock tests` current); intro, take and result as BT-2 to BT-8 with
the parent's own choices; the back link goes to `/portal/parent/mock-tests`; `/portal/parent` (My children) unchanged
and shows no mock test result for Aarav (M18, D-B1).

**BT-13 — user's whole journey.** AC 4, 10, 25 to 32. Account: user@ (continues BT-7, BT-10).
Expected: list at `/portal/user/mock-tests`; result `N of 3 correct` matching DB; back link to `/portal/user/mock-tests`.

**BT-14 — a newly released test shows on the next load only.** AC 18 (M19). Accounts: admin@, user@.
Steps: user@ has `/portal/user/mock-tests` open; admin@ releases `S=$(mk_test bt14 1 draft)` in its own context; user
waits 10 s without reloading, then reloads.
Expected: before reload the list has no `t7-<RUN>-bt14`; after reload it does, `Not started`.

**BT-15 — no other person's name or e-mail on taker pages.** AC 37, 38. Accounts: student@, parent@, user@.
Expected: on their list, intro, take and result pages, page text contains no `@local.test` address and no seed name
other than the signed-in person's own header name (`Aarav Demo` / `Local Parent` / `Local User`); `Local Admin`
(the creator) is absent from every taker page.

**BT-16 — zero answers submitted show every correct answer (L-6, pinned).** AC 32 (L-6). Account: user@ on
`P=$(mk_test bt16 2 released)` (its own fixture, so BM-20's counts on `B3`/`B1` are unchanged).
Steps: `Start`, `Submit` with nothing chosen → dialog says `2 questions aren’t answered yet…` → confirm.
Expected: `0 of 2 correct`; each question `Your answer: No answer.` and `Correct answer: B. B1` / `B. B2`. Accepted
behaviour (00-decisions L-6).

**BT-17 — the take page works on its own after a revalidation.** AC 26, 27. Account: student@ on
`R=$(mk_test bt17 2 released)`: `Start`, answer Q1, reload the page (hard reload).
Expected: `Question 1 of 2` with the chosen option checked, `Answered 1 of 2` (state comes from the server).

**BT-18 — a choice whose save failed counts as unanswered at submit.** AC 28, 30 (L-8, F-6). Account: parent@
on `F=$(mk_test bt18 2 released)`.
Steps: `Start`; choose `B` on Question 1 (`Saved`); route `**/rest/v1/rpc/mock_save_answer` to abort; `Next`, choose
`B` on Question 2 (`Not saved`); press `Submit` and read the dialog; `Cancel`.
Expected: radio `B` on Question 2 stays checked; `Answered 1 of 2`; dialog text
`1 question isn’t answered yet and will count as incorrect. You can’t change your answers after this.` (never
`You’ve answered every question.`; `MockTestTakeForm.tsx` counts from the saved map). Then remove the route, choose
`B` again on Question 2 → `Saved`, `Answered 2 of 2`, and the dialog says `You’ve answered every question. You can’t change your answers after this.`
Control: a question saved earlier keeps counting as answered when a later change fails (choose `A` on Question 1
with the route on again → `Answered 2 of 2`).

### 3.4 Errors and not found

**BE-1 — a page that fails to render shows the mock test boundary.** AC 39. Accounts: admin@ and user@.
Steps (one per route module): with `page.route` fulfil the named request with `200` and a malformed body, then open
the page:
(a) `/portal/user/mock-tests/<B3>`: `**/rpc/mock_test_open` →
`{"id":"x","title":"t","instructions":"","status":"in_progress","question_count":1,"score":null,"total":null,"questions":[{"id":"q","position":1,"prompt":"p","options":null,"selected_option":null}]}`;
(b) `/portal/admin/mock-tests/<B3>`: `**/rest/v1/mock_test_questions*` → `[{"id":"q","test_id":"x","position":1,"prompt":"p","options":null,"correct_option":0,"explanation":""}]`;
(c) `/portal/user/mock-tests`: `**/rpc/mock_tests_for_me` → `[{"id":"x","title":"t","question_count":1,"status":"nope","score":null,"total":null,"submitted_at":null,"released_at":null}]`;
(d) `/portal/admin/mock-tests`: `**/rpc/mock_tests_admin_list` → `[{"id":"x","title":"t","status":"draft","question_count":1,"submitted_count":0,"created_by_name":null,"created_at":"bad","updated_at":"bad","released_at":null}]`.
Expected for (a) and (b): an `h1` `Something went wrong`, text
`This page couldn't be shown. Please try again, and contact AJ Classes if it keeps happening.`, button `Try again`
inside a `role="alert"` region (`MockTestsErrorBoundary.tsx`); page text contains none of `TypeError`, `Cannot read`,
`undefined`, `null`, `at `; the portal header and nav are still there (the route's own boundary, not the portal root's).
Pressing `Try again` (route removed first) reloads and shows the real page. (c) and (d): record what renders; if no
render error is possible from that payload, record "no boundary reachable by malformed data" (not a failure) and
rely on S-4 (`MockTestsErrorBoundary.test.tsx` and each route test's `ErrorBoundary` export).

**BE-2 — a failed load shows a plain message and Try again.** AC 39. Accounts: user@, admin@.
Steps: route `**/rpc/mock_tests_for_me`, `**/rpc/mock_test_open`, `**/rpc/mock_tests_admin_list` and
`**/rest/v1/mock_tests*` to abort; open each of the four pages.
Expected on each page: an error alert `We couldn't reach the server. Check your connection and try again.` with a
button `Try again` inside the alert (`LoadError … retry`, `Panels.tsx`; `LOAD_ERROR.tryAgain`); no raw error text.
Remove the routes and press `Try again`: the page reloads (a new `navigation` entry) and shows its real content.
Control: a page outside mock tests that uses `LoadError` without `retry` (e.g. abort `**/rpc/admin_list_users` on
`/portal/admin/users`) shows its alert with **no** button (other pages unchanged).

**BE-3 — an unknown or draft id.** AC 3, 7. Account: user@.
Steps: open `/portal/user/mock-tests/00000000-0000-0000-0000-000000000000` and `/portal/user/mock-tests/<a draft id>`.
Expected: `h1` `Not found`, text `This page doesn't exist, or you don't have access to it.`; no draft title or
question text on the page. The `rpc/mock_test_open` reply carries `P0002` / `not_found`: record its HTTP status
(L-8: a 4xx passes, a 500 is a bug) and list it as the row's deliberate failing request.

### 3.5 Wording

**BW-1 — free, with no price words.** AC 9. Accounts: admin@, student@, parent@, user@.
Pages: admin list, admin edit (draft and released, release dialog open), taker list, intro, take (submit dialog
open), result, and the three link cards.
Check: `(document.body.innerText.match(/\$|\bprice|\bpay|\bpaid\b|upgrade|subscri|premium|checkout|purchase|\bbuy\b/gi) || []).length`.
Expected: `0` on every page. ("free of cost" in the release dialog and "free" on the list are required wording, AC 18.)
Prove the check fails: run it once on a page with an injected `<p>Upgrade for $5</p>` → `2`.

**BW-2 — "mock test", never "test" alone.** AC 41. Same pages.
Check: `(document.body.innerText.match(/(?<!mock )\btests?\b/gi) || []).length`.
Expected: `0` on every page. Prove it fails on an injected `<p>Start the test</p>` → `1`. Also each page uses
`question`, `option`, `attempt` wording from the constants (no "quiz", "exam").

### 3.6 Keyboard

**BK-1 — admin pages by keyboard.** AC 43. Account: admin@. Steps: from the address bar, Tab through
`/portal/admin/mock-tests` and a draft edit page with two questions; open each dialog with Enter/Space.
Expected: every control is reached by Tab in visual order (header, nav, `New mock test`, each title link; on the edit
page `Edit details`, `Release`, `Delete draft`, each `Move question n up/down` that is enabled, `Edit`, `Delete`,
`Add question`); focus is visible on each (outline or ring with non-zero width); in `New question` the correct-option
radios are one radio group moved by arrow keys, each named `Option X is correct`; Escape closes a dialog and focus
returns to the button that opened it (`document.activeElement` is that button, not `body`).

**BK-2 — taking by keyboard.** AC 43. Account: user@ on a fresh released test (`mk_test bk2 2 released`).
Steps: Tab to `Start`, Enter; Tab into the options; arrow keys.
Expected: the options are one `radiogroup` labelled by the prompt (`aria-labelledby` → the legend with the prompt
text), each a `radio` named `A A1`, `B B1`, `C C1` (letter and text); ArrowDown selects the next option and it saves
(`Saved`); Tab reaches `Next`, `Submit`; the submit dialog's buttons are reachable and Escape closes it with focus
back on `Submit`. After `Next`, focus is not lost to `body` (record where it lands).

**BK-3 — focus after the confirmations.** AC 43. Release confirm (BM-10), take-back confirm (BM-16), delete-question
confirm (BM-7) and submit confirm (BT-8), each completed by keyboard.
Expected: after each, `document.activeElement` is not `body` (record the element). A focus that lands on `body` is a
FAIL.

### 3.7 Widths and appearance

For each page in the set, at 375×800 and 1280×800, light and dark (Playwright `colorScheme`, and the header toggle
`Switch to dark mode` once to confirm it agrees), record:
`document.documentElement.scrollWidth - document.documentElement.clientWidth` → `0`;
`document.documentElement.getAttribute('data-portal-theme')` → `light` / `dark`;
`getComputedStyle(document.body).backgroundColor` → `rgb(255, 255, 255)` light / `rgb(11, 18, 32)` dark
(`styles/theme.css:23`, `:87`; `global.css:14-16`); console errors `0`; and the size of every button, link, radio
row and icon button (`getBoundingClientRect`) in the Actual (no frozen minimum; the lead judges in V rows).
Screenshot each (`run-*/shots/<row>-<page>-<width>-<theme>.png`).

**BR-1 — admin pages.** AC 44. Account: admin@. Pages: list with four tests (one title of 150 characters:
`L=$(mk_test long 3 draft)`, then `db "update public.mock_tests set title=repeat('w', 150 - length('-$RUN'))||'-$RUN' where id='$L'"`
and check `db "select char_length(title) from public.mock_tests where id='$L'"` → `150`), edit page of a draft with three
questions, edit page of a released test, `New mock test` dialog, `New question` dialog with six options, release
confirmation. Expected: as above, 6 pages × 2 widths × 2 themes = 24 measurements, all `0` overflow; the table
scrolls inside its own container at 375 if needed (record `TableContainer` `scrollWidth > clientWidth`).

**BR-2 — taker pages.** AC 44. Accounts: student@, user@. Pages: list (Not started, In progress and Submitted cards),
intro, take (question with a 300-character option), submit dialog, result, and the three homes with the link card.
Expected: as above for 8 pages × 2 × 2 = 32; each option row is at least 48 px tall (`minHeight: 48`,
`MockTestTakeForm.tsx`).

**BR-3 — the not-found and error states.** AC 39, 44. BE-1 (a), BE-3 at 375 and 1280, light and dark.
Expected: overflow `0`; boundary text and button visible without horizontal scroll.

### 3.8 Lead's visual rows (real-browser judgement, from the Tester's BR screenshots)

- **V-1** — admin list and edit pages (draft, released, 100 questions, long title), both dialogs: look right,
  consistent with Posts and Users, readable at 375 and 1280, light and dark; tap targets acceptable (F-8). AC 44.
- **V-2** — taker list, intro, take form (selected and unselected options, Saving/Saved/Not saved), result. AC 44.
- **V-3** — the three homes with the link card: placement and weight against the existing content. AC 8, 44.
- **V-4** — error boundary, failed-load alert and Not found panel: plain and calm, no raw text. AC 39.

---

## 4. Regression (Sitting 3, tester-ui unless stated)

**R-1 — assignment pages show the reworded `alreadySubmitted`.** AC 42. Account: student@ (Aarav).
Pre: record Aarav's state on `Times tables warm-up` (seed: no result row, published, all multiple choice):
`db "select count(*) from public.assignment_results r join public.assignments a on a.id=r.assignment_id where a.title='Times tables warm-up' and r.student_id=(select id from public.students where full_name='Aarav Demo')"` → `0`;
`T0=$(db "select now()")` and `OB=$(db "select count(*) from public.email_outbox")` (save both in the TSR).
Steps: two tabs on the assignment page; tab A answers all three and submits; tab B (stale) chooses an option.
Expected: tab B alert `This has already been submitted, so answers can’t change.` (was
`This work has already been submitted, so answers can’t change.`). Restore in the same row:


```sh
export S=…; . "$S/t7.sh"; T0='<saved>'
TT="(select id from public.assignments where title='Times tables warm-up')"; AA="(select id from public.students where full_name='Aarav Demo')"
db "select id||'|'||kind||'|'||recipient_role from public.email_outbox where assignment_id=$TT and student_id=$AA and created_at >= '$T0'"
db "delete from public.email_outbox where assignment_id=$TT and student_id=$AA and created_at >= '$T0'"
db "delete from public.assignment_answers where assignment_id=$TT and student_id=$AA"
db "delete from public.assignment_results where assignment_id=$TT and student_id=$AA"
db "select (select count(*) from public.assignment_results where assignment_id=$TT and student_id=$AA)||'|'||(select count(*) from public.assignment_answers where assignment_id=$TT and student_id=$AA)||'|'||(select count(*) from public.email_outbox where assignment_id=$TT and student_id=$AA and created_at >= '$T0')"
db "select count(*) from public.email_outbox"
```

Record the outbox ids printed by the first line in the TSR. Expected after the restore: `0|0|0`, and the last line
equals `$OB`.

**R-2 — `invalidStatus` wording and mapping.** AC 42. Method: static + S-4.
`grep -n "invalidStatus" apps/web/src/constants/error.constants.ts` → `82:  invalidStatus: 'That status change isn’t allowed.',`;
`grep -n "invalid_status: 'invalidStatus'" apps/web/src/services/auth-errors.ts` → line `97`; `auth-errors.test.ts`
green in S-4. The assignment trigger still raises `invalid_status` (`20261007090320_student_parent_portal.sql:575,578`,
`20261025110000_work_returned_email.sql:476,479`); no assignment screen offers an illegal status change, so the
browser check of the new wording is BM-14. `git grep -n "allowed for this work\|This work has already" -- apps/web/src` → no lines.

**R-3 — the user nav.** AC 42, AC 8. Account: user@. Expected: nav links exactly `Latest news, Mock tests, Account`
(and `Sign out` button); `Latest news` current on `/portal/user`, `Mock tests` current on `/portal/user/mock-tests`
and `/portal/user/mock-tests/<B3>`; the home still shows h1 `Latest news`, its intro, the link card, then the posts
list (`user-home.tsx`).

**R-4 — open sign-up still lands on Latest news, with mock tests.** AC 42, AC 4. Account: FX-INV (from BA-7).
Steps: on `/portal/join` finish the sign-up (full name `Invited Tester`, accept the terms, `Finish`).
Expected: URL `/portal/user`, h1 `Latest news`, nav `Latest news, Mock tests, Account`; the link card; its list at
`/portal/user/mock-tests` shows the released t7 tests as `Not started` (a brand-new user can take them, AC 4/M5);
DB `user|active`. Also S-8's `open-sign-up.spec.ts` green.

**R-5 — students' and parents' assignment flows.** AC 42. Accounts: student@, parent@.
Expected: `/portal/student` shows `My work` with the seed's to-do, waiting and returned work (titles
`Fractions quick quiz`, `Word problems set 1`, `Number patterns check` present) and the link card first; a returned
assignment opens with its marks; `/portal/parent` lists Aarav and Noah; Aarav's child page opens. Console `0`.

**R-6 — sign-in and reload for each role.** AC 42 (addendum). Accounts: admin@, tutor@, student@, parent@, user@.
Expected: each lands on its home (`/portal/admin`, `/portal/tutor`, `/portal/student`, `/portal/parent`,
`/portal/user`) and a reload keeps it; console `0`.

**R-7 — admin student list and Users page.** AC 42. Account: admin@.
Expected: `/portal/admin/students` lists the six seed students; `/portal/admin/users` loads with `user@local.test`;
the dashboard shortcuts now read `… Emails, Mock tests, Activity` in that order (`admin-dashboard.tsx:64-68`).

**R-8 — the public site says nothing about mock tests.** AC 42 (M13, D-B15). Method: browser + static.
Every `sitemap.xml` URL at 375 and 1280: status 200, console `0`, no sideways scroll, one `h1` (addendum sweep), and
`document.body.innerText` has no `mock test` (case-insensitive). Static: `git diff --stat develop...HEAD -- apps/web/src/routes/ apps/web/src/sections apps/web/public`
lists only `routes/portal/*` files; `apps/web/build/client/sitemap.xml` (S-5 build) has no `mock`.

**R-9 — mobile app untouched.** AC 42 (M1). Method: static. `git -C ~/dev/work/aj_classes_mobile status --short` and
`git -C ~/dev/work/aj_classes_mobile log -1 --format=%H` unchanged from the start of the run; no change to the
`app_role` enum (`git diff develop...HEAD -- supabase/migrations | grep -c 'app_role'` → `0`).

**CL-1 — clean-up (end of every writing sitting).** Owner: that sitting's tester.
`rm_t7` → `0`; `db "delete from auth.users where email like 't7-%@local.test'"`; `db "delete from private.sign_up_emails"`;
FX-NA factor removed: `db "delete from auth.mfa_factors where friendly_name='t7 second admin'"`, then
`db "select count(*) from auth.mfa_factors f join auth.users u on u.id=f.user_id where u.email='newadmin@local.test'"` → `0`; S-0 re-run → identical to the start; `db "select count(*) from public.mock_test_attempts"` → `0`;
nothing listening on 5173 (stopped by PID).

---

## 5. Not covered here (Saurabh's, outside the pass/fail set)

The TSR words these as "partly verified", never a plain PASS:

- **FS-1 — a real Google sign-up user takes a mock test** (M17, R-2): needs the Google client he creates. R-4 covers
  the e-mail path locally.
- **FS-2 — Privacy Policy wording** for stored answers and scores (R-1, security #4): his approval before release.
- **FS-3 — D-1, D-2, D-3 confirmations** (built as L-1, D-2 yes, L-3).
- **FS-4 — production deploy** (migration before web, one database for staging and production, `deploy.sh:26,30`):
  devops under his go-ahead. S-10 pins the order in the script only.
- Mobile (D-B10) is out of v1; R-9 only proves nothing changed.

## 6. Pre-freeze findings for the lead

All resolved; nothing open for the lead before freeze.

- F-1 (Try again on a failed load) fixed in fix batch 2: BE-2.
- F-2 (take-back copy says "submitted") fixed in fix batch 2: BM-10, BM-13, BM-16, BM-18.
- F-3 (submit and save against take-back) fixed in fix batch 2: CC-7, CC-8.
- F-4 (`not_found` HTTP status): L-8, accepted pending the run. TK-13, BE-3 and BM-21 record the real status; a 500
  is filed as a bug.
- F-5 (tabs-only title): ruled not a bug (same as assignments); AD-3 pins it.
- F-6 (failed save counted as answered) fixed in fix batch 3: BT-6, BT-18.
- F-7 (unused `MOCK_TAKE_PAGE.optionsLabel`) removed in fix batch 3: S-2 and S-4 hold it
  (`grep -rn optionsLabel apps/web/src/constants/mock-tests.constants.ts` → no lines).
- F-8 (36 px move buttons): L-8, no AC sets a size; BR-1 records the sizes and V-1 judges.
- The doc errors listed in the earlier version (03 §2.6 withdraw rule and its concurrency paragraph, 03 §4.4
  Previous/Next, 03 §8 AC 1 "42501/no rows", 03 §3.1 `invalid_question`) are recorded in the appendix of
  `03-design.md` (`bc20bac`). Still only in this plan: 04 S8 names the start/withdraw race, the races that matter
  after L-5 are submit and save against withdraw (CC-7, CC-8); 05's known gaps (two-session AC 13/19, user and
  parent browser take flows) are closed by CC-1 to CC-4, BT-12 and BT-13.

## 7. Traceability (AC → rows)

| AC | Rows |
|---|---|
| 1 | GR-4, AZ-3, AZ-7, AZ-11, AZ-12, BA-2, BA-3, BA-4, BA-5, S-8 |
| 2 | AZ-9, BM-11 |
| 3 | AZ-9, AZ-10, TK-1, TK-6, BT-1, BE-3 |
| 4 | AZ-9, TK-1, BT-12, BT-13, R-4 |
| 5 | AZ-4, BA-7 |
| 6 | AZ-5, AZ-6, BA-8, BA-9 |
| 7 | GR-1, GR-3, GR-4, AZ-1 to AZ-8, AZ-10 to AZ-12, BA-3, BA-4, BA-6, BA-10, BE-3 |
| 8 | BA-11, V-3 (the home link card, L-7); BA-1, BA-2, R-3 check the top-bar item and admin tile that stay (M15) |
| 9 | BW-1, BT-1, S-4 |
| 10 | TK-6, TK-7, BT-12, BT-13 |
| 11 | GR-2, AD-1, AD-2, AD-3, BM-2, BM-8 |
| 12 | AD-4, BM-3, BM-4 |
| 13 | AD-5, AD-6, AD-7, BM-4 to BM-7, BM-9, CC-1, CC-2 |
| 14 | AD-4, BM-3 |
| 15 | AD-16, AD-17, BM-12 |
| 16 | AD-7, AD-8, BM-19 |
| 17 | AD-3, AD-9, BM-2, BM-15, CC-3, CC-4 |
| 18 | AD-9, BM-10, BM-14, BT-14, S-8 |
| 19 | GR-2, AD-2, AD-8, BM-10, BM-13, CC-3, CC-4 |
| 20 | AD-10, AD-17, BM-16 |
| 21 | AD-10, BM-17, BM-18, CC-5 to CC-8 (L-5) |
| 22 | AD-9, AD-11, BM-10 |
| 23 | AD-12, AD-15, BM-1, BM-11, BM-20 |
| 24 | AD-12, AD-13, BM-11, BM-20 |
| 25 | TK-1, BT-1, BT-9, BT-12, BT-13, S-8 |
| 26 | TK-2, TK-3, BT-2, BT-17, S-8 |
| 27 | TK-3, BT-5, BT-17 |
| 28 | TK-3, TK-5, BT-3, BT-6, BT-18 |
| 29 | TK-8, BT-4 |
| 30 | BT-7, BT-18, S-4 |
| 31 | TK-5, TK-8, BT-9, BT-10, CC-8 |
| 32 | TK-6, TK-9, TK-10, BT-8, BT-16, S-8 |
| 33 | TK-1 to TK-4, TK-10, BT-8, BT-11 |
| 34 | TK-8, BT-9 |
| 35 | AD-10, BM-17, BM-18, CC-5 to CC-8 (L-5) |
| 36 | GR-5, TK-3, TK-4, TK-13, BT-11, S-8 |
| 37 | GR-1, GR-4, GR-5, AZ-10, AD-13, TK-11, BM-20, BT-15 |
| 38 | TK-11, TK-12, BT-12, BT-15 |
| 39 | BE-1, BE-2, BR-3, V-4, S-4 |
| 40 | S-2, S-4 |
| 41 | BW-2, S-4 |
| 42 | S-1 to S-10, R-1 to R-9 |
| 43 | BK-1, BK-2, BK-3, S-4 |
| 44 | BR-1, BR-2, BR-3, V-1, V-2, V-3 |

Every AC 1 to 44 has at least one row. Security #3 → AD-14, BM-21; L-6 → TK-10, BT-16; deploy order → S-10.

## 8. Who runs what

- **tester-api:** S-1 to S-10, GR-1 to GR-5, AZ-1 to AZ-12, AD-1 to AD-17, TK-1 to TK-13, CC-1 to CC-8, CL-1
  (Sittings 1 and 2).
- **tester-ui:** BA-1 to BA-11, BM-1 to BM-21, BT-1 to BT-18, BE-1 to BE-3, BW-1, BW-2, BK-1 to BK-3, BR-1 to BR-3,
  R-1 to R-9, CL-1 (Sitting 3), and the screenshots for V-1 to V-4.
- **Lead:** V-1 to V-4 (verdict), and rulings on §6.

## 9. Rows changed by the re-syncs to `3e20c19` and `124d3db`

GR-3 (`check_mock_test` is security invoker), S-4 and S-6 counts, AD-3 (tabs-only title pinned as accepted), AD-10
(L-5, plus start/save/submit `not_found` after a take-back), AD-14 and BM-21 (security #3), TK-5 (submit on a draft),
CC-5 to CC-8 (fixed lock order), BM-10, BM-13, BM-16, BM-18 (the "submitted" copy), BE-2 (Try again), BA-11 (L-7). At `124d3db`: S-4 count, BT-6 and new BT-18 (F-6), TK-13, BE-3 and BM-21
(L-8: a 500 is a bug). After review-6a round 1: §0.1 guard and L-9, FX-NA in Sitting 1, AZ-1 loop, AZ-4/BA-7,
BT-2, BM-11 to BM-13, BM-20 order, BR-1 title, R-1 restore.
No row depends on unmerged work any more.

## 10. Counts

| Area | Rows |
|---|---|
| Suites (S) | 10 |
| Grants and catalogue (GR) | 5 |
| Authorisation negatives (AZ) | 12 |
| Admin database (AD) | 17 |
| Taker database (TK) | 13 |
| Two-session concurrency (CC) | 8 |
| Browser: access and navigation (BA) | 11 |
| Browser: admin (BM) | 21 |
| Browser: take (BT) | 18 |
| Browser: errors (BE) | 3 |
| Browser: wording (BW) | 2 |
| Browser: keyboard (BK) | 3 |
| Browser: widths and appearance (BR) | 3 |
| Lead visual (V) | 4 |
| Regression (R) | 9 |
| Clean-up (CL) | 1 |
| **Total** | **140** |

S-0 is a start-state gate, not a row. FS-1 to FS-4 are Saurabh's and sit outside the pass/fail set.
