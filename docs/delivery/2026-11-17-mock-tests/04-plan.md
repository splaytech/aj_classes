# 04 — Plan: mock tests (v1)

Stage 4 (Manager) of `/deliver`. Branch `feature/mock-tests`. Date 2026-11-18.
Inputs: `01-requirement.md` (44 ACs), `02-architecture.md` and ADR-0012 (DEC-MT-1 to 6; D-1 and D-3 ruled, D-2 an assumption), `03-design.md` (revision in progress), `review-1.md` to `review-4.md`.

Plan rule: every review-3 finding is treated as fixed exactly as the reviewer states. Those are: students gated by `private.my_student_id()` (inactive student row gives `not_taker`, with a pgTAP case); AC 24 reads "no taker names, answers or scores" (already in 01 line 106); `routes.ts` has 8 entries; prompt check is `char_length(trim(prompt))` between 1 and 2000; a two-session Tester check covers AC 13, 19 and 21; `mock_move_question` picks the nearest position and the UI numbers questions by order. Before S1 starts, the Developer re-checks this plan against the final `03-design.md`.

Not run at plan time: no DB runs, no hosted lookups, no code, no commits. Only this file was written.

## 1. Decisions the build assumes

- [RULED] D-1 parents are in the free group (L-1). Saurabh may overrule. Flip cost: `can_take_mock_tests()` and the parent routes.
- [ASSUMPTION] D-2 correct answers and explanations are shown after submit. Still open for Saurabh. Flip cost: one branch in `mock_test_open`.
- [RULED] D-3 any active admin can edit and release (L-3). Saurabh may overrule. Flip cost: add `created_by = auth.uid()` to the admin write policies and to `mock_release` / `mock_withdraw`.
- Build with these settings. Do not block S1 on them.

## 2. Pre-flight facts (checked at plan time)

- Migration timestamp `20261118100000` is later than the newest, `20261117100000_google_only_sign_up.sql`. Re-list before commit.
- `private.my_student_id()` exists (`20261023100000_invite_onboarding.sql:146`). `private.my_active_role()` exists.
- `supabase/scripts/deploy.sh` has one `PROJECT_REF` (line 26). Its comment (line 30) says one database serves staging and production. It runs `supabase db push` (line 279) before `functions deploy` (296) and `config push` (334). No change to any of these.
- No mock-test file exists yet on the branch. The mock-tests migration, tests, routes and components are all new.

## 3. Ordered checklist of thin slices

Each slice is visible or testable on its own. Do them in order. Items with the same owner and shared files (see §8) are sequential, not parallel.

### S1. Migration: tables, triggers, grants, RLS, admin functions, admin pgTAP (owner: dev-ms)

- [x] S1 done
- Files:
  - `supabase/migrations/20261118100000_mock_tests.sql` (new)
  - `supabase/tests/database/mock_tests_admin.test.sql` (new)
  - `.prettierignore` (changed: add `.worktrees/`, lead ruling L-4). No eslint change: `pnpm lint` runs `eslint .` inside `apps/web`, which never scans the root `.worktrees/`.
- Scope: the four tables; freeze and lock triggers; column-scoped grants; RLS (admin only, on the two draft tables); helpers; admin functions `mock_tests_admin_list`, `mock_release`, `mock_withdraw`, `mock_move_question`. Each admin function starts with the `is_admin()` gate and has execute granted to `authenticated` only. Attempts and answers get no grant and no policy.
- Tests (pgTAP):
  - admin select; tutor and parent denied;
  - AC 15: a second admin's update replaces the first admin's draft (last save wins);
  - create defaults; forbidden columns refused (`created_by`, `status`, `released_*`);
  - whitespace-only prompt and title refused (`char_length(trim(...))`), plus shape and length limits;
  - 100-question cap and 101st refused;
  - cascade delete of a draft; released test refuses every change and delete;
  - release with zero questions refused; take-back allowed with no attempt and refused with any attempt;
  - reorder after deleting question 2 of 1, 2, 3: positions are 1 and 3 (gap kept); moving 1 down swaps it with 3; moving the last question down (or the first up) is a no-op; the UI numbers by order;
  - AC 22: a third `status` value is refused, and no schedule or archive column exists;
  - AC 37 (admin side): an admin cannot select from `mock_test_attempts` or `mock_test_answers`;
  - list columns contain no taker name, answer or score (AC 24).
