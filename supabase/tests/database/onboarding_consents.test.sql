-- Optional consents (invite-onboarding.md, "Consents"): separate from the Terms, parents only,
-- withdrawable, every change logged.

begin;
select no_plan();
select tests.remove_all_accounts();
select tests.remove_all_classes();

-- Invited (signed in, password chosen, not finished): parent p1, parent p2, tutor t1, student s1.
select tests.create_family_account('00000000-0000-0000-0000-0000000006c1', 'parent1@test.local', 'parent', p_joined => false);
select tests.create_family_account('00000000-0000-0000-0000-0000000006c2', 'parent2@test.local', 'parent', p_joined => false);
select tests.create_staff('00000000-0000-0000-0000-0000000000c1', 'tutor@test.local', p_joined => false);
select tests.create_family_account('00000000-0000-0000-0000-0000000005c1', 'kid@test.local', 'student', p_joined => false);
insert into public.students (id, full_name, year_level, profile_id, consent_recorded_at, consent_source) values
  ('00000000-0000-0000-0000-00000000dc01', 'Kid', 7, '00000000-0000-0000-0000-0000000005c1', now(), 'admin');
update auth.users set email_confirmed_at = now(), last_sign_in_at = now(), encrypted_password = 'bcrypt-hash'
where id in ('00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-0000000006c2',
             '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000005c1');

-- ---------------------------------------------------------------------------
-- Setup form: only parents are offered the choices
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  $$ select public.complete_onboarding('New Tutor', '0412 345 678', null, true, true, false, false) $$,
  'invalid_input', 'A tutor cannot agree to marketing on the setup form (not offered)'
);
select throws_ok(
  $$ select public.complete_onboarding('New Tutor', '0412 345 678', null, true, false, true, false) $$,
  'invalid_input', 'A tutor cannot agree to results publicity (not offered)'
);
select lives_ok(
  $$ select public.complete_onboarding('New Tutor', '0412 345 678', null, true) $$,
  'A tutor finishes setup without the optional choices'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000005c1');
select throws_ok(
  $$ select public.complete_onboarding('Kid', null, '7', true, false, false, true) $$,
  'invalid_input', 'A student (a minor) cannot agree to publicity'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000006c1');
select throws_ok(
  $$ select public.complete_onboarding('Parent One', null, null, false, true, true, true) $$,
  'terms_required', 'The optional choices do not replace the Terms'
);
select lives_ok(
  $$ select public.complete_onboarding('Parent One', null, null, true, true, true, false) $$,
  'A parent can agree to some choices and not others'
);
reset role;

select ok(
  (select marketing_consent_at is not null and results_publicity_consent_at is not null
          and video_publicity_consent_at is null
   from public.profiles where id = '00000000-0000-0000-0000-0000000006c1'),
  'Each choice is saved on its own: marketing yes, results yes, video no'
);
select is(
  (select details from public.audit_log
   where action = 'account_activated' and target_id = '00000000-0000-0000-0000-0000000006c1'),
  '{"role": "parent", "marketing": true, "results_publicity": true, "video_publicity": false}'::jsonb,
  'The activation log records what was agreed'
);

select tests.authenticate_as('00000000-0000-0000-0000-0000000006c2');
select lives_ok(
  $$ select public.complete_onboarding('Parent Two', null, null, true) $$,
  'A parent can skip every optional choice'
);
reset role;
select ok(
  (select marketing_consent_at is null and results_publicity_consent_at is null
          and video_publicity_consent_at is null
   from public.profiles where id = '00000000-0000-0000-0000-0000000006c2'),
  'Nothing is assumed: no choice means no consent'
);

-- ---------------------------------------------------------------------------
-- Nobody writes the columns directly
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000006c2');
select throws_ok(
  $$ update public.profiles set video_publicity_consent_at = now()
     where id = '00000000-0000-0000-0000-0000000006c2' $$,
  '42501', null, 'A parent cannot set a consent column directly'
);
reset role;

-- ---------------------------------------------------------------------------
-- set_my_consents: change your mind later
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000006c1');
select lives_ok(
  $$ select public.set_my_consents(true, false, true) $$,
  'A parent can withdraw one choice and add another'
);
reset role;
select ok(
  (select marketing_consent_at is not null and results_publicity_consent_at is null
          and video_publicity_consent_at is not null
   from public.profiles where id = '00000000-0000-0000-0000-0000000006c1'),
  'Withdrawing clears the time; agreeing sets it; unchanged choices stay'
);
select is(
  (select details from public.audit_log
   where action = 'consent_changed' and target_id = '00000000-0000-0000-0000-0000000006c1'),
  '{"results_publicity": false, "video_publicity": true}'::jsonb,
  'Only the choices that changed are logged'
);

select tests.authenticate_as('00000000-0000-0000-0000-0000000006c1');
select lives_ok($$ select public.set_my_consents(true, false, true) $$, 'Saving the same choices again works');
reset role;
select is(
  (select count(*)::int from public.audit_log
   where action = 'consent_changed' and target_id = '00000000-0000-0000-0000-0000000006c1'),
  1, 'Saving without a change adds no log entry'
);

select tests.authenticate_as('00000000-0000-0000-0000-0000000006c1');
select throws_ok(
  $$ select public.set_my_consents(null, false, false) $$,
  'invalid_input', 'Each choice must be yes or no'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  $$ select public.set_my_consents(true, true, true) $$,
  '42501', null, 'A tutor cannot set parent choices'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000005c1');
select throws_ok(
  $$ select public.set_my_consents(false, true, true) $$,
  '42501', null, 'A student cannot set parent choices'
);
reset role;

update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000006c2';
select tests.authenticate_as('00000000-0000-0000-0000-0000000006c2');
select throws_ok(
  $$ select public.set_my_consents(true, true, true) $$,
  '42501', null, 'A deactivated parent cannot change choices'
);
reset role;

select ok(
  not has_function_privilege('anon', 'public.set_my_consents(boolean, boolean, boolean)', 'execute'),
  'Signed-out visitors cannot call set_my_consents'
);

select * from finish();
rollback;
