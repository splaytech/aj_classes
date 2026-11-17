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
