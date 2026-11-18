-- Mock test scoring (docs/delivery/2026-11-18-mock-test-scoring/03-design.md §1.3 to §1.5 and §2.2,
-- migration 20261121100000_mock_test_scoring.sql): marks per question, an optional pass mark, the
-- percentage and Pass label derived on read, the freeze, and the admin-only results function.
-- Writes run as the real caller (tests.authenticate_as sets the local role to authenticated, so
-- grants and RLS apply). Superuser is used only for fixtures and for the direct writes that say so
-- (a test's status and closes_at, submitted_at ties, legacy-shaped attempts, 100 generated questions).
-- Cases 1 to 15 of §2.2 are marked in the assertion names.

begin;
select no_plan();
select tests.remove_all_accounts();
select tests.remove_all_classes();
delete from public.mock_tests;

-- Fixed ids built from a number, so the fixtures read as tables: test t, question n of test t.
create function pg_temp.tid(t int) returns uuid language sql as
$$ select ('00000000-0000-0000-00f0-' || lpad(t::text, 12, '0'))::uuid $$;
create function pg_temp.qid(t int, n int) returns uuid language sql as
$$ select ('00000000-0000-0000-00a0-' || lpad(t::text, 6, '0') || lpad(n::text, 6, '0'))::uuid $$;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.create_staff('00000000-0000-0000-0000-0000000000a2', 'admin2@test.local', 'admin', p_active => false);
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor@test.local');
select tests.create_family_account('00000000-0000-0000-0000-0000000000e1', 'kid1@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000000e2', 'kid2@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000000e7', 'kid7@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000000c1', 'parent@test.local', 'parent');
select tests.create_sign_up('00000000-0000-0000-0000-0000000000f1', 'user@test.local');

insert into public.students (id, full_name, year_level, profile_id, consent_recorded_at, consent_source, is_active) values
  ('00000000-0000-0000-0000-00000000d001', 'Kid One', 8, '00000000-0000-0000-0000-0000000000e1', now(), 'admin', true),
  ('00000000-0000-0000-0000-00000000d002', 'Kid Two', 8, '00000000-0000-0000-0000-0000000000e2', now(), 'admin', true),
  ('00000000-0000-0000-0000-00000000d007', 'Kid Seven', 8, '00000000-0000-0000-0000-0000000000e7', now(), 'admin', true);

-- Names (case 11). The helpers make every profile name "Test ...": set exactly the cases we need.
-- e1: whitespace only, so the roster name shows. e7: empty, roster name. e2: has a name.
-- c1 (parent) and f1 (user): no usable name and no roster row.
update public.profiles set full_name = '   ' where id = '00000000-0000-0000-0000-0000000000e1';
update public.profiles set full_name = '' where id = '00000000-0000-0000-0000-0000000000e7';
update public.profiles set full_name = 'Profile Two' where id = '00000000-0000-0000-0000-0000000000e2';
update public.profiles set full_name = '' where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set full_name = '  ' where id = '00000000-0000-0000-0000-0000000000f1';

-- ---------------------------------------------------------------------------
-- Tests (built as postgres as drafts, tagged; a released test is frozen, so release comes last)
--   1 TA scoring: 3 questions worth 3, 2, 5 (correct options 0, 1, 2), pass mark 60
--   2 TB no pass mark, 2 questions at the default mark (correct 0, 1)
--   3 TC 100 questions at 100 marks, pass mark 100
--   4 TD 4 questions at 100 marks, pass mark 90
--   5 TE draft with one question (the case 1 writes happen here)
--   6 TF closed-test fixture: 2 questions worth 2 and 3, pass mark 50
--   7 TG released, pass mark 70, no attempt (taken back to draft in case 2)
--   8 TH legacy-shaped: 3 questions at the default mark, no pass mark, attempts written as counts
--   9 TI open test used for the closing / reopening / tag edit checks (case 8)
--  10 TK released, nobody has submitted
-- ---------------------------------------------------------------------------

insert into public.mock_tests (id, title, subject, stream, any_year, pass_mark) values
  (pg_temp.tid(1), 'Scoring mock', 'maths', 'naplan', true, 60),
  (pg_temp.tid(2), 'No pass mark mock', 'maths', 'naplan', true, null),
  (pg_temp.tid(3), 'Boundary 100', 'maths', 'naplan', true, 100),
  (pg_temp.tid(4), 'Boundary 90', 'maths', 'naplan', true, 90),
  (pg_temp.tid(5), 'Draft mock', 'maths', 'naplan', true, null),
  (pg_temp.tid(6), 'Closed mock', 'maths', 'naplan', true, 50),
  (pg_temp.tid(7), 'Take back mock', 'maths', 'naplan', true, 70),
  (pg_temp.tid(8), 'Legacy mock', 'maths', 'naplan', true, null),
  (pg_temp.tid(9), 'Closing checks mock', 'maths', 'naplan', true, 50),
  (pg_temp.tid(10), 'Nobody submitted', 'maths', 'naplan', true, null);

insert into public.mock_test_questions (id, test_id, prompt, options, correct_option, marks) values
  (pg_temp.qid(1, 1), pg_temp.tid(1), 'Q1?', array['a','b','c'], 0, 3),
  (pg_temp.qid(1, 2), pg_temp.tid(1), 'Q2?', array['a','b','c'], 1, 2),
  (pg_temp.qid(1, 3), pg_temp.tid(1), 'Q3?', array['a','b','c'], 2, 5),
  (pg_temp.qid(4, 1), pg_temp.tid(4), 'Q1?', array['a','b','c'], 0, 100),
  (pg_temp.qid(4, 2), pg_temp.tid(4), 'Q2?', array['a','b','c'], 0, 100),
  (pg_temp.qid(4, 3), pg_temp.tid(4), 'Q3?', array['a','b','c'], 0, 100),
  (pg_temp.qid(4, 4), pg_temp.tid(4), 'Q4?', array['a','b','c'], 0, 100),
  (pg_temp.qid(6, 1), pg_temp.tid(6), 'Q1?', array['a','b','c'], 0, 2),
  (pg_temp.qid(6, 2), pg_temp.tid(6), 'Q2?', array['a','b','c'], 1, 3),
  (pg_temp.qid(7, 1), pg_temp.tid(7), 'Q1?', array['a','b','c'], 0, 4);

-- No marks column given: these read the default of 1 (the shape of every question before scoring).
insert into public.mock_test_questions (id, test_id, prompt, options, correct_option) values
  (pg_temp.qid(2, 1), pg_temp.tid(2), 'Q1?', array['a','b','c'], 0),
  (pg_temp.qid(2, 2), pg_temp.tid(2), 'Q2?', array['a','b','c'], 1),
  (pg_temp.qid(5, 1), pg_temp.tid(5), 'Q1?', array['a','b','c'], 0),
  (pg_temp.qid(8, 1), pg_temp.tid(8), 'Q1?', array['a','b','c'], 0),
  (pg_temp.qid(8, 2), pg_temp.tid(8), 'Q2?', array['a','b','c'], 1),
  (pg_temp.qid(8, 3), pg_temp.tid(8), 'Q3?', array['a','b','c'], 2),
  (pg_temp.qid(9, 1), pg_temp.tid(9), 'Q1?', array['a','b','c'], 0),
  (pg_temp.qid(9, 2), pg_temp.tid(9), 'Q2?', array['a','b','c'], 1),
  (pg_temp.qid(10, 1), pg_temp.tid(10), 'Q1?', array['a','b','c'], 0);

-- The case 5 maximum: 100 questions at 100 marks (the trigger numbers the positions).
insert into public.mock_test_questions (id, test_id, prompt, options, correct_option, marks)
select pg_temp.qid(3, n), pg_temp.tid(3), 'Q' || n || '?', array['a','b'], 0, 100
from generate_series(1, 100) n order by n;

update public.mock_tests set status = 'released', released_at = now()
where id in (select pg_temp.tid(n) from generate_series(1, 4) n
             union select pg_temp.tid(n) from generate_series(6, 10) n);

-- Run as the caller: start test p_test, save p_choices (option by position, null = blank) and,
-- unless told not to, submit.
create function pg_temp.take(p_test int, p_choices int[], p_submit boolean default true)
returns jsonb
language plpgsql
as $$
declare
  n int;
begin
  perform public.mock_start(pg_temp.tid(p_test));
  for n in 1..array_length(p_choices, 1) loop
    if p_choices[n] is not null then
      perform public.mock_save_answer(pg_temp.tid(p_test), pg_temp.qid(p_test, n), p_choices[n]);
    end if;
  end loop;
  if p_submit then
    return public.mock_submit(pg_temp.tid(p_test));
  end if;
  return null;
end;
$$;

-- ===========================================================================
-- Case 1: columns and grants (AC 1, 3, 6, 7, 9)
-- ===========================================================================

select is((select data_type || ':' || is_nullable || ':' || column_default
           from information_schema.columns
           where table_schema = 'public' and table_name = 'mock_test_questions' and column_name = 'marks'),
  'smallint:NO:1', 'case 1 (AC 1): marks is smallint, not null, default 1');
select is((select data_type || ':' || is_nullable
           from information_schema.columns
           where table_schema = 'public' and table_name = 'mock_tests' and column_name = 'pass_mark'),
  'smallint:YES', 'case 1 (AC 6): pass_mark is a nullable smallint');
select is((select marks::int from public.mock_test_questions where id = pg_temp.qid(5, 1)), 1,
  'case 1 (AC 1): a question inserted with no marks reads 1');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok(
  format($$ insert into public.mock_test_questions (test_id, prompt, options, correct_option, marks)
            values (%L, 'One mark', array['a','b'], 0, 1) $$, pg_temp.tid(5)),
  'case 1 (AC 1): marks 1 is accepted');
select lives_ok(
  format($$ insert into public.mock_test_questions (test_id, prompt, options, correct_option, marks)
            values (%L, 'Hundred marks', array['a','b'], 0, 100) $$, pg_temp.tid(5)),
  'case 1 (AC 1): marks 100 is accepted');
select throws_ok(
  format($$ insert into public.mock_test_questions (test_id, prompt, options, correct_option, marks)
            values (%L, 'Zero', array['a','b'], 0, 0) $$, pg_temp.tid(5)),
  '23514', null, 'case 1 (AC 1): marks 0 is refused (23514)');
select throws_ok(
  format($$ insert into public.mock_test_questions (test_id, prompt, options, correct_option, marks)
            values (%L, 'Negative', array['a','b'], 0, -1) $$, pg_temp.tid(5)),
  '23514', null, 'case 1 (AC 1): marks -1 is refused (23514)');
select throws_ok(
  format($$ insert into public.mock_test_questions (test_id, prompt, options, correct_option, marks)
            values (%L, 'Too many', array['a','b'], 0, 101) $$, pg_temp.tid(5)),
  '23514', null, 'case 1 (AC 1): marks 101 is refused (23514)');
select lives_ok(
  format($$ update public.mock_test_questions set marks = 7 where id = %L $$, pg_temp.qid(5, 1)),
  'case 1 (AC 1): marks can be updated on a draft');
select throws_ok(
  format($$ update public.mock_test_questions set marks = 0 where id = %L $$, pg_temp.qid(5, 1)),
  '23514', null, 'case 1 (AC 1): updating marks to 0 is refused (23514)');

select lives_ok(format($$ update public.mock_tests set pass_mark = 1 where id = %L $$, pg_temp.tid(5)),
  'case 1 (AC 6): pass mark 1 is accepted on a draft');
select lives_ok(format($$ update public.mock_tests set pass_mark = 100 where id = %L $$, pg_temp.tid(5)),
  'case 1 (AC 6): pass mark 100 is accepted on a draft');
select lives_ok(format($$ update public.mock_tests set pass_mark = null where id = %L $$, pg_temp.tid(5)),
  'case 1 (AC 6): pass mark null (no pass mark) is accepted on a draft');
select throws_ok(format($$ update public.mock_tests set pass_mark = 0 where id = %L $$, pg_temp.tid(5)),
  '23514', null, 'case 1 (AC 6): pass mark 0 is refused (23514)');
select throws_ok(format($$ update public.mock_tests set pass_mark = -1 where id = %L $$, pg_temp.tid(5)),
  '23514', null, 'case 1 (AC 6): pass mark -1 is refused (23514)');
select throws_ok(format($$ update public.mock_tests set pass_mark = 101 where id = %L $$, pg_temp.tid(5)),
  '23514', null, 'case 1 (AC 6): pass mark 101 is refused (23514)');
select lives_ok(
  $$ insert into public.mock_tests (title, pass_mark) values ('Insert with pass mark', 55) $$,
  'case 1 (AC 6): a draft can be inserted with a pass mark');
select throws_ok($$ insert into public.mock_tests (title, pass_mark) values ('Bad insert', 101) $$,
  '23514', null, 'case 1 (AC 6): an insert with pass mark 101 is refused (23514)');
reset role;

-- Column grants: the new column is added next to the existing ones and nothing else is.
select is((select array_agg(column_name::text order by column_name) from information_schema.column_privileges
           where grantee = 'authenticated' and table_schema = 'public' and table_name = 'mock_tests'
             and privilege_type = 'UPDATE'),
  array['any_year','instructions','pass_mark','stream','subject','title','year_levels'],
  'case 1 (AC 7): authenticated may update on mock_tests exactly the old columns plus pass_mark');
select is((select array_agg(column_name::text order by column_name) from information_schema.column_privileges
           where grantee = 'authenticated' and table_schema = 'public' and table_name = 'mock_tests'
             and privilege_type = 'INSERT'),
  array['any_year','instructions','pass_mark','stream','subject','title','year_levels'],
  'case 1 (AC 7): authenticated may insert on mock_tests exactly the old columns plus pass_mark');
select is((select array_agg(column_name::text order by column_name) from information_schema.column_privileges
           where grantee = 'authenticated' and table_schema = 'public' and table_name = 'mock_test_questions'
             and privilege_type = 'UPDATE'),
  array['correct_option','explanation','marks','options','prompt'],
  'case 1 (AC 7): authenticated may update on mock_test_questions exactly the old columns plus marks');
select is((select array_agg(column_name::text order by column_name) from information_schema.column_privileges
           where grantee = 'authenticated' and table_schema = 'public' and table_name = 'mock_test_questions'
             and privilege_type = 'INSERT'),
  array['correct_option','explanation','marks','options','prompt','test_id'],
  'case 1 (AC 7): authenticated may insert on mock_test_questions exactly the old columns plus marks');

-- ===========================================================================
-- Case 2: freeze (AC 3, 9)
-- ===========================================================================

-- A closed test is still "released": TF is closed by a direct write, as the closing tests do.
update public.mock_tests set closes_at = now() - interval '1 hour' where id = pg_temp.tid(6);

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok(format($$ update public.mock_test_questions set marks = 9 where id = %L $$, pg_temp.qid(1, 1)),
  'P0001', 'mock_released', 'case 2 (AC 3): changing a question''s marks on a released test is refused');
select throws_ok(
  format($$ insert into public.mock_test_questions (test_id, prompt, options, correct_option, marks)
            values (%L, 'Late', array['a','b'], 0, 4) $$, pg_temp.tid(1)),
  'P0001', 'mock_released', 'case 2 (AC 3): inserting a question with marks into a released test is refused');
select throws_ok(format($$ update public.mock_tests set pass_mark = 10 where id = %L $$, pg_temp.tid(1)),
  'P0001', 'mock_released', 'case 2 (AC 9): changing the pass mark of a released test is refused');
select throws_ok(format($$ update public.mock_tests set pass_mark = null where id = %L $$, pg_temp.tid(1)),
  'P0001', 'mock_released', 'case 2 (AC 9): clearing the pass mark of a released test is refused');
select throws_ok(format($$ update public.mock_tests set pass_mark = 5 where id = %L $$, pg_temp.tid(2)),
  'P0001', 'mock_released', 'case 2 (AC 9): setting a pass mark on a released test that has none is refused');
select lives_ok(format($$ update public.mock_tests set pass_mark = 60 where id = %L $$, pg_temp.tid(1)),
  'case 2 (AC 9): writing the same pass mark to a released test is accepted');

select throws_ok(format($$ update public.mock_test_questions set marks = 9 where id = %L $$, pg_temp.qid(6, 1)),
  'P0001', 'mock_released', 'case 2 (AC 3): changing marks on a closed test is refused');
select throws_ok(
  format($$ insert into public.mock_test_questions (test_id, prompt, options, correct_option, marks)
            values (%L, 'Late', array['a','b'], 0, 4) $$, pg_temp.tid(6)),
  'P0001', 'mock_released', 'case 2 (AC 3): inserting a question with marks into a closed test is refused');
select throws_ok(format($$ update public.mock_tests set pass_mark = 10 where id = %L $$, pg_temp.tid(6)),
  'P0001', 'mock_released', 'case 2 (AC 9): changing the pass mark of a closed test is refused');
select lives_ok(format($$ update public.mock_tests set pass_mark = 50 where id = %L $$, pg_temp.tid(6)),
  'case 2 (AC 9): writing the same pass mark to a closed test is accepted');

-- Taking a test back to draft (no submitted attempt) makes both editable again and keeps the pass mark.
select lives_ok(format($$ select public.mock_withdraw(%L) $$, pg_temp.tid(7)),
  'case 2 (AC 3): a released test with no submitted attempt can be taken back');
reset role;
select is((select pass_mark::int from public.mock_tests where id = pg_temp.tid(7)), 70,
  'case 2 (AC 9): taking back keeps the pass mark');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok(format($$ update public.mock_test_questions set marks = 6 where id = %L $$, pg_temp.qid(7, 1)),
  'case 2 (AC 3): after take-back a question''s marks are editable again');
select lives_ok(
  format($$ insert into public.mock_test_questions (test_id, prompt, options, correct_option, marks)
            values (%L, 'Back again', array['a','b'], 0, 8) $$, pg_temp.tid(7)),
  'case 2 (AC 3): after take-back a question with marks can be inserted');
select lives_ok(format($$ update public.mock_tests set pass_mark = 80 where id = %L $$, pg_temp.tid(7)),
  'case 2 (AC 9): after take-back the pass mark is editable again');
reset role;

-- ===========================================================================
-- Case 3: helpers (AC 14, 18, 21)
-- ===========================================================================

select is(private.mock_percentage(v.s, v.t), v.expected,
  format('case 3 (AC 14): percentage(%s, %s) is %s', v.s, v.t, coalesce(v.expected::text, 'null')))
from (values (2, 3, 66), (0, 5, 0), (5, 5, 100), (1, 3, 33), (59, 100, 59), (3, 5, 60),
             (10000, 10000, 100), (1, 10000, 0), (null, 5, null), (3, null, null)) as v(s, t, expected);

select is(private.mock_percentage(5, 0), 0, 'case 3 (AC 14): percentage with a total of 0 is 0, not a division error');

select is(private.mock_passed(v.s, v.t, v.p), v.expected,
  format('case 3 (AC 18): passed(%s, %s, %s) is %s', v.s, v.t, v.p, coalesce(v.expected::text, 'null')))
from (values (3, 5, 60, true), (59, 100, 60, false), (2, 3, 67, false), (2, 3, 66, true),
             (400, 400, 90, true), (359, 400, 90, false), (10000, 10000, 100, true),
             (0, 0, 50, false), (3, 5, null, null), (null, 5, 60, null), (3, null, 60, null)) as v(s, t, p, expected);

select is(has_function_privilege(r.who, f.sig, 'execute'), false,
  format('case 3 (AC 21): %s cannot execute %s', r.who, f.sig))
from (values ('anon'), ('authenticated'), ('public')) r(who),
     (values ('private.mock_percentage(int, int)'), ('private.mock_passed(int, int, int)')) f(sig);

-- ===========================================================================
-- Cases 4, 5, 6: scoring, boundaries, shapes (each call runs as the taker)
-- ===========================================================================

-- Case 6, before Start: e2 has not started TA.
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e2');
select is((select to_jsonb(l) - 'id' - 'released_at' from public.mock_tests_for_me() l where l.id = pg_temp.tid(1)),
  jsonb_build_object('title', 'Scoring mock', 'question_count', 3, 'status', 'not_started', 'score', null,
                     'total', null, 'submitted_at', null, 'closes_at', null, 'subject', 'maths', 'stream', 'naplan',
                     'year_levels', '[]'::jsonb, 'any_year', true, 'percentage', null, 'passed', null),
  'case 6 (AC 19): a not-started list row has null score, total, percentage and passed');
select is(public.mock_test_open(pg_temp.tid(1)) - 'id' - 'closes_at' - 'tags',
  jsonb_build_object('title', 'Scoring mock', 'instructions', '', 'status', 'not_started', 'question_count', 3,
                     'total_marks', 10, 'pass_mark', 60, 'score', null, 'total', null, 'percentage', null,
                     'passed', null, 'submitted_at', null, 'questions', '[]'::jsonb),
  'case 6 (AC 11, 12): before Start the open view has total_marks and pass_mark, a null result and no questions');
select is((select array_agg(k order by k) from jsonb_object_keys(public.mock_test_open(pg_temp.tid(1))) k),
  array['closes_at','id','instructions','pass_mark','passed','percentage','question_count','questions',
        'score','status','submitted_at','tags','title','total','total_marks'],
  'case 6 (AC 11): the open view''s top-level keys are the contract of §1.4');
select is(public.mock_test_open(pg_temp.tid(2))->'pass_mark', 'null'::jsonb,
  'case 6 (AC 12): a test with no pass mark opens with a null pass_mark');

-- Start TA as e2 and leave it in progress (never submitted: it must be absent from the results).
select pg_temp.take(1, array[0, 1, 2], false);
select is(public.mock_test_open(pg_temp.tid(1))->>'status', 'in_progress', 'case 6 (AC 15): after Start the test is in progress');
select is((select array_agg(k order by k) from jsonb_object_keys(public.mock_test_open(pg_temp.tid(1))->'questions'->0) k),
  array['id','marks','options','position','prompt','selected_option'],
  'case 6 (AC 10): in progress each question has marks and no key, explanation or marks_earned');
select is((select array_agg((q->>'marks')::int order by (q->>'position')::int)
           from jsonb_array_elements(public.mock_test_open(pg_temp.tid(1))->'questions') q),
  array[3, 2, 5], 'case 6 (AC 10): the question marks are 3, 2, 5');
select ok(public.mock_test_open(pg_temp.tid(1))::text !~ 'correct_option|explanation|marks_earned',
  'case 6 (AC 15): in progress there is no correct_option, explanation or marks_earned anywhere');
select is((select jsonb_build_array(percentage, passed, score) from public.mock_tests_for_me() where id = pg_temp.tid(1)),
  '[null, null, null]'::jsonb, 'case 6 (AC 19): in progress the list row has null percentage, passed and score');
select is(jsonb_build_array(public.mock_test_open(pg_temp.tid(1))->'percentage', public.mock_test_open(pg_temp.tid(1))->'passed'),
  '[null, null]'::jsonb, 'case 6 (AC 15): in progress the open view has null percentage and passed');
reset role;

-- Case 4: e1 answers the 3-mark and the 5-mark question right and the 2-mark one wrong.
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select is(pg_temp.take(1, array[0, 0, 2]), '{"score": 8, "total": 10, "percentage": 80, "passed": true}'::jsonb,
  'case 4 (AC 13, 14): 3 and 5 marks right, 2 wrong: score 8 of 10, percentage 80, passed at pass mark 60');
select is(public.mock_submit(pg_temp.tid(1)), '{"score": 8, "total": 10, "percentage": 80, "passed": true}'::jsonb,
  'case 4 (AC 24): a repeat submit returns the identical jsonb');
select is((select array_agg(k order by k) from jsonb_object_keys(public.mock_submit(pg_temp.tid(1))) k),
  array['passed','percentage','score','total'], 'case 4 (AC 24): the submit reply has exactly score, total, percentage, passed');
reset role;

-- A blank answer adds 0: c1 answers only the 3-mark question (wrongly) and leaves the rest blank.
select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select is(pg_temp.take(1, array[1, null, null]), '{"score": 0, "total": 10, "percentage": 0, "passed": false}'::jsonb,
  'case 4 (AC 13): wrong and blank answers add 0 marks; the total still counts every question; 0% is not a pass');
reset role;

-- f1 answers everything right.
select tests.authenticate_as('00000000-0000-0000-0000-0000000000f1');
select is(pg_temp.take(1, array[0, 1, 2]), '{"score": 10, "total": 10, "percentage": 100, "passed": true}'::jsonb,
  'case 4 (AC 13): all right is 10 of 10, 100%, passed');
reset role;

-- An in-progress attempt made as postgres with answers, then submitted by its owner: scored from the
-- frozen marks of TB (default 1 mark each): q1 right, q2 wrong = 1 of 2.
insert into public.mock_test_attempts (id, test_id, profile_id)
values ('00000000-0000-0000-0000-0000000b0201', pg_temp.tid(2), '00000000-0000-0000-0000-0000000000e2');
insert into public.mock_test_answers (attempt_id, question_id, selected_option) values
  ('00000000-0000-0000-0000-0000000b0201', pg_temp.qid(2, 1), 0),
  ('00000000-0000-0000-0000-0000000b0201', pg_temp.qid(2, 2), 0);
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e2');
select is(public.mock_submit(pg_temp.tid(2)), '{"score": 1, "total": 2, "percentage": 50, "passed": null}'::jsonb,
  'case 4 (AC 44): an attempt made as superuser then submitted scores from the frozen marks; no pass mark, no label');
reset role;

-- TB as e1, both right: 100% on a test with no pass mark.
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select is(pg_temp.take(2, array[0, 1]), '{"score": 2, "total": 2, "percentage": 100, "passed": null}'::jsonb,
  'case 4 (AC 14, 20): a test with no pass mark returns the percentage and a null passed');
reset role;

-- Case 5: the maximum. e1 starts TC, postgres writes the 100 correct answers, e1 submits.
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select public.mock_start(pg_temp.tid(3));
reset role;
insert into public.mock_test_answers (attempt_id, question_id, selected_option)
select a.id, q.id, q.correct_option
from public.mock_test_attempts a join public.mock_test_questions q on q.test_id = a.test_id
where a.test_id = pg_temp.tid(3) and a.profile_id = '00000000-0000-0000-0000-0000000000e1';
select is((select count(*)::int from public.mock_test_questions where test_id = pg_temp.tid(3)), 100,
  'case 5 (AC 14): the maximum test has 100 questions');
select is((select sum(marks)::int from public.mock_test_questions where test_id = pg_temp.tid(3)), 10000,
  'case 5 (AC 14): worth 100 marks each, 10000 marks');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select is(public.mock_submit(pg_temp.tid(3)), '{"score": 10000, "total": 10000, "percentage": 100, "passed": true}'::jsonb,
  'case 5 (AC 14, 18): 100 questions at 100 marks all right: 10000 of 10000, 100%, passed at pass mark 100');
select is(pg_temp.take(4, array[0, 0, 0, 0]), '{"score": 400, "total": 400, "percentage": 100, "passed": true}'::jsonb,
  'case 5 (AC 18): 4 questions at 100 marks all right at pass mark 90: passed, no smallint out of range');
reset role;

-- Legacy-shaped attempts on TH (counts as score and total, default 1 mark), written as postgres:
-- score = number correct of 3, answers to match.
create function pg_temp.legacy_attempt(p_profile uuid, p_correct int, p_at timestamptz)
returns void
language plpgsql
as $$
declare
  attempt uuid := gen_random_uuid();
begin
  insert into public.mock_test_attempts (id, test_id, profile_id, submitted_at, score, total)
  values (attempt, pg_temp.tid(8), p_profile, p_at, p_correct, 3);
  insert into public.mock_test_answers (attempt_id, question_id, selected_option)
  select attempt, q.id, case when q.position <= p_correct then q.correct_option else (q.correct_option + 1) % 3 end
  from public.mock_test_questions q where q.test_id = pg_temp.tid(8);
end;
$$;
select pg_temp.legacy_attempt('00000000-0000-0000-0000-0000000000e1', 2, now() - interval '3 days');
select pg_temp.legacy_attempt('00000000-0000-0000-0000-0000000000e2', 3, now() - interval '2 days');
select pg_temp.legacy_attempt('00000000-0000-0000-0000-0000000000c1', 1, now() - interval '1 day');
select pg_temp.legacy_attempt('00000000-0000-0000-0000-0000000000f1', 0, now() - interval '12 hours');
select pg_temp.legacy_attempt('00000000-0000-0000-0000-0000000000e7', 2, now() - interval '6 hours');

-- Case 6, after submit (e1, TA).
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select is((select array_agg(k order by k) from jsonb_object_keys(public.mock_test_open(pg_temp.tid(1))->'questions'->0) k),
  array['correct_option','explanation','id','marks','marks_earned','options','position','prompt','selected_option'],
  'case 6 (AC 15): once submitted a question also has correct_option, explanation and marks_earned');
select is((select array_agg((q->>'marks_earned')::int order by (q->>'position')::int)
           from jsonb_array_elements(public.mock_test_open(pg_temp.tid(1))->'questions') q),
  array[3, 0, 5], 'case 6 (AC 15): marks_earned per question is 3, 0, 5');
select is(public.mock_test_open(pg_temp.tid(1)) - 'questions' - 'id' - 'submitted_at' - 'closes_at' - 'tags',
  jsonb_build_object('title', 'Scoring mock', 'instructions', '', 'status', 'submitted', 'question_count', 3,
                     'total_marks', 10, 'pass_mark', 60, 'score', 8, 'total', 10, 'percentage', 80, 'passed', true),
  'case 6 (AC 11, 12, 15): after submit the open view has score, total, percentage and passed');
select ok((public.mock_test_open(pg_temp.tid(1))->>'submitted_at') is not null, 'case 6 (AC 15): and the submit time');
select is((select jsonb_build_array(score, total, percentage, passed) from public.mock_tests_for_me() where id = pg_temp.tid(1)),
  '[8, 10, 80, true]'::jsonb, 'case 6 (AC 19): a submitted list row on a test with a pass mark has percentage and passed');
select is((select jsonb_build_array(score, total, percentage, passed) from public.mock_tests_for_me() where id = pg_temp.tid(2)),
  '[2, 2, 100, null]'::jsonb, 'case 6 (AC 20): a submitted list row on a test with no pass mark has the percentage and a null passed');
select is((select jsonb_build_array(status, percentage, passed) from public.mock_tests_for_me() where id = pg_temp.tid(10)),
  '["not_started", null, null]'::jsonb, 'case 6 (AC 19): a not-started row has null percentage and passed (strict helpers)');
reset role;

-- Column order of the list function (the contract of §1.4).
select is((select p.proargnames from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'mock_tests_for_me'),
  array['id','title','question_count','status','score','total','submitted_at','released_at','closes_at','subject',
        'stream','year_levels','any_year','percentage','passed'],
  'case 6 (AC 19): mock_tests_for_me returns the §1.4 columns in order, percentage and passed last');

-- ===========================================================================
-- Case 7: per-question sums equal the score, for every submitted attempt (AC 22, 23)
-- ===========================================================================

create function pg_temp.sums_agree(p_test uuid)
returns boolean
language sql
as $$
  select (select sum((q->>'marks_earned')::int) from jsonb_array_elements(public.mock_test_open(p_test)->'questions') q)
         = (public.mock_test_open(p_test)->>'score')::int
     and (public.mock_test_open(p_test)->>'score')::int
         = (select l.score from public.mock_tests_for_me() l where l.id = p_test)
     and (public.mock_test_open(p_test)->>'total')::int = (public.mock_test_open(p_test)->>'total_marks')::int
$$;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select ok(pg_temp.sums_agree(pg_temp.tid(t)),
  format('case 7 (AC 22, 23): e1 on test %s: sum of marks_earned = score = list score, total = total_marks', t))
from unnest(array[1, 2, 3, 4, 8]) t;
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e2');
select ok(pg_temp.sums_agree(pg_temp.tid(t)),
  format('case 7 (AC 22, 23): e2 on test %s: sum of marks_earned = score = list score', t))
from unnest(array[2, 8]) t;
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select ok(pg_temp.sums_agree(pg_temp.tid(t)),
  format('case 7 (AC 22, 23): c1 on test %s: sum of marks_earned = score = list score', t))
from unnest(array[1, 8]) t;
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000f1');
select ok(pg_temp.sums_agree(pg_temp.tid(t)),
  format('case 7 (AC 22, 23): f1 on test %s: sum of marks_earned = score = list score', t))
from unnest(array[1, 8]) t;
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e7');
select ok(pg_temp.sums_agree(pg_temp.tid(8)), 'case 7 (AC 22, 23): e7 on test 8: sum of marks_earned = score = list score');
reset role;

-- ===========================================================================
-- Case 8 (legacy): attempts written as counts keep their numbers (AC 31, 40, 45)
-- ===========================================================================

select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select is((select jsonb_build_array(status, score, total, percentage, passed) from public.mock_tests_for_me() where id = pg_temp.tid(8)),
  '["submitted", 1, 3, 33, null]'::jsonb,
  'case 8 (AC 31, 45): a legacy attempt keeps score and total as counts, the percentage is derived, and no pass mark means no label');
select is(public.mock_test_open(pg_temp.tid(8))->'pass_mark', 'null'::jsonb, 'case 8 (AC 31): the legacy test has no pass mark');
reset role;
select is((select count(*) filter (where marks = 1) = count(*) from public.mock_test_questions where test_id = pg_temp.tid(8)),
  true, 'case 8 (AC 40): the legacy questions all read 1 mark');
select is((select score::int || '/' || total::int from public.mock_test_attempts
           where test_id = pg_temp.tid(8) and profile_id = '00000000-0000-0000-0000-0000000000c1'), '1/3',
  'case 8 (AC 41): the legacy attempt row is stored as written');

-- ===========================================================================
-- Case 9: closed tests (AC 25 to 27)
-- ===========================================================================

-- A closed test cannot be started, so open TF again, take part, then close it (a direct write).
update public.mock_tests set closes_at = null where id = pg_temp.tid(6);
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select is(pg_temp.take(6, array[0, 0]), '{"score": 2, "total": 5, "percentage": 40, "passed": false}'::jsonb,
  'case 9 (AC 25): before closing e1 submits 2 of 5 marks, 40%, below the pass mark 50');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e2');
select pg_temp.take(6, array[0, null], false);
reset role;

-- The results as they are before closing. The admin claims stay after reset role, and the function
-- reads only the claims, so postgres can run it and the rows can be compared with the tables.
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
reset role;
create temp table results_before_closing as select * from public.mock_test_results(pg_temp.tid(6));
update public.mock_tests set closes_at = now() - interval '1 hour' where id = pg_temp.tid(6);

select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select is((select jsonb_build_array(status, score, total, percentage, passed) from public.mock_tests_for_me() where id = pg_temp.tid(6)),
  '["submitted", 2, 5, 40, false]'::jsonb, 'case 9 (AC 25): a submitted taker still sees score, percentage and passed on a closed test');
select is((select array_agg((q->>'marks_earned')::int order by (q->>'position')::int)
           from jsonb_array_elements(public.mock_test_open(pg_temp.tid(6))->'questions') q),
  array[2, 0], 'case 9 (AC 25): and the closed test opens with marks_earned per question');
select is((public.mock_test_open(pg_temp.tid(6))->>'percentage')::int, 40, 'case 9 (AC 25): the open view of a closed test has the percentage');
select throws_ok(format($$ select public.mock_submit(%L) $$, pg_temp.tid(6)),
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}',
  'case 9 (AC 26): a repeat submit on a closed test is not_found');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e2');
