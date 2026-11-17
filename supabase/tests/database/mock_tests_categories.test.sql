-- Mock tests: categories (docs/delivery/2026-11-18-mock-test-closing ACs 10 to 29, 03-design.md §1
-- and §7, migration 20261120100000_mock_test_categories.sql). Allowed values, the year rules,
-- release needing all three tags, tags on released and closed tests, removed values, and that
-- nothing else moves. Every tag write runs as the real caller: tests.authenticate_as(…, 'aal2')
-- sets the local role to authenticated, so the column grants and RLS apply (never superuser,
-- except the fixtures and the direct status writes that say so).

begin;
select no_plan();
select tests.remove_all_accounts();
select tests.remove_all_classes();
delete from public.mock_tests;

select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor@test.local');
select tests.create_family_account('00000000-0000-0000-0000-0000000000c1', 'parent@test.local', 'parent');

-- 'message:hint' of the error a statement raises, or 'ok'. Runs as the caller (invoker).
create function pg_temp.refusal(p_sql text)
returns text
language plpgsql
as $$
declare
  m text;
  h text;
begin
  execute p_sql;
  return 'ok';
exception when others then
  get stacked diagnostics m = message_text, h = pg_exception_hint;
  return m || ':' || coalesce(h, '');
end;
$$;

-- The four tag columns of a test, as one text, read as postgres.
create function pg_temp.tags_of(p_id uuid)
returns text
language sql
as $$
  select concat_ws('|', coalesce(subject, '-'), coalesce(stream, '-'), year_levels::text, any_year::text)
  from public.mock_tests where id = p_id
$$;

-- ---------------------------------------------------------------------------
-- The options and the objects (AC 10, 11, 16)
-- ---------------------------------------------------------------------------

select is(
  (select array_agg(key order by key) from private.mock_test_options where kind = 'subject' and active),
  array['english','maths','numerical-reasoning','reading','science','verbal-reasoning','writing'],
  'The seven subjects are offered, and not interview-preparation (AC 10)');
select is(
  (select array_agg(key order by key) from private.mock_test_options where kind = 'stream' and active),
  array['icas','maths-science-english','naplan','seal-and-scholarships','selective-entry','vce'],
  'The six streams are offered (AC 11)');
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'private' and table_name = 'mock_test_options' and grantee in ('anon', 'authenticated', 'PUBLIC')),
  0, 'The options table has no grant');
select ok((select relrowsecurity from pg_class where oid = 'private.mock_test_options'::regclass),
  'The options table has row-level security on');
select is(
  (select array_agg(p.proname::text || ':' || p.prosecdef::text || ':' || array_to_string(p.proconfig, ',') order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname in ('check_mock_test_tags', 'check_mock_test_release_tags')),
  array['check_mock_test_release_tags:true:search_path=""', 'check_mock_test_tags:true:search_path=""'],
  'Both trigger functions are security definer with an empty search_path');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname in ('check_mock_test_tags', 'check_mock_test_release_tags')
     and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))),
  0, 'Neither trigger function is executable by anon or authenticated');
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'mock_tests' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['any_year','instructions','stream','subject','title','year_levels'],
  'authenticated may update only title, instructions and the four tags: no grant on status, released_* or closes_at');

-- ---------------------------------------------------------------------------
-- Insert: tagged and untagged (3.1b, AC 13)
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok(
  $$ insert into public.mock_tests (title, subject, stream, year_levels) values ('Tagged insert', 'maths', 'vce', '{7,8}') $$,
  'An admin can insert a tagged draft');
select lives_ok(
  $$ insert into public.mock_tests (title) values ('Untagged insert') $$,
  'An admin can insert an untagged draft');
select is(pg_temp.refusal($$ insert into public.mock_tests (title, subject) values ('Bad insert', 'chemistry') $$),
  'invalid_mock_tag:subject', 'An insert with an unknown subject is refused');
