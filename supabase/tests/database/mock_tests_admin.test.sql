-- Mock tests, admin side (docs/delivery/2026-11-17-mock-tests/03-design.md §2, §8): who may write,
-- the column grants, the limits, the freeze on released tests, release and take-back, reorder,
-- the admin list. Taker functions are in mock_tests_taker.test.sql.

begin;
select no_plan();
select tests.remove_all_accounts();
delete from public.mock_tests;

select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin1@test.local', 'admin');
select tests.create_staff('00000000-0000-0000-0000-0000000000a2', 'admin2@test.local', 'admin');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor@test.local');
select tests.create_family_account('00000000-0000-0000-0000-0000000000c1', 'parent@test.local', 'parent');
select tests.create_family_account('00000000-0000-0000-0000-0000000000e1', 'kid@test.local', 'student');
select tests.create_sign_up('00000000-0000-0000-0000-0000000000f1', 'user@test.local');
insert into public.students (id, full_name, year_level, profile_id, consent_recorded_at, consent_source)
values ('00000000-0000-0000-0000-00000000d001', 'Kid One', 8, '00000000-0000-0000-0000-0000000000e1', now(), 'admin');

-- ---------------------------------------------------------------------------
-- An admin creates a draft (AC 1, 11)
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok(
  $$ insert into public.mock_tests (title, instructions) values ('Maths mock', 'Read each question.') $$,
  'An admin can create a mock test with just a title and instructions');
reset role;
-- Column grants don't include id, so an admin can't pick one: give the rows fixed ids as postgres.
update public.mock_tests set id = '00000000-0000-0000-0000-00000000f001' where title = 'Maths mock';

select results_eq(
  $$ select status, created_by, released_at, released_by from public.mock_tests
     where id = '00000000-0000-0000-0000-00000000f001' $$,
  $$ values ('draft'::text, '00000000-0000-0000-0000-0000000000a1'::uuid, null::timestamptz, null::uuid) $$,
  'A new test is a draft, created_by is the caller, nothing is released');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok(
  $$ insert into public.mock_tests (title, created_by) values ('Sneaky', '00000000-0000-0000-0000-0000000000a2') $$,
  '42501', null, 'created_by can''t be written');
select throws_ok(
  $$ insert into public.mock_tests (title, status, released_at) values ('Sneaky', 'released', now()) $$,
  '42501', null, 'status and released_at can''t be written on insert');
select throws_ok(
  $$ update public.mock_tests set status = 'released' where id = '00000000-0000-0000-0000-00000000f001' $$,
  '42501', null, 'status can''t be updated directly');
select throws_ok(
  $$ update public.mock_tests set released_at = now() where id = '00000000-0000-0000-0000-00000000f001' $$,
  '42501', null, 'released_at can''t be updated directly');
select throws_ok(
  $$ update public.mock_tests set released_by = '00000000-0000-0000-0000-0000000000a1' where id = '00000000-0000-0000-0000-00000000f001' $$,
  '42501', null, 'released_by can''t be updated directly');
select throws_ok(
  $$ update public.mock_tests set created_by = null where id = '00000000-0000-0000-0000-00000000f001' $$,
  '42501', null, 'created_by can''t be updated');
select throws_ok(
  $$ update public.mock_test_questions set position = 9 $$,
  '42501', null, 'position can''t be updated directly');
