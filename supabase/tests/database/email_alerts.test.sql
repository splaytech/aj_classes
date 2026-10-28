-- "New assignment" and "due tomorrow" emails (ADR-0008; 01b AC-8.1–8.17, design 03b §8.10): the
-- Melbourne helpers, who gets queued on publish and by the daily job, the switches, the claim's
-- order and supported kinds, the too_late sweep and the admin list.
-- Time-dependent rows use explicit send_before / created_at / published_at values; nothing waits
-- on the clock, and nothing depends on the hour the suite happens to run in.

begin;
select no_plan();
select tests.remove_all_accounts();
select tests.remove_all_classes();
delete from public.email_outbox; -- the seed's returned and published work queues rows on db reset

-- Fixtures copied from email_outbox.test.sql -------------------------------------------------
-- Staff
select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor1@test.local');
select tests.create_staff('00000000-0000-0000-0000-0000000000b2', 'tutor2@test.local');

-- Family accounts
--   kid1 (active), kid3 (invited, not joined), kid4 (deactivated), kid6 (active, switches off)
--   parent1 + parent2 (Kid One), parent3 (deactivated, Kid One and Kid Five),
--   parent4 (Kid Four), parent6 (Kid Six, switches off)
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
  ('00000000-0000-0000-0000-00000000d006', '00000000-0000-0000-0000-0000000006a6'),
  -- Added for item 8: parent2 also has Kid Six, so gets one email per child (AC-8.1).
  ('00000000-0000-0000-0000-00000000d006', '00000000-0000-0000-0000-0000000006a2');

-- Kid Six and their parent have turned every email off.
insert into public.notification_settings (profile_id, work_returned, new_assignment, due_tomorrow) values
  ('00000000-0000-0000-0000-0000000005a6', false, false, false),
  ('00000000-0000-0000-0000-0000000006a6', false, false, false);

-- Item 8's work, all drafts: o1 online (one multiple-choice question), x1 paper, n1 online with
-- no due date, t1 class two (tutor 2). Due dates are relative to today in Melbourne.
create temporary table melbourne (today date);
insert into melbourne select private.melbourne_date(now());
grant select on melbourne to authenticated;

insert into public.assignments (id, class_id, title, due_on) values
  ('00000000-0000-0000-0000-00000000e801', '00000000-0000-0000-0000-00000000c001', 'Online due soon',
   (select today + 5 from melbourne)),
  ('00000000-0000-0000-0000-00000000e803', '00000000-0000-0000-0000-00000000c001', 'Online no due date', null),
  ('00000000-0000-0000-0000-00000000e804', '00000000-0000-0000-0000-00000000c002', 'Class two online',
   (select today + 5 from melbourne));
insert into public.assignments (id, class_id, title, due_on, max_mark) values
  ('00000000-0000-0000-0000-00000000e802', '00000000-0000-0000-0000-00000000c001', 'Paper due soon',
   (select today + 5 from melbourne), 10);
insert into public.assignment_questions (assignment_id, kind, prompt, options, correct_option, marks) values
  ('00000000-0000-0000-0000-00000000e801', 'multiple_choice', 'Pick A', '{A,B}', 0, 1),
  ('00000000-0000-0000-0000-00000000e803', 'multiple_choice', 'Pick A', '{A,B}', 0, 1),
  ('00000000-0000-0000-0000-00000000e804', 'multiple_choice', 'Pick A', '{A,B}', 0, 1);

-- e805: online, published, due tomorrow, for the recipient-function cases.
insert into public.assignments (id, class_id, title, due_on) values
  ('00000000-0000-0000-0000-00000000e805', '00000000-0000-0000-0000-00000000c001', 'Recipient check',
   (select today + 1 from melbourne));
insert into public.assignment_questions (assignment_id, kind, prompt, options, correct_option, marks) values
  ('00000000-0000-0000-0000-00000000e805', 'multiple_choice', 'Pick A', '{A,B}', 0, 1);
update public.assignments set status = 'published' where id = '00000000-0000-0000-0000-00000000e805';

delete from public.email_outbox; -- publishing e805 queued "new assignment" rows; start clean

create function pg_temp.queued(target_kind text, target_assignment uuid)
returns table (student_id uuid, recipient_id uuid, recipient_role text)
language sql as $$
  select o.student_id, o.recipient_id, o.recipient_role from public.email_outbox o
  where o.kind = target_kind and o.assignment_id = target_assignment
  order by o.student_id, o.recipient_id
$$;


-- DST and schedule (02b §8.8 risk 4, 03b §8.10) ---------------------------------------------
-- April 2027: AEDT (UTC+11) until 3 am on 4 April, then AEST (UTC+10).
select ok(private.is_reminder_hour('2027-04-03 04:10Z'), '04:10Z on 3 Apr 2027 is 15:10 AEDT: reminder hour');
select ok(not private.is_reminder_hour('2027-04-03 05:10Z'), '05:10Z on 3 Apr 2027 is 16:10 AEDT: not');
select ok(private.is_reminder_hour('2027-04-05 05:10Z'), '05:10Z on 5 Apr 2027 is 15:10 AEST: reminder hour');
select ok(not private.is_reminder_hour('2027-04-05 04:10Z'), '04:10Z on 5 Apr 2027 is 14:10 AEST: not');
-- October 2026: AEST until 2 am on 4 October, then AEDT.
select ok(private.is_reminder_hour('2026-10-03 05:10Z'), '05:10Z on 3 Oct 2026 is 15:10 AEST: reminder hour');
select ok(not private.is_reminder_hour('2026-10-03 04:10Z'), '04:10Z on 3 Oct 2026 is 14:10 AEST: not');
select ok(private.is_reminder_hour('2026-10-05 04:10Z'), '04:10Z on 5 Oct 2026 is 15:10 AEDT: reminder hour');
select ok(not private.is_reminder_hour('2026-10-05 05:10Z'), '05:10Z on 5 Oct 2026 is 16:10 AEDT: not');
select is(
  (select count(*)::int from generate_series(timestamptz '2026-10-05 00:10Z', timestamptz '2026-10-05 23:10Z',
                                             interval '1 hour') run
   where private.is_reminder_hour(run)),
  1, 'Exactly one of the 24 hourly runs on a day passes the guard');
select is(
  (select count(*)::int from generate_series(timestamptz '2026-10-04 00:10Z', timestamptz '2026-10-04 23:10Z',
                                             interval '1 hour') run
   where private.is_reminder_hour(run)),
  1, 'and on 4 Oct 2026, the day clocks go forward (a 23-hour Melbourne day)');
select is(
  (select count(*)::int from generate_series(timestamptz '2027-04-04 00:10Z', timestamptz '2027-04-04 23:10Z',
                                             interval '1 hour') run
   where private.is_reminder_hour(run)),
  1, 'and on 4 Apr 2027, the day clocks go back (a 25-hour Melbourne day)');

