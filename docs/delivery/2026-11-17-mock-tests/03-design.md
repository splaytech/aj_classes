# 03 — Design: mock tests (v1)

Stage 3 (Solution Designer). Date 2026-11-18. Branch `feature/mock-tests`. Inputs: `01-requirement.md` (44 ACs), `02-architecture.md` (DEC-MT-1 to 6), ADR-0012, `review-2.md`, lead rulings L-1 (takers: student, parent, user; tutors excluded), L-2 (prompt limit 2000), L-3 (any admin edits and releases). Landing in parallel and treated as decided: admins also get `delete` on `mock_tests` and `mock_test_questions`; `created_by` is not in the insert grant (defaults to `auth.uid()`); `status` defaults to `draft`.

Design only. Nothing here was run. Mobile is unchanged. No new dependency, service or cost.

## 0. Four clarifications to the architecture (Developer please read)

These keep DEC-MT-1 to 6 intact but make them buildable. None reverses a decision.

1. **Question triggers lock the test row `for update`, not `for share`** (02 said `for share`). `for share` locks are compatible with each other, so two admins adding question 100 at once would both pass the count check. `for update` serialises question writes per test and still serialises them against `mock_release` (which also takes `for update`). It is the same pattern as `private.check_assignment_question` (`20261007090320_student_parent_portal.sql:437-468`).
2. **Reorder is a function, `mock_move_question(target, step)`**, not "one admin write of all positions" (02). Each PostgREST call is its own transaction, so a client-side swap would hit the unique key. The function swaps two rows in one statement, exactly like `public.move_question` (defined at `20261007090321_family_functions.sql:740-778`, through its closing `$$;`). The unique key is `deferrable initially immediate` like assignments (checked at statement end), so no deferred constraint is needed and `position` needs no column grant at all (the trigger sets it on insert).
3. **Admin list "last changed"**: the question trigger also sets `mock_tests.updated_at` on every question change, so the list shows real activity, not only title edits.
4. **Admin navigation** is the Admin dashboard shortcut tile (like Posts, Emails, Users: the admin nav bar has one "Admin" link), not a top-bar item. Students, parents and users get a top-bar item (M15).

## 1. Component map

| Component | Responsibility |
|---|---|
| Migration `20261118100000_mock_tests.sql` | 4 tables, constraints, freeze/lock triggers, grants, RLS (admin only on 2 tables), 9 `public` functions, 2 private helpers |
| `services/mock-tests.service.ts` (+ `mock-tests-data.ts` mappers, types in `types.ts`) | Only place that calls Supabase for mock tests; returns `Result<T>`; maps database errors to `ErrorKey` |
| `lib/mock-tests.ts` | Pure helpers: form validation, area paths, unanswered count, score text |
| `constants/mock-tests.constants.ts` + edits to routes/portal/error constants | All text, limits, paths (no magic strings, lint-enforced) |
| Admin route pair `admin-mock-tests.tsx`, `admin-mock-test.tsx` | List + create; edit/release/take-back/delete |
| Taker route pair `mock-tests.tsx`, `mock-test.tsx` | One implementation mounted under student, parent and user layouts (route `id` option) |
| Components `MockTest*` in `components/portal/` | Dialogs, question list, take form, result, error boundary, home link card |
| Database = the real gate | Layout guards only choose what to show |

## 2. Migration

### 2.1 Name and timestamp

`supabase/migrations/20261118100000_mock_tests.sql`. Checked: newest migration on every local branch and worktree (`feature/invite-14-days`, `feature/privacy-job-applicants`, `.worktrees/seo` and all `git ls-tree` of local branches) is `20261117100000_google_only_sign_up.sql`; nothing parked is later. Depends on the `user` role (`20261114100000_user_role.sql`) and `private.my_active_role()` as last defined at `20261023100000_invite_onboarding.sql:133-143` (requires `is_active and status = 'active'`). Developer re-lists the branches before commit. No existing function, table, policy or enum is replaced, so no copied function body.

### 2.2 Tables (DDL outline)