reset role;
select is((select pg_temp.tags_of(id) from public.mock_tests where title = 'Tagged insert'), 'maths|vce|{7,8}|false',
  'The tagged insert stored its tags');
select is((select pg_temp.tags_of(id) from public.mock_tests where title = 'Untagged insert'), '-|-|{}|false',
  'The untagged insert stored no tags');

-- Fixtures as postgres: D a draft with a question; R released and tagged, with one submitted and
-- one in-progress attempt; L a released test from before this feature, untagged.
insert into public.mock_tests (id, title) values ('00000000-0000-0000-0000-00000000f00d', 'Draft D');
insert into public.mock_test_questions (id, test_id, prompt, options, correct_option) values
  ('00000000-0000-0000-0000-0000000a000d', '00000000-0000-0000-0000-00000000f00d', 'Q?', array['a','b'], 0);
insert into public.mock_tests (id, title, subject, stream, year_levels) values
  ('00000000-0000-0000-0000-00000000f00e', 'Released R', 'maths', 'naplan', '{5}');
insert into public.mock_test_questions (id, test_id, prompt, options, correct_option) values
  ('00000000-0000-0000-0000-0000000a000e', '00000000-0000-0000-0000-00000000f00e', 'Q?', array['a','b'], 0);
update public.mock_tests set status = 'released', released_at = now() where id = '00000000-0000-0000-0000-00000000f00e';
insert into public.mock_tests (id, title, status, released_at) values
  ('00000000-0000-0000-0000-00000000f00f', 'Legacy L', 'released', now() - interval '1 day');
insert into public.mock_test_attempts (id, test_id, profile_id, submitted_at, score, total) values
  ('00000000-0000-0000-0000-0000000b000e', '00000000-0000-0000-0000-00000000f00e', '00000000-0000-0000-0000-0000000000c1', now(), 1, 1);
insert into public.mock_test_answers (attempt_id, question_id, selected_option) values
  ('00000000-0000-0000-0000-0000000b000e', '00000000-0000-0000-0000-0000000a000e', 0);

-- ---------------------------------------------------------------------------
-- Draft writes: every valid value accepted, every bad one refused with its field (AC 13, 16)
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');

create function pg_temp.accepts(p_set text, p_label text)
returns setof text
language plpgsql
set search_path = extensions
as $$
begin
  return next is(
    pg_temp.refusal(format('update public.mock_tests set %s where id = %L', p_set, '00000000-0000-0000-0000-00000000f00d')),
    'ok', p_label);
end;
$$;

select pg_temp.accepts(format('subject = %L', s), 'Subject ' || s || ' is accepted')
from unnest(array['maths','english','science','reading','writing','numerical-reasoning','verbal-reasoning']) s;
select pg_temp.accepts(format('stream = %L', s), 'Stream ' || s || ' is accepted')
from unnest(array['vce','naplan','selective-entry','seal-and-scholarships','icas','maths-science-english']) s;
select * from pg_temp.accepts($$ year_levels = '{2}', any_year = false $$, 'Year 2 alone is accepted');
select * from pg_temp.accepts($$ year_levels = '{2,3,4,5,6,7,8,9,10,11,12}' $$, 'Every year from 2 to 12 is accepted');
select * from pg_temp.accepts($$ year_levels = '{}', any_year = true $$, 'Any year is accepted');
select * from pg_temp.accepts($$ subject = null, stream = null, year_levels = '{}', any_year = false $$,
  'A draft can clear every tag (AC 13)');
reset role;
select is(pg_temp.tags_of('00000000-0000-0000-0000-00000000f00d'), '-|-|{}|false', 'and the draft is untagged again');

