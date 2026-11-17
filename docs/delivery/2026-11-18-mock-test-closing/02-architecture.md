# Mock test categories: architecture impact (ACs 10 to 29)

Stage 2 (Architect), 18 Nov 2026. Branch `feature/mock-test-closing`. Input: `01-requirement.md` (rulings S-1, S-2), ADR-0012, `2026-11-17-mock-tests/02-architecture.md`, and the closing migration being written (`20261119100000_mock_test_closing.sql`, read only). Design only, no code. ADR-0012 gets Amendment 1 (see section 7).

## Recommendation

Four plain columns on `mock_tests`, written through the existing column-grant path, validated by a guard trigger against a small private options table, required at release inside `mock_release`, and filtered in the browser over `mock_tests_for_me`. One additive migration, `20261120100000_mock_test_categories.sql`. Nothing here needs Saurabh's sign-off (section 8).

## 1. Storage

1. **Columns, not a tags join table.** Exactly one subject, one stream and a set of years per test (C2, C4). A join table buys multi-valued tags we have deferred (D-C2) and costs a join in every list function. Columns on `mock_tests`:
   1. `subject text` (null = not set). Stores the `SUBJECTS` key (`maths`), not the label.
   2. `stream text` (null = not set). Stores the programme slug (`vce`, `naplan`, ...).
   3. `year_levels smallint[] not null default '{}'`.
   4. `any_year boolean not null default false`.
2. **Year representation.** `year_levels` plus `any_year`, as the brief suggests: it keeps "Any year" explicit (AC 12) and "not set" distinct. Not set = `not any_year and cardinality(year_levels) = 0`. `smallint[]` matches `classes.year_levels` (ADR-0009, DEC-HM-1 to 3), so the web helpers (sort ascending, year labels) are reused. Constraints on the table:
   1. `check (not (any_year and cardinality(year_levels) > 0))`.
   2. A check in the style of DEC-HM-3: every year in 2 to 12, one dimension, lower bound 1 (empty array allowed). Ascending order is checked in the guard trigger (1.3.2), as for classes.
   3. All constraints are trivially true for existing rows (null, empty, false), so adding them validates instantly and cannot fail on hosted data (AC 18).
3. **Allowed values (AC 16): a private options table, enforced by a trigger.**
   1. `private.mock_test_options (kind text, key text, active boolean default true, primary key (kind, key))`, `kind` in (`subject`, `stream`). RLS on, no grants, no policies, same as `private.invite_tokens`. Seeded in the migration with the lists of ACs 10 and 11 (7 subjects, 6 streams).
   2. A `BEFORE INSERT OR UPDATE` trigger on `mock_tests`, `private.check_mock_test_tags()` (**security definer**, `search_path ''`, execute revoked from `public, anon, authenticated`; it must read `private.mock_test_options`, which `authenticated` cannot, the same reason `check_mock_question` is definer; an invoker version failed every tag write in a local reproduction): when `subject` or `stream` is non-null and **changed** (or the row is new), it must exist in the options table with `active`; years must be strictly ascending. Otherwise `raise exception using errcode = 'check_violation', message = 'invalid_mock_tag'`, with `hint` = the field name (`subject`, `stream` or `year_levels`, the last for year order and range) for the field-level message.
   3. Why not a check constraint: AC 27 says a removed value stays on tests that hold it. A check constraint would either block the removal migration (validates existing rows) or need `NOT VALID` games. A trigger that only checks changed values handles both, and "remove from list" becomes `update ... set active = false` in a migration.
   4. Why not a lookup table with a foreign key: two more public-style tables for no extra safety here, since the only writers are admins through the column grant.
   5. Why not a private function with a hard-coded list: same drift problem, no data to flip on removal.
4. **Years are not in the options table.** 2 to 12 is fixed in the check constraint, as for classes. It moves only with `YEAR_LEVELS`, which has not changed.

## 2. How tags are written