select is(private.melbourne_day_start('2026-10-05'), timestamptz '2026-10-04 13:00Z',
  'Midnight starting 5 Oct 2026 (AEDT) is 13:00Z the day before');
select is(private.melbourne_day_start('2026-10-04'), timestamptz '2026-10-03 14:00Z',
  'Midnight starting 4 Oct 2026 (still AEST) is 14:00Z the day before');
select is(private.melbourne_day_start('2027-04-05'), timestamptz '2027-04-04 14:00Z',
  'Midnight starting 5 Apr 2027 (AEST) is 14:00Z the day before');
select is(private.melbourne_date('2026-10-26 13:30Z'), date '2026-10-27',
  '00:30 Melbourne is already the next day');
select is(private.reminder_hour(), 15, 'The reminder hour is 3 pm (01b assumption 10)');


-- "New assignment" deadline helper ----------------------------------------------------------
select is(private.new_assignment_send_before('2026-10-30', '2026-10-26 01:00Z'),
  private.melbourne_day_start('2026-10-31'), 'With a due date: the end of the due date in Melbourne');
select is(private.new_assignment_send_before(null, '2026-10-26 01:00Z'), timestamptz '2026-11-02 01:00Z',
  'With no due date: 7 days after publishing');


-- AC-8.10: the new switches default on --------------------------------------------------------
insert into public.notification_settings (profile_id) values ('00000000-0000-0000-0000-0000000006a4');
select results_eq(
  $$ select work_returned, new_assignment, due_tomorrow from public.notification_settings
     where profile_id = '00000000-0000-0000-0000-0000000006a4' $$,
  $$ values (true, true, true) $$,
  'A new settings row has all three switches on');
delete from public.notification_settings where profile_id = '00000000-0000-0000-0000-0000000006a4';
select col_hasnt_default('public', 'email_outbox', 'send_before',
  'send_before has no default: only the new kinds set one');


-- One recipient function for every kind (ADR-0008 decision 3) -------------------------------
create function pg_temp.recipients(target_kind text, target_student uuid, queued_due_on date default null)
returns setof uuid language sql as $$
  select r.profile_id from private.email_recipients(
    target_kind, '00000000-0000-0000-0000-00000000e805', target_student, queued_due_on) r
  order by 1
$$;
create temporary table kid_one_people (id uuid);
insert into kid_one_people values
  ('00000000-0000-0000-0000-0000000005a1'), ('00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-0000000006a2');

select results_eq($$ select pg_temp.recipients('new_assignment', '00000000-0000-0000-0000-00000000d001') $$,
  $$ select id from kid_one_people order by 1 $$,
  'new_assignment: the active student and both active parents (parent3 is deactivated)');
select results_eq(
  $$ select pg_temp.recipients('due_tomorrow', '00000000-0000-0000-0000-00000000d001',
                               (select today + 1 from melbourne)) $$,
  $$ select id from kid_one_people order by 1 $$,
  'due_tomorrow: the same people, for the due date it was queued for');
select is_empty(
  $$ select pg_temp.recipients('due_tomorrow', '00000000-0000-0000-0000-00000000d001',
                               (select today + 2 from melbourne)) $$,
  'due_tomorrow: nobody once the due date differs from the queued one (AC-8.8)');
select is_empty(
  $$ select pg_temp.recipients('due_tomorrow', '00000000-0000-0000-0000-00000000d001') $$,
  'due_tomorrow: nobody without a queued due date');
select results_eq($$ select pg_temp.recipients('work_returned', '00000000-0000-0000-0000-00000000d001') $$,
  $$ select id from kid_one_people order by 1 $$,
  'work_returned: the same people while the work is readable (ADR-0007)');
select is_empty($$ select pg_temp.recipients('something_else', '00000000-0000-0000-0000-00000000d001') $$,
  'An unknown kind has no recipients');
select results_eq($$ select pg_temp.recipients('new_assignment', '00000000-0000-0000-0000-00000000d006') $$,
  $$ values ('00000000-0000-0000-0000-0000000006a2'::uuid) $$,
  'Kid Six: only parent2, as Kid Six and parent6 turned the switch off');
select is_empty($$ select pg_temp.recipients('new_assignment', '00000000-0000-0000-0000-00000000d002') $$,
  'Roster-only Kid Two: nobody (AC-8.11)');
select is_empty($$ select pg_temp.recipients('new_assignment', '00000000-0000-0000-0000-00000000d003') $$,
  'Invited Kid Three: nobody (AC-8.11)');
select results_eq($$ select pg_temp.recipients('new_assignment', '00000000-0000-0000-0000-00000000d004') $$,
  $$ values ('00000000-0000-0000-0000-0000000006a4'::uuid) $$,
  'Deactivated Kid Four: only their active parent');
select is_empty($$ select pg_temp.recipients('new_assignment', '00000000-0000-0000-0000-00000000d005') $$,
  'Kid Five, whose only parent is deactivated: nobody (AC-8.11)');

-- Each switch controls only its own kind (AC-8.10).
insert into public.notification_settings (profile_id, work_returned, new_assignment, due_tomorrow)
values ('00000000-0000-0000-0000-0000000006a1', true, false, true);
select results_eq($$ select pg_temp.recipients('new_assignment', '00000000-0000-0000-0000-00000000d001') $$,
  $$ select id from kid_one_people where id <> '00000000-0000-0000-0000-0000000006a1' order by 1 $$,
  'parent1''s "new work" switch off: no new_assignment email for them...');
select results_eq(
  $$ select pg_temp.recipients('due_tomorrow', '00000000-0000-0000-0000-00000000d001',
                               (select today + 1 from melbourne)) $$,
  $$ select id from kid_one_people order by 1 $$,
  '...but they still get due_tomorrow');
update public.notification_settings set new_assignment = true, due_tomorrow = false
where profile_id = '00000000-0000-0000-0000-0000000006a1';
select results_eq(
  $$ select pg_temp.recipients('due_tomorrow', '00000000-0000-0000-0000-00000000d001',
                               (select today + 1 from melbourne)) $$,
  $$ select id from kid_one_people where id <> '00000000-0000-0000-0000-0000000006a1' order by 1 $$,
  'parent1''s "due tomorrow" switch off: no reminder for them...');
select results_eq($$ select pg_temp.recipients('new_assignment', '00000000-0000-0000-0000-00000000d001') $$,
  $$ select id from kid_one_people order by 1 $$,
  '...but they still get new_assignment');
delete from public.notification_settings where profile_id = '00000000-0000-0000-0000-0000000006a1';

-- due_tomorrow follows the hand-in status: not started and in progress count, handed in doesn't.
insert into public.assignment_results (assignment_id, student_id, status)
values ('00000000-0000-0000-0000-00000000e805', '00000000-0000-0000-0000-00000000d001', 'in_progress');
select results_eq(
  $$ select pg_temp.recipients('due_tomorrow', '00000000-0000-0000-0000-00000000d001',
                               (select today + 1 from melbourne)) $$,
  $$ select id from kid_one_people order by 1 $$,
  'due_tomorrow: in progress still counts as not handed in (AC-8.5)');