```
mock_tests
  id            uuid pk default gen_random_uuid()
  title         text not null  check (char_length(btrim(title)) >= 2 and char_length(title) <= 150)
  instructions  text not null default ''  check (char_length(instructions) <= 4000)
  status        text not null default 'draft'  check (status in ('draft','released'))
  created_by    uuid default auth.uid() references public.profiles(id) on delete set null   -- nullable: an admin leaving must not delete tests
  released_by   uuid references public.profiles(id) on delete set null
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()
  released_at   timestamptz
  check ((status = 'released') = (released_at is not null))
  index (status)               -- taker list filters released

mock_test_questions
  id              uuid pk default gen_random_uuid()
  test_id         uuid not null references mock_tests(id) on delete cascade
  position        int  not null default 1 check (position >= 1)      -- trigger puts new questions last
  prompt          text not null check (char_length(trim(prompt)) between 1 and 2000)   -- L-2, same as assignment_questions
  options         text[] not null
  correct_option  smallint not null
  explanation     text not null default '' check (char_length(explanation) <= 2000)
  created_at, updated_at timestamptz not null default now()
  constraint mock_test_questions_position_key unique (test_id, position) deferrable initially immediate
  constraint mock_test_questions_shape check (
      cardinality(options) between 2 and 6
      and private.items_within_length(options, 300)          -- exists: 20261007090320_student_parent_portal.sql:16
      and correct_option between 0 and cardinality(options) - 1)

mock_test_attempts
  id            uuid pk default gen_random_uuid()
  test_id       uuid not null references mock_tests(id) on delete restrict
  profile_id    uuid not null references public.profiles(id) on delete cascade     -- erasure removes attempts
  started_at    timestamptz not null default now()
  submitted_at  timestamptz
  score         smallint
  total         smallint
  unique (test_id, profile_id)                                  -- one attempt per person per test (M8)
  check ((submitted_at is null) = (score is null) and (score is null) = (total is null)
         and (score is null or score between 0 and total))
  index (profile_id)

mock_test_answers
  attempt_id       uuid not null references mock_test_attempts(id) on delete cascade
  question_id      uuid not null references mock_test_questions(id) on delete cascade
  selected_option  smallint not null check (selected_option >= 0)
  primary key (attempt_id, question_id)
```

`updated_at` on `mock_tests` and `mock_test_questions` uses `private.set_updated_at()` (`20261006004522_staff_accounts.sql:219`) as a before-update trigger. Marks are implicit 1 each (M9); no marks column. Comments on each table, as the repo does.

### 2.3 Triggers (private functions, `security definer`, `set search_path = ''`)

1. `private.check_mock_test()`: before `update or delete` on `mock_tests`.
   - Delete when `old.status = 'released'`: `raise exception 'mock_released'`.
   - Update when `old.status = 'released'` and `title` or `instructions` differ: `mock_released`. (Status moves only inside `mock_release` / `mock_withdraw`, which leave both columns alone, so they pass.)
2. `private.check_mock_question()`: before `insert or update or delete` on `mock_test_questions`.
   - `select status from mock_tests where id = <test_id> for update`. Not found (parent deleted by cascade): return old, nothing left to protect.
   - `status <> 'draft'`: `mock_released`.
   - Update that changes `test_id`: `invalid_input`.
   - Insert: if the test already has 100 questions: `mock_too_many_questions`; else `position := coalesce(max(position),0)+1`.
   - Insert/update/delete (not the cascade case): `update mock_tests set updated_at = now() where id = <test_id>`.
3. Attempts and answers need no triggers: only functions write them.

Both trigger functions: `revoke execute ... from public, anon, authenticated` (repo pattern, e.g. `20261114100100_open_sign_up.sql:80`).

### 2.4 Grants and RLS

```
revoke all on mock_tests, mock_test_questions, mock_test_attempts, mock_test_answers from anon, authenticated;

grant select, delete on mock_tests, mock_test_questions to authenticated;               -- delete is drafts-only via the freeze triggers
grant insert (title, instructions), update (title, instructions) on mock_tests to authenticated;   -- NOT created_by, status, released_*
grant insert (test_id, prompt, options, correct_option, explanation),
      update (prompt, options, correct_option, explanation) on mock_test_questions to authenticated;  -- NOT position

alter table (all four) enable row level security;
policies, only on mock_tests and mock_test_questions, to authenticated, one per command (select/insert/update/delete):
    using / with check ((select private.is_admin()))       -- active admin at aal2
attempts and answers: RLS on, NO policy, no grant.
```

`created_by` fills from `auth.uid()` and `status` from `'draft'` through column defaults, which apply even without an insert grant. `private.is_admin()` already has execute for `authenticated` (`20261007090320_student_parent_portal.sql:748-757`).

### 2.5 Private helpers (execute revoked from public, anon, authenticated)

- `private.can_take_mock_tests() returns boolean`, stable: `coalesce(private.my_active_role() in ('parent','user'), false) or private.my_student_id() is not null`. Students go through `private.my_student_id()` (`20261023100000_invite_onboarding.sql:146-160`: active profile, role student, and `students.is_active`), so an inactive student row with an active profile is refused (AC 6). Tutor, admin, invited, deactivated and anonymous are all false (L-1).
- `private.require_mock_taker() returns uuid`: if not `can_take_mock_tests()` raise `'not_taker'` (errcode `42501`); return `auth.uid()`. Same shape as `private.require_student` (`20261007090321_family_functions.sql:51-66`).

### 2.6 Public functions

