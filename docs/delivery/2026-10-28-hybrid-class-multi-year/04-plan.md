# 04 — Delivery plan: hybrid classes and multiple year levels

Stage 4 of `/deliver`, Manager. Branch `feature/hybrid-class-multi-year`. Date 2026-10-28.
Inputs: [01](01-requirement.md), [02](02-architecture.md), [03](03-design.md) (final, with R2-n and
R3-n), reviews 1–3, [ADR-0009](../../decisions/0009-class-year-levels-array-with-compat-column.md).
§ numbers refer to 03.

## Baseline (every command below was run once on this branch, 2026-10-28)

`CI_ENV` means exporting the CI placeholders once per shell (as in `ci.yml:116-124`, no real keys):

```
export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000
```

1. With `CI_ENV`, `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes: 63 files, 543 tests.
2. **`pnpm format:check` (so `pnpm check`) fails, and only on the untracked `actionItems.md`.**
   That file is Saurabh's and must stay out of the diff, so don't format it or commit it. Use this
   format gate instead (it passes today):
   `git ls-files --cached --others --exclude-standard | grep -vx actionItems.md | xargs pnpm exec prettier --check --ignore-unknown`.
   Auto-fix only the files you touched: `pnpm exec prettier --write <files>`. Never run `pnpm format`.
3. **`pnpm db:test` fails right now** (`email_outbox`, `fair_results`). The cause is not this
   branch. Every worktree uses the same local Supabase (`project_id = "aj_classes"`), and it
   currently holds the schema from `feature/more-email-alerts` (`aj_classes-items-4-9`), including
   that branch's migration `20261028100000_more_email_alerts.sql`. This branch's `pnpm db:reset`
   is expected to bring it back to green.
4. `docker exec supabase_db_aj_classes psql -U postgres -c '\d public.classes'` confirms the
   constraint name `classes_delivery_check` (§2 step 7).
5. `test:functions` is **not relevant**. No script or edge function reads class year or delivery.
   The only `year_level` reference is a student's (`test-account-admin.mjs:172`).

## Two changes to 03 (Reviewer, please confirm)

- **P1. Rename the migration to `20261028110000_classes_hybrid_multi_year.sql`.**
  `20261028100000` is already used by `feature/more-email-alerts`, and Supabase keys
  `schema_migrations` by version. `110000` sorts after it. If this branch merges first, the
  ADR-0007 §4 rule still applies: the branch that merges second gets the later timestamp. The
  filename in 02/03 is superseded by this one. ADR-0009 doesn't name the file.
- **P2. Run `pnpm db:types` in slice 3, not straight after the migration (03 §13 step 2).**
  The regenerated types make `year_level` `never` on insert. The current `saveClass` still writes
  it, so typecheck would go red until the service changes too.

## Shared local DB: one owner

The Developer on this branch is the only one who runs state-changing commands (`db:reset`,
`db:test`, `migration up`). Before the first `pnpm db:reset`, check that nobody is using
`aj_classes-items-4-9` for tests, because the reset wipes that branch's schema and seed. Afterwards,
that worktree needs its own `pnpm db:reset`. The Tester and Security stay read-only while the
Developer runs tests (team-lead rule, aj_classes item 8).

## Slices (one commit each; the build stays green after every slice)

- [x] **S1. Database.** New migration (P1 name, §2 steps 1–8 in order), new
  `supabase/tests/database/classes_years_delivery.test.sql` (§3 cases 1–15), and the
  `supabase/seed.sql:104-116` edit (§4). The seed has to land with the migration.
  **Verify:** `pnpm db:reset && pnpm db:test` passes all files; `\d public.classes` (command above)
  shows `year_levels smallint[]`, a generated `year_level`, and `hybrid` in the delivery check.
  Web build unchanged. Note: saving a class in the browser fails until S3, because the old service
  still writes `year_level` (428C9).
  **Commit:** `feat(db): add hybrid delivery and a year_levels array to classes`
  **Closes:** AC 8, AC 15, the database half of AC 17.
- [x] **S2. Hybrid on the web.** `portal.constants.ts`: `DELIVERIES`, `DELIVERY_LABELS.hybrid` with
  `satisfies`, and the location hint (§7.1, 7.2, 7.4 location line). `services/types.ts`: derive
  `Delivery` from `DELIVERIES` (§5.2, first bullet). `ClassDialog.tsx`: import `DELIVERIES` and drop
  the local const (§9.1 step 7, plus the `DELIVERIES` part of step 3). `class-validation.test.ts`:
  the hybrid 100/101-character cases (§10). New `lib/labels.test.ts` with
  `deliveryLabel('hybrid') === DELIVERY_LABELS.hybrid`.
  **Verify:** `pnpm --filter web exec vitest run src/lib/labels.test.ts src/lib/class-validation.test.ts`,
  then `pnpm typecheck && pnpm lint`. `grep -rn "'Hybrid'" apps/web/src --include='*.tsx'` prints
  nothing.
  **Commit:** `feat(portal): offer hybrid as a class delivery option`
  **Closes:** AC 1, 2, 4, 5, 6, and AC 3 and 7 in code (the browser check is in S6).
- [x] **S3. Several year levels on the web.** This slice is one commit because typecheck links
  every reader of `yearLevel`. Run `pnpm db:types` (P2). Then:
  - `types.ts`: `ClassSummary` and `ClassInput` get `yearLevels` (§5.2).
  - `classes.service.ts`: switch to `year_levels`, and add `sortedYears` (§6.1–6.4) with a new
    `classes.service.test.ts` (§6.5).
  - `YEAR_LEVEL_TEXT`: add `several`, `rangeSeparator` and `listSeparator`, plus the `yearLevel`
    hint (§7.3, 7.4).
  - `labels.ts`: `classYearLabel(years)` (§8), with the §8 table added to `labels.test.ts`.
    Move the old assertion out of `class-validation.test.ts`, and change its fixture to
    `yearLevels: [8]` (§10).
  - `ClassDialog.tsx`: the multi-select (§9.1 steps 1–6).
  - `classes.tsx:112` and `class-detail.tsx:116` (§9.2).

  **Verify:** `git diff --stat apps/web/src/services/database.types.ts` shows only the classes
  changes. Then `pnpm --filter web exec vitest run src/lib src/services/classes.service.test.ts`,
  then `pnpm typecheck && pnpm lint`. `grep -rn "yearLevel\b" apps/web/src` should show student
  code only.
  **Commit:** `feat(portal): let a class have several year levels`
  **Closes:** AC 9, 10, 11, 13, 14, 16, AC 19 (the unit test), and AC 12 in code.
- [x] **S4. ClassDialog tests.** New `components/portal/ClassDialog.test.tsx`, set up as in §12
  (LocalizationProvider, queries by role and constant). It covers delivery order and Hybrid
  preselected, the location hint, Any year when empty, toggling 11, 7 and 9, and `onSave` payloads.
  **Verify:** `pnpm --filter web exec vitest run src/components/portal/ClassDialog.test.tsx`.
  **Commit:** `test(portal): cover hybrid delivery and multi-year selection in the class dialog`
  **Closes:** AC 1, 2, 3, 6, 9, 10, 11 (the unit level).
- [x] **S5. Docs.**
  - In `supabase/README.md:37`, say the demo Maths class is hybrid and for Years 7–9.
  - Mark ADR-0009 as Accepted, in the file and in its row in `docs/decisions/README.md`.
  - Commit this delivery folder, the ADR and the README row (all currently uncommitted).
  - The root `README.md` needs no change, because it never mentions class year or delivery.

  **Commit:** `docs: accept ADR-0009 and record the hybrid and multi-year delivery`
  **Post-merge, team lead (not in the diff):** add DEC-HM-1 to DEC-HM-4 as one-liners in
  `~/second-brain/Projects/AJClasses/_knowledge/decisions.md`.
- [ ] **S6. Full gate and manual checks.** With `CI_ENV`, run the baseline format gate (item 2),
  then `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, then `pnpm db:reset && pnpm db:test`.
  The Tester then follows §12:
  - the AC 12 backfill check by hand (`db reset --version 20261027100000 --no-seed` → insert →
    `migration up`; note that with P1 the target is still `20261027100000`), then `pnpm db:reset`;
  - a browser pass as admin, tutor, student and parent, in light and dark (AC 3, 5, 7, 9 by
    keyboard, 11, 12, 14, 16, 17);
  - the AC 18 mobile check, recording in the TSR whether the app was run or the code was reviewed.

  The TSR goes in this folder.
  **Closes:** AC 3, 7, 12, 17, 18, 19 (the full checks).

