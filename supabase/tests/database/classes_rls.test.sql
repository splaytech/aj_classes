-- Classes, timetable, students, enrolments, assignments and marks (R3a design §3–§4, review H1–H7).

begin;
select no_plan();
select tests.remove_all_accounts();
select tests.remove_all_classes();

-- People
select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor1@test.local');
select tests.create_staff('00000000-0000-0000-0000-0000000000b2', 'tutor2@test.local');
select tests.create_staff('00000000-0000-0000-0000-0000000000c1', 'gone@test.local', p_active => false);

-- Classes: c1 (tutor 1), c2 (tutor 2), c3 (tutor 1, archived), c4 (deactivated tutor)
insert into public.classes (id, name, subject, tutor_id, is_active) values
  ('00000000-0000-0000-0000-00000000c001', 'Class one', 'maths', '00000000-0000-0000-0000-0000000000b1', true),
  ('00000000-0000-0000-0000-00000000c002', 'Class two', 'english', '00000000-0000-0000-0000-0000000000b2', true),
  ('00000000-0000-0000-0000-00000000c003', 'Old class', 'maths', '00000000-0000-0000-0000-0000000000b1', false),
  ('00000000-0000-0000-0000-00000000c004', 'Class four', 'maths', '00000000-0000-0000-0000-0000000000c1', true);

insert into public.class_sessions (class_id, day_of_week, start_time, end_time) values
  ('00000000-0000-0000-0000-00000000c001', 2, '16:00', '17:00'),
  ('00000000-0000-0000-0000-00000000c002', 3, '17:00', '18:00');

insert into public.students (id, full_name, year_level) values
  ('00000000-0000-0000-0000-00000000d001', 'Student One', 8),
  ('00000000-0000-0000-0000-00000000d002', 'Student Two', 5),
  ('00000000-0000-0000-0000-00000000d003', 'Student Three', 8);

insert into public.enrolments (class_id, student_id) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d002'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000d003');

-- Published: results can only be recorded on published assignments (R3b).
insert into public.assignments (id, class_id, title, max_mark, status) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 'Homework one', 20, 'published'),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000c002', 'Homework two', 20, 'published'),
  ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000c001', 'Feedback only', null, 'published');


-- Tutor 1 ----------------------------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');

select results_eq($$ select name from public.classes $$, $$ values ('Class one') $$,
  'A tutor sees only their own active classes (not other tutors'', not archived)');
select results_eq($$ select day_of_week::int from public.class_sessions $$, $$ values (2) $$,
  'A tutor sees only their own classes'' timetable slots');
select results_eq($$ select full_name from public.students $$, $$ values ('Student One') $$,
  'A tutor sees only students in their active classes');
select results_eq($$ select count(*)::int from public.enrolments $$, $$ values (1) $$,
  'A tutor sees only their own classes'' enrolments');
select results_eq($$ select title from public.assignments order by title $$,
  $$ values ('Feedback only'), ('Homework one') $$,
  'A tutor sees only their own classes'' assignments');

select throws_ok(
  $$ insert into public.classes (name, subject) values ('Sneaky class', 'maths') $$,
  '42501', null, 'A tutor cannot create classes');
select is_empty(
  $$ update public.classes set name = 'Renamed' where id = '00000000-0000-0000-0000-00000000c001' returning id $$,
  'A tutor cannot edit their class');
select throws_ok(
  $$ insert into public.class_sessions (class_id, day_of_week, start_time, end_time)
     values ('00000000-0000-0000-0000-00000000c001', 5, '09:00', '10:00') $$,
  '42501', null, 'A tutor cannot change the timetable');
select throws_ok(
  $$ insert into public.enrolments (class_id, student_id)
     values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d002') $$,
  '42501', null, 'A tutor cannot enrol students');
select throws_ok(
  $$ insert into public.students (full_name) values ('New Student') $$,
  '42501', null, 'A tutor cannot add students');

select lives_ok(
  $$ insert into public.assignments (class_id, title, max_mark)
     values ('00000000-0000-0000-0000-00000000c001', 'Tutor homework', 10) $$,
  'A tutor can set homework for their class');
select results_eq(
  $$ select created_by from public.assignments where title = 'Tutor homework' $$,
  $$ values ('00000000-0000-0000-0000-0000000000b1'::uuid) $$,
  'created_by is filled in from the session');
select throws_ok(
  $$ insert into public.assignments (class_id, title) values ('00000000-0000-0000-0000-00000000c002', 'Not mine') $$,
  '42501', null, 'A tutor cannot set homework for someone else''s class');
select throws_ok(
  $$ update public.assignments set class_id = '00000000-0000-0000-0000-00000000c002'
     where id = '00000000-0000-0000-0000-00000000e001' $$,
  '42501', null, 'A tutor cannot move homework into someone else''s class');