All: `language plpgsql`, `security definer`, `set search_path = ''`; then `revoke execute ... from public, anon, authenticated; grant execute ... to authenticated;` (pattern `20261114100100_open_sign_up.sql:727-730`). Errors are `raise exception '<key>'` (message = key; the web mapper matches the message). `not_admin` and `not_taker` use errcode `42501`; `not_found` uses `P0002`.

Taker functions never return `correct_option` or `explanation` except as stated.

| # | Function | Returns | Behaviour | Errors |
|---|---|---|---|---|
| 1 | `mock_tests_for_me()` stable | `table(id uuid, title text, question_count int, status text, score int, total int, submitted_at timestamptz, released_at timestamptz)`; `status` is `not_started \| in_progress \| submitted`; `score/total/submitted_at` null unless submitted; order `released_at desc, id`; released tests only (filtered inside) | `require_mock_taker()` first | `not_taker` |
| 2 | `mock_test_open(target uuid)` stable | `jsonb`: `{id, title, instructions, status, question_count, score, total, submitted_at, questions:[…]}`. `not_started`: `questions` is `[]`. `in_progress`: each `{id, position, prompt, options[], selected_option (int or null)}`, no other keys. `submitted`: same plus `correct_option` and `explanation` | taker only; test must be released | `not_taker`, `not_found` |
| 3 | `mock_start(target uuid)` volatile | `void`, idempotent | `select … from mock_tests where id=target for share`; not released → `not_found`; `insert into mock_test_attempts … on conflict (test_id, profile_id) do nothing`. A submitted person calling it changes nothing (AC 34); a double tap returns the same attempt | `not_taker`, `not_found` |
| 4 | `mock_save_answer(target_test uuid, target_question uuid, chosen_option int)` | `void` | lock own attempt `for update`; none → `mock_not_started`; submitted → `already_submitted`; question not in this test → `invalid_question`; option null, <0 or ≥ `cardinality(options)` → `invalid_option`; upsert `(attempt_id, question_id)` | `not_taker`, `not_found`, `mock_not_started`, `already_submitted`, `invalid_question`, `invalid_option` |
| 5 | `mock_submit(target uuid)` | `jsonb {score, total}` | lock own attempt `for update`; none → `mock_not_started`; already submitted → return stored `{score,total}` (no change, AC 31); else `total = count(questions)`, `score = count(answers where selected_option = correct_option)`, unanswered = incorrect; set `submitted_at = now()`, `score`, `total` | `not_taker`, `mock_not_started` |
| 6 | `mock_tests_admin_list()` stable | `table(id, title, status, question_count int, submitted_count int, created_by_name text, created_at, updated_at, released_at)`; `submitted_count` = attempts with `submitted_at` set, regardless of the person's active state; no taker names, answers or scores (AC 24); only the creator's name; order `updated_at desc, id` | first line `if not private.is_admin() then raise 'not_admin'` | `not_admin` |
| 7 | `mock_release(target uuid)` | `void` | is_admin; `for update` on the test; none → `not_found`; status not `draft` → `invalid_status`; zero questions → `mock_no_questions`; set `status='released'`, `released_at=now()`, `released_by=auth.uid()` | `not_admin`, `not_found`, `invalid_status`, `mock_no_questions` |
| 8 | `mock_withdraw(target uuid)` | `void` | is_admin; `for update`; status not `released` → `invalid_status`; any attempt (any state) → `mock_has_attempts`; set `status='draft'`, `released_at=null`, `released_by=null` | `not_admin`, `not_found`, `invalid_status`, `mock_has_attempts` |
| 9 | `mock_move_question(target uuid, step int)` | `void` | is_admin; `step` not ±1 → `invalid_input`; lock the test `for update`; find neighbour; swap the two positions in one `update` (mirror `move_question`); released test is refused by the question trigger (`mock_released`) | `not_admin`, `not_found`, `invalid_input`, `mock_released` |

Concurrency (DEC-MT-4, verified against this design): `mock_start` holds the test row `for share` through its insert; `mock_withdraw` holds it `for update` and then checks attempts in a fresh statement, so a start and a withdraw cannot both win. `mock_save_answer` and `mock_submit` lock the same attempt row, so a save cannot land after a submit.

Position gaps: question delete leaves gaps; `mock_move_question` swaps with the nearest lower/higher position, an end move is a no-op, and the UI numbers questions by order, not by stored position.

Not built in v1: audit-log rows (assignments have none either), admin preview (D-B11), per-person results (D-B7).

### 2.7 Migration order inside the file

Tables → indexes/comments → trigger functions and triggers → helpers → public functions → `revoke`/`grant` → RLS enable and policies. Revokes on the four tables come before any grant.

## 3. Service API (`apps/web/src/services/mock-tests.service.ts`)

Every function is `attempt(async () => …)` returning `Result<T>`; components never see Supabase. Exported through `services/index.ts`. Admin calls use `getSupabase()`; taker calls use `getSupabase()` too (not `getFamilyClient`, which is student/parent only; the database is the role gate for `user`).

