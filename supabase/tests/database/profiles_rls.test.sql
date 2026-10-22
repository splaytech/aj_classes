-- Access rules for profiles and audit_log (design §7.1–7.2, stories US12, US19, US20).

begin;
select no_plan();
select tests.remove_all_accounts();

select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor1@test.local');
select tests.create_staff('00000000-0000-0000-0000-0000000000b2', 'tutor2@test.local');
select tests.create_staff('00000000-0000-0000-0000-0000000000c1', 'gone@test.local', p_active => false);
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');
insert into public.audit_log (action, target_id) values ('invite_sent', '00000000-0000-0000-0000-0000000000b1');


-- Tutor ---------------------------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');

select results_eq(
  $$ select email from public.profiles $$,
  $$ values ('tutor1@test.local') $$,
  'A tutor sees only their own profile'
);

select lives_ok(
  $$ update public.profiles
     set full_name = 'Tutor One', bio = 'Hi', subjects = '{maths}', qualifications = '{"B.Ed"}'
     where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'A tutor can edit their own name, bio, subjects and qualifications'
);

select is_empty(
  $$ update public.profiles set bio = 'hacked'
     where id = '00000000-0000-0000-0000-0000000000b2' returning id $$,
  'A tutor cannot edit another tutor''s profile'
);

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'A tutor cannot make themselves admin'
);

select throws_ok(
  $$ update public.profiles set is_active = true where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'A tutor cannot change their active status'
);

select throws_ok(
  $$ update public.profiles set email = 'x@test.local' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'A tutor cannot change the email copy'
);

select throws_ok(
  $$ insert into public.profiles (id, email) values (gen_random_uuid(), 'new@test.local') $$,
  '42501', null, 'Nobody inserts profiles through the API'
);

select throws_ok(
  $$ delete from public.profiles where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'Nobody deletes profiles through the API'
);

select is_empty($$ select id from public.audit_log $$, 'A tutor cannot read the audit log');

select throws_ok(
  $$ insert into public.audit_log (action) values ('deactivated') $$,
  '42501', null, 'A tutor cannot write to the audit log'
);

reset role;


-- Field rules (as the tutor, on their own row) -------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');

select throws_ok(
  $$ update public.profiles set bio = repeat('x', 1001) where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null, 'Bio is limited to 1000 characters'
);

select throws_ok(
  $$ update public.profiles set subjects = '{"Maths!"}' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null, 'Subjects must be keys such as maths'
);

select throws_ok(
  $$ update public.profiles set qualifications = array_fill('B.Ed'::text, array[11])
     where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null, 'At most 10 qualifications'
);

select throws_ok(
  $$ update public.profiles set qualifications = '{" "}' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null, 'A qualification cannot be blank'
);

select throws_ok(
  $$ update public.profiles set avatar_path = '00000000-0000-0000-0000-0000000000b2/me.webp'
     where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null, 'A photo path must be in the person''s own folder'
);

select throws_ok(
  $$ update public.profiles set avatar_path = '00000000-0000-0000-0000-0000000000b1/../x.webp'
     where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null, 'A photo path cannot climb out of the folder'
);

reset role;


-- Deactivated tutor ------------------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');

select is_empty($$ select id from public.profiles $$, 'A deactivated tutor cannot read anything');

select is_empty(
  $$ update public.profiles set bio = 'still here'
     where id = '00000000-0000-0000-0000-0000000000c1' returning id $$,
  'A deactivated tutor cannot edit their profile'
);

reset role;


-- Admin without two-step (aal1) --------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal1');

select results_eq(
  $$ select email from public.profiles $$,
  $$ values ('admin@test.local') $$,
  'An admin without a two-step session sees only their own profile'
);

select is_empty($$ select id from public.audit_log $$, 'An admin without two-step cannot read the audit log');

reset role;


-- Admin with two-step (aal2) ----------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');

select is(
  (select count(*)::int from public.profiles), 4,
  'An admin with two-step sees every profile, including deactivated ones'
);

select isnt_empty(
  $$ update public.profiles set bio = 'Edited by admin'
     where id = '00000000-0000-0000-0000-0000000000b2' returning id $$,
  'An admin can edit another staff profile'
);

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b2' $$,
  '42501', null, 'Even an admin changes roles only through admin_set_role'
);

select isnt_empty($$ select id from public.audit_log $$, 'An admin with two-step can read the audit log');

reset role;


-- Signed-out visitor --------------------------------------------------------
select tests.authenticate_as_anon();

select throws_ok($$ select id from public.profiles $$, '42501', null, 'Visitors cannot read profiles');
select throws_ok($$ select id from public.audit_log $$, '42501', null, 'Visitors cannot read the audit log');

reset role;

select * from finish();
rollback;
