# 02 — Architecture: hybrid classes and multiple year levels

Stage 2 (Architect) of `/deliver`. Branch `feature/hybrid-class-multi-year`. Date 2026-10-28.
Input: [01-requirement.md](01-requirement.md) (with its review-1 amendments) and [review-1.md](review-1.md).
ADR: [0009](../../decisions/0009-class-year-levels-array-with-compat-column.md) (Proposed).

**Recommendation:** one additive, data-preserving migration. Add `classes.year_levels smallint[]`
as the source of truth. Rebuild `classes.year_level` as a generated column that holds the year
only when exactly one is set, so the shipped mobile build keeps working. Widen the `delivery`
check to include `hybrid`. No new RPC, no new dependency, no permission change.
**Nothing needs Saurabh's sign-off** (see §8).

## 1. Impact assessment (checked in the code)

| Area | Today | Change |
|---|---|---|
| `public.classes.delivery` | `check (delivery in ('in_person','online'))`, `20261007061232_classes_timetable_assignments.sql:34` | Replace the check to add `'hybrid'` |
| `public.classes.year_level` | `smallint check (between 2 and 12)`, same file `:33` | Becomes a generated compat column (§2) |
| Column grants | `grant insert/update (name, subject, year_level, delivery, …) on public.classes`, same file `:301-302`; `select` is table-level, `:293` | Add insert/update on `year_levels`. `year_level` grants go when the column is dropped (§4) |
| RLS | "Admins add classes" and "Admins change classes", same file `:364-378` | None. They are row policies and don't name columns |
| Family SQL functions | `timetable_for_student` returns `c.delivery` as `text` (`20261007090321_family_functions.sql:276,290`), used by `student_timetable` and `parent_child_timetable` | None. `hybrid` passes through as text. None of them return the class's year (the `year_level` at `:307` and `:561` is the student's) |
| Other functions, views | No views and no `begin atomic` bodies in `supabase/migrations`, so nothing depends on `classes.year_level` | None |
| Web service | `CLASS_COLUMNS` and `ClassRow.year_level` in `apps/web/src/services/classes.service.ts:21-48`; `saveClass` writes `year_level` (`:123`) | Read and write `year_levels`; stop writing `year_level` |
| Web types | `Delivery = 'in_person' \| 'online'` (`services/types.ts:207`); `ClassSummary.yearLevel: number \| null` (`:222`); generated `database.types.ts` | Add `'hybrid'`; `yearLevels: number[]`; regenerate |
| Web UI | `DELIVERIES` in `ClassDialog.tsx:23`; single year `Select` at `:141-145`; `classYearLabel` in `lib/labels.ts`, used at `classes.tsx:112` and `class-detail.tsx:116` | MUI `Select multiple` (already a dependency); `classYearLabel(years: number[])` |
| Seed and tests | `supabase/seed.sql:104-116` inserts `year_level`; pgTAP inserts in `classes_rls`, `fair_results`, `email_outbox`, `family_portal` don't name `year_level` | Seed switches to `year_levels`; pgTAP tests are unaffected |
| Mobile (shipped build) | `tutor_repo.dart:21` selects `year_level, delivery` by name for the admin and tutor class lists; `admin_classes_body.dart:57` and `tutor_classes_body.dart:69` show `Year $yearLevel` only when it is non-null; `timetable_session.dart:42` parses `delivery` as `String?` and never maps it to a label | Keeps working (§5) |
| Public pages | Don't read classes (01, item 9) | None |

## 2. Multiple year levels: options