select is((select count(*)::int from public.mock_tests_for_me() where id = pg_temp.tid(6)), 0,
  'case 9 (AC 27): an unsubmitted taker gets no list row for a closed test');
select throws_ok(format($$ select public.mock_test_open(%L) $$, pg_temp.tid(6)),
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', 'case 9 (AC 27): open is not_found for them');
select throws_ok(format($$ select public.mock_save_answer(%L, %L, 0) $$, pg_temp.tid(6), pg_temp.qid(6, 2)),
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', 'case 9 (AC 27): save is not_found for them');
select throws_ok(format($$ select public.mock_submit(%L) $$, pg_temp.tid(6)),
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', 'case 9 (AC 27): submit is not_found for them');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.mock_tests_for_me() where id = pg_temp.tid(6)), 0,
  'case 9 (AC 27): nor does a taker who never started see the closed test');
reset role;

-- ===========================================================================
-- Case 10 and 11: the results function and names (AC 28 to 38)
-- ===========================================================================

-- Make the submitted_at order deterministic on TA: e1 and c1 tie, f1 is an hour later.
update public.mock_test_attempts set submitted_at = '2026-11-20 09:00:00+00'
where test_id = pg_temp.tid(1) and profile_id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1');
update public.mock_test_attempts set submitted_at = '2026-11-20 10:00:00+00'
where test_id = pg_temp.tid(1) and profile_id = '00000000-0000-0000-0000-0000000000f1';

-- From here the admin claims stay and we run as postgres so the results can be compared with the tables.
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
reset role;

select is((select p.proargnames from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'mock_test_results'),
  array['target','attempt_id','taker_name','submitted_at','score','total','percentage','passed','total_rows'],
  'case 10 (AC 28): the results function has exactly the contract columns, in order');
select is((select p.proargmodes from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'mock_test_results'),
  array['i','t','t','t','t','t','t','t','t']::"char"[], 'case 10 (AC 28): one input and eight table columns');
select is((select array_agg(k order by k) from jsonb_object_keys((select to_jsonb(r) from public.mock_test_results(pg_temp.tid(1)) r limit 1)) k),
  array['attempt_id','passed','percentage','score','submitted_at','taker_name','total','total_rows'],
  'case 10 (AC 28): a result row has those eight keys');
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
                      unnest(p.proargnames) a
                      where n.nspname = 'public' and p.proname = 'mock_test_results'
                        and a ~ 'profile_id|email|answer|correct'),
  'case 10 (AC 29): no column is named or contains profile_id, email, answer or correct');
