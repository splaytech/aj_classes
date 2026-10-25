-- Student & parent portal (R3b design §3–§4, review F1–F31): family roles, links and consent,
-- online assignments (questions, answers, submit, mark, return) and what families can see.

begin;
select no_plan();
select tests.remove_all_accounts();
select tests.remove_all_classes();

-- Staff
select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor1@test.local');
select tests.create_staff('00000000-0000-0000-0000-0000000000b2', 'tutor2@test.local');

-- Family accounts: students kid1, kid3, kid4 (deactivated), kid5 (not linked yet);
-- parents parent1, parent2, parent3 (deactivated)
select tests.create_family_account('00000000-0000-0000-0000-0000000005a1', 'kid1@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000005a3', 'kid3@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000005a4', 'kid4@test.local', 'student', p_active => false);
select tests.create_family_account('00000000-0000-0000-0000-0000000005a5', 'kid5@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000006a1', 'parent1@test.local', 'parent');
select tests.create_family_account('00000000-0000-0000-0000-0000000006a2', 'parent2@test.local', 'parent');
select tests.create_family_account('00000000-0000-0000-0000-0000000006a3', 'parent3@test.local', 'parent', p_active => false);

-- Classes: c1 (tutor 1), c2 (tutor 2), c3 (tutor 1, archived)
insert into public.classes (id, name, subject, tutor_id, is_active) values
  ('00000000-0000-0000-0000-00000000c001', 'Class one', 'maths', '00000000-0000-0000-0000-0000000000b1', true),
  ('00000000-0000-0000-0000-00000000c002', 'Class two', 'english', '00000000-0000-0000-0000-0000000000b2', true),
  ('00000000-0000-0000-0000-00000000c003', 'Old class', 'maths', '00000000-0000-0000-0000-0000000000b1', false);

insert into public.class_sessions (class_id, day_of_week, start_time, end_time) values
  ('00000000-0000-0000-0000-00000000c001', 2, '16:00', '17:00'),
  ('00000000-0000-0000-0000-00000000c002', 3, '17:00', '18:00'),
  ('00000000-0000-0000-0000-00000000c003', 4, '10:00', '11:00');

-- Roster: Kid One/Three/Four have accounts (and consent); Kid Two, Five and Six don't.
insert into public.students (id, full_name, year_level, profile_id, consent_recorded_at, consent_source) values
  ('00000000-0000-0000-0000-00000000d001', 'Kid One', 8, '00000000-0000-0000-0000-0000000005a1', now(), 'admin'),
  ('00000000-0000-0000-0000-00000000d002', 'Kid Two', 6, null, null, null),
  ('00000000-0000-0000-0000-00000000d003', 'Kid Three', 5, '00000000-0000-0000-0000-0000000005a3', now(), 'admin'),
  ('00000000-0000-0000-0000-00000000d004', 'Kid Four', 8, '00000000-0000-0000-0000-0000000005a4', now(), 'admin'),
  ('00000000-0000-0000-0000-00000000d005', 'Kid Five', 7, null, null, null),
  ('00000000-0000-0000-0000-00000000d006', 'Kid Six', 7, null, null, null);

insert into public.enrolments (class_id, student_id) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000d001'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d002'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d003'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d004');

-- Parent 1: Kid One and Kid Two (siblings). Parent 2: Kid Three. Parent 3 (deactivated): Kid One.
insert into public.student_guardians (student_id, parent_id) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-0000000006a2'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000006a3');

-- Assignments are built as drafts (questions can only be added then), then published.
insert into public.assignments (id, class_id, title, due_on) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 'Online one', current_date + 7),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000c001', 'Draft one', null),
  ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000c001', 'Quick quiz', current_date + 7),
  ('00000000-0000-0000-0000-00000000e004', '00000000-0000-0000-0000-00000000c002', 'Other class work', null),
  ('00000000-0000-0000-0000-00000000e005', '00000000-0000-0000-0000-00000000c003', 'Archived class work', null),
  ('00000000-0000-0000-0000-00000000e008', '00000000-0000-0000-0000-00000000c001', 'Online two', current_date - 1),
  ('00000000-0000-0000-0000-00000000e009', '00000000-0000-0000-0000-00000000c001', 'Online three', null),
  ('00000000-0000-0000-0000-00000000e010', '00000000-0000-0000-0000-00000000c002', 'Other draft', null);
