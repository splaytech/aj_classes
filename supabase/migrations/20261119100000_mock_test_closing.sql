-- Mock tests: closing date and close now (docs/delivery/2026-11-18-mock-test-closing/01-requirement.md).
--
-- One nullable column, mock_tests.closes_at. A released test is open while closes_at is null or
-- in the future, and closed from closes_at on: "Close now" sets it to now(), so expiry and
-- deactivation are the same state. Closing is decided on every read (AC 8): no scheduled job.
--
-- closes_at is written only by the functions below (never column-granted to authenticated). The
-- taker functions are replaced with the same bodies plus the closed check (AC 5, ruling S-1): a
-- taker who submitted before closing still lists and opens the test and their result; for everyone
-- else a closed test is "not found". Start, save and submit refuse a closed test for everyone, and
-- an in-progress attempt is never auto-submitted. Lock order is unchanged: test row first, then
-- the attempt row.
--
-- 20261118100000_mock_tests.sql is already applied to the hosted database and is not edited.

alter table public.mock_tests
  add column closes_at timestamptz,
  -- A draft never carries a closing time: mock_withdraw clears it on the way back (AC 7).
  add constraint mock_tests_closes_only_released check (closes_at is null or status = 'released');

comment on column public.mock_tests.closes_at is
  'When a released test closes for takers; null means it never closes. Set only by mock_release, mock_set_closing and mock_close_now.';

-- ---------------------------------------------------------------------------
-- Admin functions
-- ---------------------------------------------------------------------------

-- The list gains closes_at, so the return type changes: drop and create (create or replace can't
-- change it). Same body otherwise.
drop function public.mock_tests_admin_list();

