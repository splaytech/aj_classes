-- Mock tests: closing date and close now (docs/delivery/2026-11-18-mock-test-closing/01-requirement.md,
-- migration 20261119100000_mock_test_closing.sql). Release with a closing time, set, change and
-- clear it, close now, reopen, take back, and that a closed test is "not found" to every taker.
-- now() is fixed for the whole transaction, while the closed checks use clock_timestamp() (review-5
-- #2), so a closes_at of now() is already at or past the boundary and counts as closed.

begin;
select no_plan();
select tests.remove_all_accounts();
select tests.remove_all_classes();
delete from public.mock_tests;

select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor@test.local');
select tests.create_family_account('00000000-0000-0000-0000-0000000000e1', 'kid@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000000e2', 'kid2@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000000c1', 'parent@test.local', 'parent');
select tests.create_sign_up('00000000-0000-0000-0000-0000000000f1', 'user@test.local');
insert into public.students (id, full_name, year_level, profile_id, consent_recorded_at, consent_source, is_active)
values ('00000000-0000-0000-0000-00000000d001', 'Kid One', 8, '00000000-0000-0000-0000-0000000000e1', now(), 'admin', true),
       ('00000000-0000-0000-0000-00000000d002', 'Kid Two', 8, '00000000-0000-0000-0000-0000000000e2', now(), 'admin', true);

-- T1 and T2 are drafts with one question each; T9 is a draft with none.
insert into public.mock_tests (id, title, subject, stream, any_year) values
  ('00000000-0000-0000-0000-00000000f001', 'Maths mock', 'maths', 'naplan', true),
  ('00000000-0000-0000-0000-00000000f002', 'English mock', 'maths', 'naplan', true),
  ('00000000-0000-0000-0000-00000000f009', 'Empty mock', 'maths', 'naplan', true);
insert into public.mock_test_questions (id, test_id, prompt, options, correct_option) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000f001', 'First?', array['a','b'], 1),
  ('00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-00000000f002', 'Second?', array['a','b'], 0);

-- ---------------------------------------------------------------------------
-- The column and the functions (limits of 01-requirement)
-- ---------------------------------------------------------------------------

select has_column('public', 'mock_tests', 'closes_at', 'mock_tests has closes_at');
select col_type_is('public', 'mock_tests', 'closes_at', 'timestamp with time zone', 'closes_at is a timestamptz');
select col_is_null('public', 'mock_tests', 'closes_at', 'closes_at is nullable: null never closes');
select is(
  (select count(*)::int from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'mock_tests' and column_name = 'closes_at'
     and grantee in ('authenticated', 'anon', 'PUBLIC') and privilege_type in ('INSERT', 'UPDATE')),
  0, 'closes_at has no insert or update grant for authenticated, anon or public');

select is(
  (select array_agg(p.proname::text || ':' || p.prosecdef::text || ':' || array_to_string(p.proconfig, ',') order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('mock_release', 'mock_set_closing', 'mock_close_now', 'mock_withdraw',
                       'mock_tests_admin_list', 'mock_tests_for_me', 'mock_test_open',
                       'mock_start', 'mock_save_answer', 'mock_submit')),
  array['mock_close_now:true:search_path=""', 'mock_release:true:search_path=""',
        'mock_save_answer:true:search_path=""', 'mock_set_closing:true:search_path=""',
        'mock_start:true:search_path=""', 'mock_submit:true:search_path=""',
        'mock_test_open:true:search_path=""', 'mock_tests_admin_list:true:search_path=""',
        'mock_tests_for_me:true:search_path=""', 'mock_withdraw:true:search_path=""'],
  'Each mock function exists once (no leftover mock_release(uuid)), is security definer with an empty search_path');

select is(
  (select array_agg(f order by f) from unnest(array[
     'public.mock_release(uuid,timestamptz)', 'public.mock_set_closing(uuid,timestamptz)',
     'public.mock_close_now(uuid)', 'public.mock_withdraw(uuid)', 'public.mock_tests_admin_list()']) f
   where has_function_privilege('anon', f, 'execute')),
  null, 'anon can execute none of the admin functions');
select is(
  (select array_agg(f order by f) from unnest(array[
     'public.mock_release(uuid,timestamptz)', 'public.mock_set_closing(uuid,timestamptz)',
     'public.mock_close_now(uuid)', 'public.mock_withdraw(uuid)', 'public.mock_tests_admin_list()']) f
   where not has_function_privilege('authenticated', f, 'execute')),
  null, 'authenticated can execute each of them (the function checks for an admin)');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
          aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where n.nspname = 'public' and p.proname in ('mock_release', 'mock_set_closing', 'mock_close_now')
     and a.privilege_type = 'EXECUTE' and a.grantee = 0),
  0, 'execute is revoked from public on the three closing functions');