insert into public.assignments (id, class_id, title, max_mark) values
  ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000c001', 'Paper one', 10);

insert into public.assignment_questions (id, assignment_id, kind, prompt, options, correct_option, marks, explanation) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000e001', 'multiple_choice', 'Pick B', '{A,B,C}', 1, 2, 'B is right'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000e001', 'written', 'Explain', '{}', null, 3, 'Model answer'),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000e002', 'multiple_choice', 'Draft question 1', '{A,B}', 0, 1, ''),
  ('00000000-0000-0000-0000-00000000f004', '00000000-0000-0000-0000-00000000e002', 'written', 'Draft question 2', '{}', null, 1, ''),
  ('00000000-0000-0000-0000-00000000f005', '00000000-0000-0000-0000-00000000e003', 'multiple_choice', 'Pick A', '{A,B}', 0, 1, ''),
  ('00000000-0000-0000-0000-00000000f006', '00000000-0000-0000-0000-00000000e003', 'multiple_choice', 'Pick C', '{A,B,C}', 2, 1, 'C is right'),
  ('00000000-0000-0000-0000-00000000f007', '00000000-0000-0000-0000-00000000e004', 'written', 'Other class question', '{}', null, 1, ''),
  ('00000000-0000-0000-0000-00000000f008', '00000000-0000-0000-0000-00000000e005', 'written', 'Archived question', '{}', null, 1, ''),
  ('00000000-0000-0000-0000-00000000f009', '00000000-0000-0000-0000-00000000e008', 'written', 'Late question', '{}', null, 2, ''),
  ('00000000-0000-0000-0000-00000000f010', '00000000-0000-0000-0000-00000000e009', 'multiple_choice', 'Pick A again', '{A,B}', 0, 1, ''),
  ('00000000-0000-0000-0000-00000000f011', '00000000-0000-0000-0000-00000000e010', 'written', 'Other draft question', '{}', null, 1, '');

update public.assignments set status = 'published'
where id not in ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000e010');


-- Roles for new accounts (F1, F30) ---------------------------------------------------
select results_eq(
  $$ select role::text from public.profiles
     where id in ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000006a1')
     order by email $$,
  $$ values ('student'), ('parent') $$,
  'A new account takes its role from app_metadata');

insert into auth.users (id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000007a1', 'authenticated', 'authenticated', 'sneaky@test.local',
        '{"account_role": "parent"}');
select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000007a1'), 'tutor',
  'A role in user metadata is ignored (people can edit their own)');

insert into auth.users (id, aud, role, email, raw_app_meta_data)
values ('00000000-0000-0000-0000-0000000007a2', 'authenticated', 'authenticated', 'admin-try@test.local',
        '{"account_role": "admin"}');
select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000007a2'), 'tutor',
  'app_metadata can''t create admins');

update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}') || '{"account_role": "student"}'
where id = '00000000-0000-0000-0000-0000000007a1';
select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000007a1'), 'student',
  'A role saved to app_metadata after the account is created applies until they join (Supabase Auth does this)');

update auth.users set raw_app_meta_data = raw_app_meta_data || '{"account_role": "parent"}'
where id = '00000000-0000-0000-0000-0000000000b1';
select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'tutor',
  'An account in use never changes role through app_metadata');

delete from auth.users
where id in ('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-0000000007a2');


-- Families have no staff powers and no table access (F2, F5) ---------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select is(private.is_active_staff(), false, 'A student is not staff');
select results_eq($$ select email from public.profiles $$, $$ values ('kid1@test.local') $$,
  'A student reads only their own profile');
select is_empty(
  $$ update public.profiles set bio = 'Hi' where id = '00000000-0000-0000-0000-0000000005a1' returning id $$,
  'A student cannot change their profile');
select is_empty($$ select id from public.classes $$, 'A student cannot read classes directly');
select is_empty($$ select id from public.assignments $$, 'A student cannot read assignments directly');
select is_empty($$ select id from public.assignment_questions $$,
  'A student cannot read questions directly, so correct options stay hidden');
select is_empty($$ select question_id from public.assignment_answers $$, 'A student cannot read answers directly');
select is_empty($$ select student_id from public.assignment_results $$, 'A student cannot read marks directly');
select is_empty($$ select id from public.students $$, 'A student cannot read the roster');
select is_empty($$ select student_id from public.student_guardians $$, 'A student cannot read parent links');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000005a1/1.webp') $$,
  '42501', null, 'A student cannot upload a profile photo');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000006a1');
