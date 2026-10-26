-- Item 7 (01b AC-7.1–7.14, ADR-0007, 03b §7.7): the "hold results" switch, and returned work
-- that stays readable, read-only, after a student leaves a class or the class is archived.
-- Every outbox count filters kind = 'work_returned', so item 8's other kinds can't change it.

begin;
select no_plan();
select tests.remove_all_accounts();
select tests.remove_all_classes();
delete from public.email_outbox; -- the seed's returned work queues rows on db reset

-- Staff: admin a1 (two-step), tutor b1 (class one), tutor b2 (class two)
select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor1@test.local');
select tests.create_staff('00000000-0000-0000-0000-0000000000b2', 'tutor2@test.local');

-- Families: s1 (Kid One, parents p1 and p2) and s2 (Kid Two, parent p3)
select tests.create_family_account('00000000-0000-0000-0000-0000000005a1', 'kid1@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000005a2', 'kid2@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000006a1', 'parent1@test.local', 'parent');
select tests.create_family_account('00000000-0000-0000-0000-0000000006a2', 'parent2@test.local', 'parent');
select tests.create_family_account('00000000-0000-0000-0000-0000000006a3', 'parent3@test.local', 'parent');

insert into public.classes (id, name, subject, tutor_id, is_active) values
  ('00000000-0000-0000-0000-00000000c001', 'Class one', 'maths', '00000000-0000-0000-0000-0000000000b1', true),
  ('00000000-0000-0000-0000-00000000c002', 'Class two', 'english', '00000000-0000-0000-0000-0000000000b2', true);

insert into public.class_sessions (class_id, day_of_week, start_time, end_time) values
  ('00000000-0000-0000-0000-00000000c001', 2, '16:00', '17:00'),
  ('00000000-0000-0000-0000-00000000c002', 3, '17:00', '18:00');

insert into public.students (id, full_name, year_level, profile_id, consent_recorded_at, consent_source) values
  ('00000000-0000-0000-0000-00000000d001', 'Kid One', 8, '00000000-0000-0000-0000-0000000005a1', now(), 'admin'),
  ('00000000-0000-0000-0000-00000000d002', 'Kid Two', 6, '00000000-0000-0000-0000-0000000005a2', now(), 'admin');

insert into public.enrolments (class_id, student_id) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d002');

insert into public.student_guardians (student_id, parent_id) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000006a2'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000006a3');

-- Class one's work, built as drafts (questions can only be added then), published further down:
--   h1 held quiz, h2 quiz without hold, w1 written, x1 paper, n1 not started, i1 in progress,
--   u1 submitted but not returned, r1 returned, dr1 stays a draft.
insert into public.assignments (id, class_id, title, due_on) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 'Held quiz', current_date + 7),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000c001', 'Open quiz', current_date + 7),
  ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000c001', 'Written work', null),
  ('00000000-0000-0000-0000-00000000e005', '00000000-0000-0000-0000-00000000c001', 'Not started', null),
  ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000c001', 'In progress', null),
  ('00000000-0000-0000-0000-00000000e007', '00000000-0000-0000-0000-00000000c001', 'Waiting', null),
  ('00000000-0000-0000-0000-00000000e008', '00000000-0000-0000-0000-00000000c001', 'Returned quiz', null),
  ('00000000-0000-0000-0000-00000000e009', '00000000-0000-0000-0000-00000000c001', 'Draft quiz', null);
insert into public.assignments (id, class_id, title, max_mark) values
  ('00000000-0000-0000-0000-00000000e004', '00000000-0000-0000-0000-00000000c001', 'Paper work', 10);

