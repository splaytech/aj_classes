# 03 — Design: mock test scoring (marks, pass mark, percentage, admin results)

Stage 3 (Solution Designer) of `/deliver`. Branch `feature/mock-test-scoring`. 18 Nov 2026. Inputs: `01-requirement.md` (50 ACs), `00-decisions.md` (L-1 to L-8), `02-architecture.md` (approved, round 2), ADR-0012 Amendment 3, the three applied mock migrations, the closing design (`2026-11-18-mock-test-closing/03-design.md`, house style) and the web source on this branch. Read-only on code; this is the only file written. Nothing hosted was touched. No new dependency, service or cost. Mobile unchanged.

"AC n" is `01-requirement.md` of this folder. "Arch n" is a section of `02-architecture.md`.

**Evidence for the SQL.** Section 1's migration was run, unchanged, as a rolled-back transaction on the local database (`supabase_db_aj_classes`, migrated to `20261120100000`, no mock rows) with fixtures made by the `tests.*` helpers. It compiled and gave: a 3 + 2 mark test, one answer right, submit returned `{"score":3,"total":5,"percentage":60,"passed":true}`, the repeat submit the same; a no-pass-mark test returned `passed: null`; a 40% attempt returned `passed: false`; `mock_test_results` returned both rows with the roster name for the blank-profile student and an empty name for the blank-profile user, `total_rows` 2 on each row; the admin at aal1 got `not_admin`; `marks_earned` summed to the stored score. Everything was rolled back; the Developer re-runs the real pgTAP.

## 0. Decisions made in this design (small, reversible)

1. **Results page is its own route**, `/portal/admin/mock-tests/:testId/results`, inside the admin layout. Reached from a Results link on every row of the admin list (AC 28: any test, draft included) and a Results button on the admin edit page. The layout already refuses non-admins (AC 37).
2. **One service function loads the Results page**: `getMockTestResults(testId)` reads the test header (title, status, closing time, pass mark) and calls `mock_test_results`. One loader, one failure path, no second request from the component.
3. **Pass mark is a number field in the existing create and edit dialogs** (drafts only, so it is never offered on a released test, AC 9); the released edit page shows it read-only in a new "Scoring" card.
4. **Marks field copies the assignment pattern** (`QuestionDialog.tsx` lines 185 to 197): a `type="number"` `TextField`, held as text, `Number(text)` on save, validated with `QUESTION_LIMITS`.
5. **The web never computes a percentage or Pass.** It prints what the database sent. The only arithmetic in the web is the sum of question marks on the admin edit page (AC 4), which is a total, not a result.
6. **Pass and Not yet chips are neutral** (outlined, default colour, text only) because AC 16 forbids colour that implies a grade. [ASSUMPTION] Pass is not green.
7. **"1 of 1 marks"** is accepted wording: L-4 fixed "N of M marks" for every test, so no singular form is built.
8. **No extra "practice only" note** (ruling L-9). The taker list intro already says "Free practice."; Pass and Not yet stay neutral. R-S6 is met by plain wording.
9. **Decimal pass marks** are refused by the web only. The column is smallint, so a direct write of `60.5` is stored as 61 (Postgres rounds); the value is still 1 to 100 and only admins can write, so it is accepted as a risk (R-D4).

## 1. Migration `20261121100000_mock_test_scoring.sql`

### 1.1 Name and timestamp (checked 18 Nov 2026)

Newest migration on every place: this branch, `feature/mock-test-closing` and `develop` end at `20261120100000_mock_test_categories.sql`; the worktrees `aj_classes-hiring` (`20261027100000`), `aj_classes-invites` and `.worktrees/seo` (`20261030100000`), `.worktrees/zoho-lead` (`20261117100000`); `git ls-tree` of every local and remote branch shows no file at or after `20261121`. `20261121100000` is later than all. It sorts after the three applied mock migrations, which it must (it replaces functions they define). The Developer re-lists before committing.

### 1.2 Sources of the copied bodies (current definitions, re-verified)

Each range re-checked with `grep -n "function public.<name>" … | tail -1` and the next `$$;`. The Developer re-verifies and diffs each new body against its source.

| Function | Current definition | Through | Changed in this file |
|---|---|---|---|
| `private.check_mock_test()` | `20261118100000_mock_tests.sql` line 126 (no later migration redefines it; the categories file only adds `check_mock_test_tags` and `check_mock_test_release_tags`) | `$$;` at 145 | one added `or` line (pass mark); status judged on a locked re-read, not `old.status`; stays `security invoker` |
| `public.mock_submit(uuid)` | `20261119100000_mock_test_closing.sql` line 405 (categories does not redefine it) | `$$;` at 453 | sums of marks; reply keys; test lock selects the pass mark |
| `public.mock_tests_for_me()` | `20261120100000_mock_test_categories.sql` line 302 (`drop function` at 300) | `$$;` at 341 | two new return columns |
| `public.mock_test_open(uuid)` | `20261120100000_mock_test_categories.sql` line 344 | `$$;` at 424 | new keys |

Not touched: `mock_tests_admin_list`, `mock_start`, `mock_save_answer`, `mock_release`, `mock_withdraw`, `mock_set_closing`, `mock_close_now`, `mock_move_question`, `private.check_mock_question`, `private.check_mock_test_tags`, `private.check_mock_test_release_tags`.

### 1.2a What the replaced functions keep (so closing and categories do not regress)

- `mock_submit`: the closed check in the `for share` select (`closes_at is null or closes_at > clock_timestamp()`), lock order (test row, then attempt row), `mock_not_started`, the repeat-submit early return.
- `mock_tests_for_me`: the S-1 clause `or a.submitted_at is not null`, the order, the four tag columns.
- `mock_test_open`: the closed and S-1 not-found rule, `revealed` only for a submitted attempt, the `tags` object.

### 1.3 The migration, in full

Copy this text into the file unchanged; it is the exact file. Return-shape notes follow it.