select results_eq($$ select email from public.profiles $$, $$ values ('parent1@test.local') $$,
  'A parent reads only their own profile');
select is_empty($$ select id from public.students $$, 'A parent cannot read the roster directly');
select is_empty($$ select id from public.assignments $$, 'A parent cannot read assignments directly');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok(
  $$ select public.admin_set_role('00000000-0000-0000-0000-0000000005a1', 'admin') $$,
  'P0001', 'not_staff', 'A student cannot be made staff');
select throws_ok(
  $$ select public.admin_set_role('00000000-0000-0000-0000-0000000000b1', 'parent') $$,
  'P0001', 'not_staff', 'Staff cannot be given a family role');
select is_empty(
  $$ select id from public.admin_list_staff() where role not in ('tutor', 'admin') $$,
  'The staff list has no family accounts');
reset role;


-- Student functions (FS1–FS3, FS5) ---------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select results_eq(
  $$ select title, status from public.student_assignments() order by title $$,
  $$ values ('Online one', 'not_started'), ('Online three', 'not_started'), ('Online two', 'not_started'),
            ('Paper one', 'not_started'), ('Quick quiz', 'not_started') $$,
  'A student sees published work in their active classes (no drafts, other classes or archived classes)');
select is(
  public.student_assignment('00000000-0000-0000-0000-00000000e001') #>> '{questions,0,correctOption}', null,
  'Correct options are hidden before return');
select is(
  public.student_assignment('00000000-0000-0000-0000-00000000e001') #>> '{questions,0,explanation}', '',
  'Explanations are hidden before return');
select throws_ok($$ select public.student_assignment('00000000-0000-0000-0000-00000000e002') $$,
  'P0002', 'not_found', 'A draft is not visible');
select throws_ok($$ select public.student_assignment('00000000-0000-0000-0000-00000000e004') $$,
  'P0002', 'not_found', 'Another class''s work is not visible');
select throws_ok($$ select public.student_assignment('00000000-0000-0000-0000-00000000e005') $$,
  'P0002', 'not_found', 'An archived class''s work is not visible');

select lives_ok(
  $$ select public.student_save_answer('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000f001', 2) $$,
  'A student can choose an option');
select lives_ok(
  $$ select public.student_save_answer('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000f002', null, 'Because B') $$,
  'A student can write an answer');
select results_eq(
  $$ select status, answered_count from public.student_assignments()
     where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  $$ values ('in_progress', 2) $$,
  'The first save starts the work; answered questions are counted');
select is(
  public.student_assignment('00000000-0000-0000-0000-00000000e001') #>> '{questions,0,selectedOption}', '2',
  'A student sees their saved answer');
select lives_ok(
  $$ select public.student_save_answer('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000f001', 1) $$,
  'A student can change an answer before submitting');
select throws_ok(
  $$ select public.student_save_answer('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000f001', 3) $$,
  'P0001', 'invalid_option', 'An option that doesn''t exist is refused');
select throws_ok(
  $$ select public.student_save_answer('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000f005', 0) $$,
  'P0001', 'invalid_question', 'A question from another assignment is refused');
select throws_ok(
  $$ select public.student_save_answer('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000f002', null, repeat('x', 5001)) $$,
  'P0001', 'answer_too_long', 'Very long answers are refused (F17)');
select throws_ok(
  $$ select public.student_save_answer('00000000-0000-0000-0000-00000000e004', '00000000-0000-0000-0000-00000000f007', null, 'Hi') $$,
  'P0002', 'not_found', 'A student cannot answer another class''s work');
select throws_ok($$ select public.student_submit('00000000-0000-0000-0000-00000000e006') $$,
  'P0001', 'not_online', 'Paper homework is handed in on paper');

select is(public.student_submit('00000000-0000-0000-0000-00000000e001'), 'submitted',
  'Work with a written question waits for marking after submitting');
select throws_ok($$ select public.student_submit('00000000-0000-0000-0000-00000000e001') $$,
  'P0001', 'already_submitted', 'Work can be submitted only once (F27)');
select throws_ok(
  $$ select public.student_save_answer('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000f001', 0) $$,
  'P0001', 'already_submitted', 'Answers can''t change after submitting (F10)');