select throws_ok(
  $$ insert into public.mock_test_questions (test_id, position, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f001', 5, 'Q', array['a','b'], 0) $$,
  '42501', null, 'position can''t be set on insert');
reset role;

-- An admin without two-step (aal1) gets nothing
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal1');
select is((select count(*)::int from public.mock_tests), 0, 'An admin without two-step sees no tests');
select throws_ok(
  $$ insert into public.mock_tests (title) values ('No two-step') $$,
  '42501', null, 'An admin without two-step can''t create a test');
select throws_ok($$ select * from public.mock_tests_admin_list() $$, '42501', 'not_admin',
  'An admin without two-step is refused by the list function');
reset role;

-- Title and instructions limits (AC 11)
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok($$ insert into public.mock_tests (title) values ('') $$, '23514', null, 'An empty title is refused');
select throws_ok($$ insert into public.mock_tests (title) values ('     ') $$, '23514', null, 'A title of only spaces is refused');
select throws_ok($$ insert into public.mock_tests (title) values ('x') $$, '23514', null, 'A 1-character title is refused');
select throws_ok($$ insert into public.mock_tests (title) values (' x ') $$, '23514', null, 'A title of 1 character plus padding is refused');
select throws_ok($$ insert into public.mock_tests (title) values (repeat('x', 151)) $$, '23514', null, 'A 151-character title is refused');
select throws_ok($$ insert into public.mock_tests (title) values (' ' || repeat('x', 150)) $$, '23514', null,
  'Padding can''t take a title past 150 characters');
select lives_ok($$ insert into public.mock_tests (title) values (repeat('x', 150)) $$,
  'A 150-character title is fine');
select lives_ok($$ insert into public.mock_tests (title) values ('ab') $$, 'A 2-character title is fine');
select throws_ok($$ insert into public.mock_tests (title, instructions) values ('Long', repeat('x', 4001)) $$,
  '23514', null, 'Instructions over 4000 characters are refused');
select lives_ok($$ insert into public.mock_tests (title, instructions) values ('Long', repeat('x', 4000)) $$,
  'Instructions of 4000 characters are fine');
select throws_ok(
  $$ update public.mock_tests set title = ' ' where id = '00000000-0000-0000-0000-00000000f001' $$,
  '23514', null, 'Updating to a blank title is refused');
reset role;

delete from public.mock_tests where id <> '00000000-0000-0000-0000-00000000f001';

-- ---------------------------------------------------------------------------
-- Questions: shape and limits (AC 12, 14)
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option, explanation)
     values ('00000000-0000-0000-0000-00000000f001', 'What is 2 + 2?', array['3','4','5'], 1, 'Add them.') $$,
  'An admin can add a question');
select throws_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f001', 'Q', array['only'], 0) $$,
  '23514', null, 'One option is refused');
select throws_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f001', 'Q', array['1','2','3','4','5','6','7'], 0) $$,
  '23514', null, 'Seven options are refused');
select lives_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f001', 'Six', array['1','2','3','4','5','6'], 5) $$,
  'Six options with the last one correct is fine');
select throws_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f001', 'Q', array['a','b'], 2) $$,
  '23514', null, 'A correct option past the last option is refused');
select throws_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f001', 'Q', array['a','b'], -1) $$,
  '23514', null, 'A negative correct option is refused');
select throws_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f001', 'Q', array['a', repeat('x', 301)], 0) $$,
  '23514', null, 'A 301-character option is refused');
select lives_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f001', 'Long option', array['a', repeat('x', 300)], 0) $$,
  'A 300-character option is fine');
select throws_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f001', repeat('x', 2001), array['a','b'], 0) $$,
  '23514', null, 'A 2001-character prompt is refused');
select throws_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f001', '', array['a','b'], 0) $$,
  '23514', null, 'An empty prompt is refused');
select throws_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f001', E'  \n\t ', array['a','b'], 0) $$,
  '23514', null, 'A whitespace-only prompt is refused');
select throws_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option, explanation)
     values ('00000000-0000-0000-0000-00000000f001', 'Q', array['a','b'], 0, repeat('x', 2001)) $$,
  '23514', null, 'A 2001-character explanation is refused');
select lives_ok(
  $$ update public.mock_test_questions set prompt = 'What is two plus two?', explanation = 'Count.'
     where prompt = 'What is 2 + 2?' $$,
  'An admin can edit a question');
reset role;
update public.mock_test_questions set id = '00000000-0000-0000-0000-0000000a0001' where prompt = 'What is two plus two?';
update public.mock_test_questions set id = '00000000-0000-0000-0000-0000000a0002' where prompt = 'Six';
update public.mock_test_questions set id = '00000000-0000-0000-0000-0000000a0003' where prompt = 'Long option';

select results_eq(
  $$ select id, position from public.mock_test_questions where test_id = '00000000-0000-0000-0000-00000000f001' order by position $$,
  $$ values ('00000000-0000-0000-0000-0000000a0001'::uuid, 1), ('00000000-0000-0000-0000-0000000a0002'::uuid, 2),
            ('00000000-0000-0000-0000-0000000a0003'::uuid, 3) $$,
  'New questions go last, in order, and the refused ones left no trace');

