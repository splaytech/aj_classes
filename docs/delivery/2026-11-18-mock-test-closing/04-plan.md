# 04 — Plan: mock test categories (Part B, ACs 10 to 29)

Stage 4 (Manager), 18 Nov 2026. Branch `feature/mock-test-closing`. Part A (closing, ACs 1 to 9) is built (`9cba1b4`, `e584243`, `8f1d2bf`) and is not re-planned here.

Inputs: `01-requirement.md` (Part B), `00-decisions.md` (S-1, S-2), `02-architecture.md`, `03-design.md` (final round-3 text, which carries the `review-3.md` fixes), `05-dev-notes.md`, and `review-4.md` (round 2 of this plan, applied below).

## How to read this plan

- A slice ticks only when its command passes on the branch. Every slice's command ends with `pnpm typecheck && pnpm lint`, in addition to the command named for it.
- **Verified by the manager** (run once, read-only): `pnpm --filter web exec vitest run src/lib/mock-tests.test.ts src/lib/portal-validation.test.ts` (2 files, 33 tests passed). `pnpm exec prettier --check` passes on `apps/web/src/constants/mock-tests.constants.ts`, `apps/web/src/lib/mock-tests.ts` and `apps/web/src/lib/portal-validation.test.ts`. Prettier cannot parse `.sql`, so never pass a `.sql` file to it. The root and web scripts named below exist in `package.json`, including `db:types` (which regenerates `apps/web/src/services/database.types.ts` from the local database and formats it). `findProgramme`, `classYearLabel` and `YEAR_LEVEL_TEXT` exist. The ADR amendment exists (`docs/decisions/0012-mock-tests-own-tables-rpc-only-taker-access.md`, "Amendment 1").
- **Not run by the manager** (hard limits: no DB, no git, no code): every `db:*` command, the full suite, the build, and e2e. The Developer runs each once before ticking the slice that uses it.

### Order note (dependencies)

1. **Slices 1 and 2 land as one commit with one gate.** Slice 1 alone leaves the three existing pgTAP files red, so it is never committed on its own.
2. **Slice 6a (option lists and error texts) lands with slice 4 (parity) and before slice 5 (service).** Slices 4 and 5 import from it.
3. **The tag input moves to 7a.** `MockTestInput.tags`, and the tag columns that `createMockTest` and `updateMockTest` send, are added in 7a, when the dialog starts sending them. Until then slice 5 changes only the output types, the mappers and `updateMockTestTags`, so the build compiles at every slice.
4. **Slice 7 is split** into **7a** (helpers, `MockTagFields`, `MockTestDialog`) and **7b** (release dialog, tags-only dialog, tag lines, pages). The pure helpers in `lib/mock-tests.ts` are in 7a, except `filterMockTests`, which is slice 8.
5. **The rest of slice 6 (6b, dialog and filter strings) lands with 7a and 8.**

---

## Slice 1: migration, options seed, guard and release trigger

- [ ] **1.1** Create `supabase/migrations/20261120100000_mock_test_categories.sql`.

**Files:** `supabase/migrations/20261120100000_mock_test_categories.sql` (new). Nothing else.

**What it holds** (design §1.3, final text):
1. `private.mock_test_options` with RLS on, no policy, revoked from `anon, authenticated`. The seed block sits between `-- mock-test-options:begin` and `-- mock-test-options:end` and uses `on conflict (kind, key) do update set active = excluded.active`, so a re-run flips a value.
2. The four columns and the two table checks (design §1.3 step 3).
3. The guard `private.check_mock_test_tags()` (`before insert or update`, `security definer`, `set search_path = ''`, execute revoked from `public, anon, authenticated`):
   - **Steps 1 and 4 run only inside `if tg_op = 'UPDATE' then … end if;`.** Step 4 is a nested `if current_row.status = 'released'`, never an `and` with `tg_op`. On INSERT `current_row` is never assigned, and reading it raises `record "current_row" is not assigned yet`.
   - **The locked read** is on UPDATE only: `select t.status, t.subject, t.stream, t.year_levels, t.any_year into current_row from public.mock_tests t where t.id = old.id for no key update;`. It reads `old.id`, not `new.id`, because a superuser rename of the id (admin line 29) must still find the row. The clear-refusal judges on `current_row`, never on `old`.
   - A refused clear raises `mock_tag_kept` with the field in `hint` (review 1), not `invalid_mock_tag`.
   - Years: the trigger refuses, in order, a multi-dimensional array or a lower bound other than 1, any NULL element, a non-ascending or duplicate list, a value outside 2 to 12, and years with `any_year`. Every one arrives as `invalid_mock_tag` with `hint = 'year_levels'`. The CHECK constraints stay as the backstop, because a CHECK can pass a NULL element.
