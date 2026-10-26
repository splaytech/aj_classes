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
delete from public.email_outbox; -- item 8: publishing queues "new assignment" rows; this file tests work_returned

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


-- AC-3.2 (continued): no-recipient returns leave the admin list empty ----------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select is_empty($$ select id from public.admin_email_problems() $$,
  'After the no-recipient returns the admin list is empty (AC-3.2)');
reset role;


-- AC-3.10: only the worker (service role) can run the worker RPCs -------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select throws_ok($$ select public.notify_claim_emails() $$, '42501', null,
  'A student can''t claim emails');
select throws_ok($$ select public.notify_record_result(gen_random_uuid(), 'sent') $$, '42501', null,
  'A student can''t record a send');
select throws_ok($$ select public.notify_flag_config_missing() $$, '42501', null,
  'A student can''t flag rows');
select throws_ok($$ select private.kick_email_worker() $$, '42501', null,
  'A student can''t kick the worker');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok($$ select public.notify_claim_emails() $$, '42501', null,
  'Not even an admin can claim emails');
reset role;
select tests.authenticate_as_anon();
select throws_ok($$ select public.notify_claim_emails() $$, '42501', null, 'Visitors can''t claim emails');
select throws_ok($$ select public.admin_email_problems() $$, '42501', null,
  'Visitors can''t list email problems');
reset role;


-- Claim: re-checks eligibility, returns what the email needs and nothing more --------------
-- Since the return: parent2 turned the email off and parent1's account was deactivated.
insert into public.notification_settings (profile_id, work_returned)
values ('00000000-0000-0000-0000-0000000006a2', false);
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000006a1';

set local role service_role;
create temporary table claimed on commit drop as select * from public.notify_claim_emails();
reset role;

select results_eq(
  $$ select recipient_role, email, recipient_first_name, child_first_name, assignment_title, class_name
     from claimed order by assignment_title, recipient_role $$,
  $$ values ('student', 'kid1@test.local', 'Test', 'Kid', 'Online one', 'Class one'),
            ('parent', 'parent4@test.local', 'Test', 'Kid', 'Paper one', 'Class one'),
            ('student', 'kid1@test.local', 'Test', 'Kid', 'Paper one', 'Class one') $$,
  'The claim returns only still-eligible rows, with the email''s details');
select is(
  (select array_agg(n order by n) from unnest(
     (select proargnames[1:] from pg_proc where proname = 'notify_claim_emails')) n
   where n not in ('id')),
  array['assignment_id', 'assignment_title', 'child_first_name', 'class_name', 'email',
        'recipient_first_name', 'recipient_role', 'student_id'],
  'The claim has no mark, score or feedback column (AC-3.3)');
select results_eq(
  $$ select status, count(*)::int from public.email_outbox
     where recipient_id in ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006a2')
     group by status $$,
  $$ values ('skipped', 4) $$,
  'A recipient who turned the switch off or was deactivated since the return is skipped');
select results_eq(
  $$ select distinct status, attempts::int, claimed_at = now() from public.email_outbox
     where id in (select id from claimed) $$,
  $$ values ('sending', 1, true) $$,
  'Claimed rows are sending, with one attempt used');

-- Restore the family for the rest of the file.
delete from public.notification_settings where profile_id = '00000000-0000-0000-0000-0000000006a2';
update public.profiles set is_active = true where id = '00000000-0000-0000-0000-0000000006a1';


-- Recording each send ----------------------------------------------------------------------
create function pg_temp.claimed_id(title text, role text) returns uuid language sql as $$
  select id from claimed where assignment_title = title and recipient_role = role
    and email <> 'parent4@test.local'
$$;

set local role service_role;
select public.notify_record_result(pg_temp.claimed_id('Paper one', 'student'), 'sent');
select public.notify_record_result(pg_temp.claimed_id('Online one', 'student'), 'retry', 'server_error');
select public.notify_record_result(
  (select id from claimed where email = 'parent4@test.local'), 'failed', 'rejected');
reset role;
select results_eq(
  $$ select status, reason, sent_at is not null from public.email_outbox
     where id = pg_temp.claimed_id('Paper one', 'student') $$,
  $$ values ('sent', null::text, true) $$,
  'A sent row is sent, with the time');
select results_eq(
  $$ select status, reason, attempts::int from public.email_outbox
     where id = pg_temp.claimed_id('Online one', 'student') $$,
  $$ values ('pending', 'server_error', 1) $$,
  'A retry goes back to pending, keeping the attempt and the reason code');
select results_eq(
  $$ select status, reason from public.email_outbox
     where id = (select id from claimed where email = 'parent4@test.local') $$,
  $$ values ('failed', 'rejected') $$,
  'A rejected send fails');