select ok(not exists (select 1 from public.mock_test_results(pg_temp.tid(t)) r where r::text ~ '@'),
  format('case 10 (AC 29): no row of test %s contains an @', t))
from unnest(array[1, 2, 3, 4, 6, 8]) t;

-- Rows are submitted attempts only, and the count matches the admin list.
select is((select count(*)::int from public.mock_test_results(pg_temp.tid(1))), 3,
  'case 10 (AC 32): TA has three rows: the in-progress attempt is absent');
select ok(not exists (select 1 from public.mock_test_results(pg_temp.tid(1)) r
                      join public.mock_test_attempts a on a.id = r.attempt_id where a.submitted_at is null),
  'case 10 (AC 32): every row is a submitted attempt');
select ok(not exists (select 1 from public.mock_test_attempts a
                      where a.test_id = pg_temp.tid(1) and a.submitted_at is not null
                        and a.id not in (select attempt_id from public.mock_test_results(pg_temp.tid(1)))),
  'case 10 (AC 32): and every submitted attempt is there');
select is((select count(*)::int from public.mock_test_results(pg_temp.tid(t))),
  (select l.submitted_count::int from public.mock_tests_admin_list() l where l.id = pg_temp.tid(t)),
  format('case 10 (AC 33): rows of test %s equal submitted_count of mock_tests_admin_list', t))
