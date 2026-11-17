-- Google-only sign-up (20261117100000): e-mail self sign-up is switched off by
-- private.sign_up_settings.email_open, Google and invites are not, and Google names get the same
-- rule as e-mail names (security 06 finding 9, Google half).

begin;
select no_plan();
select tests.remove_all_accounts();

create function tests.sign_up_event(
  p_provider text default 'email',
  p_email text default 'someone@test.local',
  p_user_metadata jsonb default '{"full_name":"Some Parent"}'
)
returns jsonb
language sql
set search_path = ''
as $$
  select jsonb_build_object(
    'user', jsonb_build_object(
      'id', gen_random_uuid(), 'aud', 'authenticated', 'role', '', 'email', p_email, 'phone', '',
      'identities', '[]'::jsonb, 'is_anonymous', false,
      'app_metadata', jsonb_build_object('provider', p_provider, 'providers', jsonb_build_array(p_provider)),
      'user_metadata', p_user_metadata),
    'metadata', jsonb_build_object('name', 'before-user-created', 'ip_address', '127.0.0.1'))
$$;

-- The migration's default: e-mail off, sign-up open.
delete from private.sign_up_settings;
insert into private.sign_up_settings default values;
delete from private.sign_up_emails;
select results_eq($$ select open, email_open from private.sign_up_settings $$,
  $$ values (true, false) $$, 'A new settings row is open, with the e-mail form off');

select is(public.hook_before_user_created(tests.sign_up_event()), private.sign_up_refusal('sign_up_closed'),
  'E-mail off: an e-mail sign-up is refused as closed');
select is((select count(*)::int from private.sign_up_emails), 0, 'and it takes no cap slot');
select is(public.hook_before_user_created(tests.sign_up_event('google', 'g@test.local', '{"email_verified":true}')),
  '{}'::jsonb, 'E-mail off: a verified Google sign-up is allowed');
select is(public.hook_before_user_created(tests.sign_up_event('google', 'g@test.local', '{"email_verified":false}')),
  private.sign_up_refusal('google_email_unverified'), 'E-mail off: an unverified Google e-mail is still refused');
select is(public.hook_before_user_created(tests.sign_up_event('google', '   ', '{"email_verified":true}')),
  private.sign_up_refusal('google_email_unverified'), 'A blank Google e-mail is refused (trimmed first)');
select is(public.hook_before_user_created(tests.sign_up_event('facebook', 'f@test.local', '{}')),
  private.sign_up_refusal('sign_up_refused'), 'Other providers stay refused');
select is(public.sign_up_status(), 'open', 'sign_up_status stays open for Google');

update private.sign_up_settings set open = false;
select is(public.hook_before_user_created(tests.sign_up_event('google', 'g@test.local', '{"email_verified":true}')),
  private.sign_up_refusal('sign_up_closed'), 'The admin switch still closes Google');
update private.sign_up_settings set open = true;

update private.sign_up_settings set email_open = true;
select is(public.hook_before_user_created(tests.sign_up_event()), '{}'::jsonb,
  'E-mail on again: an e-mail sign-up is allowed');
update private.sign_up_settings set email_open = false;

-- What the sign-up page reads
select is(public.sign_up_email_open(), false, 'sign_up_email_open: false while off');
update private.sign_up_settings set email_open = true;
select is(public.sign_up_email_open(), true, 'sign_up_email_open: true while on');
delete from private.sign_up_settings;
select is(public.sign_up_email_open(), false, 'sign_up_email_open: a missing row reads as off');
insert into private.sign_up_settings default values;
select ok(has_function_privilege('anon', 'public.sign_up_email_open()', 'execute'),
  'sign_up_email_open: the signed-out sign-up page can read it');
select ok(has_function_privilege('authenticated', 'public.sign_up_email_open()', 'execute'),
  'sign_up_email_open: a signed-in page can read it');

-- Google names (finding 9): a name that fails the rule is stored empty; a good one is kept;
-- invites keep today's behaviour
insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data)
values ('00000000-0000-0000-0000-00000000ab01', 'authenticated', 'authenticated', 'g1@test.local',
        jsonb_build_object('full_name', 'Evil' || chr(8238) || 'Name'), '{"provider":"google"}'),
       ('00000000-0000-0000-0000-00000000ab02', 'authenticated', 'authenticated', 'g2@test.local',
        '{"full_name":"A"}', '{"provider":"google"}'),
       ('00000000-0000-0000-0000-00000000ab03', 'authenticated', 'authenticated', 'g3@test.local',
        '{"full_name":"  Priya Shah  "}', '{"provider":"google"}'),
       ('00000000-0000-0000-0000-00000000ab04', 'authenticated', 'authenticated', 'inv@test.local',
        '{"full_name":"A"}', '{"provider":"email","account_role":"tutor"}');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000ab01'), '',
  'A Google name with a text-direction override is stored empty');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000ab02'), '',
  'A one-character Google name is stored empty');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000ab03'), 'Priya Shah',
  'A good Google name is kept, trimmed');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000ab04'), 'A',
  'An invite''s name is stored as before');

select * from finish();
rollback;