-- A draft can't carry a closing time
select throws_ok(
  $$ update public.mock_tests set closes_at = now() + interval '1 day' where id = '00000000-0000-0000-0000-00000000f001' $$,
  '23514', null, 'A draft with a closing time breaks the check');

-- ---------------------------------------------------------------------------
-- Release with a closing time (AC 1)
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok(
  $$ update public.mock_tests set closes_at = now() + interval '1 day' where id = '00000000-0000-0000-0000-00000000f001' $$,
  '42501', null, 'An admin can''t write closes_at directly');
select throws_ok(
  $$ insert into public.mock_tests (title, closes_at) values ('Sneaky', now() + interval '1 day') $$,
  '42501', null, 'An admin can''t set closes_at on insert');
select throws_ok(
  $$ select public.mock_release('00000000-0000-0000-0000-00000000f001', now() - interval '1 minute') $$,
  'P0001', 'mock_closes_in_past', 'Release with a closing time in the past is refused');
select throws_ok(
  $$ select public.mock_release('00000000-0000-0000-0000-00000000f001', now()) $$,
  'P0001', 'mock_closes_in_past', 'Release with a closing time of now is refused (now counts as closed)');
select throws_ok(
  $$ select public.mock_release('00000000-0000-0000-0000-00000000f009', now() + interval '1 day') $$,
  'P0001', 'mock_no_questions', 'The other release rules still apply');
select is((select status from public.mock_tests where id = '00000000-0000-0000-0000-00000000f001'), 'draft',
  'A refused release leaves the test a draft');
select lives_ok(
  $$ select public.mock_release('00000000-0000-0000-0000-00000000f001', now() + interval '1 day') $$,
  'Release with a future closing time works');
select results_eq(
  $$ select status, closes_at = now() + interval '1 day' from public.mock_tests where id = '00000000-0000-0000-0000-00000000f001' $$,
  $$ values ('released'::text, true) $$,
  'and stores the closing time');
select lives_ok(
  $$ select public.mock_release('00000000-0000-0000-0000-00000000f002') $$,
  'Release with only target still works (no closing time)');
select is((select closes_at from public.mock_tests where id = '00000000-0000-0000-0000-00000000f002'), null::timestamptz,
  'and the test never closes');
select throws_ok(
  $$ update public.mock_tests set closes_at = null where id = '00000000-0000-0000-0000-00000000f001' $$,
  '42501', null, 'A released test''s closes_at can''t be written directly either');

-- The admin list carries closes_at (AC 6)
select results_eq(
  $$ select id, closes_at = now() + interval '1 day' from public.mock_tests_admin_list()
     where id in ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f002') order by id $$,
  $$ values ('00000000-0000-0000-0000-00000000f001'::uuid, true), ('00000000-0000-0000-0000-00000000f002'::uuid, null) $$,
  'The admin list returns closes_at');

-- ---------------------------------------------------------------------------
-- Set, change and clear (AC 2), refused cases
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f009', now() + interval '1 day') $$,
  'P0001', 'invalid_status', 'A draft can''t get a closing time');