-- ---------------------------------------------------------------------------
-- The 100-question cap (AC 13)
-- ---------------------------------------------------------------------------

insert into public.mock_tests (id, title) values ('00000000-0000-0000-0000-00000000f002', 'Cap test');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     select '00000000-0000-0000-0000-00000000f002', 'Q' || n, array['a','b'], 0 from generate_series(1, 100) n $$,
  'A test can hold 100 questions');
select throws_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f002', 'One too many', array['a','b'], 0) $$,
  'P0001', 'mock_too_many_questions', 'The 101st question is refused');
reset role;
select results_eq(
  $$ select count(*)::int, min(position), max(position) from public.mock_test_questions
     where test_id = '00000000-0000-0000-0000-00000000f002' $$,
  $$ values (100, 1, 100) $$, '100 questions at positions 1 to 100');
delete from public.mock_tests where id = '00000000-0000-0000-0000-00000000f002';

-- ---------------------------------------------------------------------------
-- A second admin edits the first admin's draft; last save wins (AC 2, 15)
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a2', 'aal2');
select is((select count(*)::int from public.mock_tests where id = '00000000-0000-0000-0000-00000000f001'), 1,
  'A second admin sees the first admin''s draft');
select lives_ok(
  $$ update public.mock_tests set title = 'Renamed by admin 2' where id = '00000000-0000-0000-0000-00000000f001' $$,
  'A second admin can edit it');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok(
  $$ update public.mock_tests set title = 'Maths mock' where id = '00000000-0000-0000-0000-00000000f001' $$,
  'The first admin saves afterwards');
select is((select title from public.mock_tests where id = '00000000-0000-0000-0000-00000000f001'), 'Maths mock',
  'The last save wins');
reset role;

-- ---------------------------------------------------------------------------
-- Reorder (AC 13): gaps are kept, a move swaps with the nearest neighbour, ends are no-ops
-- ---------------------------------------------------------------------------

insert into public.mock_tests (id, title) values ('00000000-0000-0000-0000-00000000f003', 'Reorder test');
insert into public.mock_test_questions (id, test_id, prompt, options, correct_option) values
  ('00000000-0000-0000-0000-0000000b0001', '00000000-0000-0000-0000-00000000f003', 'One', array['a','b'], 0),
  ('00000000-0000-0000-0000-0000000b0002', '00000000-0000-0000-0000-00000000f003', 'Two', array['a','b'], 0),
  ('00000000-0000-0000-0000-0000000b0003', '00000000-0000-0000-0000-00000000f003', 'Three', array['a','b'], 0);

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok($$ delete from public.mock_test_questions where id = '00000000-0000-0000-0000-0000000b0002' $$,
  'An admin can delete a question from a draft');
select results_eq(
  $$ select position from public.mock_test_questions where test_id = '00000000-0000-0000-0000-00000000f003' order by position $$,
  $$ values (1), (3) $$, 'Deleting question 2 leaves positions 1 and 3');
select lives_ok($$ select public.mock_move_question('00000000-0000-0000-0000-0000000b0001', 1) $$,
  'Moving question 1 down works across the gap');
select results_eq(
  $$ select id from public.mock_test_questions where test_id = '00000000-0000-0000-0000-00000000f003' order by position $$,
  $$ values ('00000000-0000-0000-0000-0000000b0003'::uuid), ('00000000-0000-0000-0000-0000000b0001'::uuid) $$,
  'It swapped with question 3');
select lives_ok($$ select public.mock_move_question('00000000-0000-0000-0000-0000000b0001', 1) $$,
  'Moving the last question down is allowed');
select results_eq(
  $$ select id from public.mock_test_questions where test_id = '00000000-0000-0000-0000-00000000f003' order by position $$,
  $$ values ('00000000-0000-0000-0000-0000000b0003'::uuid), ('00000000-0000-0000-0000-0000000b0001'::uuid) $$,
  'and changes nothing');
select lives_ok($$ select public.mock_move_question('00000000-0000-0000-0000-0000000b0003', -1) $$,
  'Moving the first question up is allowed');
