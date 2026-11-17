-- Mock tests, taker side (docs/delivery/2026-11-17-mock-tests/03-design.md §2.5, §2.6, §8):
-- who may take a mock test, the one-attempt flow, scoring, and that no correct option or
-- explanation leaves the database before the caller's own submit. Admin side: mock_tests_admin.test.sql.

begin;
select no_plan();
select tests.remove_all_accounts();
select tests.remove_all_classes();
delete from public.mock_tests;

-- Staff
select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor@test.local');

-- Takers: student with no class, student with a class, parent, finished user
select tests.create_family_account('00000000-0000-0000-0000-0000000000e1', 'kid1@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000000e2', 'kid2@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000000c1', 'parent@test.local', 'parent');
select tests.create_sign_up('00000000-0000-0000-0000-0000000000f1', 'user@test.local');

-- Not takers: unfinished user, deactivated student, parent and user, a student whose roster row
-- is inactive (the profile is still active), a student profile with no roster row at all
select tests.create_sign_up('00000000-0000-0000-0000-0000000000f2', 'invited@test.local', p_finished => false);
select tests.create_family_account('00000000-0000-0000-0000-0000000000e3', 'kid3@test.local', 'student', p_active => false);
select tests.create_family_account('00000000-0000-0000-0000-0000000000c2', 'parent2@test.local', 'parent', p_active => false);
select tests.create_sign_up('00000000-0000-0000-0000-0000000000f3', 'user2@test.local', p_active => false);
select tests.create_family_account('00000000-0000-0000-0000-0000000000e4', 'kid4@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000000e5', 'kid5@test.local', 'student');

insert into public.classes (id, name, subject, tutor_id, is_active)
values ('00000000-0000-0000-0000-00000000c001', 'Class one', 'maths', '00000000-0000-0000-0000-0000000000b1', true);
insert into public.students (id, full_name, year_level, profile_id, consent_recorded_at, consent_source, is_active) values
  ('00000000-0000-0000-0000-00000000d001', 'Kid One', 8, '00000000-0000-0000-0000-0000000000e1', now(), 'admin', true),
  ('00000000-0000-0000-0000-00000000d002', 'Kid Two', 8, '00000000-0000-0000-0000-0000000000e2', now(), 'admin', true),
  ('00000000-0000-0000-0000-00000000d003', 'Kid Three', 8, '00000000-0000-0000-0000-0000000000e3', now(), 'admin', true),
  ('00000000-0000-0000-0000-00000000d004', 'Kid Four', 8, '00000000-0000-0000-0000-0000000000e4', now(), 'admin', false);
insert into public.enrolments (class_id, student_id)
values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d002');
insert into public.student_guardians (student_id, parent_id)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000c1');

-- Tests: T1 released (3 questions, correct options 1, 0, 2), T3 released later (1 question),
-- T2 a draft. Built as postgres; a released test is frozen, so release comes last.
insert into public.mock_tests (id, title, instructions, subject, stream, any_year) values
  ('00000000-0000-0000-0000-00000000f001', 'Maths mock', 'Read each question.', 'maths', 'naplan', true),
  ('00000000-0000-0000-0000-00000000f002', 'Draft mock', '', 'maths', 'naplan', true),
  ('00000000-0000-0000-0000-00000000f003', 'English mock', '', 'maths', 'naplan', true);
insert into public.mock_test_questions (id, test_id, prompt, options, correct_option, explanation) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000f001', 'First?', array['a','b','c'], 1, 'Because b.'),
  ('00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-00000000f001', 'Second?', array['a','b','c'], 0, ''),
  ('00000000-0000-0000-0000-0000000a0003', '00000000-0000-0000-0000-00000000f001', 'Third?', array['a','b','c'], 2, 'Because c.'),
  ('00000000-0000-0000-0000-0000000a0004', '00000000-0000-0000-0000-00000000f002', 'Draft question?', array['a','b'], 0, 'Secret.'),
  ('00000000-0000-0000-0000-0000000a0005', '00000000-0000-0000-0000-00000000f003', 'English?', array['a','b'], 1, 'Because b.');