```sql
-- Mock test scoring (docs/delivery/2026-11-18-mock-test-scoring/03-design.md, ADR-0012 Amendment 3):
-- marks per question, an optional pass mark per test, a percentage and Pass / Not yet worked out
-- on read, and an admin-only results function.
--
-- Additive. Nothing below touches existing rows of mock_test_attempts. The only write to that table
-- is the one mock_submit already made: it sets submitted_at, score and total while submitted_at is
-- null, now as sums of marks. score and total keep their names and types and now mean marks earned
-- and total marks. Every existing question is 1 mark, so every stored number is already true.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

-- A constant default: Postgres keeps it in the catalog, rewrites no row and fires no row trigger,
-- so released questions (frozen by check_mock_question) read 1 without being written.
alter table public.mock_test_questions
  add column marks smallint not null default 1
    constraint mock_test_questions_marks_range check (marks between 1 and 100);

-- null means no pass mark: no Pass or Not yet label anywhere.
alter table public.mock_tests
  add column pass_mark smallint
    constraint mock_tests_pass_mark_range check (pass_mark between 1 and 100);

comment on column public.mock_test_questions.marks is
  'Whole marks, 1 to 100, like assignment questions. Frozen once the test is released.';
comment on column public.mock_tests.pass_mark is
  'Pass percentage, 1 to 100; null = no pass mark. Frozen once the test is released.';
comment on column public.mock_test_attempts.score is
  'Marks earned: the sum of the marks of the questions answered correctly. Written once, at submit.';
comment on column public.mock_test_attempts.total is
  'Total marks of the test at submit: the sum of its questions'' marks. Before 20261121100000 every question was 1 mark, so old rows read the same as a count of questions.';

-- ---------------------------------------------------------------------------
-- Percentage and Pass: one rule, one place
-- ---------------------------------------------------------------------------

-- Both take int, never smallint: smallint * smallint is smallint, and pass_mark * total reaches
-- 1,000,000. strict: a null score, total or pass mark gives null, so a test that isn't submitted
-- shows no percentage and a test with no pass mark shows no label.
create function private.mock_percentage(score int, total int)
returns int
language sql
immutable
strict
set search_path = ''
as $$
  select case when total > 0 then (score * 100) / total else 0 end
$$;

-- Exact cross-multiplication, so the rounded-down percentage and Pass can never disagree.
create function private.mock_passed(score int, total int, pass_mark int)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select total > 0 and score * 100 >= pass_mark * total
$$;

revoke execute on function private.mock_percentage(int, int) from public, anon, authenticated;
revoke execute on function private.mock_passed(int, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Freeze: the pass mark joins title and instructions (marks follow check_mock_question already)
-- ---------------------------------------------------------------------------

-- Same body as 20261118100000 (lines 126 to 145) plus the pass_mark test, which judges on a locked
-- re-read of the status, not on OLD: a write that waited behind a release must see the released
-- row (the pattern of check_mock_test_tags). Stays security invoker (2026-11-17 decision: only an
-- admin at aal2 reaches this trigger, and RLS lets that admin read and lock the row). The trigger
-- binding and the revoked execute are kept.
create or replace function private.check_mock_test()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status text;
begin
  select t.status into current_status
  from public.mock_tests t
  where t.id = old.id
  for no key update;

  if coalesce(current_status, old.status) = 'released' then
    if tg_op = 'DELETE'
       or new.title is distinct from old.title
       or new.instructions is distinct from old.instructions
       or new.pass_mark is distinct from old.pass_mark then
      raise exception 'mock_released';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Functions: from 20261119100000 (mock_submit) and 20261120100000 (the other two)
-- ---------------------------------------------------------------------------

-- Same signature. Only the arithmetic changes (sums of marks, not counts), and the reply gains
-- percentage and passed. Lock order unchanged: the test row for share, then the attempt row.
create or replace function public.mock_submit(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me         uuid := private.require_mock_taker();
  attempt    record;
  test_pass  int;
  new_total  int;
  new_score  int;
begin
  -- Test row first, for share, then the attempt (same order as mock_start and mock_save_answer).
  -- mock_withdraw holds the test for update between its submitted-check and its delete, so a
  -- submit can't commit in that gap; a submit that waited for a withdraw is refused here. Marks
  -- and the pass mark can't change while this share lock is held: a release needs the row for update.
  select t.pass_mark::int into test_pass from public.mock_tests t
  where t.id = target and t.status = 'released' and (t.closes_at is null or t.closes_at > clock_timestamp())
  for share;
  if not found then
    perform private.raise_mock_not_found();
  end if;

  select a.id, a.submitted_at, a.score, a.total into attempt
  from public.mock_test_attempts a
  where a.test_id = target and a.profile_id = me
  for update;
  if not found then
    raise exception 'mock_not_started';
  end if;

  -- Already submitted: return the stored result, change nothing.
  if attempt.submitted_at is not null then
    return jsonb_build_object(
      'score', attempt.score,
      'total', attempt.total,
      'percentage', private.mock_percentage(attempt.score::int, attempt.total::int),
      'passed', private.mock_passed(attempt.score::int, attempt.total::int, test_pass)
    );
  end if;

  -- sum(smallint) is bigint: cast to int on the way in.
  select coalesce(sum(q.marks), 0)::int into new_total
  from public.mock_test_questions q where q.test_id = target;
  -- Unanswered questions add 0 marks.
  select coalesce(sum(q.marks), 0)::int into new_score
  from public.mock_test_answers ans
  join public.mock_test_questions q on q.id = ans.question_id
  where ans.attempt_id = attempt.id and ans.selected_option = q.correct_option;

  update public.mock_test_attempts
  set submitted_at = now(), score = new_score, total = new_total
  where id = attempt.id;

  return jsonb_build_object(
    'score', new_score,
    'total', new_total,
    'percentage', private.mock_percentage(new_score, new_total),
    'passed', private.mock_passed(new_score, new_total, test_pass)
  );
end;
$$;

-- Return type gains percentage and passed: drop and create. Visibility exactly as in 20261120100000 (S-1).
drop function public.mock_tests_for_me();

create function public.mock_tests_for_me()
returns table (
  id             uuid,
  title          text,
  question_count int,
  status         text,
  score          int,
  total          int,
  submitted_at   timestamptz,
  released_at    timestamptz,
  closes_at      timestamptz,
  subject        text,
  stream         text,
  year_levels    smallint[],
  any_year       boolean,
  percentage     int,
  passed         boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := private.require_mock_taker();
begin
  return query
    select t.id, t.title,
           (select count(*) from public.mock_test_questions q where q.test_id = t.id)::int,
           case when a.id is null then 'not_started'
                when a.submitted_at is null then 'in_progress'
                else 'submitted' end,
           a.score::int, a.total::int, a.submitted_at, t.released_at, t.closes_at,
           t.subject, t.stream, t.year_levels, t.any_year,
           private.mock_percentage(a.score::int, a.total::int),
           private.mock_passed(a.score::int, a.total::int, t.pass_mark::int)
    from public.mock_tests t
    left join public.mock_test_attempts a on a.test_id = t.id and a.profile_id = me
    where t.status = 'released'
      and (t.closes_at is null or t.closes_at > clock_timestamp() or a.submitted_at is not null)
    order by t.released_at desc, t.id;
end;
$$;

-- Same signature. New keys: total_marks and pass_mark (test facts, fine before submit), marks on
-- every question, and, only for a submitted attempt, percentage, passed and marks_earned per question.
create or replace function public.mock_test_open(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me        uuid := private.require_mock_taker();
  test      record;
  attempt   record;
  state     text;
  revealed  boolean;
  questions jsonb;
begin
  select t.id, t.title, t.instructions, t.closes_at,
         (t.closes_at is not null and t.closes_at <= clock_timestamp()) as closed,
         t.subject, t.stream, t.year_levels, t.any_year, t.pass_mark::int as pass_mark,
         (select coalesce(sum(q.marks), 0) from public.mock_test_questions q where q.test_id = t.id)::int as total_marks
  into test
  from public.mock_tests t
  where t.id = target and t.status = 'released';
  if not found then
    perform private.raise_mock_not_found();
  end if;

  select a.id, a.submitted_at, a.score, a.total into attempt
  from public.mock_test_attempts a
  where a.test_id = target and a.profile_id = me;

  -- Closed: only a caller who submitted before closing still sees it (ruling S-1). Same reply as
  -- a draft or an unknown id, so nobody learns the test exists.
  if test.closed and attempt.submitted_at is null then
    perform private.raise_mock_not_found();
  end if;

  state := case when attempt.id is null then 'not_started'
                when attempt.submitted_at is null then 'in_progress'
                else 'submitted' end;
  revealed := state = 'submitted';

  if state = 'not_started' then
    questions := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'position', q.position,
        'prompt', q.prompt,
        'options', to_jsonb(q.options),
        'marks', q.marks,
        'selected_option', ans.selected_option
      ) || case when revealed
             then jsonb_build_object(
               'correct_option', q.correct_option,
               'explanation', q.explanation,
               'marks_earned', case when ans.selected_option = q.correct_option then q.marks else 0 end)
             else '{}'::jsonb end
      order by q.position
    ), '[]'::jsonb)
    into questions
    from public.mock_test_questions q
    left join public.mock_test_answers ans on ans.question_id = q.id and ans.attempt_id = attempt.id
    where q.test_id = target;
  end if;

  return jsonb_build_object(
    'id', test.id,
    'title', test.title,
    'instructions', test.instructions,
    'status', state,
    'question_count', (select count(*) from public.mock_test_questions q where q.test_id = target),
    'total_marks', test.total_marks,
    'pass_mark', test.pass_mark,
    'score', case when revealed then attempt.score end,
    'total', case when revealed then attempt.total end,
    'percentage', case when revealed
                  then private.mock_percentage(attempt.score::int, attempt.total::int) end,
    'passed', case when revealed
                then private.mock_passed(attempt.score::int, attempt.total::int, test.pass_mark) end,
    'submitted_at', case when revealed then attempt.submitted_at end,
    'closes_at', test.closes_at,
    'tags', jsonb_build_object(
      'subject', test.subject,
      'stream', test.stream,
      'year_levels', to_jsonb(test.year_levels),
      'any_year', test.any_year
    ),
    'questions', questions
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The admin results function (ADR-0012 Amendment 3, point 4)
-- ---------------------------------------------------------------------------

-- Submitted attempts only, one row per person (unique (test_id, profile_id)), newest first. No
-- e-mail, profile id or answers. The predicate is the one mock_tests_admin_list counts
-- submitted_count with. A draft or a test nobody submitted returns no rows; a closed test returns
-- its rows unchanged (closes_at is never read). total_rows is the count before PostgREST's
-- row limit, so the page can say "showing 1000 of N".
create function public.mock_test_results(target uuid)
returns table (
  attempt_id   uuid,
  taker_name   text,
  submitted_at timestamptz,
  score        int,
  total        int,
  percentage   int,
  passed       boolean,
  total_rows   bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  test_pass int;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select t.pass_mark::int into test_pass from public.mock_tests t where t.id = target;
  if not found then
    perform private.raise_mock_not_found();
  end if;

  -- Name (ruling L-8): the profile's name, else the roster name (students.profile_id is unique, so
  -- the join can't repeat a row), else null: the page says "Name not set". Never the e-mail.
  return query
    select a.id,
           coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(s.full_name), '')),
           a.submitted_at, a.score::int, a.total::int,
           private.mock_percentage(a.score::int, a.total::int),
           private.mock_passed(a.score::int, a.total::int, test_pass),
           count(*) over ()
    from public.mock_test_attempts a
    join public.profiles p on p.id = a.profile_id
    left join public.students s on s.profile_id = p.id
    where a.test_id = target and a.submitted_at is not null
    order by a.submitted_at desc, a.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges. A re-created or new function in public is executable by PUBLIC until revoked, so
-- the whole set is stated: nobody, then authenticated (each function checks its own caller).
-- ---------------------------------------------------------------------------

revoke execute on function public.mock_submit(uuid) from public, anon, authenticated;
revoke execute on function public.mock_tests_for_me() from public, anon, authenticated;
revoke execute on function public.mock_test_open(uuid) from public, anon, authenticated;
revoke execute on function public.mock_test_results(uuid) from public, anon, authenticated;

grant execute on function public.mock_submit(uuid) to authenticated;
grant execute on function public.mock_tests_for_me() to authenticated;
grant execute on function public.mock_test_open(uuid) to authenticated;
grant execute on function public.mock_test_results(uuid) to authenticated;

-- Column grants, next to title and instructions. The freeze triggers refuse a write once released.
grant insert (pass_mark), update (pass_mark) on public.mock_tests to authenticated;
grant insert (marks), update (marks) on public.mock_test_questions to authenticated;
```

