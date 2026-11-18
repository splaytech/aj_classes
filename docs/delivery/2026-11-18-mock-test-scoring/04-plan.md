# 04 — Plan: mock test scoring (marks, pass mark, percentage, admin results)

Stage 4 (Manager), 18 Nov 2026. Branch `feature/mock-test-scoring`. Requirement: Saurabh's "do 1-4" (marks per question, pass mark, percentage on the result, admin sees who submitted and their scores).

Inputs: `01-requirement.md` (50 ACs, plus the release gate), `00-decisions.md` (L-1 to L-11, and S-1: Saurabh's yes of 2026-11-18), `02-architecture.md` (approved, round 2), `03-design.md` (round 2 in progress), `review-1.md`, `review-2.md`, `review-3.md`. Model: `docs/delivery/2026-11-18-mock-test-closing/04-plan.md`.

**Sync status.** Synced to the final `03-design.md` (commit `317f670`, review-3 APPROVED at round 3). The section "Re-sync after review-3" records how each finding landed.

---

## How to read this plan

- A slice ticks only when its command passes on the branch. Every web slice ends with `pnpm lint && pnpm typecheck` in addition to the command named for it.
- Commands in this plan are the ones I ran (marked **run by Manager**) or the ones the Developer or Dev Lead must run once before ticking the slice (marked **not run here**). Nothing here commits, pushes or touches hosted services.
- **Scope of the format check.** Repo-wide `pnpm format:check` fails today on two files that are not this feature (see "Verified by the Manager" item 3). Every slice therefore checks only the files it touches, with `pnpm exec prettier --check <files>`. Never `--write` on `actionItems.md` or `supabase/.temp/linked-project.json`. Prettier does not parse `.sql`, so SQL files get no format check.

### Verified by the Manager (run once, read-only)

1. `pnpm --filter web exec vitest run src/lib/mock-tests.test.ts src/lib/mock-test-options.parity.test.ts`: 2 files, 55 tests passed. (Run from `apps/web`, `pnpm exec vitest run` with the same two files.)
2. `pnpm --filter aj-classes-e2e test:unit` (`node --test "src/**/*.test.ts"`, Node 24.15): 6 pass, 0 fail. Node is above the `>=22.18` in the root `engines`, so the glob form works.
3. `pnpm format:check` (repo-wide, dry run): fails only on `actionItems.md` (untracked, Saurabh's) and `supabase/.temp/*` (Supabase CLI local files). **Accepted by ruling** (same rule as 2026-11-17 L-4). Every slice uses scoped checks instead.
4. `pnpm exec prettier --check apps/web/src/constants/mock-tests.constants.ts apps/web/src/lib/mock-tests.ts apps/web/src/lib/mock-tests.test.ts`: all formatted.
5. `pnpm --filter web exec eslint src/lib/mock-tests.ts src/constants/mock-tests.constants.ts`: clean.
6. `node supabase/scripts/test-deploy-order.mjs`: "All checks passed", exit 0.
7. Source ranges the migration copies (checked against the file text): `mock_submit` is `20261119100000_mock_test_closing.sql` lines 405 to 453; `mock_tests_for_me` is `20261120100000_mock_test_categories.sql` lines 302 to 341 (`drop` at 300); `mock_test_open` is `20261120100000_mock_test_categories.sql` lines 344 to 424. The applied migrations are `20261118100000`, `20261119100000`, `20261120100000`. The new file `20261121100000` sorts after all three; no later migration exists.
8. ADR: `docs/decisions/0012-mock-tests-own-tables-rpc-only-taker-access.md` has "Amendment 3 (2026-11-18)".
9. Wording sweep, grep of `apps/web/src` and `e2e/tests` for the old "N of M correct" wording. Hits: `constants/mock-tests.constants.ts:260` (`MOCK_RESULT.score`); `components/portal/MockTestResult.tsx:1` (comment); `components/portal/MockTestResult.test.tsx:41-43`; `lib/mock-tests.test.ts:162-163`; `routes/portal/mock-tests.test.tsx:120` and `:146` (the design also cites `:135`, which the grep did not match; the Developer re-greps); `routes/portal/mock-test.test.tsx:195`; `e2e/tests/mock-tests.spec.ts:213` and `:246`; `e2e/tests/mock-tests.selectors.ts:64`. Pgtap `supabase/tests/database/mock_tests_taker.test.sql:80` is not re-grepped here; the design and review-2 cite it.
10. `supabase/tests/database/open_sign_up_access.test.sql`: the pinned function array is lines 84 to 98; the mock entries sit at 91 to 94.

**Not run by the Manager (not run here):** every `db:*` command (local database; the Developer or Dev Lead runs them once), `pnpm typecheck` (it runs `react-router typegen`, which writes generated files), `pnpm build`, the e2e smoke and CSP runs, and `pnpm db:types` (rewrites `database.types.ts`). Each is named in the slice that uses it.

### Order note (dependencies)

1. **Slice 1 is one commit with the pinned pgTAP changes it breaks** (categories 74 to 77, taker 80, 115, 153 to 157, 175 to 177, the open-signup array). Without them the existing suites go red, so the migration is never committed alone.
2. **The wording constant changes with its unit pins, in slice 5, not in the last slice.** `mockScoreText` in `lib/mock-tests.ts` needs the new `MOCK_RESULT.score`, so the old-wording pins in `lib/mock-tests.test.ts`, `MockTestResult.test.tsx`, `routes/portal/mock-tests.test.tsx` and `mock-test.test.tsx` move in the same commit. Slice 9 is the rest of the sweep (e2e, selectors, scope test) and the final grep. This keeps every slice green. It differs from the order in the request ("the existing-test wording sweep" last) for that reason only.
3. **Slice 4 (constants and types) lands before slice 5 (services and helpers)**, because slice 5 imports from it.
4. **Slices 6, 7 and 8 run in parallel** in three separate `git worktree`s after slice 5 is merged. They touch disjoint component and route files. The lead owns the shared files (listed below) and merges them once.
5. **Two-session race (slice 2).** The must-pass gate for the pass-mark freeze (03 section 9, Arch 4). It runs once the migration is applied locally.

---

## Shared files (the lead keeps these; no specialist edits them in a worktree)

- `apps/web/src/constants/mock-tests.constants.ts` (all new strings; `MOCK_TEST_LIMITS.passMarkMin/Max`; `MOCK_RESULT`)
- `apps/web/src/constants/routes.constants.ts`, `apps/web/src/constants/portal.constants.ts` (`adminMockTestResults`, `adminMockTestResultsPath`, `PORTAL_SEO.adminMockTestResults`)
- `apps/web/src/services/types.ts` and `apps/web/src/services/index.ts`
- `apps/web/src/services/database.types.ts` (regenerated by `pnpm db:types`, local DB only)
- `apps/web/src/routes.ts` (one `route(...)` line, added with slice 8)
- `apps/web/src/components/portal/index.ts` (exports `MockPassChip` and `MockResultsTable`)
- `apps/web/src/lib/mock-tests-scope.test.ts` (`TAG_NAMES`, slice 9)

---

## Slice 1: migration and the pinned pgTAP changes (one commit)

- [x] **1.1** Create `supabase/migrations/20261121100000_mock_test_scoring.sql` from `03-design.md` section 1.3, **after the review-3 fixes are in** (see Re-sync). Copy each replaced body from its source range (Verified item 7). Re-grep each range first. `private.check_mock_test()` is `create or replace` and keeps `security invoker` (not definer), with `search_path ''`, the locked re-read and the `pass_mark` line.
- [x] **1.2** Pinned pgTAP changes, as design section 2.1 lists them:
  - `mock_tests_categories.test.sql` lines 74 to 77: the UPDATE column pin gains `pass_mark`; the name gains "and the pass mark".
  - `mock_tests_taker.test.sql` line 116: question keys while in progress gain `marks`; the regex on line 113 gains `\|marks_earned` (reviewer's cites; the Developer re-greps).
  - `mock_tests_taker.test.sql` lines 153 to 157: the submit reply gains `percentage` and `passed` (T1 has no pass mark, so `passed` is null); the keys line becomes `array['passed','percentage','score','total']`.
  - `mock_tests_taker.test.sql` lines 175 to 177: submitted question keys gain `marks` and `marks_earned`.
  - `mock_tests_taker.test.sql` line 182: the case named "shows the score" is renamed "shows the marks"; no assertion change (reviewer's cite; the Developer re-greps the name).
  - `open_sign_up_access.test.sql`: `'mock_test_results(uuid)'` joins the pinned list inside the array at lines 84 to 98 (the mock entries at 91 to 94).
- [x] **1.3** Fixtures: none beyond the above. `mock_tests_admin.test.sql` and `mock_tests_closing.test.sql` need no edit (design 2.1); both re-run in full.

- [x] **1.4** **Before-and-after capture for AC 41 and 42** (design 1.5.6), local database only, run by dev-ms, output saved under `docs/delivery/2026-11-18-mock-test-scoring/run-*/` (excluded via `.git/info/exclude`, added at setup; no `.gitignore` rule) and quoted in the TSR:
  1. Before-run: move `supabase/migrations/20261121100000_mock_test_scoring.sql` out of the tree to a scratchpad path (moved, not deleted), because `supabase db reset` applies every file in the tree. Run `pnpm db:reset` and confirm with `supabase migration list --local` that `20261121100000` is absent. Then seed a released test with two questions (superuser, tagged, one with answers) and two attempts, one submitted and one in progress.
  2. Save `select id, score, total, submitted_at from public.mock_test_attempts order by id` to `before.txt`, and `select count(*) filter (where marks = 1), count(*) from public.mock_test_questions` after the migration only.
  3. Restore the file to `supabase/migrations/` and run `supabase migration up` (local only, no `--linked`); confirm with `supabase migration list --local` that it is applied. Save the same attempts query to `after.txt`.
  4. `cmp before.txt after.txt` must exit 0 (byte-identical). The question count must read the same as the question total.
  5. Submit the in-progress attempt (AC 44): its score is its count of correct answers.

**Test that proves it:** the four mock pgTAP files and `open_sign_up_access` green, plus the closing and categories files, in one run.

**Command (not run here):** `pnpm db:reset && pnpm db:test`. Read the failing file list; the `Files=` count is not a pass criterion.

**Owner:** dev-ms (migration and pgTAP). Dev Lead runs the command.

---

## Slice 2: new pgTAP file and the two-session race (must-pass)

- [x] **2.1** Create `supabase/tests/database/mock_tests_scoring.test.sql` with cases 1 to 15 of `03-design.md` section 2.2. Covers: columns and grants; freeze of marks and pass mark (including the same-value write and the withdraw path); helpers, including `(0,0,n)` and the strict nulls; score as a sum of marks; boundaries (100 x 100 and 4 x 100 at pass mark 90); taker shapes; per-question sums; legacy rows; closed tests; the results RPC columns, order and row count; names; the role matrix; taker privacy; ACL pins; attempts and answers with no grant.
- [x] **2.2** **Two-session pass-mark race** (03 section 9, run by the Dev Lead on the local stack with two `psql` sessions as an admin at aal2, one fully tagged draft with `pass_mark` 50):
  - Order A: session 1 begins and calls `mock_release`; session 2 writes `pass_mark = 80` and blocks; session 1 commits. Session 2 **must** fail with `mock_released`, and `pass_mark` stays 50. A success is the failure.
  - Order B: session 1 writes `pass_mark = 80` on a draft and blocks session 2's `mock_release`. Session 2 then releases with 80. A later `pass_mark = 60` is refused.
  - Mirror with a submit: a submit holds the test `for share`; a `pass_mark = 10` write blocks until the submit commits, then is refused with `mock_released`, so the label stays stable across a submit.
  - Paste the raw `psql` output of all three into the test report.
- [x] **2.3** `check_mock_test` is already the locked re-read in the design (`select t.status … for no key update` on `old.id`, per review-3 round 2). It stays `security invoker` with `search_path ''`, not `security definer`: only an admin at aal2 can update `mock_tests`, and RLS lets that admin read and lock the row. If order A still succeeds (the write is not refused), re-check the locked re-read in the migration text first, re-run 2.2, and only then tick. The gate does not pass without the transcript.

**Test that proves it:** `pnpm db:test` green for the new file; the transcript pasted.

**Command (not run here):** `pnpm db:test` (new file and the whole mock set); the psql transcript from `pnpm db:status` for the URL.

**Owner:** dev-ms (pgTAP); Dev Lead (transcript).

---

## Slice 3: local types and migration parity

- [x] **3.1** Run `pnpm db:types` against the local database after slice 1 is applied. Check the diff: `marks` on questions, `pass_mark` on tests, `mock_test_results` and the new return columns of `mock_tests_for_me`, `mock_test_open` and `mock_submit` (no other changes).
- [x] **3.2** Confirm the local migration list ends at `20261121100000` with no file applied out of order.

**Owner:** dev-lead (shared file `database.types.ts`).

---

## Slice 4: constants and additive types (shared files)

Rule for this slice and the next: a required field or a changed signature lands with **all** its producers and callers in the same slice. Where a caller lives in a later slice, the new parameter stays optional until that slice.

- [x] **4.1** `constants/mock-tests.constants.ts`: `MOCK_TEST_LIMITS.passMarkMin/Max` (1 and 100); `MOCK_SCORING` (with `passMarkLine`, the one pass-mark literal); `MOCK_PASS_LABELS`; `MOCK_RESULTS_PAGE` (03 section 4.1, with `viewResults` as the one `Results` literal); `MOCK_RESULT.questionMarks` and `MOCK_RESULT.scoreOnly` (`N of M marks`, used only while the percentage is optional, slice 5); `MOCK_TAKE_PAGE` additions (`marks`, `totalMarks`, `passMark` aliasing `MOCK_SCORING.passMarkLine`); `MOCK_VALIDATION.marks` and `MOCK_VALIDATION.passMark`.
  - `MOCK_RESULT.score` is **not** changed here (slice 5, with its pins).
- [x] **4.2** `constants/routes.constants.ts` and `portal.constants.ts`: `PORTAL_ROUTE_PATTERNS.adminMockTestResults`, `adminMockTestResultsPath(testId)`, `PORTAL_SEO.adminMockTestResults`.
- [x] **4.3** `services/types.ts`, additive only: `MockResultRow` and `MockTestResultsView` (design 3.1). New fields on existing types (`marks`, `passMark`, `percentage`, `passed`, `totalMarks`) are added **optional** (`?`) here, so nothing that builds those types breaks. `MockTestInput.passMark?` stays optional until slice 6. `services/index.ts` exports the new types.
- [x] **4.4** No fixture changes in this slice (optional fields need none).

**Command (not run here):** `pnpm exec prettier --check <touched files>`; `pnpm lint && pnpm typecheck` (must pass with optional fields only).

**Owner:** dev-lead (shared files).

---

## Slice 5: producers, required types, service, helpers, wording pins

Optional-until-later list (each becomes required in the slice named):
- `mockScoreText(score, total, percentage?)`: optional until slice 7 (callers `components/portal/MockTestResult.tsx:34` and `routes/portal/mock-tests.tsx:109`). Without a percentage it prints `MOCK_RESULT.scoreOnly`. The lead makes it required in the slice 7 merge, with 7.4 and 7.5.
- `validateMockTest(input)`: `passMarkText?` optional until slice 6 (caller `components/portal/MockTestDialog.tsx:35`). A field is checked only when present (`undefined` is skipped, so a save is not refused). The lead makes it required in the slice 6 merge.
- `validateMockQuestion(input)`: `marks?` optional until slice 6 (caller `components/portal/MockQuestionDialog.tsx:85`), checked only when present. The lead makes it required in the slice 6 merge.
- `MockTestInput.passMark?` and `MockQuestionInput.marks?` (`services/types.ts`, lead-owned): optional until slice 6. The lead makes both required in the slice 6 merge, when 6.1 and 6.3 send them. The service uses `input.passMark ?? null` until then.

- [x] **5.1** `services/mock-tests-data.ts`: `MOCK_QUESTION_COLUMNS` gains `marks`; `MockListRow` gains `percentage` and `passed`; `MockOpenJson` gains `total_marks`, `pass_mark`, `percentage`, `passed`, per-question `marks` and `marks_earned`; `MockResultRowJson` and `toMockResultRow`; mappers `toMockAdminQuestion`, `toMockTestListItem`, `toMockTakeQuestion` (`marksEarned` only when present) and `toMockTestView` copy the fields. The producers are changed here, so the fields become required here.
- [x] **5.2** `services/mock-tests.service.ts`: `getMockTestForEdit` selects `pass_mark` and `marks` and returns `passMark`; `createMockTest` and `updateMockTest` send `pass_mark: input.passMark ?? null`; `saveMockQuestion` sends `marks`; `submitMockTest` reads the two new keys (code unchanged).
- [x] **5.3** `getMockTestResults(testId)`: admin client check (no request when null, `notAllowed`); header select (`id, title, status, closes_at, pass_mark`, `maybeSingle`; no row is `notFound`); `rpc('mock_test_results', { target })`; `totalRows` from the first row (0 when none); errors through `toErrorKey`. Exported from `services/index.ts`.
- [x] **5.4** `lib/mock-tests.ts`: `mockScoreText(score, total, percentage?)`; `validatePassMarkText`; `passMarkFromText`; `validateMockTest` (`passMarkText?` until slice 6); `validateMockQuestion` (`marks?` until slice 6, same integer check as `lib/questions.ts` lines 34 to 40); `mockResultName`; `mockPassLabel` (null gives `''`); `mockResultsTruncated`.
- [x] **5.5** The wording change with its pins, in the same commit: `MOCK_RESULT.score` becomes `"${score} of ${total} marks (${percentage}%)"`. (a) `lib/mock-tests.test.ts:162-163` calls the three-argument form and expects `'3 of 5 marks (60%)'`. (b) The component and route pins call the two-argument form in slice 5 and expect the marks wording only, `'N of M marks'` with no percentage: `components/portal/MockTestResult.test.tsx:41-43`, `routes/portal/mock-tests.test.tsx:120,146` (re-grep for `:135`), `routes/portal/mock-test.test.tsx:195`. Their percentage versions move to 7.4 and 7.5.
- [x] **5.6** Fixtures for the now-required fields: grep `apps/web/src` for `MockTestView|MockTestListItem|MockAdminQuestion|MockTestDraftView|MockResult|MockQuestionInput|MockTakeQuestion|MockResultRow` and fix every fixture that builds those types (design R-D3). `MockTakeQuestion` was missing from the earlier list.
- [x] **5.7** `services/mock-tests.service.test.ts` (the service test named in design section 7, not covered before): payloads carry `pass_mark` (null clears) and `marks`; `getMockTestResults` cases: no admin client gives `notAllowed` with no request; no header row gives `notFound`; an RPC `not_admin` error maps to `notAllowed`; `totalRows` comes from the first row; zero rows give 0.
- [x] **5.8** New `lib/mock-test-scoring.parity.test.ts` (design section 8, guard):
  - (a) the migration's `marks between 1 and 100` and `pass_mark between 1 and 100` literals equal `QUESTION_LIMITS.marksMin/marksMax` and `MOCK_TEST_LIMITS.passMarkMin/passMarkMax`;
  - (b) exactly one `update public.mock_test_attempts` in the file, inside `mock_submit`; no `insert into`, `delete from`, or `alter table` statement names `public.mock_test_attempts` (AC 41). Other tables' `alter table` lines are allowed.
  - (c) the file does not `create or replace` `mock_release`, `mock_start` or `mock_save_answer`.
- [x] **5.9** Unit tests: `validatePassMarkText` (0, -1, 60.5, 101, "abc" refused; 1, 100, blank accepted); `validateMockQuestion` (blank, 0, -1, 2.5, 101 refused; 1, 100 accepted; an absent `marks` is skipped); `validatePassMarkText` with an absent value is skipped; `mockPassLabel` (null gives `''`); `mockResultName` (null gives the fallback key); `mockScoreText(2, 3, 66)` gives `'2 of 3 marks (66%)'`. The Pass wording is the chip's, tested in 7.6.

**Test that proves it:** the parity test, the service test and the unit tests green; the four pinned files green.

**Command (not run here):** `pnpm --filter web exec vitest run src/lib src/services src/components/portal/MockQuestionDialog.test.tsx src/components/portal/MockTestDialog.test.tsx src/components/portal/MockTestResult.test.tsx src/routes/portal/mock-tests.test.tsx src/routes/portal/mock-test.test.tsx`; `pnpm exec prettier --check <touched files>`; `pnpm lint && pnpm typecheck`.

**Owner:** dev-web (services, helpers, tests). Dev-ms reviews the RPC call shapes against 03 section 1.4.

---

## Slice 6: admin editing (worktree A)

- [x] **6.1** `MockQuestionDialog.tsx`: a Marks `TextField` (copied from `QuestionDialog.tsx` lines 185 to 197: `type="number"`, `min`/`max`/`step` from `QUESTION_LIMITS`, `sx={{ maxWidth: 160 }}`, error and helper from `errors.marks`). Sends `marks: Number(marksText)`. Hidden when the test is not a draft (the list already hides Edit and Add).
- [x] **6.2** `MockQuestionList.tsx`: each card shows its marks (`MOCK_SCORING.marks`); the section header shows the question count and `MOCK_SCORING.totalMarks(sum)` (AC 4).
- [x] **6.3** `MockTestDialog.tsx`: a pass mark `TextField` (`type="number"`, label `MOCK_SCORING.passMarkLabel`, helper `errors.passMark || MOCK_SCORING.passMarkHint`); blank saves null; hidden on a released or closed test, where the value is shown read-only elsewhere (AC 9).
- [x] **6.4** `routes/portal/admin-mock-test.tsx`: a "Scoring" `SectionCard` after Tags (total marks and the pass mark line or "No pass mark", read-only on every status); a Results `Button` (outlined, `component={RouterLink}`) first in the actions of both the draft and released groups.
- [x] **6.5** `routes/portal/admin-mock-tests.tsx`: a final `Results` column on every row (any status) with `aria-label={MOCK_RESULTS_PAGE.viewResultsFor(title)}`. Update the top comment (names and scores live on the Results page only, AC 39).
- [x] **6.6** Tests: `MockQuestionDialog.test.tsx`, `MockTestDialog.test.tsx`, `admin-mock-test.test.tsx`, `admin-mock-tests.test.tsx`. Cover AC 1, 2, 3 (no Marks control on released), 4, 6, 7, 9, 28.

**Test that proves it:** the four test files green; the Results link target is registered in slice 8 (until then the link is a 404 in the browser, which the Tester does not check before slice 8 lands).

**Command (not run here):** `pnpm --filter web exec vitest run src/components/portal/MockQuestionDialog.test.tsx src/components/portal/MockTestDialog.test.tsx src/routes/portal/admin-mock-test.test.tsx src/routes/portal/admin-mock-tests.test.tsx`; `pnpm exec prettier --check <touched files>`; `pnpm lint && pnpm typecheck`.

**Owner:** dev-web (worktree A, owned paths: the files listed in this slice).

---

## Slice 7: taker experience (worktree B)

- [x] **7.1** `MockTestTakeForm.tsx`: "1 mark" or "N marks" under the question heading (AC 10, SC13). No other change.
- [x] **7.2** `routes/portal/mock-test.tsx` (`Intro`): "Total N marks" under the question count; "Pass mark: N%" only when `passMark !== null` (AC 11). No score, answer or result on this page.
- [x] **7.3** `components/portal/MockTestStatusChips.tsx`: `MockPassChip({ passed })`, `Chip size="small" variant="outlined"`, no `color` prop, label from `mockPassLabel` (AC 16: neutral for both words).
- [x] **7.4** `components/portal/MockTestResult.tsx`: heading reads `mockScoreText(score, total, percentage)`; `MockPassChip` when `passed !== null`; each question shows `MOCK_RESULT.questionMarks(marksEarned, marks)` under its title when `marksEarned` is a number (AC 15, 19, 22). Update the comment at line 1 ("N of M correct").
- [x] **7.5** `routes/portal/mock-tests.tsx` (taker list): the submitted line reads `mockScoreText(...)` (guard for `percentage !== null`) plus `MockPassChip` when `passed !== null` (AC 15, 19, 25).
- [x] **7.6** Tests: `MockTestTakeForm.test.tsx`, `MockTestResult.test.tsx` (new cases for marks per question and the chip), `mock-test.test.tsx` (start page), `mock-tests.test.tsx` (list). Cover AC 10, 11, 12 (no score or label before submit), 15, 16, 19, 20 (no label without a pass mark), 22, 24.

**Test that proves it:** the four files green. Real-browser checks (AC 49) are the Tester's, after slice 9.

**Command (not run here):** `pnpm --filter web exec vitest run src/components/portal/MockTestTakeForm.test.tsx src/components/portal/MockTestResult.test.tsx src/routes/portal/mock-test.test.tsx src/routes/portal/mock-tests.test.tsx`; `pnpm exec prettier --check <touched files>`; `pnpm lint && pnpm typecheck`.

**Owner:** dev-web (worktree B, owned paths: the files listed in this slice).

---

## Slice 8: admin Results page (worktree C)

- [x] **8.1** `components/portal/MockResultsTable.tsx` (+ `.test.tsx`): props `{ rows: MockResultRow[] }`; five header cells in order: Name (`mockResultName`), Submitted (`formatDateTime`), Score (`MOCK_RESULTS_PAGE.score`), Percentage (`MOCK_RESULTS_PAGE.percent`), Result (`mockPassLabel`, empty when null). `key={row.attemptId}`. `aria-label={MOCK_RESULTS_PAGE.tableLabel}`. No write control, no e-mail, no answer (AC 35).
- [x] **8.2** `routes/portal/admin-mock-test-results.tsx` (+ `.test.tsx`): `meta` from `PORTAL_SEO.adminMockTestResults`; `clientLoader` calls `getMockTestResults(params.testId ?? '')`; `ErrorBoundary` renders the existing `MockTestsErrorBoundary` (AC 46); the default export renders the page states of design 6.3 (loading, load failed, empty, rows, more than 1000). The header shows the closed chip and the pass mark line when set (extras, cost nothing).
- [x] **8.3** `routes.ts` (lead): one `route(PORTAL_ROUTE_PATTERNS.adminMockTestResults, 'routes/portal/admin-mock-test-results.tsx')` inside the admin layout, after `adminMockTest`.
- [x] **8.4** `routes/portal/mock-tests-load-error.test.tsx`: add the Results page to its table of pages (AC 46).
- [x] **8.5** Tests: empty state shows exactly "No one has submitted this test yet." with no table; rows show five headers in order; "Showing 2 of 1500 submissions. The oldest are not listed." when rows are fewer than `totalRows`, and no note when equal; `notFound` shows `NotFoundPanel`; a non-admin is stopped by the layout (E or M, slice 9).

**Test that proves it:** the new test files and `mock-tests-load-error.test.tsx` green.

**Command (not run here):** `pnpm --filter web exec vitest run src/components/portal/MockResultsTable.test.tsx src/routes/portal/admin-mock-test-results.test.tsx src/routes/portal/mock-tests-load-error.test.tsx`; `pnpm exec prettier --check <touched files>`; `pnpm lint && pnpm typecheck`.

**Owner:** dev-web (worktree C, owned paths). Dev Lead merges `routes.ts` and `components/portal/index.ts` once.

---

## Slice 9: the rest of the wording sweep, e2e, and the scope test

- [x] **9.1** `e2e/tests/mock-tests.selectors.ts:64`: the score text becomes `${score} of ${total} marks`. `e2e/tests/mock-tests.spec.ts:213` and `:246`: `'1 of 2 correct'` becomes `'1 of 2 marks (50%)'`.
- [x] **9.2** One new e2e case in `e2e/tests/mock-tests.spec.ts`, titled "scores marks and a pass mark end to end", run with `pnpm --filter aj-classes-e2e exec playwright test tests/mock-tests.spec.ts -g "scores marks and a pass mark end to end"` (the filter is the file plus the title; run from the e2e package). Scenario: an admin creates a test with a question worth 3 and a pass mark of 60, plus a second question worth 2, tags it and releases it; a student answers only the 3-mark question and submits; the card and result read "3 of 5 marks (60%)" with "Pass"; the admin opens Results from the list and sees the student's name and the row (AC 15, 19, 28, 29).
- [x] **9.3** `lib/mock-tests-scope.test.ts`: add `MOCK_SCORING`, `MOCK_RESULTS_PAGE`, `MOCK_PASS_LABELS`, `MockResultsTable` and `MockPassChip` to `TAG_NAMES`; confirm no new name appears in `routes.ts`'s sitemap source or the e-mail templates (AC 50).
- [x] **9.4** Final grep, as a proof row (not a fix): `grep -rn "of [^ ]* correct" apps/web/src e2e/tests`. The only allowed hits are "Option X is correct" (`online-assignments.constants.ts:95`, `mock-tests.selectors.ts:13`) and "aren’t answered yet and will count as incorrect" (`MockTestTakeForm.test.tsx:173`), which are not score wording.

**Test that proves it:** the e2e mock spec green on the local stack; the scope test green.

**Command (not run here):** `pnpm --filter aj-classes-e2e exec playwright test tests/mock-tests.spec.ts` (mock spec only, local stack and web up); `pnpm --filter aj-classes-e2e test:csp`; `pnpm --filter web exec vitest run src/lib/mock-tests-scope.test.ts`; `pnpm lint && pnpm typecheck`.

**Owner:** dev-web (e2e and scope test); Dev Lead runs the e2e stack.

---

## Full check (the definition of the gate)

Run in this order, each step explicitly. The root `pnpm check` runs repo-wide `format:check`, which fails only on the two accepted unrelated files, so each step is run on its own.

1. `pnpm exec prettier --check <every touched non-SQL file>` (scoped; never `--write` on the two unrelated files).
2. `pnpm db:reset && pnpm db:test` (all four mock pgTAP files, `open_sign_up_access`, the closing and categories files; the new file's cases 1 to 15).
3. The two-session transcript (slice 2.2), pasted into the test report.
4. `pnpm lint`
5. `pnpm typecheck`
6. `pnpm test` (web vitest, e2e `test:unit`, `test-deploy-order.mjs`)
7. `pnpm build`
8. `pnpm --filter aj-classes-e2e test:smoke` and `test:csp` (local stack).
9. `pnpm db:types` run once more; `git diff --stat` shows only the expected generated lines.

Every number in the report comes from a script or from raw output; the team lead re-verifies before relaying.

---

## Verification by the test team (after slice 9, before the merge)

- **tester-ui** (real browser, Chrome via Playwright, localhost, 375 px and 1280 px, light and dark): marks on the editor and the question page; the pass mark on create, edit and read-only released; start page totals; result and list wording with the chip; the Results page table and its states; the 1000-row note with a seeded set; keyboard walk of new controls (AC 48); tutor, parent, student and user each open the Results URL and see the existing not-allowed page (AC 37). Each role is its own check.
- **tester-api**: the role matrix (AC 36, 37); the boundary rows (AC 14, 18, 21); the no-e-mail and no-answer checks on the results RPC payload; legacy rows (AC 40 to 45) by the byte-identical recipe in design 1.5.6.
- **reviewer** (pinned SHA via `git archive`): each replaced function body diffed against its source range (Verified item 7); the migration header and guard text against the attempts-write rule.
- **security**: grants and privilege pins (service_role keeps EXECUTE through default privileges, L-10, stated not revoked); `marks` and `pass_mark` column grants; name and e-mail exposure on the results RPC; `06-security` finding 4 stays open until the Privacy Policy line is approved.
- **test-manager**: the TSR with recount by script. Any row still PARTIAL or carried makes the verdict ESCALATED, not APPROVED.

---

## Deploy order (team-lead release step after the gate, not a plan item)

Recorded under S-1 (Saurabh, 2026-11-18: "yes apply db changes and yes admins can see all data"): the hosted `db push` is approved (L-11 is closed), and L-6 (admins see names and scores) is approved. The hosted database is also production's (L-7), so the order below still holds.

1. Gate green on the branch (full check and TSR).
2. `git grep` on `main` for `mock_` in `apps/web/src` returns nothing (L-7).
3. Pending hosted migrations are exactly `20261119100000` and `20261120100000` (if not yet applied) and `20261121100000`, in that order. Anything else stops the step.
4. Apply with `supabase db push` to the linked project. **Not** `supabase/scripts/deploy.sh` (it also pushes config and auth settings).
5. Merge to `develop` and push, only after step 4. A staging build older than the migration calls a dropped signature.
6. Staging check by Saurabh. Staging is admin-only at aal2 (L-6, AC 36).
7. Merge to `main` only after the Privacy Policy line "admins can see your name and mock test scores" is approved (L-6). That is the only gate before `main`.

**Rollback.** The migration is additive and stays. Roll forward, not back.

---

## Re-sync after review-3 (closed)

Closed against the final `03-design.md` (commit `317f670`, review-3 APPROVED at round 3):

1. **Attempts write.** Done. The header and note 1.5.1 say `mock_submit` keeps its one write while `submitted_at is null`. Guard (b) allows exactly one update inside `mock_submit`. Slice 5.6(b) tests it.
2. **Pass-mark race.** Done. `check_mock_test` judges on a locked re-read (`for no key update` on `old.id`) and stays `security invoker` with `search_path ''`, not definer. Slices 1.1 and 2.3 follow it. The two-session case stays the must-pass gate.
3. **Comment and array lines.** Done. The open-signup array is at 84 to 98, mock entries at 91 to 94; the `MockTestResult.tsx:1` comment is in slice 5.4.
4. **Service-role EXECUTE.** Done. Stated: it keeps EXECUTE through default privileges (L-10), not revoked.
5. **`total > 0` in `mock_passed`.** Done. `(0,0,50)` false is pinned in slice 2.
6. **Decimal pass mark.** Done. R-D4 and decision 9 name the 60.5 to 61 rounding; the web refuses decimals.
7. **Practice note.** Done. No note added (L-9); wording alone covers R-S6.
8. **AC 47 lint.** Done. The scope grep in slice 9.4 covers `jsx-no-literals` with `ignoreProps: true`.
9. **Duplicate literals.** Done. One `Results` literal (`MOCK_RESULTS_PAGE.viewResults`); one pass-mark line (`MOCK_SCORING.passMarkLine`, aliased in `MOCK_TAKE_PAGE`). Slice 4.1 follows it.

---

## AC to slice map

Every AC in `01-requirement.md` has a slice. The proofs are in `03-design.md` section 8.

| ACs | Slice (proof) |
|---|---|
| 1, 3, 9 | 1 (constraints and freeze), 2 (pgTAP), 6.1, 6.3 (controls hidden) |
| 2, 7 | 5.9 (validation), 6.1, 6.3 (field messages) |
| 4 | 6.2 (total marks on the edit view) |
| 5 | 2 (release with questions, no pass mark; zero questions still refused) |
| 6 | 2 (insert and update), 6.3 |
| 8 | 2 (no label on a test without a pass mark), 7.3 (chip renders nothing on null) |
| 10, 11 | 7.1, 7.2 |
| 12 | 2 (taker shapes before submit), 7.6 |
| 13 | 2 (score is a sum of marks) |
| 14, 18, 21 | 2 (helper table and boundaries), 5.9 |
| 15, 19, 20 | 5.5, 7.4, 7.5, e2e (9.2) |
| 16 | 7.3 (neutral chips), no grade words (9.4) |
| 17 | 2 (a released test has total above zero, via `mock_no_questions`) |
| 22 | 7.4 |
| 23 | 2 (per-question sum equals score) |
| 24 | 2 (repeat submit identical) |
| 25, 26, 27 | 2 (closed-test rules), 7.5 |
| 28, 29, 30, 31, 32, 33, 34, 35 | 8.1, 8.2, 6.5 (list link), 2 (results RPC: columns, rows, order, names) |
| 36, 37 | 2 (role matrix), 8.2 (page gate), test team (each role checked by the Tester) |
| 38, 39 | 2 (taker privacy), 6.5 and 5.8 (admin list shows no name or score) |
| 40 to 45 | 1.4 (before-and-after capture), 2 (legacy cases) |
| 46 | 8.2, 8.4 (error boundary and load-error page) |
| 47 | 9.4 (grep; `react/jsx-no-literals` with `ignoreProps: true`), lint |
| 48, 49 | test team (keyboard walk, 375 and 1280 px, light and dark) |
| 50 | 9.3 (scope test), 5.8 |

Named ACs, as the review asked: AC 5 (slice 2), AC 8 (slice 2, 7.3), AC 17 (slice 2), AC 37 (slice 8.2 and the test team's role checks), AC 47 (9.4).

## Risks

1. **Pass-mark race unproven** until slice 2.2 runs (R-A3, R-D2). Gate.
2. **Three live functions replaced.** `mock_submit` (categories file is not a source; source is closing `20261119100000` 405 to 453), `mock_tests_for_me` (drop and create; source `20261120100000` 302 to 341), `mock_test_open` (source `20261120100000` 344 to 424). A wrong source silently regresses closing (S-1) or categories. Mitigation: the closing and categories pgTAP re-run in slice 1; the Reviewer diffs each body.
3. **Parity guard vs the real migration.** The final design's guard (b) allows exactly one update inside `mock_submit`; slice 5.6 tests that.
4. **Shared hosted database** (R-A2, L-7). The migration reaches production's database at the staging release. Hosted pending set must be exact (deploy step 3). Migration depends on closing and categories being applied first.
5. **Existing pins break by design** (categories 74 to 77; taker 80, 115, 153 to 157, 175 to 177; open-signup array). Expected; fixed in slice 1.
6. **Smallint products.** `pass_mark * total` and `score * 100` overflow in smallint. Every call site casts to `int` (design 1.5.3, R-S7). Reviewer greps the migration for any smallint multiplication without `::int`.
7. **Decimal pass mark** is refused in the web only; a direct write of 60.5 stores 61 (design decision 9). Acceptable: only admins can write, and the value stays in 1 to 100.
8. **1000-row ceiling** on the results RPC (R-A4, R-D7). Never silent (`total_rows` drives the note). No pagination in v1.
9. **Names beside scores** (R-S1, R-D6). Admin-only at aal2 on staging (L-6). Production waits for the Privacy Policy approval.
10. **Wording "1 of 1 marks"** reads oddly (R-D5). Accepted by L-4.
11. **Pass and Not yet read as a certificate** (R-S6). Plain wording, no grade or colour (AC 16, L-9). No practice note added.
12. **Repo-wide format check** fails on two unrelated files; accepted by ruling (same rule as 2026-11-17 L-4). Scoped checks in every slice.
13. **Design final.** This plan is synced to `03-design.md` at `317f670` (review-3 APPROVED, round 3).

---

## Deferred (named, not built)

From `01-requirement.md`, "Deferred":

- **D-S1** Results export (CSV), part of 2026-11-17 D-B7.
- **D-S2** Individual answers for admins (which option each person chose), 2026-11-17 D-B7 and privacy. Stays deferred under S-1.
- **D-S3** Changing a score, regrading or resetting a submitted attempt (SC11).
- **D-S4** Changing marks or the pass mark after release, with recalculated labels. Needs a snapshot on the attempt first (02 section 2.2).
- **D-S5** More than one pass level (distinction, credit) and letter grades.
- **D-S6** Results to a student's parent (2026-11-17 D-B1). Parents see their own attempts only.
- **D-S7** Results or pass alerts by e-mail (2026-11-17 D-B9).
- **D-S8** Admin results filter by subject, stream or year (2026-11-18 D-C3).
- **D-S9** Mobile results (2026-11-17 D-B10).
- **D-S10** Retake and best-score rules (2026-11-17 D-B5).
- **D-S11** Tutor access to results (L-2: no for now; widen on request).

Nothing is silently dropped. The 01 decisions list is Q1 to Q8 (not D-S numbers), so the IDs do not collide (review-1 finding 2).

---

## Definition of done

1. All 50 ACs have a proof (the AC to slice map and `03-design.md` section 8), run on the final build; the Tester's real-browser rows at 375 and 1280 px, light and dark, are in the TSR.
2. The full check is green on the branch. The two-session transcript (2.2) and the before-and-after capture (1.4, byte-identical) are pasted into the TSR.
3. The re-sync list is closed at `317f670`. Re-check only if the design changes again.
4. Reviewer verdict APPROVED on the final diff (SHA pinned); security findings closed or accepted in writing; each replaced function body diffed against its source range.
5. The TSR is APPROVED by the test manager with no PARTIAL or carried rows (otherwise ESCALATED, put to Saurabh).
6. The decisions-log entry for R-S2 (the move of D-B6 into v1, the amendment of M9 and 2026-11-17 AC 32, the names decision) and the ADR decisions DEC-MS-1 to DEC-MS-7 are written by the Team Lead when the feature ships.
7. Commits by the Team Lead only, with explicit paths. Unrelated untracked files stay unstaged: `actionItems.md`, `brand/email/`, `docs/contracts/`, `docs/requirements/seo-audit-2026-11-14.md`, `supabase/.temp/`. Check `git show --stat HEAD` after each commit.
8. The hosted `db push` of `20261121100000` is approved (S-1, closing L-11); the Team Lead applies it after the gate and before the merge to `develop`. Admins seeing names and scores is approved (S-1, L-6). The Privacy Policy line still gates `main` (L-6).

## Decisions

Recorded (S-1, Saurabh, 2026-11-18, verbatim: "yes apply db changes and yes admins can see all data"):
1. **Hosted migration** `20261121100000`: approved (L-11 closed). The Team Lead applies it after the gate and before the merge to `develop`.
2. **L-6:** admins see names and scores, approved. The Privacy Policy line still gates `main`.
3. **Deferred under S-1:** individual answers stay deferred. In `01-requirement.md` that is D-S2 (the coordinator's note called it D-S3, but D-S3 there is changing a score).

Ruled, no action needed:
4. **Repo-wide format check** fails only on the untracked `actionItems.md` and `supabase/.temp/*`. Accepted (2026-11-17 L-4 rule). Scoped checks in every slice.
5. **Rounding, labels, wording** unchanged (L-4, L-9).

---

## Next steps (ordered by what unblocks the most)

1. Slice 1 (dev-ms): migration, pinned pgTAP, and the before-and-after capture (1.4), one commit.
2. Slice 2 (dev-ms): new pgTAP file; Dev Lead runs the two-session transcript.
3. Slices 4 and 5 (dev-lead, then dev-web), each typechecking on its own.
4. Slices 6, 7 and 8 in three worktrees, then slice 9 and the full check.
5. Test team (tester-ui, tester-api, reviewer, security, TSR).
6. Release step: apply the migration (S-1), merge to `develop`, the staging check, then the Privacy Policy line before `main`.