- ACs covered: 1, 2, 11, 12, 13 (DB side), 14, 15, 16, 17, 18 (release function), 19, 20, 21, 22, 23, 24, 35, 37 (admin side).
- Verify by: `pnpm db:start && pnpm db:reset && pnpm db:test`. Not run at plan time (DB run). Developer runs it on the local stack.
- Visible or testable on its own: yes, through pgTAP alone.

### S2. Migration: taker functions and taker pgTAP (owner: dev-ms)

- [x] S2 done
- Files:
  - `supabase/migrations/20261118100000_mock_tests.sql` (same file, appended)
  - `supabase/tests/database/mock_tests_taker.test.sql` (new)
  - `apps/web/src/services/database.types.ts` (regenerated last, by dev-ms, on the local DB only, with a diff limited to the mock tables)
- Scope: `mock_tests_for_me`, `mock_test_open`, `mock_start`, `mock_save_answer`, `mock_submit`. The gate is `private.can_take_mock_tests()` (03 §2.5): a student passes through `private.my_student_id() is not null`, and a parent or user through `my_active_role()`. Keys and explanations come back only after the caller's own submit.
- Tests (pgTAP):
  - student with no enrolment, student with a class, parent, user: each can list, start and submit (AC 10); each of the four direct selects is denied for each role;
  - tutor, anon, admin-as-taker and unfinished (`invited`) user get `not_taker`;
  - inactive student row with an active profile gets `not_taker` (review-3 finding 1);
  - deactivated student, parent and user get `not_taker`;
  - draft id gives `not_found`;
  - AC 26: start creates exactly one attempt; double start returns the same attempt;
  - AC 34: start after submit adds no attempt and leaves the attempt submitted;
  - AC 38: every attempt has `profile_id = auth.uid()`, and the returned JSON carries no other person's name or e-mail;
  - save refused with no attempt, after submit, on a foreign question and on an out-of-range option;
  - no `correct_option` or `explanation` key in any JSON before submit (list, open, start, save, submit);
  - second submit returns the same score unchanged; score counts blanks as wrong;
  - a person can't read another person's attempt (AC 37, taker side).
- ACs covered: 3, 4, 5, 6, 7, 10, 25, 26, 27 (DB side), 28, 29, 31, 32, 33, 34, 36 (DB side), 37 (taker side), 38.
- Verify by: `pnpm db:reset && pnpm db:test`. Not run at plan time.
- Also: `pnpm db:types` regenerates `database.types.ts`. Check the diff is limited to the mock tables.
- Reviewer gate after S2 (key-leak and role gate are the highest risk, per `02` risk 1).
- Visible or testable on its own: yes, through pgTAP alone.

### S3. Web services, pure helpers, constants, error mapping (owner: dev-web)

- [x] S3 done
- Files:
  - `apps/web/src/services/mock-tests.service.ts`, `mock-tests-data.ts`, `mock-tests.service.test.ts` (new)
  - `apps/web/src/services/types.ts`, `index.ts`, `auth-errors.ts`, `auth-errors.test.ts` (changed)
  - `apps/web/src/lib/mock-tests.ts`, `mock-tests.test.ts` (new)
  - `apps/web/src/constants/mock-tests.constants.ts` (new); `constants/index.ts`, `routes.constants.ts`, `portal.constants.ts`, `error.constants.ts` (changed)
