# 05 — Dev notes: mock tests (v1)

Stage 5 (Dev Lead) of `/deliver`. Branch `feature/mock-tests`. Date 2026-11-18. Built from `03-design.md` and `04-plan.md` with lead rulings L-1 to L-4 and D-2 (answers revealed after submit). S1 and S2 were built by dev-ms, S3 to S7 by dev-web; the lead verified each slice from the repo and re-ran every check below. S8 (manual gate) belongs to the Test Manager and is not ticked.

## What was built, per slice

| Slice | Commit | What |
|---|---|---|
| S1 | `84d519f` | Migration `20261118100000_mock_tests.sql`: four tables, freeze and lock triggers, column-scoped grants, admin-only RLS on tests and questions, `private.can_take_mock_tests()` and `private.require_mock_taker()`, the nine public functions (the taker ones too: one file). `mock_tests_admin.test.sql`. `.prettierignore` gains `.worktrees/` (L-4). |
| S2 | `9065509` | `mock_tests_taker.test.sql`: role gate per role (incl. inactive student row, invited user, deactivated accounts, tutor, admin-as-taker, anon), key withheld before own submit, scoring, idempotent start and submit, AC 34, 37, 38. |
| types | `536c88c` | `database.types.ts` regenerated from the local database; diff is the mock tables and functions only (plus one line moved for `sign_up_guard_ready`). |
| S3 | `83cf64a` | `mock-tests.service.ts` (only Supabase caller), `mock-tests-data.ts` mappers, types, error mapping, `lib/mock-tests.ts` validation and path helpers, `mock-tests.constants.ts` (incl. a price-word scan test). |
| S4 | `fb2a420` | Admin list and edit pages, dialogs, question list with move up and down, release, take back, delete; admin dashboard tile; each route exports its own ErrorBoundary. |
| S5 | `cf1a961` | Taker list and take page mounted under student, parent and user (unique route ids), one-question-per-screen take form with autosave, submit confirmation with unanswered count, result with correct option and explanation, link card on the three homes. |
| S6 | `b7b145e` | "Mock tests" top-bar item for student, parent and user; `notUnder` is an array; `PortalLayout.test.tsx` rewritten (supersedes sign-up AC-22 user nav). |
| S7 | `7f788a4` | `e2e/tests/mock-tests.spec.ts` and selectors: admin creates, adds two questions, releases; a seeded student takes and submits; in-progress `mock_test_open` payload has no `correct_option` or `explanation`; tutor refused on the admin route. |

## Deviations from 03, with reasons

1. **Prompt check trims tabs and line breaks** (`btrim(prompt, E' \t\r\n')`, raw length at most 2000). `trim()` strips spaces only, so a prompt of only newlines passed. The client validation matches. The title still trims spaces only, as designed.
2. **`open_sign_up_access.test.sql` AC-26 pin** gains the nine mock functions. It is an allowlist of functions `authenticated` may execute and failed without them. Outside dev-ms's owned list; the lead accepted it.
3. **`e2e/tests/open-sign-up.spec.ts`** pinned the user nav as `['Latest news', 'Account']`; now includes "Mock tests". Same deliberate supersede as `PortalLayout.test.tsx` (03 §4.5).
4. **`e2e/src/auth/login.ts`** gains `loginAsSeededMember` (student and tutor sign-in with the shared local seed password); the common steps moved into `submitCredentials`. Needed for S7.
5. **Link card** uses a router button rather than `ButtonLink`, so it navigates inside the app.
6. **`invalidStatus` and `alreadySubmitted`** (03 §3.1 choice): no test pinned the assignment wording, so both texts are now neutral ("That status change isn’t allowed.", "This has already been submitted, so answers can’t change."). No mock-specific keys were added. This also changes the wording assignment pages show.
7. Non-admin direct selects on `mock_tests` and `mock_test_questions` return 0 rows (RLS), not `42501`. Matches 03 §2.4; noted because 03 §8 AC 1 says "42501/no rows".

## Checks run by the lead (2026-11-18, on `7f788a4` plus this docs commit)

Run as separate commands (04-plan §6):

| # | Command | Result |
|---|---|---|
| 1 | `pnpm format:check` | Fails on `actionItems.md` and `supabase/.temp/linked-project.json` only (the two allowed exceptions) |
| 2 | `pnpm lint` | exit 0 |
| 3 | `pnpm typecheck` | exit 0 (web and e2e) |
| 4 | `pnpm test` | exit 0: vitest `Test Files 106 passed (106)`, `Tests 992 passed (992)` (baseline 93 / 849); e2e unit `pass 6, fail 0`; deploy-order script green |
| 5 | `VITE_APP_ENV=production pnpm build` | exit 0 |
| 6 | `pnpm db:reset` then `pnpm db:test` | `Files=23, Tests=1687`, `Result: PASS` |
| 7 | `pnpm test:functions` | exit 0, 0 `NOT OK` |
| 8 | `pnpm --filter aj-classes-e2e test:smoke` | `17 passed` (incl. the 2 mock-test specs) |
| 9 | `pnpm --filter aj-classes-e2e test:csp` | `23 passed`, on a build made as CI makes it (empty Supabase URL and key, placeholder form keys); `check:hosted-ref build/client`: 0 files of 186 |
| 10 | Deploy order (`node supabase/scripts/test-deploy-order.mjs`, inside `pnpm test`) | green |
| — | `pnpm db:types` | regenerated in `536c88c` |

