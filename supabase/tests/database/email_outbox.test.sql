-- "Work returned" email (ADR-0004; delivery 2026-10-25 item 3, design 03 §3.10): who gets queued,
-- the off switch, the worker RPCs, the cron kick and the admin Failed / Waiting list.

begin;
select no_plan();
select tests.remove_all_accounts();
select tests.remove_all_classes();
delete from public.email_outbox; -- the seed's returned work queues rows on db reset

-- Staff
select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor1@test.local');
select tests.create_staff('00000000-0000-0000-0000-0000000000b2', 'tutor2@test.local');

-- Family accounts
--   kid1 (active), kid3 (invited, not joined), kid4 (deactivated), kid6 (active, switch off)
--   parent1 + parent2 (Kid One), parent3 (deactivated, Kid One and Kid Five),
--   parent4 (Kid Four), parent6 (Kid Six, switch off)
select tests.create_family_account('00000000-0000-0000-0000-0000000005a1', 'kid1@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000005a3', 'kid3@test.local', 'student', p_joined => false);
select tests.create_family_account('00000000-0000-0000-0000-0000000005a4', 'kid4@test.local', 'student', p_active => false);
select tests.create_family_account('00000000-0000-0000-0000-0000000005a6', 'kid6@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000006a1', 'parent1@test.local', 'parent');
select tests.create_family_account('00000000-0000-0000-0000-0000000006a2', 'parent2@test.local', 'parent');
select tests.create_family_account('00000000-0000-0000-0000-0000000006a3', 'parent3@test.local', 'parent', p_active => false);
select tests.create_family_account('00000000-0000-0000-0000-0000000006a4', 'parent4@test.local', 'parent');
select tests.create_family_account('00000000-0000-0000-0000-0000000006a6', 'parent6@test.local', 'parent');

-- Classes: c1 (tutor 1), c2 (tutor 2)
insert into public.classes (id, name, subject, tutor_id, is_active) values
  ('00000000-0000-0000-0000-00000000c001', 'Class one', 'maths', '00000000-0000-0000-0000-0000000000b1', true),
  ('00000000-0000-0000-0000-00000000c002', 'Class two', 'english', '00000000-0000-0000-0000-0000000000b2', true);

-- Roster: Kid Two and Kid Five have no account.
insert into public.students (id, full_name, year_level, profile_id, consent_recorded_at, consent_source) values
  ('00000000-0000-0000-0000-00000000d001', 'Kid One', 8, '00000000-0000-0000-0000-0000000005a1', now(), 'admin'),
  ('00000000-0000-0000-0000-00000000d002', 'Kid Two', 6, null, null, null),
  ('00000000-0000-0000-0000-00000000d003', 'Kid Three', 5, '00000000-0000-0000-0000-0000000005a3', now(), 'admin'),
  ('00000000-0000-0000-0000-00000000d004', 'Kid Four', 8, '00000000-0000-0000-0000-0000000005a4', now(), 'admin'),
  ('00000000-0000-0000-0000-00000000d005', 'Kid Five', 7, null, null, null),
  ('00000000-0000-0000-0000-00000000d006', 'Kid Six', 7, '00000000-0000-0000-0000-0000000005a6', now(), 'admin');

insert into public.enrolments (class_id, student_id)
select '00000000-0000-0000-0000-00000000c001', id from public.students;

insert into public.student_guardians (student_id, parent_id) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000006a2'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000006a3'),
  ('00000000-0000-0000-0000-00000000d004', '00000000-0000-0000-0000-0000000006a4'),
  ('00000000-0000-0000-0000-00000000d005', '00000000-0000-0000-0000-0000000006a3'),
  ('00000000-0000-0000-0000-00000000d006', '00000000-0000-0000-0000-0000000006a6');

-- Kid Six and their parent have turned the email off.
insert into public.notification_settings (profile_id, work_returned) values
  ('00000000-0000-0000-0000-0000000005a6', false),
  ('00000000-0000-0000-0000-0000000006a6', false);

-- Assignments: e001 online (written), e003 all multiple choice, e006/e007 paper, e004 class two
insert into public.assignments (id, class_id, title) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 'Online one'),
  ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000c001', 'Quick quiz');
insert into public.assignments (id, class_id, title, max_mark) values
  ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000c001', 'Paper one', 10),
  ('00000000-0000-0000-0000-00000000e007', '00000000-0000-0000-0000-00000000c001', 'Paper two', 10),
  ('00000000-0000-0000-0000-00000000e004', '00000000-0000-0000-0000-00000000c002', 'Other class paper', 10);
insert into public.assignment_questions (id, assignment_id, kind, prompt, options, correct_option, marks) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000e001', 'written', 'Explain', '{}', null, 3),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000e003', 'multiple_choice', 'Pick A', '{A,B}', 0, 1);
update public.assignments set status = 'published';