- Scope: one service file is the only place that calls Supabase for mock tests (`Result<T>`). Validation helpers for the test and the question, with field messages. Path helpers. Constants for all wording, limits and labels. A vitest scan of the mock constants for price words.
- Tests (vitest): every service function maps its success and each raised key to the right `ErrorKey`; validation at the boundaries (title 1, 2, 150, 151, blank and whitespace-only; prompt 2000, 2001 and whitespace-only; 1 and 7 options; 300 and 301 characters; explanation 2001; instructions 4001); no price or upgrade word in the mock constants.
- ACs covered: 9 (scan), 11 (client side), 12 (client side), 14 (field messages), 40, 41.
- Verify by: `pnpm --filter web test` (ran at plan time on the current branch: 93 files, 849 tests, all pass; baseline).
- Visible or testable on its own: yes, through unit tests.

### S4. Admin pages: list, create, edit, release, take back, delete (owner: dev-web)

- [x] S4 done
- Files:
  - `apps/web/src/routes/portal/admin-mock-tests.tsx`, `admin-mock-test.tsx`, and a co-located `*.test.tsx` each (new)
  - `apps/web/src/components/portal/MockTestDialog.tsx`, `MockQuestionDialog.tsx`, `MockQuestionList.tsx`, `MockTestsErrorBoundary.tsx` and their co-located tests (new); `components/portal/index.ts` (changed)
  - `apps/web/src/routes.ts` (changed: 2 admin entries inside `admin-layout`)
  - `apps/web/src/routes/portal/admin-dashboard.tsx` (changed: shortcut tile, so the page is reachable)
- Scope: list with title, status chip, question count, submitted count, created by and last changed; create a draft; edit a draft (title, instructions, questions with a "correct" radio, move up and down); release with a confirmation that says students, parents and signed-up users can take it free of cost; take back and delete with confirmation; read-only view when released (no edit controls rendered); each route exports its own `ErrorBoundary`.
- Tests (vitest): list rendering and empty state; create navigates to the edit page; the 100-question cap disables add; release disabled with a hint at zero questions; released view has no edit controls; refusal messages (`mock_released`, `mock_has_attempts`) are shown; the `ErrorBoundary` shows plain text and Try again; keys on every mapped list.
- ACs covered: 1 (UI), 2, 11, 12, 13 (UI), 14, 15, 16, 17, 18 (confirmation wording), 19 (controls absent), 20, 21 (message), 23, 39 (admin route), 40, 43, 44 (partial; full pass is S8).
- Verify by: `pnpm --filter web test`. Browser check by the lead or tester-ui after the slice.
- Visible or testable on its own: yes. An admin can create and release a draft against the local stack.

### S5. Taker pages: list, take, result, link cards, six route entries (owner: dev-web)

- [x] S5 done
- Files:
  - `apps/web/src/routes/portal/mock-tests.tsx`, `mock-test.tsx` and a co-located `*.test.tsx` each (new; each mounted three times with a unique route `id`)
  - `apps/web/src/components/portal/MockTestTakeForm.tsx`, `MockTestResult.tsx`, `MockTestsLinkCard.tsx` and co-located tests (new); `components/portal/index.ts` (changed)
  - `apps/web/src/routes.ts` (changed: 6 taker entries, so 8 with S4)
  - `apps/web/src/routes/portal/student-home.tsx`, `parent-home.tsx`, `user-home.tsx`, `user-home.test.tsx` (changed: link card; the comment that said "more opens later" is updated)