-- Set known tags, then try each bad value; the row must not change.
update public.mock_tests set subject = 'english', stream = 'icas', year_levels = '{6}' where id = '00000000-0000-0000-0000-00000000f00d';
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select results_eq(
  $$ select pg_temp.refusal(format('update public.mock_tests set %s where id = %L', s, '00000000-0000-0000-0000-00000000f00d'))
     from unnest(array[
       $s$ subject = 'chemistry' $s$,
       $s$ subject = 'interview-preparation' $s$,
       $s$ stream = 'ucat-and-gamsat' $s$,
       $s$ stream = 'interviews' $s$,
       $s$ year_levels = '{1}' $s$,
       $s$ year_levels = '{13}' $s$,
       $s$ year_levels = '{5,5}' $s$,
       $s$ year_levels = '{8,7}' $s$,
       $s$ any_year = true $s$,
       $s$ year_levels = array[3, null]::smallint[] $s$,
       $s$ year_levels = '[0:0]={7}' $s$,
       $s$ year_levels = '{{7,8}}' $s$
     ]) with ordinality as x(s, n) order by n $$,
  $$ values ('invalid_mock_tag:subject'), ('invalid_mock_tag:subject'), ('invalid_mock_tag:stream'), ('invalid_mock_tag:stream'),
            ('invalid_mock_tag:year_levels'), ('invalid_mock_tag:year_levels'), ('invalid_mock_tag:year_levels'),
            ('invalid_mock_tag:year_levels'), ('invalid_mock_tag:year_levels'), ('invalid_mock_tag:year_levels'),
            ('invalid_mock_tag:year_levels'), ('invalid_mock_tag:year_levels') $$,
  'Unknown subject or stream, year 1 or 13, duplicate or descending years, years with Any year, a NULL element, a non-1-based and a two-dimensional array are each refused with the field (AC 16)');
select throws_ok($$ update public.mock_tests set subject = 'chemistry' where id = '00000000-0000-0000-0000-00000000f00d' $$,
  '23514', 'invalid_mock_tag', 'The refusal is a check_violation (23514)');
reset role;
select is(pg_temp.tags_of('00000000-0000-0000-0000-00000000f00d'), 'english|icas|{6}|false', 'Every refusal left the row unchanged');

-- ---------------------------------------------------------------------------
-- Release needs all three tags (AC 14)
-- ---------------------------------------------------------------------------

update public.mock_tests set subject = null where id = '00000000-0000-0000-0000-00000000f00d';
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok($$ select public.mock_release('00000000-0000-0000-0000-00000000f00d') $$,
  'P0001', 'mock_tags_missing', 'Release without a subject is refused');
reset role;
update public.mock_tests set subject = 'english', stream = null where id = '00000000-0000-0000-0000-00000000f00d';
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok($$ select public.mock_release('00000000-0000-0000-0000-00000000f00d') $$,
  'P0001', 'mock_tags_missing', 'Release without a stream is refused');
reset role;
update public.mock_tests set stream = 'icas', year_levels = '{}', any_year = false where id = '00000000-0000-0000-0000-00000000f00d';
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok($$ select public.mock_release('00000000-0000-0000-0000-00000000f00d') $$,
  'P0001', 'mock_tags_missing', 'Release without a year level is refused');
select throws_ok($$ select public.mock_release('00000000-0000-0000-0000-00000000f00d', now() - interval '1 day') $$,
  'P0001', 'mock_closes_in_past', 'The closing check still comes before the tag check');
reset role;
select is((select status from public.mock_tests where id = '00000000-0000-0000-0000-00000000f00d'), 'draft',
  'Every refused release left a draft');

-- A direct status write (as the table owner: authenticated has no grant on status) is refused too
select throws_ok(
  $$ update public.mock_tests set status = 'released', released_at = now() where id = '00000000-0000-0000-0000-00000000f00d' $$,
  'P0001', 'mock_tags_missing', 'A direct draft-to-released write on an untagged draft is refused by the trigger');

update public.mock_tests set any_year = true where id = '00000000-0000-0000-0000-00000000f00d';
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok($$ select public.mock_release('00000000-0000-0000-0000-00000000f00d') $$,
  'Release with subject, stream and Any year works');