select results_eq(
  $$ select id from public.mock_test_questions where test_id = '00000000-0000-0000-0000-00000000f003' order by position $$,
  $$ values ('00000000-0000-0000-0000-0000000b0003'::uuid), ('00000000-0000-0000-0000-0000000b0001'::uuid) $$,
  'and changes nothing');
select lives_ok($$ select public.mock_move_question('00000000-0000-0000-0000-0000000b0001', -1) $$,
  'Moving question 1 back up works');
select results_eq(
  $$ select id from public.mock_test_questions where test_id = '00000000-0000-0000-0000-00000000f003' order by position $$,
  $$ values ('00000000-0000-0000-0000-0000000b0001'::uuid), ('00000000-0000-0000-0000-0000000b0003'::uuid) $$,
  'The order is back');
select throws_ok($$ select public.mock_move_question('00000000-0000-0000-0000-0000000b0001', 0) $$,
  '22023', 'invalid_input', 'A step of 0 is refused');
select throws_ok($$ select public.mock_move_question('00000000-0000-0000-0000-0000000b0001', 2) $$,
  '22023', 'invalid_input', 'A step of 2 is refused');
select throws_ok($$ select public.mock_move_question('00000000-0000-0000-0000-0000000b0001', null) $$,
  '22023', 'invalid_input', 'A null step is refused');