- Scope: one question per screen with "Question n of N"; options as a labelled radio group; Previous and Next always enabled; autosave on choose through the existing `useAnswerAutosave` hook, and the chosen option stays on screen on failure; submit opens a confirmation that gives the unanswered count and says they count as incorrect; result shows "N of M correct" and, per question, the choice, the correct option and the explanation; a not-started test shows title, instructions and a Start button; no price or upgrade text. The taker pages never receive keys before submit.
- Tests (vitest): not-started, in-progress and submitted renderings; choice saves without a save button; failed save keeps the choice and shows a plain message; unanswered count in the confirmation; submit does not navigate away; second submit shows the same result; `mockTestAreaFromPath` for each area; link card present on the three homes only; `ErrorBoundary` per route.
- ACs covered: 3 (UI), 4, 5 (guard), 8, 25, 26, 27 (UI), 28, 29, 30, 31, 32, 33 (UI), 34, 39, 43.
- Verify by: `pnpm --filter web test`.
- Visible or testable on its own: yes. A student, parent or user can take a released test against the local stack.

### S6. Navigation (owner: dev-web)

- [x] S6 done
- Files:
  - `apps/web/src/components/portal/PortalLayout.tsx`, `PortalLayout.test.tsx` (changed: `notUnder` becomes an array; the user nav test is rewritten, and the comment says it supersedes the sign-up AC-22 wording)
- Scope: top-bar "Mock tests" item for student, parent and user; tutor and admin top bars unchanged; home item not active on the mock-test pages.
- Tests (vitest): nav per role (tutor: none; admin: none in the top bar, shortcut only; student, parent, user: yes); active state on the mock-test pages.
- ACs covered: 8 (nav part), 42 (rewritten test kept green).
- Verify by: `pnpm --filter web exec vitest run PortalLayout`. Run once at plan time: 1 file, 1 test passed. (`pnpm --filter web test -- PortalLayout` does not filter: the script is `vitest run`, so it runs all 93 files.)
- Visible or testable on its own: yes.

### S7. End-to-end spec (owner: dev-web writes; tester-ui runs)

- [x] S7 done
- Files:
  - `e2e/tests/mock-tests.spec.ts`, `e2e/tests/mock-tests.selectors.ts` (new)
- Scope: admin creates, adds two questions, releases; a student opens the list, takes and submits; the response for the in-progress payload contains no `correct_option` and no `explanation` (AC 36); a tutor is refused on the admin route.
- Verify by: `pnpm --filter aj-classes-e2e typecheck` (run once at plan time: exit 0). Smoke run: `pnpm --filter aj-classes-e2e test:smoke` on the local stack, as CI does (`.github/workflows/ci.yml:94`). CSP run: `pnpm --filter aj-classes-e2e test:csp` (CI `ci.yml:148`). Neither was run at plan time: `e2e/playwright.config.ts` uses a `globalSetup` (`e2e/setup/global-setup.ts`) that starts the dev server and may touch the stack. The Developer reads it before running any Playwright command.
- Visible or testable on its own: yes, once S1 to S6 are in.

### S8. Final gate: manual and full check (owner: test-manager, tester-ui, tester-api)

- [ ] S8 done
- Checks no automated slice can prove:
  - Two-session concurrency: two sessions adding question 100 at once (AC 13); release against a concurrent add (AC 19); start against a concurrent withdraw (AC 21). Run by a Tester in two sessions (review-3 finding 5).
  - Second browser on the same in-progress attempt shows saved choices (AC 27).
  - Forced failing load shows Try again and no raw error (AC 39).
  - 375 px and 1280 px, light and dark, keyboard walk (AC 43, 44).
  - Invited user held on the finish step; deactivated student, parent and user signed out (AC 5, 6, real browser).
  - Page walk for price words (AC 9) and wording (AC 41).
  - Full regression (AC 42): the full check in §6.
- Verify by: the full check in §6, plus the two-session run.

## 4. Deferred list (from 01, named and not dropped)