1. **Column grants, not a function.** Tags are content, like title and instructions in ADR-0012 decision 2. Extend the grants: `insert (…, subject, stream, year_levels, any_year)` and `update (…)` on `mock_tests` to `authenticated`, under the existing admin-only RLS policies (`private.is_admin()`, aal2). This lets the create dialog tag in one insert and the edit dialog in one update, and needs no new function. `status`, `released_*`, `closes_at` stay ungranted, so state still moves only in functions.
2. **Released and closed tests (AC 15, 17).** `private.check_mock_test` (freeze trigger, `20261118100000_mock_tests.sql:126`) only freezes title, instructions and delete, so tag updates on a released test already pass. The new guard trigger adds the "cannot clear" rule: when `old.status = 'released'`, a tag that was set can't become unset (subject/stream non-null to null, or years/any_year from set to not set). Changing to another valid value is allowed. A legacy untagged released test can be tagged one field at a time. The trigger is separate from `check_mock_test`, so the freeze function in the applied migration is not replaced.
3. **Concurrency.** A column update takes the row lock, so it serialises with `mock_release` and `mock_withdraw` (both `for update` on the test row). We do not rely on `OLD.status` being re-read after a lock wait. On UPDATE only, the guard runs `select t.status into current_status from public.mock_tests t where t.id = new.id for no key update;` and judges the clear-refusal on `current_status`, not OLD. No self-deadlock: the BEFORE trigger runs before the UPDATE locks the row, and it takes the same FOR NO KEY UPDATE lock the UPDATE then takes. A transaction never waits on a lock it already holds. Together with the draft-to-released trigger in 2.5, the order of a clear and a release no longer matters. A clear that lands first leaves tags unset, so release is refused; a release that lands first makes the clear refused. A two-session check proves both orders (6.6). Tag edits do not touch attempts, answers or `closes_at`. `set_updated_at` bumps `updated_at` as it does for a title edit.
4. **Release gate (AC 14): inside `mock_release`.** After the question-count check and the `closes` check, and before the update. The locked `select ... for update` returns `status, subject, stream, year_levels, any_year`; the tags are set when `subject is not null and stream is not null and (any_year or cardinality(year_levels) > 0)`; if that is false, raise `mock_tags_missing`. The same predicate, written once in the same form, is used by the draft-to-released trigger (2.5). The web already holds the row, so it names the missing tag from its own state (as it does for zero questions); the database is the authority and the web pre-check is a courtesy. The tags come from that locked select, so a tag edit can't slip between check and release.
5. **Second line of defence for every writer:** a `BEFORE UPDATE` trigger (in `private.check_mock_test_tags()` or beside it, also security definer) refuses `old.status = 'draft' and new.status = 'released'` unless the row's current tags meet the predicate. On that transition only, it reads them with `select t.subject, t.stream, t.year_levels, t.any_year into … from public.mock_tests t where t.id = new.id for no key update` and judges on that read, never on NEW. The predicate is `subject is not null and stream is not null and (any_year or cardinality(year_levels) > 0)`, the same as §2.4. It covers any future function or service-role path, not only `mock_release`. §6.6 adds a two-session case: session 1 clears the subject, session 2 does a direct `update … set status='released'`. In either order no released test is left without a tag; session 2 blocks, then fails with `mock_tags_missing`.
6. **Not a table check constraint** (`status = 'draft' or tags set`): on hosted data with untagged released rows, even a `NOT VALID` constraint would reject every later update of those rows (including Close now and the first tag edit if it is partial). The trigger in 2.5 checks the transition only, so legacy released rows are untouched.
7. **Take-back keeps tags** (AC 17): `mock_withdraw` does not touch them. No change needed.

## 3. Filtering: client-side

1. **Recommendation: client-side over `mock_tests_for_me`.** The function already returns every test the person may see, unpaginated. Add the four tag columns to its result. A pure function `filterMockTests(list, { stream, subject, year })` in `apps/web/src/lib/mock-tests.ts` applies AC 20 (AND; year matches `any_year` or `year in year_levels`; a set filter leaves untagged tests out; all-All returns everything). Unit tests cover AC 18, 20, 21.
2. **Size bound.** Tests are admin-written, one subject each, so the list is tens, not thousands. At about 250 bytes a row, 500 tests is about 125 KB per list load. Revisit, with server-side parameters and pagination, if released tests pass about 300, or the payload passes 100 KB. Server-side filtering now would add parameters to a function that must stay in step with the web rules, and a second code path for AC 18 and 20, for no user-visible gain. The filter selects are not remembered (AC 24), so no URL or storage design is needed.
3. **Filters change nothing about access (AC 25).** They never reach the database.
4. `mock_test_open` also returns the three tags (small, lets the test page show them). Optional; the list needs them.

