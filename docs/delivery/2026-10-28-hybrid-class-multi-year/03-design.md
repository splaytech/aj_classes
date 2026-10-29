# 03 — Solution design: hybrid classes and multiple year levels

Stage 3 of `/deliver`, Solution Designer. Branch `feature/hybrid-class-multi-year`. Date 2026-10-28.
Inputs: [01-requirement.md](01-requirement.md) (with Amendments), [review-1.md](review-1.md),
[02-architecture.md](02-architecture.md), [review-2.md](review-2.md) (findings 1–5 folded in below,
marked **R2-n**; review-3 round 1 findings marked **R3-n**), [ADR-0009](../../decisions/0009-class-year-levels-array-with-compat-column.md).

All paths are relative to the repo root. Line anchors were read on this branch on 2026-10-28; the
Developer re-checks each before editing. No new dependency, no new service, no env var, no RPC,
no RLS change. No existing function body is copied, so there are no copy ranges to cite.

## 1. Components

| # | Component | Responsibility |
|---|---|---|
| 1 | Migration `supabase/migrations/20261028100000_classes_hybrid_multi_year.sql` (new) | `year_levels` array, generated `year_level`, order guard, `hybrid` in the delivery check, grants |
| 2 | pgTAP `supabase/tests/database/classes_years_delivery.test.sql` (new) | DB rules for AC 8, 15, 17 and the compat column |
| 3 | `supabase/seed.sql` (edit) | Seed writes `year_levels`; one demo class becomes hybrid and multi-year |
| 4 | `apps/web/src/services/database.types.ts` (regenerated) | `pnpm db:types` |
| 5 | `services/types.ts`, `services/classes.service.ts` (edit) | `Delivery` gains `hybrid`; `yearLevels: number[]`; read and write `year_levels` |
| 6 | `constants/portal.constants.ts` (edit) | `DELIVERIES`, `DELIVERY_LABELS.hybrid`, year-label copy, hints |
| 7 | `lib/labels.ts` (edit) + `lib/labels.test.ts` (new) | `classYearLabel(years)` with the AC 13 rules |
| 8 | `components/portal/ClassDialog.tsx` (edit) + `ClassDialog.test.tsx` (new) | Multi-select Year level; three deliveries |
| 9 | `routes/portal/classes.tsx`, `routes/portal/class-detail.tsx` (edit) | Pass `yearLevels` to the label |
| 10 | `WeekTimetable.tsx`, family services | **No change.** `hybrid` flows through `deliveryLabel` and the `Delivery` type |

## 2. Migration: `supabase/migrations/20261028100000_classes_hybrid_multi_year.sql`

House style (see `20261026100000_staff_phone_edit.sql`): header comment naming the source docs,
numbered `-- ----` sections, no `begin;`/`commit;` (the Supabase CLI wraps each file in a
transaction; no existing migration has its own). Steps **in this order** (R2-3):

**Header comment:** "Hybrid delivery and several year levels per class (docs/delivery/2026-10-28-
hybrid-class-multi-year, ADR-0009). `year_levels` is the only writable year field; `year_level`
is a read-only compat column for the shipped mobile build (`tutor_repo.dart:21`)."

1. **Add the array with its shape check.**
   ```sql
   alter table public.classes
     add column year_levels smallint[] not null default '{}',
     add constraint classes_year_levels_valid check (
       year_levels <@ '{2,3,4,5,6,7,8,9,10,11,12}'::smallint[]
       and array_ndims(year_levels) = 1
       and array_lower(year_levels, 1) = 1
     );
   ```
   Why each part (comment in the file, one line each): `<@` limits values to 2–12 and also rejects
   NULL elements; `array_ndims` rejects `{{7,8}}`; `array_lower = 1` rejects `[0:0]={7}`, which would
   otherwise give a null `year_level` (R2-2). For `'{}'` both functions return NULL, so the check
   passes: **do not wrap them in `coalesce`** (R2-2).