Types (added to `services/types.ts`):

```ts
type MockTakeStatus = 'not_started' | 'in_progress' | 'submitted';          // in constants as MOCK_TAKE_STATUSES
type MockTestStatus = 'draft' | 'released';

type MockTestSummary = {            // admin list row (mock_tests_admin_list)
  id: string; title: string; status: MockTestStatus; questionCount: number; submittedCount: number;
  createdByName: string | null; createdAt: string; updatedAt: string; releasedAt: string | null;
};
type MockTestInput = { title: string; instructions: string };               // trimmed by the service
type MockQuestionInput = { id?: string; testId: string; prompt: string; options: string[];
                           correctOption: number | null; explanation: string };
type MockAdminQuestion = { id: string; position: number; prompt: string; options: string[];
                           correctOption: number; explanation: string };
type MockTestDraftView = { id: string; title: string; instructions: string; status: MockTestStatus;
                           questions: MockAdminQuestion[] };               // admin edit page

type MockTestListItem = { id: string; title: string; questionCount: number; status: MockTakeStatus;
                          score: number | null; total: number | null; submittedAt: string | null };
type MockTakeQuestion = { id: string; position: number; prompt: string; options: string[];
                          selectedOption: number | null;
                          correctOption?: number; explanation?: string };  // last two only when submitted
type MockTestView = { id: string; title: string; instructions: string; status: MockTakeStatus;
                      questionCount: number; score: number | null; total: number | null;
                      questions: MockTakeQuestion[] };
type MockResult = { score: number; total: number };
```

| Function | Call | Result |
|---|---|---|
| `listMockTestsAdmin()` | rpc `mock_tests_admin_list` | `Result<MockTestSummary[]>` |
| `getMockTestForEdit(id)` | select `mock_tests` `.eq(id).maybeSingle()` + select `mock_test_questions` `.eq(test_id).order(position)` | `Result<MockTestDraftView>`; no row → `notFound` |
| `createMockTest(input)` | insert `{title, instructions}` `.select('id').single()` | `Result<{ id: string }>` |
| `updateMockTest(id, input)` | update title, instructions, `.select('id').maybeSingle()`; no row → `notAllowed` | `Result` |
| `deleteMockTest(id)` | delete `.select('id').maybeSingle()`; no row → `notAllowed` | `Result` |
| `releaseMockTest(id)` / `withdrawMockTest(id)` | rpc `mock_release` / `mock_withdraw` | `Result` |
| `saveMockQuestion(input)` | insert (testId, prompt, options, correct_option, explanation) or update by id; trims; no row → `notAllowed` | `Result` |
| `deleteMockQuestion(id)` | delete | `Result` |
| `moveMockQuestion(id, step)` | rpc `mock_move_question` | `Result` |
| `listMyMockTests()` | rpc `mock_tests_for_me` | `Result<MockTestListItem[]>` |
| `getMyMockTest(id)` | rpc `mock_test_open` | `Result<MockTestView>`; `notFound` shows `NotFoundPanel` |
| `startMockTest(id)` | rpc `mock_start` | `Result` |
| `saveMockAnswer(testId, questionId, option)` | rpc `mock_save_answer` | `Result` |
| `submitMockTest(id)` | rpc `mock_submit` | `Result<MockResult>` |

### 3.1 Error mapping

Add to `ERROR_KEYS_BY_OWN_KEY` in `services/auth-errors.ts` (matches on the raised message; existing mappings kept) and to `PORTAL_ERRORS` in `constants/error.constants.ts` (so `ErrorKey` grows automatically).

| Raised | Where | ErrorKey | Text (new, in `PORTAL_ERRORS`) |
|---|---|---|---|
| `not_admin`, `not_taker`, SQLSTATE `42501` | any | `notAllowed` (existing) | existing |
| `not_found` / `P0002` | open, start, save, release … | `notFound` (existing) | existing |
| `invalid_status` | release, withdraw | `invalidStatus` (existing) | existing text is assignment wording: change to neutral "That status change isn't allowed." only if the Developer finds no assignment test pinning it; otherwise add `mockInvalidStatus` |
| `already_submitted` | save | `alreadySubmitted` (existing) | existing says "work"; same rule as above |
| `invalid_option`, `invalid_input`, SQLSTATE `23514` | save, question insert | `invalidInput` (existing) | existing |
| `invalid_question` | save | `notFound` (existing mapping in `auth-errors.ts`) | existing |
| `mock_released` | any edit/move/delete of a released test | `mockReleased` (new) | "A released mock test can't be changed. Take it back to draft first, if no one has started it." |
| `mock_no_questions` | release | `mockNoQuestions` (new) | "Add at least one question before releasing." |
| `mock_has_attempts` | withdraw | `mockHasAttempts` (new) | "Someone has already started this mock test, so it can't go back to draft." |
| `mock_too_many_questions` | question insert | `mockTooManyQuestions` (new) | "A mock test can have up to 100 questions." (built from `MOCK_TEST_LIMITS.questionsMax`) |
| `mock_not_started` | save, submit | `mockNotStarted` (new) | "Start the mock test first." |
| SQLSTATE `23505` | (unique) | `duplicate` (existing) | existing |