select throws_ok(
  $$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f0ff', null) $$,
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', 'Setting on an unknown test is not found');
select throws_ok(
  $$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f001', now() - interval '1 second') $$,
  'P0001', 'mock_closes_in_past', 'A new closing time in the past is refused');
select throws_ok(
  $$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f001', now()) $$,
  'P0001', 'mock_closes_in_past', 'A new closing time of now is refused');
select ok((select closes_at = now() + interval '1 day' from public.mock_tests where id = '00000000-0000-0000-0000-00000000f001'),
  'A refused change keeps the old closing time');
select lives_ok(
  $$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f001', now() + interval '2 days') $$,
  'An admin can change the closing time');
select ok((select closes_at = now() + interval '2 days' from public.mock_tests where id = '00000000-0000-0000-0000-00000000f001'),
  'and it is stored');
select lives_ok(
  $$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f001', null) $$,
  'An admin can clear the closing time');
select is((select closes_at from public.mock_tests where id = '00000000-0000-0000-0000-00000000f001'), null::timestamptz,
  'and the test never closes');

-- Close now on a draft or an unknown test
select throws_ok(
  $$ select public.mock_close_now('00000000-0000-0000-0000-00000000f009') $$,
  'P0001', 'invalid_status', 'A draft can''t be closed');
select throws_ok(
  $$ select public.mock_close_now('00000000-0000-0000-0000-00000000f0ff') $$,
  'PGRST', '{"code":"P0002","message":"not_found","details":null,"hint":null}', 'Closing an unknown test is not found');
reset role;

-- An admin without two-step, and everyone else, are refused
create function pg_temp.refused(p_user uuid, p_label text, p_aal text)
returns setof text
language plpgsql
set search_path = extensions -- pgTAP; every table and function below is schema-qualified
as $$
begin
  perform tests.authenticate_as(p_user, p_aal);
  return next throws_ok(
    $q$ select public.mock_release('00000000-0000-0000-0000-00000000f009', now() + interval '1 day') $q$,
    '42501', 'not_admin', p_label || ' can''t release with a closing time');
  return next throws_ok(
    $q$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f001', now() + interval '1 day') $q$,
    '42501', 'not_admin', p_label || ' can''t set a closing time');
  return next throws_ok(
    $q$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f001', null) $q$,
    '42501', 'not_admin', p_label || ' can''t clear a closing time');
  return next throws_ok(
    $q$ select public.mock_close_now('00000000-0000-0000-0000-00000000f001') $q$,
    '42501', 'not_admin', p_label || ' can''t close now');
  return next throws_ok(
    $q$ update public.mock_tests set closes_at = now() $q$,
    '42501', null, p_label || ' can''t write closes_at directly');
end;
$$;

select * from pg_temp.refused('00000000-0000-0000-0000-0000000000a1', 'An admin without two-step', 'aal1');
reset role;
select * from pg_temp.refused('00000000-0000-0000-0000-0000000000b1', 'A tutor', 'aal2');
reset role;
select * from pg_temp.refused('00000000-0000-0000-0000-0000000000e1', 'A student', 'aal1');
reset role;
select * from pg_temp.refused('00000000-0000-0000-0000-0000000000c1', 'A parent', 'aal1');
reset role;
select * from pg_temp.refused('00000000-0000-0000-0000-0000000000f1', 'A signed-up user', 'aal1');
reset role;
select tests.authenticate_as_anon();
select throws_ok($$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f001', null) $$,
  '42501', null, 'A visitor can''t set a closing time');
select throws_ok($$ select public.mock_close_now('00000000-0000-0000-0000-00000000f001') $$,
  '42501', null, 'A visitor can''t close now');
reset role;
select is((select count(*)::int from public.mock_tests where closes_at is not null), 0,
  'No refused caller changed a closing time');

-- ---------------------------------------------------------------------------
-- Takers: open first, then closed (AC 3, 5, 8)
-- ---------------------------------------------------------------------------

-- Each taker has T1 in progress (one answer saved) and T2 submitted.
insert into public.mock_test_attempts (test_id, profile_id)
select '00000000-0000-0000-0000-00000000f001', p
from unnest(array['00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1',
                  '00000000-0000-0000-0000-0000000000f1']::uuid[]) p;
insert into public.mock_test_answers (attempt_id, question_id, selected_option)
select a.id, '00000000-0000-0000-0000-0000000a0001', 0
from public.mock_test_attempts a where a.test_id = '00000000-0000-0000-0000-00000000f001';
insert into public.mock_test_attempts (test_id, profile_id, submitted_at, score, total)
select '00000000-0000-0000-0000-00000000f002', p, now(), 1, 1
from unnest(array['00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1',
                  '00000000-0000-0000-0000-0000000000f1']::uuid[]) p;

-- What a taker sees of T1 (in progress) and T2 (submitted) while both are open.
create function pg_temp.sees_open(p_user uuid, p_label text)
returns setof text
language plpgsql
set search_path = extensions
as $$
begin
  perform tests.authenticate_as(p_user);
  return next results_eq(
    $q$ select id, status from public.mock_tests_for_me() order by id $q$,
    $q$ values ('00000000-0000-0000-0000-00000000f001'::uuid, 'in_progress'::text),
               ('00000000-0000-0000-0000-00000000f002'::uuid, 'submitted'::text) $q$,
    p_label || ': both open tests are in the list');
  return next is(public.mock_test_open('00000000-0000-0000-0000-00000000f002')->>'status', 'submitted',
    p_label || ': the submitted result opens');
  return next lives_ok(
    $q$ select public.mock_save_answer('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000a0001', 0) $q$,
    p_label || ': an open test takes a save');
end;
$$;

-- Closed, ruling S-1 (AC 5.1 to 5.3). The taker submitted T2 before closing and has T1 in progress.
create function pg_temp.sees_closed(p_user uuid, p_label text)
returns setof text
language plpgsql
set search_path = extensions
as $$
declare
  nf constant text := '{"code":"P0002","message":"not_found","details":null,"hint":null}';
  j jsonb;
begin
  perform tests.authenticate_as(p_user);
  -- 5.1: the submitted test stays, marked closed, with the result
  return next results_eq(
    $q$ select id, status, score, closes_at <= clock_timestamp() from public.mock_tests_for_me() $q$,
    $q$ values ('00000000-0000-0000-0000-00000000f002'::uuid, 'submitted'::text, 1, true) $q$,
    p_label || ': only the submitted test is listed, with its score and closes_at (marked closed)');
  j := public.mock_test_open('00000000-0000-0000-0000-00000000f002');
  return next is(j->>'status', 'submitted', p_label || ': the submitted result still opens');
  return next is((j->>'score')::int, 1, p_label || ': with the score');
  return next is((j->'questions'->0->>'correct_option')::int, 0, p_label || ': and the correct answers');
  return next ok((j->>'closes_at')::timestamptz <= clock_timestamp(), p_label || ': and the closing time, in the past');
  return next throws_ok($q$ select public.mock_start('00000000-0000-0000-0000-00000000f002') $q$,
    'PGRST', nf, p_label || ': a submitter can''t start a closed test again');
  return next throws_ok($q$ select public.mock_submit('00000000-0000-0000-0000-00000000f002') $q$,
    'PGRST', nf, p_label || ': submit on a closed test is refused, even for a submitter');
  -- 5.2 and 5.3: the in-progress test is gone and can't be finished
  return next throws_ok($q$ select public.mock_test_open('00000000-0000-0000-0000-00000000f001') $q$,
    'PGRST', nf, p_label || ': a closed in-progress test does not open');
  return next throws_ok($q$ select public.mock_start('00000000-0000-0000-0000-00000000f001') $q$,
    'PGRST', nf, p_label || ': a closed test can''t be started');
  return next throws_ok(
    $q$ select public.mock_save_answer('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000a0001', 1) $q$,
    'PGRST', nf, p_label || ': an in-progress attempt can''t save');
  return next throws_ok($q$ select public.mock_submit('00000000-0000-0000-0000-00000000f001') $q$,
    'PGRST', nf, p_label || ': an in-progress attempt can''t submit');
end;
$$;

-- Closed, for a taker who never started either test (AC 5.2): nothing at all.
create function pg_temp.sees_nothing(p_user uuid, p_label text)
returns setof text
language plpgsql
set search_path = extensions
as $$
declare
  nf constant text := '{"code":"P0002","message":"not_found","details":null,"hint":null}';
begin
  perform tests.authenticate_as(p_user);
  return next is((select count(*)::int from public.mock_tests_for_me()), 0,
    p_label || ': no closed test is in the list');
  return next throws_ok($q$ select public.mock_test_open('00000000-0000-0000-0000-00000000f001') $q$,
    'PGRST', nf, p_label || ': T1 does not open');
  return next throws_ok($q$ select public.mock_test_open('00000000-0000-0000-0000-00000000f002') $q$,
    'PGRST', nf, p_label || ': T2 does not open');
  return next throws_ok($q$ select public.mock_start('00000000-0000-0000-0000-00000000f002') $q$,
    'PGRST', nf, p_label || ': and can''t be started');
end;
$$;

select * from pg_temp.sees_open('00000000-0000-0000-0000-0000000000e1', 'Student, open');
reset role;
select * from pg_temp.sees_open('00000000-0000-0000-0000-0000000000c1', 'Parent, open');
reset role;
select * from pg_temp.sees_open('00000000-0000-0000-0000-0000000000f1', 'User, open');
reset role;

-- A future closing time leaves the test open
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok($$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f001', now() + interval '1 minute') $$,
  'T1 closes in a minute');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.mock_tests_for_me() where id = '00000000-0000-0000-0000-00000000f001'), 1,
  'A test that closes in the future is still listed');