2. **Backfill, keeping `updated_at`.**
   ```sql
   alter table public.classes disable trigger classes_set_updated_at;
   update public.classes
     set year_levels = case when year_level is null then '{}' else array[year_level] end;
   alter table public.classes enable trigger classes_set_updated_at;
   ```
   Trigger name from `20261007061232_classes_timetable_assignments.sql:163-165`.

3. **Drop the old column.** `alter table public.classes drop column year_level;` This also drops
   the auto-named `classes_year_level_check` and the column's insert/update grants (`:301-302`).

4. **Re-add `year_level` as generated.**
   ```sql
   alter table public.classes
     add column year_level smallint
       generated always as (case when cardinality(year_levels) = 1 then year_levels[1] end) stored;
   ```
   Readable through the table-level `select` grant (`:293`). Grant nothing to write it.
   **Stale web tabs (R3-1):** a tab opened before the deploy still sends `year_level`. Postgres
   rejects a non-DEFAULT write to a generated column at query rewrite with **428C9**, before any
   grant check. That code is unmapped, so `toErrorKey` returns `unknown` and the dialog shows the
   generic `Something went wrong. Please try again.` Nothing is written; a reload fixes it. No
   mapping is added for a one-off post-deploy case.

5. **Grants.** `grant insert (year_levels), update (year_levels) on public.classes to authenticated;`
   (RLS "Admins add/change classes" still limits rows to admins with aal2.)

6. **Order guard, after the backfill (R2-3), with revoke (R2-1).**
   ```sql
   -- Rejects repeats and out-of-order years so each set has one stored form (DEC-HM-1).
   -- A trigger, not a CHECK: a CHECK calling a private function needs execute for authenticated.
   create function private.check_class_year_levels()
   returns trigger
   language plpgsql
   set search_path = ''
   as $$
   declare
     year_value smallint;
     previous_value smallint;
   begin
     -- Let NOT NULL report a null array (23502), not foreach (22004) (R3-2).
     if new.year_levels is null then
       return new;
     end if;
     foreach year_value in array new.year_levels loop
       if previous_value is not null and year_value <= previous_value then
         raise exception using errcode = 'check_violation', message = 'invalid_year_levels';
       end if;
       previous_value := year_value;
     end loop;
     return new;
   end;
   $$;

   create trigger classes_check_year_levels
     before insert or update of year_levels on public.classes
     for each row execute function private.check_class_year_levels();

   revoke execute on function private.check_class_year_levels() from public, anon, authenticated;
   ```
   Not `security definer` (it reads only `new`). Errcode `23514` means the existing
   `ERROR_KEYS_BY_DATABASE_CODE['23514'] = 'invalidInput'` mapping (`services/auth-errors.ts:50`)
   handles it, so **no change to `auth-errors.ts`**. The web never hits it (the service sorts and
   de-duplicates), so no new copy.

7. **Delivery check.** The Developer confirms the name first (`\d public.classes` on local; it is
   the auto name from the inline check at `:34`):
   ```sql
   alter table public.classes
     drop constraint classes_delivery_check,
     add constraint classes_delivery_check check (delivery in ('in_person', 'online', 'hybrid'));
   ```

8. **Comments.**
   - `year_levels`: "Year levels the class is for, strictly ascending, 2–12. Empty = Any year."
   - `year_level`: "Read-only compat for mobile builds that select year_level: the year when exactly
     one is set, else null. Drop once mobile reads year_levels (requirement D3)."

## 3. pgTAP: `supabase/tests/database/classes_years_delivery.test.sql` (new)

Follow `classes_rls.test.sql`: `begin; select no_plan(); select tests.remove_all_accounts();
select tests.remove_all_classes();` … `select * from finish(); rollback;`. Accounts:
`tests.create_staff` admin `…a1` (+ `tests.add_verified_factor`), tutor `…b1`. One fixture class
`…c001` for tutor `…b1`, inserted as superuser with `year_levels '{8}'`.

