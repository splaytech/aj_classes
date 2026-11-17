-- Mock tests (ADR-0012; docs/delivery/2026-11-17-mock-tests/03-design.md §2).
--
-- Admins build multiple-choice mock tests; students, parents and signed-up users take released
-- ones once and see a score. Four own tables, separate from assignments. Admins write the two
-- draft tables directly (column-scoped grants plus RLS); everyone else, takers included, reaches
-- mock tests only through the public functions below. The attempts and answers tables have no
-- grant and no policy at all, so a taker can never read a correct option except through
-- mock_test_open after their own submit.
--
-- Additive: no existing table, function, policy or enum is changed.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.mock_tests (
  id           uuid primary key default gen_random_uuid(),
  title        text not null
    check (char_length(btrim(title)) >= 2 and char_length(title) <= 150),
  instructions text not null default ''
    check (char_length(instructions) <= 4000),
  status       text not null default 'draft'
    check (status in ('draft', 'released')),
  -- Nullable: an admin leaving must not delete the tests they wrote.
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  released_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  released_at  timestamptz,
  check ((status = 'released') = (released_at is not null))
);

create index mock_tests_status_idx on public.mock_tests (status);

comment on table public.mock_tests is
  'Multiple-choice mock tests. Admin-only through RLS; takers use the mock_* functions. Released tests are frozen.';