### 1.4 Return shapes (the contract the service and the tests pin)

| Function | Shape |
|---|---|
| `mock_submit(uuid)` | `jsonb` `{ score int, total int, percentage int, passed boolean or null }`. `score` and `total` are marks. A repeat submit returns the stored pair with the same derived keys. |
| `mock_tests_for_me()` | table, column order: `id, title, question_count, status, score, total, submitted_at, released_at, closes_at, subject, stream, year_levels, any_year, percentage, passed`. `percentage` and `passed` are null unless submitted; `passed` is also null with no pass mark. |
| `mock_test_open(uuid)` | `jsonb`. Top level: `id, title, instructions, status, question_count, total_marks, pass_mark (or null), score, total, percentage, passed, submitted_at, closes_at, tags, questions`. `score, total, percentage, passed, submitted_at` are null until submitted. Each question: `id, position, prompt, options, marks, selected_option`; once submitted also `correct_option, explanation, marks_earned`. `total_marks` and `pass_mark` are test facts, allowed before submit (SC10). A not-started test returns `questions: []`, so the question `marks` appear from Start on (AC 10). |
| `mock_test_results(uuid)` | table, column order: `attempt_id uuid, taker_name text (null when no name), submitted_at timestamptz, score int, total int, percentage int, passed boolean (null when no pass mark), total_rows bigint`. Errors: `not_admin` (42501) for anyone but an active admin at aal2; `not_found` (404) for an unknown id. A draft, or a test nobody submitted, is zero rows. |

### 1.5 Notes on the SQL

1. **The migration writes no existing attempt row.** `mock_submit` keeps its one write, as before: an `update public.mock_test_attempts` that sets `submitted_at`, `score` and `total` while `submitted_at is null` (the early return guards a repeat). Beyond that the file has only two `comment on column` lines (metadata). A vitest check (section 8, parity test) allows exactly that one `update public.mock_test_attempts` (inside `mock_submit`) and no `insert into`, `delete from`, `alter table` or other `update` on the table (AC 41). The data proof is the before and after comparison in note 6.
2. **`check_mock_test` race (adopted: locked re-read).** The function judges on `select t.status … where t.id = old.id for no key update`, not on `old.status`, exactly as `check_mock_test_tags` does (Amendment 1 point 3), so a write that waited behind a release sees the released row. It stays `security invoker` with an empty `search_path` (review-3 round 2: only an admin at aal2 can update `mock_tests`, and RLS lets that admin read and lock the row; tested refused/accepted as invoker); `create or replace` keeps the trigger binding and the revoked execute. The two-session case in section 9 stays as the must-pass gate. A rolled-back local run showed an admin's `pass_mark` write on a released test refused with `mock_released`.
3. **Overflow.** Helpers take `int`; call sites cast every smallint (`::int`) before the helper sees it; `sum()` results are cast to `int`. Do not remove a cast.
4. **Privileges.** `service_role` keeps EXECUTE through the schema's default privileges, as for `mock_release` and the other mock functions (ruling L-10: accepted, not revoked). `create or replace` keeps the old ACL for `mock_submit` and `mock_test_open`, but `mock_tests_for_me` is dropped and `mock_test_results` is new (PUBLIC executes by default), so the file states the whole set, ending with revoke from `public, anon, authenticated` then grant to `authenticated`. Column grants add `pass_mark` and `marks` next to the existing ones; RLS policies stay as they are (admin-only, `20261118100000:666-682`).
5. **`updated_at`.** Writing `pass_mark` fires the existing `mock_tests_set_updated_at` trigger; writing `marks` fires `check_mock_question`'s bump. No change needed.
6. **Verification recipe for AC 40 to 43 (local DB only, Developer or Tester).** On a local DB migrated to `20261120100000`, seed a released test with 2 questions (as superuser, tagged, one with answers) and two attempts, one submitted and one in progress; save `select id, score, total, submitted_at from public.mock_test_attempts order by id` to a file; apply the new migration; save the same query; the two files are byte-identical. Also `select count(*) filter (where marks = 1), count(*) from public.mock_test_questions` gives equal numbers. Then submit the in-progress attempt (AC 44): score is its count of correct answers.

## 2. pgTAP changes

### 2.1 Existing files that break and must change in the same commit

(line numbers as of this design; the Developer re-greps.)

| File and line | Change |
|---|---|
| `mock_tests_categories.test.sql` 74-77 | The UPDATE column-grant pin becomes `array['any_year','instructions','pass_mark','stream','subject','title','year_levels']`; its name gains "and the pass mark". |
| `mock_tests_taker.test.sql` 115 | Question keys while in progress: `array['id','marks','options','position','prompt','selected_option']`. The regex on line 114 (`correct_option\|explanation\|@`) gains `\|marks_earned`. |
| `mock_tests_taker.test.sql` 153-157 | Submit reply: `jsonb_build_object('score', p_score, 'total', 3, 'percentage', (p_score * 100) / 3, 'passed', null)` (T1 has no pass mark); the keys line becomes `array['passed','percentage','score','total']`; the names drop "only score and total". |
| `mock_tests_taker.test.sql` 175-177 | Submitted question keys: `array['correct_option','explanation','id','marks','marks_earned','options','position','prompt','selected_option']`; name "has the three extra keys". |
| `mock_tests_taker.test.sql` 80-82 and 180-182 | They select named columns, so they still pass. Rename the case on line 80 ("shows the score" to "shows the marks") only; no assertion change. |
| `open_sign_up_access.test.sql` 84-98 (the `ax_pinned_functions` array) | The pinned list of public functions a signed-in session can call gains `'mock_test_results(uuid)'`. (Its sweep calls no mock function, so no call line is needed; the admin-only refusal of every non-admin role is proved in the new file.) |