set local role service_role;
select public.notify_record_result(pg_temp.claimed_id('Paper one', 'student'), 'retry', 'network');
reset role;
select is(
  (select status from public.email_outbox where id = pg_temp.claimed_id('Paper one', 'student')), 'sent',
  'A row no longer sending can''t be changed by a late worker');

set local role service_role;
select throws_ok($$ select public.notify_record_result(gen_random_uuid(), 'sent', 'network') $$,
  'P0001', 'invalid_input', 'sent with a reason is refused');
select throws_ok($$ select public.notify_record_result(gen_random_uuid(), 'retry', 'rejected') $$,
  'P0001', 'invalid_input', 'retry with rejected is refused');
select throws_ok($$ select public.notify_record_result(gen_random_uuid(), 'failed', 'network') $$,
  'P0001', 'invalid_input', 'failed with network is refused');
select throws_ok($$ select public.notify_record_result(gen_random_uuid(), 'bounced') $$,
  'P0001', 'invalid_input', 'an unknown outcome is refused');
select throws_ok($$ select public.notify_record_result(gen_random_uuid(), 'retry') $$,
  'P0001', 'invalid_input', 'retry without a reason is refused');
select throws_ok($$ select public.notify_record_result(gen_random_uuid(), 'failed') $$,
  'P0001', 'invalid_input', 'failed without a reason is refused');
select throws_ok($$ select public.notify_record_result(gen_random_uuid(), null) $$,
  'P0001', 'invalid_input', 'a null outcome is refused');
reset role;

update public.email_outbox set status = 'sending', attempts = 3
where id = pg_temp.claimed_id('Online one', 'student');
set local role service_role;
select public.notify_record_result(pg_temp.claimed_id('Online one', 'student'), 'retry', 'network');
reset role;
select results_eq(
  $$ select status, reason from public.email_outbox where id = pg_temp.claimed_id('Online one', 'student') $$,
  $$ values ('failed', 'max_attempts') $$,
  'A retry on the third attempt fails as "gave up after 3 tries"');

set local role service_role;
select public.notify_flag_config_missing();
reset role;
select is(
  (select count(*)::int from public.email_outbox where status = 'pending' and reason is distinct from 'config_missing'), 0,
  'A missing transport flags every pending row config_missing...');
select is(
  (select count(*)::int from public.email_outbox where status = 'pending' and attempts > 0), 0,
  '...without using an attempt');


-- Cap (replaced by 2 here) and reclaim ------------------------------------------------------
delete from public.email_outbox;
create or replace function private.email_daily_cap()
returns int language sql immutable set search_path = '' as $$ select 2 $$;

-- Rows for Kid One: (assignment, recipient) pairs are unique, so spread them over the assignments.
create function pg_temp.add_row(
  target_assignment uuid, recipient uuid, row_status text, row_attempts int default 0,
  row_created timestamptz default now(), row_claimed timestamptz default null,
  row_sent timestamptz default null, row_reason text default null)
returns uuid language sql as $$
  insert into public.email_outbox
    (kind, assignment_id, student_id, recipient_id, recipient_role, status, attempts,
     created_at, claimed_at, sent_at, reason)
  values ('work_returned', target_assignment, '00000000-0000-0000-0000-00000000d001', recipient,
          case when recipient = '00000000-0000-0000-0000-0000000005a1' then 'student' else 'parent' end,
          row_status, row_attempts, row_created, row_claimed, row_sent, row_reason)
  returning id
$$;

