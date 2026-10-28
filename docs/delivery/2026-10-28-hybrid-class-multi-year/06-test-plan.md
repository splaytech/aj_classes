# 06 — Test plan: hybrid classes and multiple year levels

Stage 6a of `/deliver`, Tester. Branch `feature/hybrid-class-multi-year`. Date 2026-10-28.
Inputs: [01](01-requirement.md) (AC 1–19 and Amendments), [03](03-design.md) (§3, §4, §8, §12),
[04](04-plan.md) (S6, review-4 amendments, Developer notes), `git diff develop...HEAD`, the tester
addendum (`~/second-brain/Projects/AJClasses/_agents/tester.md`) and `supabase/README.md`.

**Build the plan was written against:** `7e527ef`, revised for `31ce0a4` (`test(db): cover tutor class writes at aal2`, now HEAD of this branch). The `/test-and-ship` run
executes this plan and writes the TSR in this folder (`TSR.md`, evidence in `evidence/`). It does
not edit the plan; a wrong expected value found during the run is a plan error, which the TSR
records and the lead rules on.

## What was dry-run for this plan, and what wasn't

The lead asked for no state-changing DB commands at this stage (Reviewer and Security are reading
the local DB). So:

| Dry-run on this machine (2026-10-28, `7e527ef`) | Result |
|---|---|
| Format gate (04 baseline item 2) | exit 0, "All matched files use Prettier code style!" |
| `pnpm lint && pnpm typecheck` (CI env) | exit 0 |
| `pnpm test` (CI env) | web `Test Files 66 passed (66)`, `Tests 568 passed (568)`; then e2e `test:unit` `tests 6` |
| The four feature test files (S-3) | `Test Files 4 passed (4)`, `Tests 31 passed (31)` |
| Static gates G1–G3 (S-5), each also shown to fail on a planted bad input | as stated per gate |
| Read-only psql on the current local DB | seed rows and constraint text exactly as in TC-14/TC-8 below |
| `supabase db reset --help`, `supabase migration up --help` | `--version`, `--no-seed`, `--local` exist (CLI 2.120.0) |
| Mobile `flutter analyze` / `flutter test` | "No issues found!" / `+121: All tests passed!` |