select results_eq(
  $$ select status, mark, comment from public.student_assignments()
     where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  $$ values ('submitted', null::numeric, '') $$,
  'The mark stays hidden until the work is returned (F12)');
select is(
  public.student_assignment('00000000-0000-0000-0000-00000000e001') #>> '{questions,0,awardedMarks}', null,
  'Automatic marks stay hidden until return');

select lives_ok(
  $$ select public.student_save_answer('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000f005', 0) $$,
  'A student answers one of two multiple-choice questions');
select is(public.student_submit('00000000-0000-0000-0000-00000000e003'), 'returned',
  'All-multiple-choice work comes straight back (D8)');
select results_eq(
  $$ select status, mark from public.student_assignments()
     where assignment_id = '00000000-0000-0000-0000-00000000e003' $$,
  $$ values ('returned', 1.0::numeric) $$,
  'A right answer gets its marks and an unanswered one gets 0 (F13)');
select is(
  public.student_assignment('00000000-0000-0000-0000-00000000e003') #>> '{questions,1,correctOption}', '2',
  'After return the correct option shows');
select is(
  public.student_assignment('00000000-0000-0000-0000-00000000e003') #>> '{questions,1,explanation}', 'C is right',
  'After return the explanation shows');

select lives_ok(
  $$ select public.student_save_answer('00000000-0000-0000-0000-00000000e008', '00000000-0000-0000-0000-00000000f009', null, 'Sorry, late') $$,
  'A student can still answer after the due date');
select is(public.student_submit('00000000-0000-0000-0000-00000000e008'), 'submitted', 'Late work can be submitted');
select is(
  (select is_late from public.student_assignments() where assignment_id = '00000000-0000-0000-0000-00000000e008'),
  true, 'Work handed in after the due date is late (F14)');
select is(
  (select is_late from public.student_assignments() where assignment_id = '00000000-0000-0000-0000-00000000e001'),
  false, 'Work handed in before the due date is not late');

select lives_ok(
  $$ select public.student_save_answer('00000000-0000-0000-0000-00000000e009', '00000000-0000-0000-0000-00000000f010', 1) $$,
  'A student starts another piece of work');

select results_eq(
  $$ select class_name, day_of_week::int from public.student_timetable() $$,
  $$ values ('Class one', 2) $$,
  'A student''s timetable shows their active classes only');
reset role;

select is(
  (select marked_by from public.assignment_results
   where assignment_id = '00000000-0000-0000-0000-00000000e003' and student_id = '00000000-0000-0000-0000-00000000d001'),
  null::uuid,
  'An automatic return is not marked by anyone (F11)');

select tests.authenticate_as('00000000-0000-0000-0000-0000000005a4');
select throws_ok($$ select * from public.student_assignments() $$,
  '42501', 'not_student', 'A deactivated student account has no access (F7)');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select * from public.student_assignments() $$, '42501', 'not_student', 'Staff are not students');
select throws_ok($$ select * from public.parent_children() $$, '42501', 'not_parent', 'Staff are not parents');
reset role;


-- Tutors build, mark and return (FT1–FT3) ----------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select results_eq(
  $$ select q.position, a.selected_option::text, a.response, a.awarded_marks::text
     from public.assignment_answers a
     join public.assignment_questions q on q.id = a.question_id
     where a.assignment_id = '00000000-0000-0000-0000-00000000e001'
     order by q.position $$,
  $$ values (1, '1', '', '2.0'), (2, null, 'Because B', null) $$,
  'The tutor sees the answers, with multiple choice marked automatically');
select throws_ok(
  $$ update public.assignment_results set status = 'returned'
     where assignment_id = '00000000-0000-0000-0000-00000000e001' and student_id = '00000000-0000-0000-0000-00000000d001' $$,
  'P0001', 'unmarked_answers', 'Work can''t be returned until every answer has a mark');
select throws_ok(
  $$ update public.assignment_answers set awarded_marks = 4
     where question_id = '00000000-0000-0000-0000-00000000f002' and student_id = '00000000-0000-0000-0000-00000000d001' $$,
  'P0001', 'mark_too_high', 'A mark can''t be above the question''s marks');
select throws_ok(
  $$ update public.assignment_answers set response = 'Changed'
     where question_id = '00000000-0000-0000-0000-00000000f002' and student_id = '00000000-0000-0000-0000-00000000d001' $$,
  '42501', null, 'Staff can''t change a student''s answer');
