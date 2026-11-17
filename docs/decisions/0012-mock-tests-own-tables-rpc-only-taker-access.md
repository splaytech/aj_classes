# ADR-0012: Mock tests get their own tables; takers reach them only through server functions

- **Status:** Proposed (2026-11-18, Architect at Stage 2)
- **Source:** `docs/delivery/2026-11-17-mock-tests/02-architecture.md`

## Context

Admins build MCQ mock tests and release them. Every active student, parent and signed-up `user` can take a released test free. Assignments already hold MCQ questions with auto-marking, but they belong to a class, need enrolment (`assignment_visible_to`), key attempts on `students.id` (users and parents have none), and carry hold-results, files, e-mail triggers and the mobile app's contract (ADR-0002, 0003, 0007, 0008).

## Decision

1. **New tables** `mock_tests`, `mock_test_questions`, `mock_test_attempts`, `mock_test_answers`. Attempts key on `profiles.id`. Nothing in the assignment tables or functions changes.
2. **Privileges first:** `revoke all` on the four tables from `anon, authenticated` (pattern `20261024120000_posts.sql:18`). Admins then get RLS policies using `private.is_admin()` (active admin at aal2) plus **column-scoped grants only**: select and delete on tests and questions (delete is policy-limited to drafts, via the freeze trigger); insert and update on title and instructions, and on question content columns. `created_by` is not in the insert grant: it defaults to `auth.uid()`, and `status` defaults to `draft`. `status`, `created_by` and `released_*` are never granted, so they change only inside the release and take-back functions. Tutors and everyone else get nothing.
3. **Takers get no rows from the tables.** The attempt and answer tables have no grant and no policy for `authenticated`. Tests and questions do grant `select` (and the column writes above) to `authenticated`, because admins sign in as that role; for everyone else the admin-only RLS policies (`private.is_admin()`) return no rows, so on `mock_test_questions` the answer key is protected by that select policy alone. **Any future select policy on `mock_test_questions` that lets takers read rows would expose `correct_option` and `explanation`**: give takers a function instead (a pgTAP case pins that the table has only the admin policies). Takers use `security definer` functions that gate on `private.can_take_mock_tests()` as defined in 03 §2.5 (`my_active_role() in ('parent','user') or my_student_id() is not null`). Functions return questions without `correct_option` and `explanation` until the attempt is submitted.
4. **Marking happens in `mock_submit` on the server**, one mark per question, score stored on the attempt. One attempt per person per test (unique key).
5. **State changes** (release, take back) happen only in two functions. Every admin function starts with `if not private.is_admin() then raise` and every new function has execute revoked from `public, anon` and granted to `authenticated` only (pattern `20261007090321_family_functions.sql:683`). Triggers on questions take `for update` on the parent test row (not `for share`, which would let two concurrent adds both pass the count check) and refuse changes when it is released, so a write cannot slip in during release and the 100-question cap holds. Take-back is refused once any attempt is submitted (L-5); it deletes in-progress attempts. Start, save and submit take the test row `for share` and take-back takes it `for update`, so they serialise.

## Consequences

- No coupling to class, enrolment or due-date rules. Assignments and the mobile app are untouched.
- Question-shape rules (2-6 options, one key, length limits) are written a second time in a new check constraint. Accepted: a shared "question" table is a bigger refactor with mobile risk.
- Answer keys reach takers only through functions. The remaining RLS risk is a future taker-facing select policy on `mock_test_questions` (decision 3), pinned by a pgTAP case.
- Later paid tests, retakes, non-MCQ kinds or class links are additive columns and tables. No pricing column now.
- Reversing to "assignments with a flag" after attempts exist means a data migration of attempts.
- **Take-back (ruling L-5, 2026-11-18, amends decision 5):** take-back is allowed while no attempt is submitted, and deletes in-progress attempts and their answers in the same transaction, under the test-row lock. Known limit: once any attempt is submitted the test can't be taken back, so a wrong key is fixed by releasing a corrected new test.
- **Accepted risk (ruling L-6, 2026-11-18):** submitting with no answers reveals every correct option and explanation, so the key is effectively public to any signed-up account. Mock tests are practice only and no credential attaches to a score. Requiring at least one answer before submit is deferred.

## Alternatives rejected

- **Reuse `assignments` with a `kind = 'mock'` flag:** fits users and parents badly (no student row, no class), forces every assignment function, RLS rule, trigger and the mobile contract to branch on the flag.
- **Shared generic `questions` table for both:** cleanest long term, touches live assignment tables and mobile now. Deferred.
- **Taker SELECT policies with column grants hiding the key:** one wrong grant or a `select *` leaks the key; a view per role adds the same risk.
- **Marking in the browser:** needs the key sent first.