Use a `pg_temp` helper (as `staff_phone.test.sql:22`) only if it reads better; plain statements
are fine. Admin cases run after `tests.authenticate_as('…a1', 'aal2')`, then `reset role`.

| # | Case | Assertion |
|---|---|---|
| 1 | Shape | `col_type_is('public','classes','year_levels','smallint[]')`; `col_not_null`; `col_default_is(..., '{}'::smallint[])` |
| 2 | `year_level` is generated | `is((select is_generated from information_schema.columns where table_schema='public' and table_name='classes' and column_name='year_level'), 'ALWAYS', …)` |
| 3 | Grants | `ok(has_column_privilege('authenticated','public.classes','year_levels','INSERT'))` and `UPDATE`; `ok(not has_column_privilege('authenticated','public.classes','year_level','INSERT'))` and `UPDATE` |
| 4 | Guard not callable | `ok(not has_function_privilege('authenticated','private.check_class_year_levels()','execute'))` |
| 5 | Admin: hybrid accepted (AC 8) | `lives_ok` insert `delivery 'hybrid'` |
| 6 | Admin: other delivery rejected (AC 8) | `throws_ok(... delivery 'blended' ..., '23514')` |
| 7 | Admin: range (AC 15) | `throws_ok` for `'{1}'`, `'{13}'` → `23514` |
| 8 | Admin: repeats (AC 15) | `throws_ok '{7,7}'` → `23514` |
| 9 | Admin: order | `throws_ok '{9,7}'` → `23514` |
| 10 | Admin: shape | `throws_ok` for `'{7,null}'`, `'{{7,8}}'`, `'[0:0]={7}'` → `23514` |
| 11 | Compat values | Insert `'{}'`, `'{8}'`, `'{7,8,9}'` (returning `year_level`): `results_eq` → `null`, `8`, `null` |
| 12 | Compat follows update | Update a `'{8}'` class to `'{7,9,11}'` returning `year_level` → `null`; back to `'{11}'` → `11` |
| 13 | Nobody can write `year_level` | As admin: `throws_ok` on `update … set year_level = 8` and on `insert (…, year_level) values (…, 8)` → **`428C9`** (generated column, rejected at rewrite before grants; R3-1). The missing grant stays asserted by #3 |
| 14 | Tutor cannot change years or delivery (AC 17) | As `…b1`: `is_empty($$ update … set year_levels = '{7}' where id = '…c001' returning id $$)`; same for `delivery = 'hybrid'` |
| 15 | Default delivery | Insert without delivery returns `in_person` |

The backfill cannot run inside pgTAP (migrations are already applied). It is checked by hand
(§12, AC 12).

Existing `classes_rls`, `fair_results`, `email_outbox`, `family_portal` tests don't name
`year_level` (02 §1) and need no edit.

## 4. Seed: `supabase/seed.sql:104-116`

Replace `year_level` with `year_levels` in the three column lists and set:

| Class | `year_levels` | `delivery` | `location` |
|---|---|---|---|
| Selective Entry Maths & Reasoning | `'{7,8,9}'` | `'hybrid'` | `'Truganina, Room 1 and Zoom'` |
| NAPLAN Reading & Writing | `'{5}'` | `in_person` (unchanged) | unchanged |
| Selective Interview Preparation | `'{8}'` | `online` (unchanged) | unchanged |

Maths has the seeded students and parents, so after `pnpm db:reset` a hybrid, multi-year class
shows on the staff, student and parent timetables (AC 7) and on mobile with a null `year_level`
(AC 18), while the other two still show `Year 5` / `Year 8`. No other seed line depends on these
values (checked: seed lines 175+ look the class up by name only).

## 5. Generated and hand-written types

1. Run `pnpm db:types` after `pnpm db:reset`. Expect `classes.Row.year_levels: number[]`,
   `year_level: number | null`; `Insert`/`Update` show `year_level?: never`.