update public.assignment_results set status = 'submitted'
where assignment_id = '00000000-0000-0000-0000-00000000e805' and student_id = '00000000-0000-0000-0000-00000000d001';
select is_empty(
  $$ select pg_temp.recipients('due_tomorrow', '00000000-0000-0000-0000-00000000d001',
                               (select today + 1 from melbourne)) $$,
  'due_tomorrow: nobody once it''s handed in (AC-8.6)');
delete from public.assignment_results where assignment_id = '00000000-0000-0000-0000-00000000e805';
delete from public.email_outbox;


-- Helpers for the queue cases ----------------------------------------------------------------
-- Act as tutor 1 (class one) or tutor 2 (class two), then come back as the test superuser with no
-- signed-in user, so later result rows count as system changes, not staff ones.
create function pg_temp.as_system() returns void language sql as $$
  reset role;
  select set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.publish(target_assignment uuid, tutor uuid default '00000000-0000-0000-0000-0000000000b1')
returns int language plpgsql as $$
declare
  changed int;
begin
  perform tests.authenticate_as(tutor);
  update public.assignments set status = 'published' where id = target_assignment;
  get diagnostics changed = row_count;
  perform pg_temp.as_system();
  return changed;
end;
$$;
create function pg_temp.unpublish(target_assignment uuid) returns void language plpgsql as $$
begin
  perform tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
  update public.assignments set status = 'draft' where id = target_assignment;
  perform pg_temp.as_system();
end;
$$;

-- Who class one's new work goes to: Kid One's three people, Kid Four's active parent, and parent2
-- for Kid Six (Kid Six and parent6 have the switch off). Nobody for Kid Two, Three or Five.
create temporary table class_one_recipients (student_id uuid, recipient_id uuid, recipient_role text);
insert into class_one_recipients values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000005a1', 'student'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000006a1', 'parent'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000006a2', 'parent'),
  ('00000000-0000-0000-0000-00000000d004', '00000000-0000-0000-0000-0000000006a4', 'parent'),
  ('00000000-0000-0000-0000-00000000d006', '00000000-0000-0000-0000-0000000006a2', 'parent');


-- AC-8.1: publishing queues one email per recipient per enrolled student ---------------------
select is(pg_temp.publish('00000000-0000-0000-0000-00000000e801'), 1, 'Tutor 1 publishes the online work');
select results_eq(
  $$ select * from pg_temp.queued('new_assignment', '00000000-0000-0000-0000-00000000e801') $$,
  $$ select * from class_one_recipients order by student_id, recipient_id $$,
  'Online: the active student, each active parent, and parent2 once per child (AC-8.1)');
select results_eq(
  $$ select distinct status, attempts::int, send_before from public.email_outbox
     where assignment_id = '00000000-0000-0000-0000-00000000e801' $$,
  $$ select 'pending', 0, private.melbourne_day_start(today + 6) from melbourne $$,
  'Each row is pending, untried, with send_before at the end of the due date (Melbourne)');

select is(pg_temp.publish('00000000-0000-0000-0000-00000000e802'), 1, 'Tutor 1 publishes the paper work');
select results_eq(
  $$ select * from pg_temp.queued('new_assignment', '00000000-0000-0000-0000-00000000e802') $$,
  $$ select * from class_one_recipients order by student_id, recipient_id $$,
  'Paper homework queues the same recipients (AC-8.1)');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
insert into public.assignments (class_id, title, max_mark, status) values -- tutors can't choose the id
  ('00000000-0000-0000-0000-00000000c001', 'Straight to published', 10, 'published');
select pg_temp.as_system();
create temporary table straight as select id from public.assignments where title = 'Straight to published';
select results_eq(
  $$ select * from pg_temp.queued('new_assignment', (select id from straight)) $$,
  $$ select * from class_one_recipients order by student_id, recipient_id $$,
  'An assignment inserted straight as published queues too');
select results_eq(
  $$ select distinct o.send_before, a.published_at + interval '7 days' from public.email_outbox o
     join public.assignments a on a.id = o.assignment_id
     where o.assignment_id = (select id from straight) $$,
  $$ select a.published_at + interval '7 days', a.published_at + interval '7 days'
     from public.assignments a where a.id = (select id from straight) $$,
  'With no due date, send_before is 7 days after publishing');
select is_empty(
  $$ select 1 from public.email_outbox o join public.profiles p on p.id = o.recipient_id
     where p.role not in ('student', 'parent')
        or o.recipient_id in ('00000000-0000-0000-0000-0000000006a3', '00000000-0000-0000-0000-0000000005a4',
                              '00000000-0000-0000-0000-0000000005a6', '00000000-0000-0000-0000-0000000006a6') $$,
  'Tutors, admins, deactivated accounts and switched-off people are never queued (AC-8.11)');
select is_empty(
  $$ select 1 from public.email_outbox where status = 'failed' $$,
  'Nobody without a recipient is recorded as a failure (AC-8.11)');

-- Editing a published assignment (not its status) queues nothing more.
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
update public.assignments set title = 'Online due soon (edited)' where id = '00000000-0000-0000-0000-00000000e801';
select pg_temp.as_system();
select is((select count(*)::int from public.email_outbox where assignment_id = '00000000-0000-0000-0000-00000000e801'),
  5, 'Editing published work queues nothing more');


-- AC-8.3: republishing never notifies --------------------------------------------------------
select pg_temp.unpublish('00000000-0000-0000-0000-00000000e801');
select is((select status from public.assignments where id = '00000000-0000-0000-0000-00000000e801'), 'draft',
  'Tutor 1 moves the work back to draft before anyone starts');
select is(pg_temp.publish('00000000-0000-0000-0000-00000000e801'), 1, 'and publishes it again');
select results_eq(
  $$ select * from pg_temp.queued('new_assignment', '00000000-0000-0000-0000-00000000e801') $$,
  $$ select * from class_one_recipients order by student_id, recipient_id $$,
  'Still exactly the original rows: no second email, within the 90-day outbox retention as AC-3.5 (AC-8.3)');


-- AC-8.4: later joiners get nothing, and nothing is queued already expired ------------------
select tests.create_family_account('00000000-0000-0000-0000-0000000005a7', 'kid7@test.local', 'student');
insert into public.students (id, full_name, year_level, profile_id, consent_recorded_at, consent_source) values
  ('00000000-0000-0000-0000-00000000d007', 'Kid Seven', 8, '00000000-0000-0000-0000-0000000005a7', now(), 'admin');
insert into public.enrolments (class_id, student_id) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d007');
select is_empty(
  $$ select 1 from public.email_outbox where student_id = '00000000-0000-0000-0000-00000000d007' $$,
  'A student enrolled after publishing gets no "new assignment" email for that work (AC-8.4)');