insert into public.assignment_questions (id, assignment_id, kind, prompt, options, correct_option, marks, explanation) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000e001', 'multiple_choice', 'Pick B', '{A,B,C}', 1, 2, 'B is right'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000e001', 'multiple_choice', 'Pick A', '{A,B}', 0, 1, 'A is right'),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000e002', 'multiple_choice', 'Pick A', '{A,B}', 0, 1, ''),
  ('00000000-0000-0000-0000-00000000f004', '00000000-0000-0000-0000-00000000e002', 'multiple_choice', 'Pick B', '{A,B}', 1, 1, ''),
  ('00000000-0000-0000-0000-00000000f005', '00000000-0000-0000-0000-00000000e003', 'written', 'Explain', '{}', null, 3, ''),
  ('00000000-0000-0000-0000-00000000f006', '00000000-0000-0000-0000-00000000e005', 'multiple_choice', 'Pick A', '{A,B}', 0, 1, ''),
  ('00000000-0000-0000-0000-00000000f007', '00000000-0000-0000-0000-00000000e006', 'multiple_choice', 'Pick A', '{A,B}', 0, 1, ''),
  ('00000000-0000-0000-0000-00000000f008', '00000000-0000-0000-0000-00000000e007', 'written', 'Explain', '{}', null, 2, ''),
  ('00000000-0000-0000-0000-00000000f009', '00000000-0000-0000-0000-00000000e008', 'multiple_choice', 'Pick A', '{A,B}', 0, 1, 'A is right'),
  ('00000000-0000-0000-0000-00000000f010', '00000000-0000-0000-0000-00000000e009', 'multiple_choice', 'Pick A', '{A,B}', 0, 1, '');


-- AC-7.1 The switch, on drafts ------------------------------------------------------
select is(
  (select bool_or(hold_results) from public.assignments), false,
  'Hold results is off by default, so today''s behaviour is kept');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select results_eq(
  $$ update public.assignments set hold_results = true
     where id = '00000000-0000-0000-0000-00000000e001' returning hold_results $$,
  $$ values (true) $$,
  'The class tutor can hold results on a draft with questions');
select results_eq(
  $$ update public.assignments set hold_results = true
     where id = '00000000-0000-0000-0000-00000000e005' returning hold_results $$,
  $$ values (true) $$,
  'The class tutor can hold results on another draft');
select lives_ok(
  $$ update public.assignments set hold_results = true where id = '00000000-0000-0000-0000-00000000e003' $$,
  'Hold results is allowed on work with a written question (it is offered for any questions)');
select lives_ok(
  $$ update public.assignments set hold_results = false where id = '00000000-0000-0000-0000-00000000e003' $$,
  'and can be turned off again on a draft');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b2');
select is_empty(
  $$ update public.assignments set hold_results = true
     where id = '00000000-0000-0000-0000-00000000e002' returning id $$,
  'Another class''s tutor cannot set it (AC-7.6)');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select results_eq(
  $$ update public.assignments set hold_results = true
     where id = '00000000-0000-0000-0000-00000000e009' returning hold_results $$,
  $$ values (true) $$,
  'An admin can set it');
reset role;


-- AC-7.2 Not offered without questions ----------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ update public.assignments set hold_results = true where id = '00000000-0000-0000-0000-00000000e004' $$,
  'P0001', 'hold_needs_questions', 'Paper homework cannot hold results');
select throws_ok(
  $$ insert into public.assignments (class_id, title, hold_results)
     values ('00000000-0000-0000-0000-00000000c001', 'New quiz', true) $$,
  'P0001', 'hold_needs_questions', 'A new assignment cannot start held (it has no questions yet)');
reset role;


-- Publish everything but the draft --------------------------------------------------
update public.assignments set status = 'published'
where id <> '00000000-0000-0000-0000-00000000e009';


-- AC-7.1 Locked once published; back to draft unlocks it ----------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ update public.assignments set hold_results = false where id = '00000000-0000-0000-0000-00000000e001' $$,
  'P0001', 'assignment_published', 'Hold results is locked once published');
select lives_ok(
  $$ update public.assignments set title = 'Not started yet' where id = '00000000-0000-0000-0000-00000000e005' $$,
  'Editing a published assignment''s other fields still works');
select lives_ok(
  $$ update public.assignments set status = 'draft' where id = '00000000-0000-0000-0000-00000000e005' $$,
  'Work nobody has started can go back to draft');
select lives_ok(
  $$ update public.assignments set hold_results = false where id = '00000000-0000-0000-0000-00000000e005' $$,
  'and back on a draft the switch can change again');
select lives_ok(
  $$ update public.assignments set status = 'published', title = 'Not started'
     where id = '00000000-0000-0000-0000-00000000e005' $$,
  'and it can be published again');
reset role;
select is(
  (select hold_results from public.assignments where id = '00000000-0000-0000-0000-00000000e005'), false,
  'The change made on the draft stuck');


select * from finish();
rollback;
