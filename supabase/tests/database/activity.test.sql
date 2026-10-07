-- Admin activity list (R2a US19, page added with R3a).

begin;
select no_plan();
select tests.remove_all_accounts();

select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor1@test.local');

insert into public.audit_log (actor_id, action, target_id, details) values
  ('00000000-0000-0000-0000-0000000000a1', 'role_changed', '00000000-0000-0000-0000-0000000000b1', '{"from":"tutor","to":"admin"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'invite_cancelled', null, '{"email":"typo@test.local"}');

select ok(
  not has_function_privilege('anon', 'public.admin_list_activity(int)', 'execute'),
  'Visitors cannot call the activity list');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select * from public.admin_list_activity() $$, '42501', 'not_admin',
  'A tutor cannot read the activity list');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal1');
select throws_ok($$ select * from public.admin_list_activity() $$, '42501', 'not_admin',
  'An admin without two-step cannot read the activity list');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select results_eq(
  $$ select action, actor_name, target_name from public.admin_list_activity() order by action $$,
  $$ values ('invite_cancelled', 'Test admin', 'typo@test.local'),
            ('role_changed', 'Test admin', 'Test tutor1') $$,
  'Admins see who did what to whom; a cancelled invite shows the e-mail it was sent to');
select is((select count(*)::int from public.admin_list_activity(1)), 1, 'The row limit is applied');
reset role;

select * from finish();
rollback;