select lives_ok(
  $$ update public.assignment_answers set awarded_marks = 2.5, feedback = 'Good start'
     where question_id = '00000000-0000-0000-0000-00000000f002' and student_id = '00000000-0000-0000-0000-00000000d001' $$,
  'The tutor marks a written answer with feedback');
select is(
  (select mark from public.assignment_results
   where assignment_id = '00000000-0000-0000-0000-00000000e001' and student_id = '00000000-0000-0000-0000-00000000d001'),
  4.5, 'The mark is the sum of the answer marks');
select throws_ok(
  $$ update public.assignment_results set status = 'marked'
     where assignment_id = '00000000-0000-0000-0000-00000000e001' and student_id = '00000000-0000-0000-0000-00000000d001' $$,
  'P0001', 'invalid_status', 'Online work goes straight from submitted to returned');
select lives_ok(
  $$ update public.assignment_results set status = 'returned', feedback = 'Well done'
     where assignment_id = '00000000-0000-0000-0000-00000000e001' and student_id = '00000000-0000-0000-0000-00000000d001' $$,
  'The tutor returns the work with a comment');
select results_eq(
  $$ select marked_by, returned_at is not null from public.assignment_results
     where assignment_id = '00000000-0000-0000-0000-00000000e001' and student_id = '00000000-0000-0000-0000-00000000d001' $$,
  $$ values ('00000000-0000-0000-0000-0000000000b1'::uuid, true) $$,
  'Returning records who marked it and when');
select throws_ok(
  $$ update public.assignment_answers set awarded_marks = 1
     where question_id = '00000000-0000-0000-0000-00000000f010' and student_id = '00000000-0000-0000-0000-00000000d001' $$,
  'P0001', 'not_submitted', 'Work in progress can''t be marked');
select throws_ok(
  $$ update public.assignment_results set status = 'returned'
     where assignment_id = '00000000-0000-0000-0000-00000000e009' and student_id = '00000000-0000-0000-0000-00000000d001' $$,
  'P0001', 'invalid_status', 'Work in progress can''t be returned');
select throws_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status)
     values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d002', 'submitted') $$,
  'P0001', 'invalid_status', 'Staff can''t hand in online work for a student');

select throws_ok(
  $$ insert into public.assignment_questions (assignment_id, kind, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000e001', 'multiple_choice', 'Late addition', '{A,B}', 0) $$,
  'P0001', 'assignment_published', 'Questions can''t be added once published (F9)');
select throws_ok(
  $$ update public.assignment_questions set prompt = 'Changed' where id = '00000000-0000-0000-0000-00000000f001' $$,
  'P0001', 'assignment_published', 'Questions can''t change once published');
select throws_ok(
  $$ delete from public.assignment_questions where id = '00000000-0000-0000-0000-00000000f001' $$,
  'P0001', 'assignment_published', 'Questions can''t be removed once published');
select throws_ok(
  $$ select public.move_question('00000000-0000-0000-0000-00000000f002', -1) $$,
  'P0001', 'assignment_published', 'Questions can''t be reordered once published');
select throws_ok(
  $$ update public.assignments set status = 'draft' where id = '00000000-0000-0000-0000-00000000e001' $$,
  'P0001', 'has_submissions', 'Work students have started can''t go back to draft');
select lives_ok(
  $$ update public.assignments set status = 'draft' where id = '00000000-0000-0000-0000-00000000e006' $$,
  'Work nobody has started can go back to draft');
select results_eq(
  $$ select status, published_at is null from public.assignments where id = '00000000-0000-0000-0000-00000000e006' $$,
  $$ values ('draft', true) $$,
  'A draft has no publish date');
select lives_ok(
  $$ update public.assignments set status = 'published' where id = '00000000-0000-0000-0000-00000000e006' $$,
  'and can be published again');

select throws_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status)
     values ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d002', 'in_progress') $$,
  'P0001', 'invalid_status', 'Paper homework has no "in progress"');
select lives_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status, mark, feedback)
     values ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d001', 'returned', 8, 'Neat work') $$,
  'Paper homework can be returned');
select throws_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status)
     values ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000d002', 'submitted') $$,
  'P0001', 'not_published', 'Drafts take no results');

select lives_ok(
  $$ insert into public.assignment_questions (assignment_id, kind, prompt, marks)
     values ('00000000-0000-0000-0000-00000000e002', 'written', 'Third', 2) $$,
  'A tutor can add a question to a draft');