`mock_tests_admin.test.sql` (its list key pin at 453-456 still holds: the admin list is unchanged and still has no name or score column, AC 39) and `mock_tests_closing.test.sql` need no edit. Both are re-run in full.

### 2.2 New file `supabase/tests/database/mock_tests_scoring.test.sql`

Same house form: `begin; select no_plan(); … rollback;`, `tests.create_staff / create_family_account / create_sign_up`, writes as `authenticated` at aal2 (`tests.authenticate_as(id, 'aal2')`), `pg_temp.refusal` for message and hint. Fixtures: tagged drafts (the categories release gate needs tags), released with a direct superuser `update status = 'released', released_at = now()`. Cases:

1. **Columns and grants (AC 1, 3, 6, 7, 9).** `marks` is `smallint not null default 1`; a question inserted with no marks reads 1. Marks 1 and 100 accepted; 0, -1, 101 refused with 23514. `pass_mark` null, 1 and 100 accepted on a draft; 0, -1, 101 refused 23514. The UPDATE and INSERT column grants of `authenticated` on both tables include the new column and nothing else new.
2. **Freeze (AC 3, 9).** On a released test: updating a question's marks, inserting a question with marks, and changing `pass_mark` each raise `mock_released`; writing the same `pass_mark` is accepted; the same on a closed test (closes_at in the past). After `mock_withdraw` (no submitted attempt) both are editable again and `pass_mark` is kept.
3. **Helpers (AC 14, 18, 21).** `private.mock_percentage` table: (2,3)=66, (0,5)=0, (5,5)=100, (1,3)=33, (59,100)=59, (3,5)=60, (10000,10000)=100, (1,10000)=0, (null,5) null, (3,null) null. `private.mock_passed`: (3,5,60) true, (59,100,60) false, (2,3,67) false, (2,3,66) true, (400,400,90) true and (359,400,90) false (the `smallint` product case), (10000,10000,100) true, (0,0,50) false (the `total > 0` guard), null pass mark gives null. Both are not executable by `anon`, `authenticated` or `public`.
4. **Score is a sum of marks (AC 13, 24, 44).** A test of three questions worth 3, 2, 5: one student answers the 3 and the 5 correctly, one question wrong; score 8 of 10, percentage 80. A blank answer adds 0. A repeat submit returns the identical `jsonb`. An attempt row made as superuser with answers (in progress, marks default 1 era) and then submitted scores from the frozen marks.
5. **Boundary cases (AC 14, 18).** 100 questions at 100 marks, all correct: `score 10000`, `total 10000`, `percentage 100`, `passed true` at pass mark 100. 4 questions at 100 marks, pass mark 90, all correct: `passed true`, no "smallint out of range".
6. **Taker shapes (AC 11, 12, 15, 19, 20).** `mock_test_open` before Start: has `total_marks` and `pass_mark`, `score`, `percentage`, `passed` null, `questions []`. In progress: question keys as in 2.1, no `marks_earned`, no `correct_option`, `percentage` and `passed` null. After submit: `percentage` and `passed` present, `marks_earned` per question. `mock_tests_for_me`: not_started and in_progress rows have null `percentage` and `passed` (the strict helpers); a submitted row on a test with a pass mark has both; on a test with no pass mark `passed` is null and `percentage` is set.
7. **Per-question sums (AC 22, 23).** For every submitted attempt in the file, `sum(marks_earned) = score` and equals `mock_tests_for_me.score` (including a legacy-shaped attempt inserted as superuser with `score` and `total` as counts and questions at the default 1 mark).
8. **Legacy (AC 31, 40 to 45).** Questions inserted before the pass-mark update read 1; a legacy attempt keeps `score`/`total`; its test has no pass mark so no label; `percentage` is derived. Closing, close-now, reopen and a tag edit leave every attempt row's `score` and `total` unchanged (compare before and after as text).
9. **Closed tests (AC 25 to 27).** Submitted taker on a closed test: list row shows score, percentage, passed; open returns the result with `marks_earned`; a repeat submit is `not_found`; an unsubmitted taker gets nothing from the list and `not_found` from open, save and submit. (`mock_tests_closing.test.sql` still runs and covers the rest.)
10. **Results function (AC 28 to 38).** Exact column list `attempt_id, taker_name, submitted_at, score, total, percentage, passed, total_rows`; no column named or containing `profile_id`, `email`, `answer`, `correct`. Rows are submitted attempts only (an in-progress attempt is absent); the row count equals `submitted_count` of `mock_tests_admin_list()` for that test (AC 33). Order is `submitted_at desc` and, for equal times, `attempt_id`. Draft test: zero rows, no error. Closed test: same rows as before closing. Unknown id: `not_found`. `total_rows` is the same on every row. No row text contains `@`.
11. **Names (AC 30, L-8, R-A5).** A student with a blank profile name and a roster row shows the roster name; a student with a profile name shows the profile name; a parent and a user with blank profile names show null; a profile name of spaces only counts as blank. Deviation (06-test-plan F-2, ruling L-13): `btrim` trims spaces only, so a name of tabs or other whitespace is not treated as blank and shows as typed; accepted as very low risk and deferred.
12. **Role matrix (AC 36, 37).** `mock_test_results` as: admin aal2 (rows); admin aal1 (`not_admin`, 42501); tutor aal2; parent; student; signed-up user (finished) at aal1 and aal2 (each `not_admin`, 42501, and no row); an inactive admin (`not_admin`); `anon` (permission denied: no execute). Tutor and the four takers select directly from `mock_test_attempts` (permission denied, as today) and `mock_test_answers`.
13. **Taker privacy (AC 38).** Student A's and B's `mock_tests_for_me` and `mock_test_open` never carry the other's score; a parent sees only their own attempt.
14. **ACL (arch 3.1).** For `mock_submit, mock_tests_for_me, mock_test_open, mock_test_results`: `prosecdef` true, `proconfig` is `search_path=""`, and no execute for `anon` or `public`; `authenticated` can execute. The two helpers: `proconfig`, immutable and strict (`provolatile = 'i'`, `proisstrict`).
15. **Attempts untouched.** `information_schema.role_table_grants` for `mock_test_attempts` and `mock_test_answers` still has no row for `anon`, `authenticated` or `PUBLIC`.

## 3. Service layer (`apps/web/src/services`)

### 3.1 Types (`types.ts`)

```
MockTestInput          = { title; instructions; passMark: number | null; tags: MockTags }
MockQuestionInput      + marks: number
MockAdminQuestion      + marks: number
MockTestDraftView      + passMark: number | null
MockTestListItem       + percentage: number | null; passed: boolean | null
MockTakeQuestion       + marks: number; marksEarned?: number     // marksEarned only once submitted
MockTestView           + totalMarks: number; passMark: number | null;
                         percentage: number | null; passed: boolean | null
MockResult             = { score: number; total: number; percentage: number; passed: boolean | null }

export type MockResultRow = {
  attemptId: string;            // a React key only; it opens nothing
  takerName: string | null;     // null: the page shows the constants fallback
  submittedAt: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean | null;       // null: no pass mark, no label
};

export type MockTestResultsView = {
  testId: string;
  title: string;
  status: MockTestStatus;
  closesAt: string | null;
  passMark: number | null;
  rows: MockResultRow[];
  totalRows: number;            // rows before the 1000-row limit; rows.length < totalRows means truncated
};
```
`MockTestSummary` is unchanged (no name or score on the admin list, AC 39).

### 3.2 Rows and mappers (`mock-tests-data.ts`)