update public.mock_tests set status = 'released', released_at = now() where id = '00000000-0000-0000-0000-00000000f001';
update public.mock_tests set status = 'released', released_at = now() + interval '1 hour'
  where id = '00000000-0000-0000-0000-00000000f003';

-- ---------------------------------------------------------------------------
-- A taker's whole journey. Run as each kind of taker (AC 10, 25 to 29, 31 to 34, 36, 38).
-- p_choices: the option picked for the three questions of the maths mock (null = leave blank).
-- ---------------------------------------------------------------------------

create function pg_temp.journey(p_user uuid, p_label text, p_choices int[], p_score int)
returns setof text
language plpgsql
set search_path = extensions -- pgTAP; every table and function below is schema-qualified
as $$
declare
  t1 constant uuid := '00000000-0000-0000-0000-00000000f001';
  t2 constant uuid := '00000000-0000-0000-0000-00000000f002';
  questions constant uuid[] := array['00000000-0000-0000-0000-0000000a0001',
    '00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-0000000a0003']::uuid[];
  j jsonb;
  n int;
begin
  perform tests.authenticate_as(p_user);

  -- The list: released tests only, newest first, nothing started
  return next results_eq(
    $q$ select id, title, question_count, status, score, total, submitted_at from public.mock_tests_for_me() $q$,
    $q$ values ('00000000-0000-0000-0000-00000000f003'::uuid, 'English mock'::text, 1, 'not_started'::text, null::int, null::int, null::timestamptz),
               ('00000000-0000-0000-0000-00000000f001'::uuid, 'Maths mock'::text, 3, 'not_started'::text, null::int, null::int, null::timestamptz) $q$,
    p_label || ': the list holds the two released tests, not the draft');
  select to_jsonb(l) into j from public.mock_tests_for_me() l limit 1;
  return next ok(j::text !~ 'correct_option|explanation', p_label || ': the list row has no key or explanation');

  -- Open before starting: intro only, no questions
  j := public.mock_test_open(t1);
  return next is(j->>'status', 'not_started', p_label || ': a new test opens as not_started');
  return next is(jsonb_array_length(j->'questions'), 0, p_label || ': with no questions yet');
  return next is((j->>'question_count')::int, 3, p_label || ': but the count is there');
  return next is(j->>'instructions', 'Read each question.', p_label || ': and the instructions');
  return next ok(j::text !~ 'correct_option|explanation|@', p_label || ': not_started has no key, explanation or e-mail');
  return next throws_ok(format('select public.mock_test_open(%L)', t2), 'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}',
    p_label || ': a draft is not found');
  return next throws_ok(format('select public.mock_start(%L)', t2), 'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}',
    p_label || ': a draft can''t be started');
  return next throws_ok(format('select public.mock_test_open(%L)', gen_random_uuid()), 'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}',
    p_label || ': an unknown test is not found');
  return next throws_ok(format('select public.mock_save_answer(%L, %L, 1)', t1, questions[1]),
    'P0001', 'mock_not_started', p_label || ': saving before starting is refused');
  return next throws_ok(format('select public.mock_submit(%L)', t1), 'P0001', 'mock_not_started',
    p_label || ': submitting before starting is refused');

  -- Start twice: still one attempt (checked by the caller afterwards)
  return next lives_ok(format('select public.mock_start(%L)', t1), p_label || ': start works');
  return next lives_ok(format('select public.mock_start(%L)', t1), p_label || ': a second start works and changes nothing');

  -- In progress: questions without keys
  j := public.mock_test_open(t1);
  return next is(j->>'status', 'in_progress', p_label || ': after start the test is in_progress');
  return next is(jsonb_array_length(j->'questions'), 3, p_label || ': and the three questions come back');
  return next ok(j::text !~ 'correct_option|explanation|@', p_label || ': in_progress has no key, explanation or e-mail');
  return next is(
    (select array_agg(k order by k) from jsonb_object_keys(j->'questions'->0) k),
    array['id','options','position','prompt','selected_option'],
    p_label || ': each question has exactly id, options, position, prompt, selected_option');
  return next is(j->'questions'->0->'selected_option', 'null'::jsonb, p_label || ': nothing is selected yet');
  return next is((select status from public.mock_tests_for_me() where id = t1), 'in_progress',
    p_label || ': the list says in_progress');

  -- Saving: refused cases, then the choices
  return next throws_ok(format('select public.mock_save_answer(%L, %L, 1)', t1, '00000000-0000-0000-0000-0000000a0004'),
    'P0001', 'invalid_question', p_label || ': a question of another test is refused');
  return next throws_ok(format('select public.mock_save_answer(%L, %L, 1)', t1, gen_random_uuid()),
    'P0001', 'invalid_question', p_label || ': an unknown question is refused');
  return next throws_ok(format('select public.mock_save_answer(%L, %L, 3)', t1, questions[1]),
    'P0001', 'invalid_option', p_label || ': an option past the last is refused');
  return next throws_ok(format('select public.mock_save_answer(%L, %L, -1)', t1, questions[1]),
    'P0001', 'invalid_option', p_label || ': a negative option is refused');
  return next throws_ok(format('select public.mock_save_answer(%L, %L, null)', t1, questions[1]),
    'P0001', 'invalid_option', p_label || ': a null option is refused');
  return next throws_ok(format('select public.mock_save_answer(%L, %L, 0)', t2, '00000000-0000-0000-0000-0000000a0004'),
    'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', p_label || ': saving into a draft is not found');

  for n in 1..3 loop
    if p_choices[n] is not null then
      -- Save a different option first: a save replaces the earlier one
      perform public.mock_save_answer(t1, questions[n], (p_choices[n] + 1) % 3);
      perform public.mock_save_answer(t1, questions[n], p_choices[n]);
    end if;
  end loop;
  j := public.mock_test_open(t1);
  return next is(
    (select array_agg(case when q->'selected_option' = 'null'::jsonb then null else (q->>'selected_option')::int end
                      order by (q->>'position')::int)
     from jsonb_array_elements(j->'questions') q),
    p_choices, p_label || ': reopening shows the saved choices');
  return next ok(j::text !~ 'correct_option|explanation', p_label || ': still no key or explanation');

  -- Submit
  j := public.mock_submit(t1);
  return next is(j, jsonb_build_object('score', p_score, 'total', 3),
    p_label || ': submit returns the score, blanks counted as wrong');
  return next is(
    (select array_agg(k order by k) from jsonb_object_keys(j) k), array['score','total'],
    p_label || ': and only score and total');
  return next is(public.mock_submit(t1), j, p_label || ': a second submit returns the same score');
  return next throws_ok(format('select public.mock_save_answer(%L, %L, 0)', t1, questions[1]),
    'P0001', 'already_submitted', p_label || ': saving after submit is refused');
  return next lives_ok(format('select public.mock_start(%L)', t1), p_label || ': starting again after submit is quietly allowed');

  -- Submitted: the keys and explanations appear, for this caller's own attempt
  j := public.mock_test_open(t1);
  return next is(j->>'status', 'submitted', p_label || ': the attempt is still submitted after a second start');
  return next is((j->>'score')::int, p_score, p_label || ': the score is on the open view');
  return next ok(j->>'submitted_at' is not null, p_label || ': with the submit time');
  return next is(
    (select array_agg((q->>'correct_option')::int order by (q->>'position')::int) from jsonb_array_elements(j->'questions') q),
    array[1, 0, 2], p_label || ': correct options are revealed after submit');
  return next is(
    (select array_agg(q->>'explanation' order by (q->>'position')::int) from jsonb_array_elements(j->'questions') q),
    array['Because b.', '', 'Because c.'], p_label || ': and explanations');
  return next is(
    (select array_agg(k order by k) from jsonb_object_keys(j->'questions'->0) k),
    array['correct_option','explanation','id','options','position','prompt','selected_option'],
    p_label || ': a submitted question has the two extra keys');
  return next ok(j::text !~ '@', p_label || ': the open view carries no e-mail address');
  return next results_eq(
    format($q$ select status, score, total, submitted_at is not null from public.mock_tests_for_me() where id = %L $q$, t1),
    format($q$ values ('submitted'::text, %s, 3, true) $q$, p_score),
    p_label || ': the list shows the score');
  -- The other test is still untouched by this person
  return next is((select status from public.mock_tests_for_me() where id = '00000000-0000-0000-0000-00000000f003'),
    'not_started', p_label || ': the other test is still not started');

  -- Direct table access stays closed
  return next throws_ok($q$ select * from public.mock_test_attempts $q$, '42501', null, p_label || ': attempts are not readable');
  return next throws_ok($q$ select * from public.mock_test_answers $q$, '42501', null, p_label || ': answers are not readable');
  return next is((select count(*)::int from public.mock_test_questions), 0, p_label || ': no question rows are visible');
  return next is((select count(*)::int from public.mock_tests), 0, p_label || ': no test rows are visible');
  return next throws_ok($q$ insert into public.mock_test_attempts (test_id, profile_id)
      values ('00000000-0000-0000-0000-00000000f003', auth.uid()) $q$, '42501', null, p_label || ': an attempt can''t be inserted directly');
  return next throws_ok($q$ insert into public.mock_tests (title) values ('Mine') $q$, '42501', null, p_label || ': a test can''t be created');
  return next throws_ok($q$ select public.mock_release('00000000-0000-0000-0000-00000000f003') $q$, '42501', 'not_admin',
    p_label || ': admin functions are refused');
