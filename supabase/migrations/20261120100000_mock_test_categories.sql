-- Mock tests: categories, that is subject, stream and year level
-- (docs/delivery/2026-11-18-mock-test-closing/01-requirement.md ACs 10 to 29, 02-architecture.md,
-- 03-design.md §1, ADR-0012 Amendment 1).
--
-- Four columns on mock_tests, written by admins through column grants like title and instructions.
-- A guard trigger checks each changed subject and stream against private.mock_test_options, checks
-- the years, and on a released test refuses clearing a tag that is set. Release needs all three
-- tags: mock_release checks them, and a trigger on the draft-to-released transition checks them for
-- every other writer too. Both judge on a locked read of the committed row, never on OLD or NEW,
-- so a tag clear racing a release can't leave a released test untagged.
--
-- Additive. 20261118100000 and 20261119100000 are not edited; the four functions replaced here
-- are copied from 20261119100000 (the S-1 visibility rules unchanged) and gain the tags.

-- ---------------------------------------------------------------------------
-- Allowed values
-- ---------------------------------------------------------------------------

-- A removed value is switched off (active = false), never deleted, so tests that hold it keep it
-- (AC 27). No grant and no policy: only the definer trigger below reads it.
create table private.mock_test_options (
  kind   text not null check (kind in ('subject', 'stream')),
  key    text not null,
  active boolean not null default true,
  primary key (kind, key)
);
alter table private.mock_test_options enable row level security;
revoke all on private.mock_test_options from anon, authenticated;

comment on table private.mock_test_options is
  'Subjects and streams a mock test may be tagged with. Kept equal to the web constants by mock-test-options.parity.test.ts.';

-- The parity test reads every block between these markers, in migration order. Remove a value
-- with its own block: values ('subject','writing', false) and the same on conflict clause.
-- mock-test-options:begin
insert into private.mock_test_options (kind, key) values
  ('subject','maths'), ('subject','english'), ('subject','science'), ('subject','reading'),
  ('subject','writing'), ('subject','numerical-reasoning'), ('subject','verbal-reasoning'),
  ('stream','vce'), ('stream','naplan'), ('stream','selective-entry'),
  ('stream','seal-and-scholarships'), ('stream','icas'), ('stream','maths-science-english')
on conflict (kind, key) do update set active = excluded.active;
-- mock-test-options:end

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

-- Constant defaults: no rewrite, and every check is trivially true for existing rows (AC 18).
alter table public.mock_tests
  add column subject     text,
  add column stream      text,
  add column year_levels smallint[] not null default '{}',
  add column any_year    boolean   not null default false,
  -- The classes_year_levels_valid form (ADR-0009). '{}' passes: array_ndims('{}') is null.
  add constraint mock_tests_year_levels_valid check (
    year_levels <@ '{2,3,4,5,6,7,8,9,10,11,12}'::smallint[]
    and array_ndims(year_levels) = 1 and array_lower(year_levels, 1) = 1),
  add constraint mock_tests_any_year_alone check (not (any_year and cardinality(year_levels) > 0));

comment on column public.mock_tests.subject is
  'A SUBJECTS key (maths, english, …); null = not set. Checked against private.mock_test_options when changed.';
comment on column public.mock_tests.stream is
  'A programme slug (vce, naplan, …); null = not set. Checked against private.mock_test_options when changed.';
comment on column public.mock_tests.year_levels is
  'Years 2 to 12, strictly ascending. Empty with any_year false = not set.';
comment on column public.mock_tests.any_year is
  'True = Any year. Never together with year_levels.';

-- ---------------------------------------------------------------------------
-- Guard trigger: values, years, and no clearing on a released test
-- ---------------------------------------------------------------------------

-- Security definer: it reads private.mock_test_options, which authenticated can't.
create function private.check_mock_test_tags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row     record;
  -- New on INSERT; on UPDATE, compared with the locked read. Kept as flags because current_row
  -- is never assigned on INSERT, and reading its fields there raises an error.
  subject_changed boolean := true;
  stream_changed  boolean := true;
begin
  -- On UPDATE only: the committed row, locked. By old.id, because a superuser may rename the id.
  -- The UPDATE takes this same lock, and a transaction never waits on a lock it holds.
  if tg_op = 'UPDATE' then
    select t.status, t.subject, t.stream, t.year_levels, t.any_year into current_row
    from public.mock_tests t
    where t.id = old.id
    for no key update;
    subject_changed := new.subject is distinct from current_row.subject;
    stream_changed := new.stream is distinct from current_row.stream;
  end if;

  -- A subject or stream is checked only when it is new or changed, so a value later switched off
  -- stays on the tests that hold it (AC 27).
  if new.subject is not null
     and subject_changed
     and not exists (select 1 from private.mock_test_options o
                     where o.kind = 'subject' and o.key = new.subject and o.active) then
    raise exception using errcode = 'check_violation', message = 'invalid_mock_tag', hint = 'subject';
  end if;
  if new.stream is not null
     and stream_changed
     and not exists (select 1 from private.mock_test_options o
                     where o.kind = 'stream' and o.key = new.stream and o.active) then
    raise exception using errcode = 'check_violation', message = 'invalid_mock_tag', hint = 'stream';
  end if;

  -- Years. Before the table checks run, so every refusal arrives as invalid_mock_tag; the checks
  -- stay as the backstop (a CHECK can pass a NULL element).
  if array_ndims(new.year_levels) > 1
     or (cardinality(new.year_levels) > 0 and array_lower(new.year_levels, 1) is distinct from 1)
     or exists (select 1 from unnest(new.year_levels) y where y is null)
     or new.year_levels is distinct from coalesce(
          (select array_agg(distinct y order by y) from unnest(new.year_levels) y), '{}'::smallint[])
     or exists (select 1 from unnest(new.year_levels) y where y < 2 or y > 12)
     or (cardinality(new.year_levels) > 0 and new.any_year) then
    raise exception using errcode = 'check_violation', message = 'invalid_mock_tag', hint = 'year_levels';
  end if;

  -- A tag that is set on a released test can change but not be cleared (AC 15). Judged on the
  -- locked read, not on OLD.
  if tg_op = 'UPDATE' then
    if current_row.status = 'released' then
      if current_row.subject is not null and new.subject is null then
        raise exception using errcode = 'check_violation', message = 'mock_tag_kept', hint = 'subject';
      end if;
      if current_row.stream is not null and new.stream is null then
        raise exception using errcode = 'check_violation', message = 'mock_tag_kept', hint = 'stream';
      end if;
      if (current_row.any_year or cardinality(current_row.year_levels) > 0)
         and not (new.any_year or cardinality(new.year_levels) > 0) then
        raise exception using errcode = 'check_violation', message = 'mock_tag_kept', hint = 'year_levels';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger mock_tests_check_tags
  before insert or update on public.mock_tests
  for each row execute function private.check_mock_test_tags();

