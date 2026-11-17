# 02 — Architecture: mock test scoring (marks, pass mark, percentage, admin results)

Stage 2 (Architect) of `/deliver`. Branch `feature/mock-test-scoring`. 18 Nov 2026. Inputs: `01-requirement.md` (50 ACs, approved), `00-decisions.md` (L-1 to L-8), ADR-0012 (Amendments 1 and 2), the three applied mock migrations, and `apps/web/src`. Read-only on code. I did not touch the hosted project. `psql` is not on this machine's PATH, so I ran no local query either: every statement about "what exists" below is read from the migration files and the web source, not from a live database.

"AC n" means `01-requirement.md` of this folder.

## Recommendation (one paragraph)

One new migration, `20261121100000_mock_test_scoring.sql`, additive and touching no applied file. Two new columns: `mock_test_questions.marks smallint not null default 1 check (1..100)` and `mock_tests.pass_mark smallint check (1..100)` (null = no pass mark). **The attempt table does not change.** `mock_test_attempts.score` and `.total` keep their names and types and simply become marks, because every old question is 1 mark, so every stored number stays true with no backfill. The percentage and Pass / Not yet are **derived on read** from `score`, `total` and the frozen `pass_mark`, by two private SQL helpers that every function shares. Admin results are one new RPC, `public.mock_test_results(target)`: security definer, `private.is_admin()` (admin at aal2), no table or view access for anyone. Marks freeze with the existing question trigger (no new trigger); the pass mark freezes by extending the existing `check_mock_test` trigger. No item here is a PAUSE FOR SAURABH (see the last section).

## 1. Impact assessment

| Area | Change | Size |
|---|---|---|
| Database | New migration: 2 columns, 2 private helpers, 1 replaced trigger function, column grants, 3 replaced functions (`mock_submit`, `mock_tests_for_me`, `mock_test_open`), 1 new function (`mock_test_results`). No applied migration edited. | Medium |
| Tables | `mock_test_attempts`, `mock_test_answers`, `private.mock_test_options` untouched. `mock_tests_admin_list`, `mock_start`, `mock_save_answer`, `mock_release`, `mock_withdraw`, `mock_set_closing`, `mock_close_now` unchanged. | None |
| Web constants | `mock-tests.constants.ts`: new labels, limit messages, Pass / Not yet, fallback name, empty state; `MOCK_RESULT.score` (line 260) changes "correct" to "marks". Limits come from `QUESTION_LIMITS.marksMin/marksMax` (`online-assignments.constants.ts` lines 9, 10 per the requirement), not a second copy. | Small |
| Web service | `mock-tests.service.ts`: `getMockTestForEdit` (line 45) adds `pass_mark` and `marks` to its selects; `createMockTest` / `updateMockTest` (lines 77, 94) send `pass_mark`; `saveMockQuestion` (line 190) sends `marks`; new `listMockTestResults`; `submitMockTest` (line 290) and the two taker mappers in `mock-tests-data.ts` read the new keys. All HTTP stays in `services/`. | Medium |
| Web UI | `MockQuestionDialog`, `MockTestDialog` (marks, pass mark; pass mark shown read-only when not a draft, control hidden), `MockTestTakeForm` (marks per question, start page totals), `MockTestResult` and the taker list (percentage, label, per-question marks), one new admin route and page for Results with its own `ErrorBoundary` (the pattern at `routes/portal/admin-mock-test.tsx:59-60`), inside the admin layout (`routes.ts:56-69`). | Medium |
| Homes of the remaining ACs | **AC 4** (total marks on the admin edit view): computed in the web from the questions `getMockTestForEdit` already loads (sum of `marks`), no database change. **AC 2 and 7** (field messages): the database refuses out-of-range marks and pass marks with `check_violation`; `toErrorKey` (`services/auth-errors`) maps it to a constants key, and the dialogs validate first so the database error is the backstop; all text from the constants. **AC 50**: no public page, sitemap entry, CSP or hosting change; nothing here is pre-rendered or listed. | Small |
| Tests | New pgTAP file; **existing pgTAP pins change**: `mock_tests_categories.test.sql:74-77` pins the exact UPDATE column list on `mock_tests` (`pass_mark` joins it), and the closing and taker tests pin function bodies and return shapes. Vitest for mappers, constants parity of limits, percentage and Pass examples (AC 14, 21). **Existing web tests that pin "N of M correct" and must change with `MOCK_RESULT.score`:** `MockTestResult.test.tsx:41-43`, `lib/mock-tests.test.ts:162-163`, `routes/portal/mock-tests.test.tsx:120,135,146`, `routes/portal/mock-test.test.tsx:195`. The pgTAP taker case at `mock_tests_taker.test.sql:80` is named for the same reason (it asserts the old score and total shape). | Medium |
| Mobile | None. Mock tests are web only (2026-11-17 M1). The extra JSON keys and list columns are additive. | None |
| Hosting | **One hosted DB serves staging and production** (memory `zoho-crm-and-hosted-supabase`). The migration reaches the production DB when it is applied for staging. Ruled by L-7 (no guard); see R-A2. | Flag |