select is(pg_temp.publish('00000000-0000-0000-0000-00000000e803'), 1, 'Tutor 1 publishes the no-due-date work');
select results_eq(
  $$ select recipient_id from public.email_outbox
     where assignment_id = '00000000-0000-0000-0000-00000000e803' and student_id = '00000000-0000-0000-0000-00000000d007' $$,
  $$ values ('00000000-0000-0000-0000-0000000005a7'::uuid) $$,
  'but does get one for work published after they joined');

insert into public.assignments (id, class_id, title, due_on, max_mark) values
  ('00000000-0000-0000-0000-00000000e807', '00000000-0000-0000-0000-00000000c001', 'Already overdue',
   (select today - 1 from melbourne), 10),
  ('00000000-0000-0000-0000-00000000e808', '00000000-0000-0000-0000-00000000c001', 'Due today',
   (select today from melbourne), 10);
select is(pg_temp.publish('00000000-0000-0000-0000-00000000e807'), 1, 'Work due yesterday is published');
select is_empty(
  $$ select 1 from public.email_outbox where assignment_id = '00000000-0000-0000-0000-00000000e807' $$,
  'and queues nothing, so there''s never a false Failed row (AC-8.4)');
select is(pg_temp.publish('00000000-0000-0000-0000-00000000e808'), 1, 'Work due today is published');
select results_eq(
  $$ select count(*)::int, min(send_before) from public.email_outbox
     where assignment_id = '00000000-0000-0000-0000-00000000e808' $$,
  $$ select 6, private.melbourne_day_start(today + 1) from melbourne $$,
  'and still queues, until midnight at the end of today (AC-8.4)');


-- AC-8.15: nobody can queue for work they can't publish ------------------------------------
insert into public.assignments (id, class_id, title, max_mark) values
  ('00000000-0000-0000-0000-00000000e809', '00000000-0000-0000-0000-00000000c001', 'Tutor two tries', 10);
select is(pg_temp.publish('00000000-0000-0000-0000-00000000e809', '00000000-0000-0000-0000-0000000000b2'), 0,
  'Tutor 2 can''t publish class one''s draft');
select is_empty(
  $$ select 1 from public.email_outbox where assignment_id = '00000000-0000-0000-0000-00000000e809' $$,
  'so nothing is queued for it (AC-8.15)');
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select throws_ok(
  $$ insert into public.email_outbox (kind, assignment_id, student_id, recipient_id, recipient_role)
     values ('new_assignment', '00000000-0000-0000-0000-00000000e809', '00000000-0000-0000-0000-00000000d001',
             '00000000-0000-0000-0000-0000000005a1', 'student') $$,
  '42501', null, 'A student can''t write to the outbox');
select throws_ok($$ select id from public.email_outbox $$, '42501', null, 'or read it');
select throws_ok($$ select private.queue_due_tomorrow_emails_for(current_date) $$, '42501', null,
  'or run the reminder queue');
select pg_temp.as_system();
select tests.authenticate_as('00000000-0000-0000-0000-0000000006a1');
select throws_ok($$ select id from public.email_outbox $$, '42501', null, 'A parent can''t read the outbox');
select pg_temp.as_system();
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ insert into public.email_outbox (kind, assignment_id, student_id, recipient_id, recipient_role)
     values ('new_assignment', '00000000-0000-0000-0000-00000000e809', '00000000-0000-0000-0000-00000000d001',
             '00000000-0000-0000-0000-0000000005a1', 'student') $$,
  '42501', null, 'Nor can a tutor');
select pg_temp.as_system();


-- AC-8.12: publishing never fails because of email -----------------------------------------
savepoint cap_zero;
create or replace function private.email_daily_cap()
returns int language sql immutable set search_path = '' as $$ select 0 $$;
insert into public.assignments (id, class_id, title, max_mark) values
  ('00000000-0000-0000-0000-00000000e810', '00000000-0000-0000-0000-00000000c001', 'Cap is full', 10);
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$ update public.assignments set status = 'published' where id = '00000000-0000-0000-0000-00000000e810' $$,
  'With the daily cap used up, publishing still succeeds (AC-8.12)');
select pg_temp.as_system();
delete from vault.secrets where name = 'notify_worker_secret';
insert into public.assignments (id, class_id, title, max_mark) values
  ('00000000-0000-0000-0000-00000000e811', '00000000-0000-0000-0000-00000000c001', 'No worker secret', 10);
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$ update public.assignments set status = 'published' where id = '00000000-0000-0000-0000-00000000e811' $$,
  'With no worker secret in Vault, publishing still succeeds (AC-8.12)');
select pg_temp.as_system();
select private.kick_email_worker();
select results_eq(
  $$ select distinct status from public.email_outbox where assignment_id = '00000000-0000-0000-0000-00000000e811' $$,
  $$ values ('pending') $$, 'and its rows wait, pending, nothing lost');
rollback to savepoint cap_zero;


-- AC-8.11: no-recipient classes publish and run the daily queue without error ---------------
savepoint no_recipients;
delete from public.student_guardians
where student_id = '00000000-0000-0000-0000-00000000d006' and parent_id = '00000000-0000-0000-0000-0000000006a2';
insert into public.enrolments (class_id, student_id) values
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d002'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d003'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d005'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d006');
update public.assignments set due_on = (select today + 1 from melbourne)
where id = '00000000-0000-0000-0000-00000000e804';
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b2');
select lives_ok($$ update public.assignments set status = 'published' where id = '00000000-0000-0000-0000-00000000e804' $$,
  'Tutor 2 publishes to a class of roster-only, invited, parentless and switched-off students');
select pg_temp.as_system();
update public.assignments set published_at = now() - interval '3 days' where id = '00000000-0000-0000-0000-00000000e804';
select lives_ok($$ select private.queue_due_tomorrow_emails_for((select today from melbourne)) $$,
  'and the daily reminder queue runs for it');
select is_empty(
  $$ select 1 from public.email_outbox where assignment_id = '00000000-0000-0000-0000-00000000e804' $$,
  'Neither queues anything (AC-8.11)');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select is_empty($$ select id from public.admin_email_problems() $$,
  'and the admin list stays empty (AC-8.11)');
select pg_temp.as_system();
rollback to savepoint no_recipients;


-- AC-8.5 / AC-8.6: the daily reminder queue --------------------------------------------------
-- e805 is online and due tomorrow; it was published during set-up, i.e. today.
delete from public.email_outbox;
select private.queue_due_tomorrow_emails_for((select today from melbourne));
select is_empty($$ select 1 from public.email_outbox $$,
  'Published today, the day before it''s due: no reminder; the "new assignment" email covers it (AC-8.6)');