select pg_temp.add_row('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000005a1', 'sent',
  1, now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour');
select pg_temp.add_row('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000006a1', 'sending',
  1, now() - interval '2 hours', now() - interval '1 minute');
select pg_temp.add_row('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-0000000005a1', 'pending');

set local role service_role;
select is_empty($$ select id from public.notify_claim_emails() $$,
  'With 1 sent + 1 still sending in 24 h and a cap of 2, nothing is claimed');
reset role;

update public.email_outbox set status = 'sent', sent_at = now() - interval '25 hours'
where status = 'sending';
set local role service_role;
select is((select count(*)::int from public.notify_claim_emails()), 1,
  'A send older than 24 hours no longer counts, so one row is claimed');
reset role;

-- Reclaim: a worker died 11 minutes after claiming.
delete from public.email_outbox;
select pg_temp.add_row('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000005a1', 'sending',
  1, now() - interval '20 minutes', now() - interval '11 minutes');
select pg_temp.add_row('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000006a1', 'sending',
  3, now() - interval '40 minutes', now() - interval '11 minutes');
select pg_temp.add_row('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000006a2', 'sending',
  1, now() - interval '5 minutes', now() - interval '2 minutes');
select private.kick_email_worker();
select results_eq(
  $$ select recipient_id, status, attempts::int, reason from public.email_outbox order by recipient_id $$,
  $$ values ('00000000-0000-0000-0000-0000000005a1'::uuid, 'pending', 1, null::text),
            ('00000000-0000-0000-0000-0000000006a1'::uuid, 'failed', 3, 'max_attempts'),
            ('00000000-0000-0000-0000-0000000006a2'::uuid, 'sending', 1, null::text) $$,
  'The kick reclaims rows stuck in sending > 10 min (attempt kept; the third fails); a recent claim is left alone');

-- The kick calls the worker through pg_net with the secret from Vault.
delete from vault.secrets where name in ('notify_worker_url', 'notify_worker_secret');
select vault.create_secret('http://worker.test/functions/v1/notifications', 'notify_worker_url');
select vault.create_secret('test-worker-secret', 'notify_worker_secret');
create function pg_temp.worker_calls() returns int language sql as $$
  select count(*)::int from net.http_request_queue where url = 'http://worker.test/functions/v1/notifications'
$$;

select private.kick_email_worker();
select is(pg_temp.worker_calls(), 1, 'With a row pending and room under the cap, the kick calls the worker once');
select is(
  (select headers ->> 'x-notify-secret' from net.http_request_queue
   where url = 'http://worker.test/functions/v1/notifications'),
  'test-worker-secret', 'carrying the shared secret header');

delete from net.http_request_queue where url = 'http://worker.test/functions/v1/notifications';
update public.email_outbox set status = 'sent', sent_at = now() where status <> 'failed';
select private.kick_email_worker();
select is(pg_temp.worker_calls(), 0, 'Nothing pending: no call');

select pg_temp.add_row('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-0000000005a1', 'pending');
select private.kick_email_worker();
select is(pg_temp.worker_calls(), 0, 'Cap reached (2 sent in 24 h): no call');

-- AC-3.7: with no worker secret, rows just wait.
update public.email_outbox set sent_at = now() - interval '25 hours' where status = 'sent';
delete from vault.secrets where name = 'notify_worker_secret';
select private.kick_email_worker();
select is(pg_temp.worker_calls(), 0, 'No worker secret in Vault: no call (AC-3.7)');
select is(
  (select status from public.email_outbox where assignment_id = '00000000-0000-0000-0000-00000000e003'), 'pending',
  'and the row stays pending, nothing lost');


-- AC-3.8: the admin Failed / Waiting list ---------------------------------------------------
delete from public.email_outbox;
select pg_temp.add_row('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-0000000005a1', 'failed',
  1, now() - interval '30 minutes', row_reason => 'rejected');
select pg_temp.add_row('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-0000000006a1', 'pending',
  0, now() - interval '3 hours');
select pg_temp.add_row('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-0000000006a2', 'pending',
  0, now() - interval '1 hour');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select * from public.admin_email_problems() $$, '42501', 'not_admin', 'A tutor is refused');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select throws_ok($$ select * from public.admin_email_problems() $$, '42501', 'not_admin', 'A student is refused');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000006a1');
select throws_ok($$ select * from public.admin_email_problems() $$, '42501', 'not_admin', 'A parent is refused');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal1');
select throws_ok($$ select * from public.admin_email_problems() $$, '42501', 'not_admin',
  'An admin without two-step is refused');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select results_eq(
  $$ select recipient_role, assignment_title, state, reason from public.admin_email_problems() $$,
  $$ values ('student', 'Paper one', 'failed', 'rejected'),
            ('parent', 'Paper one', 'waiting', 'not_attempted') $$,
  'Newest first: a failed row with its code, and a 3-hour-old pending row as Waiting / Not attempted; a 1-hour-old one isn''t listed');
reset role;
select is(
  (select array_agg(n order by n) from unnest(
     (select proargnames from pg_proc where proname = 'admin_email_problems')) n),
  array['assignment_title', 'created_at', 'id', 'max_rows', 'reason', 'recipient_role', 'state'],
  'The admin list returns no address, name or body (AC-3.8)');

update public.email_outbox set attempts = 1, reason = 'network'
where recipient_id = '00000000-0000-0000-0000-0000000006a1';
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select is((select reason from public.admin_email_problems() where state = 'waiting'), 'retrying',
  'A waiting row that has been tried shows Retrying');
reset role;

update public.email_outbox set reason = 'config_missing'
where recipient_id = '00000000-0000-0000-0000-0000000006a1';
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select is((select reason from public.admin_email_problems() where state = 'waiting'), 'config_missing',
  'A waiting row flagged by the worker shows Set-up error');
reset role;

update public.email_outbox set reason = null, attempts = 0
where recipient_id = '00000000-0000-0000-0000-0000000006a1';
select pg_temp.add_row('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000005a1', 'sent',
  1, now() - interval '1 hour', now() - interval '1 hour', now() - interval '1 hour');
