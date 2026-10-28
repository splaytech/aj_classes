# 06 — Security review: hybrid classes and multiple year levels

Stage 6b of `/deliver`, Security. Branch `feature/hybrid-class-multi-year`. Date 2026-10-28.
Scope: `git diff develop...HEAD` (26 files), read against [02-architecture.md](02-architecture.md)
and [03-design.md](03-design.md). Local DB state checked with read-only `select`s inside
`begin read only … rollback` on `supabase_db_aj_classes` (migration `20261028110000` applied).
The mobile repo `aj_classes_mobile` was read, not run.

**Verdict: PASS WITH NOTES.** Nothing blocks. No bugs for the Developer.

## What was checked

| # | Area | Result | Evidence |
|---|---|---|---|
| 1 | RLS on `classes` | Unchanged. RLS is still on. The three policies are the same: select for admin or the class's active tutor, and insert/update for `private.is_admin()` only. `is_admin()` means an active admin with an aal2 session | `pg_policy`; `20261006004522_staff_accounts.sql:126` |
| 2 | Column grants | `authenticated` can insert/update `year_levels` only. The old `year_level` write grants went with the dropped column. Nothing writes the generated `year_level`, and Postgres rejects writes to it anyway (428C9). `anon` has no grant on `classes` | `information_schema.column_privileges` / `role_table_grants` |
| 3 | Generated `year_level` | `attgenerated = 's'`. Both an admin insert and an admin update get 428C9 (pgTAP #13) | `pg_attribute`; test file `:122-125` |
| 4 | Privilege escalation | A tutor's update of `year_levels` or `delivery` on their own class affects 0 rows (pgTAP #14). Students and parents have no select policy on `classes` | test file `:133-142`; `pg_policy` |
| 5 | New trigger function `private.check_class_year_levels()` | Runs with the caller's rights, not `security definer` (`prosecdef = f`). `search_path = ''`. Execute is revoked from public, anon and authenticated (`proacl = {postgres=X/postgres}`). The `private` schema isn't exposed through PostgREST (`config.toml:14` exposes `public` and `graphql_public` only). It only reads `NEW` | `pg_proc`; migration §6 |
| 6 | Injection | None. The migration has no dynamic SQL (`execute`/`format`). The web writes go through the supabase-js query builder, which parameterises values. `year_levels` is a typed `smallint[]` | diff scan |
| 7 | Server-side validation | The DB enforces it, whatever the client sends: the check limits values to 2–12, rejects null elements, needs one dimension and lower bound 1. The trigger rejects repeats and out-of-order values (23514). The delivery check allows only `in_person`, `online`, `hybrid`. The client-side `sortedYears` is a convenience, not the control | `pg_constraint`; pgTAP #5–#10 |
| 8 | Data exposure | `year_levels` goes only to roles that could already read `year_level`: admins, and the class's active tutor. The family RPCs (`student_timetable`, `parent_child_timetable`, results, email) list their columns explicitly. None use `c.*`, `to_jsonb(c)` or `row_to_json`, and none return the class's years. So nothing new reaches students or parents. Year level for a class isn't personal data | `20261007090321_family_functions.sql`, `20261027100000_fair_results.sql`, `20261025110000_work_returned_email.sql` grep |
| 9 | Mobile reads | `tutor_repo.dart:20-25` names its columns (`year_level, delivery, …`), so it doesn't pick up `year_levels`. It reads through the same RLS. Students and parents on mobile use the same family RPCs, which haven't changed. Nothing new is exposed on mobile | `aj_classes_mobile/lib/features/tutor/data/tutor_repo.dart` |
| 10 | Secrets | None in the diff. The seed adds only demo class names and locations, with no addresses or credentials | diff scan |
| 11 | Dependencies | None added. `package.json` and `pnpm-lock.yaml` haven't changed. `Checkbox` and `ListItemText` come from the existing `@mui/material` | `git diff --stat` |
| 12 | Client rendering | No `dangerouslySetInnerHTML`, `innerHTML` or `console.log`. Labels render as React text | diff scan |

## Findings

1. **Low, worth doing eventually: the tutor-escalation test runs only at aal1.**
   `classes_years_delivery.test.sql:133` calls `tests.authenticate_as('…b1')` with the default
   `aal1`. `is_admin()` checks the role first, so a tutor at aal2 is also refused today. But an
   aal1 test passes for two reasons at once (wrong role and wrong aal). A later change that
   loosened the role check but kept the aal check would still pass. Fix: also run the two tutor
   `is_empty` cases after `tests.authenticate_as('…b1', 'aal2')` (needs
   `tests.add_verified_factor`). Not blocking. `classes_rls.test.sql` covers the RLS itself.

2. **Info: `delivery` is cast, not parsed, on read.** `classes.service.ts` does
   `row.delivery as Delivery`. The DB check makes the cast true today. If a fourth value is ever
   added to the check before the web is updated, the label lookup returns `undefined`. That
   breaks the display, not security. No action.

3. **Info: `service_role` keeps its default column privileges on the generated `year_level`.**
   Writing to it still fails with 428C9, and `service_role` bypasses RLS by design. No action.

4. **Info: deploy-time lock.** `disable trigger` and `drop column` take an ACCESS EXCLUSIVE lock
   on `classes` for the migration's (short) transaction. That only matters if hosted has live
   traffic when Saurabh runs `db push`. This is availability, not confidentiality. Deploy stays
   his step (02 §6).

## Threat model

`Projects/AJClasses/_knowledge/` has no threat-model file. This change adds no trust boundary,
no role, no RPC, no secret and no PII field. The model, as it is in the migrations and the
earlier reviews, stays the same: admin writes need aal2, tutors read only their own active
classes, and families reach class data only through explicit-column `security definer` RPCs.

## Blocking items for the Developer

None.