select throws_ok($$ select public.mock_move_question('00000000-0000-0000-0000-0000000bffff', 1) $$,
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', 'An unknown question is not found');
reset role;

-- ---------------------------------------------------------------------------
-- Release (AC 17, 18, 19)
-- ---------------------------------------------------------------------------

insert into public.mock_tests (id, title) values ('00000000-0000-0000-0000-00000000f004', 'Empty test');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a2', 'aal2');
select throws_ok($$ select public.mock_release('00000000-0000-0000-0000-00000000f004') $$,
  'P0001', 'mock_no_questions', 'A test with no questions can''t be released');
select throws_ok($$ select public.mock_release('00000000-0000-0000-0000-00000000f0ff') $$,
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', 'An unknown test is not found');
select lives_ok($$ select public.mock_release('00000000-0000-0000-0000-00000000f001') $$,
  'Any admin (not just the creator) can release a draft with questions');
select results_eq(
  $$ select status, released_by, released_at is not null from public.mock_tests where id = '00000000-0000-0000-0000-00000000f001' $$,
  $$ values ('released'::text, '00000000-0000-0000-0000-0000000000a2'::uuid, true) $$,
  'Release sets status, released_by and released_at');
select throws_ok($$ select public.mock_release('00000000-0000-0000-0000-00000000f001') $$,
  'P0001', 'invalid_status', 'Releasing a released test is refused');

-- A released test is frozen
select throws_ok(
  $$ update public.mock_tests set title = 'Changed' where id = '00000000-0000-0000-0000-00000000f001' $$,
  'P0001', 'mock_released', 'A released test''s title can''t change');
select throws_ok(
  $$ update public.mock_tests set instructions = 'Changed' where id = '00000000-0000-0000-0000-00000000f001' $$,
  'P0001', 'mock_released', 'A released test''s instructions can''t change');
select throws_ok(
  $$ delete from public.mock_tests where id = '00000000-0000-0000-0000-00000000f001' $$,
  'P0001', 'mock_released', 'A released test can''t be deleted');
select throws_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f001', 'Late', array['a','b'], 0) $$,
  'P0001', 'mock_released', 'No question can be added to a released test');
select throws_ok(
  $$ update public.mock_test_questions set prompt = 'Changed' where id = '00000000-0000-0000-0000-0000000a0001' $$,
  'P0001', 'mock_released', 'No question of a released test can be edited');
select throws_ok(
  $$ delete from public.mock_test_questions where id = '00000000-0000-0000-0000-0000000a0001' $$,
  'P0001', 'mock_released', 'No question of a released test can be deleted');
select throws_ok(
  $$ select public.mock_move_question('00000000-0000-0000-0000-0000000a0001', 1) $$,
  'P0001', 'mock_released', 'No question of a released test can be moved');
select throws_ok(
  $$ update public.mock_tests set status = 'draft' where id = '00000000-0000-0000-0000-00000000f001' $$,
  '42501', null, 'A released test can''t be sent back to draft by a direct update');
reset role;

-- ---------------------------------------------------------------------------
-- Take back to draft (AC 20, 21)
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok($$ select public.mock_withdraw('00000000-0000-0000-0000-00000000f004') $$,
  'P0001', 'invalid_status', 'A draft can''t be taken back');
select throws_ok($$ select public.mock_withdraw('00000000-0000-0000-0000-00000000f0ff') $$,
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', 'An unknown test is not found');
select lives_ok($$ select public.mock_withdraw('00000000-0000-0000-0000-00000000f001') $$,
  'A released test with no attempt goes back to draft');
select results_eq(
  $$ select status, released_by, released_at from public.mock_tests where id = '00000000-0000-0000-0000-00000000f001' $$,
  $$ values ('draft'::text, null::uuid, null::timestamptz) $$,
  'and its release fields are cleared');
select lives_ok(
  $$ update public.mock_tests set title = 'Maths mock v2' where id = '00000000-0000-0000-0000-00000000f001' $$,
  'and it is editable again');
select lives_ok($$ select public.mock_release('00000000-0000-0000-0000-00000000f001') $$, 'It can be released again');
reset role;

-- An in-progress attempt doesn't block take-back: it is deleted with its answers (ruling L-5)
insert into public.mock_test_attempts (id, test_id, profile_id)
values ('00000000-0000-0000-0000-0000000b0001', '00000000-0000-0000-0000-00000000f001',
        '00000000-0000-0000-0000-0000000000e1');
insert into public.mock_test_answers (attempt_id, question_id, selected_option)
values ('00000000-0000-0000-0000-0000000b0001', '00000000-0000-0000-0000-0000000a0001', 0);
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok($$ select public.mock_withdraw('00000000-0000-0000-0000-00000000f001') $$,
  'An in-progress attempt doesn''t block take-back');
reset role;
select is((select count(*)::int from public.mock_test_attempts
           where test_id = '00000000-0000-0000-0000-00000000f001'), 0,
  'and the in-progress attempt is deleted');
select is((select count(*)::int from public.mock_test_answers
           where attempt_id = '00000000-0000-0000-0000-0000000b0001'), 0,
  'and so are its answers');

-- A start that queued behind the withdraw's row lock re-checks the status and is refused, so the
-- two can't both win. (True two-session timing is the S8 check; this is the outcome once serialised.)
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select public.mock_start('00000000-0000-0000-0000-00000000f001') $$,
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', 'A start after the take-back finds no released test');
select throws_ok(
  $$ select public.mock_save_answer('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000a0001', 0) $$,
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', 'A save after the take-back is refused');
select throws_ok($$ select public.mock_submit('00000000-0000-0000-0000-00000000f001') $$,
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', 'A submit after the take-back is refused');
reset role;
select is((select count(*)::int from public.mock_test_attempts
           where test_id = '00000000-0000-0000-0000-00000000f001'), 0,
  'and creates no attempt');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok($$ select public.mock_release('00000000-0000-0000-0000-00000000f001') $$, 'It is released again');
reset role;

-- A submitted attempt blocks take-back
insert into public.mock_test_attempts (test_id, profile_id, submitted_at, score, total)
values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000f1', now(), 1, 3);
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok($$ select public.mock_withdraw('00000000-0000-0000-0000-00000000f001') $$,
  'P0001', 'mock_has_attempts', 'A submitted attempt blocks take-back');
select is((select status from public.mock_tests where id = '00000000-0000-0000-0000-00000000f001'), 'released',
  'and the test stays released');
reset role;

-- A question for a test that doesn't exist is refused, not silently dropped (06-security #3)
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000fbad', 'Orphan', array['a','b'], 0) $$,
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', 'A question for a missing test raises not_found');
reset role;

-- The answer key on mock_test_questions is protected by the admin-only RLS policies alone
-- (authenticated has a select grant). A taker-facing policy would expose correct_option: pin
-- that the table has exactly the four admin policies, each gated on is_admin().
select set_eq(
  $$ select policyname::text from pg_policies
     where schemaname = 'public' and tablename = 'mock_test_questions' $$,
  array['mock_test_questions_admin_select', 'mock_test_questions_admin_insert',
        'mock_test_questions_admin_update', 'mock_test_questions_admin_delete'],
  'mock_test_questions has only the four admin policies');
select is((select count(*)::int from pg_policies
           where schemaname = 'public' and tablename = 'mock_test_questions'
             and coalesce(qual, with_check) not like '%is_admin()%'), 0,
  'and every one of them is gated on is_admin()');

-- not_found reaches the browser as HTTP 404, not 500 (BUG-1): PostgREST reads the status from the
-- PGRST error's detail, and the body keeps code P0002 and message not_found for the web mapping.
create function pg_temp.mock_not_found_detail() returns text language plpgsql as $f$
declare
  found_detail text;
begin
  perform private.raise_mock_not_found();
  return null;
exception when sqlstate 'PGRST' then
  get stacked diagnostics found_detail = pg_exception_detail;
  return found_detail;
end;
$f$;
select is(pg_temp.mock_not_found_detail()::jsonb ->> 'status', '404', 'not_found is sent as HTTP 404');

-- ---------------------------------------------------------------------------
-- Deleting a draft takes its questions with it (AC 16)
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok($$ delete from public.mock_tests where id = '00000000-0000-0000-0000-00000000f003' $$,
  'An admin can delete a draft');
reset role;
select is((select count(*)::int from public.mock_test_questions where test_id = '00000000-0000-0000-0000-00000000f003'), 0,
  'Its questions went with it');

-- ---------------------------------------------------------------------------
-- Status values and columns (AC 22)
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.mock_tests set status = 'archived' where id = '00000000-0000-0000-0000-00000000f004' $$,
  '23514', null, 'A third status value is refused');
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name like 'mock\_test%' and column_name ~ 'schedul|archiv|publish_at|release_on'),
  0, 'There is no schedule or archive column');
select throws_ok(
  $$ update public.mock_tests set status = 'released', released_at = null where id = '00000000-0000-0000-0000-00000000f004' $$,
  '23514', null, 'Released without a release time is refused');

-- ---------------------------------------------------------------------------
-- The admin list (AC 23, 24): counts, creator name, nothing about takers
-- ---------------------------------------------------------------------------

-- Make 0001 the oldest, then a question change should bring it back to the top.
update public.mock_tests set updated_at = '2020-01-01' where id = '00000000-0000-0000-0000-00000000f004';
insert into public.mock_test_attempts (test_id, profile_id)
values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000e1');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a2', 'aal2');
select results_eq(
  $$ select id, title, status, question_count, submitted_count, created_by_name
     from public.mock_tests_admin_list() where id = '00000000-0000-0000-0000-00000000f001' $$,
  $$ values ('00000000-0000-0000-0000-00000000f001'::uuid, 'Maths mock v2'::text, 'released'::text, 3, 1, 'Test admin1'::text) $$,
  'The list shows counts (one submitted, one in progress counts as not submitted) and the creator''s name');