from unnest(array[1, 2, 3, 4, 6, 8, 10]) t;

-- Order: submitted_at desc, then attempt_id, with a real tie in the fixture.
select is((select count(distinct submitted_at)::int from public.mock_test_results(pg_temp.tid(1))), 2,
  'case 10 (AC 34): the fixture has a tie (two equal submit times and one later)');
select is((select a.profile_id from public.mock_test_results(pg_temp.tid(1)) r join public.mock_test_attempts a on a.id = r.attempt_id
           limit 1), '00000000-0000-0000-0000-0000000000f1'::uuid, 'case 10 (AC 34): the latest submit comes first');
select results_eq(
  format($q$ select attempt_id from public.mock_test_results(%L) $q$, pg_temp.tid(1)),
  format($q$ select id from public.mock_test_attempts where test_id = %L and submitted_at is not null
             order by submitted_at desc, id $q$, pg_temp.tid(1)),
  'case 10 (AC 34): order is submitted_at desc, then attempt_id for equal times');
select results_eq(
  format($q$ select attempt_id from public.mock_test_results(%L) $q$, pg_temp.tid(8)),
  format($q$ select id from public.mock_test_attempts where test_id = %L and submitted_at is not null
             order by submitted_at desc, id $q$, pg_temp.tid(8)),
  'case 10 (AC 34): the same order on a test with five different times');