- D-B1 Parent view of a child's mock test results, and any link between a parent's attempts and a child.
- D-B2 Pricing and payments (paid tests, subscriptions, a free-for-now flag). Money: Saurabh and Sales.
- D-B3 Non-MCQ questions (written, short answer, file upload, match, ordering).
- D-B4 Timers and time limits.
- D-B5 Retakes and multiple attempts, and best-score rules.
- D-B6 Per-question marks and weighted scoring.
- D-B7 Admin results view (individual answers and scores, CSV export).
- D-B8 Scheduled release dates, archive, and deleting released tests.
- D-B9 Mock test e-mails and reminders.
- D-B10 Mobile app support, including the list and results.
- D-B11 Admin preview (see the test as a student, without an attempt).
- D-B12 Question bank reuse, duplicating a test, importing questions.
- D-B13 Images or media in questions.
- D-B14 Class-specific tests (linking to a class or to assignments).
- D-B15 Public mention on the website, SEO pages and sitemap.
- D-B16 Tutor access to take or see mock tests.

## 5. Risks

1. Key leak by an over-broad function (`02` risk 1). Mitigation: S2 pgTAP asserts no key or explanation before submit, for every taker function, and a Reviewer gate after S2.
2. Role edge cases (inactive student row, parent, unfinished user, tutor). Mitigation: each has a pgTAP case in S2.
3. Lock-based concurrency (AC 13, 19, 21) is not provable by pgTAP. Mitigation: the two-session check in S8. Until it passes, do not claim the cap or the release race is closed.
4. Shared web files (`routes.ts`, `PortalLayout.tsx`, constants index, `portal.constants.ts`, `error.constants.ts`, `auth-errors.ts`) are touched by several slices. Mitigation: one dev-web owner, sequential slices.
5. Repo-wide Prettier baseline is red before this feature. `pnpm format:check` flagged 10 files: 8 under `.worktrees/seo`, the untracked `actionItems.md`, and `supabase/.temp/linked-project.json`. Lead ruling L-4: S1 adds `.worktrees/` to `.prettierignore`. After that, the only allowed `format:check` failures are `actionItems.md` and `supabase/.temp/linked-project.json`, the same exceptions as the open-sign-up TSR row S-1.
6. Privacy (R-1). Stored answers and scores for signed-up users and parents. Saurabh approves Privacy Policy wording before release. Nothing goes to production from this stage.
7. Sign-up dependency (M17, R-2). Signed-up users gain nothing until the `user` role and finish step are live on the release branch.
8. Last save wins between admins (R-5, no lock). Accepted for v1.
9. Unfinished attempts never expire (R-4). Accepted for v1.
10. `database.types.ts` regeneration can pull unrelated diff if the local schema drifted. Mitigation: check the diff is limited to the mock tables before commit.
11. D-2 is unanswered (assumption in §1). Build proceeds on the default.
12. Mobile: `aj_classes_mobile` has no change. The `app_role` enum is unchanged, so the mobile contract holds.
13. One database serves staging and production (`deploy.sh:30`). The migration is live for both the moment `supabase db push` runs, so there is no separate staging trial of it. Mitigation: the §7 gates must all be met before the push.

## 6. Definition of done

Each command below is run on the feature branch, after S8. Record the output in the TSR, not here.

1. `pnpm format:check` (repo-wide): the only failures allowed are `actionItems.md` and `supabase/.temp/linked-project.json` (lead ruling L-4, as in TSR row S-1). Any other failure blocks.
2. `pnpm lint`: clean.
3. `pnpm typecheck` (web and e2e): clean.
4. `pnpm test` (web vitest, e2e unit, deploy-order script): all green.
5. `pnpm build`: green.
6. `pnpm db:reset && pnpm db:test`: every pgTAP file green, including the existing suites (AC 42).
7. `pnpm test:functions`: unchanged, green (no edge function change).
8. `pnpm --filter aj-classes-e2e test:smoke`: green, including `mock-tests.spec.ts`.
9. `pnpm --filter aj-classes-e2e test:csp`: green. No new inline script or style, and no new external host from the mock pages.
10. Deploy-order: `node supabase/scripts/test-deploy-order.mjs`, green (part of `pnpm test`). It confirms `db push` runs before `functions deploy` and `config push`. This feature adds no function and no config change.
11. S8 manual checks, including the two-session concurrency run.
12. Reviewer verdict and security review (S2 and the final diff). Test manager recommends; team lead rules.
13. Privacy wording check (R-1) and the `user` role live check (M17) confirmed by Saurabh before any user-facing release.