select throws_ok(
  $$ update public.assignments set created_by = '00000000-0000-0000-0000-0000000000b2'
     where id = '00000000-0000-0000-0000-00000000e001' $$,
  '42501', null, 'Nobody can rewrite created_by');

select lives_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status, mark, feedback)
     values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d001', 'marked', 15, 'Good') $$,
  'A tutor can mark a student in their class');
select results_eq(
  $$ select marked_by, marked_at is not null from public.assignment_results
     where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  $$ values ('00000000-0000-0000-0000-0000000000b1'::uuid, true) $$,
  'marked_by and marked_at are filled in from the session');
select lives_ok(
  $$ update public.assignment_results set status = 'submitted', mark = null
     where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  'A tutor can move a result back to submitted');
select results_eq(
  $$ select marked_by is null and marked_at is null from public.assignment_results
     where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  $$ values (true) $$,
  'Moving away from marked clears marked_by and marked_at');
select throws_ok(
  $$ update public.assignment_results set marked_by = '00000000-0000-0000-0000-0000000000b2'
     where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  '42501', null, 'Nobody can write marked_by directly');
select throws_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status)
     values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d002', 'submitted') $$,
  'P0001', 'not_enrolled', 'A student who is not in the class cannot be marked');
select throws_ok(
  $$ update public.assignment_results set status = 'marked', mark = 25
     where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  'P0001', 'mark_too_high', 'A mark above the maximum is refused');
select throws_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status, mark)
     values ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000d001', 'marked', 5) $$,
  'P0001', 'no_marks', 'A feedback-only assignment takes no marks');
select throws_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status)
     values ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000d002', 'submitted') $$,
  '42501', null, 'A tutor cannot record marks for someone else''s class');
select lives_ok(
  $$ delete from public.assignments where id = '00000000-0000-0000-0000-00000000e001' $$,
  'A tutor can delete their own homework');
reset role;

select is_empty(
  $$ select 1 from public.assignment_results where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  'Deleting homework deletes its marks');


-- Deactivated tutor ---------------------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select is_empty($$ select id from public.classes $$, 'A deactivated tutor sees no classes, even their own');
select is_empty($$ select id from public.assignments $$, 'A deactivated tutor sees no assignments');
reset role;


-- Admin without two-step ------------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal1');
select is_empty($$ select id from public.classes $$, 'An admin without two-step sees no classes');
select throws_ok(
  $$ insert into public.classes (name, subject) values ('Admin class', 'maths') $$,
  '42501', null, 'An admin without two-step cannot create classes');
reset role;


-- Admin with two-step ---------------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select is((select count(*)::int from public.classes), 4, 'An admin sees every class, archived included');
select throws_ok(
  $$ insert into public.classes (id, name, subject) values (gen_random_uuid(), 'Chosen id', 'maths') $$,
  '42501', null, 'Nobody chooses ids: the database creates them (column grants)');
select is((select count(*)::int from public.students), 3, 'An admin sees every student');
select lives_ok(
  $$ insert into public.classes (name, subject, tutor_id)
     values ('New class', 'english', '00000000-0000-0000-0000-0000000000b2') $$,
  'An admin can create a class and assign a tutor');
select lives_ok(
  $$ insert into public.class_sessions (class_id, day_of_week, start_time, end_time)
     values ((select id from public.classes where name = 'New class'), 1, '15:30', '16:30') $$,
  'An admin can add a timetable slot');
select throws_ok(
  $$ insert into public.class_sessions (class_id, day_of_week, start_time, end_time)
     values ((select id from public.classes where name = 'New class'), 1, '16:30', '15:30') $$,
  '23514', null, 'A slot must end after it starts');
select lives_ok(
  $$ insert into public.students (full_name, year_level) values ('Student Four', 6) $$,
  'An admin can add a student');
select lives_ok(
  $$ insert into public.enrolments (class_id, student_id) values ((select id from public.classes where name = 'New class'), (select id from public.students where full_name = 'Student Four')) $$,
  'An admin can enrol a student');
select lives_ok(
  $$ update public.classes set is_active = false where id = '00000000-0000-0000-0000-00000000c002' $$,
  'An admin can archive a class');
select lives_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status, mark)
     values ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000d002', 'marked', 18) $$,
  'An admin can mark in any class (AS7)');
select throws_ok(
  $$ update public.classes set ends_on = '2000-01-01', starts_on = '2001-01-01'
     where name = 'New class' $$,
  '23514', null, 'Term end cannot be before term start');
reset role;

-- Tutor 2 after their class was archived
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b2');
select results_eq($$ select name from public.classes $$, $$ values ('New class') $$,
  'Archiving a class hides it from its tutor; a newly assigned class appears');
reset role;


-- Signed-out visitor ------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok($$ select id from public.classes $$, '42501', null, 'Visitors cannot read classes');
select throws_ok($$ select id from public.students $$, '42501', null, 'Visitors cannot read students');
reset role;

select * from finish();
rollback;