- `MockListRow` gains `percentage: number | null; passed: boolean | null`. `MockQuestionRow` gains `marks: number`; `MOCK_QUESTION_COLUMNS` becomes `'id, position, prompt, options, marks, correct_option, explanation'`.
- `MockOpenJson` gains `total_marks: number; pass_mark: number | null; percentage: number | null; passed: boolean | null`, and each question `marks: number; marks_earned?: number`.
- New `MockResultRowJson = { attempt_id; taker_name: string | null; submitted_at; score; total; percentage; passed: boolean | null; total_rows: number }`.
- `toMockAdminQuestion` copies `marks`. `toMockTestListItem` copies `percentage`, `passed`. `toMockTakeQuestion` copies `marks` and sets `marksEarned` only when `marks_earned !== undefined` (the same pattern as `correctOption`). `toMockTestView` copies `totalMarks`, `passMark`, `percentage`, `passed`.
- New `toMockResultRow(json): MockResultRow`.

### 3.3 Functions (`mock-tests.service.ts`)

- `getMockTestForEdit`: the test `select` adds `pass_mark`; the result gains `passMark: test.data.pass_mark`.
- `createMockTest` and `updateMockTest`: the payload adds `pass_mark: input.passMark` (null clears it on a draft).
- `saveMockQuestion`: `columns` adds `marks: input.marks`.
- `submitMockTest`: unchanged code; `data as MockResult` now carries the two new keys.
- **New** `getMockTestResults(testId: string): Promise<Result<MockTestResultsView>>`:
  1. `getAdminClient()`; null returns `fail('notAllowed')` with no request (same as `listMockTestsAdmin`).
  2. `supabase.from('mock_tests').select('id, title, status, closes_at, pass_mark').eq('id', testId).maybeSingle()`: error returns `fail(toErrorKey(error))`; no row returns `fail('notFound')`.
  3. `supabase.rpc('mock_test_results', { target: testId })`: error returns `fail(toErrorKey(error))` (`not_admin` maps to `notAllowed`, `not_found` to `notFound`, both already in `auth-errors.ts`).
  4. `succeed({ testId, title, status, closesAt, passMark, rows: data.map(toMockResultRow), totalRows: data[0]?.total_rows ?? 0 })`.
- Export `getMockTestResults`, `MockResultRow`, `MockTestResultsView` from `services/index.ts`. Regenerate `database.types.ts` against the local DB only (the Dev Lead owns the stack).

### 3.4 Errors (`auth-errors.ts`)

No new key. A direct out-of-range marks or pass mark is `23514` and maps to `invalidInput` (the dialogs validate first, so this is the backstop). A write to a released test is `mock_released` (existing). The results function's refusals use existing keys.

## 4. Constants (every new user-facing string, verbatim)

All in typed constants, no text in components (memory: no magic strings, lint-enforced). Existing constants are reused where they exist; the second column says so.

### 4.1 `constants/mock-tests.constants.ts`

```ts
// MOCK_TEST_LIMITS gains (the database check is the same 1 to 100, kept equal by a parity test):
//   passMarkMin: 1, passMarkMax: 100

export const MOCK_SCORING = {
  marksLabel: QUESTION_DIALOG.marksLabel,                 // 'Marks'
  marks: QUESTION_BUILDER.marks,                          // '1 mark' / 'N marks'
  totalMarks: QUESTION_BUILDER.total,                     // 'Total 1 mark' / 'Total N marks'
  passMarkLabel: 'Pass mark (%, optional)',
  passMarkHint: 'A whole number from 1 to 100. Leave it empty for no pass mark. It can’t be changed after release.',
  passMarkLine: (percent: number) => `Pass mark: ${percent}%`,
  noPassMark: 'No pass mark',
  scoringHeading: 'Scoring',
} as const;

export const MOCK_PASS_LABELS = { pass: 'Pass', notYet: 'Not yet' } as const;

export const MOCK_RESULTS_PAGE = {
  title: (testTitle: string) => `Results: ${testTitle}`,
  intro: 'Everyone who has submitted this mock test, newest first. Names and scores only. Answers are not shown.',
  back: '← Back to mock test',
  viewResults: 'Results',
  viewResultsFor: (testTitle: string) => `Results for ${testTitle}`,
  tableLabel: 'Mock test results',
  columns: { name: 'Name', submitted: 'Submitted', score: 'Score', percentage: 'Percentage', result: 'Result' },
  nameNotSet: 'Name not set',
  score: (score: number, total: number) => `${score} of ${total} marks`,
  percent: (percentage: number) => `${percentage}%`,
  empty: 'No one has submitted this test yet.',
  showing: (shown: number, total: number) => `Showing ${shown} of ${total} submissions. The oldest are not listed.`,
} as const;
```
Changes to existing objects in the same file:

| Object | Change |
|---|---|
| `MOCK_RESULT.score` (line 260) | `(score: number, total: number, percentage: number) => \`${score} of ${total} marks (${percentage}%)\`` |
| `MOCK_RESULT` | adds `questionMarks: (earned: number, marks: number) => \`${earned} of ${marks} marks\`` |
| `MOCK_TAKE_PAGE` | adds `marks: QUESTION_BUILDER.marks`, `totalMarks: QUESTION_BUILDER.total`, `passMark: MOCK_SCORING.passMarkLine` (an alias: the literal is defined once) |
| `MOCK_TESTS_ADMIN_PAGE.columns` | no new key: the Results column header and the link text both use `MOCK_RESULTS_PAGE.viewResults` (one literal) |
| `MOCK_VALIDATION` | adds `marks: QUESTION_VALIDATION.marksRange` and `passMark: \`Please enter a whole number from ${MOCK_TEST_LIMITS.passMarkMin} to ${MOCK_TEST_LIMITS.passMarkMax}, or leave the pass mark empty.\`` |

### 4.2 `constants/routes.constants.ts` and `portal.constants.ts`

- `PORTAL_ROUTE_PATTERNS.adminMockTestResults: '/portal/admin/mock-tests/:testId/results'`.
- `adminMockTestResultsPath(testId: string): string` returning `` `${adminMockTestPath(testId)}/results` ``, next to `adminMockTestPath` (line 81).
- `PORTAL_SEO.adminMockTestResults: 'Mock test results'`.

## 5. Pure helpers (`lib/mock-tests.ts`, with tests)

| Function | Rule |
|---|---|
| `mockScoreText(score, total, percentage)` | `MOCK_RESULT.score(score, total, percentage)` (signature gains the third argument) |
| `validatePassMarkText(text): string \| undefined` | blank (after trim) is fine; otherwise `Number(text)` must be an integer from `passMarkMin` to `passMarkMax`, else `MOCK_VALIDATION.passMark` (refuses 0, -1, 60.5, 101, "abc") |
| `passMarkFromText(text): number \| null` | blank gives null, else `Number(text)`; called only after validation |
| `validateMockTest(input)` | parameter type becomes `Pick<MockTestInput, 'title' \| 'instructions'> & { passMarkText: string }`; `MockTestErrors` gains `passMark`; adds the pass mark check |
| `validateMockQuestion(input)` | input gains `marks: number`; `MockQuestionErrors` gains `marks`; error `MOCK_VALIDATION.marks` when not an integer from `QUESTION_LIMITS.marksMin` to `marksMax` (the check `lib/questions.ts` lines 34-40 uses) |
| `mockResultName(name: string \| null)` | `name ?? MOCK_RESULTS_PAGE.nameNotSet` |
| `mockPassLabel(passed: boolean \| null)` | `null` gives `''`, true `MOCK_PASS_LABELS.pass`, false `MOCK_PASS_LABELS.notYet` |
| `mockResultsTruncated(view)` | `view.rows.length < view.totalRows` |

`totalMarks` from `lib/questions.ts` (line 47) is reused for AC 4: `MockAdminQuestion` has `marks`, so it satisfies `Pick<Question, 'marks'>`.

## 6. Components and routes

All MUI, the existing idioms, no inline `style`, no HTTP in components, `key` on every list.

### 6.1 Changed components