Field-level messages (AC 14) come from client validation before any call (`lib/mock-tests.ts`); the database check constraint is the backstop and maps to `invalidInput`.

## 4. Web: routes, pages, components, navigation

### 4.1 Paths (`constants/routes.constants.ts`)

```
PORTAL_ROUTES.adminMockTests   '/portal/admin/mock-tests'
PORTAL_ROUTES.studentMockTests '/portal/student/mock-tests'
PORTAL_ROUTES.parentMockTests  '/portal/parent/mock-tests'
PORTAL_ROUTES.userMockTests    '/portal/user/mock-tests'
PORTAL_ROUTE_PATTERNS.adminMockTest   '/portal/admin/mock-tests/:testId'
PORTAL_ROUTE_PATTERNS.studentMockTest '/portal/student/mock-tests/:testId'   (parent, user likewise)
helpers: adminMockTestPath(id), mockTestPath(area, id)
type MockTakerArea = 'student' | 'parent' | 'user'
```

### 4.2 `routes.ts`

- Inside `admin-layout`: `route(adminMockTests, 'routes/portal/admin-mock-tests.tsx')`, `route(adminMockTest pattern, 'routes/portal/admin-mock-test.tsx')`.
- Inside each of `student-layout`, `parent-layout`, `user-layout`: `route(<area>MockTests, 'routes/portal/mock-tests.tsx', { id: 'mock-tests-<area>' })` and `route(<area>MockTest pattern, 'routes/portal/mock-test.tsx', { id: 'mock-test-<area>' })`. Same file, three mounts: React Router needs the unique `id`. The page learns its area from the path (`mockTestAreaFromPath`, pure and unit-tested) for back links and item links.
- Existing `portal-access.ts` needs no change: the layouts already guard `student`, `parent`, `user`, `admin`; a tutor on any of these paths gets `forbidden` (AC 1, 7).

### 4.3 Route modules (each: `meta()`, `clientLoader`, default page, **its own `export function ErrorBoundary()`** rendering `MockTestsErrorBoundary`, per CLAUDE.md and AC 39; the portal-root boundary stays as the outer net)

| File | Loader | Page |
|---|---|---|
| `admin-mock-tests.tsx` (new) | `listMockTestsAdmin()` | PageHeader; "New mock test" button opens `MockTestDialog`; table of tests (title linking to edit, status chip, questions, submitted, created by, last changed); empty state; on create success navigate to the edit page |
| `admin-mock-test.tsx` (new) | `getMockTestForEdit(params.testId)` | Header (title, status chip, back). Draft: edit title/instructions (dialog), `MockQuestionList` with add/edit/delete/move, **Release** (disabled with hint when 0 questions; confirm dialog states students, parents and signed-up users can take it free of cost), **Delete draft** (confirm). Released: read-only view (questions and correct options visible), **Take back to draft** (confirm; refusal shows `mockHasAttempts`). No edit controls rendered when released |
| `mock-tests.tsx` (new, 3 mounts) | `listMyMockTests()` | PageHeader; cards: title, "N questions", chip (Not started / In progress / Submitted), score "N of M correct" when submitted, link to the test; empty state "No mock tests yet." Refreshes on page load only (M19). No price or upgrade wording |
| `mock-test.tsx` (new, 3 mounts) | `getMyMockTest(params.testId)` | `not_started`: title, instructions, question count, **Start** (`startMockTest` then revalidate). `in_progress`: `MockTestTakeForm`. `submitted`: `MockTestResult`. `notFound`: `NotFoundPanel`; other errors: `LoadError` |

### 4.4 Components (new, `components/portal/`, exported from `index.ts` where shared)