| # | Option | Mobile still works | Effort | Verdict |
|---|---|---|---|---|
| 1 | **`year_levels smallint[] not null default '{}'` as the source of truth; `year_level` rebuilt as `generated always as (case when cardinality(year_levels) = 1 then year_levels[1] end) stored`** | Yes. Same name, same type, still nullable | Low: one migration, one column read in the service | **Recommended** |
| 2 | Same array, but `year_level` stays a plain column kept in sync by a trigger | Yes | Low, but a second writable copy of the same fact; a stale web tab could write a `year_level` that disagrees | Rejected: two writable sources |
| 3 | Join table `class_year_levels(class_id, year_level)` | Yes, if `year_level` is also kept | Higher: a new table, RLS, grants, an embedded select, and diff-style writes in `saveClass` (delete, then insert, with no transaction from the client) | Rejected: more moving parts for an 11-value set that is never queried on its own (filtering is deferred, D2) |
| 4 | Replace `year_level` with the array under the same name, or drop it | **No.** The shipped mobile build breaks or shows `Year [7, 8, 9]` (review-1 finding 1) | Low | Rejected by A6 |

**Decisions (option 1):**

- **DEC-HM-1:** `classes.year_levels smallint[] not null default '{}'` is the only writable year
  field. An empty array means "Any year". The array is stored **strictly ascending**, so it can't
  hold repeats and it has one canonical form. The web service sorts before saving.
- **DEC-HM-2:** `classes.year_level` becomes a stored generated column: the year when exactly one
  is set, otherwise null. It is read-only and kept only for the shipped mobile build. **It is not
  the lowest year** (that was the other choice under A6). Showing `Year 7` for a Years 7–9 class
  on mobile would say something false. Showing no year is a reduced view but a true one, and
  mobile already hides the year when it is null. New web code never reads `year_level`.
- **DEC-HM-3, validation:**
  - a check constraint for the range: `year_levels <@ '{2,3,4,5,6,7,8,9,10,11,12}'::smallint[]`,
    plus no null elements and one dimension;
  - a `BEFORE INSERT OR UPDATE` guard trigger that rejects arrays that are not strictly
    ascending, which also rejects repeats (AC 15).

  It's a trigger rather than a check that calls a function because the repo revokes `execute` on
  `private` functions from `authenticated` (e.g. `20261023100000_invite_onboarding.sql:308`), and
  a function in a check runs with the inserting user's rights. Trigger functions don't need that
  grant. Postgres computes generated columns after `BEFORE` triggers, so `year_level` always
  matches.

## 3. Hybrid delivery

- **DEC-HM-4:** Drop the auto-named `classes_delivery_check` and add
  `check (delivery in ('in_person', 'online', 'hybrid'))`.
  - The default stays `in_person`.
  - Existing rows all pass the new check, so the constraint is validated straight away. No
    `not valid` is needed.
  - `delivery` stays `text`, not an enum. Adding to a Postgres enum can't be undone, but a check
    can.
- Location rules don't change (A3). Only the hint text changes.

## 4. Migration shape: `supabase/migrations/20261028100000_classes_hybrid_multi_year.sql`

The steps, in one transaction:

1. Add `year_levels smallint[] not null default '{}'`, with the range check.
2. Backfill: `year_levels = case when year_level is null then '{}' else array[year_level] end`.
   Turn the `classes_set_updated_at` trigger off for this update only, so `updated_at` still
   shows when an admin last edited the class.
3. `drop column year_level`. This also removes its check and its column-level insert and update
   grants.
4. `add column year_level smallint generated always as (...) stored`. It is covered by the
   table-level `select` grant (`:293`), so mobile can still read it. Grant nothing to write it.
5. `grant insert (year_levels), update (year_levels) on public.classes to authenticated`.
6. Create the guard trigger for ascending order, with its function in `private`.
7. Replace the delivery check (§3).
8. Add comments on both columns explaining why `year_level` exists, and that it should be
   removed once every mobile build reads `year_levels` (D3).

PostgREST reloads its schema cache on DDL, so no restart is needed.

**Stale web tabs.** An admin tab opened before the deploy still sends `year_level`. Postgres
rejects a write to the generated column at query rewrite (428C9), before any grant check. The code
is unmapped, so the user sees the generic "Something went wrong. Please try again." Nothing is
written. A reload fixes it. (Corrected in review-3 round 1, finding 1.)

## 5. Mobile compatibility (A6, AC 18)