1. **`MockQuestionDialog`**: new `marksText` state (`String(existing?.marks ?? 1)`), a `TextField` below the options and above the explanation, copied from `QuestionDialog.tsx` lines 185 to 197 (label `MOCK_SCORING.marksLabel`, `type="number"`, `min/max/step` from `QUESTION_LIMITS`, `sx={{ maxWidth: 160 }}` as there, `error`/`helperText` from `errors.marks`). `handleSubmit` passes `marks: Number(marksText)`. Only drafts reach this dialog (AC 3): `MockQuestionList` already hides Edit and Add when not `editable`.
2. **`MockQuestionList`**: the card header shows the question's marks, `MOCK_SCORING.marks(question.marks)`, as a `Typography variant="body2" color="textSecondary"` beside the number; the section's `action` becomes a column or wrapped pair: `MOCK_QUESTION_LIST.count(n)` and `MOCK_SCORING.totalMarks(totalMarks(questions))` (AC 4, next to the question count).
3. **`MockTestDialog`**: `passMarkText` state (`existing?.passMark?.toString() ?? ''`), a `TextField type="number"` after the instructions, labelled `MOCK_SCORING.passMarkLabel`, helper `errors.passMark || MOCK_SCORING.passMarkHint`. `existing` gains `passMark`. `handleSubmit` validates with `validateMockTest({ title, instructions, passMarkText })` and sends `passMark: passMarkFromText(passMarkText)` in the input. A blank saves null.
4. **`MockTestTakeForm`**: under the "Question n of m" heading in `TakeQuestion`, `Typography variant="body2" color="textSecondary"` with `MOCK_TAKE_PAGE.marks(question.marks)` (AC 10, SC13). No other change; submit still ignores the reply body.
5. **`MockTestResult`**: the heading card shows `mockScoreText(score, total, percentage)` and, when `passed !== null`, `<MockPassChip passed={passed} />` next to it. Each `ResultQuestion` shows `MOCK_RESULT.questionMarks(question.marksEarned, question.marks)` as `body2` text under the title, only when `marksEarned` is a number. A `MockTestView` with `percentage` null falls back to no percentage (cannot happen once submitted; the guard is for the types).
6. **`MockTestStatusChips.tsx`**: new `MockPassChip({ passed })`: `Chip size="small" variant="outlined"` with no `color` prop and `label` from `mockPassLabel`. Neutral for both words (AC 16).

### 6.2 Changed pages

- **`routes/portal/mock-test.tsx`** (`Intro`): under the question count add `MOCK_TAKE_PAGE.totalMarks(test.totalMarks)`, and when `test.passMark !== null` `MOCK_TAKE_PAGE.passMark(test.passMark)` (AC 11). No score or answer here.
- **`routes/portal/mock-tests.tsx`** (taker list): the submitted line becomes `mockScoreText(item.score, item.total, item.percentage)` (guard adds `item.percentage !== null`) plus `MockPassChip` when `item.passed !== null`, in the existing wrapped row. Closed-and-submitted rows already show; they now also carry the percentage and label (AC 25).
- **`routes/portal/admin-mock-tests.tsx`**: a final column headed `MOCK_RESULTS_PAGE.viewResults` with `Link component={RouterLink} to={adminMockTestResultsPath(test.id)} aria-label={MOCK_RESULTS_PAGE.viewResultsFor(test.title)}` reading `MOCK_RESULTS_PAGE.viewResults` (AC 28: every row, any status). The comment at the top ("no taker names or scores", AC 24) is updated to say names and scores live only on the Results page (AC 39).
- **`routes/portal/admin-mock-test.tsx`**: a `Results` outlined `Button component={RouterLink}` to the results path, first in the actions of both the draft and the released groups (shown for every status). A new `SectionCard` titled `MOCK_SCORING.scoringHeading`, placed after Tags, shows `MOCK_SCORING.totalMarks(totalMarks(test.questions))` and `test.passMark === null ? MOCK_SCORING.noPassMark : MOCK_SCORING.passMarkLine(test.passMark)` as two `Typography` lines. It is read-only on every status (AC 9: on a released or closed test the pass mark is shown with no control; on a draft it changes in Edit details). `MockTestDialog` receives `existing={test}`, which now has `passMark`.

### 6.3 New: the admin Results page

**`routes/portal/admin-mock-test-results.tsx`**, registered in `routes.ts` inside the admin layout after `adminMockTest`: `route(PORTAL_ROUTE_PATTERNS.adminMockTestResults, 'routes/portal/admin-mock-test-results.tsx')`. `/results` is a longer path than `:testId`, so the two cannot clash.

```
meta()          -> buildPortalMeta(PORTAL_SEO.adminMockTestResults)
clientLoader    -> getMockTestResults(params.testId ?? '')       // the layout refuses non-admins; the service sends no request for them
ErrorBoundary() -> <MockTestsErrorBoundary />                    // same pattern as admin-mock-test.tsx:59-60 (AC 46)
default         -> AdminMockTestResultsPage
```
**Page states** (AC 34, 46; the "1000" case):

| State | What shows |
|---|---|
| Loading | The client loader runs before render, as on every other mock page; React Router keeps the old page until it resolves. No spinner is added (house pattern). |
| Load failed (`!loaded.ok`) | `notFound` shows `<NotFoundPanel />`; any other error shows `<LoadError error retry />` (plain `PORTAL_ERRORS` text and a Try again button). A thrown render error is caught by the route's `ErrorBoundary`. |
| Empty | `PageHeader` as below, then `Typography color="textSecondary"` with `MOCK_RESULTS_PAGE.empty`; no table. |
| Rows | `TableContainer` + `Table size="small"` with `aria-label={MOCK_RESULTS_PAGE.tableLabel}`, one header row of five `TableCell`s in this order: Name (`mockResultName(row.takerName)`), Submitted (`formatDateTime(row.submittedAt)`), Score (`MOCK_RESULTS_PAGE.score(row.score, row.total)`), Percentage (`MOCK_RESULTS_PAGE.percent(row.percentage)`), Result (`mockPassLabel(row.passed)`, an empty cell when null). Each row `key={row.attemptId}`. The name cell uses `overflowWrap: 'anywhere'` like the other tables. |
| More than 1000 | When `mockResultsTruncated(view)`, a `Typography color="textSecondary"` above the table reads `MOCK_RESULTS_PAGE.showing(rows.length, totalRows)` ("Showing 1000 of 1500 submissions. The oldest are not listed."). The table still shows the newest 1000. No pagination in v1 (Arch 3.4). |

`PageHeader`: `title={MOCK_RESULTS_PAGE.title(view.title)}`, `intro={MOCK_RESULTS_PAGE.intro}`, `back={{ to: adminMockTestPath(view.testId), label: MOCK_RESULTS_PAGE.back }}`, `meta` with `MockClosedChip` when `mockClosingState(view.closesAt, new Date()) === 'closed'` and the pass mark line (`MOCK_SCORING.passMarkLine`) when set. No buttons: no write control, no export, no filter, no link to an answer (AC 35). The page renders no e-mail because none is returned.

New small component: **`MockResultsTable`** (`components/portal/MockResultsTable.tsx`), props `{ rows: MockResultRow[] }`, so the page file stays short and the table is testable alone. Export from `components/portal/index.ts`, with `MockPassChip`.

## 7. Files to touch