select is(
  (select array_agg(k order by k) from jsonb_object_keys(
     (select to_jsonb(l) from public.mock_tests_admin_list() l limit 1)) k),
  array['created_at','created_by_name','id','question_count','released_at','status','submitted_count','title','updated_at'],
  'The list has exactly the documented columns: no taker, answer or score column');
select is((select count(*)::int from public.mock_tests_admin_list()), 2, 'The list holds every test, whoever made it');
select is((select id from public.mock_tests_admin_list() limit 1), '00000000-0000-0000-0000-00000000f001'::uuid,
  'Most recently changed first');
reset role;

update public.mock_tests set updated_at = '2020-01-01' where id = '00000000-0000-0000-0000-00000000f004';
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok(
  $$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000f004', 'New', array['a','b'], 0) $$,
  'A question is added to the draft');
select ok((select updated_at from public.mock_tests where id = '00000000-0000-0000-0000-00000000f004') > '2020-01-02',
  'Adding a question updates the test''s last-changed time');
reset role;

-- ---------------------------------------------------------------------------
-- Admins can't read attempts or answers (AC 37, admin side)
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok($$ select * from public.mock_test_attempts $$, '42501', null, 'An admin can''t select attempts');
select throws_ok($$ select * from public.mock_test_answers $$, '42501', null, 'An admin can''t select answers');
select throws_ok($$ insert into public.mock_test_attempts (test_id, profile_id)
  values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'An admin can''t insert attempts');