reset role;
select is((select status from public.mock_tests where id = '00000000-0000-0000-0000-00000000f00d'), 'released', 'D is released');

-- Take-back keeps the tags (AC 17); the direct write on a tagged draft is accepted
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok($$ select public.mock_withdraw('00000000-0000-0000-0000-00000000f00d') $$, 'D is taken back');
reset role;
select is(pg_temp.tags_of('00000000-0000-0000-0000-00000000f00d'), 'english|icas|{}|true', 'Take-back keeps the four tags (AC 17)');
select lives_ok(
  $$ update public.mock_tests set status = 'released', released_at = now() where id = '00000000-0000-0000-0000-00000000f00d' $$,
  'A direct draft-to-released write on a tagged draft is accepted');

-- ---------------------------------------------------------------------------
-- Released and closed tests: change yes, clear no, nothing else moves (AC 15)
-- ---------------------------------------------------------------------------

create function pg_temp.released_rules(p_label text)
returns setof text
language plpgsql
set search_path = extensions
as $$
declare
  r constant uuid := '00000000-0000-0000-0000-00000000f00e';
begin
  perform tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
  return next is(pg_temp.refusal(format($q$ update public.mock_tests set subject = 'english' where id = %L $q$, r)), 'ok',
    p_label || ': the subject can change');
  return next is(pg_temp.refusal(format($q$ update public.mock_tests set stream = 'vce' where id = %L $q$, r)), 'ok',
    p_label || ': the stream can change');
  return next is(pg_temp.refusal(format($q$ update public.mock_tests set year_levels = '{}', any_year = true where id = %L $q$, r)), 'ok',
    p_label || ': years can change to Any year');
  return next is(pg_temp.refusal(format($q$ update public.mock_tests set year_levels = '{5,6}', any_year = false where id = %L $q$, r)), 'ok',
    p_label || ': and back to years');
  return next is(pg_temp.refusal(format('update public.mock_tests set subject = null where id = %L', r)), 'mock_tag_kept:subject',
    p_label || ': the subject can''t be cleared');
  return next is(pg_temp.refusal(format('update public.mock_tests set stream = null where id = %L', r)), 'mock_tag_kept:stream',
    p_label || ': the stream can''t be cleared');
  return next is(pg_temp.refusal(format($q$ update public.mock_tests set year_levels = '{}' where id = %L $q$, r)), 'mock_tag_kept:year_levels',
    p_label || ': years can''t be cleared');
  return next is(pg_temp.refusal(format($q$ update public.mock_tests set year_levels = '{}', any_year = true where id = %L $q$, r)), 'ok',
    p_label || ': (set Any year again)');
  return next is(pg_temp.refusal(format('update public.mock_tests set any_year = false where id = %L', r)), 'mock_tag_kept:year_levels',
    p_label || ': Any year can''t be turned off with no year');
  return next is(pg_temp.refusal(format($q$ update public.mock_tests set title = 'Changed' where id = %L $q$, r)), 'mock_released:',
    p_label || ': the title stays frozen');
  return next is(pg_temp.refusal(format($q$ update public.mock_tests set instructions = 'Changed' where id = %L $q$, r)), 'mock_released:',
    p_label || ': the instructions stay frozen');
end;
$$;

-- Read as postgres after released_rules: what must not have moved.
create function pg_temp.released_unchanged(p_label text, p_closes timestamptz)
returns setof text
language plpgsql
set search_path = extensions
as $$
declare
  r constant uuid := '00000000-0000-0000-0000-00000000f00e';