-- Values.
select results_eq(
  format($q$ select score, total, percentage, passed from public.mock_test_results(%L) order by score $q$, pg_temp.tid(1)),
  $q$ values (0, 10, 0, false), (8, 10, 80, true), (10, 10, 100, true) $q$,
  'case 10 (AC 35): the results carry score, total, percentage and passed');
select results_eq(
  format($q$ select score, total, percentage, passed from public.mock_test_results(%L) order by score $q$, pg_temp.tid(2)),
  $q$ values (1, 2, 50, null::boolean), (2, 2, 100, null) $q$,
  'case 10 (AC 35): with no pass mark passed is null on every row');
select is((select count(distinct total_rows)::int || ':' || min(total_rows) from public.mock_test_results(pg_temp.tid(8))), '1:5',
  'case 10 (AC 33): total_rows is the same on every row, the full count');

-- Draft, unsubmitted, closed, unknown.
select lives_ok(format($$ select * from public.mock_test_results(%L) $$, pg_temp.tid(5)), 'case 10 (AC 31): a draft test gives no error');
select is((select count(*)::int from public.mock_test_results(pg_temp.tid(5))), 0, 'case 10 (AC 31): and zero rows');
select is((select count(*)::int from public.mock_test_results(pg_temp.tid(10))), 0, 'case 10 (AC 31): a released test nobody submitted has zero rows');
select is((select array_agg(r::text order by r.attempt_id) from public.mock_test_results(pg_temp.tid(6)) r),
  (select array_agg(b::text order by b.attempt_id) from results_before_closing b),
  'case 10 (AC 36): a closed test returns the same rows as before closing');