end;
$$;

select * from pg_temp.journey('00000000-0000-0000-0000-0000000000e1', 'Student with no class', array[1, 2, null], 1);
reset role;
select * from pg_temp.journey('00000000-0000-0000-0000-0000000000e2', 'Student with a class', array[1, 0, 2], 3);
reset role;
select * from pg_temp.journey('00000000-0000-0000-0000-0000000000c1', 'Parent', array[0, 0, null], 1);
reset role;
select * from pg_temp.journey('00000000-0000-0000-0000-0000000000f1', 'Signed-up user', array[null, null, null]::int[], 0);
reset role;

-- AC 26, 38: one attempt each, owned by the caller, all submitted
select results_eq(
  $$ select profile_id, count(*)::int, bool_and(submitted_at is not null) from public.mock_test_attempts group by profile_id order by profile_id $$,
  $$ values ('00000000-0000-0000-0000-0000000000c1'::uuid, 1, true), ('00000000-0000-0000-0000-0000000000e1'::uuid, 1, true),
            ('00000000-0000-0000-0000-0000000000e2'::uuid, 1, true), ('00000000-0000-0000-0000-0000000000f1'::uuid, 1, true) $$,
  'Exactly one attempt per taker, each owned by the person who made it');
select is((select count(*)::int from public.mock_test_answers), 7, 'Only chosen answers are stored: 2 + 3 + 2 + 0 rows, blanks leave none');