4. The release trigger `private.check_mock_test_release_tags()` on `old.status = 'draft' and new.status = 'released'`. It judges on its own locked read, by `old.id`.
5. Grants: insert and update on the four columns to `authenticated`.
6. Replace the four functions, copying each body from the closing migration `20261119100000_mock_test_closing.sql`, not from `20261118100000`. Re-check each range first with `grep -n "function public.<name>" supabase/migrations/20261119100000_mock_test_closing.sql | tail -1` and the next `$$;` (design §1.2).
   - `mock_tests_admin_list()` and `mock_tests_for_me()`: **drop, then create**, because their return types change.
   - `mock_release(target uuid, closes timestamptz default null)`: `create or replace`, **keeping the parameter names `target` and `closes`**. The locked select reads the tags too (`for update`), and the tag gate (`mock_tags_missing`) sits after the `mock_no_questions` and `mock_closes_in_past` checks and before the update.
   - `mock_test_open(uuid)`: `create or replace`, adds the tags to the jsonb.
   - The S-1 clause and the closed check are copied verbatim.
7. Re-grant execute on the four functions, as the closing file does.

**Test that proves it (with slice 2):** the migration applies to a fresh local database, and the pgTAP files in slice 2 pass.

**Command:** `pnpm db:reset` (exit 0), then the slice 1+2 gate below.

---

## Slice 2: fixtures, so the existing suites go green again

Slices 1 and 2 are one commit. Fixture work and the migration are reviewed together.

- [ ] **2.1** `mock_tests_admin.test.sql`:
  - line 25: the admin's insert adds `subject, stream, any_year` (`'maths', 'naplan', true`). It runs as `authenticated` at aal2, so it also proves the new column grant;
  - line 29: the superuser `update … set id = …` rename stays (the guard reads by `old.id`);
  - line 45 stays. It is a direct `status = 'released'` write as `authenticated`, which fails with 42501 from the column grant before any trigger runs, so its expected error does not change;
  - line 431: the direct `status = 'released'` write on f004 runs as postgres, so it would reach the release trigger. **Tag f004 first** (a superuser update setting `subject, stream, any_year`), or it fails with `mock_tags_missing`;
  - the `mock_tests_admin_list` key pin (lines 449 to 452) gains four keys and becomes 14: `any_year, closes_at, created_at, created_by_name, id, question_count, released_at, status, stream, subject, submitted_count, title, updated_at, year_levels`.
  - No assertions are removed from this file. The new assertions go in slice 3.
- [ ] **2.2** `mock_tests_taker.test.sql`: lines 44 to 54 insert T1, T2 and T3 with tags (`'maths', 'naplan', true`) before the direct `update … set status = 'released'` on T1 and T3 (lines 54 and 55), which the release trigger would otherwise refuse.
- [ ] **2.3** `mock_tests_closing.test.sql`: the inserts at lines 22 and 23 (T1, T2, T9) get the same tags. The `mock_release` calls at lines 105 and 410 then succeed. Take-back keeps tags (AC 17), so the release at 410 needs nothing more.
- [ ] **2.4** `open_sign_up_access.test.sql` (the AC-26 function allowlist): run it. The names do not change, so it should pass unedited. Edit it only if it fails on a real change.
- [ ] **2.5** E2e, `e2e/tests/mock-tests.spec.ts`. The draft check is at line 79 (`expect(draft?.status).toBe('draft')`), the Release click at line 82. Between them, add: `await db.query('UPDATE public.mock_tests SET subject = $2, stream = $3, any_year = true WHERE id = $1', [draft.id, 'maths', 'naplan'])`, then `await admin.reload()`, then the Release click. The tags are written by SQL, so the UI release dialog starts with saved tags. The spec already uses `db.query` at line 44.

**Test that proves it:** `pnpm db:reset && pnpm db:test` (all mock files and `open_sign_up_access` pass), then the existing mock spec in e2e on the local stack.