begin
  return next is(pg_temp.tags_of(r), 'english|vce|{}|true', p_label || ': the tags hold the last accepted values');
  return next is((select title from public.mock_tests where id = r), 'Released R', p_label || ': the title is unchanged');
  return next results_eq(
    format('select position, prompt, options, correct_option::int, explanation from public.mock_test_questions where test_id = %L', r),
    $q$ values (1, 'Q?'::text, array['a','b']::text[], 0, ''::text) $q$,
    p_label || ': the question is unchanged by the tag edits');
  return next is((select closes_at from public.mock_tests where id = r), p_closes, p_label || ': closes_at is unchanged');
  return next results_eq(
    $q$ select a.submitted_at is not null, a.score, ans.selected_option::int
        from public.mock_test_attempts a join public.mock_test_answers ans on ans.attempt_id = a.id
        where a.id = '00000000-0000-0000-0000-0000000b000e' $q$,
    $q$ values (true, 1::smallint, 0) $q$,
    p_label || ': the attempt and its answer are untouched');
end;
$$;

select * from pg_temp.released_rules('Released');
reset role;
select * from pg_temp.released_unchanged('Released', null);
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok($$ select public.mock_close_now('00000000-0000-0000-0000-00000000f00e') $$, 'R is closed now');
reset role;
select is(pg_temp.tags_of('00000000-0000-0000-0000-00000000f00e'), 'english|vce|{}|true', 'Close now leaves the tags (AC 17)');
update public.mock_tests set subject = 'maths', stream = 'naplan', year_levels = '{5}', any_year = false
  where id = '00000000-0000-0000-0000-00000000f00e';
-- Close now stamps clock_timestamp(), so keep the value to compare against after the tag edits.
create temp table closed_r as select closes_at from public.mock_tests where id = '00000000-0000-0000-0000-00000000f00e';
select * from pg_temp.released_rules('Closed');
reset role;
select * from pg_temp.released_unchanged('Closed', (select closes_at from pg_temp.closed_r));
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok($$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f00e', null) $$, 'R is reopened');
select lives_ok($$ select public.mock_set_closing('00000000-0000-0000-0000-00000000f00e', now() + interval '1 day') $$, 'and given a closing date');
reset role;
select is(pg_temp.tags_of('00000000-0000-0000-0000-00000000f00e'), 'english|vce|{}|true', 'Reopening and setting a date leave the tags (AC 17)');

-- ---------------------------------------------------------------------------
-- A legacy untagged released test (AC 18): listed, then tagged one field at a time
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select results_eq(
  $$ select subject, stream, year_levels, any_year from public.mock_tests_for_me() where id = '00000000-0000-0000-0000-00000000f00f' $$,
  $$ values (null::text, null::text, '{}'::smallint[], false) $$,
  'The taker list shows the untagged released test, with no tags (AC 18)');
select results_eq(
  $$ select subject, stream, year_levels, any_year from public.mock_tests_for_me() where id = '00000000-0000-0000-0000-00000000f00e' $$,
  $$ values ('english'::text, 'vce'::text, '{}'::smallint[], true) $$,
  'and returns the tags of a tagged one');
select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.mock_test_open('00000000-0000-0000-0000-00000000f00e')->'tags') k),
  array['any_year','stream','subject','year_levels'], 'mock_test_open carries the four tags');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select results_eq(
  $$ select subject, stream, year_levels, any_year from public.mock_tests_admin_list() where id = '00000000-0000-0000-0000-00000000f00f' $$,
  $$ values (null::text, null::text, '{}'::smallint[], false) $$,
  'The admin list shows it too, with no tags');
select is(pg_temp.refusal($$ update public.mock_tests set subject = 'reading' where id = '00000000-0000-0000-0000-00000000f00f' $$), 'ok',
  'A legacy test can get a subject alone');
select is(pg_temp.refusal($$ update public.mock_tests set stream = 'naplan' where id = '00000000-0000-0000-0000-00000000f00f' $$), 'ok',
  'then a stream');
select is(pg_temp.refusal($$ update public.mock_tests set year_levels = '{3,5}' where id = '00000000-0000-0000-0000-00000000f00f' $$), 'ok',
  'then years');