## Risks

1. **Migration timestamp collision or order** with `feature/more-email-alerts` (P1). Whichever
   branch merges second must sort later. Never use `db push --include-all` (02 §6).
2. **Shared local DB.** A reset on either branch breaks the other branch's tests until it resets
   again. One owner at a time (above).
3. **Between S1 and S3, local class saves fail** (428C9 on the old `year_level` write). This is
   expected, so don't raise it as a bug. Open the browser for checks only after S3.
4. **S3 is the largest slice.** If typecheck lists a reader that 03 §11 missed, fix it in S3 and
   note it in the dev notes. Don't widen the scope.
5. **Mobile shows no year for multi-year classes** until D3. This is accepted (DEC-HM-2).
6. **Hosted Supabase migration state is unknown** (03 `[TBC]`). It only matters at deploy, which
   is Saurabh's step.

## Deferred (from 01)

D1 tutors editing classes (Saurabh's decision) · D2 filter or sort by year or delivery · D3 mobile
showing Hybrid and multi-year labels, then dropping `year_level` · D4 separate in-person and online
locations · D5 warnings when a student's year doesn't match the class · D6 marketing copy about
hybrid (Saurabh to confirm it's offered).

## Definition of done

1. AC 1–19 pass, with the method recorded in the TSR for each.
2. With `CI_ENV`, the format gate (baseline item 2), `pnpm lint`, `pnpm typecheck`, `pnpm test` and
   `pnpm build` pass, and so do `pnpm db:test` after a clean `pnpm db:reset`. No migration or seed
   errors.
3. The browser pass is done (four roles, light and dark), and the AC 18 mobile check is recorded.
4. Five conventional commits (S1–S5), and this plan is ticked.
5. `actionItems.md` is in no commit (`git log --stat develop..HEAD | grep -c actionItems` → 0).
6. The diff doesn't touch `auth-errors.ts`, `WeekTimetable.tsx`, `family-data.ts`, family SQL,
   RLS, student files, `package.json` or `pnpm-lock.yaml` (03 §11).

## Amendments from review-4 (folded in by team lead)

1. **DB ownership:** the Developer owns every state-changing local DB command (reset, migration up, db:test) through S5 and hands it to the Tester at S6. Security is read-only throughout. Item 8 (`aj_classes-items-4-9`) was confirmed parked at `89337aa`, so resets are clear. That worktree needs its own `pnpm db:reset` before item 8 resumes.
2. **S3 grep:** the check is that no `ClassSummary`/`ClassInput` `yearLevel` readers remain. Remaining hits in `CLASS_DIALOG.labels/hints.yearLevel` and student/onboarding code are expected.
3. **Commits:** 01–04 and reviews 1–4 are committed now by the team lead (`docs(delivery): ...`). The TSR gets its own `test: add TSR for hybrid and multi-year classes` commit. DoD 4 becomes "S1–S5 plus the docs and TSR commits".
4. **ADR-0009:** S5 sets it to Accepted in the Developer's diff. This supersedes 03 §11.

## Developer notes (Stage 5, 2026-10-28)

S1–S5 built as planned, one commit each, every slice's verify commands green before its commit.

1. **Migration filename** is `20261028110000_classes_hybrid_multi_year.sql` (P1). 02 and 03 still
   name `20261028100000`; P1 supersedes them.
2. **Delivery folder** (01–04, reviews 1–4) was already committed by the team lead in `a72f548`, so
   S5 commits only this plan's ticks and notes, ADR-0009 (now Accepted), its README row and the
   `supabase/README.md` demo-data line.
3. **`ClassDialog.test.tsx` reads the Year level field with `hidden: true` while its menu is open.**
   MUI marks the rest of the page `aria-hidden` while a Select menu is open, so a plain
   `getByRole('combobox')` finds nothing there. Test-only; the component is as designed (§9.1).
4. **The dialog passes years to `onSave` in the order they were ticked** (e.g. `[11, 7]`);
   `sortedYears` in `saveClass` puts them in the stored order. This is the §6.4 split, and the test
   asserts it so a reader sees where sorting happens.
5. **`classYearLabel`** removes repeats and sorts its own copy (§8 step 1), so it never depends on
   the caller's order.
6. **Not done here:** S6 (Tester: AC 12 backfill by hand, browser pass in four roles and both
   themes, AC 18 mobile check, TSR). No browser pass was run by the Developer.
