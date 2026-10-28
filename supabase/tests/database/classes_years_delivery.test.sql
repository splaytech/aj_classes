-- Hybrid delivery and several year levels per class
-- (docs/delivery/2026-10-28-hybrid-class-multi-year, 01 AC 8, 15, 17; 03 §3; ADR-0009).

begin;
select no_plan();
select tests.remove_all_accounts();
select tests.remove_all_classes();

-- People: a1 admin (two-step), b1 tutor.
select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor1@test.local');

-- One class for tutor b1, inserted as superuser.
insert into public.classes (id, name, subject, tutor_id, year_levels) values
  ('00000000-0000-0000-0000-00000000c001', 'Class one', 'maths',
   '00000000-0000-0000-0000-0000000000b1', '{8}');

-- ---------------------------------------------------------------------------
-- Shape, grants and the guard function
-- ---------------------------------------------------------------------------

select col_type_is('public', 'classes', 'year_levels', 'smallint[]', 'year_levels is a smallint array');
select col_not_null('public', 'classes', 'year_levels', 'year_levels is not null');
select col_default_is('public', 'classes', 'year_levels', '{}'::smallint[], 'year_levels defaults to empty (Any year)');

select is(
  (select is_generated from information_schema.columns
   where table_schema = 'public' and table_name = 'classes' and column_name = 'year_level'),
  'ALWAYS',
  'year_level is a generated column');

select ok(has_column_privilege('authenticated', 'public.classes', 'year_levels', 'INSERT'),
  'Signed-in users may insert year_levels (RLS still limits rows to admins)');
select ok(has_column_privilege('authenticated', 'public.classes', 'year_levels', 'UPDATE'),
  'Signed-in users may update year_levels (RLS still limits rows to admins)');
select ok(not has_column_privilege('authenticated', 'public.classes', 'year_level', 'INSERT'),
  'Nobody is granted insert on the compat year_level');
select ok(not has_column_privilege('authenticated', 'public.classes', 'year_level', 'UPDATE'),
  'Nobody is granted update on the compat year_level');

select ok(not has_function_privilege('authenticated', 'private.check_class_year_levels()', 'execute'),
  'Signed-in users cannot call the year levels guard directly');

-- ---------------------------------------------------------------------------
-- Admin: delivery (AC 8)
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');

select lives_ok(
  $$ insert into public.classes (name, subject, delivery) values ('Hybrid class', 'maths', 'hybrid') $$,
  'An admin can create a hybrid class');
select throws_ok(
  $$ insert into public.classes (name, subject, delivery) values ('Blended class', 'maths', 'blended') $$,
  '23514', null, 'Any other delivery value is rejected');
select results_eq(
  $$ insert into public.classes (name, subject) values ('Default class', 'maths') returning delivery $$,
  $$ values ('in_person') $$,
  'Delivery still defaults to in person');

-- ---------------------------------------------------------------------------
-- Admin: year levels range, repeats, order and shape (AC 15)
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.classes (name, subject, year_levels) values ('Too young', 'maths', '{1}') $$,
  '23514', null, 'A year below 2 is rejected');
select throws_ok(
  $$ insert into public.classes (name, subject, year_levels) values ('Too old', 'maths', '{13}') $$,
  '23514', null, 'A year above 12 is rejected');
select throws_ok(
  $$ insert into public.classes (name, subject, year_levels) values ('Repeat', 'maths', '{7,7}') $$,
  '23514', null, 'A repeated year is rejected');
select throws_ok(
  $$ insert into public.classes (name, subject, year_levels) values ('Backwards', 'maths', '{9,7}') $$,
  '23514', null, 'Years out of ascending order are rejected');
select throws_ok(
  $$ insert into public.classes (name, subject, year_levels) values ('Null year', 'maths', '{7,null}') $$,
  '23514', null, 'A null year is rejected');
select throws_ok(
  $$ insert into public.classes (name, subject, year_levels) values ('Grid', 'maths', '{{7,8}}') $$,
  '23514', null, 'A two-dimensional array is rejected');
select throws_ok(
  $$ insert into public.classes (name, subject, year_levels) values ('Offset', 'maths', '[0:0]={7}') $$,
  '23514', null, 'An array that does not start at index 1 is rejected');

-- ---------------------------------------------------------------------------
-- Admin: the compat year_level follows year_levels
-- ---------------------------------------------------------------------------

select results_eq(
  $$ insert into public.classes (name, subject, year_levels) values ('Any', 'maths', '{}') returning year_level $$,
  $$ values (null::smallint) $$,
  'No years gives a null year_level');
select results_eq(
  $$ insert into public.classes (name, subject, year_levels) values ('One', 'maths', '{8}') returning year_level $$,
  $$ values (8::smallint) $$,
  'One year gives that year_level');
select results_eq(
  $$ insert into public.classes (name, subject, year_levels) values ('Run', 'maths', '{7,8,9}') returning year_level $$,
  $$ values (null::smallint) $$,
  'Several years give a null year_level');

select results_eq(
  $$ update public.classes set year_levels = '{7,9,11}'
     where id = '00000000-0000-0000-0000-00000000c001' returning year_level $$,
  $$ values (null::smallint) $$,
  'Changing one year to several clears year_level');
select results_eq(
  $$ update public.classes set year_levels = '{11}'
     where id = '00000000-0000-0000-0000-00000000c001' returning year_level $$,
  $$ values (11::smallint) $$,
  'Changing back to one year sets year_level again');

-- ---------------------------------------------------------------------------
-- Admin: nobody can write year_level (rejected at rewrite, before grants)
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.classes set year_level = 8 where id = '00000000-0000-0000-0000-00000000c001' $$,
  '428C9', null, 'An admin cannot update the generated year_level');
select throws_ok(
  $$ insert into public.classes (name, subject, year_level) values ('Old tab', 'maths', 8) $$,
  '428C9', null, 'An admin cannot insert a year_level (a stale web tab gets an error, nothing is saved)');

reset role;

-- ---------------------------------------------------------------------------
-- Tutor: cannot change years or delivery (AC 17)
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');

select is_empty(
  $$ update public.classes set year_levels = '{7}'
     where id = '00000000-0000-0000-0000-00000000c001' returning id $$,
  'A tutor cannot change their class''s years');
select is_empty(
  $$ update public.classes set delivery = 'hybrid'
     where id = '00000000-0000-0000-0000-00000000c001' returning id $$,
  'A tutor cannot change their class''s delivery');

reset role;

select * from finish();
rollback;
