# 02 — Architecture: mock tests (v1)

Stage 2 (Architect). Date 2026-11-18. Input: approved `01-requirement.md` with lead rulings L-1 (parents, students, users take; tutors don't), L-2 (prompt limit 2000), L-3 (any admin edits and releases; D-3 open). Design only, no code.

## Recommendation

Build mock tests as **new tables** with **server-function-only access for takers** and **server-side marking** (DEC-MT-1 to DEC-MT-4). Web portal only. Additive migration; no existing table, function or policy changes. ADR: `docs/decisions/0012-mock-tests-own-tables-rpc-only-taker-access.md` (Proposed).

## What the repo has today (checked)

- Roles `tutor | admin | student | parent | user` (`20261006004522_staff_accounts.sql`, `20261114100000_user_role.sql`).
- `private.my_active_role()` returns the role only for an active profile with `status = 'active'` (`20261023100000_invite_onboarding.sql:133`). An unfinished `user` (`invited`) gets null, which is exactly the AC 5 rule.
- `private.is_admin()` = active admin AND aal2 session (`20261006004522_staff_accounts.sql:126`). So an admin without the two-step session sees nothing, as for every other admin page.
- Assignment questions: `assignment_questions` with `options text[]`, `correct_option smallint`, shape check (2-6 options, one key) (`20261007090320_student_parent_portal.sql:396-418`). Taker-facing reads are `security definer` functions that withhold the key until returned (`private.assignment_view`, `20261027100000_fair_results.sql:288`); saves and submit are functions (`student_save_answer`, line 391). This is the house pattern; mock tests follow it.
- Assignment access runs through `students.id`, enrolment and class (`assignment_visible_to`, ADR-0007). `user` and `parent` accounts have no student row.
- Web: `apps/web/src/routes.ts` has `admin-layout` (inside `staff-layout`), `student-layout`, `user-layout`, `parent-layout`. Services in `apps/web/src/services/`. Tests under `supabase/tests/database/*.test.sql`.
- `apps/web/src/routes/portal/portal-root.tsx:28` already exports an ErrorBoundary covering every portal route. Each new route still exports its own, as in `apps/web/src/routes/posts.tsx:32`, for AC 39 and a local Try again.
- The mobile app (`../aj_classes_mobile`) is a sibling Flutter repo. It reads assignments through the existing functions.

## Key choice: new tables vs reusing assignments

| | New tables | Assignments + flag |
|---|---|---|
| Fits user/parent | Yes | No (no student row) |
| Touches live code | None | Many functions, RLS, mobile |
| Duplicates MCQ rules | Yes (one check) | No |
| Reversible later | Medium | Medium |

Recommended: **new tables** (DEC-MT-1). Duplicated MCQ shape rules are the accepted cost. A shared question table is a later refactor, not v1.

## Data model (shape, not SQL)

- `mock_tests`: id, title (2-150), instructions (<=4000), status `draft|released`, created_by, created_at, updated_at, released_at, released_by.
- `mock_test_questions`: id, test_id (cascade), position, prompt (1-2000), options `text[]` (2-6, 1-300 each), correct_option (0-based, in range), explanation (<=2000, nullable). Check constraint mirrors assignments. Max 100 per test by trigger. Marks are implicit 1 each.
- `mock_test_attempts`: id, test_id, profile_id (cascade to profile), started_at, submitted_at (null = in progress), score, total. Unique (test_id, profile_id) = one attempt.
- `mock_test_answers`: attempt_id, question_id, selected_option; unique (attempt_id, question_id).
- Parents and users are identified by `profiles.id`. Students are too; no `students.id` is used, so M4 and AC 10 hold with no class or enrolment.

## Access control

| Who | Tests and questions | Attempts and answers |
|---|---|---|
| Admin (active, aal2) | Direct RLS read/write | No access. Counts via admin list function |
| Student, parent, user (active) | No table access; functions only | No table access; own data via functions |
| Tutor, invited user, deactivated, anonymous | Nothing | Nothing |

DEC-MT-2. Mechanics:
1. All four tables have RLS on and `revoke all ... from anon, authenticated` (pattern `20261024120000_posts.sql:18`, and the revoke block in `20261007090320_student_parent_portal.sql`). Admin policies (`private.is_admin()`) exist only on `mock_tests` and `mock_test_questions`, with **column-scoped grants**: select; delete on both tables (drafts only, enforced by the freeze trigger, AC 16); insert and update on title, instructions, and question content columns (prompt, options, correct_option, explanation, position). `created_by` is not in the insert grant: it defaults to `auth.uid()`, and `status` defaults to `draft`. `status`, `created_by`, `released_at` and `released_by` have no grant, so an admin cannot set released with zero questions (AC 17), un-release with attempts (AC 21, 35) or forge the creator. The attempt and answer tables have no grant and no policy. Everything reaches them through functions.
2. Taker functions (`security definer`, `set search_path = ''`, like the existing ones) first check `private.can_take_mock_tests()` = `my_active_role() in ('student','parent','user')`. Tutors fail. Execute is granted to `authenticated` only, revoked from `public` and `anon`.
3. **Every function** (taker and admin): `revoke execute from public, anon`, `grant execute to authenticated` only. Admin functions (`mock_tests_admin_list`, `mock_release`, `mock_withdraw`) start with `if not private.is_admin() then raise` (aal2 included; pattern `20261007090321_family_functions.sql:683`), because security definer skips RLS. Functions (names indicative): `mock_tests_for_me()` (released tests, question count, my status and score), `mock_test_open(test)` (test text, questions with options only, my saved choices; for a submitted attempt it adds correct option and explanation), `mock_start(test)`, `mock_save_answer(test, question, option)`, `mock_submit(test)`, and for admins `mock_tests_admin_list()` (counts, creator name), `mock_release(test)`, `mock_withdraw(test)`.
4. **Answer key rule:** a function returns `correct_option` and `explanation` only when the caller's own attempt has `submitted_at` set. `mock_tests_for_me` never returns them. This answers AC 33 and AC 36. The Tester can prove it by reading the raw RPC JSON before and after submit.
5. Draft invisibility: taker functions filter `status = 'released'` inside the function, not in the client.
6. Admin edit view shows keys by design (M10). Admins can't read attempts or answers (AC 24, 37).
7. A deactivated or invited account is cut at `my_active_role()` on every call, with no cached grant.

## Marking: server side (DEC-MT-3)

`mock_submit` locks the attempt row, compares each saved selection to `correct_option`, counts correct, treats unanswered as incorrect, writes `score` and `total`, sets `submitted_at`, and returns the result. A second call returns the same result without changes (AC 31). `mock_save_answer` is refused after submit and when the question is not in that test. The browser never holds the key before submit. Client marking is rejected because it requires sending the key.

## Lifecycle and concurrency (DEC-MT-4)

- Draft edits are direct admin writes on the granted columns only. `status` changes **only inside `mock_release` and `mock_withdraw`** (no column grant, finding 1). The freeze triggers refuse insert, update or delete on a released test's questions and any title or instructions change on a released test; the two functions never touch those columns, so they pass the freeze naturally.
- Question insert/update/delete triggers take `select ... for share` on the parent test row and check `status = 'draft'`; `mock_release` takes `for update` on the test row. A question committed during release therefore waits or is refused, and the 100-question count is checked under the same lock so concurrent adds cannot overshoot.
- **Reorder (AC 13):** unique `(test_id, position)` is `deferrable initially deferred`, and reorder is one admin write of all positions in a transaction. Chosen over two-step renumbering.
- Taker edge rules: `mock_save_answer` refuses when no attempt exists; `mock_start` returns the existing attempt on a double tap; start and save return no keys; the service maps check-constraint errors to field messages (AC 14).
- `mock_release` refuses zero questions (AC 17). `mock_withdraw` refuses when any attempt exists (AC 21, 35).
- Race: `mock_start` takes `select ... for share` on the test row and re-checks `released`; `mock_withdraw` takes `for update` and checks attempts. A start and a withdraw cannot both win.
- Deleting a draft cascades to its questions. Released tests can't be deleted (trigger).
- Last save wins between admins (R-5, no lock). Cost of a version column is low if Saurabh wants it; not in v1.
- D-3: if Saurabh answers "creator only", add `created_by = auth.uid()` to the admin write policy and release function. Nothing else changes. Cheap either way.

## Web design

- Service `apps/web/src/services/mock-tests.service.ts` is the only place calling Supabase (CLAUDE.md rule: no HTTP in components). It follows the `Result` pattern in `services/result.ts`. Regenerate `database.types.ts`.
- Routes: `admin/mock-tests` (list) and `admin/mock-tests/:id` (edit) inside `admin-layout`; one shared take experience (list, test page) mounted under `student-layout`, `parent-layout`, `user-layout`. One taker component set, three route entries. Route guards are only UX; the real gate is the database.
- Each route file exports its own `ErrorBoundary` (see `routes/posts.tsx:32`; the portal root also has one). Text lives in constants (house rule). Nav item "Mock tests" added to the four area navs.
- Autosave on option choice calls `mock_save_answer`; the chosen option stays on screen on failure (AC 28).

## Risks

1. **Key leak by an over-broad function** (e.g. a future `select *`). Mitigation: pgTAP tests that call each taker function as student, parent, user and assert no `correct_option` or `explanation` key before submit, and that a direct `select` on all four tables as those roles returns nothing or is denied.
2. **Role edge cases.** Parents promoted from `user`, a student whose profile is deactivated, an unfinished user, a tutor. All hang off `my_active_role()`; test each.
3. **Duplicated MCQ rules drift** from assignments. Low; both are check constraints with tests.
4. **Privacy (R-1).** Stored answers and scores for users and parents: Privacy Policy wording is Saurabh's to approve before release. Cascade delete of attempts when a profile is deleted keeps erasure simple.
5. **Migration timing.** Additive, no existing function replaced, so it avoids the re-timestamp issue that hit ADR-0007. It must follow the `user` role migrations (M17), which are already earlier in `supabase/migrations/`.
6. **Orphan in-progress attempts** never expire (R-4). Accepted.
7. **Stale non-aal2 admin session** sees an empty list; normal sign-in sends non-aal2 admins to two-step first (`portal-access.ts:114-136`). Show a plain message.

## Mobile impact

None required. No assignment table, function, enum or policy changes, so the existing mobile contract is unaffected. The `app_role` enum is unchanged. Mobile users see no mock tests (D-B10, M1). If mobile later adds it, the same functions are reusable. The mobile repo needs no commit for v1.

## Decisions

- **DEC-MT-1:** New tables `mock_tests`, `mock_test_questions`, `mock_test_attempts`, `mock_test_answers`; assignments untouched. Attempts key on `profiles.id`.
- **DEC-MT-2:** Admins use RLS with `private.is_admin()`. Takers have no table access, only `security definer` functions gated by `my_active_role() in ('student','parent','user')`. Tutors excluded.
- **DEC-MT-3:** Marking is server-side in `mock_submit`; 1 mark per question; keys and explanations are returned only after the caller's own submit.
- **DEC-MT-4:** Release and take-back are functions; a trigger freezes released tests; take-back refused once any attempt exists, serialised by row locks. Delete allowed for drafts only.
- **DEC-MT-5:** One shared taker UI mounted in the three layouts; each route exports its own `ErrorBoundary`; all Supabase calls in `mock-tests.service.ts`.
- **DEC-MT-6:** No mobile change, no pricing column, no e-mail in v1. Paid tests (D-B2) are an additive later change.

## PAUSE FOR SAURABH

None blocking. No new vendor, no cost, no auth change. For the record, DEC-MT-1 (own tables) is the one hard-to-reverse choice once real attempts exist; it is low-regret and recommended. D-1, D-2, D-3 from the requirement remain open and are cheap to flip. Saurabh must still approve Privacy Policy wording (R-1) before release.

## Open questions

1. Is a version column to stop last-save-wins worth adding now? Recommended: no.
2. Should a deactivated person's old attempts count in the admin attempt total? Recommended: yes, count all submitted.