select results_eq(
  $$ select prompt, position from public.assignment_questions
     where assignment_id = '00000000-0000-0000-0000-00000000e002' order by position $$,
  $$ values ('Draft question 1', 1), ('Draft question 2', 2), ('Third', 3) $$,
  'New questions go last');
select lives_ok(
  $$ select public.move_question(
       (select id from public.assignment_questions where prompt = 'Third'), -1) $$,
  'A tutor can move a question up');
select results_eq(
  $$ select prompt from public.assignment_questions
     where assignment_id = '00000000-0000-0000-0000-00000000e002' order by position $$,
  $$ values ('Draft question 1'), ('Third'), ('Draft question 2') $$,
  'Moving swaps the question with its neighbour');
select lives_ok(
  $$ select public.move_question('00000000-0000-0000-0000-00000000f003', -1) $$,
  'Moving the first question up does nothing');
select throws_ok(
  $$ select public.move_question('00000000-0000-0000-0000-00000000f003', 2) $$,
  '22023', 'invalid_input', 'Questions move one place at a time');
select throws_ok(
  $$ insert into public.assignment_questions (assignment_id, kind, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000e002', 'multiple_choice', 'Bad', '{A}', 0) $$,
  '23514', null, 'Multiple choice needs at least two options');
select throws_ok(
  $$ insert into public.assignment_questions (assignment_id, kind, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000e002', 'multiple_choice', 'Bad', '{A,B}', 2) $$,
  '23514', null, 'The correct option must be one of the options');
select throws_ok(
  $$ insert into public.assignment_questions (assignment_id, kind, prompt, options, correct_option)
     values ('00000000-0000-0000-0000-00000000e002', 'multiple_choice', 'Bad', array['A', null], 0) $$,
  '23514', null, 'Options can''t be empty (F31)');
select throws_ok(
  $$ insert into public.assignment_questions (assignment_id, kind, prompt, options)
     values ('00000000-0000-0000-0000-00000000e002', 'written', 'Bad', '{A,B}') $$,
  '23514', null, 'Written questions have no options');
select throws_ok(
  $$ insert into public.assignment_questions (assignment_id, kind, prompt)
     values ('00000000-0000-0000-0000-00000000e010', 'written', 'Not my class') $$,
  '42501', null, 'A tutor can''t add questions to another tutor''s assignment');
select throws_ok(
  $$ select public.move_question('00000000-0000-0000-0000-00000000f011', 1) $$,
  'P0002', 'not_found', 'A tutor can''t reorder another tutor''s questions');
reset role;

insert into public.assignment_questions (assignment_id, kind, prompt)
select '00000000-0000-0000-0000-00000000e002', 'written', 'Filler ' || n from generate_series(1, 47) as n;
select throws_ok(
  $$ insert into public.assignment_questions (assignment_id, kind, prompt)
     values ('00000000-0000-0000-0000-00000000e002', 'written', 'One too many') $$,
  'P0001', 'too_many_questions', 'An assignment has at most 50 questions');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b2');
select is_empty(
  $$ select question_id from public.assignment_answers where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  'Another tutor can''t see answers in classes they don''t teach');
select is_empty(
  $$ update public.assignment_answers set feedback = 'Hi'
     where assignment_id = '00000000-0000-0000-0000-00000000e001' returning question_id $$,
  'Another tutor can''t mark them');
reset role;


-- Returned work as the student sees it (FS3) -------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select results_eq(
  $$ select status, mark, comment from public.student_assignments()
     where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  $$ values ('returned', 4.5::numeric, 'Well done') $$,
  'Returned work shows the mark and the overall comment');
select is(
  public.student_assignment('00000000-0000-0000-0000-00000000e001') #>> '{questions,1,feedback}', 'Good start',
  'Per-question feedback shows after return');
select is(
  public.student_assignment('00000000-0000-0000-0000-00000000e001') #>> '{questions,0,correctOption}', '1',
  'The correct option shows after return');
select results_eq(
  $$ select status, mark, comment from public.student_assignments()
     where assignment_id = '00000000-0000-0000-0000-00000000e006' $$,
  $$ values ('returned', 8.0::numeric, 'Neat work') $$,
  'Returned paper homework shows its mark and comment');
reset role;


-- Parent functions (FP1–FP3) -------------------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000006a1');
select results_eq(
  $$ select full_name, account_status, class_names from public.parent_children() $$,
  $$ values ('Kid One', 'active', array['Class one']), ('Kid Two', 'none', array['Class one']) $$,
  'A parent sees their linked children, with account status and active classes');
select results_eq(
  $$ select title from public.parent_child_assignments('00000000-0000-0000-0000-00000000d001') order by title $$,
  $$ values ('Online one'), ('Online three'), ('Online two'), ('Paper one'), ('Quick quiz') $$,
  'A parent sees what is assigned to their child');
select results_eq(
  $$ select status, answered_count from public.parent_child_assignments('00000000-0000-0000-0000-00000000d001')
     where assignment_id = '00000000-0000-0000-0000-00000000e009' $$,
  $$ values ('in_progress', null::int) $$,
  'A parent sees that work is in progress, but not how far along');
select is(
  public.parent_child_assignment('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000e009')
    #>> '{questions,0,selectedOption}',
  null, 'A parent can''t see answers before they are submitted (FP2)');
select is(
  public.parent_child_assignment('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000e001')
    #>> '{questions,1,response}',
  'Because B', 'A parent sees submitted answers');
select results_eq(
  $$ select mark, comment from public.parent_child_assignments('00000000-0000-0000-0000-00000000d001')
     where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  $$ values (4.5::numeric, 'Well done') $$,
  'A parent sees the mark and comment once returned');
select results_eq(
  $$ select class_name from public.parent_child_timetable('00000000-0000-0000-0000-00000000d001') $$,
  $$ values ('Class one') $$,
  'A parent sees their child''s timetable');
select throws_ok(
  $$ select * from public.parent_child_assignments('00000000-0000-0000-0000-00000000d003') $$,
  'P0002', 'not_found', 'A parent can''t see other children''s work (F6)');
select throws_ok(
  $$ select public.parent_child_assignment('00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-00000000e004') $$,
  '42501', 'not_found', 'A parent can''t open other children''s assignments');
select throws_ok(
  $$ select * from public.parent_child_timetable('00000000-0000-0000-0000-00000000d003') $$,
  'P0002', 'not_found', 'A parent can''t see other children''s timetables');
select throws_ok(
  $$ select public.parent_child_assignment('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000e004') $$,
  '42501', 'not_found', 'A parent can''t open work from a class their child isn''t in');
-- BUG-7: 42501 (HTTP 403), not P0002 (HTTP 500), for anyone who isn't this child's parent
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ select public.parent_child_assignment('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000e001') $$,
  '42501', 'not_found', 'A tutor opening a parent''s assignment link is refused with 42501');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000006a1');
select lives_ok(
  $$ select public.parent_give_consent('00000000-0000-0000-0000-00000000d002') $$,
  'A parent can allow their child to use the portal (FP3)');
select throws_ok(
  $$ select public.parent_give_consent('00000000-0000-0000-0000-00000000d003') $$,
  'P0002', 'not_found', 'A parent can''t give consent for other children');
select throws_ok($$ select * from public.student_assignments() $$, '42501', 'not_student', 'Parents are not students');
reset role;

select results_eq(
  $$ select consent_source, consent_recorded_by from public.students where id = '00000000-0000-0000-0000-00000000d002' $$,
  $$ values ('parent', '00000000-0000-0000-0000-0000000006a1'::uuid) $$,
  'Consent records which parent gave it');
select results_eq(
  $$ select action, details ->> 'source' from public.audit_log
     where details ->> 'student_id' = '00000000-0000-0000-0000-00000000d002' $$,
  $$ values ('consent_recorded', 'parent') $$,
  'Consent is audited');

select tests.authenticate_as('00000000-0000-0000-0000-0000000006a3');
select throws_ok($$ select * from public.parent_children() $$,
  '42501', 'not_parent', 'A deactivated parent has no access (F7)');
select throws_ok($$ select * from public.parent_child_assignments('00000000-0000-0000-0000-00000000d001') $$,
  'P0002', 'not_found', 'A deactivated parent can''t see their child''s work');
reset role;


-- Admins: consent and parent links (FA1, FA2) ------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select public.admin_record_consent('00000000-0000-0000-0000-00000000d005') $$,
  '42501', 'not_admin', 'Tutors can''t record consent');