| File | New / changed |
|---|---|
| `supabase/migrations/20261121100000_mock_test_scoring.sql` | new (section 1.3, verbatim) |
| `supabase/tests/database/mock_tests_scoring.test.sql` | new |
| `supabase/tests/database/mock_tests_categories.test.sql`, `mock_tests_taker.test.sql`, `open_sign_up_access.test.sql` | changed (2.1) |
| `apps/web/src/services/types.ts`, `mock-tests-data.ts`, `mock-tests.service.ts`, `index.ts` | changed |
| `apps/web/src/services/database.types.ts` | regenerated (local DB) |
| `apps/web/src/services/mock-tests.service.test.ts` | changed (marks, pass_mark payloads; `getMockTestResults`; mapper keys) |
| `apps/web/src/constants/mock-tests.constants.ts`, `routes.constants.ts`, `portal.constants.ts` | changed |
| `apps/web/src/lib/mock-tests.ts`, `lib/mock-tests.test.ts` | changed (also line 162-163: `'3 of 5 correct'` becomes `mockScoreText(3, 5, 60)` giving `'3 of 5 marks (60%)'`) |
| `apps/web/src/lib/mock-tests-scope.test.ts` | changed (AC 50: add `MOCK_SCORING`, `MOCK_RESULTS_PAGE`, `MOCK_PASS_LABELS`, `MockResultsTable`, `MockPassChip` to `TAG_NAMES`; the sitemap check already forbids `mock_test`) |
| `apps/web/src/lib/mock-test-scoring.parity.test.ts` | new (limits and no-attempt-writes, section 8) |
| `apps/web/src/components/portal/MockResultsTable.tsx` + `.test.tsx` | new |
| `apps/web/src/components/portal/MockTestStatusChips.tsx`, `MockQuestionDialog.tsx`, `MockQuestionList.tsx`, `MockTestDialog.tsx`, `MockTestTakeForm.tsx`, `MockTestResult.tsx`, `index.ts` | changed |
| `apps/web/src/components/portal/MockQuestionDialog.test.tsx`, `MockTestDialog.test.tsx`, `MockTestTakeForm.test.tsx`, `MockTestResult.test.tsx` | changed (marks field, pass mark field, marks line, result line; `MockTestResult.test.tsx:41-43` `'1 of 2 correct'` becomes the marks wording with its percentage; the file comment at `MockTestResult.tsx` line 1, which says "N of M correct", is reworded to "N of M marks") |
| `apps/web/src/routes/portal/admin-mock-test-results.tsx` + `.test.tsx` | new |
| `apps/web/src/routes/portal/admin-mock-test.tsx`, `admin-mock-tests.tsx`, `mock-test.tsx`, `mock-tests.tsx` | changed |
| `apps/web/src/routes/portal/admin-mock-test.test.tsx`, `admin-mock-tests.test.tsx`, `mock-test.test.tsx`, `mock-tests.test.tsx` | changed (fixtures gain the new fields; the pins `mock-tests.test.tsx:120,135,146` (`'4 of 5 correct'`, `/of \d+ correct/`) and `mock-test.test.tsx:195` (`'1 of 2 correct'`) move to the marks wording) |
| `apps/web/src/routes/portal/mock-tests-load-error.test.tsx` | changed (add the Results page to its table of pages, AC 46) |
| `apps/web/src/routes.ts` | changed (one `route(...)` line) |
| `e2e/tests/mock-tests.selectors.ts`, `mock-tests.spec.ts` | changed (selector `score` at line 64 reads `${score} of ${total} marks`; spec lines 213 and 246 `'1 of 2 correct'` become `'1 of 2 marks (50%)'`; new case in section 8) |
| `docs/decisions/0012-…md` | Architect's, Amendment 3 already written |

Any other file that builds a `MockTestView`, `MockTestListItem`, `MockAdminQuestion`, `MockTestDraftView`, `MockResult` or `MockQuestionInput` fails typecheck until it gains the new fields; `grep -rlE "MockTestView|MockTestListItem|MockAdminQuestion|MockTestDraftView|MockResult|MockQuestionInput" apps/web/src` is the list (the four route tests, the four component tests and the service test above cover it).

Not touched: the three applied mock migrations, `mock_tests_admin_list`, public pages, sitemap, e-mail templates, mobile, edge functions, `QUESTION_LIMITS`. Build note: stage explicit paths only; the tree holds untracked files that are not this feature (`actionItems.md`, `brand/email/`, `docs/contracts/`, `docs/requirements/seo-audit-2026-11-14.md`).

## 8. Test approach per AC

**P** = pgTAP (`mock_tests_scoring.test.sql`, case numbers from 2.2; the existing files re-run). **V** = vitest, co-located. **E** = Playwright. **M** = real browser by the Tester at 375 and 1280 px, light and dark.

**Parity and guard test `lib/mock-test-scoring.parity.test.ts`** (reads migration text the way `mock-test-options.parity.test.ts` does): (a) the migration's `marks between 1 and 100` and `pass_mark between 1 and 100` literals equal `QUESTION_LIMITS.marksMin/Max` and `MOCK_TEST_LIMITS.passMarkMin/Max`; (b) the file has exactly one `update public.mock_test_attempts` (inside `mock_submit`) and no `insert into`, `delete from` or `alter table` on it (AC 41); (c) the file contains no `create or replace function public.mock_release`, `mock_start`, `mock_save_answer` (unchanged functions stay unchanged).

