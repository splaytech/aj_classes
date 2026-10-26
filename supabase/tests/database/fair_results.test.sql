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

-- Kid One's work in class one: i1 in progress, u1 handed in (written), r1 auto-returned ------
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select public.student_save_answer('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000f007', 0);
select public.student_save_answer('00000000-0000-0000-0000-00000000e007', '00000000-0000-0000-0000-00000000f008', null, 'Because');
select is(public.student_submit('00000000-0000-0000-0000-00000000e007'), 'submitted', 'Written work waits for marking');
select public.student_save_answer('00000000-0000-0000-0000-00000000e008', '00000000-0000-0000-0000-00000000f009', 0);
select is(public.student_submit('00000000-0000-0000-0000-00000000e008'), 'returned', 'An unheld quiz comes straight back');
reset role;


-- AC-7.3 Submit with hold on --------------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select public.student_save_answer('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000f001', 1);
select public.student_save_answer('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000f002', 1);
select is(public.student_submit('00000000-0000-0000-0000-00000000e001'), 'submitted',
  'A held quiz stays Submitted when handed in');
select is(
  public.student_assignment('00000000-0000-0000-0000-00000000e001') ->> 'status', 'submitted',
  'The student sees it as handed in (family status submitted: "Waiting for marking")');
select is(
  (select count(*)::int
   from jsonb_array_elements(public.student_assignment('00000000-0000-0000-0000-00000000e001') -> 'questions') q
   where q ->> 'correctOption' is not null or q ->> 'explanation' <> '' or q ->> 'awardedMarks' is not null),
  0, 'Before return the student sees no correct option, explanation or awarded mark');
select is(
  public.student_assignment('00000000-0000-0000-0000-00000000e001') ->> 'mark', null,
  'Before return the student sees no mark');
select results_eq(
  $$ select status, mark from public.student_assignments()
     where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  $$ values ('submitted'::text, null::numeric) $$,
  'The student''s list shows it as handed in, with no mark');
reset role;

select is(
  (select status from public.assignment_results
   where assignment_id = '00000000-0000-0000-0000-00000000e001' and student_id = '00000000-0000-0000-0000-00000000d001'),
  'submitted', 'The stored result is Submitted');
select results_eq(
  $$ select question_id, awarded_marks from public.assignment_answers
     where assignment_id = '00000000-0000-0000-0000-00000000e001' order by question_id $$,
  $$ values ('00000000-0000-0000-0000-00000000f001'::uuid, 2::numeric),
            ('00000000-0000-0000-0000-00000000f002'::uuid, 0::numeric) $$,
  'The held answers are auto-marked as today');


-- AC-7.6 Parents can't read held marks or answers before return ----------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000006a1');
select is(
  (select count(*)::int
   from jsonb_array_elements(public.parent_child_assignment('00000000-0000-0000-0000-00000000d001',
                                                            '00000000-0000-0000-0000-00000000e001') -> 'questions') q
   where q ->> 'correctOption' is not null or q ->> 'explanation' <> '' or q ->> 'awardedMarks' is not null),
  0, 'Before return a parent sees no correct option, explanation or awarded mark');
select results_eq(
  $$ select status, mark from public.parent_child_assignments('00000000-0000-0000-0000-00000000d001')
     where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  $$ values ('submitted'::text, null::numeric) $$,
  'The parent''s list shows it as handed in, with no mark');
reset role;


-- AC-7.5 Hold off is unchanged ------------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select public.student_save_answer('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000f003', 0);
select is(public.student_submit('00000000-0000-0000-0000-00000000e002'), 'returned',
  'An all-multiple-choice quiz without hold still returns on submit');
reset role;
select is(
  (select marked_by from public.assignment_results
   where assignment_id = '00000000-0000-0000-0000-00000000e002' and student_id = '00000000-0000-0000-0000-00000000d001'),
  null, 'The automatic return records no marker');
select is(
  (select count(*)::int from public.email_outbox
   where kind = 'work_returned' and assignment_id in ('00000000-0000-0000-0000-00000000e002',
                                                       '00000000-0000-0000-0000-00000000e008')),
  0, 'Automatic returns queue no "work returned" email');


-- AC-7.4 Tutor return of held work --------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(
  $$ update public.assignment_results set status = 'returned', feedback = 'Nice work'
     where assignment_id = '00000000-0000-0000-0000-00000000e001'
       and student_id = '00000000-0000-0000-0000-00000000d001' $$,
  'The tutor can return held work straight away (every answer is already marked)');
reset role;
select is(
  (select marked_by from public.assignment_results
   where assignment_id = '00000000-0000-0000-0000-00000000e001' and student_id = '00000000-0000-0000-0000-00000000d001'),
  '00000000-0000-0000-0000-0000000000b1'::uuid, 'It counts as a staff return');
select results_eq(
  $$ select recipient_id from public.email_outbox
     where kind = 'work_returned' and assignment_id = '00000000-0000-0000-0000-00000000e001'
     order by recipient_id $$,
  $$ values ('00000000-0000-0000-0000-0000000005a1'::uuid), ('00000000-0000-0000-0000-0000000006a1'::uuid),
            ('00000000-0000-0000-0000-0000000006a2'::uuid) $$,
  'and queues the "work returned" email for the student and both parents');

select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select results_eq(
  $$ select (q ->> 'correctOption')::int, (q ->> 'awardedMarks')::numeric, q ->> 'explanation'
     from jsonb_array_elements(public.student_assignment('00000000-0000-0000-0000-00000000e001') -> 'questions') q $$,
  $$ values (1, 2::numeric, 'B is right'), (0, 0::numeric, 'A is right') $$,
  'Once returned the student sees correct options, marks and explanations');
select is(
  public.student_assignment('00000000-0000-0000-0000-00000000e001') ->> 'comment', 'Nice work',
  'and the tutor''s comment');
reset role;


select * from finish();
rollback;