select is_empty($$ select student_id from public.student_guardians $$, 'Tutors can''t see parent links (F18)');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select is((select count(*)::int from public.student_guardians), 4, 'Admins see parent links');
select lives_ok($$ select public.admin_record_consent('00000000-0000-0000-0000-00000000d005') $$,
  'An admin can record consent (FA1)');
select lives_ok($$ select public.admin_record_consent('00000000-0000-0000-0000-00000000d005') $$,
  'Recording it again changes nothing');
select throws_ok($$ select public.admin_record_consent('00000000-0000-0000-0000-0000000000b1') $$,
  'P0002', 'not_found', 'Consent needs a real student');
select is(
  (select target_name from public.admin_list_activity()
   where action = 'consent_recorded' and details ->> 'student_id' = '00000000-0000-0000-0000-00000000d005'),
  'Kid Five', 'The activity list names the student, once');
select lives_ok(
  $$ select public.admin_unlink_parent('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000006a1') $$,
  'An admin can remove a parent link (F25)');
select throws_ok(
  $$ select public.admin_unlink_parent('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000006a1') $$,
  'P0002', 'not_found', 'Removing a link that isn''t there says so');
select results_eq(
  $$ select target_name, details ->> 'student_name' from public.admin_list_activity() where action = 'parent_unlinked' $$,
  $$ values ('Test parent1', 'Kid Two') $$,
  'Removing a link is audited');
