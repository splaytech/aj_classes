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

delete from public.email_outbox; -- nothing above is published, but keep the start clean

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


select * from finish();
rollback;