- `MockTestDialog.tsx`: title + instructions via `FormDialog`; uses `validateMockTest`. Create and edit.
- `MockQuestionDialog.tsx`: prompt, 2–6 options with a "correct" radio, explanation; uses `validateMockQuestion`. Adapted from `QuestionDialog.tsx` (lines 60-160: option rows, correct radio) without kind or marks. Copy, do not refactor `QuestionDialog` (assignments untouched, R-6).
- `MockQuestionList.tsx`: numbered questions, correct option marked, edit/delete/up/down (up/down call `moveMockQuestion`), "N of 100" count, add disabled at 100.
- `MockTestTakeForm.tsx`: one question per screen ("Question 3 of 20"), options as a labelled `RadioGroup` (a `fieldset` + legend = the prompt; AC 43), Previous/Next always enabled, "Answered x of N" summary, **Submit** opens `ConfirmDialog` whose text includes the unanswered count when > 0 (AC 30). Autosave on choose via the existing `useAnswerAutosave` hook (`lib/use-answer-autosave.ts`; called with option changes only), chosen option stays on screen on failure with the plain error (AC 28). On submit success: revalidate to show the result.
- `MockTestResult.tsx`: "N of M correct"; per question the prompt, the person's choice, the correct option and the explanation (if non-empty). Shown only for `submitted` (the data does not contain keys before that).
- `MockTestsErrorBoundary.tsx`: heading, plain text (no raw error), **Try again** button (reloads the route via `useRevalidator`/`navigate(0)`); connection-failure wording as in `portal-root.tsx:ErrorBoundary`.
- `MockTestsLinkCard.tsx`: a small card "Mock tests: free practice tests" with a `ButtonLink` to the area's list; added to `student-home.tsx`, `parent-home.tsx`, `user-home.tsx` (AC 8: the list is reachable from each home and nowhere else).

### 4.5 Navigation entries

- `PortalLayout.tsx`: `NavItem.notUnder` becomes `readonly string[]` so the home link is not also active on the mock-tests pages. Student: `[My work (notUnder timetable and mock tests), Timetable, Mock tests, Account]`; parent: `[My children (notUnder mock tests), Mock tests, Account]`; user: `[Latest news (notUnder mock tests), Mock tests, Account]`. Tutor and admin top bars unchanged.
- Admin: `SHORTCUTS` in `admin-dashboard.tsx` gets `{ key: 'mockTests', to: PORTAL_ROUTES.adminMockTests }`, label in `ADMIN_DASHBOARD.shortcuts`.
- The existing test `PortalLayout.test.tsx` ("shows only Latest news, Account and Sign out", AC-22 of sign-up) must be rewritten to the new user nav: it is a deliberate supersede, noted in the test comment. `user-home.test.tsx` and the user-home header comment ("More ... opens up for users later") are updated.

## 5. Constants (`apps/web/src/constants/`)

New file `mock-tests.constants.ts`, exported from `constants/index.ts`:

- `MOCK_TEST_LIMITS = { titleMin: 2, titleMax: 150, instructionsMax: 4000, questionsMax: 100 }`. Prompt, option and explanation limits reuse `QUESTION_LIMITS` (2000, 2–6, 300, 2000) so they cannot drift from the assignment rules the product says they match.
- `MOCK_TEST_STATUSES = ['draft','released']`, `MOCK_TEST_STATUS_LABELS` (Draft, Released); `MOCK_TAKE_STATUSES = ['not_started','in_progress','submitted']`, `MOCK_TAKE_STATUS_LABELS` (Not started, In progress, Submitted).
- `MOCK_TESTS_ADMIN_PAGE`, `MOCK_TEST_EDIT_PAGE` (release/take-back/delete confirmations, hints), `MOCK_TEST_DIALOG`, `MOCK_QUESTION_DIALOG`, `MOCK_TESTS_LIST` (taker list and empty state), `MOCK_TAKE_PAGE` (intro, start, question counter, submit confirmation with `unansweredText(n)`), `MOCK_RESULT` (score text builder, "Your answer", "Correct answer", "Explanation"), `MOCK_TESTS_ERROR_BOUNDARY`, `MOCK_TESTS_LINK_CARD`, `MOCK_VALIDATION` (field messages: title length, prompt length, options count/length, correct option, explanation, instructions).
- Wording rule (AC 41): the feature is "mock test"; "test" alone is not used. No "$", "price", "pay", "upgrade", "subscribe" in any of these (a unit test scans them, AC 9).

Edits to existing constants:
- `routes.constants.ts`: paths and helpers (4.1).
- `portal.constants.ts`: `PORTAL_COMMON.nav.mockTests: 'Mock tests'`; `PORTAL_SEO` keys `adminMockTests`, `adminMockTest`, `mockTests`, `mockTest`; `ADMIN_DASHBOARD.shortcuts.mockTests`.
- `error.constants.ts`: five new `PORTAL_ERRORS` keys (3.1).

## 6. `lib/mock-tests.ts` (pure, unit-tested)

`validateMockTest(input)` (title trimmed 2–150, instructions ≤ 4000), `validateMockQuestion(input)` (prompt 1–2000, 2–6 options of 1–300, correct index in range, explanation ≤ 2000; returns field errors like `lib/questions.ts`), `mockTestAreaFromPath(pathname): MockTakerArea`, `unansweredCount(questions, answers)`, `mockScoreText(score, total)`.

## 7. Files to touch