## 4. Migration `20261120100000_mock_test_categories.sql`

Additive, ordered after the closing migration. Steps, in order:

1. Create `private.mock_test_options`, enable RLS, revoke all from `anon, authenticated`, seed the rows with `on conflict do nothing` inside a marked block (`-- mock-test-options:begin` / `:end`) that the parity test reads (section 5).
2. `alter table public.mock_tests add column` the four columns (constant defaults, no table rewrite) and the two checks.
3. Create `private.check_mock_test_tags()` and its trigger (value check, year order, clear-refusal with the locked status read); create the draft-to-released trigger (`mock_tests_release_needs_tags`, `BEFORE UPDATE`, same security definer settings, same predicate as the gate, judged on a `for no key update` read of the current tags on the transition only); revoke execute on both functions from `public, anon, authenticated`.
4. Extend the column grants (insert and update) with the four columns.
5. Replace four functions, taking their **current bodies from the closing migration**, not from `20261118100000`:
   1. `mock_release(uuid, timestamptz)`: `create or replace`, same signature, gains the tag gate.
   2. `mock_tests_admin_list()`: drop and create (return type gains four columns), then re-grant execute (`to authenticated`, revoked from `public, anon`).
   3. `mock_tests_for_me()`: drop and create, same visibility rule as the closing migration (the `closes_at` clause kept verbatim), gains four columns, re-grant.
   4. `mock_test_open`: `create or replace`, adds the tags to the jsonb.
6. Comments on the columns.

Safety on a hosted database that already has the mock tables:
1. **Nothing is rewritten or revalidated destructively.** Existing rows get null, `'{}'`, false. No data migration, no backfill: untagged old tests stay untagged (AC 18, US-C2). Whether any hosted test exists is Saurabh's open question 6; the design is correct either way.
2. **Old web build against the new database.** `main` has no mock test caller (the feature is on `develop` only), so production is not exposed. Staging, built from `develop`, is the only web that calls these functions, and it ships with the new dialogs. The hosted database is shared, but nothing on `main` reads or releases mock tests, so there is no mismatch window to manage.
3. **Lock-step with the closing migration.** Section 4.5 re-defines functions that file defines. Both land together at S-2. If the closing file changes again before merge, step 5 must be rebuilt from its final bodies, and the pgTAP closing tests must run after the categories migration too (they call `mock_release` and `mock_tests_for_me`). The Dev Lead must tell the categories developer when the closing file is final.
4. **Rollback.** The migration stays (additive). If the web is rolled back, nothing else needs to move except that release needs tags (above).

## 5. Keeping the database and the web in step

1. **Source of the web copy.** `mock-tests.constants.ts` gets `MOCK_TEST_SUBJECTS` (derived from `SUBJECTS` minus `interview-preparation`) and `MOCK_TEST_STREAMS` (the six programme slugs with their `menuLabel`, built from `PROGRAMMES`/`PROGRAMME_SLUGS`). Years use `YEAR_LEVELS` and `YEAR_LEVEL_TEXT`. No new strings elsewhere (house rule, AC 27).
2. **Vitest parity test** (precedent: `portal-validation.test.ts` reads `supabase/config.toml`): reads every migration in filename order, extracts each `mock-test-options` marked block, replays the rows with last write winning per (kind, key) (an insert sets active; a later `active = false` row switches it off), and asserts the active subject and stream keys equal the constants exactly (order-insensitive). It also asserts every stream key is in `PROGRAMME_SLUGS` and every subject key is in `SUBJECTS`, so a rename in the shared constants fails here rather than silently changing what a test can hold. It also asserts the migration's year range equals `YEAR_LEVELS`.
3. **pgTAP** in `supabase/tests/database/mock_tests_categories.test.sql`: asserts the active option keys equal a literal list (catches drift between the seed and the live schema), plus the behaviours in section 6.
4. **When a list changes later:** a new migration updates the options table (insert, or `on conflict (kind, key) do update set active = excluded.active` to switch a value off), the constants change in the same PR, and the new migration carries its own marked block, which the replay picks up. The two tests fail if either side is forgotten. Accepted cost: a list change is a migration, not an admin action (C1).

## 6. Tests required (for the Test stage)