create table public.mock_test_questions (
  id             uuid primary key default gen_random_uuid(),
  test_id        uuid not null references public.mock_tests (id) on delete cascade,
  -- The trigger puts new questions last; deleting one leaves a gap, and the UI numbers by order.
  position       int not null default 1 check (position >= 1),
  -- Trims tabs and line breaks too (plain trim() only strips spaces), so a blank-looking prompt is refused.
  prompt         text not null check (char_length(btrim(prompt, E' \t\r\n')) >= 1 and char_length(prompt) <= 2000),
  options        text[] not null,
  correct_option smallint not null,
  explanation    text not null default '' check (char_length(explanation) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Checked at statement end, so mock_move_question can swap two rows in one update.
  constraint mock_test_questions_position_key unique (test_id, position) deferrable initially immediate,
  constraint mock_test_questions_shape check (
    cardinality(options) between 2 and 6
    and private.items_within_length(options, 300)
    and correct_option between 0 and cardinality(options) - 1
  )
);

comment on table public.mock_test_questions is
  'Questions of a mock test. correct_option is a 0-based index into options. Never readable by takers.';

create table public.mock_test_attempts (
  id           uuid primary key default gen_random_uuid(),
  test_id      uuid not null references public.mock_tests (id) on delete restrict,
  -- Erasure of a person removes their attempts.
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  score        smallint,
  total        smallint,
  unique (test_id, profile_id),  -- one attempt per person per test
  check (
    (submitted_at is null) = (score is null)
    and (score is null) = (total is null)
    and (score is null or score between 0 and total)
  )
);

create index mock_test_attempts_profile_idx on public.mock_test_attempts (profile_id);

comment on table public.mock_test_attempts is
  'One attempt per person per test. No grant and no policy: only the mock_* functions touch it.';

create table public.mock_test_answers (
  attempt_id      uuid not null references public.mock_test_attempts (id) on delete cascade,
  question_id     uuid not null references public.mock_test_questions (id) on delete cascade,
  selected_option smallint not null check (selected_option >= 0),
  primary key (attempt_id, question_id)
);

comment on table public.mock_test_answers is
  'A taker''s chosen option per question. No grant and no policy: only the mock_* functions touch it.';

create trigger mock_tests_set_updated_at
  before update on public.mock_tests
  for each row execute function private.set_updated_at();

create trigger mock_test_questions_set_updated_at
  before update on public.mock_test_questions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Freeze and lock triggers
-- ---------------------------------------------------------------------------

-- A released test can't be deleted or have its title or instructions changed. The status moves
-- only inside mock_release / mock_withdraw, which leave both columns alone.
create function private.check_mock_test()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'released' then
    if tg_op = 'DELETE'
       or new.title is distinct from old.title
       or new.instructions is distinct from old.instructions then
      raise exception 'mock_released';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger mock_tests_check
  before update or delete on public.mock_tests
  for each row execute function private.check_mock_test();

-- Question changes need a draft test. The test row is locked for update (not share: share locks
-- don't exclude each other, so two admins adding question 100 would both pass the count), which
-- also serialises question writes against mock_release. Same pattern as check_assignment_question.
-- Security definer because it bumps mock_tests.updated_at, a column admins have no update grant on.
create function private.check_mock_question()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_test uuid := case when tg_op = 'DELETE' then old.test_id else new.test_id end;
  test_status text;
begin
  select t.status into test_status
  from public.mock_tests t
  where t.id = target_test
  for update;

  if not found then
    -- The test itself is being deleted (cascade): nothing left to protect.
    if tg_op = 'DELETE' then
      return old;
    end if;
    -- Without this, an insert for a missing test was silently dropped and the API said 201.
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if test_status <> 'draft' then
    raise exception 'mock_released';
  end if;

  if tg_op = 'INSERT' then
    if (select count(*) from public.mock_test_questions q where q.test_id = target_test) >= 100 then
      raise exception 'mock_too_many_questions';
    end if;
    new.position := coalesce(
      (select max(q.position) from public.mock_test_questions q where q.test_id = target_test),
      0
    ) + 1;
  end if;

  -- The admin list shows real activity, not only title edits.
  update public.mock_tests set updated_at = now() where id = target_test;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger mock_test_questions_check
  before insert or update or delete on public.mock_test_questions
  for each row execute function private.check_mock_question();

revoke execute on function private.check_mock_test() from public, anon, authenticated;
revoke execute on function private.check_mock_question() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Private helpers
-- ---------------------------------------------------------------------------

-- Who may take mock tests: parents and signed-up users by active role, students through
-- my_student_id() (active profile, role student and an active students row). Tutors, admins,
-- unfinished and deactivated accounts and visitors are all false.
create function private.can_take_mock_tests()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.my_active_role() in ('parent', 'user'), false)
         or private.my_student_id() is not null
$$;

create function private.require_mock_taker()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_take_mock_tests() then
    raise exception 'not_taker' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

revoke execute on function private.can_take_mock_tests() from public, anon, authenticated;
revoke execute on function private.require_mock_taker() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin functions
-- ---------------------------------------------------------------------------

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
  released_at     timestamptz
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
           t.created_at, t.updated_at, t.released_at
    from public.mock_tests t
    left join public.profiles p on p.id = t.created_by
    order by t.updated_at desc, t.id;
end;
$$;

create function public.mock_release(target uuid)
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
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if test_status <> 'draft' then
    raise exception 'invalid_status';
  end if;
  if not exists (select 1 from public.mock_test_questions q where q.test_id = target) then
    raise exception 'mock_no_questions';
  end if;

  update public.mock_tests
  set status = 'released', released_at = now(), released_by = auth.uid()
  where id = target;
end;
$$;

create function public.mock_withdraw(target uuid)
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
    raise exception 'not_found' using errcode = 'P0002';
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
  set status = 'draft', released_at = null, released_by = null
  where id = target;
end;
$$;

-- Move a question up (-1) or down (+1), by swapping with the nearest neighbour.
create function public.mock_move_question(target uuid, step int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owning_test uuid;
  moving      record;
  neighbour   record;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if step is null or step not in (-1, 1) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  select q.test_id into owning_test from public.mock_test_questions q where q.id = target;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Lock the test, then read positions, so a concurrent add or delete can't change them under us.
  perform 1 from public.mock_tests t where t.id = owning_test for update;

  select q.id, q.position into moving from public.mock_test_questions q where q.id = target;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select q.id, q.position into neighbour
  from public.mock_test_questions q
  where q.test_id = owning_test
    and (case when step < 0 then q.position < moving.position else q.position > moving.position end)
  order by case when step < 0 then -q.position else q.position end
  limit 1;

  if not found then
    return; -- already first or last
  end if;

  -- One statement, so the unique position check runs after both rows have moved. A released
  -- test is refused here by the question trigger (mock_released).
  update public.mock_test_questions q
  set position = case when q.id = moving.id then neighbour.position else moving.position end
  where q.id in (moving.id, neighbour.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Taker functions (never return correct_option or explanation before the caller's own submit)
-- ---------------------------------------------------------------------------

create function public.mock_tests_for_me()
returns table (
  id             uuid,
  title          text,
  question_count int,
  status         text,
  score          int,
  total          int,
  submitted_at   timestamptz,
  released_at    timestamptz
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
           a.score::int, a.total::int, a.submitted_at, t.released_at
    from public.mock_tests t
    left join public.mock_test_attempts a on a.test_id = t.id and a.profile_id = me
    where t.status = 'released'
    order by t.released_at desc, t.id;
end;
$$;

create function public.mock_test_open(target uuid)
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
  select t.id, t.title, t.instructions into test
  from public.mock_tests t
  where t.id = target and t.status = 'released';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select a.id, a.submitted_at, a.score, a.total into attempt
  from public.mock_test_attempts a
  where a.test_id = target and a.profile_id = me;

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
    'questions', questions
  );
end;
$$;

create function public.mock_start(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.require_mock_taker();
begin
  -- Held for share through the insert, so a concurrent mock_withdraw (for update) waits for us.
  perform 1 from public.mock_tests t where t.id = target and t.status = 'released' for share;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Idempotent: a double tap or a person who already submitted changes nothing.
  insert into public.mock_test_attempts (test_id, profile_id)
  values (target, me)
  on conflict (test_id, profile_id) do nothing;
end;
$$;

create function public.mock_save_answer(target_test uuid, target_question uuid, chosen_option int)
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
  perform 1 from public.mock_tests t where t.id = target_test and t.status = 'released' for share;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
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

create function public.mock_submit(target uuid)
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
  perform 1 from public.mock_tests t where t.id = target and t.status = 'released' for share;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
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

revoke execute on function public.mock_tests_admin_list() from public, anon, authenticated;
revoke execute on function public.mock_release(uuid) from public, anon, authenticated;
revoke execute on function public.mock_withdraw(uuid) from public, anon, authenticated;
revoke execute on function public.mock_move_question(uuid, int) from public, anon, authenticated;
revoke execute on function public.mock_tests_for_me() from public, anon, authenticated;
revoke execute on function public.mock_test_open(uuid) from public, anon, authenticated;
revoke execute on function public.mock_start(uuid) from public, anon, authenticated;
revoke execute on function public.mock_save_answer(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.mock_submit(uuid) from public, anon, authenticated;

grant execute on function public.mock_tests_admin_list() to authenticated;
grant execute on function public.mock_release(uuid) to authenticated;
grant execute on function public.mock_withdraw(uuid) to authenticated;
grant execute on function public.mock_move_question(uuid, int) to authenticated;
grant execute on function public.mock_tests_for_me() to authenticated;
grant execute on function public.mock_test_open(uuid) to authenticated;
grant execute on function public.mock_start(uuid) to authenticated;
grant execute on function public.mock_save_answer(uuid, uuid, int) to authenticated;
grant execute on function public.mock_submit(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Table grants and row-level security
-- ---------------------------------------------------------------------------

revoke all on public.mock_tests, public.mock_test_questions,
              public.mock_test_attempts, public.mock_test_answers
  from anon, authenticated;

-- Delete is drafts-only, enforced by the freeze triggers. created_by, status and released_* are
-- not writable: defaults and the release functions set them.
grant select, delete on public.mock_tests, public.mock_test_questions to authenticated;
grant insert (title, instructions), update (title, instructions) on public.mock_tests to authenticated;
grant insert (test_id, prompt, options, correct_option, explanation),
      update (prompt, options, correct_option, explanation)
  on public.mock_test_questions to authenticated;

alter table public.mock_tests enable row level security;
alter table public.mock_test_questions enable row level security;
alter table public.mock_test_attempts enable row level security;
alter table public.mock_test_answers enable row level security;

create policy mock_tests_admin_select on public.mock_tests
  for select to authenticated using ((select private.is_admin()));
create policy mock_tests_admin_insert on public.mock_tests
  for insert to authenticated with check ((select private.is_admin()));
create policy mock_tests_admin_update on public.mock_tests
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy mock_tests_admin_delete on public.mock_tests
  for delete to authenticated using ((select private.is_admin()));

create policy mock_test_questions_admin_select on public.mock_test_questions
  for select to authenticated using ((select private.is_admin()));
create policy mock_test_questions_admin_insert on public.mock_test_questions
  for insert to authenticated with check ((select private.is_admin()));
create policy mock_test_questions_admin_update on public.mock_test_questions
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy mock_test_questions_admin_delete on public.mock_test_questions
  for delete to authenticated using ((select private.is_admin()));

-- mock_test_attempts and mock_test_answers: RLS on, no policy, no grant.