-- Expected recipients for Kid One: kid1, parent1, parent2 (parent3 is deactivated).
create temporary table kid_one_recipients (recipient_id uuid, recipient_role text);
insert into kid_one_recipients values
  ('00000000-0000-0000-0000-0000000005a1', 'student'),
  ('00000000-0000-0000-0000-0000000006a1', 'parent'),
  ('00000000-0000-0000-0000-0000000006a2', 'parent');
grant select on kid_one_recipients to authenticated;

create function pg_temp.queued(target_assignment uuid, target_student uuid)
returns int language sql as $$
  select count(*)::int from public.email_outbox
  where assignment_id = target_assignment and student_id = target_student
$$;


-- AC-3.1: a staff return queues the student and each active parent -------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status, mark, feedback)
     values ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d001', 'returned', 8, 'Neat work') $$,
  'A tutor returns paper homework');
reset role;
select results_eq(
  $$ select recipient_id, recipient_role, status, attempts::int from public.email_outbox
     where assignment_id = '00000000-0000-0000-0000-00000000e006'
       and student_id = '00000000-0000-0000-0000-00000000d001'
     order by recipient_id $$,
  $$ select recipient_id, recipient_role, 'pending', 0 from kid_one_recipients order by recipient_id $$,
  'Paper return: one pending email each for the student and both active parents (AC-3.1)');

-- Online work: the student hands in, the tutor marks and returns.
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select public.student_save_answer('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000f001', null, 'Because');
select public.student_submit('00000000-0000-0000-0000-00000000e001');
reset role;
select is(pg_temp.queued('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d001'), 0,
  'Handing in queues nothing');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
update public.assignment_answers set awarded_marks = 2, feedback = 'Good'
where question_id = '00000000-0000-0000-0000-00000000f001' and student_id = '00000000-0000-0000-0000-00000000d001';
select lives_ok(
  $$ update public.assignment_results set status = 'returned'
     where assignment_id = '00000000-0000-0000-0000-00000000e001' and student_id = '00000000-0000-0000-0000-00000000d001' $$,
  'A tutor returns online work');
reset role;
select results_eq(
  $$ select recipient_id, recipient_role from public.email_outbox
     where assignment_id = '00000000-0000-0000-0000-00000000e001' order by recipient_id $$,
  $$ select recipient_id, recipient_role from kid_one_recipients order by recipient_id $$,
  'Online return: the same three recipients (AC-3.1)');


-- AC-3.5: at most once, staff returns only, nobody else ------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
update public.assignment_results set status = 'marked'
where assignment_id = '00000000-0000-0000-0000-00000000e006' and student_id = '00000000-0000-0000-0000-00000000d001';
update public.assignment_results set status = 'returned', mark = 9
where assignment_id = '00000000-0000-0000-0000-00000000e006' and student_id = '00000000-0000-0000-0000-00000000d001';
update public.assignment_results set feedback = 'Neat work, well done'
where assignment_id = '00000000-0000-0000-0000-00000000e006' and student_id = '00000000-0000-0000-0000-00000000d001';
reset role;
select is(pg_temp.queued('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d001'), 3,
  'Returned → marked → returned again, or edited after return: still one email per person (AC-3.5)');

select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select public.student_save_answer('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000f003', 0);
select is(public.student_submit('00000000-0000-0000-0000-00000000e003'), 'returned',
  'All-multiple-choice work comes straight back');
reset role;
select is(pg_temp.queued('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000d001'), 0,
  'An automatic return (no marker) queues nothing (staff returns only)');

-- Tutor 2 doesn't teach class one: their update changes nothing and queues nothing (AC-3.10).
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
insert into public.assignment_results (assignment_id, student_id, status)
values ('00000000-0000-0000-0000-00000000e007', '00000000-0000-0000-0000-00000000d001', 'submitted');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b2');
select is_empty(
  $$ update public.assignment_results set status = 'returned', mark = 5
     where assignment_id = '00000000-0000-0000-0000-00000000e007' returning student_id $$,
  'A tutor of another class can''t return the work');
reset role;
select is(pg_temp.queued('00000000-0000-0000-0000-00000000e007', '00000000-0000-0000-0000-00000000d001'), 0,
  'so nothing is queued for it (AC-3.10)');

-- A return that fails rolls its email back with it (AC-3.7, atomic).
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ update public.assignment_results set status = 'returned', mark = 11
     where assignment_id = '00000000-0000-0000-0000-00000000e007' and student_id = '00000000-0000-0000-0000-00000000d001' $$,
  'P0001', 'mark_too_high', 'A return that fails...');
reset role;
select is(pg_temp.queued('00000000-0000-0000-0000-00000000e007', '00000000-0000-0000-0000-00000000d001'), 0,
  '...queues no email');


-- AC-3.2: no-recipient cases succeed and queue nothing --------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status, mark)
     values ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d002', 'returned', 7) $$,
  'Return for a roster-only student with no parent succeeds');
