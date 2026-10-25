-- Item 4: staff change their phone on My profile; admins correct it (01b AC-4.2–4.7, 03b §4.7).

begin;
select no_plan();
select tests.remove_all_accounts();

-- a1 admin (two-step), b1 tutor with a phone, b2 tutor with none (joined before onboarding),
-- c1 deactivated tutor, c2 invited tutor, s1 student, p1 parent.
select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor1@test.local');
select tests.create_staff('00000000-0000-0000-0000-0000000000b2', 'tutor2@test.local');
select tests.create_staff('00000000-0000-0000-0000-0000000000c1', 'gone@test.local', p_active => false);
select tests.create_staff('00000000-0000-0000-0000-0000000000c2', 'invited@test.local', p_joined => false);
select tests.create_family_account('00000000-0000-0000-0000-0000000005a1', 'kid@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000006a1', 'parent@test.local', 'parent');
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');

-- Phones are set as superuser, the way onboarding would have left them.
update public.profiles set phone = '+61412345678'
where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
             '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');

-- Saved by the test, so a cleared phone can be put back between cases.
create function pg_temp.b1_phone() returns text language sql as $$
  select phone from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'
$$;

-- ---------------------------------------------------------------------------
-- AC-4.2: accepted formats are stored as +61…
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');

select results_eq(
  $$ update public.profiles set phone = '0412 345 679'
     where id = '00000000-0000-0000-0000-0000000000b1' returning phone $$,
  $$ values ('+61412345679') $$,
  'A mobile with spaces is stored as +61'
);
select results_eq(
  $$ update public.profiles set phone = '0412-345-678'
     where id = '00000000-0000-0000-0000-0000000000b1' returning phone $$,
  $$ values ('+61412345678') $$,
  'A mobile with hyphens is stored as +61'
);
select results_eq(
  $$ update public.profiles set phone = '(03) 9876 5432'
     where id = '00000000-0000-0000-0000-0000000000b1' returning phone $$,
  $$ values ('+61398765432') $$,
  'A Melbourne landline with brackets is stored as +61'
);
select results_eq(
  $$ update public.profiles set phone = '(08) 8123 4567'
     where id = '00000000-0000-0000-0000-0000000000b1' returning phone $$,
  $$ values ('+61881234567') $$,
  'An area code 8 landline is stored as +61'
);
select results_eq(
  $$ update public.profiles set phone = '+61 2 9876 5432'
     where id = '00000000-0000-0000-0000-0000000000b1' returning phone $$,
  $$ values ('+61298765432') $$,
  'A +61 number with spaces is stored without them'
);
reset role;

-- Back to the starting number for the rest of the file.
update public.profiles set phone = '+61412345678' where id = '00000000-0000-0000-0000-0000000000b1';

-- ---------------------------------------------------------------------------
-- AC-4.3: anything else is refused, and nothing changes
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ update public.profiles set phone = '0512345678' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'P0001', 'invalid_phone', 'A number with an unused prefix is refused'
);
select throws_ok(
  $$ update public.profiles set phone = '041234567' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'P0001', 'invalid_phone', 'Too few digits is refused'
);
select throws_ok(
  $$ update public.profiles set phone = '04123456789' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'P0001', 'invalid_phone', 'Too many digits is refused'
);
select throws_ok(
  $$ update public.profiles set phone = '0412abc678' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'P0001', 'invalid_phone', 'Letters are refused'
);
select throws_ok(
  $$ update public.profiles set phone = '+1 202 555 0100' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'P0001', 'invalid_phone', 'A non-Australian number is refused'
);
select throws_ok(
  $$ update public.profiles set full_name = 'Changed Name', phone = 'nope'
     where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'P0001', 'invalid_phone', 'A bad phone in a whole-form save is refused'
);
select is(pg_temp.b1_phone(), '+61412345678', 'After the refusals the phone is unchanged');
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'Test tutor1',
  'A bad phone saves none of the other fields either (AC-4.5)'
);

-- ---------------------------------------------------------------------------
-- AC-4.4: a saved number can't be cleared; no number yet is fine
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.profiles set phone = '' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'P0001', 'phone_required', 'An empty phone over a saved one is refused'
);
select throws_ok(
  $$ update public.profiles set phone = '   ' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'P0001', 'phone_required', 'A blank phone over a saved one is refused'
);
select throws_ok(
  $$ update public.profiles set phone = null where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'P0001', 'phone_required', 'A null phone over a saved one is refused'
);
select lives_ok(
  $$ update public.profiles set phone = '0412 345 678', bio = 'Same number'
     where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'The same number in another format saves'
);
select is(pg_temp.b1_phone(), '+61412345678', 'The same number in another format is stored as before');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b2');
select lives_ok(
  $$ update public.profiles set full_name = 'Tutor Two', phone = ''
     where id = '00000000-0000-0000-0000-0000000000b2' $$,
  'A tutor with no phone yet can save other fields with the phone left blank'
);
reset role;
select results_eq(
  $$ select full_name, phone from public.profiles where id = '00000000-0000-0000-0000-0000000000b2' $$,
  $$ values ('Tutor Two', null::text) $$,
  'Their name saved and their phone is still empty'
);