select is((select count(*)::int from public.mock_test_results(pg_temp.tid(6))), 1,
  'case 10 (AC 36): one row: e1; the other attempt was never submitted');
select throws_ok(format($$ select * from public.mock_test_results(%L) $$, gen_random_uuid()),
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', 'case 10 (AC 31): an unknown id is not_found');

-- Case 11: names (L-8).
select results_eq(
  format($q$ select a.profile_id, r.taker_name from public.mock_test_results(%L) r
             join public.mock_test_attempts a on a.id = r.attempt_id order by a.profile_id $q$, pg_temp.tid(8)),
  $q$ values ('00000000-0000-0000-0000-0000000000c1'::uuid, null::text),
             ('00000000-0000-0000-0000-0000000000e1'::uuid, 'Kid One'),
             ('00000000-0000-0000-0000-0000000000e2'::uuid, 'Profile Two'),
             ('00000000-0000-0000-0000-0000000000e7'::uuid, 'Kid Seven'),
             ('00000000-0000-0000-0000-0000000000f1'::uuid, null) $q$,
  'case 11 (AC 30): profile name first; blank or whitespace-only falls back to the roster name; a parent and a user with neither show null');
select is((select r.taker_name from public.mock_test_results(pg_temp.tid(8)) r join public.mock_test_attempts a on a.id = r.attempt_id
           where a.profile_id = '00000000-0000-0000-0000-0000000000e2'), 'Profile Two',
  'case 11 (AC 30): a student with a profile name shows the profile name, not the roster name');
select is((select r.taker_name from public.mock_test_results(pg_temp.tid(8)) r join public.mock_test_attempts a on a.id = r.attempt_id
           where a.profile_id = '00000000-0000-0000-0000-0000000000e1'), 'Kid One',
  'case 11 (AC 30): a whitespace-only profile name counts as blank: the roster name shows');
select is((select r.taker_name from public.mock_test_results(pg_temp.tid(8)) r join public.mock_test_attempts a on a.id = r.attempt_id
           where a.profile_id = '00000000-0000-0000-0000-0000000000e7'), 'Kid Seven',
  'case 11 (AC 30): an empty profile name falls back to the roster name');
select is((select count(*)::int from public.mock_test_results(pg_temp.tid(8)) r where r.taker_name is null), 2,
  'case 11 (AC 30): the parent and the signed-up user have null names (never an e-mail)');

-- ===========================================================================
-- Case 12: role matrix (AC 36, 37)
-- ===========================================================================

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select is((select count(*)::int from public.mock_test_results(pg_temp.tid(1))), 3, 'case 12 (AC 36): an admin at aal2 gets the rows');
reset role;

create function pg_temp.not_admin(p_user uuid, p_label text, p_aal text)
returns setof text
language plpgsql
set search_path = extensions
as $$
begin
  perform tests.authenticate_as(p_user, p_aal);
  return next throws_ok(format('select * from public.mock_test_results(%L)', pg_temp.tid(1)), '42501', 'not_admin',
    'case 12 (AC 37): ' || p_label || ' at ' || p_aal || ' gets not_admin (42501)');
  return next throws_ok(format('select count(*) from public.mock_test_results(%L)', pg_temp.tid(1)), '42501', 'not_admin',
    'case 12 (AC 37): ' || p_label || ' at ' || p_aal || ' gets no row');
end;
$$;

select * from pg_temp.not_admin('00000000-0000-0000-0000-0000000000a1', 'an admin', 'aal1');
reset role;
select * from pg_temp.not_admin('00000000-0000-0000-0000-0000000000b1', 'a tutor', 'aal2');
reset role;
select * from pg_temp.not_admin('00000000-0000-0000-0000-0000000000c1', 'a parent', 'aal1');
reset role;
select * from pg_temp.not_admin('00000000-0000-0000-0000-0000000000c1', 'a parent', 'aal2');
reset role;
select * from pg_temp.not_admin('00000000-0000-0000-0000-0000000000e1', 'a student', 'aal1');
reset role;
select * from pg_temp.not_admin('00000000-0000-0000-0000-0000000000e1', 'a student', 'aal2');
reset role;
select * from pg_temp.not_admin('00000000-0000-0000-0000-0000000000f1', 'a signed-up user', 'aal1');
reset role;
select * from pg_temp.not_admin('00000000-0000-0000-0000-0000000000f1', 'a signed-up user', 'aal2');
reset role;
select * from pg_temp.not_admin('00000000-0000-0000-0000-0000000000a2', 'an inactive admin', 'aal2');
reset role;

select tests.authenticate_as_anon();
select throws_ok(format($$ select * from public.mock_test_results(%L) $$, pg_temp.tid(1)), '42501', null,
  'case 12 (AC 37): a visitor (anon) gets permission denied for mock_test_results');
reset role;

create function pg_temp.no_direct_reads(p_user uuid, p_label text)
returns setof text
language plpgsql
set search_path = extensions
as $$
begin
  perform tests.authenticate_as(p_user);
  return next throws_ok($q$ select * from public.mock_test_attempts $q$, '42501', null,
    'case 12 (AC 37): ' || p_label || ' cannot select from mock_test_attempts');
  return next throws_ok($q$ select * from public.mock_test_answers $q$, '42501', null,
    'case 12 (AC 37): ' || p_label || ' cannot select from mock_test_answers');
end;
$$;
select * from pg_temp.no_direct_reads('00000000-0000-0000-0000-0000000000b1', 'a tutor');
reset role;
select * from pg_temp.no_direct_reads('00000000-0000-0000-0000-0000000000e1', 'a student');
reset role;
select * from pg_temp.no_direct_reads('00000000-0000-0000-0000-0000000000e2', 'a second student');
reset role;
select * from pg_temp.no_direct_reads('00000000-0000-0000-0000-0000000000c1', 'a parent');
reset role;
select * from pg_temp.no_direct_reads('00000000-0000-0000-0000-0000000000f1', 'a signed-up user');
reset role;

-- ===========================================================================
-- Case 13: taker privacy (AC 38)
-- ===========================================================================

select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select is((select jsonb_build_array(count(*), min(score), max(score)) from public.mock_tests_for_me() where id = pg_temp.tid(1)),
  '[1, 8, 8]'::jsonb, 'case 13 (AC 38): student A''s list has one row for TA, with their own score 8');
select is((public.mock_test_open(pg_temp.tid(1))->>'score')::int, 8, 'case 13 (AC 38): and their open view says 8, not 0 or 10');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e2');
select is((select jsonb_build_array(status, score) from public.mock_tests_for_me() where id = pg_temp.tid(1)),
  '["in_progress", null]'::jsonb, 'case 13 (AC 38): student B, still in progress on TA, sees no score although three others submitted');
select is(public.mock_test_open(pg_temp.tid(1))->'score', 'null'::jsonb, 'case 13 (AC 38): nor in the open view');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select is((select jsonb_build_array(count(*), min(score), max(score)) from public.mock_tests_for_me() where id = pg_temp.tid(1)),
  '[1, 0, 0]'::jsonb, 'case 13 (AC 38): a parent sees only their own attempt on TA: score 0, not 8 or 10');
select is((public.mock_test_open(pg_temp.tid(1))->>'passed')::boolean, false, 'case 13 (AC 38): and their own result: not passed');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000f1');
select is((select jsonb_build_array(count(*), min(score), max(score)) from public.mock_tests_for_me() where id = pg_temp.tid(1)),
  '[1, 10, 10]'::jsonb, 'case 13 (AC 38): a signed-up user sees only their own score 10');
reset role;

-- ===========================================================================
-- Case 8 (closing): closing, close-now, reopen and a tag edit leave every attempt as stored (AC 40 to 43)
-- ===========================================================================

select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select pg_temp.take(9, array[0, 0]);
reset role;
create temp table attempts_before as select * from public.mock_test_attempts;
select ok((select count(*) from attempts_before) > 0, 'case 8 (AC 40): the snapshot holds attempt rows');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok(format($$ select public.mock_set_closing(%L, now() + interval '1 day') $$, pg_temp.tid(9)),
  'case 8 (AC 41): setting a closing time works');
select lives_ok(format($$ select public.mock_close_now(%L) $$, pg_temp.tid(9)), 'case 8 (AC 41): close now works');
select lives_ok(format($$ select public.mock_set_closing(%L, null) $$, pg_temp.tid(9)), 'case 8 (AC 41): reopening works');
select lives_ok(format($$ update public.mock_tests set subject = 'english' where id = %L $$, pg_temp.tid(9)),
  'case 8 (AC 41): a tag edit on a released test works');
reset role;
select is((select string_agg(a::text, '|' order by a.id) from public.mock_test_attempts a),
  (select string_agg(b::text, '|' order by b.id) from attempts_before b),
  'case 8 (AC 41, 42, 43): every attempt row is byte for byte as before');
select is((select string_agg(a.score || '/' || a.total, ',' order by a.id) from public.mock_test_attempts a where a.submitted_at is not null),
  (select string_agg(b.score || '/' || b.total, ',' order by b.id) from attempts_before b where b.submitted_at is not null),
  'case 8 (AC 41, 42, 43): and so are the score and total of every submitted attempt');

-- ===========================================================================
-- Case 14: ACL and function attributes (architecture 3.1)
-- ===========================================================================

select is(p.prosecdef, true, format('case 14: %s is security definer', p.oid::regprocedure))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('mock_submit', 'mock_tests_for_me', 'mock_test_open', 'mock_test_results');
select is(p.proconfig, array['search_path=""'], format('case 14: %s has an empty search_path', p.oid::regprocedure))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('mock_submit', 'mock_tests_for_me', 'mock_test_open', 'mock_test_results');
select is(has_function_privilege('anon', p.oid, 'execute'), false, format('case 14: anon cannot execute %s', p.oid::regprocedure))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('mock_submit', 'mock_tests_for_me', 'mock_test_open', 'mock_test_results');
select is(has_function_privilege('public', p.oid, 'execute'), false, format('case 14: public cannot execute %s', p.oid::regprocedure))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('mock_submit', 'mock_tests_for_me', 'mock_test_open', 'mock_test_results');
select is(has_function_privilege('authenticated', p.oid, 'execute'), true, format('case 14: authenticated can execute %s', p.oid::regprocedure))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('mock_submit', 'mock_tests_for_me', 'mock_test_open', 'mock_test_results');

select is(p.proconfig, array['search_path=""'], format('case 14: helper %s has an empty search_path', p.proname))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private' and p.proname in ('mock_percentage', 'mock_passed');
select is(p.provolatile, 'i'::"char", format('case 14: helper %s is immutable', p.proname))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private' and p.proname in ('mock_percentage', 'mock_passed');
select is(p.proisstrict, true, format('case 14: helper %s is strict', p.proname))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private' and p.proname in ('mock_percentage', 'mock_passed');

-- ===========================================================================
-- Case 15: the attempts tables stay closed
-- ===========================================================================

select is((select count(*)::int from information_schema.role_table_grants
           where table_schema = 'public' and table_name in ('mock_test_attempts', 'mock_test_answers')
             and grantee in ('anon', 'authenticated', 'PUBLIC')),
  0, 'case 15: mock_test_attempts and mock_test_answers have no table grant for anon, authenticated or PUBLIC');
select is((select count(*)::int from information_schema.column_privileges
           where table_schema = 'public' and table_name in ('mock_test_attempts', 'mock_test_answers')
             and grantee in ('anon', 'authenticated', 'PUBLIC')),
  0, 'case 15: nor any column grant');

select * from finish();
rollback;