reset role;

-- Close now, with submitted attempts on T2 (AC 3: unlike take-back)
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok($$ select public.mock_close_now('00000000-0000-0000-0000-00000000f001') $$, 'Close now on an open test works');
select lives_ok($$ select public.mock_close_now('00000000-0000-0000-0000-00000000f002') $$,
  'Close now works on a test with submitted attempts');
select results_eq(
  $$ select closes_at between now() and clock_timestamp() from public.mock_tests where id in ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f002') $$,
  $$ values (true), (true) $$,
  'Close now sets closes_at to the current time (clock_timestamp)');
select is((select status from public.mock_tests where id = '00000000-0000-0000-0000-00000000f002'), 'released',
  'and the test stays released');
reset role;
select is((select count(*)::int from public.mock_test_attempts), 6, 'Closing deletes no attempt');

-- A closes_at that has just passed counts as closed
select * from pg_temp.sees_closed('00000000-0000-0000-0000-0000000000e1', 'Student, closed');
reset role;
select * from pg_temp.sees_closed('00000000-0000-0000-0000-0000000000c1', 'Parent, closed');
reset role;
select * from pg_temp.sees_closed('00000000-0000-0000-0000-0000000000f1', 'User, closed');
reset role;
select * from pg_temp.sees_nothing('00000000-0000-0000-0000-0000000000e2', 'Student who never started, closed');
reset role;
select is((select count(*)::int from public.mock_test_attempts where submitted_at is not null), 3,
  'No in-progress attempt got submitted after closing');