Note: the root `pnpm check` chains `format:check` with `&&`, so one failure stops the rest. The five steps above (1 to 5) are therefore run as separate commands. Item 1's two exceptions are the only allowed exceptions, as recorded in the TSR.

## 7. Deploy order

There is one hosted database for staging and production (`supabase/scripts/deploy.sh:26` and `:30`).

1. Merge to `develop` after the full check and CI. CI runs pgTAP, vitest, lint, typecheck and e2e.
2. Gates before any push: Privacy Policy wording (R-1) approved by Saurabh, and the `user` role plus finish step (M17) confirmed live.
3. Run `supabase db push` once (`deploy.sh:279`). Additive, no downtime. It applies to the one database both environments use.
4. Build and deploy the web. Staging web now sees the same migrated data as production, so there is no separate staging trial of the database. Devops owns the push and the deploy, under Saurabh's go-ahead.
5. Rollback: revert the web build. Keep the migration; no one can reach the tables without the web. Dropping the four tables is safe only while no attempts exist.

## 8. Owner areas and files

- **dev-ms (database)**
  - Owns: `supabase/migrations/20261118100000_mock_tests.sql`, `supabase/tests/database/mock_tests_admin.test.sql`, `supabase/tests/database/mock_tests_taker.test.sql`, the regeneration of `apps/web/src/services/database.types.ts`, and `.prettierignore` (the one-line `.worktrees/` change, lead ruling L-4).
  - Must not touch: `supabase/config.toml`, edge functions, the existing migrations, assignment tables and functions, the mobile repo.
- **dev-web (portal)**
  - Owns: `apps/web/src/services/mock-tests*.ts` and `types.ts`, `index.ts`, `auth-errors.ts`; `apps/web/src/lib/mock-tests.ts`; `apps/web/src/constants/mock-tests.constants.ts`, `constants/index.ts`, `routes.constants.ts`, `portal.constants.ts`, `error.constants.ts`; `apps/web/src/routes.ts`; `apps/web/src/routes/portal/admin-mock-test*.tsx`, `mock-test*.tsx`, `admin-dashboard.tsx`, `student-home.tsx`, `parent-home.tsx`, `user-home.tsx` and their tests; `apps/web/src/components/portal/MockTest*.tsx`, `MockQuestion*.tsx`, `MockTestsLinkCard.tsx`, `components/portal/index.ts`, `PortalLayout.tsx` and its test; `e2e/tests/mock-tests*.ts`.
  - Must not touch: `QuestionDialog.tsx` and assignment UI (copy, do not refactor, R-6); `docs/decisions/0012-*` (architect); `01`, `02`, `03` docs; `docs/delivery/*/review-*.md`; Privacy text; sitemap; public pages.
- **Tester roles**: no code. Run the pgTAP, e2e and manual checks; write `TSR.md` and `bugs/` only.
- **Independent checks**: reviewer after S2 and at the end; security on S2 and the final diff. Neither reviews its own output.

Sequencing: S1 → S2 → types regeneration → S3 → S4 → S5 → S6 → S7 → S8. dev-web runs S3 to S7 in order because of the shared files in §5 risk 4. A second dev-web specialist could run in a `git worktree` only if the lead merges the shared files.

## 9. Open items for Saurabh

1. D-2: reveal correct answers and explanations after submit (§1). Build proceeds on the default (yes).
2. Privacy Policy wording for stored answers and scores (R-1), before release.
3. Overrule D-1 or D-3 only if you disagree with L-1 or L-3; both are ruled and built as such.