**Gate for slices 1 and 2 (one commit):**
1. `pnpm db:reset && pnpm db:test`
2. `pnpm --filter aj-classes-e2e test:smoke` (local stack and web up; the Dev Lead owns the stack)
3. `pnpm typecheck && pnpm lint`

Read the failing file list. The `Files=` count is not a pass criterion.

**Owner:** Developer (migration and fixtures), Dev Lead (stack and e2e run).

---

## Slice 3: new pgTAP, `mock_tests_categories.test.sql`

- [ ] **3.1** Create `supabase/tests/database/mock_tests_categories.test.sql`. Every tag write runs as the caller: `tests.authenticate_as(..., 'aal2')`, then `set local role authenticated`. Never as superuser (design §7, row 0).
- [ ] **3.1b** **Regression for the INSERT path:** as `authenticated` at aal2, an INSERT of a tagged row and an INSERT of an untagged draft both succeed. This is the case the `current_row` read must not break.
- [ ] **3.2** Write-path cases (AC 13, 16): draft insert and update with no tags, and with each valid subject, stream, years and Any year, all accepted. Refused with `invalid_mock_tag` and the right `hint` for: unknown subject, unknown stream, year 1, year 13, duplicate years, descending years, years with Any year, and the three shape cases, each with `hint = 'year_levels'`:
  - a NULL element (`array[3, null]::smallint[]`);
  - a lower bound other than 1 (`'[0:0]={7}'`);
  - a two-dimensional array (`'{{7,8}}'`).
  Each refusal leaves the row unchanged.
- [ ] **3.3** Release cases (AC 14): `mock_release` raises `mock_tags_missing` for each missing tag separately, and is accepted with Any year. A direct `update public.mock_tests set status = 'released'` on an untagged draft is refused by `mock_tests_release_needs_tags`. This one runs as the table owner, because `authenticated` has no grant on `status` (design §7, row 14).
- [ ] **3.4** Released and closed rules (AC 15, 27): on a released and on a closed test, a missing tag can be set one field at a time; a set tag can change to another valid value; a set tag cannot be cleared (subject, stream, years, and Any year to nothing) and is refused with `mock_tag_kept` and the field in `hint`; title and instructions stay frozen (`mock_released` still raised); attempts, answers and `closes_at` are untouched by a tag edit.
- [ ] **3.5** Removed values (AC 27): a subject made inactive stays on its row; an unrelated update of that row passes; setting it on another test is refused.
- [ ] **3.6** Other behaviour (AC 17, 18, 25): take-back keeps the four columns; `mock_set_closing`, `mock_close_now` and reopen leave them unchanged; a released row with null tags (superuser fixture) is listed by `mock_tests_for_me` and `mock_tests_admin_list` with null, empty and false tags; `anon` and a non-admin `authenticated` cannot write tags; no grant on `status`. The S-1 closing rules still hold (re-run `mock_tests_closing` in the same run).
- [ ] **3.7** **Two-session check** (not in pgTAP; the Dev Lead runs it on the local stack with two `psql` sessions, as an admin at aal2, on one fully tagged draft). Orders:
  - A: session 1 begins and calls `mock_release`; session 2 starts a clear of `subject` and blocks; session 1 commits; session 2 must fail with `mock_tag_kept`.
  - B: session 1 begins and clears `subject` on the draft; session 2 calls `mock_release` and blocks; session 1 commits; session 2 must fail with `mock_tags_missing`.
  - C: session 1 begins and clears `subject`; session 2, as the table owner, runs `update public.mock_tests set status = 'released', released_at = now() where id = …` and blocks; session 1 commits; session 2 must fail with `mock_tags_missing`. Mirror: session 2 first, then session 1's clear must fail.
  - Neither order may leave a released test without a tag. Paste the raw psql output into the test report.

**Test that proves it:** the pgTAP file, run in the full set, plus the 3.7 transcript.

**Command:** `pnpm db:reset && pnpm db:test`; the two-session transcript (psql against the local stack, URL from `pnpm db:status`); then `pnpm typecheck && pnpm lint`. A single-file CLI run is for the Developer to confirm once.

**Owner:** Developer (pgTAP), Dev Lead (two-session check).

---

## Slice 4: parity vitest