## 2. Where marks, the pass mark and the score live

### 2.1 Storage

| Value | Lives in | Written by | Stored or derived |
|---|---|---|---|
| Marks of a question | `mock_test_questions.marks smallint not null default 1 check (marks between 1 and 100)` | Admin, column grant on insert and update | Stored |
| Pass mark | `mock_tests.pass_mark smallint check (pass_mark between 1 and 100)`, null = none | Admin, column grant on insert and update | Stored |
| Total marks of a test | Sum of its questions' marks | nobody | Derived (frozen after release) |
| Score and total of an attempt | `mock_test_attempts.score` and `.total`, **now meaning marks earned and total marks**, written once by `mock_submit` | `mock_submit` only (no grant) | Stored at submit |
| Percentage | `floor(score * 100 / total)` | nobody | Derived on read |
| Pass / Not yet | `score * 100 >= pass_mark * total`, null when no pass mark | nobody | Derived on read |

Decision: the existing `score` and `total` columns are kept and reinterpreted, not joined by new `score_marks` / `total_marks` columns. Reason: two pairs of columns would be two sources of truth, and for every row that exists today the old and new meaning are numerically identical (each old question counted 1). Their comments get updated in the migration so the meaning is on the schema.

### 2.2 Why store score and total but derive percentage and Pass

