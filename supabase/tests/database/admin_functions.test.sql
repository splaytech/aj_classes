-- Admin functions: roles, active status, guards and audit (design §6.3, stories US14, US16, US17, US19).

begin;
select no_plan();
select tests.remove_all_accounts();

select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin1@test.local', 'admin');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor1@test.local');
select tests.create_staff('00000000-0000-0000-0000-0000000000d1', 'pending@test.local', p_joined => false);
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');


-- Who may call them -----------------------------------------------------------
-- Checked with has_function_privilege rather than by calling: in the local Postgres 17.6 image,
-- a "permission denied for function" error in a psql session crashes the server (the API path is
-- fine). See supabase/README.md, "Known local issues".
select ok(
  not has_function_privilege('anon', 'public.admin_set_role(uuid, public.app_role)', 'execute')
  and not has_function_privilege('anon', 'public.admin_set_active(uuid, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.admin_list_staff(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.am_i_admin()', 'execute'),
  'Visitors cannot call admin functions'
);
select ok(
  not has_function_privilege('authenticated', 'public.admin_log(uuid, text, uuid, jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.admin_log(uuid, text, uuid, jsonb)', 'execute'),
  'Only the edge function (secret key) can write audit entries directly'
);
select ok(
  not has_function_privilege('authenticated', 'private.is_last_active_admin(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.lock_admin_changes()', 'execute')
  and not has_function_privilege('anon', 'private.is_admin()', 'execute'),
  'Internal helpers are not callable by app users'
);

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select is(public.am_i_admin(), false, 'A tutor is not an admin');
select throws_ok(
  $$ select public.admin_set_role('00000000-0000-0000-0000-0000000000b1', 'admin') $$,
  '42501', 'not_admin', 'A tutor cannot promote themselves'
);
select throws_ok(
  $$ select * from public.admin_list_staff() $$,
  '42501', 'not_admin', 'A tutor cannot list staff'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal1');
select is(public.am_i_admin(), false, 'An admin without a two-step session has no admin powers');
select throws_ok(
  $$ select public.admin_set_active('00000000-0000-0000-0000-0000000000b1', false) $$,
  '42501', 'not_admin', 'An admin without two-step cannot deactivate anyone'
);
reset role;


-- Admin with two-step ---------------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');

select is(public.am_i_admin(), true, 'An admin with two-step is an admin');

select results_eq(
  $$ select email, has_two_step from public.admin_list_staff() order by email $$,
  $$ values ('admin1@test.local', true), ('pending@test.local', false), ('tutor1@test.local', false) $$,
  'The staff list shows everyone and who has two-step'
);

select results_eq(
  $$ select email from public.admin_list_staff('00000000-0000-0000-0000-0000000000b1') $$,
  $$ values ('tutor1@test.local') $$,
  'The staff list can return one person'
);

-- Last admin
select throws_ok(
  $$ select public.admin_set_role('00000000-0000-0000-0000-0000000000a1', 'tutor') $$,
  'P0001', 'last_admin', 'The last active admin cannot be demoted'
);

-- Promote, then demote
select lives_ok(
  $$ select public.admin_set_role('00000000-0000-0000-0000-0000000000b1', 'admin') $$,
  'An admin can promote a tutor'
);
select is(
  (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'admin'::public.app_role,
  'The tutor is now an admin'
);
select is(
  (select details from public.audit_log where action = 'role_changed' order by id desc limit 1),
  '{"from": "tutor", "to": "admin"}'::jsonb,
  'The role change is audited with from and to'
);
select lives_ok(
  $$ select public.admin_set_role('00000000-0000-0000-0000-0000000000a1', 'tutor') $$,
  'An admin can step down when another active admin exists'
);
reset role;

-- admin1 is now a tutor; the promoted person must have two-step to act.
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000b1');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1', 'aal2');

select throws_ok(
  $$ select public.admin_set_role('00000000-0000-0000-0000-0000000000b1', 'tutor') $$,
  'P0001', 'last_admin', 'The remaining admin cannot step down'
);

-- Pending invites and missing people
select throws_ok(
  $$ select public.admin_set_role('00000000-0000-0000-0000-0000000000d1', 'admin') $$,
  'P0001', 'not_joined', 'A pending invite cannot be promoted'
);
select throws_ok(
  $$ select public.admin_set_active('00000000-0000-0000-0000-0000000000d1', false) $$,
  'P0001', 'not_joined', 'A pending invite is cancelled, not deactivated'
);
select throws_ok(
  $$ select public.admin_set_active(gen_random_uuid(), false) $$,
  'P0002', 'not_found', 'Unknown people are reported'
);

-- Deactivate and reactivate
select throws_ok(
  $$ select public.admin_set_active('00000000-0000-0000-0000-0000000000b1', false) $$,
  'P0001', 'cannot_deactivate_self', 'An admin cannot deactivate themselves'
);
select lives_ok(
  $$ select public.admin_set_active('00000000-0000-0000-0000-0000000000a1', false) $$,
  'An admin can deactivate someone'
);
select is(
  (select action from public.audit_log order by id desc limit 1), 'deactivated',
  'Deactivation is audited'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select is_empty($$ select id from public.profiles $$, 'A deactivated person loses access immediately, even mid-session');
select is(public.am_i_admin(), false, 'A deactivated person has no admin powers');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1', 'aal2');
select lives_ok(
  $$ select public.admin_set_active('00000000-0000-0000-0000-0000000000a1', true) $$,
  'An admin can reactivate someone'
);
select is(
  (select action from public.audit_log order by id desc limit 1), 'reactivated',
  'Reactivation is audited'
);
reset role;

select * from finish();
rollback;