select throws_ok(
  $$ update public.assignments set class_id = '00000000-0000-0000-0000-00000000c002'
     where id = '00000000-0000-0000-0000-00000000e003' $$,
  'P0001', 'has_submissions', 'Work with student answers can''t move to another class');
reset role;

select results_eq(
  $$ select consent_source from public.students where id = '00000000-0000-0000-0000-00000000d005' $$,
  $$ values ('admin') $$,
  'Consent recorded by an admin says so');

select tests.authenticate_as('00000000-0000-0000-0000-0000000006a1');
select throws_ok($$ select * from public.parent_child_assignments('00000000-0000-0000-0000-00000000d002') $$,
  'P0002', 'not_found', 'An unlinked parent loses access to that child');
reset role;


-- Links are checked (F3, F4) --------------------------------------------------------------
select throws_ok(
  $$ update public.students set profile_id = '00000000-0000-0000-0000-0000000000b1'
     where id = '00000000-0000-0000-0000-00000000d005' $$,
  'P0001', 'not_a_student_account', 'A staff account can''t be linked as a student');
select throws_ok(
  $$ update public.students set profile_id = '00000000-0000-0000-0000-0000000005a5'
     where id = '00000000-0000-0000-0000-00000000d006' $$,
  'P0001', 'consent_needed', 'A student account needs consent first');
select lives_ok(
  $$ update public.students set profile_id = '00000000-0000-0000-0000-0000000005a5'
     where id = '00000000-0000-0000-0000-00000000d005' $$,
  'A student account can be linked once consent is recorded');
select throws_ok(
  $$ insert into public.student_guardians (student_id, parent_id)
     values ('00000000-0000-0000-0000-00000000d005', '00000000-0000-0000-0000-0000000005a1') $$,
  'P0001', 'not_a_parent_account', 'A student account can''t be linked as a parent');


-- Archived students and visitors -----------------------------------------------------------
update public.students set is_active = false where id = '00000000-0000-0000-0000-00000000d001';

select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select throws_ok($$ select * from public.student_assignments() $$,
  '42501', 'not_student', 'An archived student loses access (F7)');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000006a1');
select is_empty(
  $$ select student_id from public.parent_children() where student_id = '00000000-0000-0000-0000-00000000d001' $$,
  'Parents no longer see an archived child');
reset role;

select tests.authenticate_as_anon();
select throws_ok($$ select * from public.student_assignments() $$, '42501', null, 'Visitors can''t call student functions');
select throws_ok($$ select * from public.parent_children() $$, '42501', null, 'Visitors can''t call parent functions');
reset role;


-- Deleting published work still works (with its questions and answers) ----------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$ delete from public.assignments where id = '00000000-0000-0000-0000-00000000e001' $$,
  'A tutor can delete published work');
reset role;
select is_empty(
  $$ select 1 from public.assignment_answers where assignment_id = '00000000-0000-0000-0000-00000000e001' $$,
  'Deleting work deletes its answers');

select * from finish();
rollback;