0. Every pgTAP tag write runs as the real caller: `tests.authenticate_as(..., 'aal2')` then `set local role authenticated`, never as the superuser (a superuser write skips the privilege check that exposed the invoker-trigger bug).
1. pgTAP: write accepted for each valid subject, stream, years, Any year; refused for an unknown subject, unknown stream, year 1 or 13, duplicate or descending years, years and Any year together; each refusal leaves the row unchanged (AC 16).
2. pgTAP: release refused with `mock_tags_missing` for each missing tag, accepted with Any year; a tag on a released test can be changed but not cleared; a legacy untagged released test can be tagged one field at a time; a value made inactive stays on its row and is not rejected when unchanged, but is rejected when set on another test (AC 15, 27).
3. pgTAP: tag edits do not change title, questions, attempts, answers or `closes_at`; take-back keeps tags; `anon` and a non-admin `authenticated` cannot write tags; no grant on `status`.
4. pgTAP: `mock_tests_for_me` and `mock_tests_admin_list` return the tags; the closing rules (S-1) still hold after the categories migration.
5. Vitest: `filterMockTests` (AND, Any year match, untagged left out when any filter is set, closed-but-submitted tests filtered like others), the parity test, the empty-state messages.

6. **Two-session check (Dev Lead runs it, in the style of the S8 check noted at `mock_tests_admin.test.sql:343`):** two psql sessions as an admin at aal2 on one draft test with all tags set. Order A: session 1 begins and calls `mock_release`; session 2 tries to clear the subject and blocks; session 1 commits; session 2 must fail (clear refused on a released test). Order B: session 1 begins and clears the subject on the draft; session 2 calls `mock_release` and blocks; session 1 commits; session 2 must fail with `mock_tags_missing`. Neither order may end with a released test lacking a tag. Record the output in the test report.

## 6A. Stage 3 work (UI, not database)

ACs 12, 19, 22, 23, 26, 27 and 29 are web behaviour and belong to Stage 3: the Any year versus years choice (12); the three filter controls and their labels (19); the two empty states (22); tags on each taker row with "Not set" (23); labels, keyboard, 375/1280 px, light and dark (26); removed-value display by saved label or key (27); no tags on public pages, sitemap or e-mail (29). The database supplies the data only.

## 6B. Error mapping

1. The guard raises `check_violation` (23514) with message `invalid_mock_tag` and the field name in `hint` (`subject`, `stream`, or `year_levels`, which is also the hint for year order and range failures); the web maps it per field to a field-level message. The release gate raises `mock_tags_missing`. Both are added to the error map in `apps/web/src/services/auth-errors.ts`, with texts in `apps/web/src/constants/error.constants.ts` (no raw database text reaches the screen).

## 7. ADR

Yes, an amendment to ADR-0012, not a new ADR: it extends decision 2 (column grants), the freeze exception for tags, and adds one private table. Written as "Amendment 1" in `docs/decisions/0012-mock-tests-own-tables-rpc-only-taker-access.md`. The closing amendment (ruling S-1, closes_at) is the Dev Lead's to add; this one does not touch it.

## 8. Irreversible or costly, and risks

1. **Nothing needs Saurabh's sign-off.** Columns are additive, nullable by default, and can be dropped before any real tagging (dropping later loses tags, a cheap data loss at current volume). Stored values are stable keys (`maths`, `vce`), so labels can change freely.
2. **Mild, worth knowing:** the migration goes to the shared hosted database (S-2). `main` has no mock test caller, so only staging is exposed, and it matches the new schema.
3. **Risk, lock-step with closing** (4.3): four functions are replaced twice in two files. Mitigated by building from the closing file's final bodies and running its pgTAP file after this migration.
4. **Risk, list drift** (section 5): mitigated by the two parity tests. The `SUBJECTS` file calls itself a placeholder pending owner review; a change there fails the parity test on purpose.
5. **Risk, the client-side filter** stops being right past about 300 tests (3.2).
6. **Where this touches closing:** `mock_release` (gains the gate; keeps `closes`), `mock_tests_for_me` and `mock_tests_admin_list` (re-created with `closes_at` plus tags), `mock_test_open` (jsonb gains tags), and the S-1 visibility clause, which must be copied unchanged. Tag edits never touch `closes_at`, and closed tests are filtered like open ones (AC 20).