**Not dry-run** (they write to the shared DB or were blocked by the permission classifier):
`pnpm db:reset`, `pnpm db:test` (expected 622 tests / 16 files is the count the lead gave from the
Developer's run on `31ce0a4`; 16 test files is confirmed by `ls supabase/tests/database | wc -l`), the AC 12
backfill, browser saves, the API sign-in and denied-write checks (TC-17b/c; their expected HTTP
codes come from PostgREST's error mapping) and the mobile `flutter drive` run. The first execution
of each is its dry run: if its *command* fails for a reason unrelated to the build, fix the command,
note it in the TSR, and rerun.

## Ground rules for the run

1. **DB owner.** The Tester owns every state-changing local DB command from the start of
   `/test-and-ship` (review-4 amendment 1). Before the first one, the lead confirms Reviewer and
   Security have finished reading. Nobody else resets, seeds or runs `db:test` during the run.
2. **A hosted project is linked.** `supabase status -o env` shows `LINKED_PROJECT_REF` set. Every
   migration command below carries `--local` or is the default local `db reset`. Never `--linked`,
   never `db push`. Hard stop if any command prints a `*.supabase.co` host.
3. **Mobile config.** Hard stop if `aj_classes_mobile/config.json` `SUPABASE_URL` is not
   `http://127.0.0.1:55321` (checked 2026-10-28: it is).
4. **Keys** from `supabase status` go only to `$T/status.env` (outside git). Never paste them into
   the TSR or evidence.
5. **Dev server:** `pnpm dev --port 5173 --strictPort` from `apps/web`. A server was already
   listening on 5173 on 2026-10-28 (pid 26571, cwd `aj_classes/apps/web`): reuse it only if its cwd
   is this worktree, and take the URL from its run log, not from this plan. Clear the console before
   measuring if any source file was edited while it ran (HMR noise is not an app error).
6. **Fixtures.** The seed is the baseline for the display cases. Every case that creates a class
   saves its id in `$T/fixture-ids.txt` and deletes it by id at the end of the same case
   (`class_sessions` and `enrolments` cascade). TC-12b saves a seeded class unchanged (only its
   `updated_at` moves). Nothing else touches seed rows. `pnpm db:reset` runs only where stated.
7. `actionItems.md` (untracked, Saurabh's) is never formatted, staged or committed.
8. Browser cases are driven with Claude in Chrome or a Playwright script using
   `e2e/node_modules` (the lead's choice). Either way, values are **measured** with the DOM snippets
   given, at 1280 px unless a case says otherwise. Stub `window.confirm` in-page if a case hits one.

**Every shell block starts with this line** (each tool call is a fresh zsh shell):

```
cd /Users/sjain/dev/work/aj_classes && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
```

Call it **PRE** below. psql: `docker exec supabase_db_aj_classes psql -U postgres -At -c "…"`
(written **Q "…"** below; `-At` prints `|`-separated values and an empty string for null).

## For Saurabh

**Nothing in the frozen pass/fail set needs Saurabh.** Every case runs on the local stack with the
seeded accounts, the local simulator and no paid or model call.

## Not covered — for Saurabh (outside the frozen set; the TSR lists these as not covered)

1. **Hosted migration.** Applying `20261028110000_classes_hybrid_multi_year.sql` to the hosted
   project is a deploy step (his). Hosted migration state is unknown (03 `[TBC]`).
2. **Stale web tab after deploy.** A tab opened before the deploy gets the generic error on save
   (428C9, 03 §2 step 4, accepted). The DB half is pinned by pgTAP #13; the post-deploy experience
   can only be seen on the real deploy.
3. **Real phone.** AC 18 is run on the iOS simulator against local Supabase (TC-18a). A store
   build on a real device against hosted data is not covered.

## Run order

S-1 → S-2 → S-3 → S-5 → S-7 → (lead confirms DB is free) → S-4 → TC-8, TC-15 → TC-12a
(backfill; ends with `pnpm db:reset`) → start dev server → TC-14, TC-7a–g, TC-16, TC-17d
(read-only display on the pristine seed) → 3b create/edit cases (fixtures created and deleted per
case) → TC-17b, TC-17c (API) → TC-K, TC-T, TC-W → R-1 … R-5 → S-6 (E2E) → TC-18a, TC-18b
(mobile) → F-1.

---

## 1. Automated suites

### S-1 — Format gate (AC 19; 04 baseline item 2)

```
cd /Users/sjain/dev/work/aj_classes && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
git ls-files --cached --others --exclude-standard | grep -vx actionItems.md | xargs pnpm exec prettier --check --ignore-unknown > "$T/fmt.log" 2>&1; echo "exit=$?"; tail -1 "$T/fmt.log"
```

Expected: `exit=0`, `All matched files use Prettier code style!`. (`pnpm format:check` alone fails
only on `actionItems.md`: known, not a bug.) Automated.

### S-2 — Lint, typecheck, unit tests, build (AC 19)

```
cd /Users/sjain/dev/work/aj_classes && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
pnpm lint > "$T/lint.log" 2>&1; echo "lint exit=$?"
pnpm typecheck > "$T/tc.log" 2>&1; echo "typecheck exit=$?"
pnpm test > "$T/test.log" 2>&1; echo "test exit=$?"; grep -E "Test Files|Tests  |tests [0-9]" "$T/test.log"
pnpm build > "$T/build.log" 2>&1; echo "build exit=$?"; tail -2 "$T/build.log"
```

Expected: all four `exit=0`; `Test Files  66 passed (66)`, `Tests  568 passed (568)`, and the e2e
unit line `ℹ tests 6`. Build exit 0 (it needs `VITE_APP_ENV=production`, set by PRE). Automated.

### S-3 — Feature unit tests (AC 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 19 at unit level)

```
cd /Users/sjain/dev/work/aj_classes && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
pnpm --filter web exec vitest run src/lib/labels.test.ts src/lib/class-validation.test.ts src/services/classes.service.test.ts src/components/portal/ClassDialog.test.tsx --reporter=verbose > "$T/feature.log" 2>&1; echo "exit=$?"
grep -E "Test Files|Tests  " "$T/feature.log"
grep -cE "labels \[.*\] as \"" "$T/feature.log"
```

Expected: `exit=0`, `Test Files  4 passed (4)`, `Tests  31 passed (31)`. The `classYearLabel`
table has 8 rows (03 §8); the count line prints `8`. AC 19 also needs `labels.test.ts` to cover
**each** AC 13 case: confirm by reading the file that `[]`, `[8]`, `[7,8,9]`, `[7,8]`, `[7,9,11]`
and `[11,7,8,9]` are all present with the exact expected strings (they are at `7e527ef`). Automated.

### S-4 — pgTAP after a clean reset (AC 8, 15, 17, 19)

State-changing: Tester only, after the lead confirms the DB is free.

```
cd /Users/sjain/dev/work/aj_classes && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
pnpm db:reset > "$T/reset.log" 2>&1; echo "reset exit=$?"; grep -iE "error|supabase\.co" "$T/reset.log"
pnpm db:test > "$T/dbtest.log" 2>&1; echo "dbtest exit=$?"
grep -E "^Files=|^Result:" "$T/dbtest.log"
grep -E "classes_rls|classes_years_delivery" "$T/dbtest.log"
```

Expected: `reset exit=0` and the grep prints nothing; `dbtest exit=0`; `Files=16, Tests=622`;
`Result: PASS`; both `classes_rls.test.sql` and `classes_years_delivery.test.sql` lines end in `ok`.
Automated.

The pgTAP files use `no_plan()`, so the total isn't fixed by a plan line. **The TSR records the
measured `Tests=` value next to the expected 622.** If they differ while the result is `PASS`,
raise it as a plan error (the expected count came from the Developer's run, not this plan's dry
run), not a product bug. If the result is not `PASS`, it's a failure whatever the count.

`classes_years_delivery.test.sql` has **32 assertions** at `31ce0a4`. A static count, read-only,
gave `32` on the dry run:

```
cd /Users/sjain/dev/work/aj_classes && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
grep -cE "^select (col_|is\(|ok\(|lives_ok|throws_ok|results_eq|is_empty)" supabase/tests/database/classes_years_delivery.test.sql
```

Expected: `32`.

**AC 17 now has aal2 coverage** (`31ce0a4`, 06-security finding 1). The file signs the tutor in
with two-step (`tests.add_verified_factor` + `authenticate_as(…, 'aal2')`). It then asserts that
the tutor can't create a hybrid multi-year class (`42501`) and can't change their class's
`year_levels` or `delivery` (`is_empty`), and that the class is unchanged afterwards (`{11}`,
`in_person`). So the RLS admin check refuses the tutor, not only the missing two-step. TC-17b's
password sign-in only gives an aal1 token, so this pgTAP block is what pins the aal2 half of
AC 17.

After the reset, sign in again everywhere (`db:reset` recreates every account). The other worktree
`aj_classes-items-4-9` needs its own `pnpm db:reset` before item 8 resumes (tell the lead).

### S-5 — Static gates (AC 4, 16, DoD 5, DoD 6)

```
cd /Users/sjain/dev/work/aj_classes && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
echo "G1 no literal Hybrid outside constants:"; grep -rnE "['\">]Hybrid['\"<]" apps/web/src --include='*.tsx' --include='*.ts' | grep -v "constants/"; echo "exit=$?"
echo "G2 diff leaves forbidden and student files alone:"; git diff --name-only develop...HEAD | grep -E "auth-errors\.ts|WeekTimetable\.tsx|family-data\.ts|family_functions|Student|students\.service|join\.tsx|onboarding|EnrolDialog|ResultCard|parent-|admin-student|package\.json|pnpm-lock\.yaml|actionItems\.md"; echo "exit=$?"
echo "G3 actionItems in no commit:"; git log --stat develop..HEAD | grep -c actionItems
```

Expected: G1 prints no file lines and `exit=1`; G2 prints no file lines and `exit=1`; G3 prints `0`.
Each gate was shown to fail on bad input when this plan was written: G1 matched a planted
`<Chip label='Hybrid' />` in a scratch `.tsx`; G2 matched a planted
`apps/web/src/components/portal/WeekTimetable.tsx` line. Automated.

### S-6 — E2E regression suites (smoke, CSP)

Runs against the reset seed with the dev server up (see `docs/testing/ci-gates.md`).

```
cd /Users/sjain/dev/work/aj_classes && export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
node e2e/scripts/local-env.mjs > e2e/.env
pnpm --filter aj-classes-e2e test:smoke > "$T/smoke.log" 2>&1; echo "smoke exit=$?"; grep -E "passed|failed" "$T/smoke.log" | tail -2
pnpm --filter aj-classes-e2e test:csp > "$T/csp.log" 2>&1; echo "csp exit=$?"; grep -E "passed|failed" "$T/csp.log" | tail -2
docker exec supabase_db_aj_classes psql -U postgres -At -c "select (select count(*) from public.posts where title like 'e2e-%') + (select count(*) from public.enquiries where email like 'e2e-%') + (select count(*) from public.profiles where email like 'e2e-%');"
```

Expected: `smoke exit=0`, `9 passed`; `csp exit=0`, `19 passed`; leftover count `0`. Automated.
(If `test:csp` needs the production mirror instead of the dev server, follow `ci-gates.md`.)

### S-7 — Mobile repo checks (AC 18 baseline; the mobile repo is not changed)

```
cd /Users/sjain/dev/work/aj_classes_mobile && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
git status --short; git rev-parse --short HEAD
flutter analyze > "$T/m-analyze.log" 2>&1; echo "analyze exit=$?"; tail -1 "$T/m-analyze.log"
flutter test > "$T/m-test.log" 2>&1; echo "test exit=$?"; tail -1 "$T/m-test.log"
```

Expected: `git status` empty (branch `feature/ios-release-prep`, `bf14460` on 2026-10-28; record
what you see); `No issues found!`; `+121: All tests passed!`. Automated.

---

## 2. Database cases

### TC-8 — Delivery values at the DB (AC 8)

Covered by S-4 (`classes_years_delivery` #5 hybrid accepted, #6 `blended` → `23514`). Plus one
read-only check of the live constraint:

```
cd /Users/sjain/dev/work/aj_classes && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
docker exec supabase_db_aj_classes psql -U postgres -At -c "select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.classes'::regclass and conname='classes_delivery_check';"
```

Expected exactly:
`CHECK ((delivery = ANY (ARRAY['in_person'::text, 'online'::text, 'hybrid'::text])))`. Automated.

### TC-15 — Year levels at the DB (AC 15)

Covered by S-4 (#7 `{1}`, `{13}`; #8 `{7,7}`; #9 `{9,7}`; #10 `{7,null}`, `{{7,8}}`, `[0:0]={7}`;
all `23514`; #11/#12 compat column values). Read-only check of the live constraint and trigger:

```
cd /Users/sjain/dev/work/aj_classes && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
docker exec supabase_db_aj_classes psql -U postgres -At -c "select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.classes'::regclass and conname='classes_year_levels_valid';" -c "select tgname from pg_trigger where tgrelid='public.classes'::regclass and not tgisinternal order by tgname;"
```

Expected: `CHECK (((year_levels <@ '{2,3,4,5,6,7,8,9,10,11,12}'::smallint[]) AND (array_ndims(year_levels) = 1) AND (array_lower(year_levels, 1) = 1)))`,
then `classes_check_year_levels` and `classes_set_updated_at`. Automated.

### TC-12a — Backfill of existing classes, by hand (AC 12; 03 §12 R3-3; 04 S6)

State-changing. Runs right after S-4. Leaves the DB reset to the seed at the end.

```
cd /Users/sjain/dev/work/aj_classes && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
supabase db reset --local --version 20261027100000 --no-seed > "$T/ac12-reset.log" 2>&1; echo "exit=$?"
docker exec supabase_db_aj_classes psql -U postgres -At -c "select max(version) from supabase_migrations.schema_migrations;"
docker exec supabase_db_aj_classes psql -U postgres -At -c "insert into public.classes (name, subject, year_level, delivery, location) values ('Backfill one', 'maths', 8, 'online', 'Zoom'), ('Backfill any', 'maths', null, 'in_person', '');"
docker exec supabase_db_aj_classes psql -U postgres -At -c "select name, updated_at from public.classes order by name;" > "$T/ac12-before.txt"; cat "$T/ac12-before.txt"
```

Expected: `exit=0`; max version `20261027100000`; `INSERT 0 2`; two lines `Backfill any|<ts>`,
`Backfill one|<ts>`. (If `db reset` rejects `--local`, drop it: local is the default for
`db reset`; record that in the TSR.)

```
cd /Users/sjain/dev/work/aj_classes && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
supabase migration up --local > "$T/ac12-up.log" 2>&1; echo "exit=$?"; grep -E "20261028110000|rror" "$T/ac12-up.log"
docker exec supabase_db_aj_classes psql -U postgres -At -c "select name, updated_at from public.classes order by name;" > "$T/ac12-after.txt"
diff "$T/ac12-before.txt" "$T/ac12-after.txt"; echo "diff exit=$?"
docker exec supabase_db_aj_classes psql -U postgres -At -c "select name, year_levels, year_level, delivery from public.classes order by name;"
```

Expected: `exit=0`, the log names `20261028110000` and shows no error; `diff exit=0` (no output:
`updated_at` unchanged); the values query prints exactly:

```
Backfill any|{}||in_person
Backfill one|{8}|8|online
```

(no class became hybrid: A5).

**The restore below always runs**, whatever happens above: a failed reset, a failed insert, a
failed `migration up`, a wrong value or an abort. Do it before writing up any TC-12a failure, so
the DB is never left at `20261027100000` or without the seed. Restore the seed:

```
cd /Users/sjain/dev/work/aj_classes && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
pnpm db:reset > "$T/reset2.log" 2>&1; echo "exit=$?"
docker exec supabase_db_aj_classes psql -U postgres -At -c "select name, year_levels, year_level, delivery, location from public.classes order by name;"
```

Expected: `exit=0` and exactly:

```
NAPLAN Reading & Writing|{5}|5|in_person|Truganina, Room 2
Selective Entry Maths & Reasoning|{7,8,9}||hybrid|Truganina, Room 1 and Zoom
Selective Interview Preparation|{8}|8|online|Zoom
```

Manual (SQL by hand), commands and output pasted into the TSR.

---

## 3. Browser cases

Accounts (password `local-password-123`, `supabase/seed.sql:12`): `admin@local.test` (two-step
entered by the dev server), `tutor@local.test` (teaches Maths and Interview), `student@local.test`
(Aarav Demo: Maths + Interview), `parent@local.test` (Aarav + Noah; Noah is in NAPLAN),
`inactive@local.test`. Sign in at `/portal/login`.

Seeded sessions (`seed.sql:117-121`): Maths Tue 16:00–17:30 and Sat 10:00–11:30; NAPLAN Wed
17:00–18:00; Interview Thu 18:30–19:30.

DOM snippets used below (paste into the page, read-only):

- **List years:** `[...document.querySelectorAll('tbody tr')].map(r => [r.cells[0].innerText.split('\n')[0], r.cells[2].innerText])`
- **Detail chips:** `[...document.querySelectorAll('.MuiChip-label')].map(e => e.textContent)`
- **Delivery fact:** `[...document.querySelectorAll('dt')].find(d => d.textContent === 'Delivery').nextElementSibling.textContent`
- **Timetable bullets:** `(t => [...document.querySelectorAll('p')].filter(p => p.textContent === t).length)('<text>')`
- **Open listbox options:** `[...document.querySelectorAll('[role=listbox] [role=option]')].map(o => [o.textContent, o.getAttribute('aria-selected')])`
- **Sideways scroll:** `document.documentElement.scrollWidth <= window.innerWidth`

### 3a. Display on the pristine seed (read-only; run first)

**TC-14 — Year labels in list and header (AC 14, AC 13 seeded rows).** Admin, `/portal/classes`.
List years → `[["NAPLAN Reading & Writing","Year 5"],["Selective Entry Maths & Reasoning","Years 7–9"],["Selective Interview Preparation","Year 8"]]`
(the dash is U+2013). Open Maths: Detail chips include `Maths`, `Years 7–9`, `Hybrid` in that order.
Open NAPLAN: chips include `Year 5`, `In person`. Then as tutor, `/portal/classes`: List years →
Maths `Years 7–9` and Interview `Year 8` only (NAPLAN is the admin's class). Manual (measured).

**TC-7 — Hybrid shown everywhere (AC 7 as amended).**

| # | Role | Page | Expected (measured) |
|---|---|---|---|
| 7a | admin | Maths detail | chip `Hybrid`; Delivery fact `Hybrid · Truganina, Room 1 and Zoom` |
| 7b | tutor | Maths detail | same chip and fact; no Edit/Archive buttons (see TC-17d) |
| 7c | admin | `/portal/timetable` | bullet `Hybrid · Truganina, Room 1 and Zoom` count `2`; `In person · Truganina, Room 2` count `1`; `Online · Zoom` count `1` |
| 7d | tutor | `/portal/timetable` | `Hybrid · Truganina, Room 1 and Zoom` count `2`; `Online · Zoom` count `1`; `In person · Truganina, Room 2` count `0` |
| 7e | student | `/portal/student/timetable` | `Hybrid · Truganina, Room 1 and Zoom` count `2`; `Online · Zoom` count `1` |
| 7f | parent | Aarav's child page (`/portal/parent/children/<aarav id>`) timetable | `Hybrid · Truganina, Room 1 and Zoom` count `2`; `Online · Zoom` count `1` |
| 7g | parent | Noah's child page | `In person · Truganina, Room 2` count `1`; `Hybrid …` count `0` (regression) |

Hybrid with no location (`Hybrid` alone) is TC-7h in 3b. Manual (measured).

**TC-16 — Student years unchanged (AC 16).**

| # | Role | Where | Expected |
|---|---|---|---|
| 16a | admin | `/portal/admin/students` | Aarav `Year 8`, Noah `Year 5`, Mia `Other (e.g. UCAT, GAMSAT)` |
| 16b | admin | Maths detail → Students tab | Aarav, Isla, Leo each `Year 8` |
| 16c | admin | Maths → Students → enrol picker | options include `Noah Demo · Year 5` and `Mia Demo · Other (e.g. UCAT, GAMSAT)`; close without enrolling |
| 16d | admin | Edit Aarav (student dialog) | Year field is a **single** select: its listbox has no `aria-multiselectable="true"`, shows `Year 8`; cancel |
| 16e | admin | an assignment's results (Reasoning mock test 1) | result card for Aarav shows `Year 8` |
| 16f | parent | `/portal/parent` | Aarav `Year 8`, Noah `Year 5` |
| 16g | parent | Aarav's child page intro | starts `Year 8 · ` |

The join form is not reachable with seeded users; it is covered by `onboarding-validation.test.ts`
(in S-2) and G2 (no student/onboarding file in the diff). Manual + automated.

**TC-17d — Tutor, student and parent see no class editing (AC 17, UI).** As tutor:
`/portal/classes` has no `New class` button; Maths detail has no `Edit class` / `Archive`
buttons; the list has no Tutor column. Student and parent: `/portal/classes` is not reachable (they
are routed to their own home; record the URL they land on). Manual.

### 3b. Create and edit (admin; fixtures per case, deleted by id)

Find a fixture id after saving with:
`Q "select id, year_levels, year_level, delivery, location from public.classes where name = '<name>';"`
and append the id to `$T/fixture-ids.txt`. Delete at the end of the case with
`Q "delete from public.classes where id = '<id>';"` → `DELETE 1`.

**TC-1 — New class delivery options (AC 1).** `New class`, open Delivery. Open listbox options →
`In person`, `Online`, `Hybrid`, in that order. Default selected is `In person`. Close (Escape),
cancel. Manual (measured) + unit (S-3).

**TC-2 — Edit dialog delivery (AC 2).** Maths → `Edit class`: Delivery shows `Hybrid`; open it:
same three options, `Hybrid` has `aria-selected="true"`. Cancel; Q shows Maths unchanged. Manual + unit.

**TC-3 — Hybrid round trip (AC 3, AC 11).** Fixture `TP Hybrid round trip`, subject Maths.

1. New class: name, subject, Delivery `Hybrid`, Location `Room 3 and Zoom`, tick years in the order
   **11, 7, 9**. The box shows `Years 7, 9, 11` while ticking. Save → toast `Class saved.`
2. Q → `{7,9,11}||hybrid|Room 3 and Zoom` (stored sorted).
3. Reopen Edit: Delivery `Hybrid`; open Year level: exactly `Year 7`, `Year 9`, `Year 11` have
   `aria-selected="true"`, the other 8 `false`.
4. Change Delivery to `In person`, save, reopen: `In person`; Q delivery `in_person`.
5. Change to `Hybrid`, save, reopen: `Hybrid`. Change to `Online`, save, reopen: `Online`; Q `online`.
6. Change back to `Hybrid`, save; Q `hybrid`. Keep the fixture for TC-13; delete it there.

Manual (measured).

**TC-5 — Location length on hybrid (AC 5).** On the TC-3 fixture (Hybrid): set Location to 101
`x` characters, Save. Expected: Location helper shows `Please keep the location under 100
characters.`, the dialog stays open, Q location is still `Room 3 and Zoom`. Then 100 `x`: saves,
Q `char_length(location)` = `100`. Set it back to `Room 3 and Zoom`. Manual + unit.

**TC-6 — Location hint (AC 6).** New class dialog: text under Location is exactly
`Room, the online meeting place (e.g. Zoom), or both for hybrid.`; under Year level
`Choose one or more, or none for any year.`. Manual + unit.

**TC-9 — Multi-select dropdown (AC 9).** New class, open Year level. Expected: listbox
`aria-multiselectable="true"`; options `Year 2` … `Year 12` (11 items, ascending); each has a
checkbox. Click `Year 5`: it ticks and the menu **stays open**; click again: it unticks. Tick 3
years, untick 1: the box shows the label for the remaining 2. Escape closes. Cancel. Manual + unit.

**TC-10 — No years (AC 10).** Fixture `TP Any year`: fill name + subject, touch nothing else.
Year level box shows `Any year` with the label above it (not overlapping). Save. Q →
`{}||in_person|`. List years row → `Any year`; detail chip `Any year`. Delete. Manual + unit.

**TC-13 — Every display format (AC 13, AC 14).** On the TC-3 fixture, set years through the dialog
for each row, save, and measure both the list Year cell and the detail header chip:

| # | Tick (in this order) | Q `year_levels` / `year_level` | List and chip |
|---|---|---|---|
| 13a | none | `{}` / empty | `Any year` |
| 13b | 8 | `{8}` / `8` | `Year 8` |
| 13c | 9, 7, 8 | `{7,8,9}` / empty | `Years 7–9` |
| 13d | 8, 7 | `{7,8}` / empty | `Years 7, 8` |
| 13e | 11, 9, 7 | `{7,9,11}` / empty | `Years 7, 9, 11` |
| 13f | 11, 9, 8, 7 | `{7,8,9,11}` / empty | `Years 7–9, 11` |
| 13g | all 2–12 | `{2,…,12}` / empty | `Years 2–12` |

At the end delete the fixture by id. Manual (measured) + unit (S-3).

**TC-7h — Hybrid with no location (AC 7).** Fixture `TP Hybrid no room`: Hybrid, Location empty,
year 8. Save; on its detail page, Schedule tab → `Add time`, Friday 15:00–16:00. Expected: Delivery
fact `Hybrid`; admin `/portal/timetable` bullet `Hybrid` count `1` (exact text, so the seeded
`Hybrid · …` bullets don't count). Delete the fixture (its session cascades); timetable is back to
4 cards. Manual (measured).

**TC-12b — Existing class saved unchanged (AC 12, browser half).** Admin, NAPLAN → `Edit class`:
Year level box `Year 5`, only `Year 5` ticked; Delivery `In person`. Save without changes. Q →
`{5}|5|in_person|Truganina, Room 2`. Also open Interview: `Year 8`, `Online`; cancel. Manual + unit.

**TC-D — Double Save (edge).** Fixture `TP Double save`: fill required fields, double-click
`Save class` fast. Expected: `Q "select count(*) from public.classes where name='TP Double save';"`
→ `1`. Delete. Manual.

**TC-17b — Tutor cannot change a class through the API (AC 17).** Sign in as tutor via the auth
API (captcha dummy token from `supabase/README.md`), then PATCH Maths. Keys from `$T/status.env`.

```
cd /Users/sjain/dev/work/aj_classes && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
supabase status -o env > "$T/status.env" 2>/dev/null; source "$T/status.env"
TOK=$(curl -s "$API_URL/auth/v1/token?grant_type=password" -H "apikey: $PUBLISHABLE_KEY" -H 'Content-Type: application/json' -d '{"email":"tutor@local.test","password":"local-password-123","gotrue_meta_security":{"captcha_token":"XXXX.DUMMY.TOKEN.XXXX"}}' | python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))'); echo "token_len=${#TOK}"
MID=$(docker exec supabase_db_aj_classes psql -U postgres -At -c "select id from public.classes where name='Selective Entry Maths & Reasoning'")
curl -s -o "$T/t1.json" -w "years status=%{http_code}\n" -X PATCH "$API_URL/rest/v1/classes?id=eq.$MID" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -H 'Prefer: return=representation' -d '{"year_levels":[7]}'; cat "$T/t1.json"; echo
curl -s -o "$T/t2.json" -w "delivery status=%{http_code}\n" -X PATCH "$API_URL/rest/v1/classes?id=eq.$MID" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -H 'Prefer: return=representation' -d '{"delivery":"online"}'; cat "$T/t2.json"; echo
curl -s -o "$T/t3.json" -w "insert status=%{http_code}\n" -X POST "$API_URL/rest/v1/classes" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"name":"Tutor class","subject":"maths","delivery":"hybrid","year_levels":[7,8]}'; cat "$T/t3.json"; echo
docker exec supabase_db_aj_classes psql -U postgres -At -c "select year_levels, delivery from public.classes where id='$MID'; select count(*) from public.classes where name='Tutor class';"
```

Expected: `token_len` > 100; `years status=200` body `[]`; `delivery status=200` body `[]`
(RLS filters the row out); `insert status=403` (or 401) with code `42501`; DB `{7,8,9}|hybrid` and
`0`. Automated (scripted curl).

**TC-17c — A student cannot change a class, and nobody can write the compat `year_level`
(AC 15, 17).** An admin token needs two-step (aal2), which a password sign-in can't give, so the
admin side is pinned by pgTAP #13 (428C9) and #7–#10 (23514) in S-4. Here, as the student:

```
cd /Users/sjain/dev/work/aj_classes && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
source "$T/status.env"
TOK=$(curl -s "$API_URL/auth/v1/token?grant_type=password" -H "apikey: $PUBLISHABLE_KEY" -H 'Content-Type: application/json' -d '{"email":"student@local.test","password":"local-password-123","gotrue_meta_security":{"captcha_token":"XXXX.DUMMY.TOKEN.XXXX"}}' | python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))'); echo "token_len=${#TOK}"
MID=$(docker exec supabase_db_aj_classes psql -U postgres -At -c "select id from public.classes where name='Selective Entry Maths & Reasoning'")
curl -s -o "$T/s1.json" -w "student years status=%{http_code}\n" -X PATCH "$API_URL/rest/v1/classes?id=eq.$MID" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -H 'Prefer: return=representation' -d '{"year_levels":[7]}'; cat "$T/s1.json"; echo
curl -s -o "$T/s2.json" -w "student year_level status=%{http_code}\n" -X PATCH "$API_URL/rest/v1/classes?id=eq.$MID" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"year_level":7}'; cat "$T/s2.json"; echo
docker exec supabase_db_aj_classes psql -U postgres -At -c "select year_levels, delivery from public.classes where id='$MID';"
```

Expected: student years `200` with `[]` (or `401/403` with `42501` if students have no select on
classes: either is a refusal; record which); student year_level `400` with code `428C9`; DB still
`{7,8,9}|hybrid`. Automated (scripted curl).

### 3c. Keyboard, theme, width

**TC-K — Keyboard only (AC 9; 03 §9.1).** Admin, `New class`, no mouse. Tab from Class name →
Subject → Year level: focus ring visible on Year level. Enter (or Space / ArrowDown) opens the
menu. ArrowDown moves between `Year 2`…`Year 12`; Space or Enter ticks the focused year and the
menu stays open; ticking 7, 8, 9 shows `Years 7–9` in the box. Escape closes and focus returns to
the Year level field. Tab moves on to Delivery; Enter opens; ArrowDown to `Hybrid`, Enter selects.
Tab reaches Location, Tutor, term fields and `Save class`; Enter saves (fixture `TP Keyboard`; Q →
`{7,8,9}||hybrid|`). Record focus order in the TSR. Delete the fixture. Manual.

**TC-T — Light and dark (visual).** Switch with the header toggle (`Switch to dark mode` /
`Switch to light mode`). In each theme, screenshot: the New class dialog with the Year level menu
open and 3 years ticked; Classes list; Maths detail header; admin timetable. Check: checkboxes,
ticked state, label `Year level` above `Any year` (not overlapping), helper texts and the en dash
all readable; nothing clipped. Visual judgement by the Tester from the screenshots in
`evidence/`; anything doubtful is flagged for Saurabh, not passed silently. Manual.

**TC-W — Narrow screen (edge).** At 375 px as admin: `/portal/classes` and the New class dialog
with years 2, 4, 6, 8, 10, 12 ticked (box label `Years 2, 4, 6, 8, 10, 12`). Sideways scroll
snippet → `true` on the page (a table that scrolls inside its own container is fine; record
which). The long label is readable or ellipsised, not overlapping the dropdown arrow. Not saved.
At 375 px the timetable shows day tabs; on Tuesday Maths shows `Hybrid · Truganina, Room 1 and
Zoom`. Manual (measured + visual).

---

## 4. Smoke and regression

**R-1 — Class create/edit with no year/delivery change.** Admin: fixture `TP Plain` (In person, no
years, no location) saves; rename it to `TP Plain 2` (nothing else touched) saves; Q →
`TP Plain 2|{}||in_person|`. Archive it, `Show archived` lists it with `Archived`; Restore. Delete.
Manual.

**R-2 — Pages load, no console errors.** Clear console, then load and record errors (expect 0)
for: admin `/portal/admin`, `/portal/classes`, Maths detail (all three tabs), `/portal/timetable`
(tutor filter `All tutors` and `Local Tutor`), `/portal/assignments`, one assignment detail; tutor
`/portal/tutor`, `/portal/classes`, `/portal/timetable`, `/portal/assignments`; student
`/portal/student`, `/portal/student/timetable`; parent `/portal/parent`, both child pages.
Manual (measured).

**R-3 — Sign-in per role, plus reload (addendum).** admin, newadmin (lands on two-step setup),
tutor, student, parent each sign in at `/portal/login` and stay signed in after reload;
`inactive@local.test` is refused. Manual.

**R-4 — Public page sweep (addendum).** Every `sitemap.xml` URL at 375 and 1280 px: status 200, 0
console errors, no sideways scroll, exactly one `h1`, exactly one `<meta name="robots">` (BUG-1
regression). Automated (Playwright script) or measured in-page.

**R-5 — Activity list still loads** (`/portal/admin` activity or `/portal/admin/activity`) and
shows the TC-3/R-1 edits without error. Manual.

---

## 5. Mobile (AC 18)

**Method: run the shipped mobile build against local Supabase on the iOS simulator** (the
amended AC 18 prefers this). Feasible on this machine: `flutter` at `/opt/homebrew/bin/flutter`,
simulator `iPhone 17` (`47E92866-96B2-4B98-8A0F-F53FF91BFF2F`) booted headless, `config.json`
points at `http://127.0.0.1:55321`. Needs the pristine seed (run after the 3b fixtures are deleted).
The stock `role_flows_test.dart` only reaches each dashboard, so a **temporary** integration test
(Appendix A) opens the class screens. It is copied in for the run and deleted afterwards; the
mobile repo is left exactly as found (`git status --short` empty before and after).

**TC-18a — Mobile app on hybrid and multi-year data.**

Run as **five separate tool calls**, so a timeout or abort in one drive run can't skip the
cleanup. **Call (e) always runs**, even if (b)–(d) fail, time out or are aborted.

(a) Check the config and copy the test in:

```
cd /Users/sjain/dev/work/aj_classes_mobile && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
git status --short
grep -c '"SUPABASE_URL": "http://127.0.0.1:55321"' config.json
cp "$T/hm_class_screens_test.dart" integration_test/hm_class_screens_test.dart; echo "cp exit=$?"
```

Expected: `git status` empty, `1`, `cp exit=0`.

(b), (c), (d): one `flutter drive` call per role, each with a Bash timeout of **600000 ms** (or
run in the background and wait for the exit notification). Call (b) uses `ROLE=admin`, (c)
`ROLE=tutor`, (d) `ROLE=student`:

```
cd /Users/sjain/dev/work/aj_classes_mobile && T=/private/tmp/aj-hm-tsr && mkdir -p "$T" && ROLE=admin
flutter drive --driver=test_driver/integration_test.dart --target=integration_test/hm_class_screens_test.dart -d 47E92866-96B2-4B98-8A0F-F53FF91BFF2F --dart-define-from-file=config.json --dart-define=TEST_ROLE=$ROLE > "$T/m-$ROLE.log" 2>&1; echo "$ROLE exit=$?"; tail -3 "$T/m-$ROLE.log"
```

Expected per call: `<role> exit=0` and the log ends `All tests passed!`.

(e) Cleanup, **always**:

```
cd /Users/sjain/dev/work/aj_classes_mobile && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
rm -f integration_test/hm_class_screens_test.dart; git status --short
```

Expected: `git status` prints nothing.

(f) Evidence. The driver (`test_driver/integration_test.dart`) writes screenshots to
`~/aj_mobile_overnight/screenshots/<name>.png`. Copy this run's into the delivery folder:

```
cd /Users/sjain/dev/work/aj_classes && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
mkdir -p docs/delivery/2026-10-28-hybrid-class-multi-year/evidence/mobile
cp ~/aj_mobile_overnight/screenshots/hm-*.png docs/delivery/2026-10-28-hybrid-class-multi-year/evidence/mobile/; echo "cp exit=$?"
ls docs/delivery/2026-10-28-hybrid-class-multi-year/evidence/mobile/
```

Expected: `cp exit=0` and 5 files: `hm-admin-classes.png`, `hm-student-timetable.png`,
`hm-tutor-class-maths.png`, `hm-tutor-classes.png`, `hm-tutor-timetable.png`. Check their
timestamps are from this run, not from an earlier one.

**Off-screen rows are a plan error, not a bug.** Flutter's `ListView` builds rows lazily, so a
row below the fold isn't in the widget tree. If a drive run fails only because an expected text
isn't found, and the screenshot shows the screen loaded without the error copy, record it in the
TSR as a plan error. Then edit the copy outside the repo, `$T/hm_class_screens_test.dart`, to scroll first (e.g.
`await tester.scrollUntilVisible(find.text(...), 200)`) before asserting, and rerun (a)–(e). It is
not a product bug.

What the test asserts (values from the mobile source and the seed):

| Role | Screen | Expected |
|---|---|---|
| admin | More → Classes | no `Something went wrong. Please try again.`; Maths tile subtitle exactly `maths` (no year: `year_level` is null for a multi-year class, DEC-HM-2); `english · Year 5`; `interview-preparation · Year 8` |
| tutor | Classes | no error; `maths · 3 enrolled · 2 sessions`; `interview-preparation · Year 8 · 2 enrolled · 1 sessions` |
| tutor | Maths class screen | loads, shows `Aarav Demo`; no error |
| tutor | Timetable | loads with Maths; no error |
| student | Timetable | no error; `16:00–17:30  Selective Entry Maths & Reasoning` and `10:00–11:30  Selective Entry Maths & Reasoning` (two spaces); subtitle `Truganina, Room 1 and Zoom · Local Tutor` ×2 |

Screenshots (`hm-*.png`) are copied to `evidence/mobile/` in step (f). Mobile does not display delivery anywhere
(it parses it as an optional string in `timetable_session.dart:42`), so `hybrid` cannot break a
label. If the drive run cannot start for an environment reason (simulator, signing), fall back to
TC-18b and say so in the TSR. Automated (on-device integration test).

**TC-18b — API shape vs mobile parsers (fallback, and always as a cross-check).** As tutor (token
as in TC-17b), GET the exact mobile select from `tutor_repo.dart:20-25` and the student RPC:

```
cd /Users/sjain/dev/work/aj_classes && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
source "$T/status.env"
TOK=$(curl -s "$API_URL/auth/v1/token?grant_type=password" -H "apikey: $PUBLISHABLE_KEY" -H 'Content-Type: application/json' -d '{"email":"tutor@local.test","password":"local-password-123","gotrue_meta_security":{"captcha_token":"XXXX.DUMMY.TOKEN.XXXX"}}' | python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))')
curl -s -w "\nstatus=%{http_code}\n" "$API_URL/rest/v1/classes?select=id,name,subject,year_level,delivery,location,tutor_id,starts_on,ends_on,is_active,tutor:profiles(full_name,is_active),class_sessions(id,class_id,day_of_week,start_time,end_time),enrolments(count)&is_active=eq.true&order=name" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOK" > "$T/m-api.json"
python3 -c "import json,sys; raw=open('$T/m-api.json').read().rsplit('status=',1); print('status', raw[1].strip()); [print(r['name'], repr(r['year_level']), r['delivery']) for r in json.loads(raw[0])]"
```

Expected: `status 200`; `Selective Entry Maths & Reasoning None hybrid`;
`Selective Interview Preparation 8 online`. `year_level` is null or an int, which
`admin_classes_body.dart:49` / `tutor_classes_body.dart:56` handle (`if (yearLevel != null)`).
Automated.

---

## 6. Final check

**F-1 — DB back to seed, no fixtures left.**

```
cd /Users/sjain/dev/work/aj_classes && T=/private/tmp/aj-hm-tsr && mkdir -p "$T"
docker exec supabase_db_aj_classes psql -U postgres -At -c "select count(*) from public.classes where name like 'TP %' or name like 'Backfill %' or name = 'Tutor class';" -c "select name, year_levels, delivery, location from public.classes order by name;"
cd /Users/sjain/dev/work/aj_classes && git status --short
test ! -e /Users/sjain/dev/work/aj_classes_mobile/integration_test/hm_class_screens_test.dart && echo gone; git -C /Users/sjain/dev/work/aj_classes_mobile status --short
```

Expected: `0`; the three seeded rows as at the end of TC-12a; `git status` shows only
`?? actionItems.md` plus this folder's TSR/evidence files; then `gone`, followed by nothing (the
mobile repo is clean).

---

## 7. AC traceability

| AC | Cases | Method |
|---|---|---|
| 1 | TC-1, S-3 | manual (measured) + unit |
| 2 | TC-2, S-3 | manual + unit |
| 3 | TC-3, S-3 | manual (DB-checked) + unit |
| 4 | S-5 G1, S-3 (`DELIVERY_LABELS.hybrid`), S-2 typecheck (`satisfies`) | automated |
| 5 | TC-5, S-3 | manual + unit |
| 6 | TC-6, S-3 | manual + unit |
| 7 | TC-7a–g, TC-7h | manual (measured), four roles |
| 8 | S-4, TC-8 | pgTAP + psql |
| 9 | TC-9, TC-K, S-3 | manual + keyboard + unit |
| 10 | TC-10, S-3 | manual (DB-checked) + unit |
| 11 | TC-3, TC-13e, S-3 | manual + unit |
| 12 | TC-12a (backfill by hand), TC-12b, S-3 | SQL by hand + manual + unit |
| 13 | TC-13a–g, TC-14, S-3 | manual (measured) + unit |
| 14 | TC-14, TC-13 | manual (measured) |
| 15 | S-4, TC-15, TC-17c | pgTAP + psql + API |
| 16 | TC-16a–g, S-5 G2, S-2 | manual + automated |
| 17 | S-4 (`classes_rls`, #3, #13, #14, aal2 tutor cases from `31ce0a4`), TC-17b, TC-17c, TC-17d | pgTAP + API + manual |
| 18 | TC-18a (run on simulator), TC-18b, S-7 | on-device integration test + API |
| 19 | S-1, S-2, S-3, S-4 | automated |

Also: light/dark TC-T, keyboard TC-K, narrow TC-W, double save TC-D, regression R-1 to R-5, E2E
S-6.

**Expected suite counts:** web vitest 568 tests / 66 files (measured); e2e unit 6 (measured);
feature subset 31 / 4 files (measured); pgTAP 622 tests / 16 files, `classes_years_delivery` 32 assertions (from the Developer's run on `31ce0a4`,
16 files confirmed); E2E smoke 9, CSP 19 (addendum); mobile `flutter test` 121 (measured).

## 8. Pre-freeze findings for the lead (from reading the code)

No code was found that contradicts an AC. Notes:

1. **Linked hosted project.** `supabase status -o env` lists `LINKED_PROJECT_REF`. The plan pins
   `--local` on the migration commands. Worth a line in the TSR so nobody runs `db push`.
2. **Not dry-run:** S-4 counts, TC-12a, TC-17b/c HTTP codes and TC-18a were not run at this
   stage (shared DB; the permission classifier also blocked the tutor sign-in). Their first run at
   S6 doubles as the dry run (see "What was dry-run").
3. **Low, informational, not an AC breach:** `ClassDialog.tsx` `toYearLevels` returns `[]` for a
   string value. MUI documents that browser autofill can deliver a multiple Select's value as a
   comma-separated string, which would silently clear the years. Autofill on this field is
   unlikely; raise only if TC-3/TC-13 show it.
4. **Mobile, out of scope (pre-existing, not this branch):** `student_timetable_body.dart` maps
   Sunday as `dayOfWeek == 0`, while the database uses ISO 1–7 (7 = Sunday,
   `services/types.ts` `DayOfWeek`). A Sunday session would not show on the mobile student
   timetable. The seed has no Sunday session, so AC 18 is unaffected. Suggest a separate mobile
   ticket.
5. Mobile shows no year for multi-year classes and no delivery at all: accepted (DEC-HM-2, D3).
   Not a bug.

## Appendix A — temporary mobile test `hm_class_screens_test.dart`

Save to `/private/tmp/aj-hm-tsr/hm_class_screens_test.dart` before TC-18a. Not committed anywhere.
A draft is also at the Stage 6a scratchpad; this copy is the one to use.

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:aj_classes_mobile/main.dart' as app;

import 'support/totp.dart';

// TEMPORARY (hybrid/multi-year TSR, AC 18). Copied into integration_test/ for the run, then deleted.
const _password = 'local-password-123';
const _adminTotpSecret = 'LOCALDEVADMINKEYLOCALDEVADMINKEY';
const _role = String.fromEnvironment('TEST_ROLE', defaultValue: 'student');
const _errorCopy = 'Something went wrong. Please try again.';
const _maths = 'Selective Entry Maths & Reasoning';

Finder _nav(String label) =>
    find.descendant(of: find.byType(NavigationBar), matching: find.text(label));

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('class screens load for $_role', (tester) async {
    await app.main();
    await tester.pumpAndSettle();
    await _pumpUntil(tester, find.byType(TextFormField), timeout: const Duration(seconds: 30));
    await tester.enterText(find.byType(TextFormField).at(0), '$_role@local.test');
    await tester.enterText(find.byType(TextFormField).at(1), _password);
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    if (_role == 'admin') await _enterTotp(tester);
    await _pumpUntil(tester, find.byType(NavigationBar), timeout: const Duration(seconds: 40));
    await _settle(tester, const Duration(seconds: 3));
    if (find.text('Not now').evaluate().isNotEmpty) {
      await tester.tap(find.text('Not now'));
      await _settle(tester, const Duration(seconds: 1));
    }

    if (_role == 'admin') {
      await tester.tap(_nav('More'));
      await _settle(tester, const Duration(seconds: 1));
      await tester.tap(find.widgetWithText(ListTile, 'Classes'));
      await _pumpUntil(tester, find.text(_maths));
      await binding.takeScreenshot('hm-admin-classes');
      expect(find.text(_errorCopy), findsNothing);
      expect(find.widgetWithText(ListTile, 'maths'), findsOneWidget);
      expect(find.text('english · Year 5'), findsOneWidget);
      expect(find.text('interview-preparation · Year 8'), findsOneWidget);
    }

    if (_role == 'tutor') {
      await tester.tap(_nav('Classes'));
      await _pumpUntil(tester, find.text(_maths));
      await binding.takeScreenshot('hm-tutor-classes');
      expect(find.text(_errorCopy), findsNothing);
      expect(find.text('maths · 3 enrolled · 2 sessions'), findsOneWidget);
      expect(find.text('interview-preparation · Year 8 · 2 enrolled · 1 sessions'), findsOneWidget);

      await tester.tap(find.text(_maths));
      await _pumpUntil(tester, find.textContaining('Aarav Demo'));
      await binding.takeScreenshot('hm-tutor-class-maths');
      expect(find.text(_errorCopy), findsNothing);

      await tester.pageBack();
      await _settle(tester, const Duration(seconds: 1));
      await tester.tap(_nav('Timetable'));
      await _pumpUntil(tester, find.textContaining(_maths));
      await binding.takeScreenshot('hm-tutor-timetable');
      expect(find.text(_errorCopy), findsNothing);
    }

    if (_role == 'student') {
      await tester.tap(_nav('Timetable'));
      await _pumpUntil(tester, find.textContaining(_maths));
      await binding.takeScreenshot('hm-student-timetable');
      expect(find.text(_errorCopy), findsNothing);
      expect(find.text('16:00–17:30  $_maths'), findsOneWidget);
      expect(find.text('10:00–11:30  $_maths'), findsOneWidget);
      expect(find.text('Truganina, Room 1 and Zoom · Local Tutor'), findsNWidgets(2));
    }
  }, timeout: const Timeout(Duration(minutes: 3)));
}

Future<void> _enterTotp(WidgetTester tester) async {
  for (var attempt = 0; attempt < 3; attempt++) {
    // Debug builds may auto-submit the local code, so step-up may already be done.
    await _pumpUntil(tester, find.byType(NavigationBar), timeout: const Duration(seconds: 3));
    if (find.byType(NavigationBar).evaluate().isNotEmpty) return;
    await _pumpUntil(tester, find.widgetWithText(FilledButton, 'Verify'), timeout: const Duration(seconds: 20));
    final field = find.byType(TextField).first;
    await tester.tap(field);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.enterText(field, generateTotp(_adminTotpSecret));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.widgetWithText(FilledButton, 'Verify'));
    final end = DateTime.now().add(const Duration(seconds: 8));
    while (DateTime.now().isBefore(end)) {
      await tester.pump(const Duration(milliseconds: 250));
      if (find.byType(NavigationBar).evaluate().isNotEmpty) return;
    }
    await tester.enterText(field, '');
    await tester.pump(const Duration(milliseconds: 300));
  }
}

Future<void> _pumpUntil(WidgetTester tester, Finder finder,
    {Duration timeout = const Duration(seconds: 20)}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 250));
    if (finder.evaluate().isNotEmpty) return;
  }
}

Future<void> _settle(WidgetTester tester, Duration duration) async {
  final end = DateTime.now().add(duration);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 200));
  }
}
```

The `TOTP` secret and password are the local-only seed values already committed in
`integration_test/role_flows_test.dart` and `supabase/seed.sql`; they are not real credentials.

## Lead note: count update after 31ce0a4

The Developer's fix batch `31ce0a4 test(db): cover tutor class writes at aal2` adds aal2 tutor cases: insert refused with 42501, year_levels and delivery updates refused, and the row checked unchanged. The measured `pnpm db:test` is now **Files=16, Tests=622, PASS**, and `classes_years_delivery.test.sql` has 32 assertions. AC 17 now has aal2 coverage in pgTAP as well as aal1.