| AC | Proof |
|---|---|
| 1 | P 1 (default 1, bounds). V parity (a). |
| 2 | V `MockQuestionDialog`: blank, 0, -1, 2.5, 101 each show `MOCK_VALIDATION.marks` and `saveMockQuestion` is not called; 1 and 100 save with `marks`. E: set marks 3 on a question. |
| 3 | P 2 (released question marks write and insert refused `mock_released`). V: the released edit page has no Edit or Add button and no Marks field. |
| 4 | V `admin-mock-test`: marks 2 and 3 show "Total 5 marks" next to "2 of 100 questions"; one question of 1 mark shows "Total 1 mark". |
| 5 | P 2 and the existing closing cases: release with questions and no pass mark works; zero questions still `mock_no_questions`. |
| 6 | P 1 (insert and update 1, 100, null on a draft). V `MockTestDialog`: sends `passMark: 60`, blank sends null. E. |
| 7 | P 1 (0, -1, 101 refused 23514). V `validatePassMarkText`: 0, -1, 60.5, 101, "abc" refused with `MOCK_VALIDATION.passMark`, nothing saved; 1, 100, blank accepted. A direct `60.5` is stored as 61 (decision 9), so the decimal refusal is web-only. |
| 8 | P 6 (`passed` null with no pass mark on submit, list, open and results). V: `MockPassChip` for null renders nothing; result and list show no label. |
| 9 | P 2 (released and closed pass-mark change `mock_released`, same value accepted, kept after withdraw). V: the released edit page shows "Pass mark: 60%" and no control for it. |
| 10 | V `MockTestTakeForm`: "1 mark" and "3 marks" under the heading. M. |
| 11 | P 6 (not-started open has `total_marks`, `pass_mark`, null score, empty questions). V `Intro`: "Total N marks" and "Pass mark: 60%" with a pass mark; neither pass line without one; no score or answer text. |
| 12 | P 6 (in-progress open: no `marks_earned`, no `correct_option`, null `percentage` and `passed`; the taker file regex gains `marks_earned`). V: the take form shows no score, percentage or label. |
| 13 | P 4 (3/2/5 marks, 8 of 10; blank adds 0). |
| 14 | P 3 (helper table) and P 5. V: the page prints the database's percentage (66 shows "66%"). |
| 15 | V `MockTestResult`, `mock-tests.tsx`, `mock-test.tsx`: "34 of 50 marks (68%)" in list and result. P 6. E (submit then list and result agree). |
| 16 | V: `MockPassChip` has no colour prop and no grade or band words render anywhere. M. |
| 17 | P 5 and the existing `mock_no_questions` case (a released test has at least 1 mark). |
| 18 | P 3 and P 5 (exact comparison, 400 x 100 product). |
| 19 | V result and list render "Pass" or "Not yet" next to the score. P 6. |
| 20 | P 6 and V: no pass mark gives no label and still shows the percentage. |
| 21 | P 3 ((3,5,60) true, (59,100,60) false) and the same pair as an end-to-end submit in P 4. V renders both words. |
| 22 | P 7 (`marks_earned`). V `MockTestResult`: "2 of 3 marks" on a question, beside the correct option and explanation. |
| 23 | P 7 (sum equals score for every submitted attempt, legacy-shaped included). |
| 24 | P 4 (repeat submit identical `jsonb`, percentage and passed included) and the existing closing cases. |
| 25 | P 9. V: closed and submitted row shows the Closed chip, score, percentage and label; the result page opens. |
| 26 | P 9 and the existing `mock_tests_closing.test.sql`, re-run. |
| 27 | P 9 (repeat submit on a closed test is `not_found`, the result still opens). |
| 28 | V `admin-mock-tests`: every row has a Results link named "Results for {title}", draft and closed included; `admin-mock-test`: a Results button on a draft and a released test. P 10 (draft zero rows, closed same rows). |
| 29 | V `admin-mock-test-results`: five column headers in the order Name, Submitted, Score, Percentage, Result. P 10 (exact column list). |
| 30 | P 11 (profile name, roster name, null; whitespace is blank). V: null shows "Name not set"; no `@` in any cell. |
| 31 | P 8 (legacy-shaped attempt: row present, percentage derived, passed null). |
| 32 | P 10 (a closed test returns the same rows as before closing). V: Closed chip on the page. |
| 33 | P 10 (in-progress absent; row count equals the admin list's `submitted_count`). |
| 34 | P 10 (order and tie-break). V: empty state shows exactly "No one has submitted this test yet." and no table. |
| 35 | P 10 (no answer, e-mail or id-of-person column; no `@`). V: the page has no button, form or answer text; P 15 (attempts and answers still no grant). |
| 36 | P 12 (admin aal2 gets rows; admin aal1 gets `not_admin`). E or M: an admin signed in without two-step is stopped by the layout before the page. |
| 37 | P 12 (matrix: tutor, parent, student, user, inactive admin, anon). V: the route is registered inside the admin layout (`routes.ts` parse test, or assert the file position). E or M: each of the four roles opens the URL and sees the existing not-allowed page (the Tester checks each role separately). |
| 38 | P 13. |
| 39 | The existing admin-list key pin (`mock_tests_admin.test.sql:453-456`) re-run unchanged; V: the admin list page still shows no name or score column. |
| 40 | P 8 and recipe 1.5.6 (every existing question reads 1). |
| 41 | Parity test (b) and recipe 1.5.6 (byte-identical before and after). |
| 42 | Recipe 1.5.6 and P 8: same N and M, read as marks. |
| 43 | P 8 (close, reopen, tag edit leave score and total unchanged). |
| 44 | P 4 (in-progress attempt scored at submit from frozen marks and key). |
| 45 | P 8 and P 6 (old tests: `pass_mark` null, no label). |
| 46 | V: the route module exports `ErrorBoundary` rendering `MockTestsErrorBoundary`; `mock-tests-load-error.test.tsx` gains the Results page (plain message and Try again); a `notFound` load shows `NotFoundPanel`. |
| 47 | The scope grep is the main check, because `react/jsx-no-literals` has `ignoreProps: true` and misses props and template strings: V greps the new and changed components and routes for quoted prose and for the old word "correct" in result text. Plus the lint rule and V: the constants objects hold every string in section 4; the scope test (AC 50 row) greps the new components for quoted prose. |
| 48 | V: `getByLabelText('Marks')` and the pass mark label exist and are keyboard-reachable; `getAllByRole('columnheader')` has five; M keyboard walk. |
| 49 | M: Results page, marks and pass mark fields, start page, result at 375 and 1280, light and dark (the table scrolls inside `TableContainer`, not the page). |
| 50 | V `mock-tests-scope.test.ts` extended (the new names appear only under `routes/portal` and `components/portal`, never in `routes.ts`'s sitemap source or the e-mail templates); P/V: no price or payment text in any new constant. |
| 1000-row case | V `admin-mock-test-results`: rows 2 and `totalRows` 1500 shows "Showing 2 of 1500 submissions. The oldest are not listed."; rows equal to total shows no note. Service V: `total_rows` of the first row becomes `totalRows`; zero rows give 0. |

**E2E (one new case in `mock-tests.spec.ts`).** Admin creates a test with a question worth 3 and a pass mark of 60, a second question worth 2, tags it and releases it; a student answers only the 3-mark question and submits; the card and result read "3 of 5 marks (60%)" with "Pass"; the admin opens Results from the list and sees the student's name and the row. The Tester drives it; the Developer writes the selectors.

## 9. The two-session pass-mark race (must-pass gate, Arch 4)

Claim: a pass-mark write that waits behind `mock_release` is refused with `mock_released` once the release commits. Run on the **local** DB only, by the Dev Lead (a committed write, so not from pgTAP), as an admin at aal2 in two `psql` sessions. Each session sets its caller with `set role authenticated; select set_config('request.jwt.claims', '{"sub":"<admin id>","role":"authenticated","aal":"aal2"}', false);`. Set-up: one fully tagged draft test with one question and `pass_mark` 50, created and committed. Remove it afterwards (delete the test, which is a draft or, if released, only by the owner `delete` after `mock_withdraw`).

1. **Order A (release first).** Session 1: `begin; select public.mock_release('<id>');` and stay open. Session 2: `update public.mock_tests set pass_mark = 80 where id = '<id>';` (blocks). Session 1: `commit;`. Session 2 must fail with message `mock_released`, and `select pass_mark` afterwards is still 50. A pass is a refusal; a success writing 80 on a released test is the failure.
2. **Order B (pass mark first).** Session 1: `begin; update public.mock_tests set pass_mark = 80 where id = '<id2>';` open. Session 2: `select public.mock_release('<id2>');` (blocks). Session 1: `commit;`. Session 2 releases with `pass_mark` 80 (the release reads the committed row). After that, a further `update … set pass_mark = 60` is refused. The released test's pass mark is whichever committed first; it never changes after release.
3. **Mirror with a submit.** With the test released and one attempt in progress: session 1 `begin; select public.mock_submit(...)` for the attempt (holds the test `for share`), session 2 `update … set pass_mark = 10` as admin blocks until the submit commits, then is refused (released), proving the share lock plus the freeze keep the label stable across a submit.
4. Paste the raw `psql` output of all three into the test report. If order A succeeds, switch the trigger to the locked re-read in 1.5.2 and re-run; the gate does not pass without this case.

## 10. Sequencing and integration

1. Migration and pgTAP first (nothing in the web reads the new keys until the database has them). Run the whole pgTAP suite: all four mock files and `open_sign_up_access.test.sql`.
2. Regenerate `database.types.ts` from the local DB, then types, mappers, service, constants, helpers, components, routes, in that order; the typecheck is the guide (every fixture that lacks the new fields fails).
3. Vitest, full web check (format, lint, typecheck, vitest, build), then e2e on the local stack.
4. Staging: the migration reaches the one shared hosted DB when applied (ruling L-7: no guard); `mock_test_results` is admin-only at aal2 from that moment (L-6). The web build for staging is rebuilt from `develop` in the same step. Production `main` has no mock UI. The Privacy Policy line stays the gate before the merge to `main` (L-6), and nothing here deploys anything.
5. New dependencies: none. Cost: none. New services: none.

## 11. Risks

- **R-D1 Replacing three live functions.** Bodies copied from the latest definitions (1.2); a wrong source would silently regress closing or categories. Mitigation: closing and categories pgTAP re-run, and the Reviewer diffs each body.
- **R-D2 Pass-mark race.** Unproven until section 9 runs; fallback stated in 1.5.2.
- **R-D3 Wide fixture churn.** The new required fields break many existing test fixtures at typecheck; expected, listed in section 7.
- **R-D4 Decimal pass mark** is refused in the web only; a direct write of `60.5` is stored as 61 (decision 9).
- **R-D5 "1 of 1 marks"** reads oddly (L-4 fixed the wording; decision 7).
- **R-D6 Name column** shows names beside scores to admins (R-S1); admin-only at aal2, privacy line gates `main`.
- **R-D7 1000-row ceiling** is never silent (`total_rows`), no pagination in v1.

## 12. Assumptions recorded

- [ASSUMPTION] Pass and Not yet chips are neutral, not green (decision 6, AC 16).
- No visible "practice only" note: ruled L-9 (not an assumption).
- [ASSUMPTION] Results link on every admin list row as well as on the edit page (AC 28 asks for the list; the brief also asked for the edit page).
- [ASSUMPTION] "N of M marks" printed as `score of total marks (percentage%)` on one line in the list and result.
- [ASSUMPTION] The Results page shows the pass mark and Closed chip in its header; AC 29 lists only the table columns, so these are extras that cost nothing.
- [TBC: none] Nothing here needs Saurabh or the client; the privacy gate and the shared-database risk are already ruled (L-6, L-7).