2. `apps/web/src/services/types.ts`:
   - `:207` derive it from the constant so the two lists can't drift (R3-5):
     `export type Delivery = (typeof DELIVERIES)[number];` with
     `import type { DELIVERIES } from '@/constants';` (a type-only import works with `typeof` and
     adds no runtime import; services already import from `@/constants`, e.g.
     `enquiries.service.ts:5-6`, and constants never import services, so there is no cycle).
   - `ClassSummary` (`:222`): `yearLevel: number | null` → `yearLevels: number[]; // ascending; empty = Any year`
   - `ClassInput` (`:269`): `yearLevel` → `yearLevels: number[];` (R2-4)
   - `StudentSummary`, `StudentInput` and every other `yearLevel` stay (AC 16).

## 6. Service: `apps/web/src/services/classes.service.ts`

1. `CLASS_COLUMNS` (`:21-26`): `year_level` → `year_levels`.
2. `ClassRow` (`:40`): `year_level: number | null` → `year_levels: number[];`
3. `toClassSummary` (`:67`): `yearLevels: row.year_levels,`
4. `saveClass` (`:123`): `year_levels: sortedYears(input.yearLevels),` and add, exported and
   pure, above `saveClass` (R3-4):
   ```ts
   /** Ascending with no repeats: the only form the database accepts (DEC-HM-1). */
   export function sortedYears(years: readonly number[]): number[] {
     return [...new Set(years)].sort((a, b) => a - b);
   }
   ```
5. New co-located `apps/web/src/services/classes.service.test.ts`: `sortedYears([11, 7, 9])` →
   `[7, 9, 11]`; `sortedYears([8, 7, 8, 7])` → `[7, 8]`; `sortedYears([])` → `[]`; the input array
   is not mutated. Importing the service is safe in tests: the Supabase client is created lazily
   (`supabase.client.ts:3-5`).