select is((select count(*)::int from public.mock_test_answers where selected_option = 1), 0,
  'and no answer was saved after closing');

-- A closing time already in the past (not only exactly now) also hides it
update public.mock_tests set closes_at = now() - interval '1 hour' where id = '00000000-0000-0000-0000-00000000f001';
select * from pg_temp.sees_closed('00000000-0000-0000-0000-0000000000e1', 'Student, closed an hour ago');
reset role;

-- Admins still see a closed test, and a second Close now keeps the first closing time
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select results_eq(
  $$ select id, status, closes_at < now() from public.mock_tests_admin_list() where id = '00000000-0000-0000-0000-00000000f001' $$,
  $$ values ('00000000-0000-0000-0000-00000000f001'::uuid, 'released'::text, true) $$,
  'The admin list still shows a closed test, with its closing time (AC 6)');
select lives_ok($$ select public.mock_close_now('00000000-0000-0000-0000-00000000f001') $$,
  'Close now on a closed test changes nothing and is not an error');
select ok((select closes_at = now() - interval '1 hour' from public.mock_tests where id = '00000000-0000-0000-0000-00000000f001'),
  'and the earlier closing time is kept');
select throws_ok(
  $$ update public.mock_test_questions set prompt = 'Changed' where id = '00000000-0000-0000-0000-0000000a0001' $$,
  'P0001', 'mock_released', 'A closed test''s questions stay frozen');
select throws_ok(
  $$ update public.mock_tests set title = 'Changed' where id = '00000000-0000-0000-0000-00000000f001' $$,
  'P0001', 'mock_released', 'A closed test''s title stays frozen');

-- ---------------------------------------------------------------------------
-- Reopen (AC 4): clear the date, or set a future one
-- ---------------------------------------------------------------------------

select lives_ok($$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f001', null) $$,
  'Clearing the date reopens a closed test');
select lives_ok($$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f002', now() + interval '1 day') $$,
  'A future date reopens a closed test');
select throws_ok($$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f002', now() - interval '1 day') $$,
  'P0001', 'mock_closes_in_past', 'A past date is refused on a closed test too');
reset role;

select * from pg_temp.sees_open('00000000-0000-0000-0000-0000000000e1', 'Student, reopened');
reset role;
select * from pg_temp.sees_open('00000000-0000-0000-0000-0000000000c1', 'Parent, reopened');
reset role;
select * from pg_temp.sees_open('00000000-0000-0000-0000-0000000000f1', 'User, reopened');
reset role;

-- ---------------------------------------------------------------------------
-- Take back (AC 7): same rule as before, and it clears closes_at
-- ---------------------------------------------------------------------------

-- T1: no submitted attempt, closed. T2: submitted attempts.
update public.mock_tests set closes_at = now() where id = '00000000-0000-0000-0000-00000000f001';
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok($$ select public.mock_withdraw('00000000-0000-0000-0000-00000000f002') $$,
  'P0001', 'mock_has_attempts', 'Take-back still refuses a test with submitted attempts');
select ok((select closes_at = now() + interval '1 day' from public.mock_tests where id = '00000000-0000-0000-0000-00000000f002'),
  'and its closing time is kept');
select lives_ok($$ select public.mock_withdraw('00000000-0000-0000-0000-00000000f001') $$,
  'A closed test with no submitted attempt can be taken back');
select results_eq(
  $$ select status, closes_at from public.mock_tests where id = '00000000-0000-0000-0000-00000000f001' $$,
  $$ values ('draft'::text, null::timestamptz) $$,
  'Take-back clears closes_at');
select lives_ok($$ select public.mock_release('00000000-0000-0000-0000-00000000f001') $$,
  'Released again with no date');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select is((select status from public.mock_tests_for_me() where id = '00000000-0000-0000-0000-00000000f001'), 'not_started',
  'and takers see it again, open, with a fresh start (the in-progress attempts went with the take-back)');
reset role;

select * from finish();
rollback;
