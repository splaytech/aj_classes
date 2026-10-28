# ADR-0009: Class year levels are an array; `year_level` stays as a generated compat column; delivery gains `hybrid`

- **Status:** Accepted (2026-10-28, Architect, `/deliver` hybrid-class-multi-year, Stage 2; accepted the same day when [review-2](../delivery/2026-10-28-hybrid-class-multi-year/review-2.md) approved the stage, built in migration `20261028110000_classes_hybrid_multi_year.sql`)
- **Source:** `docs/delivery/2026-10-28-hybrid-class-multi-year/02-architecture.md`

## Context

Admins need to give a class several year levels (for example Years 7–9) and a third delivery
type, `hybrid`. `public.classes.year_level` is one nullable `smallint`. The shipped mobile build
selects `classes.year_level` by name and expects a number (`aj_classes_mobile`
`lib/features/tutor/data/tutor_repo.dart:21`). It must keep working without a mobile release.

## Decision

1. **`classes.year_levels smallint[] not null default '{}'` is the source of truth.**
   - An empty array means "Any year".
   - It is stored strictly ascending, so it can't hold repeats.
   - A check constraint limits it to values 2–12, with no nulls.
   - A `BEFORE INSERT OR UPDATE` guard trigger enforces the order. It's a trigger rather than a
     check that calls a function, because `private` functions don't grant `execute` to
     `authenticated`.
   - `authenticated` gets the insert and update column grants.
2. **`classes.year_level` is dropped and re-added as**
   `generated always as (case when cardinality(year_levels) = 1 then year_levels[1] end) stored`.
   - It is read-only and has no write grant.
   - It is null for Any year and for classes with several years, so old mobile builds never show
     a wrong single year.
   - Existing rows are backfilled into `year_levels` first, with `updated_at` kept.
3. **The `delivery` check becomes `in ('in_person', 'online', 'hybrid')`.** `delivery` stays
   `text`, not an enum.
4. No change to RLS, RPCs or family functions. They return `delivery` as text and don't return
   the class's year.

## Consequences

- The web portal reads and writes only `year_levels`. A web tab opened before the deploy fails
  safely when it saves: the write to generated `year_level` is rejected (428C9) and the user sees
  the generic "Something went wrong" message.
- The shipped mobile build shows `Year N` for single-year classes and no year for multi-year
  ones. It doesn't display delivery, so `hybrid` is harmless there.
- `year_level` is dropped by a later migration once mobile reads `year_levels` (requirement D3).
- To roll back, a forward migration turns multi-year sets and hybrid flags back into single
  values, which loses data. Roll forward if at all possible.

## Alternatives rejected

- A trigger-synced plain `year_level`: two writable copies of one fact.
- A `class_year_levels` join table: a new table with its own RLS and grants, and non-atomic
  client writes, for an 11-value set that is never queried on its own.
- Replacing or renaming `year_level`: breaks the shipped mobile build.
- Showing the lowest year in `year_level`: mobile would show `Year 7` for a Years 7–9 class,
  which is false.
- A Postgres enum for delivery: adding a value can't be undone.