select is(pg_temp.refusal($$ update public.mock_tests set subject = null where id = '00000000-0000-0000-0000-00000000f00f' $$),
  'mock_tag_kept:subject', 'and once set, a tag on it can''t be cleared');
reset role;
select is(pg_temp.tags_of('00000000-0000-0000-0000-00000000f00f'), 'reading|naplan|{3,5}|false', 'L is now fully tagged');

-- ---------------------------------------------------------------------------
-- A value switched off later (AC 27)
-- ---------------------------------------------------------------------------

insert into private.mock_test_options (kind, key, active) values ('subject', 'reading', false)
on conflict (kind, key) do update set active = excluded.active;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select is(pg_temp.refusal($$ update public.mock_tests set stream = 'icas' where id = '00000000-0000-0000-0000-00000000f00f' $$), 'ok',
  'An unrelated tag change on a test holding a removed subject passes');
select is(pg_temp.refusal($$ update public.mock_tests set subject = 'reading' where id = '00000000-0000-0000-0000-00000000f00f' $$), 'ok',
  'Writing the same removed subject again is not a change, so it passes');
select is(pg_temp.refusal($$ update public.mock_tests set subject = 'reading' where id = '00000000-0000-0000-0000-00000000f00d' $$),
  'invalid_mock_tag:subject', 'Setting the removed subject on another test is refused');
reset role;
select is(pg_temp.tags_of('00000000-0000-0000-0000-00000000f00f'), 'reading|icas|{3,5}|false', 'The removed subject stays on its test');
update private.mock_test_options set active = true where kind = 'subject' and key = 'reading';

-- ---------------------------------------------------------------------------
-- AC 25: tags decide where a test is listed, never who sees it
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
create temp table visible_before as select id from public.mock_tests_for_me();
reset role;
grant select on visible_before to authenticated;
select ok((select count(*) from visible_before) >= 3, 'The parent sees the released tests (setup for AC 25)');
-- Change every tag of every released test: other values, years, Any year.
update public.mock_tests
set subject = 'writing', stream = 'selective-entry', year_levels = '{12}', any_year = false
where status = 'released'; -- not 'science': the no-tag-write sweep below counts that one
select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select set_eq($$ select id from public.mock_tests_for_me() $$, $$ select id from visible_before $$,
  'The taker''s visible set is the same whatever the tags (AC 25)');
reset role;

-- ---------------------------------------------------------------------------
-- Nobody else writes tags
-- ---------------------------------------------------------------------------

create function pg_temp.no_tag_write(p_user uuid, p_label text, p_aal text)
returns setof text
language plpgsql
set search_path = extensions
as $$
declare
  n bigint;
begin
  perform tests.authenticate_as(p_user, p_aal);
  update public.mock_tests set subject = 'science';
  get diagnostics n = row_count;
  return next is(n, 0::bigint, p_label || ' updates no test''s tags');
  return next throws_ok($q$ insert into public.mock_tests (title, subject) values ('Nope', 'maths') $q$, '42501', null,
    p_label || ' can''t insert a tagged test');
end;
$$;

select * from pg_temp.no_tag_write('00000000-0000-0000-0000-0000000000b1', 'A tutor', 'aal2');
reset role;
select * from pg_temp.no_tag_write('00000000-0000-0000-0000-0000000000c1', 'A parent', 'aal1');
reset role;
select * from pg_temp.no_tag_write('00000000-0000-0000-0000-0000000000a1', 'An admin without two-step', 'aal1');
reset role;
select tests.authenticate_as_anon();
select throws_ok($$ update public.mock_tests set subject = 'science' $$, '42501', null, 'A visitor can''t write tags');
reset role;
select is((select count(*)::int from public.mock_tests where subject = 'science'), 0, 'No refused caller set a tag');

select * from finish();
rollback;