select pg_temp.add_row('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000006a1', 'sent',
  1, now() - interval '1 hour', now() - interval '1 hour', now() - interval '1 hour');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select is((select reason from public.admin_email_problems() where state = 'waiting'), 'daily_limit',
  'With the cap reached, a waiting row shows Daily limit');
select is((select count(*)::int from public.admin_email_problems() where state not in ('failed', 'waiting')), 0,
  'Sent rows are never listed');
select is((select count(*)::int from public.admin_email_problems(1)), 1, 'max_rows limits the list');
reset role;


-- A recipient with no address fails as no_address (migration step 6) ------------------------
delete from public.email_outbox;
select pg_temp.add_row('00000000-0000-0000-0000-00000000e007', '00000000-0000-0000-0000-0000000006a2', 'pending',
  0, now() - interval '3 hours');
select pg_temp.add_row('00000000-0000-0000-0000-00000000e007', '00000000-0000-0000-0000-0000000005a1', 'pending');
update public.profiles set email = '' where id = '00000000-0000-0000-0000-0000000006a2';
set local role service_role;
select results_eq(
  $$ select email from public.notify_claim_emails() $$,
  $$ values ('kid1@test.local') $$,
  'The claim doesn''t return a recipient with no email address');
reset role;
select results_eq(
  $$ select status, reason, attempts::int from public.email_outbox
     where recipient_id = '00000000-0000-0000-0000-0000000006a2' $$,
  $$ values ('failed', 'no_address', 0) $$,
  'That row fails as no_address, without using an attempt');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select results_eq(
  $$ select recipient_role, state, reason from public.admin_email_problems() $$,
  $$ values ('parent', 'failed', 'no_address') $$,
  'and admins see it as Failed / Recipient address missing');
reset role;
update public.profiles set email = 'parent2@test.local' where id = '00000000-0000-0000-0000-0000000006a2';


-- Daily trim: finished emails go after 90 days, waiting ones stay (Security finding 7) ------
delete from public.email_outbox;
select pg_temp.add_row('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000005a1', 'sent',
  1, now() - interval '91 days', now() - interval '91 days', now() - interval '91 days');
select pg_temp.add_row('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000006a1', 'skipped',
  0, now() - interval '91 days');
select pg_temp.add_row('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000006a2', 'failed',
  3, now() - interval '91 days', row_reason => 'max_attempts');
select pg_temp.add_row('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-0000000005a1', 'pending',
  0, now() - interval '91 days');
select pg_temp.add_row('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-0000000006a1', 'sent',
  1, now() - interval '89 days', now() - interval '89 days', now() - interval '89 days');
select private.trim_history();
select results_eq(
  $$ select status, (now() - created_at) > interval '90 days' from public.email_outbox order by status $$,
  $$ values ('pending', true), ('sent', false) $$,
  'The daily trim deletes sent, skipped and failed emails older than 90 days, and keeps waiting ones');
select is(
  (select command from cron.job where jobname = 'daily-history-trim'),
  'select private.trim_history()',
  'The daily cron job runs the trim');
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select throws_ok($$ select private.trim_history() $$, '42501', null, 'Nobody else can run the trim');
reset role;


-- BUG-5: a marked result nobody is recorded as marking, then returned by the tutor --------
delete from public.email_outbox;
insert into public.assignments (id, class_id, title, max_mark) values
  ('00000000-0000-0000-0000-00000000e011', '00000000-0000-0000-0000-00000000c001', 'Imported paper', 10);
update public.assignments set status = 'published' where id = '00000000-0000-0000-0000-00000000e011';
delete from public.email_outbox; -- the publish queued "new assignment" rows (item 8)
select set_config('request.jwt.claims', '', true); -- no signed-in staff: like a seed or an import
insert into public.assignment_results (assignment_id, student_id, status, mark)
values ('00000000-0000-0000-0000-00000000e011', '00000000-0000-0000-0000-00000000d001', 'marked', 6);
select is(
  (select marked_by from public.assignment_results where assignment_id = '00000000-0000-0000-0000-00000000e011'),
  null, 'Set-up: a marked result with no marker');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
update public.assignment_results set status = 'returned'
where assignment_id = '00000000-0000-0000-0000-00000000e011' and student_id = '00000000-0000-0000-0000-00000000d001';
reset role;
select results_eq(
  $$ select marked_by, marked_at is not null from public.assignment_results
     where assignment_id = '00000000-0000-0000-0000-00000000e011' $$,
  $$ values ('00000000-0000-0000-0000-0000000000b1'::uuid, true) $$,
  'The tutor who returns it is recorded as the marker');
select results_eq(
  $$ select recipient_id, recipient_role from public.email_outbox
     where assignment_id = '00000000-0000-0000-0000-00000000e011' order by recipient_id $$,
  $$ select recipient_id, recipient_role from kid_one_recipients order by recipient_id $$,
  'and the return queues the usual emails (student and both active parents)');

select * from finish();
rollback;