select throws_ok($$ delete from public.mock_test_attempts $$, '42501', null, 'An admin can''t delete attempts');
reset role;

-- ---------------------------------------------------------------------------
-- Everyone else: tutor, parent, student, signed-up user, visitor (AC 1, 7)
-- ---------------------------------------------------------------------------

create function pg_temp.sweep_as(p_user uuid, p_label text)
returns setof text
language plpgsql
set search_path = extensions -- pgTAP; every table and function below is schema-qualified
as $$
declare
  t text;
  n bigint;
begin
  perform tests.authenticate_as(p_user, 'aal2');
  -- The two draft tables are granted to every signed-in user, so row-level security hides the rows.
  foreach t in array array['mock_tests', 'mock_test_questions'] loop
    execute format('select count(*) from public.%I', t) into n;
    return next is(n, 0::bigint, p_label || ' sees no rows of ' || t);
    execute format('delete from public.%I', t);
    get diagnostics n = row_count;
    return next is(n, 0::bigint, p_label || ' deletes no rows of ' || t);
  end loop;
  update public.mock_tests set title = 'Nope';
  get diagnostics n = row_count;
  return next is(n, 0::bigint, p_label || ' updates no test');
  update public.mock_test_questions set prompt = 'Nope';
  get diagnostics n = row_count;
  return next is(n, 0::bigint, p_label || ' updates no question');
  -- The two taker tables have no grant at all.
  foreach t in array array['mock_test_attempts', 'mock_test_answers'] loop
    return next throws_ok(format('select * from public.%I', t), '42501', null, p_label || ' can''t select ' || t);
    return next throws_ok(format('delete from public.%I', t), '42501', null, p_label || ' can''t delete from ' || t);
  end loop;
  return next throws_ok($q$ insert into public.mock_tests (title) values ('Nope') $q$, '42501', null,
    p_label || ' can''t create a test');
  return next throws_ok($q$ insert into public.mock_test_questions (test_id, prompt, options, correct_option)
    values ('00000000-0000-0000-0000-00000000f004', 'Nope', array['a','b'], 0) $q$, '42501', null,
    p_label || ' can''t add a question');
  return next throws_ok($q$ select * from public.mock_tests_admin_list() $q$, '42501', 'not_admin',
    p_label || ' is refused by the admin list');
  return next throws_ok($q$ select public.mock_release('00000000-0000-0000-0000-00000000f004') $q$, '42501', 'not_admin',
    p_label || ' can''t release');
  return next throws_ok($q$ select public.mock_withdraw('00000000-0000-0000-0000-00000000f001') $q$, '42501', 'not_admin',
    p_label || ' can''t take back');
  return next throws_ok($q$ select public.mock_move_question('00000000-0000-0000-0000-0000000a0001', 1) $q$, '42501', 'not_admin',
    p_label || ' can''t move a question');
end;
$$;

select * from pg_temp.sweep_as('00000000-0000-0000-0000-0000000000b1', 'A tutor');
reset role;
select * from pg_temp.sweep_as('00000000-0000-0000-0000-0000000000c1', 'A parent');
reset role;
select * from pg_temp.sweep_as('00000000-0000-0000-0000-0000000000e1', 'A student');
reset role;
select * from pg_temp.sweep_as('00000000-0000-0000-0000-0000000000f1', 'A signed-up user');
reset role;

select tests.authenticate_as_anon();
select throws_ok($$ select * from public.mock_tests $$, '42501', null, 'A visitor can''t select tests');
select throws_ok($$ select * from public.mock_test_questions $$, '42501', null, 'A visitor can''t select questions');
select throws_ok($$ select * from public.mock_tests_admin_list() $$, '42501', null, 'A visitor can''t call the admin list');
select throws_ok($$ select public.mock_release('00000000-0000-0000-0000-00000000f004') $$, '42501', null,
  'A visitor can''t release');
reset role;

select * from finish();
rollback;
