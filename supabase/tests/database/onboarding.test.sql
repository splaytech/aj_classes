-- Invite onboarding (docs/requirements/invite-onboarding.md): an invited account sees nothing
-- until complete_onboarding() makes it active; the form's fields depend on the server-side role.

begin;
select no_plan();
select tests.remove_all_accounts();
select tests.remove_all_classes();

-- Invited (clicked the link, so e-mail confirmed and signed in, but not finished):
--   tutor t1, student s1 (on the roster), parent p1. And a deactivated invited tutor t2.
select tests.create_staff('00000000-0000-0000-0000-0000000000f1', 'newtutor@test.local', p_joined => false);
select tests.create_staff('00000000-0000-0000-0000-0000000000f2', 'gone@test.local', p_joined => false, p_active => false);
select tests.create_family_account('00000000-0000-0000-0000-0000000005f1', 'newkid@test.local', 'student', p_joined => false);
select tests.create_family_account('00000000-0000-0000-0000-0000000006f1', 'newparent@test.local', 'parent', p_joined => false);
update auth.users set email_confirmed_at = now(), last_sign_in_at = now()
where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000005f1',
             '00000000-0000-0000-0000-0000000006f1', '00000000-0000-0000-0000-0000000000f2');

insert into public.students (id, full_name, year_level, profile_id, consent_recorded_at, consent_source) values
  ('00000000-0000-0000-0000-00000000df01', 'New Kid', 7, '00000000-0000-0000-0000-0000000005f1', now(), 'admin');

-- ---------------------------------------------------------------------------
-- Invited accounts can't see anything
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000f1');
select is_empty(
  $$ select 1 from public.profiles $$,
  'An invited tutor cannot read profiles, not even their own'
);
select is(private.is_active_staff(), false, 'An invited tutor is not active staff');
select throws_ok(
  $$ update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-0000000000f1' $$,
  '42501', null,
  'Nobody can set their own status directly'
);
reset role;

-- my_student_id is private (not callable by users), so check it as the owner with their claims.
select tests.authenticate_as('00000000-0000-0000-0000-0000000005f1');
reset role;
select is(private.my_student_id(), null, 'An invited student has no student access');

-- ---------------------------------------------------------------------------
-- my_onboarding: what the form needs, decided on the server
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000f1');
select results_eq(
  $$ select role::text, email, year_level from public.my_onboarding() $$,
  $$ values ('tutor', 'newtutor@test.local', null::smallint) $$,
  'An invited tutor gets their role and e-mail'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000005f1');
select results_eq(
  $$ select role::text, year_level from public.my_onboarding() $$,
  $$ values ('student', 7::smallint) $$,
  'An invited student gets their roster year level to start from'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000f2');
select is_empty($$ select * from public.my_onboarding() $$, 'A deactivated invite gets nothing');
select throws_ok(
  $$ select public.complete_onboarding('Gone Tutor', '0412 345 678', null, true) $$,
  '42501', 'not_invited',
  'A deactivated invite cannot activate itself'
);
reset role;

select tests.authenticate_as_anon();
select throws_ok(
  $$ select public.complete_onboarding('Nobody', null, null, true) $$,
  '42501', null,
  'Signed-out callers cannot run complete_onboarding'
);
reset role;

-- ---------------------------------------------------------------------------
-- complete_onboarding: tutor
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok(
  $$ select public.complete_onboarding('New Tutor', '0412 345 678', null, true) $$,
  'password_not_set',
  'No activation before the password is saved'
);
reset role;
update auth.users set encrypted_password = 'bcrypt-hash' where id = '00000000-0000-0000-0000-0000000000f1';

select tests.authenticate_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok(
  $$ select public.complete_onboarding('New Tutor', '0412 345 678', null, false) $$,
  'terms_required', 'Terms must be accepted'
);
select throws_ok(
  $$ select public.complete_onboarding('N', '0412 345 678', null, true) $$,
  'invalid_name', 'The name must be 2–100 characters'
);
select throws_ok(
  $$ select public.complete_onboarding('New Tutor', null, null, true) $$,
  'invalid_phone', 'Staff must give a phone number'
);
select throws_ok(
  $$ select public.complete_onboarding('New Tutor', '12345', null, true) $$,
  'invalid_phone', 'The phone number must be Australian'
);
select throws_ok(
  $$ select public.complete_onboarding('New Tutor', '0412 345 678', '8', true) $$,
  'invalid_input', 'A tutor cannot send a year level'
);
select lives_ok(
  $$ select public.complete_onboarding('  New Tutor  ', '(04) 1234-5678', null, true) $$,
  'A tutor with valid details is activated'
);
select results_eq(
  $$ select status::text, full_name, phone, joined_at is not null, terms_accepted_at is not null
     from public.profiles where id = '00000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('active', 'New Tutor', '+61412345678', true, true) $$,
  'Active, name trimmed, phone stored as +61, joined and terms times set'
);
select is(private.is_active_staff(), true, 'The tutor now has staff access');
select throws_ok(
  $$ select public.complete_onboarding('Again', '0412 345 678', null, true) $$,
  '42501', 'not_invited',
  'Onboarding cannot run twice'
);
reset role;

select results_eq(
  $$ select action, target_id, details from public.audit_log where actor_id = '00000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('account_activated', '00000000-0000-0000-0000-0000000000f1'::uuid, '{"role": "tutor"}'::jsonb) $$,
  'Activation is audited'
);

-- ---------------------------------------------------------------------------
-- complete_onboarding: student and parent
-- ---------------------------------------------------------------------------

update auth.users set encrypted_password = 'bcrypt-hash'
where id in ('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000006f1');

select tests.authenticate_as('00000000-0000-0000-0000-0000000005f1');
select throws_ok(
  $$ select public.complete_onboarding('New Kid', null, null, true) $$,
  'invalid_year_level', 'A student must choose a year level'
);
select throws_ok(
  $$ select public.complete_onboarding('New Kid', null, '13', true) $$,
  'invalid_year_level', 'Only Years 2–12 or other'
);
select throws_ok(
  $$ select public.complete_onboarding('New Kid', '0412 345 678', '9', true) $$,
  'invalid_input', 'A student cannot send a phone number'
);
select lives_ok(
  $$ select public.complete_onboarding('New Kid', null, '9', true) $$,
  'A student with a year level is activated'
);
reset role;
select is(private.my_student_id(), '00000000-0000-0000-0000-00000000df01'::uuid, 'The student now has access');
select is(
  (select year_level from public.students where id = '00000000-0000-0000-0000-00000000df01'),
  9::smallint,
  'The chosen year level is saved to the roster'
);

select tests.authenticate_as('00000000-0000-0000-0000-0000000006f1');
select throws_ok(
  $$ select public.complete_onboarding('New Parent', null, '9', true) $$,
  'invalid_input', 'A parent cannot send a year level'
);
select lives_ok(
  $$ select public.complete_onboarding('New Parent', null, null, true) $$,
  'A parent needs only name, password and terms'
);
select is(private.my_active_role()::text, 'parent', 'The parent now has access');
reset role;

-- ---------------------------------------------------------------------------
-- Status and joined_at can never disagree
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.profiles set joined_at = null where id = '00000000-0000-0000-0000-0000000006f1' $$,
  '23514', null,
  'An active account must have joined_at'
);

select * from finish();
rollback;