| File | New / changed |
|---|---|
| `supabase/migrations/20261118100000_mock_tests.sql` | new |
| `supabase/tests/database/mock_tests_admin.test.sql` | new |
| `supabase/tests/database/mock_tests_taker.test.sql` | new |
| `apps/web/src/services/database.types.ts` | changed (regenerate with `npm run db:types` on the local database only) |
| `apps/web/src/services/mock-tests.service.ts`, `mock-tests-data.ts` | new |
| `apps/web/src/services/mock-tests.service.test.ts` | new |
| `apps/web/src/services/types.ts` | changed (types in 3) |
| `apps/web/src/services/index.ts` | changed (exports) |
| `apps/web/src/services/auth-errors.ts` | changed (6 own keys); `auth-errors.test.ts` changed (mock keys) |
| `apps/web/src/constants/mock-tests.constants.ts` | new |
| `apps/web/src/constants/index.ts`, `routes.constants.ts`, `portal.constants.ts`, `error.constants.ts` | changed |
| `apps/web/src/lib/mock-tests.ts`, `lib/mock-tests.test.ts` | new |
| `apps/web/src/routes.ts` | changed (8 route entries: 2 admin + 2 in each of 3 taker layouts) |
| `apps/web/src/routes/portal/admin-mock-tests.tsx`, `admin-mock-test.tsx`, `mock-tests.tsx`, `mock-test.tsx` + a co-located `*.test.tsx` each | new |
| `apps/web/src/components/portal/MockTestDialog.tsx`, `MockQuestionDialog.tsx`, `MockQuestionList.tsx`, `MockTestTakeForm.tsx`, `MockTestResult.tsx`, `MockTestsErrorBoundary.tsx`, `MockTestsLinkCard.tsx` + co-located `*.test.tsx` for the take form, result, question dialog, error boundary | new |
| `apps/web/src/components/portal/index.ts` | changed |
| `apps/web/src/components/portal/PortalLayout.tsx`, `PortalLayout.test.tsx` | changed (nav, `notUnder` array; test rewritten) |
| `apps/web/src/routes/portal/admin-dashboard.tsx` | changed (shortcut) |
| `apps/web/src/routes/portal/student-home.tsx`, `parent-home.tsx`, `user-home.tsx`, `user-home.test.tsx` | changed (link card; comment) |
| `e2e/tests/mock-tests.spec.ts` (+ `mock-tests.selectors.ts`) | new |
| `docs/decisions/0012-…md` | Architect's file; set to Accepted at stage sign-off, not here |

