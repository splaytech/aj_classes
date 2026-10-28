# review-3 — Stage 3 (Design) gate

## Round 1

CHANGES_REQUESTED

Sound overall, and all review-2 findings are folded in. Verified on PG 17 temp tables:
- Check constraint: `{7,null}`, `{{7,8}}` and `[0:0]={7}` give 23514; `{}` passes.
- Generated column is immutable: `{}` → null, `{8}` → 8, `{7,8,9}` → null.
- Guard: `{9,7}` and `{7,7}` raise 23514 `invalid_year_levels`, which maps to invalidInput through auth-errors.ts with no change needed.
- Grants, the trigger name and the migration timestamp are correct.
- pgTAP conventions match.
- No test asserts on the seeded Maths class.
- MUI v9 multi-select labelling works with getByRole.
- The files-to-touch list is complete, and AC 1–19 are all mapped.

Findings:
1. **Blocking:** §3 pgTAP case #13 expects 42501, but writes to the generated `year_level` fail at query rewrite with **428C9** ("can only be updated to DEFAULT" / "cannot insert a non-DEFAULT value"). Expect 428C9 and keep case #3 as the grant assertion. Correct the stale-tab note in 02 §4 and 03: the user sees the generic "Something went wrong" (unmapped → unknown), and nothing is written.
2. Non-blocking: the guard trigger should begin with `if new.year_levels is null then return new; end if;` so a NULL reports 23502 from NOT NULL, not 22004.
3. Non-blocking: AC 12 backfill steps: `supabase db reset --version 20261027100000 --no-seed`, insert classes with year_level 8 and null and note updated_at, run `supabase migration up`, then check `{8}` / `{}` and that updated_at is unchanged.
4. Non-blocking: AC 11 says the service sends a sorted array, but nothing tests that. Export `sortedYears` and unit-test it, or have the browser pass read the stored row.
5. Non-blocking: derive `Delivery` from `DELIVERIES` (`(typeof DELIVERIES)[number]`), or add `satisfies readonly Delivery[]`, so the two lists can't drift.
6. Process note: the reviewer ran an idempotent `create extension if not exists pgtap`, which changed nothing.

## Round 2

APPROVED

All round-1 findings are resolved, marked R3-1 to R3-5, with no regressions.
- Case #13 now expects 428C9, and case #3 keeps the grant assertion.
- The stale-tab text ("Something went wrong") is consistent across 03 §2, 02 §4 and ADR-0009.
- The guard returns early on a null array.
- The AC 12 steps are concrete.
- `sortedYears` is exported and tested in a co-located `classes.service.test.ts`.
- `Delivery` is derived from DELIVERIES (same pattern as ErrorKey), with no import cycle.

Next: move ADR-0009 to Accepted and add the decisions to `_knowledge/decisions.md`; keep actionItems.md out of commits.
