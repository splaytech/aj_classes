-- Website enquiries (leads-and-crm.md §2): admins with two-step only; nobody writes directly.

begin;
select no_plan();
select tests.remove_all_accounts();
delete from public.enquiries;

select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor@test.local');
select tests.create_family_account('00000000-0000-0000-0000-0000000000c1', 'parent@test.local', 'parent');

insert into public.enquiries (id, name, email, phone, message) values
  ('00000000-0000-0000-0000-00000000e001', 'Priya Parent', 'priya@test.local', '0400 000 000', 'Year 7 selective prep?'),
  ('00000000-0000-0000-0000-00000000e002', 'Sam Smith', 'sam@test.local', null, null);

-- Checks on the data itself
select throws_ok(
  $$ insert into public.enquiries (name, email) values ('A', 'a@test.local') $$,
  '23514', null, 'A one-letter name is refused');
select throws_ok(
  $$ insert into public.enquiries (name, email, message) values ('Al Ng', 'al@test.local', repeat('x', 2001)) $$,
  '23514', null, 'A message over 2000 characters is refused');
select throws_ok(
  $$ insert into public.enquiries (name, email, crm_status) values ('Al Ng', 'al@test.local', 'done') $$,
  '23514', null, 'Only known Bigin statuses are allowed');

-- Visitors
select tests.authenticate_as_anon();
select throws_ok($$ select * from public.enquiries $$, '42501', null, 'Visitors cannot read enquiries');
select throws_ok(
  $$ insert into public.enquiries (name, email) values ('Spam Bot', 'bot@test.local') $$,
  '42501', null, 'Visitors cannot add enquiries directly (only the function can)');
select throws_ok($$ select * from public.enquiry_rate_limits $$, '42501', null,
  'Visitors cannot see the rate-limit table');
reset role;

-- Tutor, parent, admin without two-step
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.enquiries), 0, 'Tutors see no enquiries');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.enquiries), 0, 'Parents see no enquiries');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal1');
select is((select count(*)::int from public.enquiries), 0, 'An admin without two-step sees no enquiries');
reset role;

-- Admin with two-step
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select is((select count(*)::int from public.enquiries), 2, 'Admins with two-step see every enquiry');
select throws_ok(
  $$ update public.enquiries set crm_status = 'synced' $$,
  '42501', null, 'Admins cannot edit enquiries directly (retries go through the function)');
select throws_ok(
  $$ insert into public.enquiries (name, email) values ('Made Up', 'made@test.local') $$,
  '42501', null, 'Admins cannot add enquiries directly');
delete from public.enquiries where id = '00000000-0000-0000-0000-00000000e002';
select is((select count(*)::int from public.enquiries), 1, 'Admins can delete an enquiry (privacy requests)');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
delete from public.enquiries;
reset role;
select is((select count(*)::int from public.enquiries), 1, 'A tutor''s delete removes nothing');

select * from finish();
rollback;