-- AC 37: nobody reads anybody else's answers or score
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select is(
  (select array_agg(case when q->'selected_option' = 'null'::jsonb then null else (q->>'selected_option')::int end
                    order by (q->>'position')::int)
   from jsonb_array_elements(public.mock_test_open('00000000-0000-0000-0000-00000000f001')->'questions') q),
  array[1, 2, null], 'Student one reads only their own choices');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select is(
  (select array_agg(case when q->'selected_option' = 'null'::jsonb then null else (q->>'selected_option')::int end
                    order by (q->>'position')::int)
   from jsonb_array_elements(public.mock_test_open('00000000-0000-0000-0000-00000000f001')->'questions') q),
  array[0, 0, null], 'The parent reads only their own choices');
select is((public.mock_test_open('00000000-0000-0000-0000-00000000f001')->>'score')::int, 1, 'and their own score');
reset role;

-- One person's start does not give another a score on a test they have not started
select tests.authenticate_as('00000000-0000-0000-0000-0000000000f1');
select is((select count(*)::int from public.mock_tests_for_me() where status = 'submitted'), 1,
  'A user sees only their own submitted test, not others'' attempts');
reset role;

-- ---------------------------------------------------------------------------
-- Not takers: every function raises not_taker (AC 5, 6, 7)
-- ---------------------------------------------------------------------------

