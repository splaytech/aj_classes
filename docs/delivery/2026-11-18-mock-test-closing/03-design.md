# 03 — Design: mock test categories (ACs 10 to 29)

Stage 3 (Solution Designer), 18 Nov 2026. Branch `feature/mock-test-closing`. Inputs: `01-requirement.md` (rulings S-1, S-2), `02-architecture.md` (round 3: decisions stand), ADR-0012 and Amendment 1, `2026-11-17-mock-tests/03-design.md` (house style), the closing migration `20261119100000_mock_test_closing.sql` and the current mock test web code (read only; the Dev Lead is editing them).

Design only. Nothing here was run. No new dependency, service or cost. Mobile unchanged. Closing (ACs 1 to 9) is not covered here.

## 0. Decisions made in this design (small, reversible)

1. **Filter state is `useState` on the page, not URL search params.** AC 24 says filters reset on a reload; params would survive one. So params are not cheap, they are wrong.
2. **Release dialog carries the tag fields; the Release button is not disabled for missing tags.** It is still disabled for zero questions. [ASSUMPTION, deviates from AC 14's "the same way it does for zero questions"]: a hint under the header names what is missing, the button stays enabled, and the dialog will not submit until all three are set. Reason: the dialog shows the missing fields, so the admin fixes them right there; zero questions needs a different page, so only that case disables. Disabling the button instead would also meet AC 14 (the admin would use Edit details first) and is acceptable if the Dev Lead prefers it: it removes the tag fields from the Release dialog and the `updateMockTestTags` call from the release submit.
3. **A released or closed test gets a separate "Edit tags" button and a tags-only dialog.** AC 15 needs it, and the draft "Edit details" dialog is not available once released (title and instructions are frozen). That dialog saves only the four tag columns.
4. **A tag value removed from a list is shown, disabled, in the select that holds it,** labelled "(no longer offered)" (AC 27).
5. **`mock_test_open` also returns `tags`** (Architect 3.4), shown under the title on the take page, so the column is not dead data.
6. **Field-level DB refusals show as the dialog's own error alert naming the field,** not as inline helper text. The web validates against the same lists first, so a DB refusal means list drift or a stale tab.

## 1. Migration `20261120100000_mock_test_categories.sql`

### 1.1 Name and timestamp (checked 18 Nov 2026)

Newest migration on every local branch (`git for-each-ref refs/heads` plus `git ls-tree` of each) and every worktree (`aj_classes-hiring`, `aj_classes-invites`, `.worktrees/seo`): `20261119100000_mock_test_closing.sql` (this branch); the rest top out at `20261118100000` or earlier. `20261120100000` is later than all. The Developer re-lists before committing. The categories file replaces functions the closing file defines, so it must sort after it, and it does.

### 1.2 Source functions to copy (closing migration, lines as of this design)

The closing migration is final and committed (`9cba1b4`, `e584243`); the line numbers below were re-checked against it. **The Developer re-verifies each range with `grep -n "function public.<name>" supabase/migrations/20261119100000_mock_test_closing.sql | tail -1` and the next `$$;` before copying, and copies from that file.** `mock_release(target uuid, closes timestamptz default null)` is the only version (the one-argument one was dropped; PostgREST can't choose between overloads), so the replacement keeps exactly that signature, and `mock_set_closing(uuid, timestamptz)` and `mock_close_now(uuid)` are not touched.

| Function | Defined at | Through |
|---|---|---|
| `mock_tests_admin_list()` | line 32 (`drop function` at 30) | `$$;` at 67 |
| `mock_release(uuid, timestamptz)` | line 74 (`drop function mock_release(uuid)` at 72) | `$$;` at 106 |
| `mock_tests_for_me()` | line 216 (`drop function` at 214) | `$$;` at 250 |
| `mock_test_open(uuid)` | line 252 (`create or replace`) | `$$;` at 325 |

None of these four is redefined in a later migration (`grep -n "function public.mock_" supabase/migrations/*.sql | tail`). `20261118100000_mock_tests.sql` is not edited. The S-1 clause in `mock_tests_for_me` (`and (t.closes_at is null or t.closes_at > now() or a.submitted_at is not null)`) and the closed check in `mock_test_open` are copied unchanged.

### 1.3 Statement order

1. **Options table**
   ```
   create table private.mock_test_options (
     kind   text not null check (kind in ('subject', 'stream')),
     key    text not null,
     active boolean not null default true,
     primary key (kind, key)
   );
   alter table private.mock_test_options enable row level security;
   revoke all on private.mock_test_options from anon, authenticated;
   ```
   No policy. Same shape as `private.invite_tokens`.
2. **Seed block**, exactly this wrapper (the parity test reads between the markers):
   ```
   -- mock-test-options:begin
   insert into private.mock_test_options (kind, key) values
     ('subject','maths'), ('subject','english'), ('subject','science'), ('subject','reading'),
     ('subject','writing'), ('subject','numerical-reasoning'), ('subject','verbal-reasoning'),
     ('stream','vce'), ('stream','naplan'), ('stream','selective-entry'),
     ('stream','seal-and-scholarships'), ('stream','icas'), ('stream','maths-science-english')
   on conflict (kind, key) do update set active = excluded.active;
   -- mock-test-options:end
   ```
   Seven subjects (`SUBJECTS` minus `interview-preparation`, AC 10), six streams (AC 11). `do update` (not `do nothing`) everywhere, so adding and removing a value are one form. A later removal is its own marked block: `insert into private.mock_test_options (kind, key, active) values ('subject','writing', false) on conflict (kind, key) do update set active = excluded.active;`.
3. **Columns and checks** (all trivially true for existing rows, so they validate instantly):
   ```
   alter table public.mock_tests
     add column subject     text,
     add column stream      text,
     add column year_levels smallint[] not null default '{}',
     add column any_year    boolean   not null default false,
     add constraint mock_tests_year_levels_valid check (
       year_levels <@ '{2,3,4,5,6,7,8,9,10,11,12}'::smallint[]
       and array_ndims(year_levels) = 1 and array_lower(year_levels, 1) = 1),
     add constraint mock_tests_any_year_alone check (not (any_year and cardinality(year_levels) > 0));
   ```
   The year check is the `classes_year_levels_valid` form (ADR-0009); `{}` passes because `array_ndims('{}')` is null, so do not wrap it in `coalesce`. No check ties tags to `status` (Architect 2.6). Column comments for all four.
4. **Guard trigger** `private.check_mock_test_tags()`: `before insert or update on public.mock_tests for each row`, trigger name `mock_tests_check_tags`. **`security definer`, `set search_path = ''`**, execute revoked from `public, anon, authenticated`. Logic, in order. Steps 1 and 4 run only inside `if tg_op = 'UPDATE' then … end if;`, with step 4 a nested `if` on `current_row.status`, never an `and` with `tg_op`: on INSERT `current_row` is never assigned, and reading its fields would raise `record "current_row" is not assigned yet`. pgTAP must insert a tagged row and an untagged row as `authenticated` at aal2 and expect both to succeed.
   1. On UPDATE only, one locked read: `select t.status, t.subject, t.stream, t.year_levels, t.any_year into current_row from public.mock_tests t where t.id = old.id for no key update;` (`old.id`, because a superuser may rename the id; `current_row`, because `current` is a keyword). The BEFORE trigger runs before the UPDATE takes its row lock and asks for the same `for no key update` lock the UPDATE then takes, so it cannot wait on itself. After a lock wait it returns the committed row. The clear-refusal below judges on `current_row`, never on `old`.
   2. If `new.subject is not null` and (INSERT, or on UPDATE `new.subject is distinct from current_row.subject`) and no row `(kind='subject', key=new.subject, active)` exists: `raise exception using errcode = 'check_violation', message = 'invalid_mock_tag', hint = 'subject'`. Same for `stream` with `hint = 'stream'`.
   3. Years, each refusal `invalid_mock_tag` with `hint = 'year_levels'`, checked in this order: `array_ndims(new.year_levels) > 1` or (non-empty and `array_lower(new.year_levels, 1) is distinct from 1`); any NULL element (`exists (select 1 from unnest(new.year_levels) y where y is null)`); not strictly ascending (`new.year_levels is distinct from coalesce((select array_agg(distinct y order by y) from unnest(new.year_levels) y), '{}')`); any value outside 2 to 12; non-empty while `new.any_year`. BEFORE triggers run before CHECK constraints, so every years refusal arrives as `invalid_mock_tag`, not a bare 23514; the table checks stay as the backstop.
   4. On UPDATE only (inside the same block): if `current_row.status = 'released'` and a tag that is set in `current_row` becomes unset in `new` (`current_row.subject is not null and new.subject is null`, same for stream, or the years predicate true on `current_row` and false on `new`): `raise exception using errcode = 'check_violation', message = 'mock_tag_kept', hint = <subject | stream | year_levels>`. This is a different message from the invalid-value one so the page can say the right thing. A legacy untagged released test can be tagged one field at a time, and a set tag can change to another valid value.
5. **Release trigger** `private.check_mock_test_release_tags()`, trigger `mock_tests_release_needs_tags`: `before update on public.mock_tests for each row when (old.status = 'draft' and new.status = 'released')`. Also security definer, `search_path ''`, execute revoked. On that transition only it reads the current tags: `select t.subject, t.stream, t.year_levels, t.any_year into current_tags from public.mock_tests t where t.id = old.id for no key update;` and raises `mock_tags_missing` unless `current_tags.subject is not null and current_tags.stream is not null and (current_tags.any_year or cardinality(current_tags.year_levels) > 0)`. It judges on that read, never on `new`, so a direct `update ... set status = 'released'` racing a tag clear cannot release an untagged test. Same predicate as the gate, written the same way.
6. **Grants:** `grant insert (subject, stream, year_levels, any_year), update (subject, stream, year_levels, any_year) on public.mock_tests to authenticated;` `status`, `released_*` and `closes_at` stay ungranted. The existing admin-only policies and the freeze trigger `private.check_mock_test` are unchanged (it freezes title, instructions and delete only).
7. **Four function replacements** (bodies from 1.2):
   1. `mock_tests_admin_list()`: `drop function` then `create function`. Return columns: the closing list's ten (`id, title, status, question_count, submitted_count, created_by_name, created_at, updated_at, released_at, closes_at`) **plus** `subject text, stream text, year_levels smallint[], any_year boolean`. Select list gains `t.subject, t.stream, t.year_levels, t.any_year`.
   2. `mock_release(target uuid, closes timestamptz default null)`: `create or replace`, same signature. The locked select becomes `select t.status, t.subject, t.stream, t.year_levels, t.any_year into test from public.mock_tests t where t.id = target for update;` (a `record` variable replaces `test_status`). After the `mock_no_questions` and `mock_closes_in_past` checks and before the update: `if not (test.subject is not null and test.stream is not null and (test.any_year or cardinality(test.year_levels) > 0)) then raise exception 'mock_tags_missing'`. The `if test.status <> 'draft'` check keeps its position and message. The update statement is unchanged.
   3. `mock_tests_for_me()`: `drop function` then `create function`. Return columns: the closing list's nine (`id, title, question_count, status, score, total, submitted_at, released_at, closes_at`) plus the same four tag columns. Same `where` and `order by`.
   4. `mock_test_open(target uuid)`: `create or replace`. The first select also reads `t.subject, t.stream, t.year_levels, t.any_year`; the returned jsonb gains `'tags', jsonb_build_object('subject', test.subject, 'stream', test.stream, 'year_levels', to_jsonb(test.year_levels), 'any_year', test.any_year)`.
8. **Grants repeated** for the four functions, same form as the closing file: `revoke execute ... from public, anon, authenticated;` then `grant execute ... to authenticated;` for `mock_tests_admin_list()`, `mock_release(uuid, timestamptz)`, `mock_tests_for_me()`, `mock_test_open(uuid)`.

### 1.4 Existing pgTAP files break and must be fixed in the same change

The new release gate and trigger refuse untagged drafts, so these existing fixtures change in the same commit (line numbers as of this design; the Developer re-greps):
1. `mock_tests_admin.test.sql` line 25: the admin's insert becomes `insert into public.mock_tests (title, instructions, subject, stream, any_year) values (..., 'maths', 'naplan', true)`. It runs as `authenticated` at aal2, so it also proves the new column grant.
2. `mock_tests_admin.test.sql` line 29: the superuser `update ... set id = ...` rename stays. It needs the guard to read by `old.id` (1.3.4.1); with `new.id` the read finds nothing.
3. `mock_tests_admin.test.sql` lines 449 to 452: the `mock_tests_admin_list` key pin gains four keys and becomes 14: `any_year, closes_at, created_at, created_by_name, id, question_count, released_at, status, stream, subject, submitted_count, title, updated_at, year_levels`.
4. `mock_tests_taker.test.sql` lines 44 to 54: the fixture inserts T1, T2 and T3 with tags (`'maths', 'naplan', true`) before its direct `update ... set status = 'released'` on T1 and T3, which the release trigger would otherwise refuse.
5. `mock_tests_closing.test.sql` insert at lines 22 to 23 (T1, T2, T9): add the same tags. That makes the `mock_release` calls at lines 105 and 410 (and every other release of T1 and T2) succeed. Take-back keeps tags (AC 17), so the release at 410 after a take-back needs no more.
6. The two new assertions, which go in `mock_tests_categories.test.sql` (not edited into the old files): `mock_release` on an untagged draft raises `mock_tags_missing`, and an admin at aal2 can insert and update the four tag columns.

## 2. Service changes (`apps/web/src/services`)

### 2.1 Types (`types.ts`)

```
export type MockTags = {
  subject: string | null;     // a SUBJECTS key; any string is held as stored (AC 27)
  stream: string | null;      // a programme slug
  yearLevels: number[];       // ascending
  anyYear: boolean;
};
```
- `MockTestInput` gains `tags: MockTags`.
- `MockTestSummary`, `MockTestDraftView`, `MockTestListItem`, `MockTestView` each gain `tags: MockTags`.
- `MockTestListItem` also needs nothing else; `released_at` stays unmapped as today.

### 2.2 Mappers and rows (`mock-tests-data.ts`)

- `MockSummaryRow` and `MockListRow` gain `subject: string | null; stream: string | null; year_levels: number[]; any_year: boolean`. `MockOpenJson` gains `tags: { subject, stream, year_levels, any_year }`.
- One exported `toMockTags(row: { subject; stream; year_levels; any_year }): MockTags`, used by all four mappers (`toMockTestSummary`, `toMockTestListItem`, `toMockTestView`) and by `getMockTestForEdit`.
- One exported `toMockTagColumns(tags: MockTags)` returning `{ subject, stream, year_levels: [...tags.yearLevels].sort((a, b) => a - b), any_year }`. It sorts because the guard requires ascending order.

### 2.3 Functions (`mock-tests.service.ts`)

- `getMockTestForEdit`: the `select` string becomes `'id, title, instructions, status, closes_at, subject, stream, year_levels, any_year'`; the result gains `tags: toMockTags(test.data)`.
- `createMockTest(input)`: the insert adds `...toMockTagColumns(input.tags)`.
- `updateMockTest(testId, input)` (draft Edit details): the update adds the same columns.
- **New** `updateMockTestTags(testId: string, tags: MockTags): Promise<Result>`: `update({...toMockTagColumns(tags)}).eq('id', testId).select('id').maybeSingle()`, `data ? succeed() : fail('notAllowed')`. Sends no title or instructions, so a released test's freeze is never in play.
- `releaseMockTest`, `listMyMockTests`, `getMyMockTest`, `listMockTestsAdmin`: unchanged code; the mappers carry the tags.
- Export `updateMockTestTags` and `MockTags` from `services/index.ts`. Regenerate `database.types.ts` (local database only; the Dev Lead owns the stack).

### 2.4 Error mapping (`auth-errors.ts`)

- `SupabaseLikeError` gains `hint?: string`.
- `ERROR_KEYS_BY_OWN_KEY` gains `mock_tags_missing: 'mockTagsMissing'`.
- `invalid_mock_tag` arrives as code 23514 with the field in `hint`. In `toErrorKey`, before the own-key lookup: if `details.message === 'invalid_mock_tag'`, return `MOCK_TAG_ERROR_KEYS[details.hint ?? ''] ?? 'invalidInput'`, with `MOCK_TAG_ERROR_KEYS = { subject: 'mockTagSubject', stream: 'mockTagStream', year_levels: 'mockTagYears' }` (a small const in the same file). Any other 23514 keeps its `invalidInput` mapping.
- `mock_tag_kept` (23514, field in `hint`) maps to `mockTagKept`, one text for all three fields: `MOCK_VALIDATION.tagKeep`. It is checked in the same place as `invalid_mock_tag`, before the generic 23514 mapping.
- New `ErrorKey`s and texts in `error.constants.ts` (strings in 3.3). `auth-errors.test.ts` gains the cases: three `invalid_mock_tag` hints, an unknown hint, `mock_tag_kept`, `mock_tags_missing`.

## 3. Constants

### 3.1 Options source (`constants/mock-tests.constants.ts`)

- `MOCK_TEST_SUBJECTS`: `SUBJECTS.filter((subject) => !MOCK_TEST_EXCLUDED_SUBJECT_KEYS.includes(subject.key))`, with `MOCK_TEST_EXCLUDED_SUBJECT_KEYS = ['interview-preparation'] as const` (AC 10). Entries are `{ key, label }`.
- `MOCK_TEST_STREAM_SLUGS = [PROGRAMME_SLUGS.vce, naplan, selectiveEntry, sealAndScholarships, icas, mathsScienceEnglish]` in the AC 11 order; `MOCK_TEST_STREAMS = MOCK_TEST_STREAM_SLUGS.map((slug) => ({ key: slug, label: <menuLabel of PROGRAMMES.items where slug matches> }))`. A slug with no programme is a build-time impossibility; the parity test covers it.
- Years: `YEAR_LEVELS` and `YEAR_LEVEL_TEXT` from existing files. No new year list.
- `MOCK_TAG_ANY = 'any'`: the select value of the Any year item (never stored).

### 3.2 New strings

In `mock-tests.constants.ts` (all other labels reuse existing constants):

```
MOCK_TAGS = {
  subjectLabel: CLASS_DIALOG.labels.subject,       // AC 19: same labels as the class dialog
  yearLevelLabel: CLASS_DIALOG.labels.yearLevel,
  streamLabel: 'Stream',
  notSet: 'Not set',
  noLongerOffered: (label: string) => `${label} (no longer offered)`,
  yearHint: 'Choose one or more years, or Any year.',
  line: (label: string, text: string) => `${label}: ${text}`,
  tagsHeading: 'Tags',
  editTags: 'Edit tags',
  editTagsTitle: 'Edit tags',
  tagsSaved: 'Tags saved.',
  fieldNames: { subject: 'subject', stream: 'stream', yearLevels: 'year level' },
  listSeparator: ', ',
  listAnd: ' and ',
  releaseNeedsTags: (names: string) => `Set the ${names} to release this mock test.`,
  releaseTagsText: 'Takers filter mock tests by these, so set them before releasing.',
}
MOCK_TEST_FILTERS = {
  groupLabel: 'Filter mock tests',
  all: 'All',
  noMatch: 'No mock tests match these filters.',
  clear: 'Clear filters',
}
```
`MOCK_TESTS_ADMIN_PAGE.columns` gains `tags: 'Tags'`. `MOCK_TEST_DIALOG` is unchanged (tag labels come from `MOCK_TAGS`). `MOCK_VALIDATION` gains `tagSubject: 'Please choose a subject.'`, `tagStream: 'Please choose a stream.'`, `tagYears: 'Please choose one or more years, or Any year.'`, `tagKeep: 'A tag that is set can’t be cleared on a released mock test. Choose another value.'`. `mockTagKept: MOCK_VALIDATION.tagKeep` in `error.constants.ts`. Empty list text reuses `MOCK_TESTS_LIST.empty`.

### 3.3 Error texts (`error.constants.ts`)

`mockTagsMissing: 'Set the subject, stream and year level before releasing.'` (the same sentence the hint builds from `fieldNames`), `mockTagSubject: 'That subject isn’t on the list. Please choose another.'`, `mockTagStream: 'That stream isn’t on the list. Please choose another.'`, `mockTagYears: MOCK_VALIDATION.tagYears`. The "missing" hint is built by `mockTagNamesText(fields)` in `lib/mock-tests.ts`: the `fieldNames` of the missing fields, lower case, joined with `listSeparator` and a last `listAnd` ("subject, stream and year level", "subject and year level", "stream"), so the page reads "Set the subject, stream and year level to release this mock test."

## 4. Pure helpers (`lib/mock-tests.ts`, with tests)

Types: `MockTagField = 'subject' | 'stream' | 'yearLevels'`; `MockTagErrors = Partial<Record<MockTagField, string>>`; `MockFilters = { stream: string; subject: string; year: number | null }` (`''` and `null` mean All); `NO_MOCK_FILTERS`; `EMPTY_MOCK_TAGS = { subject: null, stream: null, yearLevels: [], anyYear: false }`.

| Function | Rule |
|---|---|
| `mockYearsSet(tags)` | `tags.anyYear \|\| tags.yearLevels.length > 0`. The DB predicate, written the same way |
| `missingMockTagFields(tags): MockTagField[]` | fields not set |
| `setMockTagFields(tags)` | fields that are set (the released dialog uses these as required) |
| `mockTagErrors(tags, required: MockTagField[])` | an error text per required field that is not set; the released dialog passes the already-set fields and gets `tagKeep`, the release dialog passes all three and gets the field message |
| `applyYearPick(tags, picked: (number \| typeof MOCK_TAG_ANY)[])` | AC 12, see below |
| `mockSubjectText(key)` | null: `notSet`; else `subjectLabel(key)` from `lib/labels` (the full `SUBJECTS` list, so a removed subject keeps its label; unknown key shows as stored, AC 27) |
| `mockStreamText(slug)` | null: `notSet`; else `findProgramme(slug)?.menuLabel ?? slug` (`findProgramme` is exported from `programmes.constants.ts`) (the full programme list, so a removed stream keeps its label) |
| `mockYearText(tags)` | `anyYear`: `YEAR_LEVEL_TEXT.any`; years: `classYearLabel(years)`; else `notSet`. (`classYearLabel([])` returns "Any year", so the empty case is handled before calling it) |
| `mockTagNamesText(fields)` | the lower-case field names joined "a, b and c" (3.3) |
| `filterMockTests(items, filters)` | AC 20, 21, see below |

**`applyYearPick`** (the select reports the whole new selection; the previous `tags` tells which click it was):
1. picked has Any and `tags.anyYear` was false: `{ anyYear: true, yearLevels: [] }` (chose Any year: years clear).
2. else picked has at least one number: `{ anyYear: false, yearLevels: those numbers, ascending }` (chose a year: Any year clears).
3. else: `{ anyYear: picked has Any, yearLevels: [] }` (Any year clicked off gives nothing set).

**`filterMockTests`**: a test passes when each set filter matches: `stream === '' ||  item.tags.stream === stream`; `subject` likewise; `year === null || item.tags.anyYear || item.tags.yearLevels.includes(year)`. An untagged test fails every set filter and passes all-All (AC 18). Closed-but-submitted items are filtered like any other (AC 20). Generic over `{ tags: MockTags }`.

## 5. Components (`components/portal/`)

All text from constants; no inline styles other than the existing `sx` usage; MUI `TextField select`, as `ClassDialog` does.

1. **`MockTagFields`** (new). Props: `value: MockTags`, `errors: MockTagErrors`, `canClear: boolean`, `disabled`, `onChange(tags: MockTags)`. Renders, in a `Stack`:
   1. **Subject**: `TextField select` labelled `MOCK_TAGS.subjectLabel`. Items: when `canClear` a first item with value `''` labelled `notSet`; when not `canClear` and the value is null, that same item is rendered `disabled` so the select shows "Not set" instead of a blank (a legacy untagged released test); then `MOCK_TEST_SUBJECTS`. Every `MenuItem` has `key={x.key}`. If the held key is not in the current list, one extra disabled item for it, labelled `noLongerOffered(mockSubjectText(key))`, so the select can show it (AC 27).
   2. **Stream**: same, `MOCK_TAGS.streamLabel`, `MOCK_TEST_STREAMS`, label via `mockStreamText`.
   3. **Year level**: `TextField select` with `slotProps.select.multiple`, as in `ClassDialog` (Checkbox plus `ListItemText` per item). First item: Any year (`value = MOCK_TAG_ANY`, text `YEAR_LEVEL_TEXT.any`); then `YEAR_LEVELS` with `YEAR_LEVEL_TEXT.label(year)`. `value` = `[MOCK_TAG_ANY]` when `anyYear`, else the years. `onChange` passes the new array to `applyYearPick`. `renderValue: () => mockYearText(value)` (the select hands it the raw array, which would print `any` or bare numbers); `helperText` = the error or `yearHint`. This is where AC 12 lives: choosing Any year clears the years and choosing a year clears Any year.
   Errors show as `error` and `helperText` on the matching field. Keyboard and labels come free from MUI selects with visible labels (AC 26).
2. **`MockTestDialog`** (changed). State gains `tags` (from `existing.tags` or `EMPTY_MOCK_TAGS`); renders `MockTagFields` (`canClear` true) below instructions; the input passed to `createMockTest` and `updateMockTest` includes `tags`. Validation: `validateMockTest` changes only its parameter type, to `Pick<MockTestInput, 'title' | 'instructions'>`, so the dialog still passes just those two (a draft may save with no tags, AC 13). The `existing` prop type gains `tags`. Used for New and for Edit on a draft (AC 13, 15).
3. **`MockReleaseDialog`** (changed, in `MockClosingDialogs.tsx`). New prop `tags: MockTags` (the saved ones). Shows `releaseTagsText`, then `MockTagFields` (`canClear` false), then the existing closing field. Submit: `mockTagErrors(tags, ['subject','stream','yearLevels'])`; if any, show them and stop; then inside the one `action.run`: if the tags differ from the saved ones call `updateMockTestTags` first and return its failure if it fails, then `releaseMockTest`. If release fails after the tags saved, the tags stay saved and the error alert says why. (`MockClosingDialog` is untouched.)
4. **`MockTagsDialog`** (new, tiny). For released and closed tests (AC 15). `FormDialog` titled `editTagsTitle`; `MockTagFields` (`canClear` false); required fields = `setMockTagFields(saved)` through `mockTagErrors`, so a set tag can't be cleared in the UI and an unset legacy tag can be left alone; submit calls `updateMockTestTags`; `onSaved`. On the edit page focus returns to the Edit tags button after the save (the button stays on the page, like Set closing date).
5. **`MockTagLine`** (new). Props `tags`, `stacked?: boolean`. Renders three `Typography variant="body2" color="textSecondary"` items `MOCK_TAGS.line(label, text)` using the three text helpers, so a missing tag reads "Subject: Not set". Wrapped row (`Stack direction="row" useFlexGap flexWrap`, `spacing={2}`) by default, a column when `stacked`. Used by the taker row (AC 23), the admin list (AC 28), the admin edit page and the take page. Never used on a public page, sitemap or e-mail (AC 29): the component lives under `portal/` and is only imported by portal routes.
6. **`MockTestFilters`** (new). Props `value: MockFilters`, `onChange`. A `Stack component="section" aria-label={MOCK_TEST_FILTERS.groupLabel}`, `direction={{ xs: 'column', sm: 'row' }}`, three `TextField select` with labels `streamLabel`, `subjectLabel`, `yearLevelLabel`. Each has `All` first (value `''`, label `MOCK_TEST_FILTERS.all`). Stream and Subject offer `MOCK_TEST_STREAMS` and `MOCK_TEST_SUBJECTS`; Year level offers `YEAR_LEVELS` only (no Any year, AC 19). Offers current values only (AC 27).
7. Export `MockTagFields`, `MockTagsDialog`, `MockTagLine`, `MockTestFilters` from `components/portal/index.ts`.

### 5.1 Page changes

- **`routes/portal/mock-tests.tsx`** (taker list). `const [filters, setFilters] = useState(NO_MOCK_FILTERS)`; `const visible = filterMockTests(loaded.data, filters)`. Three states:
  1. `loaded.data.length === 0`: `MOCK_TESTS_LIST.empty`, no filter bar (AC 22a).
  2. Otherwise: `MockTestFilters`, then the rows for `visible`. Each row gets `<MockTagLine tags={item.tags} />` under the question count (AC 23).
  3. `visible.length === 0` (so a filter is set): `MOCK_TEST_FILTERS.noMatch` and a `Button` `MOCK_TEST_FILTERS.clear` that sets `NO_MOCK_FILTERS` (AC 22b). Plain text, no error styling.
  Hooks stay above the early `LoadError` return as they are today (`useState` must not sit after the conditional return; place it before it).
- **`routes/portal/admin-mock-tests.tsx`**. A `Tags` column (`columns.tags`) with `<MockTagLine tags={test.tags} stacked />` (AC 28). No filter (D-C3).
- **`routes/portal/admin-mock-test.tsx`**. `Confirming` gains `'tags'`. New `SectionCard` titled `MOCK_TAGS.tagsHeading` with `MockTagLine` (placed before Instructions). Draft: nothing extra (tags edit in Edit details). Released or closed: an `Edit tags` button in the released action group opening `MockTagsDialog`; on save, `action.announce(MOCK_TAGS.tagsSaved)` and `reload()`. Draft with missing tags: under the header, next to the existing "needs questions" hint, `MOCK_TAGS.releaseNeedsTags(missing)` where the names are `mockTagNamesText(missingMockTagFields(test.tags))`. `MockReleaseDialog` receives `tags={test.tags}`. `MockTestDialog` receives the test with its tags.
- **`routes/portal/mock-test.tsx`** (take page). `MockTagLine` under the title, from `MockTestView.tags`. Placement is the Developer's, where the title shows.

## 6. Files to touch

| File | New / changed |
|---|---|
| `supabase/migrations/20261120100000_mock_test_categories.sql` | new |
| `supabase/tests/database/mock_tests_categories.test.sql` | new |
| `supabase/tests/database/mock_tests_admin.test.sql`, `mock_tests_taker.test.sql`, `mock_tests_closing.test.sql` | changed (tag the fixtures, 1.4) |
| `apps/web/src/services/types.ts`, `mock-tests-data.ts`, `mock-tests.service.ts`, `index.ts`, `auth-errors.ts` | changed |
| `apps/web/src/services/database.types.ts` | regenerated (local DB) |
| `apps/web/src/services/mock-tests.service.test.ts`, `auth-errors.test.ts` | changed |
| `apps/web/src/constants/mock-tests.constants.ts`, `error.constants.ts` | changed |
| `apps/web/src/lib/mock-tests.ts`, `lib/mock-tests.test.ts` | changed |
| `apps/web/src/lib/mock-test-options.parity.test.ts` | new |
| `apps/web/src/components/portal/MockTagFields.tsx`, `MockTagsDialog.tsx`, `MockTagLine.tsx`, `MockTestFilters.tsx` + a `*.test.tsx` each | new |
| `apps/web/src/components/portal/MockTestDialog.test.tsx` | new (AC 13: saves with no tags, sends tags when set, offers Not set) |
| `apps/web/src/components/portal/MockTestDialog.tsx`, `MockClosingDialogs.tsx` (+ `MockClosingDialogs.test.tsx`), `index.ts` | changed |
| `apps/web/src/routes/portal/mock-tests.tsx`, `admin-mock-tests.tsx`, `admin-mock-test.tsx`, `mock-test.tsx` (+ their tests) | changed |
| `e2e/tests/mock-tests.spec.ts`, `mock-tests.selectors.ts` | changed (tag before release; filter case) |
| `docs/decisions/0012-…md` | Architect's, Amendment 1 already written |

Build note: stage explicit paths only (`git add <file>`, never `git add <dir>` or `-A`), and run `git status --short` before and `git show --stat HEAD` after each commit; the tree holds other people's untracked files.

Not touched: `20261118100000_mock_tests.sql` and the closing migration, public pages, sitemap, e-mail, mobile, edge functions, `SUBJECTS` and `PROGRAMMES` themselves.

## 7. Test approach per AC (10 to 29)

**P** = pgTAP (`mock_tests_categories.test.sql`, every write as `authenticated` at aal2 via `tests.authenticate_as(..., 'aal2')` then `set local role authenticated`, never superuser). **V** = vitest, co-located. **E** = Playwright. **M** = manual in the real browser by the Tester (375 px and 1280 px, light and dark).

| AC | Layer | Proof |
|---|---|---|
| 10 | P, V | P: active `subject` option keys equal a literal list of seven, no `interview-preparation`. V: `MOCK_TEST_SUBJECTS` labels and exclusion; the parity test (below) |
| 11 | P, V | P: six stream keys equal a literal list. V: `MOCK_TEST_STREAMS` labels are the programme `menuLabel`s, keys are the six slugs, none of `interviews`, `vce-subject-selection`, `ucat-and-gamsat`. Parity test |
| 12 | V, E | V: `applyYearPick` all three branches; `MockTagFields` test clicks Any year then Year 5 then Any year (years clear, Any year clears, nothing set). E: the same in the New dialog. P: `any_year` with years refused |
| 13 | P, V, E | P: draft insert and update with no tags accepted, with every valid value accepted. V: `MockTestDialog` saves with no tags; sends tags when set. E: create tagged, edit, clear on a draft |
| 14 | P, V, E | P: `mock_release` raises `mock_tags_missing` for each missing tag separately, accepted with Any year; a direct `update ... set status = 'released'` on an untagged draft is refused by `mock_tests_release_needs_tags` (as `authenticated` at aal2 the status column is ungranted, so this one runs as the table owner to reach the trigger), and accepted on a tagged draft. V: `missingMockTagFields`, release dialog blocks submit and names fields, page hint lists what is missing. E: release is refused until tagged |
| 15 | P, V, E | P: on a released and a closed test a missing tag can be set one field at a time, a tag can change to another valid value, a set tag can't be cleared (each of subject, stream, years, and Any year to nothing), each refusal raising `mock_tag_kept` with the field in `hint`, title and instructions stay frozen, `mock_released` still raised for them, attempts, answers and `closes_at` untouched by a tag edit. V: `MockTagsDialog` requires set fields, offers no clear item (a null value shows a disabled Not set item), and after a save focus is back on the Edit tags button. E: edit tags on a released test |
| 16 | P, V | P: unknown subject, unknown stream, year 1, year 13, duplicate years, descending years, years with Any year: each refused with message `invalid_mock_tag` and the right `hint`, row unchanged. P also: NULL element (`array[null]::smallint[]`), non-1-based (`'[0:0]={7}'`) and two-dimensional (`'{{7,8}}'`) years all refused with `invalid_mock_tag` and `hint = 'year_levels'`. V: `toErrorKey` maps each `invalid_mock_tag` hint, an unknown hint (`invalidInput`) and `mock_tag_kept` (`mockTagKept`, text `tagKeep`) |
| 17 | P | Take back keeps the four tag columns; `mock_set_closing`, `mock_close_now` and reopen leave them unchanged |
| 18 | P, V, M | P: a released row with null tags (inserted as superuser fixture) is listed by `mock_tests_for_me` and `mock_tests_admin_list` with null/empty/false tags. V: `filterMockTests` leaves it in with all-All and out with any filter. M: "Not set" shows on both lists |
| 19 | V, E | Labels Stream, Subject, Year level; Year level offers Years 2 to 12 only, All first |
| 20 | V | `filterMockTests`: AND of three; year matches `anyYear` tests and exact years; closed-but-submitted item filtered like the rest; test table of combinations |
| 21 | V, E | All-All returns every item including untagged and closed-submitted |
| 22 | V, E | V: page with no items shows `MOCK_TESTS_LIST.empty` and no filter bar; page with items and an empty result shows `noMatch` and Clear, and Clear restores the list; no raw error text. E: both states |
| 23 | V, M | Row shows `Subject: Maths`, `Stream: NAPLAN`, `Year level: Any year`; missing shows `Not set` |
| 24 | V | Filters are state: a remount returns to All; no search param is written (`location.search` unchanged) |
| 25 | P, V | P: `mock_tests_for_me` result is the same set whatever the tags (S-1 visibility clause still holds after this migration: `mock_tests_closing.test.sql` re-run last). V: filtering never calls the service |
| 26 | V, M | V: labels exist (`getByLabelText`) and the selects are operable by keyboard. M (tester-ui): 375 px and 1280 px, light and dark, keyboard walk through New dialog and filter bar |
| 27 | P, V, M | P: a subject made inactive (a one-row `insert ... on conflict (kind, key) do update set active = excluded.active` with `false` in the test) stays on its row, an unrelated update of that row passes, setting it on another test is refused. V: held removed value shows its saved label, or its key with no label, `noLongerOffered` item is disabled, filters offer current values only. M: view and edit such a test |
| 28 | V, M | Admin list column and edit page card render the tags and `Not set`; no filter control on the admin list |
| 29 | V | Grep test: the tag components and `MOCK_TAGS` are imported only under `routes/portal` and `components/portal`; `sitemap` and e-mail template sources do not reference them |

**Parity test (`mock-test-options.parity.test.ts`).** Resolves `supabase/migrations` the way `portal-validation.test.ts` resolves `supabase/config.toml`. Reads every migration in filename order, extracts each `-- mock-test-options:begin` to `:end` block, parses the `('kind','key')` pairs, and replays them with last write winning per `(kind, key)`. A later removal block with `active = false` switches a key off (every block uses `on conflict (kind, key) do update set active = excluded.active`; the parser reads tuples of two elements, `('kind','key')` with active true, and of three, `('kind','key', false)`). Asserts: active subject keys equal `MOCK_TEST_SUBJECTS` keys and active stream keys equal `MOCK_TEST_STREAMS` keys (order-insensitive); every stream key is a value of `PROGRAMME_SLUGS`; every subject key is in `SUBJECTS`; the migration's year range equals `YEAR_LEVELS` (read from the `mock_tests_year_levels_valid` literal).

**Two-session check (Dev Lead runs; local psql, two sessions as an admin at aal2 on one fully tagged draft test).** Also run the mirror with a legacy released test.
1. Order A: session 1 begins and calls `mock_release`; session 2 starts an update clearing `subject` and blocks; session 1 commits; session 2 must then fail (clear refused on a now-released test, judged on the status read `for no key update`, not on the stale old row).
2. Order B: session 1 begins and clears `subject` on the draft; session 2 calls `mock_release` and blocks; session 1 commits; session 2 must fail with `mock_tags_missing`.
3. Order C (direct writer): session 1 begins and clears `subject` on a tagged draft; session 2, as the table owner, runs `update public.mock_tests set status = 'released', released_at = now() where id = ...` and blocks; session 1 commits; session 2 must fail with `mock_tags_missing` (the trigger judges on its own locked read of the committed tags, not on `new`). Mirror: session 2 first, session 1's clear then fails as a clear on a released test.
4. Neither order may leave a released test without a tag. Paste the raw psql output into the test report. The DB is the only thing in play here; no web is needed.

**Gate commands:** the repo's full check (format, lint, typecheck, vitest, build), the full pgTAP run (all mock files after this migration, in particular `mock_tests_closing.test.sql`), and e2e on the local stack.