create function public.mock_tests_admin_list()
returns table (
  id              uuid,
  title           text,
  status          text,
  question_count  int,
  submitted_count int,
  created_by_name text,
  created_at      timestamptz,
  updated_at      timestamptz,
  released_at     timestamptz,
  closes_at       timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
    select t.id, t.title, t.status,
           (select count(*) from public.mock_test_questions q where q.test_id = t.id)::int,
           (select count(*) from public.mock_test_attempts a
            where a.test_id = t.id and a.submitted_at is not null)::int,
           p.full_name,
           t.created_at, t.updated_at, t.released_at, t.closes_at
    from public.mock_tests t
    left join public.profiles p on p.id = t.created_by
    order by t.updated_at desc, t.id;
end;
$$;

-- Release gains an optional closing time. The one-argument version is dropped rather than kept as
-- an overload: PostgREST can't choose between mock_release(uuid) and a two-argument version with
-- a default when the call names only target. A call with only target still works (closes = null).
drop function public.mock_release(uuid);

create function public.mock_release(target uuid, closes timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  test_status text;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select t.status into test_status from public.mock_tests t where t.id = target for update;
  if not found then
    perform private.raise_mock_not_found();
  end if;
  if test_status <> 'draft' then
    raise exception 'invalid_status';
  end if;
  if not exists (select 1 from public.mock_test_questions q where q.test_id = target) then
    raise exception 'mock_no_questions';
  end if;
  -- now() itself counts as closed, so it is refused too (AC 1).
  if closes <= now() then
    raise exception 'mock_closes_in_past';
  end if;

  update public.mock_tests
  set status = 'released', released_at = now(), released_by = auth.uid(), closes_at = closes
  where id = target;
end;
$$;

-- Set, change or clear the closing time of a released test, open or closed (AC 2, 4). Null clears
-- it, so a closed test opens again.
create function public.mock_set_closing(target uuid, closes timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  test_status text;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select t.status into test_status from public.mock_tests t where t.id = target for update;
  if not found then
    perform private.raise_mock_not_found();
  end if;
  if test_status <> 'released' then
    raise exception 'invalid_status';
  end if;
  if closes <= now() then
    raise exception 'mock_closes_in_past';
  end if;

  update public.mock_tests set closes_at = closes where id = target;
end;
$$;

-- Close an open released test at once, even with submitted attempts (AC 3). Already closed: no
-- change, so a second admin pressing a stale button keeps the first closing time.
create function public.mock_close_now(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  test record;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select t.status, t.closes_at into test from public.mock_tests t where t.id = target for update;
  if not found then
    perform private.raise_mock_not_found();
  end if;
  if test.status <> 'released' then
    raise exception 'invalid_status';
  end if;
  if test.closes_at <= now() then
    return;
  end if;

  update public.mock_tests set closes_at = now() where id = target;
end;
$$;

-- Same as before, and it also clears closes_at (AC 7).
create or replace function public.mock_withdraw(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  test_status text;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select t.status into test_status from public.mock_tests t where t.id = target for update;
  if not found then
    perform private.raise_mock_not_found();
  end if;
  if test_status <> 'released' then
    raise exception 'invalid_status';
  end if;
  -- A separate statement after the lock: mock_start holds the test row for share, so a start
  -- and a withdraw can't both win. Only a submitted attempt blocks (ruling L-5): otherwise anyone
  -- who signs up and presses Start could freeze a test with a wrong key for good.
  if exists (select 1 from public.mock_test_attempts a
             where a.test_id = target and a.submitted_at is not null) then
    raise exception 'mock_has_attempts';
  end if;

  -- In-progress attempts go with the release; their answers cascade. The submitted_at guard is a
  -- second line of defence: the test-row lock already keeps submits out.
  delete from public.mock_test_attempts a where a.test_id = target and a.submitted_at is null;

  update public.mock_tests
  set status = 'draft', released_at = null, released_by = null, closes_at = null
  where id = target;
end;
$$;

-- ---------------------------------------------------------------------------
-- Taker functions (AC 5, 8). Start, save and submit: the previous body plus
-- "and (t.closes_at is null or t.closes_at > now())" wherever it checks status = 'released'.
-- List and open: a closed test stays visible only to a caller whose attempt is submitted.
-- ---------------------------------------------------------------------------

-- The list gains closes_at, so the UI can mark a submitted, closed test: drop and create.
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
  closes_at      timestamptz
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
           a.score::int, a.total::int, a.submitted_at, t.released_at, t.closes_at
    from public.mock_tests t
    left join public.mock_test_attempts a on a.test_id = t.id and a.profile_id = me
    where t.status = 'released'
      and (t.closes_at is null or t.closes_at > now() or a.submitted_at is not null)
    order by t.released_at desc, t.id;
end;
$$;

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
         (t.closes_at is not null and t.closes_at <= now()) as closed
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
        'selected_option', ans.selected_option
      ) || case when revealed
             then jsonb_build_object('correct_option', q.correct_option, 'explanation', q.explanation)
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
    'score', case when revealed then attempt.score end,
    'total', case when revealed then attempt.total end,
    'submitted_at', case when revealed then attempt.submitted_at end,
    'closes_at', test.closes_at,
    'questions', questions
  );
end;
$$;

create or replace function public.mock_start(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.require_mock_taker();
begin
  -- Held for share through the insert, so a concurrent mock_withdraw or close (for update) waits
  -- for us; a start that waited for a close re-checks the row and is refused.
  perform 1 from public.mock_tests t
  where t.id = target and t.status = 'released' and (t.closes_at is null or t.closes_at > now())
  for share;
  if not found then
    perform private.raise_mock_not_found();
  end if;

  -- Idempotent: a double tap or a person who already submitted changes nothing.
  insert into public.mock_test_attempts (test_id, profile_id)
  values (target, me)
  on conflict (test_id, profile_id) do nothing;
end;
$$;

create or replace function public.mock_save_answer(target_test uuid, target_question uuid, chosen_option int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me           uuid := private.require_mock_taker();
  attempt      record;
  option_count int;
begin
  -- Lock order everywhere: test row, then attempt row (as mock_start and mock_submit). Holding
  -- the test for share keeps mock_withdraw (for update) out until this save commits, and a save
  -- that waited for a withdraw sees the test is no longer released.
  perform 1 from public.mock_tests t
  where t.id = target_test and t.status = 'released' and (t.closes_at is null or t.closes_at > now())
  for share;
  if not found then
    perform private.raise_mock_not_found();
  end if;

  -- Same lock as mock_submit, so a save can't land after a submit.
  select a.id, a.submitted_at into attempt
  from public.mock_test_attempts a
  where a.test_id = target_test and a.profile_id = me
  for update;
  if not found then
    raise exception 'mock_not_started';
  end if;
  if attempt.submitted_at is not null then
    raise exception 'already_submitted';
  end if;

  select cardinality(q.options) into option_count
  from public.mock_test_questions q
  where q.id = target_question and q.test_id = target_test;
  if not found then
    raise exception 'invalid_question';
  end if;
  if chosen_option is null or chosen_option < 0 or chosen_option >= option_count then
    raise exception 'invalid_option';
  end if;

  insert into public.mock_test_answers (attempt_id, question_id, selected_option)
  values (attempt.id, target_question, chosen_option)
  on conflict (attempt_id, question_id) do update set selected_option = excluded.selected_option;
end;
$$;

create or replace function public.mock_submit(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me         uuid := private.require_mock_taker();
  attempt    record;
  new_total  int;
  new_score  int;
begin
  -- Test row first, for share, then the attempt (same order as mock_start and mock_save_answer).
  -- mock_withdraw holds the test for update between its submitted-check and its delete, so a
  -- submit can't commit in that gap; a submit that waited for a withdraw is refused here.
  perform 1 from public.mock_tests t
  where t.id = target and t.status = 'released' and (t.closes_at is null or t.closes_at > now())
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
    return jsonb_build_object('score', attempt.score, 'total', attempt.total);
  end if;

  select count(*) into new_total from public.mock_test_questions q where q.test_id = target;
  -- Unanswered questions count as incorrect.
  select count(*) into new_score
  from public.mock_test_answers ans
  join public.mock_test_questions q on q.id = ans.question_id
  where ans.attempt_id = attempt.id and ans.selected_option = q.correct_option;

  update public.mock_test_attempts
  set submitted_at = now(), score = new_score, total = new_total
  where id = attempt.id;

  return jsonb_build_object('score', new_score, 'total', new_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: the new and re-created functions start closed, then authenticated only. The
-- replaced taker functions and mock_withdraw keep their grants; repeated here so this file
-- states the whole set.
-- ---------------------------------------------------------------------------

revoke execute on function public.mock_tests_admin_list() from public, anon, authenticated;
revoke execute on function public.mock_release(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.mock_set_closing(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.mock_close_now(uuid) from public, anon, authenticated;
revoke execute on function public.mock_withdraw(uuid) from public, anon, authenticated;
revoke execute on function public.mock_tests_for_me() from public, anon, authenticated;
revoke execute on function public.mock_test_open(uuid) from public, anon, authenticated;
revoke execute on function public.mock_start(uuid) from public, anon, authenticated;
revoke execute on function public.mock_save_answer(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.mock_submit(uuid) from public, anon, authenticated;

grant execute on function public.mock_tests_admin_list() to authenticated;
grant execute on function public.mock_release(uuid, timestamptz) to authenticated;
grant execute on function public.mock_set_closing(uuid, timestamptz) to authenticated;
grant execute on function public.mock_close_now(uuid) to authenticated;
grant execute on function public.mock_withdraw(uuid) to authenticated;
grant execute on function public.mock_tests_for_me() to authenticated;
grant execute on function public.mock_test_open(uuid) to authenticated;
grant execute on function public.mock_start(uuid) to authenticated;
grant execute on function public.mock_save_answer(uuid, uuid, int) to authenticated;
grant execute on function public.mock_submit(uuid) to authenticated;