create function pg_temp.refused(p_user uuid, p_label text, p_aal text default 'aal1')
returns setof text
language plpgsql
set search_path = extensions
as $$
declare
  t1 constant uuid := '00000000-0000-0000-0000-00000000f001';
  n bigint;
begin
  perform tests.authenticate_as(p_user, p_aal);
  return next throws_ok($q$ select * from public.mock_tests_for_me() $q$, '42501', 'not_taker', p_label || ': list is refused');
  return next throws_ok(format('select public.mock_test_open(%L)', t1), '42501', 'not_taker', p_label || ': open is refused');
  return next throws_ok(format('select public.mock_start(%L)', t1), '42501', 'not_taker', p_label || ': start is refused');
  return next throws_ok(format('select public.mock_save_answer(%L, %L, 0)', t1, '00000000-0000-0000-0000-0000000a0001'),
    '42501', 'not_taker', p_label || ': save is refused');
  return next throws_ok(format('select public.mock_submit(%L)', t1), '42501', 'not_taker', p_label || ': submit is refused');
  return next throws_ok($q$ select * from public.mock_test_attempts $q$, '42501', null, p_label || ': attempts are not readable');
  return next throws_ok($q$ select * from public.mock_test_answers $q$, '42501', null, p_label || ': answers are not readable');
  return next throws_ok($q$ insert into public.mock_test_attempts (test_id, profile_id)
      values ('00000000-0000-0000-0000-00000000f001', auth.uid()) $q$, '42501', null, p_label || ': attempts can''t be inserted');
end;
$$;

select * from pg_temp.refused('00000000-0000-0000-0000-0000000000b1', 'A tutor');
reset role;
select * from pg_temp.refused('00000000-0000-0000-0000-0000000000a1', 'An admin', 'aal2');
reset role;
select * from pg_temp.refused('00000000-0000-0000-0000-0000000000f2', 'An unfinished user');
reset role;
select * from pg_temp.refused('00000000-0000-0000-0000-0000000000e3', 'A deactivated student');
reset role;
select * from pg_temp.refused('00000000-0000-0000-0000-0000000000c2', 'A deactivated parent');
reset role;
select * from pg_temp.refused('00000000-0000-0000-0000-0000000000f3', 'A deactivated user');
reset role;
select * from pg_temp.refused('00000000-0000-0000-0000-0000000000e4', 'A student with an inactive roster row');
reset role;
select * from pg_temp.refused('00000000-0000-0000-0000-0000000000e5', 'A student profile with no roster row');
reset role;

select tests.authenticate_as_anon();
select throws_ok($$ select * from public.mock_tests_for_me() $$, '42501', null, 'A visitor can''t list');
select throws_ok($$ select public.mock_test_open('00000000-0000-0000-0000-00000000f001') $$, '42501', null, 'A visitor can''t open');
select throws_ok($$ select public.mock_start('00000000-0000-0000-0000-00000000f001') $$, '42501', null, 'A visitor can''t start');
select throws_ok($$ select public.mock_save_answer('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000a0001', 0) $$,
  '42501', null, 'A visitor can''t save');
select throws_ok($$ select public.mock_submit('00000000-0000-0000-0000-00000000f001') $$, '42501', null, 'A visitor can''t submit');
select throws_ok($$ select * from public.mock_tests $$, '42501', null, 'A visitor can''t read tests');
select throws_ok($$ select * from public.mock_test_attempts $$, '42501', null, 'A visitor can''t read attempts');
reset role;

-- The gate itself
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e4');
reset role; -- the JWT claims stay; the helper itself isn't callable by a session
select is(private.can_take_mock_tests(), false, 'An inactive roster row with an active profile is not a taker');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
reset role; -- the JWT claims stay; the helper itself isn't callable by a session
select is(private.can_take_mock_tests(), true, 'An active student is a taker');
reset role;

-- Helpers are not callable by signed-in sessions
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select private.can_take_mock_tests() $$, '42501', null, 'The gate helper is not callable by a session');
select throws_ok($$ select private.require_mock_taker() $$, '42501', null, 'The taker check is not callable by a session');
reset role;

select * from finish();
rollback;