-- Draft to released needs all three tags, for every writer (mock_release, a future function, the
-- service role). Judged on a locked read of the committed tags, never on NEW.
create function private.check_mock_test_release_tags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_tags record;
begin
  select t.subject, t.stream, t.year_levels, t.any_year into current_tags
  from public.mock_tests t
  where t.id = old.id
  for no key update;

  if not (current_tags.subject is not null and current_tags.stream is not null
          and (current_tags.any_year or cardinality(current_tags.year_levels) > 0)) then
    raise exception 'mock_tags_missing';
  end if;
  return new;
end;
$$;

create trigger mock_tests_release_needs_tags
  before update on public.mock_tests
  for each row
  when (old.status = 'draft' and new.status = 'released')
  execute function private.check_mock_test_release_tags();

revoke execute on function private.check_mock_test_tags() from public, anon, authenticated;
revoke execute on function private.check_mock_test_release_tags() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grants: tags are content, like title and instructions. status, released_* and closes_at stay
-- ungranted.
-- ---------------------------------------------------------------------------

grant insert (subject, stream, year_levels, any_year), update (subject, stream, year_levels, any_year)
  on public.mock_tests to authenticated;

-- ---------------------------------------------------------------------------
-- Functions, from 20261119100000 plus the tags
-- ---------------------------------------------------------------------------

-- Return type gains four columns: drop and create.
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
  closes_at       timestamptz,
  subject         text,
  stream          text,
  year_levels     smallint[],
  any_year        boolean
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
           t.created_at, t.updated_at, t.released_at, t.closes_at,
           t.subject, t.stream, t.year_levels, t.any_year
    from public.mock_tests t
    left join public.profiles p on p.id = t.created_by
    order by t.updated_at desc, t.id;
end;
$$;

-- Same signature; the locked read takes the tags, and release is refused without them (AC 14).
create or replace function public.mock_release(target uuid, closes timestamptz default null)
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

  select t.status, t.subject, t.stream, t.year_levels, t.any_year into test
  from public.mock_tests t
  where t.id = target
  for update;
  if not found then
    perform private.raise_mock_not_found();
  end if;
  if test.status <> 'draft' then
    raise exception 'invalid_status';
  end if;
  if not exists (select 1 from public.mock_test_questions q where q.test_id = target) then
    raise exception 'mock_no_questions';
  end if;
  -- now() itself counts as closed, so it is refused too (AC 1).
  if closes <= now() then
    raise exception 'mock_closes_in_past';
  end if;
  -- The same predicate as mock_tests_release_needs_tags. The tags come from the locked read, so
  -- a tag edit can't slip in between this check and the update.
  if not (test.subject is not null and test.stream is not null
          and (test.any_year or cardinality(test.year_levels) > 0)) then
    raise exception 'mock_tags_missing';
  end if;

  update public.mock_tests
  set status = 'released', released_at = now(), released_by = auth.uid(), closes_at = closes
  where id = target;
end;
$$;

-- Return type gains four columns: drop and create. Visibility exactly as in 20261119100000 (S-1).
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
  any_year       boolean
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
           t.subject, t.stream, t.year_levels, t.any_year
    from public.mock_tests t
    left join public.mock_test_attempts a on a.test_id = t.id and a.profile_id = me
    where t.status = 'released'
      and (t.closes_at is null or t.closes_at > now() or a.submitted_at is not null)
    order by t.released_at desc, t.id;
end;
$$;

-- The open view also carries the tags. Everything else as in 20261119100000.
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
         (t.closes_at is not null and t.closes_at <= now()) as closed,
         t.subject, t.stream, t.year_levels, t.any_year
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

revoke execute on function public.mock_tests_admin_list() from public, anon, authenticated;
revoke execute on function public.mock_release(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.mock_tests_for_me() from public, anon, authenticated;
revoke execute on function public.mock_test_open(uuid) from public, anon, authenticated;

grant execute on function public.mock_tests_admin_list() to authenticated;
grant execute on function public.mock_release(uuid, timestamptz) to authenticated;
grant execute on function public.mock_tests_for_me() to authenticated;
grant execute on function public.mock_test_open(uuid) to authenticated;