select lives_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status, mark)
     values ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d003', 'returned', 7) $$,
  'Return for a student whose account is only invited succeeds');
select lives_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status, mark)
     values ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d004', 'returned', 7) $$,
  'Return for a student whose account is deactivated succeeds');
select lives_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status, mark)
     values ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d005', 'returned', 7) $$,
  'Return for a student whose only parent is deactivated succeeds');
select lives_ok(
  $$ insert into public.assignment_results (assignment_id, student_id, status, mark)
     values ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d006', 'returned', 7) $$,
  'Return for a family that turned the email off succeeds');
reset role;
select is(pg_temp.queued('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d002'), 0,
  'Roster only, no parent: nothing queued');
select is(pg_temp.queued('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d003'), 0,
  'Invited (not active) student, no parent: nothing queued');
select results_eq(
  $$ select recipient_id from public.email_outbox
     where assignment_id = '00000000-0000-0000-0000-00000000e006' and student_id = '00000000-0000-0000-0000-00000000d004' $$,
  $$ values ('00000000-0000-0000-0000-0000000006a4'::uuid) $$,
  'Deactivated student account: nothing for them, their parent still gets one');
select is(pg_temp.queued('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d005'), 0,
  'No active parent: nothing queued');
select is(pg_temp.queued('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d006'), 0,
  'Every recipient turned the switch off: nothing queued');
select is_empty(
  $$ select 1 from public.email_outbox where status = 'failed' $$,
  'No-recipient returns record no failure (AC-3.2)');
select is_empty(
  $$ select 1 from public.email_outbox o
     join public.profiles p on p.id = o.recipient_id
     where p.role not in ('student', 'parent')
        or o.recipient_id in ('00000000-0000-0000-0000-0000000006a3', '00000000-0000-0000-0000-0000000005a4') $$,
  'Tutors, admins and deactivated accounts are never queued (AC-3.5)');
select is_empty(
  $$ select 1 from public.email_outbox
     where student_id = '00000000-0000-0000-0000-00000000d001'
       and recipient_id not in (select recipient_id from kid_one_recipients) $$,
  'Parents of other children get nothing about Kid One (AC-3.5)');


-- AC-3.6, AC-3.10: each person reads and changes only their own switch ----------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000006a1');
select lives_ok(
  $$ insert into public.notification_settings (profile_id, work_returned)
     values ('00000000-0000-0000-0000-0000000006a1', true) $$,
  'A parent adds their own setting');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select is_empty($$ select work_returned from public.notification_settings $$,
  'A student with no row sees none (a missing row means on)');
select lives_ok(
  $$ insert into public.notification_settings (profile_id, work_returned)
     values ('00000000-0000-0000-0000-0000000005a1', false) $$,
  'A student turns the email off');
select results_eq($$ select work_returned from public.notification_settings $$, $$ values (false) $$,
  'and reads back only their own row');
select results_eq(
  $$ update public.notification_settings set work_returned = true
     where profile_id = '00000000-0000-0000-0000-0000000005a1' returning work_returned $$,
  $$ values (true) $$,
  'A student turns it on again');
select is_empty(
  $$ update public.notification_settings set work_returned = false
     where profile_id = '00000000-0000-0000-0000-0000000006a1' returning profile_id $$,
  'A student can''t change their parent''s setting');
select throws_ok(
  $$ insert into public.notification_settings (profile_id, work_returned)
     values ('00000000-0000-0000-0000-0000000006a2', false) $$,
  '42501', null, 'A student can''t add a setting for someone else');
select throws_ok(
  $$ update public.notification_settings set profile_id = '00000000-0000-0000-0000-0000000006a2'
     where profile_id = '00000000-0000-0000-0000-0000000005a1' $$,
  '42501', null, 'Nobody can move a setting to another person');
select throws_ok($$ select id from public.email_outbox $$, '42501', null,
  'A student can''t read the outbox');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select is_empty($$ select profile_id from public.notification_settings $$, 'A tutor reads no settings');
select throws_ok(
  $$ insert into public.notification_settings (profile_id, work_returned)
     values ('00000000-0000-0000-0000-0000000000b1', false) $$,
  '42501', null, 'Staff have no email switch');
select throws_ok($$ select id from public.email_outbox $$, '42501', null, 'A tutor can''t read the outbox');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000005a3');
select throws_ok(
  $$ insert into public.notification_settings (profile_id, work_returned)
     values ('00000000-0000-0000-0000-0000000005a3', false) $$,
  '42501', null, 'An invited (not yet active) student can''t add a setting');
reset role;

select tests.authenticate_as_anon();
select throws_ok($$ select profile_id from public.notification_settings $$, '42501', null,
  'Visitors can''t read settings');
select throws_ok($$ select id from public.email_outbox $$, '42501', null, 'Visitors can''t read the outbox');
reset role;

select * from finish();
rollback;