- [ ] **4.1** Create `apps/web/src/lib/mock-test-options.parity.test.ts`.
- [ ] **4.2** The parser reads every migration in filename order, and each `-- mock-test-options:begin` to `-- mock-test-options:end` block in each. Within a block it reads tuples of two elements (`('kind','key')`, active) and of three (`('kind','key', false)`, a removal). Last write wins per `(kind, key)`.
  - **Removal form:** its own marked block, as in design §1.3.2, never an edit to the seed block:
    ```
    -- mock-test-options:begin
    insert into private.mock_test_options (kind, key, active) values ('subject','writing', false)
    on conflict (kind, key) do update set active = excluded.active;
    -- mock-test-options:end
    ```
  - The file header records this form.
- [ ] **4.3** Assertions: active subject keys equal `MOCK_TEST_SUBJECTS` keys; active stream keys equal `MOCK_TEST_STREAMS` keys (order-insensitive); every stream key is a `PROGRAMME_SLUGS` value; every subject key is in `SUBJECTS`; the migration's year range (the `mock_tests_year_levels_valid` literal) equals `YEAR_LEVELS`; each `MOCK_TEST_STREAMS` label equals the programme's `menuLabel`. Add one parser case on an inline sample with a removal block, to show a removed key switches off.

**Test that proves it:** the parity test itself, plus one red run on a deliberate drift (a local, uncommitted edit, reverted before the commit).

**Command:** `pnpm --filter web exec vitest run src/lib/mock-test-options.parity.test.ts`; then `pnpm typecheck && pnpm lint`.

**Needs:** slice 6a, and slice 1's seed block.

**Owner:** Developer.

---

## Slice 5: service, types, error mapping (reads and errors only)

- [ ] **5.1** `services/types.ts`: `MockTags` (design §2.1). `tags: MockTags` on `MockTestSummary`, `MockTestDraftView`, `MockTestListItem` and `MockTestView`. **`MockTestInput.tags` is not added here** (it moves to 7a). The same slice adds tag values to every typed fixture, so `pnpm typecheck` passes at slice 5:
  - `components/portal/MockTestTakeForm.test.tsx:14`;
  - `components/portal/MockTestResult.test.tsx:9`;
  - `routes/portal/mock-tests.test.tsx:19`;
  - `routes/portal/mock-test.test.tsx:26, 37, 46`;
  - `routes/portal/admin-mock-test.test.tsx:52, 65`;
  - `routes/portal/admin-mock-tests.test.tsx:22, 34`.

  Record the slice 5 command output.
- [ ] **5.2** `services/mock-tests-data.ts`: the four row fields on `MockSummaryRow`, `MockListRow` and `MockOpenJson`; `toMockTags`, used by the four mappers and by `getMockTestForEdit`; `toMockTagColumns`, which sorts years ascending (used from 7a).
- [ ] **5.3** `services/mock-tests.service.ts`: `getMockTestForEdit` selects the four columns and returns `tags`. New `updateMockTestTags(testId, tags)` sends only the four columns and returns `notAllowed` when no row comes back. Export `updateMockTestTags` and `MockTags` from `services/index.ts`. `createMockTest` and `updateMockTest` are unchanged here.
- [ ] **5.4** `services/auth-errors.ts`: `SupabaseLikeError.hint`. `mock_tags_missing` maps to `mockTagsMissing`. `mock_tag_kept` maps to `mockTagKept`. `invalid_mock_tag` maps by hint (`subject` to `mockTagSubject`, `stream` to `mockTagStream`, `year_levels` to `mockTagYears`, anything else to `invalidInput`). Any other 23514 stays `invalidInput`.
- [ ] **5.5** `constants/error.constants.ts`: the five new keys, with their texts (part of 6a): `mockTagsMissing`, `mockTagKept` (text from `MOCK_VALIDATION.tagKeep`), `mockTagSubject`, `mockTagStream`, `mockTagYears` (text from `MOCK_VALIDATION.tagYears`).
- [ ] **5.6** Regenerate `apps/web/src/services/database.types.ts` with `pnpm db:types`, after slice 1 applies locally. The script runs against the local database only.

**Files:** `types.ts`, `mock-tests-data.ts`, `mock-tests.service.ts`, `index.ts`, `auth-errors.ts`, `error.constants.ts`, `database.types.ts`.

**Tests that prove it:** `mock-tests.service.test.ts` (`updateMockTestTags` sends only the four columns, and returns `notAllowed` when no row comes back; the readers return `tags`); `auth-errors.test.ts` (`mock_tags_missing`, `mock_tag_kept`, each of the three `invalid_mock_tag` hints, an unknown hint to `invalidInput`, a non-tag 23514 unchanged).