update public.assignments set published_at = (select private.melbourne_day_start(today - 1) + interval '12 hours' from melbourne)
where id = '00000000-0000-0000-0000-00000000e805';
select private.queue_due_tomorrow_emails_for((select today from melbourne));
select results_eq(
  $$ select * from pg_temp.queued('due_tomorrow', '00000000-0000-0000-0000-00000000e805') $$,
  $$ select * from class_one_recipients
     union all select '00000000-0000-0000-0000-00000000d007', '00000000-0000-0000-0000-0000000005a7', 'student'
     order by 1, 2 $$,
  'Published yesterday (Melbourne): reminders for each recipient of each student not handed in (AC-8.5)');
select results_eq(
  $$ select distinct status, send_before from public.email_outbox where kind = 'due_tomorrow' $$,
  $$ select 'pending', private.melbourne_day_start(today + 1) from melbourne $$,
  'Each is pending, with send_before at the start of the due date (AC-8.7)');
select is(
  (select count(*)::int from public.email_outbox where student_id = '00000000-0000-0000-0000-00000000d007'),
  1, 'Kid Seven, enrolled after publishing, is reminded too (only "new assignment" skips later joiners)');
select private.queue_due_tomorrow_emails_for((select today from melbourne));
select is((select count(*)::int from public.email_outbox where kind = 'due_tomorrow'), 6,
  'A second run the same day adds nothing (unique key)');

-- Hand-in status at queue time
delete from public.email_outbox;
insert into public.assignment_results (assignment_id, student_id, status) values
  ('00000000-0000-0000-0000-00000000e805', '00000000-0000-0000-0000-00000000d001', 'in_progress'),
  ('00000000-0000-0000-0000-00000000e805', '00000000-0000-0000-0000-00000000d004', 'submitted');
select private.queue_due_tomorrow_emails_for((select today from melbourne));
select is((select count(*)::int from public.email_outbox where student_id = '00000000-0000-0000-0000-00000000d001'), 3,
  'In progress: still reminded (AC-8.5)');
select is((select count(*)::int from public.email_outbox where student_id = '00000000-0000-0000-0000-00000000d004'), 0,
  'Handed in: no reminder (AC-8.6)');
delete from public.assignment_results where assignment_id = '00000000-0000-0000-0000-00000000e805';
delete from public.email_outbox;

-- Not sent: no due date, paper, a due date that isn't tomorrow
update public.assignments set published_at = now() - interval '3 days'
where id in ('00000000-0000-0000-0000-00000000e802', '00000000-0000-0000-0000-00000000e803');
update public.assignments set due_on = (select today + 1 from melbourne)
where id = '00000000-0000-0000-0000-00000000e802';
select private.queue_due_tomorrow_emails_for((select today from melbourne));
select is((select count(*)::int from public.email_outbox where assignment_id = '00000000-0000-0000-0000-00000000e803'), 0,
  'No due date: no reminder (AC-8.6)');
select is((select count(*)::int from public.email_outbox where assignment_id = '00000000-0000-0000-0000-00000000e802'), 0,
  'Paper homework due tomorrow: no reminder (AC-8.6)');
select is((select count(*)::int from public.email_outbox where assignment_id = '00000000-0000-0000-0000-00000000e801'), 0,
  'Online work due in 5 days: no reminder yet');
select is((select count(*)::int from public.email_outbox where assignment_id = '00000000-0000-0000-0000-00000000e805'), 6,
  'Only the online work due tomorrow is reminded');

-- Draft work due tomorrow is never reminded.
select pg_temp.unpublish('00000000-0000-0000-0000-00000000e805');
delete from public.email_outbox;
select private.queue_due_tomorrow_emails_for((select today from melbourne));
select is_empty($$ select 1 from public.email_outbox $$, 'Draft work: no reminder');
select pg_temp.publish('00000000-0000-0000-0000-00000000e805');
update public.assignments set published_at = now() - interval '3 days' where id = '00000000-0000-0000-0000-00000000e805';
delete from public.email_outbox;


-- The cron entry: hourly at :10, acting only in the 3 pm hour --------------------------------
select results_eq(
  $$ select schedule, command, active from cron.job where jobname = 'due-tomorrow-reminders' $$,
  $$ values ('10 * * * *', 'select private.queue_due_tomorrow_emails()', true) $$,
  'cron.job has due-tomorrow-reminders, hourly at 10 past');
select private.queue_due_tomorrow_emails();
select is(
  (select count(*)::int from public.email_outbox where kind = 'due_tomorrow'),
  case when private.is_reminder_hour(now()) then 6 else 0 end,
  'The cron entry queues today''s reminders only in the Melbourne 3 pm hour (whatever hour this runs in)');
delete from public.email_outbox;


-- The claim: supported kinds, order, deadline and re-checks (ADR-0008 decisions 2, 5, 6) ----
create temporary table all_kinds (kinds text[]);
insert into all_kinds values (array['work_returned', 'new_assignment', 'due_tomorrow']);
grant select on all_kinds to service_role;

-- Hand-made rows for Kid One. Each is still relevant, so the claim's skip step leaves it pending:
-- e801 is published and visible; e805 is online, due tomorrow, published 3 days ago, not handed in.
create function pg_temp.add_row(
  row_kind text, target_assignment uuid, recipient uuid, row_created timestamptz,
  row_send_before timestamptz default null)
returns uuid language sql as $$
  insert into public.email_outbox
    (kind, assignment_id, student_id, recipient_id, recipient_role, created_at, send_before)
  values (row_kind, target_assignment, '00000000-0000-0000-0000-00000000d001', recipient,
          case when recipient = '00000000-0000-0000-0000-0000000005a1' then 'student' else 'parent' end,
          row_created, row_send_before)
  returning id
$$;

-- AC-8.14: reminders first, then oldest first, under one shared cap
delete from public.email_outbox;
select pg_temp.add_row('work_returned', '00000000-0000-0000-0000-00000000e801', '00000000-0000-0000-0000-0000000005a1',
  now() - interval '3 hours');
select pg_temp.add_row('new_assignment', '00000000-0000-0000-0000-00000000e801', '00000000-0000-0000-0000-0000000006a1',
  now() - interval '2 hours', (select private.melbourne_day_start(today + 6) from melbourne));
select pg_temp.add_row('due_tomorrow', '00000000-0000-0000-0000-00000000e805', '00000000-0000-0000-0000-0000000006a2',
  now() - interval '1 hour', (select private.melbourne_day_start(today + 1) from melbourne));

create function pg_temp.claim_kinds(cap int) returns text[] language plpgsql as $$
declare
  claimed text[];