6. Untouched: `StudentRow`/`toStudentSummary` (`:249-257`, the student's year), the timetable select
   at `:222` (already reads `delivery`; the `as Delivery` cast now covers `hybrid`).

## 7. Constants: `apps/web/src/constants/portal.constants.ts`

1. **`DELIVERIES` (R2-5)**, placed just above `DELIVERY_LABELS` (`:705`):
   ```ts
   /** Delivery options in the order the class form lists them (AC 1). */
   export const DELIVERIES = ['in_person', 'online', 'hybrid'] as const;
   ```
2. **`DELIVERY_LABELS`**: add `hybrid: 'Hybrid',` and end the object with
   `} as const satisfies Record<(typeof DELIVERIES)[number], string>;` so a delivery without a
   label fails typecheck. `DELIVERIES` is now the single list: `Delivery` (§5) is derived from it.
3. **`YEAR_LEVEL_TEXT`** (`:699-703`), keep `label`, `other`, `any`; add:
   ```ts
   several: (years: string) => `Years ${years}`,
   rangeSeparator: '–', // en dash, AC 13
   listSeparator: ', ',
   ```
4. **`CLASS_DIALOG.hints`** (`:748-751`):
   - `location: 'Room, the online meeting place (e.g. Zoom), or both for hybrid.'` (AC 6)
   - add `yearLevel: 'Choose one or more, or none for any year.'`
5. Year options reuse `YEAR_LEVELS` from `app.constants.ts:163` (already ascending 2–12, already
   shared with the student forms). No new list.

## 8. Label: `apps/web/src/lib/labels.ts`

Replace `classYearLabel` (`:16-19`). Signature: `classYearLabel(years: readonly number[]): string`.

Rules (AC 13), each step a small named function for readability:

1. `sorted` = ascending copy with repeats removed (never mutate the argument).
2. 0 years → `YEAR_LEVEL_TEXT.any`. 1 year → `YEAR_LEVEL_TEXT.label(year)`.
3. Otherwise split `sorted` into runs of consecutive numbers (`groupRuns(years): number[][]`).
4. Format each run (`formatRun(run): string`): length ≥ 3 → `${first}${rangeSeparator}${last}`;
   length 1 or 2 → its numbers joined with `listSeparator`.
5. Join the formatted runs with `listSeparator` and wrap in `YEAR_LEVEL_TEXT.several(...)`.

| Input | Output |
|---|---|
| `[]` | `Any year` |
| `[8]` | `Year 8` |
| `[7, 8, 9]` | `Years 7–9` |
| `[7, 8]` | `Years 7, 8` |
| `[7, 9, 11]` | `Years 7, 9, 11` |
| `[11, 7, 8, 9]` | `Years 7–9, 11` |
| `[7, 8, 10, 11]` | `Years 7, 8, 10, 11` |
| `[2, …, 12]` | `Years 2–12` |

JSDoc: `/** A class's years, e.g. "Years 7–9, 11"; "Any year" when none are set (AC 13). */`.
`studentYearLabel` and `deliveryLabel` are unchanged (`deliveryLabel` covers `hybrid` through the
type and constants).

## 9. UI

### 9.1 `apps/web/src/components/portal/ClassDialog.tsx`

1. Header comment: "year" → "years".
2. Imports: add `DELIVERIES` from `@/constants`; add `Checkbox` and `ListItemText` from
   `@mui/material/Checkbox` and `@mui/material/ListItemText` (already in `@mui/material`, no new
   dependency); add `classYearLabel` from `@/lib/labels`. Drop `Delivery` from the `@/services`
   import only if nothing else uses it (the delivery `onChange` cast still does).
3. Remove the local `ANY_YEAR` (`:21`) and `DELIVERIES` (`:23`) consts (R2-5).
4. `emptyInput()` (`:39`): `yearLevels: [],`. `inputFrom()` (`:53`): `yearLevels: existing.yearLevels,` (R2-4).
5. Add a module helper, with a WHY comment:
   ```ts
   // A multiple Select reports its value as an array; anything else means nothing is chosen.
   function toYearLevels(value: unknown): number[] {
     return Array.isArray(value) ? value.map(Number) : [];
   }
   ```
6. Replace the Year level `TextField` (`:138-152`) with a multiple select, keeping the
   `TextField select` style used in this file:
   - `select fullWidth label={CLASS_DIALOG.labels.yearLevel} value={input.yearLevels}`
   - `helperText={CLASS_DIALOG.hints.yearLevel}`
   - `onChange={(event) => update({ yearLevels: toYearLevels(event.target.value) })}`
   - `slotProps={{ select: { multiple: true, displayEmpty: true, renderValue: (selected) => classYearLabel(toYearLevels(selected)) }, inputLabel: { shrink: true } }}`
     (`displayEmpty` + `shrink` so `Any year` shows in the box with the label above it, not under it.)
   - Items: `YEAR_LEVELS.map((year) => <MenuItem key={year} value={year}><Checkbox checked={input.yearLevels.includes(year)} tabIndex={-1} disableRipple /><ListItemText primary={YEAR_LEVEL_TEXT.label(year)} /></MenuItem>)`
   - No "Any year" item: empty selection is Any year (AC 10). No chips: the box shows the AC 13
     label, so it reads the same as the list and detail page (02 §10).
   - Keyboard (built into MUI Select): Tab to the field, Enter/Space/ArrowDown opens, arrows move,
     Enter/Space toggles and keeps the menu open, Escape or Tab closes. The listbox gets
     `aria-multiselectable` and each option `aria-selected`. The checkbox is visual only
     (`tabIndex={-1}`), so focus stays on the options.
   - No `style={}`; any spacing via `sx` as elsewhere in the file.
7. Delivery select (`:155-166`): map the imported `DELIVERIES`; no other change (AC 1–3).

### 9.2 Displays

| File | Change |
|---|---|
| `routes/portal/classes.tsx:112` | `classYearLabel(item.yearLevels)` |
| `routes/portal/class-detail.tsx:116` | `classYearLabel(item.yearLevels)`; `:117` and `:186-189` unchanged (they already show `Hybrid` / `Hybrid · <location>` once the label exists) |
| `components/portal/WeekTimetable.tsx:115-118` | None. Staff, student and parent timetables show `Hybrid · <location>` or `Hybrid` via `deliveryLabel` |
| `services/family-data.ts:39,100` | None. Family SQL returns `delivery` as text; the `Delivery` type now includes `hybrid` |

## 10. Validation: `apps/web/src/lib/class-validation.ts`

No new rule and no new error key. The select can only produce years from `YEAR_LEVELS`, the
service removes repeats and sorts, and the database is the backstop (§2). Location keeps its
100-character rule for every delivery (A3, AC 5). Edits are to the test only:

- `class-validation.test.ts:12` fixture: `yearLevels: [8],` (R2-4).
- Add a case: `validateClass({ ...valid, delivery: 'hybrid', location: 'x'.repeat(101) })` →
  `{ location: CLASS_VALIDATION.locationLength }`, and with a 100-char location → `{}`.
- Move the `classYearLabel` assertion (`:65`) to `labels.test.ts`; remove `classYearLabel` from
  this file's import if it is no longer used.

## 11. Files to touch

| File | New / edit |
|---|---|
| `supabase/migrations/20261028100000_classes_hybrid_multi_year.sql` | New |
| `supabase/tests/database/classes_years_delivery.test.sql` | New |
| `supabase/seed.sql` | Edit (`:104-116`) |
| `apps/web/src/services/database.types.ts` | Regenerated (`pnpm db:types`) |
| `apps/web/src/services/types.ts` | Edit (`:207`, `:222`, `:269`) |
| `apps/web/src/services/classes.service.ts` | Edit (`:21-26`, `:40`, `:67`, `:113-125`) |
| `apps/web/src/services/classes.service.test.ts` | New (`sortedYears`) |
| `apps/web/src/constants/portal.constants.ts` | Edit (`:699-711`, `:748-751`) |
| `apps/web/src/lib/labels.ts` | Edit (`:16-19`) |
| `apps/web/src/lib/labels.test.ts` | New |
| `apps/web/src/lib/class-validation.test.ts` | Edit |
| `apps/web/src/components/portal/ClassDialog.tsx` | Edit |
| `apps/web/src/components/portal/ClassDialog.test.tsx` | New |
| `apps/web/src/routes/portal/classes.tsx` | Edit (`:112`) |
| `apps/web/src/routes/portal/class-detail.tsx` | Edit (`:116`) |

Not touched: `auth-errors.ts`, `WeekTimetable.tsx`, `family-data.ts`, family SQL functions, RLS,
student files, public pages, `aj_classes_mobile`. Keep the untracked `actionItems.md` out of
every commit on this branch (R2-6).

`docs/decisions/0009` moves from Proposed to Accepted and `_knowledge/decisions.md` gets DEC-HM-1
to DEC-HM-4 when the team lead closes the stage; not part of the Developer's diff.

## 12. Test approach by AC

| AC | How | Where |
|---|---|---|
| 1 | Open New class, open Delivery: options `In person`, `Online`, `Hybrid` in order | `ClassDialog.test.tsx` (RTL + user-event) + browser |
| 2 | Render with an `existing` hybrid class: Delivery shows `Hybrid`; three options | `ClassDialog.test.tsx` |
| 3 | Pick Hybrid, save: `onSave` receives `delivery: 'hybrid'`. Round trip create → reopen, and edit In person ↔ Hybrid ↔ Online | unit + browser (admin, local) |
| 4 | `DELIVERY_LABELS.hybrid === 'Hybrid'`; no literal `'Hybrid'` in components (`grep`) | `labels.test.ts` + review |
| 5 | Hybrid with 101-char location gives `locationLength`, 100 passes | `class-validation.test.ts` + browser |
| 6 | Hint text equals `CLASS_DIALOG.hints.location` and is visible under Location | `ClassDialog.test.tsx` |
| 7 | Seeded Maths class shows `Hybrid` chip and `Hybrid · Truganina, Room 1 and Zoom` fact; same bullet on staff timetable, student timetable, parent child page | browser as admin, student, parent (local seed) |
| 8 | Hybrid accepted, other values `23514` | pgTAP §3 #5, #6 |
| 9 | Year level opens a listbox with `Year 2`…`Year 12` ascending; ticking and unticking toggles; keyboard only (Tab, Enter, arrows, Space, Escape) | `ClassDialog.test.tsx` + browser keyboard pass |
| 10 | Nothing ticked: field shows `Any year`; `onSave` gets `yearLevels: []` | `ClassDialog.test.tsx` |
| 11 | Tick 11, 7, 9 then save: `onSave` gets those years; `sortedYears` turns them into `[7, 9, 11]` (and drops repeats); reopen ticks exactly 7, 9, 11 | `ClassDialog.test.tsx` + `classes.service.test.ts` + browser |
| 12 | Backfill, by hand (R3-3), commands and output recorded in the TSR: (1) `supabase db reset --version 20261027100000 --no-seed`; (2) in `psql`, insert two classes with `year_level` 8 and null, and note their `updated_at`; (3) `supabase migration up`; (4) check `year_levels` is `{8}` and `{}`, `year_level` is 8 and null, and `updated_at` is unchanged. Then `pnpm db:reset` to restore the seed, and in the browser Edit + save a single-year class without changes: years unchanged | Tester (manual SQL) + browser |
| 13 | Every row of the §8 table | `labels.test.ts` |
| 14 | Classes list Year column and detail chip show `Years 7–9` for seeded Maths, `Year 5` for NAPLAN | browser; code uses the one `classYearLabel` |
| 15 | Range, repeats, order, shape → `23514` | pgTAP §3 #7–#10 |
| 16 | Student forms, lists, enrol picker, result cards, family pages still single-year/"Other" | existing tests pass + browser spot check; diff touches no student file |
| 17 | `classes_rls` passes unchanged; tutor cannot change years/delivery; grants | pgTAP `classes_rls` + §3 #3, #13, #14 |
| 18 | Run `aj_classes_mobile` against local Supabase after `pnpm db:reset`: admin and tutor class lists show Maths with no year, others `Year 5`/`Year 8`, no error; student timetable loads with the hybrid class. If the app can't run, show the PostgREST response for `select=…,year_level,delivery` matches `tutor_repo.dart:21` parsing. Record which method in the TSR | Tester |
| 19 | `labels.test.ts` exists and covers AC 13; `pnpm check` and `pnpm db:test` pass | CI-equivalent run |

`ClassDialog.test.tsx` setup: wrap in `LocalizationProvider` with `AdapterDayjs` (the dialog has
`DatePicker`s; see `PortalThemeProvider.tsx:53`), pass `tutors=[]`, a `vi.fn()` `onSave` returning
`{ ok: true, data: 'id' }`. Query by role and constants (`getByRole('combobox', { name:
CLASS_DIALOG.labels.yearLevel })`, `getByRole('option', { name: YEAR_LEVEL_TEXT.label(7) })`),
not by literal strings.

## 13. Sequencing

1. Migration → `pnpm db:reset` → pgTAP file → `pnpm db:test`.
2. Seed edit (must land with the migration; `db:reset` fails otherwise) → `pnpm db:types`.
3. Types → service → constants → labels + `labels.test.ts` → validation test → ClassDialog + test →
   list and detail pages. Typecheck after types will list every reader still on `yearLevel`.
4. `pnpm check`, then the browser pass (admin, tutor, student, parent; light and dark), then the
   mobile check (AC 18).

Risk carried from 02 §7: if another branch lands a later migration first, rename this file to a
newer timestamp before merge (ADR-0007 §4). `[TBC: whether hosted Supabase has been migrated at
all – Saurabh]`, which matters only at deploy time, not for this build.