Not touched: assignment tables, functions and UI; the mobile repo; edge functions; `supabase/config.toml`; public site, sitemap, e-mail outbox; Privacy Policy text (Saurabh's approval, R-1).

## 8. Test approach per AC

Layers: **P** = pgTAP, **V** = vitest (co-located), **E** = Playwright e2e in `e2e/tests`, **M** = manual by Tester in the real browser (Chrome, local Supabase). Accounts: admin (aal2), second admin, tutor, student with no class, student with class, parent, finished user, unfinished (`invited`) user, deactivated student/parent/user, anon.

| AC | Layer | What proves it |
|---|---|---|
| 1 | P, V, E | Admin selects; tutor and parent get `42501`/no rows and `mock_tests_admin_list` raises `not_admin`; route guard shows forbidden for tutor/parent; admin opens page |
| 2 | P, V, E | Two admins each see the other's drafts; list renders all rows |
| 3 | P, M | Student list returns released only; direct `select` on all four tables denied; draft id on `mock_test_open` gives `not_found` |
| 4 | P, M | Same for finished user and parent |
| 5 | P, M | Invited user: every taker function raises `not_taker`; held on finish step (existing guard, re-checked in browser) |
| 6 | P, M | Deactivated student/parent/user: `not_taker`; also an active profile with `students.is_active = false`: `not_taker`; signed out as today |
| 7 | P | Tutor, anon, admin-as-taker (`not_taker`), and a sweep of direct selects/inserts on the four tables as every non-admin role |
| 8 | V, M | Nav per role (tutor none, admin shortcut only, student/parent/user yes); link card on three homes only |
| 9 | V, M | Scan of mock constants for price words; page walk |
| 10 | P | Student with no enrolment and a `user` with no student row can list, start and submit |
| 11 | P, V, E | Title 1/151/blank/padding refused; instructions 4001 refused; new row is `draft`; `created_by = auth.uid()`; inserting `created_by` or `status` gives `42501` |
| 12 | P, V | Shape check (1 or 7 options, no/two keys impossible by type, out-of-range key, 301-char option, 2001-char prompt, 2001 explanation) |
| 13 | P, V | 100th question accepted, 101st `mock_too_many_questions`; add/edit/delete; `mock_move_question` swaps; concurrency is not provable in single-session pgTAP: Tester runs a two-session check (two `psql` sessions, local only): two adds at 99 questions (one must fail), a question add during `mock_release`, and `mock_start` racing `mock_withdraw` (never both succeed). Covers ACs 13, 19, 21 |
| 14 | P, V | Constraint `23514`; field messages from `validateMockQuestion` |
| 15 | P | Second admin updates first admin's draft; last write wins |
| 16 | P, V | Draft delete cascades its questions; released delete raises `mock_released`; confirm dialog |
| 17 | P, V | Release with zero questions `mock_no_questions`; button disabled with hint |
| 18 | P, V, M | Release flips status, sets `released_at/by`; takers see it on next load; confirmation wording |
| 19 | P, V | On released: title update, question insert/update/delete/move all `mock_released`; direct `update … set status` `42501`; controls absent in UI |
| 20 | P, V | Withdraw with no attempt returns to draft (nulls release fields), editable again |
| 21 | P, V | Withdraw with any attempt `mock_has_attempts`; message shown, stays released |
| 22 | P | `status` check rejects any third value; no schedule/archive column |
| 23 | P, V | List function columns and counts (incl. submitted count excludes in-progress) |
| 24 | P | Function return columns checked by name: no taker, answer or score columns (creator name allowed); direct selects on attempts/answers denied |
| 25 | P, V | `mock_tests_for_me` statuses not_started/in_progress/submitted with score only when submitted |
| 26 | P, V | Intro data (`not_started`, empty questions); start creates exactly one attempt |
| 27 | P, M | Open after reload shows saved choices; second browser |
| 28 | P, V | Save upserts; option out of range refused; autosave failure keeps the choice (hook mocked) |
| 29 | P, V | Submit with blanks allowed; navigation not forced |
| 30 | V | Confirm text includes unanswered count and "count as incorrect" |
| 31 | P | Second submit returns same score unchanged; save after submit `already_submitted` |
| 32 | P, V | Score correct (mixed answers, blanks = wrong); open after submit includes `correct_option` and `explanation`; result renders "N of M correct" |
| 33 | P, V | `jsonb` keys: no `correct_option`/`explanation` in `mock_tests_for_me`, `mock_test_open` (not_started and in_progress), `mock_start`, `mock_save_answer`, `mock_submit` returns only score/total |
| 34 | P | `mock_start` after submit adds no attempt and leaves it submitted |
| 35 | P | Same as 21 (any attempt blocks withdraw) |
| 36 | P, E | Same assertion as 33 plus Playwright response inspection of the in-progress RPC payload |
| 37 | P | User A cannot read B's answers or score through any function; admin cannot select attempts/answers |
| 38 | P, V | `profile_id = auth.uid()` for every attempt; pages show no other person's name or e-mail |
| 39 | V, M | Each of the four route modules exports `ErrorBoundary`; rendered boundary shows plain text and Try again, no raw error; force a failing load |
| 40 | V + lint | `npm run lint` (no raw JSX text); components import text from constants |
| 41 | V, M | Heading assertions; wording review |
| 42 | P, V, E | Full existing pgTAP, vitest and e2e smoke still green (incl. rewritten `PortalLayout.test.tsx`) |
| 43 | V, M | `getByRole('radiogroup'/'radio')` with names; keyboard walk |
| 44 | M | 375 px and 1280 px, light and dark, by tester-ui |

pgTAP file split: `mock_tests_admin.test.sql` (ACs 1, 2, 11–24 and the freeze/locks) and `mock_tests_taker.test.sql` (ACs 3–7, 10, 25–38). Each starts with `tests.remove_all_accounts()` and rolls back; helper style as `posts.test.sql` and `open_sign_up_access.test.sql`.

## 9. Deploy order

1. Merge to `develop`; CI runs pgTAP, vitest, lint, typecheck, e2e.
2. Staging: apply the migration (additive, no downtime), then the web build. No edge function, no config, no secret, no seed change.
3. Production (Saurabh's go-ahead, devops): migration first, then web. Web before the migration would show pages that error; migration before web is invisible.
4. Before anyone is told: Privacy Policy wording check for stored answers and scores (R-1, Saurabh approves), and confirm the `user` role and finish step are live (M17).
5. Rollback: revert the web build; the migration stays (no one can reach the tables). Dropping the four tables is safe only while no attempts exist.

## 10. Open items (none block the build)

- D-1 (ruled L-1) and D-3 (ruled L-3) are decided; D-2 (reveal after submit) is the team's kept default; Saurabh may overrule any of them. Cheap to flip: D-1 changes `can_take_mock_tests()` and the parent routes; D-2 changes one branch in `mock_test_open`; D-3 adds `created_by = auth.uid()` to the update/delete policies and to `mock_release`/`mock_withdraw`.
- `[TBC: Privacy Policy wording for mock test data – Saurabh]` before release.
- Developer decides, in the service test, whether the two assignment-worded messages (`invalidStatus`, `alreadySubmitted`) are reused or get mock-specific keys (3.1).