-- ---------------------------------------------------------------------------
-- AC-4.7: who can change a phone
-- ---------------------------------------------------------------------------

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select is_empty(
  $$ update public.profiles set phone = '0499 999 999'
     where id = '00000000-0000-0000-0000-0000000000b2' returning id $$,
  'A tutor cannot change another person''s phone'
);
select is_empty(
  $$ select phone from public.profiles where id = '00000000-0000-0000-0000-0000000000b2' $$,
  'A tutor cannot read another person''s phone'
);
select throws_ok(
  $$ update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'status is still not writable directly'
);
select throws_ok(
  $$ update public.profiles set terms_accepted_at = now() where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'terms_accepted_at is still not writable directly'
);
select throws_ok(
  $$ update public.profiles set password_set_at = now() where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'password_set_at is still not writable directly'
);
reset role;
select is(
  (select phone from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'),
  null,
  'The other tutor''s phone is unchanged'
);

select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select is_empty(
  $$ update public.profiles set phone = '0412 345 678'
     where id = '00000000-0000-0000-0000-0000000005a1' returning id $$,
  'A student cannot set a phone on their own profile'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000006a1');
select is_empty(
  $$ update public.profiles set phone = '0412 345 678'
     where id = '00000000-0000-0000-0000-0000000006a1' returning id $$,
  'A parent cannot set a phone on their own profile'
);
select is_empty(
  $$ update public.profiles set phone = '0412 345 678'
     where id = '00000000-0000-0000-0000-0000000000b1' returning id $$,
  'A parent cannot change a tutor''s phone'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select is_empty(
  $$ update public.profiles set phone = '0499 999 999'
     where id = '00000000-0000-0000-0000-0000000000c1' returning id $$,
  'A deactivated tutor cannot change their phone'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000c2');
select is_empty(
  $$ update public.profiles set phone = '0499 999 999'
     where id = '00000000-0000-0000-0000-0000000000c2' returning id $$,
  'An invited tutor cannot change their phone outside the setup form'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal1');
select is_empty(
  $$ update public.profiles set phone = '0499 999 999'
     where id = '00000000-0000-0000-0000-0000000000b1' returning id $$,
  'An admin without two-step cannot change a tutor''s phone'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok(
  $$ update public.profiles set phone = '0412 345 678' where id = '00000000-0000-0000-0000-0000000005a1' $$,
  'P0001', 'invalid_input', 'Even an admin cannot give a student a phone'
);
select throws_ok(
  $$ update public.profiles set phone = '0412 345 678' where id = '00000000-0000-0000-0000-0000000006a1' $$,
  'P0001', 'invalid_input', 'Even an admin cannot give a parent a phone'
);
select lives_ok(
  $$ update public.profiles set full_name = 'Test kid', phone = ''
     where id = '00000000-0000-0000-0000-0000000005a1' $$,
  'A blank phone on a family profile is not a change, so the admin''s other edits save'
);
reset role;

select is(
  (select count(*)::int from public.profiles
   where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2')
     and phone = '+61412345678'),
  2,
  'The deactivated and invited tutors'' phones are unchanged'
);
select is(
  (select count(*)::int from public.profiles
   where id in ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000006a1')
     and phone is null),
  2,
  'Family profiles still hold no phone'
);

-- ---------------------------------------------------------------------------
-- AC-4.6: an admin's change is audited by field name only; self-edits are not
-- ---------------------------------------------------------------------------

delete from public.audit_log;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok(
  $$ update public.profiles set phone = '(03) 9876 5432' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'An admin with two-step can correct a tutor''s phone'
);
select results_eq(
  $$ select phone from public.admin_list_staff('00000000-0000-0000-0000-0000000000b1') $$,
  $$ values ('+61398765432') $$,
  'The staff list shows the new number'
);
reset role;

select is(
  (select count(*)::int from public.audit_log where action = 'profile_edited_by_admin'),
  1,
  'One admin profile edit is recorded'
);
select ok(
  (select details->'fields' ? 'phone' from public.audit_log where action = 'profile_edited_by_admin'),
  'The audit row names the phone field'
);
select ok(
  (select details::text !~ '[0-9]' from public.audit_log where action = 'profile_edited_by_admin'),
  'The audit row holds no digits of the number'
);

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(
  $$ update public.profiles set phone = '0412 345 678' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'The tutor changes their own phone back'
);
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok(
  $$ update public.profiles set phone = '0400 111 222' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'The admin changes their own phone'
);
reset role;
select is(
  (select count(*)::int from public.audit_log),
  1,
  'Changing your own phone writes no audit row, tutor or admin'
);

-- ---------------------------------------------------------------------------
-- updated_at, and the trigger function is not callable
-- ---------------------------------------------------------------------------

update public.profiles set updated_at = now() - interval '1 day'
where id = '00000000-0000-0000-0000-0000000000b1';
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
update public.profiles set phone = '0412 345 670' where id = '00000000-0000-0000-0000-0000000000b1';
reset role;
select ok(
  (select updated_at > now() - interval '1 hour' from public.profiles
   where id = '00000000-0000-0000-0000-0000000000b1'),
  'A phone change moves updated_at'
);

select ok(
  not has_function_privilege('authenticated', 'private.check_profile_phone()', 'execute')
  and not has_function_privilege('anon', 'private.check_profile_phone()', 'execute'),
  'Nobody can call the phone check directly'
);

select * from finish();
rollback;