| Mobile read | After migration | Result |
|---|---|---|
| `tutor_repo.dart:21` select `year_level` | column exists, `smallint`, nullable | No error |
| Admin and tutor class lists, one year | `year_level = 8` | `Year 8`, same as today |
| Multi-year or Any year | `year_level = null` | No year shown. Mobile already does this for Any year |
| `delivery = 'hybrid'` in the admin and tutor class lists, and the student timetable | parsed as `String?` and not mapped to a label (`timetable_session.dart:42`) | No crash. Mobile doesn't show delivery today, so there is no wrong label |

Full multi-year and hybrid display on mobile stays deferred (D3). When D3 ships, a later
migration drops `year_level`, once the old build is no longer supported.

## 6. Prod-data implications (hosted Supabase `unzjnxctkyahtmrkinyr`, staging and prod in one)

- The project memory says the schema must not be applied to hosted until public sign-ups are
  off. Neither `decisions.md` nor this repo records that it has been applied since. So **it's
  unknown whether hosted has a `classes` table or real class rows.**
- In either case, this migration doesn't touch prod data:
  - it is additive;
  - the backfill keeps every row's meaning (one year becomes one year, null becomes Any);
  - no class becomes hybrid;
  - `updated_at` is kept.
- As in ADR-0007 §4, the file is safe to rename to a later timestamp only while it has never
  been applied to hosted. Saurabh runs `supabase migration list` before any `db push`. Never use
  `db push --include-all`. **This is not a blocker for this stage.** Deploying is Saurabh's step,
  as always.

## 7. Risks

1. **Migration order.** Another branch might add a migration with a later timestamp before this
   merges. Rebase and rename the file before merging (ADR-0007 §4).
2. **Mobile shows less for multi-year classes** until D3. That's accepted by A6, and it is
   truthful (DEC-HM-2).
3. **The generated column has to be dropped and re-added** to change what it holds. That's cheap
   while only one mobile build reads it.
4. **Hand-written types drift** (review-1 finding 5). The Developer regenerates
   `database.types.ts`, then updates `Delivery` and `ClassSummary`. Typecheck catches any reader
   that is missed.
5. **The multi-select's accessibility.** MUI `Select multiple` with checkbox items and a
   `renderValue` that uses the new `classYearLabel`. The Solution Designer specifies this. No new
   package.

## 8. Rollback

- Supabase has no down migrations, so a rollback is a new forward migration:
  1. turn `hybrid` rows back into `in_person` or `online` (a choice Saurabh makes per class);
  2. restore the old delivery check;
  3. drop the guard trigger;
  4. drop the generated `year_level` and re-add a plain `smallint` column, filled from
     `year_levels[1]`;
  5. restore its grants;
  6. drop `year_levels`.
- The rollback **loses** multi-year sets and hybrid flags, so roll forward with a fix if at all
  possible. Before this migration reaches hosted, a rollback is just reverting the branch.
- **PAUSE FOR SAURABH: none.** Every change is reversible and additive, and nothing is paid. No
  vendor, auth or permission model changes. Tutors editing classes (D1) is still his decision,
  and it is out of scope.

## 9. Decisions to record (for `_knowledge/decisions.md` once review-2 approves)

DEC-HM-1 to DEC-HM-4 above, recorded as ADR-0009.

## 10. Hand-off to the Solution Designer

- **The `classYearLabel` signature and how it formats years.** The format is in AC 13: the
  en dash only for runs of three or more.
- **The multi-select's empty state.** It shows `Any year` through `renderValue`, with no chips.
- **The service mapping.** `year_levels` maps to `yearLevels: number[]`, and the service sorts
  before saving.
- **The pgTAP test cases**, in a new `classes_years_delivery.test.sql` or added to
  `classes_rls`:
  - range;
  - repeats;
  - order;
  - `hybrid` is accepted and other values are rejected;
  - `year_level` is generated correctly for zero, one and several years;
  - `authenticated` can't write `year_level`.
- **The location hint copy** (AC 6).