**Command:** `pnpm --filter web exec vitest run src/services/mock-tests.service.test.ts src/services/auth-errors.test.ts`; `pnpm db:types`; then `pnpm typecheck && pnpm lint`.

**Owner:** Developer.

---

## Slice 6: constants

- [ ] **6a (lands with slices 4 and 5)** In `constants/mock-tests.constants.ts`:
  - `MOCK_TEST_EXCLUDED_SUBJECT_KEYS = ['interview-preparation'] as const`, and `MOCK_TEST_SUBJECTS = SUBJECTS.filter(...)` (AC 10);
  - `MOCK_TEST_STREAM_SLUGS` in AC 11 order, and `MOCK_TEST_STREAMS` with each label from `findProgramme(slug)?.menuLabel` (review 8);
  - the five error keys and texts in `error.constants.ts` (slice 5.5).
- [ ] **6b (lands with 7a and 8)** `MOCK_TAGS`, `MOCK_TEST_FILTERS`, `MOCK_TAG_ANY = 'any'`, the `MOCK_VALIDATION` additions (`tagSubject`, `tagStream`, `tagYears`, `tagKeep`), and `MOCK_TESTS_ADMIN_PAGE.columns.tags`. Copy in lower case with "and" (review 13). No new strings outside these files.

**Test that proves it:** the parity test (slice 4) covers the 6a option lists and stream labels. The 6b strings are read by the component tests in 7a, 7b and 8.

**Command:** `pnpm --filter web exec vitest run src/lib/mock-test-options.parity.test.ts`; then `pnpm typecheck && pnpm lint`.

**Owner:** Developer.

---

## Slice 7a: helpers, tag fields and create/edit dialog (AC 12, 13, 16 on the screen)

- [ ] **7a.1** `lib/mock-tests.ts` (design §4, without `filterMockTests`): `mockYearsSet`, `missingMockTagFields`, `setMockTagFields`, `mockTagErrors`, `applyYearPick` (three branches), `mockSubjectText`, `mockStreamText` (uses `findProgramme`, so a removed stream keeps its label), `mockYearText`, and **`mockTagNamesText(fields)`** (the lower-case field names joined "a, b and c", from `MOCK_TAGS.fieldNames`, `listSeparator` and `listAnd`). Unit tests in `lib/mock-tests.test.ts`, including `mockTagNamesText` for the three-, two- and one-field cases.
- [ ] **7a.2** `components/portal/MockTagFields.tsx` (new): Subject and Stream selects with:
  - a `notSet` item first when `canClear`;
  - when `!canClear` and the value is null, a **disabled** `notSet` item, so the select shows "Not set" rather than a blank (a legacy untagged released test);
  - a disabled "(no longer offered)" item for a removed key;
  - `key={x.key}` on every `MenuItem`.
  
  The Year level multi-select has an Any year item, `renderValue: () => mockYearText(value)` (review 10), and `applyYearPick` on change.
- [ ] **7a.3** `components/portal/MockTestDialog.tsx` (changed): tags state, `MockTagFields` below instructions. **`MockTestInput.tags` is added here**, and `createMockTest` and `updateMockTest` send `toMockTagColumns(input.tags)`. `validateMockTest` takes `Pick<MockTestInput, 'title' | 'instructions'>` (review 12). A draft saves with no tags (AC 13).
- [ ] **7a.4** Export `MockTagFields` from `components/portal/index.ts`.

**Tests that prove it:**
- `lib/mock-tests.test.ts`: the three `applyYearPick` branches; `mockTagErrors` with set and unset cases; `mockTagNamesText`.
- `components/portal/MockTagFields.test.tsx`: click Any year, then Year 5, then Any year. Years clear, Any year clears, nothing set. A removed value shows its disabled item. **With `canClear` false and a null value, a disabled "Not set" item shows.**
- `components/portal/MockTestDialog.test.tsx` (new, review 11): saves with no tags on a draft; sends tags when set; edit shows the saved tags.

**Command:** `pnpm --filter web exec vitest run src/lib/mock-tests.test.ts src/components/portal/MockTagFields.test.tsx src/components/portal/MockTestDialog.test.tsx`; then `pnpm typecheck && pnpm lint`.

**Owner:** Developer.

---

## Slice 7b: release dialog, tags-only dialog, tag lines and pages (AC 14, 15, 23, 28)