Notes on the runs:
- `test:functions` first failed 17 checks in `test-open-sign-up.mjs` (confirm and resend e-mails). dev-ms showed the same 17 failed without the mock migration. The cause was a stale local auth container: after `pnpm db:stop && pnpm db:start` from this checkout the script printed "All checks passed". Not a code issue.
- `test:csp` refuses a build that contains the hosted project ref, so a build made from the local `.env` cannot be swept. Rebuild with the CI env (ci.yml Lighthouse job) first.
- Lead browser pass (Playwright, local Chrome engine): student, parent and user; home, list and test page; 375 and 1280 px; light and dark. 36 screenshots, no horizontal overflow, no console errors. Test data was inserted locally and removed afterwards.

## Files outside the plan's file list (review-5 #7)

| File | Why |
|---|---|
| `supabase/tests/database/open_sign_up_access.test.sql` | Its AC-26 pin lists every function `authenticated` may execute; the nine mock functions had to be added or it fails. |
| `e2e/src/auth/login.ts` | `loginAsSeededMember` for the S7 student sign-in; shared steps moved into `submitCredentials`. |
| `e2e/tests/open-sign-up.spec.ts` | Pinned the user nav without "Mock tests" (open sign-up AC-22); updated as a deliberate supersede. |
| `apps/web/src/routes/portal/student-home.test.tsx`, `parent-home.test.tsx` | New co-located tests for the link card on those homes (the plan named only `user-home.test.tsx`). |
| `apps/web/src/components/portal/MockTestStatusChips.tsx` | The Draft/Released and Not started/In progress/Submitted chips, shared by the admin and taker pages (not named in 03 §4.4). |
| `docs/decisions/0012-…md` | Fix batch 1: consequences for rulings L-5 and L-6. Fix batch 2: decision 3 reworded (review-6b #2). Both on the team lead's instruction. |
| `apps/web/src/components/portal/Panels.tsx`, `Panels.test.tsx`, `routes/portal/mock-tests-load-error.test.tsx` | Fix batch 2 F-1: optional Try again on `LoadError` (AC 39). Other pages unchanged. |

## For Saurabh's release notes (review-5 #2)

- Two shared error messages were reworded, and the new wording also shows on **assignment** pages: `invalidStatus` is now "That status change isn’t allowed." (was "… for this work.") and `alreadySubmitted` is now "This has already been submitted, so answers can’t change." (was "This work has already been submitted …").

## Fix batch 1 (06-security, review-5, rulings L-5 to L-7)

- **A (security #1, L-5):** `mock_withdraw` now refuses only when an attempt is **submitted**; otherwise it deletes the in-progress attempts (answers cascade) in the same transaction, under the test-row lock. Admin copy says so (`releasedNote`, `confirmTakeBackText`, `mockHasAttempts`). pgTAP: in-progress only → take-back works and the attempt and its answers are gone; a start after the take-back gets `not_found` and creates nothing; submitted → `mock_has_attempts`. ADR-0012 consequences record the L-5 limit and the L-6 accepted risk. The lead also ran a real two-session race on the local DB, both orders: a start during a withdraw waited about 3 s for its commit, then got `not_found` with no attempt; a withdraw during a start waited for its commit, then deleted the in-progress attempt. Test rows were removed afterwards.
- **B (security #3):** `check_mock_question` raises `not_found` (P0002) on insert or update when the test doesn't exist; a cascade delete still passes. pgTAP case added.
- **C (review-5 #3):** `check_mock_test` is now security invoker (it only compares old and new); the freeze cases still pass. `check_mock_question` stays security definer, with a why-comment: it bumps `mock_tests.updated_at`, which admins have no update grant on.
- **D (review-5 #4):** the unreachable `test_id`-change branch is removed (`test_id` has no update grant).
- **E (review-5 #5):** no new text needed. "No row" maps to `notFound`, whose existing text ("We couldn't find that. It may have been removed, or you may not have access.") and the page's `NotFoundPanel` ("This page doesn't exist, or you don't have access to it.") are already neutral. A why-comment was added in `getMockTestForEdit`.
- **F (review-5 #6):** comments now match the open sign-up `01-requirement.md`: AC-21 is the landing on Latest news, AC-22 is the nav. The nav comments cite mock tests M15 and ruling L-7 (not AC 8, which L-7 reads as the home link card).
- No change for review-5 #1 (closed by L-7).

Fix batch 1 checks (lead, separate commands): `format:check` only the two allowed files; `lint` 0; `typecheck` 0; `pnpm test` vitest 106 files / 992 tests, e2e unit 6/6, deploy-order green; `VITE_APP_ENV=production pnpm build` 0; `db:reset` + `db:test` `Files=23, Tests=1693`, PASS; `test:functions` 0 NOT OK; `test:smoke` 17 passed; CI-style build + `test:csp` 23 passed.

## Fix batch 2 (review-5 round 2, Test Manager F-1 and F-2, review-6b #2)

- **Withdraw vs submit race (review-5 R2 #1, blocking):** `mock_submit` and `mock_save_answer` now take the test row `for share` first, then the attempt row, the same order as `mock_start`. If the test is no longer released, they refuse with `not_found` (P0002, already mapped to `notFound`). `mock_withdraw`'s delete keeps `and a.submitted_at is null` as a second guard. Lock-order audit: every function that touches an attempt row (`mock_start`, `mock_save_answer`, `mock_submit`, `mock_withdraw`) takes the test row first. `mock_test_open` and `mock_tests_for_me` take no locks. The question trigger, `mock_release` and `mock_move_question` lock only the test row. No function takes an attempt row before the test row. One edge: deleting a profile cascades to its attempts without the test lock; it could only conflict with a test that the same profile created, and Postgres would abort one side rather than corrupt data.
- pgTAP: after a take-back, `mock_save_answer` and `mock_submit` both get `not_found`.
- **Two-session runs** on the local DB (`race.sh`, psql as `authenticated` with JWT claims: the seeded admin at aal2, `student@local.test`; a released test with one in-progress attempt and one answer; session A holds its transaction 4 s; B starts 1 s later; test rows removed afterwards):

  | Order | Session B result | Returned at | After |
  |---|---|---|---|
  | withdraw holds, submit waits | `ERROR: not_found` | +4.1 s (when A committed) | draft, 0 attempts |
  | submit holds, withdraw waits | `ERROR: mock_has_attempts` | +4.2 s (when A committed) | released, 1 submitted attempt |
  | withdraw holds, save waits | `ERROR: not_found` | +4.1 s | draft, 0 attempts |

- **F-1 (AC 39):** `LoadError` gains an optional `retry` prop that adds a Try again button. It reloads the route with `navigate(0)`, as `MockTestsErrorBoundary` does. The text is `LOAD_ERROR.tryAgain` in `portal.constants.ts`. The prop is used only on the four mock test pages; other pages are unchanged. Vitest: `Panels.test.tsx` (default has no button; retry calls `navigate(0)`) and `mock-tests-load-error.test.tsx` (all four pages show the message and Try again).
- **F-2 (wording after L-5):** strings changed from "started" to "submitted":
  - `PORTAL_ERRORS.mockReleased`: "…Take it back to draft first, if no one has submitted it."
  - Already changed in batch 1: `MOCK_TEST_EDIT_PAGE.releasedNote`, `confirmTakeBackText` and `PORTAL_ERRORS.mockHasAttempts`.
  - Code comments: `withdrawMockTest` in `mock-tests.service.ts`, and the header of `admin-mock-test.tsx` (batch 1).
  - No other user-facing "started" text about take-back remains. "Not started" is the taker status label.
- **review-6b #2:** ADR-0012 decision 3 now says that `authenticated` has a select grant on tests and questions and that the answer key is protected by the admin-only RLS select policy alone. It warns that any taker-facing select policy on `mock_test_questions` would expose `correct_option`. The consequence line is reworded to match. pgTAP pins that `mock_test_questions` has exactly the four admin policies, each gated on `is_admin()`.

Fix batch 2 checks (lead, separate commands): `format:check` only the two allowed files; `lint` 0; `typecheck` 0; `pnpm test` vitest 108 files / 998 tests, e2e unit 6/6, deploy-order green; `VITE_APP_ENV=production pnpm build` 0; `db:reset` (after the migration change) + `db:test` `Files=23, Tests=1697`, PASS (the last two cases are test-only, so they were run without a further reset); `test:functions` 0 NOT OK; `test:smoke` 17 passed; CI-style build + `test:csp` 23 passed.

## Fix batch 3 (ruling L-8)

- **F-6:** `MockTestTakeForm` keeps a second map of what the database holds: it starts from the loaded answers and is updated only when a save succeeds. "Answered x of N" and the submit confirmation count from that map. A choice whose save failed stays on screen (AC 28) but counts as unanswered. If an earlier choice for that question was saved, the question still counts as answered, because the database holds the earlier choice. New vitest case.
- **F-7:** removed the unused `MOCK_TAKE_PAGE.optionsLabel`. The assignments `SOLVE_PAGE.optionsLabel` is a different constant and stays.
- Checks: `lint` 0, `typecheck` 0, `pnpm test` vitest 108 files / 999 tests, e2e unit 6/6, deploy-order green, `VITE_APP_ENV=production pnpm build` 0, `format:check` only the two allowed files. No SQL touched, so pgTAP was not re-run.

## Fix batch 4 (TSR round 1, BUG-1 to BUG-5, ruling L-10)

| Bug | Commit | Fix |
|---|---|---|
| BUG-1 | `2d84344` (lead) | `not_found` now comes back as **HTTP 404**. The mock functions and the question trigger call `private.raise_mock_not_found()`, which uses `raise sqlstate 'PGRST'` with status 404 in the detail and body `{"code":"P0002","message":"not_found"}`. **Why PGRST:** it is the only way to get a 404 while keeping the body the web already maps (code `P0002`, message `not_found`), so no web change was needed. A different SQLSTATE would give a 400 or a misleading 404 class (42P01, 42883) and change the code the web reads. The 11 pgTAP pins move to `PGRST` plus the JSON message. A new case checks the detail says 404. Older migrations are unchanged (deferred, L-10). Checked over HTTP (local PostgREST 14.18, parent@ token): `rpc/mock_test_open` on a draft and on an unknown id → `HTTP 404 {"code":"P0002","details":null,"hint":null,"message":"not_found"}`. |
| BUG-2 | `d7645f7` (dev-web) | Admin loaders use `getAdminClient()`. Taker loaders use the new `getTakerClient()` (`staff-client.ts`: any non-staff role with a profile). Both return `notAllowed` without a request. Lead browser check (dev server): tutor on both admin pages and a user test page, parent on the admin list, admin on a user test page, signed out on both: 0 mock requests and 0 console errors on all 7 loads, and each shows the refusal or the sign-in page. |
| BUG-3 | `1b76b22` (dev-web) | Shared portal MUI theme (`portal-theme.ts`): `MuiButtonBase` `.Mui-focusVisible` gets a 3 px outline in `--color-focus` (falls back to primary), offset 2 px. Applies app-wide (L-10 [ASSUMPTION]). dev-web measured outlined, text, icon and contained buttons in light and dark: 3 px outline. |
| BUG-4, BUG-5 | `b47fc0f` (dev-web) | One commit (same files). Focus: delete question → "Questions" heading; release → page h1; Start → "Question 1" heading; submit → result heading; Next or Previous reaching an end → the other button, so the visible ring stays on a control. Headings get `tabIndex={-1}` only when a ref is passed (`PageHeader`, `SectionCard`). Wrap: `overflow-wrap: anywhere` via `sx` on titles, prompts, options, explanations, instructions, the result and `ConfirmDialog` text. dev-web measured 0 horizontal overflow at 375 and 1280, light and dark, with a 150-character title and a 300-character option (incl. the release and submit dialogs). |

Shared components touched (additive, behaviour unchanged when the new props are absent): `PageHeader.tsx`, `Panels.tsx` (`SectionCard`), `ConfirmDialog.tsx` (wrap), `portal-theme.ts`, `staff-client.ts`.

Fix batch 4 checks (lead, separate commands): `format:check` only the two allowed files; `lint` 0; `typecheck` 0; `pnpm test` vitest 109 files / 1048 tests, e2e unit 6/6, deploy-order green; `VITE_APP_ENV=production pnpm build` 0; `db:reset` + `db:test` `Files=23, Tests=1698`, PASS; `test:functions` 0 NOT OK; `test:smoke` 17 passed; CI-style build + `test:csp` 23 passed.

Not verified by anyone yet: the New question dialog over a long title (BR-1 row), and the result page wrap and focus after a real submit in the browser (vitest only).

## Known gaps (for S8 and later)

1. Two-session concurrency for AC 13 (two adds at 99 questions) and AC 19 (an add during release) is not run: S8, Tester. Start, save and submit against withdraw were run by the lead (fix batches 1 and 2).
2. The e2e covers a seeded student only. The signed-up `user` and parent take flows are covered by pgTAP and vitest, and the lead's browser pass reached their list and intro pages, but not take and submit.
3. The admin pages were not visually checked at 375 px or in dark mode by the lead (two-step sign-in). The admin flow is exercised by the smoke spec at the default size. S8, tester-ui.
4. Keyboard walk (AC 43), forced failing load (AC 39), invited and deactivated accounts in the real browser (AC 5, 6): S8.
5. Privacy Policy wording for stored answers and scores (R-1) and the `user` role live check (M17): Saurabh, before release.