- Score and total are a fact of the moment of submit, taken from the frozen key. Storing them is the existing design (ADR-0012 decision 4) and costs nothing.
- Percentage is a pure function of those two stored numbers. A stored copy could only disagree with them.
- Pass / Not yet depends on `pass_mark`, which is frozen at release (L-3). **A test with a submitted attempt can never return to draft** (`mock_withdraw` refuses it, `20261119100000:195-198`, and the attempt's FK to the test is `on delete restrict`, `20261118100000:64`). So from the first submit on, `pass_mark` can never change, and a derived label can never drift from what the taker saw. This invariant is what makes derive-on-read safe. It is stated in the ADR so that D-S4 (change the pass mark after release) knows what it must add first: a snapshot column on the attempt, additive. Not needed now.

### 2.3 The two shared helpers

`private.mock_percentage(score int, total int) returns int` and `private.mock_passed(score int, total int, pass_mark int) returns boolean`: `language sql`, `immutable`, **`strict`**, `search_path ''`, execute revoked from `public, anon, authenticated` (called only from the definer functions, which run as owner; same house pattern as `private.can_take_mock_tests`, `20261118100000:242`). The percentage is integer division of a non-negative integer (floor, AC 14), with `total > 0` guarded (returns 0 otherwise; a released test always has total of at least 1, AC 17). `strict` makes a NULL score, total or pass mark return NULL, so a not-started or in-progress row in `mock_tests_for_me` shows no percentage and no label (AC 12), and a test with no pass mark gives a null label. pgTAP pins both: not_started and in_progress rows give null `percentage` and `passed`. Pass is the exact cross-multiplication of AC 18, which is why rounding down and the Pass rule can never disagree (SC5). Every function that returns a percentage or label (`mock_submit`, `mock_tests_for_me`, `mock_test_open`, `mock_test_results`) calls these two, and the web never computes either. One rule, one place.

### 2.4 `mock_submit`

Same signature, same locks and order (test row `for share`, then the attempt row `for update`, same closed check from `20261119100000:420-422`). Only the arithmetic changes: `new_total` becomes the sum of `q.marks` over the test, and `new_score` the sum of `q.marks` over answered-correctly questions, both `coalesce(...,0)` and cast to int. Marks cannot move during the call: they are frozen once released, and a release-time write needs the test row `for update`, which the share lock excludes. The return JSON keeps `score` and `total` and adds `percentage` and `passed` (null when no pass mark). A repeat submit returns the stored `score` and `total` plus the same derived keys, so AC 24 holds. Old web builds ignore the new keys.

### 2.5 How legacy attempts stay true

1. The migration adds `marks` with a **constant default of 1**: Postgres stores it as a catalog default, rewrites nothing, fires no row trigger (so the freeze trigger on released questions does not trip), and every existing question reads 1 (AC 40).
2. The migration contains **no statement that touches `mock_test_attempts`** (AC 41, 43). That is greppable, and it is the guarantee: not "we recompute and hope it matches", but "we never write there".
3. Old `score` = count of correct answers = sum of 1-mark questions; old `total` = count of questions = sum of 1-mark questions. Same N and M, now read as marks (AC 42).
4. An in-progress attempt on an existing released test is scored at its submit from the frozen marks (all 1) and key, so it equals what the old function would have given (AC 44).
5. Old tests have `pass_mark` null, so no label (AC 45); their percentage is derived from the stored pair like any other (AC 31).
6. Per-question marks earned (AC 22, 23): `mock_test_open` adds `marks_earned = marks when the chosen option is the correct one, else 0` for a revealed attempt. Because marks are frozen and the stored score was computed by the same rule from the same frozen marks, the per-question figures always sum to `score`. A pgTAP case proves it for every submitted attempt in the test data, including a legacy-shaped one.

**Verification recipe for AC 41 (local DB only, Developer or Tester runs it):** on a local DB migrated to `20261120100000`, seed attempts and save `select id, score, total from public.mock_test_attempts order by id`; apply the new migration; save the same query; the two files must be byte-identical.

## 3. The admin results function

### 3.1 Recommendation: an RPC, not a view or a table grant

`public.mock_test_results(target uuid)` returns one row per **submitted** attempt:

`attempt_id uuid, taker_name text, submitted_at timestamptz, score int, total int, percentage int, passed boolean, total_rows bigint`

- `security definer`, `stable`, `set search_path = ''`, `#variable_conflict use_column` (house pattern, `20261118100000:249-283`).
- First statement: `if not private.is_admin() then raise exception 'not_admin' using errcode = '42501'`. `private.is_admin()` is active admin **and** `aal = 'aal2'` (`20261006004522_staff_accounts.sql:126-135`). A tutor, parent, student, user, an admin without aal2, and a signed-out caller all fail (AC 36, 37). Same error as every other admin function, so the web maps it the same way.
- Test not found: `private.raise_mock_not_found()` (HTTP 404, `20261118100000:110-120`). A draft or a test with no submitted attempts returns zero rows, not an error (AC 28, 34). A closed test returns its rows unchanged (AC 32): the function never looks at `closes_at`.
- Rows: `mock_test_attempts a` where `a.test_id = target and a.submitted_at is not null` (the **same predicate** as `submitted_count` in `mock_tests_admin_list`, so the counts match, AC 33), joined to `profiles` for the name. Ordered `submitted_at desc, a.id` (AC 34).
- Name: `coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(s.full_name), ''))` with `left join public.students s on s.profile_id = p.id`; null becomes the constants fallback in the web (AC 30). `profiles.full_name` is `not null default ''` (`20261006004522:55`), so a blank is `''`, not null, which is why `nullif` is needed. **Ruled by L-8 and AC 30 (amended):** profile full name, else the student roster name (`students.full_name`, always set), else the constants fallback "Name not set". The order is fixed, not open. **E-mail is never selected.**
- Not returned: `profile_id`, e-mail, answers, `correct_option`, started_at. `attempt_id` is returned only as a stable React key (AC rule `keys-in-lists`); it opens nothing.
- Grants: a new function in `public` is executable by PUBLIC by default, and the dropped and recreated `mock_tests_for_me` starts that way too. The migration therefore **ends with `revoke execute ... from public, anon, authenticated` then `grant execute ... to authenticated` for `mock_test_results`, `mock_tests_for_me`, `mock_test_open` and `mock_submit`** (pattern `20261120100000:426-434`). pgTAP ACL pins for all four: `prosecdef`, `proconfig`, and no execute for `anon` or `public`.

### 3.2 Why not the alternatives

- **A view** (or `security_invoker` view) on attempts: would need a grant and an admin SELECT policy on `mock_test_attempts`, breaking ADR-0012 decision 3 ("attempts and answers: no grant, no policy"). Admins could then `select *` and reach `profile_id` and answers, and the next wrong policy leaks. A `security definer` view bypasses RLS and is the pattern Supabase's linter warns about.
- **An admin SELECT policy on attempts plus column grants:** same breach, and a column-scoped grant can't join the name from `profiles` (which admins read separately, but the join then happens in the browser).
- **Per-row "answers" later (D-S2):** a different, separately privacy-reviewed function. This one cannot grow into it by accident because it selects nothing from `mock_test_answers`.

### 3.3 What takers can and cannot reach (AC 38)

- The only function that returns more than the caller's own attempt is `mock_test_results`, and it is admin-only. Taker functions all filter `a.profile_id = me` (`20261120100000:336`, `:369-371`) and are unchanged in that respect.
- Neither new column is a leak: `marks` and `pass_mark` are test-level facts, readable before submit by design (SC10, SC13). `correct_option` and `explanation` still appear in `mock_test_open` only when `revealed` (the existing `case`, `20261120100000:394-397`); the new `marks_earned` is added in that same revealed branch only.
- Tables: still no taker grant or policy on attempts or answers. The select policy on `mock_test_questions` stays admin-only; a pgTAP case already pins that (ADR-0012 decision 3).
- The client gate `getAdminClient` (`services/staff-client.ts:14-16`) means no request leaves the browser for a non-admin or a non-aal2 admin. It is convenience, not security: the function is the authority.

### 3.4 Page size

PostgREST `max_rows` is 1000 (`supabase/config.toml:19`; the hosted default is the same unless changed). A function returning more rows is truncated silently. One test with over 1000 submitted attempts is not realistic at this centre today, but sign-up is open (ADR-0011). Decision: no pagination in v1, but truncation is never silent: the function returns a `total_rows int` column (`count(*) over ()`, the same on every row) and the page shows "showing 1000 of N" when the rows received are fewer than `total_rows` (constants text). Return shape is now `attempt_id, taker_name, submitted_at, score, total, percentage, passed, total_rows`.

## 4. Freeze rules: existing triggers versus new ones

| Item | Existing mechanism | New trigger needed | How |
|---|---|---|---|
| `marks` on a question | `private.check_mock_question`, `before insert or update or delete` on `mock_test_questions` (`20261118100000:155-204`): locks the test row `for update` and raises `mock_released` unless the test is a draft. It is column-agnostic. | **No.** | Add `marks` to the insert and update column grants. A direct write to a released test is refused by this trigger (AC 3). The editor does not show the marks control when the test is not a draft. A released test's marks are not in the update path of any function. |
| `pass_mark` on a test | `private.check_mock_test`, `before update or delete` on `mock_tests` (`20261118100000:126-149`), but it freezes only `title` and `instructions` (lines 134-135). | **No new trigger; replace the function body** (`create or replace function private.check_mock_test()`, trigger binding and revoked execute are kept): add `or new.pass_mark is distinct from old.pass_mark` to the released branch. | Same `mock_released` error as title, so the web already maps it. Per AC 9 the web still **shows** the pass mark read-only on a released or closed test; only the control is hidden. Writing the same value on a released test is allowed (idempotent). The tag trigger is not involved: tags keep their own exception (Amendment 1), and the pass mark is **not** part of that exception (AC 9). |
| Insert of a released test with a pass mark | Inserts cannot set `status` (not granted), so a new row is always a draft. | No | n/a |
| Pass mark writer race with release | Release does `select ... for update` on the test, then updates status. A concurrent pass-mark write waits for that lock, and Postgres re-fetches the committed row for its BEFORE trigger, so `OLD.status` is the released one and the write is refused. | No | The tags trigger judges a locked re-read rather than `OLD` (Amendment 1 point 3), because it decides on more than the changed columns. Here the decision is `OLD.status`, and Postgres already supplies the latest committed `OLD` after a lock wait. **Must-pass gate, not a nice-to-have:** a two-session case (session A holds the release, `mock_release` locked and uncommitted; session B writes `pass_mark`, waits, then must be refused with `mock_released` after A commits) is in the frozen plan and the release gate cannot pass without it. The claim is unproven until it runs. If it fails, switch the trigger to the same `for no key update` re-read the tags trigger uses (Amendment 1 point 3). |
| `pass_mark` and `marks` ranges | n/a | **Table CHECK constraints** (1 to 100) | A check is enough: no cross-row logic. Messages come from the web constants; a direct write gets `check_violation`. |
| Take-back to draft | `mock_withdraw` (`20261119100000:172-208`) is allowed only with no submitted attempt. | No change | Marks and pass mark become editable again on the draft; `pass_mark` is kept across the withdraw (no reason to clear it). This does not break the freeze invariant of 2.2, because no attempt can be submitted in the draft state. |
| Question delete, reorder | Same trigger, same refusal | No | `mock_move_question` is untouched. |

Invariant stated once for the ADR: marks and the pass mark can change only while the test is a draft (and a draft has never had a submitted attempt, because a test with one can't be withdrawn).

## 5. Smallint and overflow limits (R-S7 confirmed)

| Quantity | Max | Type | Fits? |
|---|---|---|---|
| Marks of a question | 100 (check) | smallint | Yes |
| Questions per test | 100 (trigger, `20261118100000:183`) | n/a | n/a |
| Total marks of a test | 100 x 100 = 10,000 | `attempts.total` smallint (max 32,767) | Yes |
| Score | at most `total` (`attempts` check, line 75) | smallint | Yes |
| `score * 100`, `pass_mark * total` | 1,000,000 | **int required** | Only if cast |

Confirmed: stored `score` and `total` fit smallint with a 3x margin, so **no column type change**. The real hazard is the intermediate products. In Postgres `smallint * smallint` is smallint, so `pass_mark * total` (both smallint columns) would raise "smallint out of range" for any test over 327 marks (e.g. 4 questions of 100 marks at pass mark 90 gives 36,000). Rule for the migration: **cast to `int` before any multiplication**, which the helpers in 2.3 do by taking `int` parameters (call sites cast explicitly: `a.score::int`, `a.total::int`, `t.pass_mark::int`; a smallint product such as 90 x 400 would overflow). `sum(smallint)` returns bigint, so the sums are cast to int on assignment. Headroom limit: raising the 100-question cap above 327 would overflow `total` at 100 marks each; that change must widen the columns first. Stated in the ADR. pgTAP boundary cases: 100 questions at 100 marks all correct (score 10000, 100%), and 4 x 100 marks at pass mark 100 and 90 (the product case).

## 6. Alternatives considered

1. **Recompute score at read time from answers and marks** instead of storing. Rejected: needs the answers and key on every list read, and would make a score change if anyone ever edited a question. Storing at submit is already the design and keeps legacy untouched.
2. **New `score_marks` / `total_marks` columns, leave the old pair.** Rejected: two sources of truth and a backfill with nothing to gain (section 2.1).
3. **Store percentage and passed on the attempt.** Rejected: redundant; safe to derive because of the 2.2 invariant. Revisit with D-S4.
4. **Pass mark set only as an argument of `mock_release`** (ungranted column, no trigger change). Smaller trigger work, but the admin could not see or edit it on the draft dialogs (AC 6) and the rule would differ from every other draft field. Rejected.
5. **Percentage computed in the web.** Rejected: a second copy of the rounding rule that must agree exactly with the Pass rule (SC5).
6. **Tutor access to results (D-S11).** Out of scope (L-2). The function's gate is one line, so widening later is a small, reviewable change, not a redesign.

## 7. Risks

- **R-A1 Replacing three live functions.** `mock_tests_for_me` changes return type (drop and create, as in `20261119100000:218` and `20261120100000:300`); `mock_test_open` and `mock_submit` are `create or replace`. The bodies must be copied from the **latest** version of each (categories `20261120100000` for list and open; closing `20261119100000` for submit, which categories did not change), or the closing and categories behaviour silently regresses. Mitigation: the existing closing and categories pgTAP files run unchanged except for the pinned shapes; the Reviewer diffs each new body against its source.
- **R-A2 One database for staging and production (ruled L-7: no guard).** The migration reaches the production DB when staging is deployed, and is backward compatible (extra columns and keys; marks default to 1). Production `main` has no mock-test UI or service (L-7, checked by the Team Lead with `git ls-tree -r main`), so no old screen can misread marks, and staging is rebuilt from `develop` in the same release step that applies the migration. The Results function is admin-only at aal2 (L-6). The Privacy Policy line stays the gate for `main`.
- **R-A3 Pass-mark trigger race** (section 4). Unproven until the must-pass two-session case runs, with a stated fallback.
- **R-A4 1000-row ceiling** on the results RPC (3.4). Never silent: `total_rows` drives a "showing 1000 of N" note. Pagination stays out of v1.
- **R-A5 Name source (closed by L-8).** pgTAP cases: a student with a blank profile name shows the roster name, a parent and a user with a blank name show the fallback, and no case ever shows an e-mail.
- **R-A6 Existing pgTAP pins** (`mock_tests_categories.test.sql:74-77` and the shape pins in the closing and taker files) will fail until updated. That is expected and listed in section 1, not a regression.
- **R-A7 Taker visibility of marks** (SC13) adds a line to the question page that 2026-11-17 AC 28 did not list. Already ruled in the requirement as cut-if-conflicting; no architectural cost.
- **R-A8 Concurrency.** Unchanged lock order (test row, then attempt row). `mock_test_results` takes no lock; a result row is immutable once written, so a read cannot be torn.

## 8. Decisions (for `_knowledge/decisions.md`)

1. **DEC-MS-1 (ADR-0012 Am. 3):** Marks live on `mock_test_questions.marks smallint not null default 1 check (1..100)`; the pass mark on `mock_tests.pass_mark smallint check (1..100)`, null = none.
2. **DEC-MS-2:** `mock_test_attempts.score` and `.total` are unchanged in name and type and now mean marks. The migration writes no existing attempt row (only `mock_submit`'s one write at submit); legacy rows are true because every old question is 1 mark.
3. **DEC-MS-3:** Percentage (floor) and Pass / Not yet are derived on read by two shared private helpers, never stored and never computed in the web. Safe because a test with a submitted attempt can never be withdrawn.
4. **DEC-MS-4:** Admin results are `public.mock_test_results(target)`, security definer, `private.is_admin()` (aal2), submitted attempts only, name and scores only, no grant or policy on attempts, no view.
5. **DEC-MS-5:** Marks freeze through the existing `check_mock_question`; the pass mark freezes by extending `check_mock_test`; no new trigger.
6. **DEC-MS-6:** All multiplication is done in `int`; stored columns stay smallint; the 100-question cap must not be raised past 327 without widening them.
7. **DEC-MS-7:** The migration is `20261121100000_mock_test_scoring.sql`; none of the three applied mock migrations is edited.

## 9. PAUSE FOR SAURABH

None. Nothing here is irreversible or vendor-bound: both new columns are additive and droppable, the reinterpretation of `score` and `total` is numerically identical for all existing data, and the privacy choice (names to admins) was already ruled by L-6 with the Privacy Policy line as the gate for `main`. R-A2 (shared database) is ruled by L-7: no guard.

## 10. Hand-off to the Solution Designer

Detail still to fix: exact column order and JSON key names of the three replaced functions; the `mock_test_results` name source (3.1); the Results route path and page layout; test cases for the two-session pass-mark race, the 100 x 100 and 4 x 100 boundaries, the AC 23 sum check and the role matrix of AC 37.