- [ ] **7b.1** `MockClosingDialogs.tsx` (`MockReleaseDialog`, changed): shows the release text, `MockTagFields` with `canClear` false, then the closing field. Submit runs `mockTagErrors` on all three fields and stops if any are missing. Inside one `action.run`, if the tags differ from the saved ones, `updateMockTestTags` runs first and release second. A failed release after a saved tag edit keeps the tags and says why. `MockClosingDialog` is untouched.
  - **[ASSUMPTION, deviates from AC 14's "the same way it does for zero questions"]:** the Release button stays enabled when a tag is missing. The hint under the header names what is missing (`mockTagNamesText`), and the dialog will not submit until all three are set. Reason: the dialog lists the missing fields, so the admin fixes them there, while zero questions needs a different page, so only that case disables the button. The alternative, which also meets AC 14, is to disable the button for missing tags. It removes the tag fields and the `updateMockTestTags` call from the release submit. Saurabh can flip it.
- [ ] **7b.2** `components/portal/MockTagsDialog.tsx` (new): for released and closed tests. Required fields are the set ones (a set tag cannot be cleared, an unset legacy tag can be left alone). Submit calls `updateMockTestTags`. Focus returns to the Edit tags button after save (review 14).
- [ ] **7b.3** `components/portal/MockTagLine.tsx` (new): three body2 items, `Subject: Maths`, `Stream: NAPLAN`, `Year level: Any year`, with `Not set` for a missing tag. Wrapped row, or a column with `stacked`.
- [ ] **7b.4** Pages: `routes/portal/admin-mock-test.tsx` (tags card before Instructions; "Edit tags" on released and closed; a missing-tags hint on a draft that names the missing fields via `mockTagNamesText`); `routes/portal/admin-mock-tests.tsx` (Tags column, no filter, D-C3); `routes/portal/mock-test.tsx` (tag line under the title).
- [ ] **7b.5** Export `MockTagsDialog` and `MockTagLine` from `components/portal/index.ts`.
- [ ] **7b.6** **AC 29 scope test** (new): `apps/web/src/lib/mock-tests-scope.test.ts`. It greps `apps/web/src` (the sitemap source is `apps/web/src/routes.ts`) and `supabase/functions/notifications/` (`template.ts`, `copy.ts`) for the tag components and `MOCK_TAGS`, and asserts they are imported only from files under `routes/portal` and `components/portal`. It also asserts the sitemap source and the e-mail template sources do not reference them.

**Tests that prove it:**
- `MockClosingDialogs.test.tsx`: submit with a missing field shows it and does not call the service; with tags changed, `updateMockTestTags` is called before `releaseMockTest`; the Release button is enabled with a tag missing (the [ASSUMPTION] above).
- `MockTagsDialog.test.tsx`: cannot clear a set tag; can set a missing one; **a null legacy value shows a disabled "Not set" item**.
- `MockTagLine.test.tsx`: `Not set` for a missing tag.
- Page tests: the admin list and edit page render the tags; the take page renders them.
- `lib/mock-tests-scope.test.ts`: the AC 29 scope test in 7b.6.

**Command:** `pnpm --filter web exec vitest run src/components/portal src/routes/portal src/lib/mock-tests-scope.test.ts` (scope to the touched files if the folder is too slow); then `pnpm typecheck && pnpm lint`.

**Owner:** Developer.

---

## Slice 8: taker filters (AC 19 to 25, 27)

- [ ] **8.1** `lib/mock-tests.ts`: `filterMockTests(items, filters)`. A set filter matches only tagged items. Year matches `anyYear` or an exact year. Untagged items pass only the all-All case. Closed-but-submitted items are filtered like the rest (AC 20, 21). Test table of combinations in `lib/mock-tests.test.ts`.
- [ ] **8.2** `components/portal/MockTestFilters.tsx` (new): a `section` with `aria-label` `MOCK_TEST_FILTERS.groupLabel`; three `TextField select`s labelled Stream, Subject and Year level, All first. Year level offers `YEAR_LEVELS` only (no Any year). **Stream and Subject offer the current `MOCK_TEST_STREAMS` and `MOCK_TEST_SUBJECTS` only, so a removed value is absent from the filter (AC 27).** Export from `index.ts`.
- [ ] **8.3** `routes/portal/mock-tests.tsx`: `useState(NO_MOCK_FILTERS)` placed above the early `LoadError` return. Three states: no tests at all shows `MOCK_TESTS_LIST.empty` and no bar (AC 22a); tests shown with the bar and the rows, each with `MockTagLine`; a filter that matches nothing shows `noMatch` and a Clear control (AC 22b). No search parameters are written (AC 24).

**Tests that prove it:**
- `lib/mock-tests.test.ts`: AND of three; Any year match; untagged out with any filter set; closed-but-submitted filtered like the others.
- `components/portal/MockTestFilters.test.tsx`: labels exist (`getByLabelText`); Year level has no Any year; keyboard selects operate; **a removed subject or stream is not among the options (AC 27)**.
- `routes/portal/mock-tests.test.tsx`: the two empty states kept apart; Clear restores; a remount resets to All; `location.search` unchanged; the filter does not call the service (AC 25).

**Command:** `pnpm --filter web exec vitest run src/lib/mock-tests.test.ts src/components/portal/MockTestFilters.test.tsx src/routes/portal/mock-tests.test.tsx`; then `pnpm typecheck && pnpm lint`.

**Owner:** Developer.

---

## Slice 9: e2e smoke additions

- [ ] **9.1** `e2e/tests/mock-tests.spec.ts` and `e2e/tests/mock-tests.selectors.ts`:
  - create a draft, tag it in the UI, edit it, and release it;
  - release is refused with the missing-tag message on an untagged draft;
  - edit tags on a released test;
  - the taker list: one filter narrows the list; a filter with no match shows the message and Clear restores the list.

**Test that proves it:** the new e2e cases pass on the local stack, and the existing mock case still passes.

**Command:** `pnpm --filter aj-classes-e2e test:smoke`; then `pnpm typecheck && pnpm lint`. The csp run is in the definition of done.

**Owner:** Developer (spec), Dev Lead (stack).

---

## Slice 10: docs

- [ ] **10.1** `05-dev-notes.md`: add a Part B section (what was built, commits, the review fixes, the two-session transcript location, and what was not run).
- [ ] **10.2** Confirm `docs/decisions/0012-…md` Amendment 1 matches what was built. Change nothing else in the ADR.
- [ ] **10.3** Do not touch `01-requirement.md`, `00-decisions.md` or `02-architecture.md`. Any change in them is a ruling.

**Test that proves it:** a reviewer reads the changed text against the code. `docs/` is in `.prettierignore`, so `format:check` does not check it.

**Command:** none automated. The Dev Lead greps the new section for the commit list.

**Owner:** Dev Lead.

---

## Definition of done

Run each command separately, on the feature branch, after the last slice. Record the output of each.

1. `pnpm format:check`. Expected to fail only on `actionItems.md` and `supabase/.temp/linked-project.json` (both already failing on the closing commit). If a touched `.ts`, `.tsx` or `.json` file fails, fix only that file with `pnpm exec prettier --write <file>`. Never run it repo-wide, because that pulls in unrelated reformatting.
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test` (web vitest, e2e unit and `test-deploy-order`)
5. `VITE_APP_ENV=production pnpm build`
6. `pnpm db:reset && pnpm db:test` (all mock files, `open_sign_up_access`, and the closing file re-run after this migration)
7. `pnpm test:functions`
8. `pnpm --filter aj-classes-e2e test:smoke` (local stack and web up)
9. `pnpm --filter aj-classes-e2e test:csp`
10. `pnpm --filter web check:hosted-ref`
11. The two-session transcript (3.7), pasted into the test report.
12. **tester-ui real-browser rows** (Playwright in the installed Chrome, plus the manual checks), at 375 px and 1280 px, light and dark, with keyboard use:
    - AC 18: an untagged old released test shows "Not set" on the taker list and the admin list;
    - AC 23: each taker row shows its subject, stream and year level, with "Not set" for a missing one;
    - AC 26: the three filter labels exist, the selects work by keyboard, and the layout holds at both widths in both appearances;
    - AC 27: a removed value shows by its saved label on view and edit, and the filters offer only current values;
    - AC 28: the admin list Tags column and the edit-page card show the tags, and the admin list has no filter.

Each count comes from a script or the raw output. Team lead re-verifies the numbers before relaying them.

---

## Deploy order

The hosted database is shared with production (S-2). Keep the steps in this order.

1. **Gate green** on the branch (all of the definition of done).
2. **Check `main` has no mock-test caller** (`git grep` on `main` for `mock_` in `apps/web/src`). Arch §4.2 says none exists. The team lead runs this check, because the manager may not run git.
3. **Pre-check the pending migrations (team lead only, read-only):** run `supabase migration list` against the linked hosted project. The pending set must be exactly `20261119100000` and `20261120100000`. If the list shows any other pending migration, or is missing either of these two, **stop and ask Saurabh** before anything is applied.
4. **Apply the two migrations to hosted, in order:** `20261119100000_mock_test_closing.sql`, then `20261120100000_mock_test_categories.sql`. Use `supabase db push` against the linked hosted project. **Do not run `supabase/scripts/deploy.sh` for this step:** it also pushes config and auth settings, which is wider than this change. S-2 authorises this step.
5. **Merge to `develop` and push.** The push builds staging. Do this only after step 4. A staging build older than the migration calls the dropped `mock_release(uuid)` signature.
6. **Saurabh verifies in staging** (S-2). The tester-ui real-browser rows (definition of done, item 12) run on localhost in the release gate, **before the merge**, not on staging.
7. **Production web:** only from `main`, after Saurabh's go. The DB is already migrated, so the prod web needs no database step, and `main` has no mock-test UI.

**Rollback:** the migration is additive, so it stays. Rolling the web back to a build without the tag UI is not a clean undo. That build cannot set tags, so **release stays refused (`mock_tags_missing`) for every new test it creates**. Tests that already have tags are unaffected. The fix is to deploy forward again, not to roll the web back alone (arch §4.4).

---

## Risks

1. **Shared database is production's database** (S-2). Mitigation: deploy-order steps 2 to 4, with the pending-set pre-check, and no migration before the gate.
2. **Lock-step with the closing file** (arch §4.3). If the closing file changes again, rebuild the four function bodies from its final text, and re-run `mock_tests_closing` after this migration.
3. **Release gate breaks the existing fixtures** (pgTAP and e2e). Mitigation: slices 1 and 2 as one commit.
4. **Expected messages in direct status writes.** Admin line 45 keeps its 42501 expectation. Line 431 needs its test tagged first (slice 2.1), or it asserts the wrong refusal.
5. **NULL elements can pass a CHECK.** Mitigation: the trigger refuses them, and slice 3.2 proves it.
6. **The two-session race is proven only by a manual transcript.** If it is not recorded, the lock argument is unproven. The gate needs the transcript.
7. **The release button is enabled for a missing tag** (an [ASSUMPTION] in 7b.1). If Saurabh flips it, the release dialog's tag fields and the release-time tag write both go.
8. **Client-side filter** stops being right past about 300 tests (arch §3.2). Not a v1 problem; revisit then.
9. **The parity test is only as good as its parser.** Its header records the removal form, which is its own marked block. A new block in a new format fails the test on purpose.
10. **Hosted data has no check.** The migration adds columns with safe defaults, so old released tests stay untagged and visible in the taker list with no filter set (AC 18). Nothing is backfilled.
11. **`database.types.ts` is generated from the local database.** If the hosted migration differs, the types drift. The Dev Lead checks that the local migration equals the hosted one after apply.
12. **Prettier does not check `.sql`**, so the SQL files get no automated format check. The Reviewer reads them.
13. **Rollback leaves release refused for new tests** on a web build without the tag UI (deploy section).

---

## Deferred (named, not built)

- **D-C1** Pre-filter by the student's own year level.
- **D-C2** More than one subject or stream on a test.
- **D-C3** A filter on the admin list.
- **D-C4** VCE subject names as subject choices (general subjects only in v1, per S-2).
- **D-C5** UCAT and GAMSAT as a stream.
- **D-C6** Choosing more than one value in a filter, and remembering filter settings.
- **D-C7** Tags and filters in the mobile app (D-B10).
- **D-C8** Tags on classes or assignments.
- **Part A, for reference:** D-A1 archive or hide view, D-A2 notifying takers before closing, D-A3 an opening date.

Nothing is silently dropped. Each item is named in `01-requirement.md`.

---

## Next steps (ordered by what unblocks the most)

1. Send the Developer slices 1 and 2 as one commit (migration and fixtures), with the gate in that section. Nothing else can be verified without the migration.
2. The Dev Lead runs the two-session check (3.7) after slice 3.
3. Build 6a with slice 4 (parity) and slice 5 (service), on separate worktrees with owned paths.
4. Slices 7a, 7b and 8 in order. Slice 9 last, then the definition of done.