begin
  execute format('create or replace function private.email_daily_cap() returns int language sql immutable '
                 'set search_path = '''' as %L', format('select %s', cap));
  set local role service_role;
  select array_agg(c.kind) into claimed
  from public.notify_claim_emails((select kinds from all_kinds)) c;
  reset role;
  update public.email_outbox set status = 'pending', attempts = 0, claimed_at = null;
  return claimed;
end;
$$;
select is(pg_temp.claim_kinds(3), array['due_tomorrow', 'work_returned', 'new_assignment'],
  'Cap 3: the reminder first, then work returned (oldest), then new assignment (AC-8.14)');
select is(pg_temp.claim_kinds(2), array['due_tomorrow', 'work_returned'],
  'Cap 2: the reminder and the oldest other row');
select is(pg_temp.claim_kinds(1), array['due_tomorrow'], 'Cap 1: the reminder only');
create or replace function private.email_daily_cap()
returns int language sql immutable set search_path = '' as $$ select 70 $$;

-- Deploy order (ADR-0008 decision 6): today's worker calls with no argument.
set local role service_role;
create temporary table old_worker_claim on commit drop as select * from public.notify_claim_emails();
reset role;
select results_eq($$ select kind from old_worker_claim $$, $$ values ('work_returned') $$,
  'With no argument (today''s worker) the claim takes only work_returned rows');
select results_eq(
  $$ select kind, status from public.email_outbox order by created_at $$,
  $$ values ('work_returned', 'sending'), ('new_assignment', 'pending'), ('due_tomorrow', 'pending') $$,
  'and leaves the new kinds pending for the new worker');
update public.email_outbox set status = 'pending', attempts = 0, claimed_at = null;

-- What the new worker gets: kind and due date, and still no mark, feedback or instructions.
set local role service_role;
create temporary table new_worker_claim on commit drop as
  select * from public.notify_claim_emails((select kinds from all_kinds));
reset role;
select results_eq(
  $$ select kind, recipient_role, email, child_first_name, assignment_title, class_name, due_on
     from new_worker_claim order by kind $$,
  $$ select * from (values
       ('due_tomorrow', 'parent', 'parent2@test.local', 'Kid', 'Recipient check', 'Class one', (select today + 1 from melbourne)),
       ('new_assignment', 'parent', 'parent1@test.local', 'Kid', 'Online due soon (edited)', 'Class one', (select today + 5 from melbourne)),
       ('work_returned', 'student', 'kid1@test.local', 'Kid', 'Online due soon (edited)', 'Class one', (select today + 5 from melbourne))
     ) v order by 1 $$,
  'The claim returns each row''s kind and the due date for its template (AC-8.2, AC-8.9)');


-- AC-8.7: never late. Expired rows aren't claimed, and the kick fails them as too_late -------
delete from public.email_outbox;
insert into public.assignments (id, class_id, title, due_on) values
  ('00000000-0000-0000-0000-00000000e812', '00000000-0000-0000-0000-00000000c001', 'Due today online',
   (select today from melbourne));
insert into public.assignment_questions (assignment_id, kind, prompt, options, correct_option, marks) values
  ('00000000-0000-0000-0000-00000000e812', 'multiple_choice', 'Pick A', '{A,B}', 0, 1);
select pg_temp.publish('00000000-0000-0000-0000-00000000e812');
-- Work due yesterday, its due date never changed: its "new assignment" deadline (the start of the
-- day after the due date, so midnight this morning) has passed (review-5 item 8 round 3).
insert into public.assignments (id, class_id, title, due_on, max_mark) values
  ('00000000-0000-0000-0000-00000000e815', '00000000-0000-0000-0000-00000000c001', 'Due yesterday',
   (select today - 1 from melbourne), 10);
select pg_temp.publish('00000000-0000-0000-0000-00000000e815');
delete from public.email_outbox;
-- A reminder for work due today: its deadline (midnight this morning) has passed.
select pg_temp.add_row('due_tomorrow', '00000000-0000-0000-0000-00000000e812', '00000000-0000-0000-0000-0000000006a1',
  now() - interval '20 hours', (select private.melbourne_day_start(today) from melbourne));
select pg_temp.add_row('new_assignment', '00000000-0000-0000-0000-00000000e815', '00000000-0000-0000-0000-0000000006a2',
  now() - interval '3 days', (select private.melbourne_day_start(today) from melbourne));
select pg_temp.add_row('work_returned', '00000000-0000-0000-0000-00000000e801', '00000000-0000-0000-0000-0000000005a1',
  now() - interval '5 days');
set local role service_role;
select results_eq($$ select kind from public.notify_claim_emails((select kinds from all_kinds)) $$,
  $$ values ('work_returned') $$,
  'The claim skips both rows past their deadline (AC-8.7)');
reset role;
update public.email_outbox set status = 'pending', attempts = 0, claimed_at = null;
select private.kick_email_worker();
select results_eq(
  $$ select kind, status, reason from public.email_outbox order by kind $$,
  $$ values ('due_tomorrow', 'failed', 'too_late'), ('new_assignment', 'failed', 'too_late'),
            ('work_returned', 'pending', null::text) $$,
  'The kick fails both as too_late; a work_returned row (no deadline) is untouched (AC-8.7)');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select results_eq(
  $$ select kind, state, reason from public.admin_email_problems() order by kind $$,
  $$ values ('due_tomorrow', 'failed', 'too_late'), ('new_assignment', 'failed', 'too_late'),
            ('work_returned', 'waiting', 'not_attempted') $$,
  'Admins see both as Failed / too_late, with their kind (AC-8.7, AC-8.13); the old work_returned row waits');
select pg_temp.as_system();

-- The sweep runs even when the cap is full (it comes before the kick's early returns).
delete from public.email_outbox;
select pg_temp.add_row('new_assignment', '00000000-0000-0000-0000-00000000e815', '00000000-0000-0000-0000-0000000006a2',
  now() - interval '3 days', (select private.melbourne_day_start(today) from melbourne));
create or replace function private.email_daily_cap()
returns int language sql immutable set search_path = '' as $$ select 0 $$;
select private.kick_email_worker();
select is((select reason from public.email_outbox), 'too_late',
  'With the daily cap full, the kick still fails an expired row as too_late');
create or replace function private.email_daily_cap()
returns int language sql immutable set search_path = '' as $$ select 70 $$;

-- Past their deadline but no longer relevant: skipped, not "too late", even with the cap full
-- (review-5 item 8, finding 1; AC-8.3, AC-8.6, 03b §8.3).
savepoint stale_rows;
delete from public.email_outbox;
create or replace function private.email_daily_cap()
returns int language sql immutable set search_path = '' as $$ select 0 $$;
-- Kid One handed in e812 (due today) after the reminder was queued; Kid Four didn't.
insert into public.assignment_results (assignment_id, student_id, status)
values ('00000000-0000-0000-0000-00000000e812', '00000000-0000-0000-0000-00000000d001', 'submitted');
select pg_temp.add_row('due_tomorrow', '00000000-0000-0000-0000-00000000e812', '00000000-0000-0000-0000-0000000006a1',
  now() - interval '20 hours', (select private.melbourne_day_start(today) from melbourne));
insert into public.email_outbox (kind, assignment_id, student_id, recipient_id, recipient_role, created_at, send_before)
values ('due_tomorrow', '00000000-0000-0000-0000-00000000e812', '00000000-0000-0000-0000-00000000d004',
        '00000000-0000-0000-0000-0000000006a4', 'parent', now() - interval '20 hours',
        (select private.melbourne_day_start(today) from melbourne));
-- A "new assignment" row for work moved back to draft, and one for a student who left the class.
insert into public.assignments (id, class_id, title, max_mark) values
  ('00000000-0000-0000-0000-00000000e814', '00000000-0000-0000-0000-00000000c001', 'Pulled back early', 10);
select pg_temp.publish('00000000-0000-0000-0000-00000000e814');
select pg_temp.unpublish('00000000-0000-0000-0000-00000000e814');
delete from public.email_outbox where assignment_id = '00000000-0000-0000-0000-00000000e814';
select pg_temp.add_row('new_assignment', '00000000-0000-0000-0000-00000000e814', '00000000-0000-0000-0000-0000000005a1',
  now() - interval '8 days', now() - interval '1 minute');
insert into public.email_outbox (kind, assignment_id, student_id, recipient_id, recipient_role, created_at, send_before)
values ('new_assignment', '00000000-0000-0000-0000-00000000e815', '00000000-0000-0000-0000-00000000d007',
        '00000000-0000-0000-0000-0000000005a7', 'student', now() - interval '3 days',
        (select private.melbourne_day_start(today) from melbourne));
delete from public.enrolments
where class_id = '00000000-0000-0000-0000-00000000c001' and student_id = '00000000-0000-0000-0000-00000000d007';
select private.kick_email_worker();
select results_eq(
  $$ select kind, assignment_id::text, recipient_id::text, status, reason from public.email_outbox
     order by kind, assignment_id, recipient_id $$,
  $$ values
       ('due_tomorrow', '00000000-0000-0000-0000-00000000e812', '00000000-0000-0000-0000-0000000006a1', 'skipped', null::text),
       ('due_tomorrow', '00000000-0000-0000-0000-00000000e812', '00000000-0000-0000-0000-0000000006a4', 'failed', 'too_late'),
       ('new_assignment', '00000000-0000-0000-0000-00000000e814', '00000000-0000-0000-0000-0000000005a1', 'skipped', null::text),
       ('new_assignment', '00000000-0000-0000-0000-00000000e815', '00000000-0000-0000-0000-0000000005a7', 'skipped', null::text) $$,
  'Cap full: handed in, back to draft and left the class end skipped; the still-relevant reminder ends too_late');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select results_eq(
  $$ select kind, recipient_role, state, reason from public.admin_email_problems() $$,
  $$ values ('due_tomorrow', 'parent', 'failed', 'too_late') $$,
  'Admins see only the still-relevant one, as Too late to send; skipped rows aren''t listed');
select pg_temp.as_system();
rollback to savepoint stale_rows;


-- AC-8.13: every kind reaches the admin list with its type ---------------------------------
delete from public.email_outbox;
select pg_temp.add_row('work_returned', '00000000-0000-0000-0000-00000000e801', '00000000-0000-0000-0000-0000000005a1',
  now() - interval '3 hours');
select pg_temp.add_row('new_assignment', '00000000-0000-0000-0000-00000000e801', '00000000-0000-0000-0000-0000000006a1',
  now() - interval '4 hours', (select private.melbourne_day_start(today + 6) from melbourne));
select pg_temp.add_row('due_tomorrow', '00000000-0000-0000-0000-00000000e805', '00000000-0000-0000-0000-0000000006a2',
  now() - interval '5 hours', (select private.melbourne_day_start(today + 1) from melbourne));
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select results_eq(
  $$ select kind, state, reason from public.admin_email_problems() $$,
  $$ values ('work_returned', 'waiting', 'not_attempted'), ('new_assignment', 'waiting', 'not_attempted'),
            ('due_tomorrow', 'waiting', 'not_attempted') $$,
  'Waiting rows of every kind are listed, newest first, with their kind (AC-8.13)');
select pg_temp.as_system();
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select * from public.admin_email_problems() $$, '42501', 'not_admin',
  'A tutor is still refused the admin list');
select pg_temp.as_system();


-- AC-8.3 (claim): back to draft before the send means skipped, not failed --------------------
delete from public.email_outbox;
insert into public.assignments (id, class_id, title, due_on, max_mark) values
  ('00000000-0000-0000-0000-00000000e813', '00000000-0000-0000-0000-00000000c001', 'Pulled back',
   (select today + 4 from melbourne), 10);
select pg_temp.publish('00000000-0000-0000-0000-00000000e813');
select is((select count(*)::int from public.email_outbox where assignment_id = '00000000-0000-0000-0000-00000000e813'),
  6, 'Publishing queues the class''s "new assignment" rows');
select pg_temp.unpublish('00000000-0000-0000-0000-00000000e813');
set local role service_role;
select is_empty(
  $$ select 1 from public.notify_claim_emails((select kinds from all_kinds))
     where assignment_id = '00000000-0000-0000-0000-00000000e813' $$,
  'Back to draft before the send: the claim returns none of them (AC-8.3)');
reset role;
select results_eq(
  $$ select distinct status from public.email_outbox where assignment_id = '00000000-0000-0000-0000-00000000e813' $$,
  $$ values ('skipped') $$, 'They end skipped');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select is_empty($$ select 1 from public.admin_email_problems() $$, 'and aren''t shown to admins (AC-8.3)');
select pg_temp.as_system();
select pg_temp.publish('00000000-0000-0000-0000-00000000e813');
select results_eq(
  $$ select status, count(*)::int from public.email_outbox
     where assignment_id = '00000000-0000-0000-0000-00000000e813' group by status $$,
  $$ values ('skipped', 6) $$,
  'Republishing adds no rows, even though the first emails were skipped (AC-8.3, within the 90-day retention)');


-- AC-8.4 (claim): a "new assignment" email re-dated into the past is never sent (test plan P3) -
savepoint redated;
delete from public.email_outbox;
select pg_temp.add_row('new_assignment', '00000000-0000-0000-0000-00000000e801', '00000000-0000-0000-0000-0000000006a1',
  now() - interval '1 hour', (select private.melbourne_day_start(today + 6) from melbourne));
update public.assignments set due_on = (select today - 1 from melbourne)
where id = '00000000-0000-0000-0000-00000000e801';
set local role service_role;
select is_empty($$ select 1 from public.notify_claim_emails((select kinds from all_kinds)) $$,
  'Re-dated to yesterday after queueing: the claim doesn''t return it (AC-8.4)');
reset role;
select results_eq($$ select status, reason from public.email_outbox $$, $$ values ('skipped', null::text) $$,
  'It ends skipped, not failed');
update public.email_outbox set status = 'pending';
update public.assignments set due_on = (select today from melbourne)
where id = '00000000-0000-0000-0000-00000000e801';
set local role service_role;
select results_eq($$ select kind from public.notify_claim_emails((select kinds from all_kinds)) $$,
  $$ values ('new_assignment') $$,
  'Re-dated to today: it still goes out, until the end of the due date');
reset role;

-- The kick's skip step agrees with the claim: re-dated to yesterday means skipped, even with the
-- cap full, so it's never shown as "Too late to send".
delete from public.email_outbox;
select pg_temp.add_row('new_assignment', '00000000-0000-0000-0000-00000000e801', '00000000-0000-0000-0000-0000000006a1',
  now() - interval '1 hour', (select private.melbourne_day_start(today + 6) from melbourne));
update public.assignments set due_on = (select today - 1 from melbourne)
where id = '00000000-0000-0000-0000-00000000e801';
create or replace function private.email_daily_cap()
returns int language sql immutable set search_path = '' as $$ select 0 $$;
select private.kick_email_worker();
select results_eq($$ select status, reason from public.email_outbox $$, $$ values ('skipped', null::text) $$,
  'Kick: re-dated to yesterday after queueing ends skipped, not too_late (AC-8.4)');
create or replace function private.email_daily_cap()
returns int language sql immutable set search_path = '' as $$ select 70 $$;

-- Natural expiry is not a re-date: work due yesterday whose due date never changed. The claim
-- leaves it pending (it's past its deadline, so not claimed), and the kick fails it as too_late
-- (AC-8.7, review-5 item 8 round 3).
delete from public.email_outbox;
select pg_temp.add_row('new_assignment', '00000000-0000-0000-0000-00000000e815', '00000000-0000-0000-0000-0000000006a1',
  now() - interval '3 days', (select private.melbourne_day_start(today) from melbourne));
set local role service_role;
select is_empty($$ select 1 from public.notify_claim_emails((select kinds from all_kinds)) $$,
  'Expired with its due date unchanged: the claim doesn''t return it');
reset role;
select results_eq($$ select status, reason from public.email_outbox $$, $$ values ('pending', null::text) $$,
  'and doesn''t skip it either');
select private.kick_email_worker();
select results_eq($$ select status, reason from public.email_outbox $$, $$ values ('failed', 'too_late') $$,
  'The kick fails it as too_late, so admins see "Too late to send" (AC-8.7)');
rollback to savepoint redated;


-- AC-8.6 (claim): handed in after queueing ---------------------------------------------------
delete from public.email_outbox;
select private.queue_due_tomorrow_emails_for((select today from melbourne));
select is((select count(*)::int from public.email_outbox where student_id = '00000000-0000-0000-0000-00000000d001'),
  3, 'Kid One''s three reminders are queued');
insert into public.assignment_results (assignment_id, student_id, status)
values ('00000000-0000-0000-0000-00000000e805', '00000000-0000-0000-0000-00000000d001', 'submitted');
set local role service_role;
select is_empty(
  $$ select 1 from public.notify_claim_emails((select kinds from all_kinds))
     where student_id = '00000000-0000-0000-0000-00000000d001' $$,
  'Handed in before the send: the claim skips Kid One''s reminders (AC-8.6)');
reset role;
select results_eq(
  $$ select distinct status from public.email_outbox where student_id = '00000000-0000-0000-0000-00000000d001' $$,
  $$ values ('skipped') $$, 'They end skipped, not failed');
insert into public.assignment_answers (assignment_id, question_id, student_id, selected_option, awarded_marks)
select q.assignment_id, q.id, '00000000-0000-0000-0000-00000000d001', 0, 1
from public.assignment_questions q where q.assignment_id = '00000000-0000-0000-0000-00000000e805';
update public.assignment_results set status = 'returned'
where assignment_id = '00000000-0000-0000-0000-00000000e805' and student_id = '00000000-0000-0000-0000-00000000d001';
select is_empty(
  $$ select 1 from private.email_recipients('due_tomorrow', '00000000-0000-0000-0000-00000000e805',
       '00000000-0000-0000-0000-00000000d001', (select today + 1 from melbourne)) $$,
  'Returned work isn''t reminded either (AC-8.6)');
delete from public.assignment_answers where assignment_id = '00000000-0000-0000-0000-00000000e805';
delete from public.assignment_results where assignment_id = '00000000-0000-0000-0000-00000000e805';


-- AC-8.8: at most one reminder, even if the due date changes --------------------------------
delete from public.email_outbox;
select private.queue_due_tomorrow_emails_for((select today from melbourne));
update public.assignments set due_on = (select today + 3 from melbourne)
where id = '00000000-0000-0000-0000-00000000e805';
set local role service_role;
select is_empty(
  $$ select 1 from public.notify_claim_emails((select kinds from all_kinds)) where kind = 'due_tomorrow' $$,
  'The due date moved after queueing: the claim skips the reminders (AC-8.8)');
reset role;
select private.queue_due_tomorrow_emails_for((select today + 2 from melbourne));
select results_eq(
  $$ select status, count(*)::int from public.email_outbox where kind = 'due_tomorrow' group by status $$,
  $$ values ('skipped', 6) $$,
  'The eve of the new due date queues no second reminder (AC-8.8, within the 90-day retention)');
update public.assignments set due_on = (select today + 1 from melbourne)
where id = '00000000-0000-0000-0000-00000000e805';


-- AC-8.15: only the worker can claim ------------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select throws_ok($$ select public.notify_claim_emails(array['due_tomorrow']) $$, '42501', null,
  'A student can''t claim emails of any kind');
select pg_temp.as_system();
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok($$ select public.notify_claim_emails(array['new_assignment']) $$, '42501', null,
  'Nor can an admin');
select pg_temp.as_system();
select ok(not has_function_privilege('authenticated', 'public.notify_claim_emails(text[])', 'execute'),
  'authenticated has no execute on notify_claim_emails(text[])');
select ok(has_function_privilege('service_role', 'public.notify_claim_emails(text[])', 'execute'),
  'service_role has');
select ok(has_function_privilege('authenticated', 'public.admin_email_problems(int)', 'execute'),
  'authenticated can still call admin_email_problems (the function checks admin)');
select ok(not has_function_privilege('anon', 'public.admin_email_problems(int)', 'execute'),
  'anon can''t');
select hasnt_function('private', 'work_returned_recipients', array['uuid', 'uuid'],
  'The old work_returned_recipients helper is gone');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and p.proname in ('reminder_hour', 'melbourne_date', 'melbourne_day_start', 'is_reminder_hour',
                       'new_assignment_send_before', 'email_still_relevant', 'email_recipients',
                       'queue_new_assignment_emails', 'queue_due_tomorrow_emails_for', 'queue_due_tomorrow_emails')
     and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))),
  0, 'None of the new private helpers is executable by authenticated or anon');


select * from finish();
rollback;
