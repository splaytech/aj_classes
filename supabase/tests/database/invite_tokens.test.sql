-- Invite tokens (ADR-0010, docs/delivery/2026-10-29-invite-14-days/03-design.md §3): hash-only
-- storage reached only through three service-only functions; single use, 336 hours, one live
-- link per account, rate limit per address, and the guarded invited_at copy.

begin;
select no_plan();
select tests.remove_all_accounts();
delete from private.invite_redeem_attempts;

select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor@test.local');
select tests.create_family_account('00000000-0000-0000-0000-0000000000c1', 'student@test.local', 'student');
select tests.create_family_account('00000000-0000-0000-0000-0000000000c2', 'parent@test.local', 'parent');
-- Invited (not joined) accounts the functions act on.
select tests.create_staff('00000000-0000-0000-0000-0000000000d1', 'invited-tutor@test.local', 'tutor', p_joined => false);
select tests.create_family_account('00000000-0000-0000-0000-0000000000d2', 'invited-student@test.local', 'student', p_joined => false);
select tests.create_staff('00000000-0000-0000-0000-0000000000d3', 'invited-other@test.local', 'tutor', p_joined => false);

-- #1 Tables exist, RLS is on, and there are no policies
select has_table('private', 'invite_tokens', 'private.invite_tokens exists');
select has_table('private', 'invite_redeem_attempts', 'private.invite_redeem_attempts exists');
select ok((select relrowsecurity from pg_class where oid = 'private.invite_tokens'::regclass),
  'RLS is on for invite_tokens');
select ok((select relrowsecurity from pg_class where oid = 'private.invite_redeem_attempts'::regclass),
  'RLS is on for invite_redeem_attempts');
select is((select count(*)::int from pg_policies
           where schemaname = 'private' and tablename in ('invite_tokens', 'invite_redeem_attempts')),
  0, 'Neither table has a policy');

-- #2 No API role has any table right
select ok(not has_table_privilege(r, t, p), format('%s has no %s on %s', r, p, t))
from unnest(array['anon', 'authenticated', 'service_role']) as r,
     unnest(array['private.invite_tokens', 'private.invite_redeem_attempts']) as t,
     unnest(array['select', 'insert', 'update', 'delete']) as p;

-- #3 Signed-out and signed-in people can't read either table
select tests.authenticate_as_anon();
select throws_ok($$ select * from private.invite_tokens $$, '42501', null,
  'Visitors cannot read invite_tokens');
select throws_ok($$ select * from private.invite_redeem_attempts $$, '42501', null,
  'Visitors cannot read invite_redeem_attempts');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select * from private.invite_tokens $$, '42501', null,
  'Tutors cannot read invite_tokens');
select throws_ok($$ select * from private.invite_redeem_attempts $$, '42501', null,
  'Tutors cannot read invite_redeem_attempts');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select * from private.invite_tokens $$, '42501', null,
  'Students cannot read invite_tokens');
select throws_ok($$ select * from private.invite_redeem_attempts $$, '42501', null,
  'Students cannot read invite_redeem_attempts');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select * from private.invite_tokens $$, '42501', null,
  'Parents cannot read invite_tokens');
select throws_ok($$ select * from private.invite_redeem_attempts $$, '42501', null,
  'Parents cannot read invite_redeem_attempts');
reset role;

-- #4 Only service_role may run the functions; each is security definer with an empty search_path.
-- Checked with has_function_privilege, never by calling as anon (local psql crash, README).
select ok(not has_function_privilege(r, f, 'execute'), format('%s cannot run %s', r, f))
from unnest(array['anon', 'authenticated']) as r,
     unnest(array['public.invite_token_store(uuid, text)', 'public.invite_token_claim(text, text)',
                  'public.invite_token_release(text)']) as f;
select ok(has_function_privilege('service_role', f, 'execute'), format('service_role can run %s', f))
from unnest(array['public.invite_token_store(uuid, text)', 'public.invite_token_claim(text, text)',
                  'public.invite_token_release(text)']) as f;
select ok(p.prosecdef, format('%s is security definer', p.proname))
from pg_proc p
where p.oid in ('public.invite_token_store(uuid, text)'::regprocedure,
                'public.invite_token_claim(text, text)'::regprocedure,
                'public.invite_token_release(text)'::regprocedure);
select is(p.proconfig::text[], array['search_path=""'], format('%s has an empty search_path', p.proname))
from pg_proc p
where p.oid in ('public.invite_token_store(uuid, text)'::regprocedure,
                'public.invite_token_claim(text, text)'::regprocedure,
                'public.invite_token_release(text)'::regprocedure);

-- #5 Store on an invited account: 336 hours, unused, and invited_at = the send time
select isnt(public.invite_token_store('00000000-0000-0000-0000-0000000000d1', repeat('a', 64)), null,
  'Storing a link for an invited tutor returns the send time');
select is((select expires_at - sent_at from private.invite_tokens
           where profile_id = '00000000-0000-0000-0000-0000000000d1'),
  interval '336 hours', 'The link lasts 336 hours');
select is((select used_at from private.invite_tokens
           where profile_id = '00000000-0000-0000-0000-0000000000d1'),
  null, 'A new link is unused');
select is((select invited_at from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  now(), 'profiles.invited_at is the send time');

-- #6 Store refuses joined and unknown accounts
select is(public.invite_token_store('00000000-0000-0000-0000-0000000000b1', repeat('b', 64)), null,
  'An active account gets no link');
select is((select count(*)::int from private.invite_tokens
           where profile_id = '00000000-0000-0000-0000-0000000000b1'),
  0, 'and no row is added');
select is(public.invite_token_store('00000000-0000-0000-0000-00000000ffff', repeat('b', 64)), null,
  'An unknown account gets no link');

-- #7 Only a SHA-256 hex digest is accepted
select throws_ok(
  $$ select public.invite_token_store('00000000-0000-0000-0000-0000000000d1', 'xyz') $$,
  '23514', null, 'A value that is not a 64-character hex hash is refused');

-- #8 A re-send replaces the link: one row, the new hash, unused, new send time
update private.invite_tokens
   set sent_at = sent_at - interval '1 day', expires_at = expires_at - interval '1 day',
       used_at = now()
 where profile_id = '00000000-0000-0000-0000-0000000000d1';
select public.invite_token_store('00000000-0000-0000-0000-0000000000d1', repeat('c', 64));
select is((select count(*)::int from private.invite_tokens
           where profile_id = '00000000-0000-0000-0000-0000000000d1'),
  1, 'A re-send keeps one row for the account');
select is((select token_hash from private.invite_tokens
           where profile_id = '00000000-0000-0000-0000-0000000000d1'),
  repeat('c', 64), 'The row holds the new hash');
select is((select used_at from private.invite_tokens
           where profile_id = '00000000-0000-0000-0000-0000000000d1'),
  null, 'The new link is unused');
select is((select sent_at from private.invite_tokens
           where profile_id = '00000000-0000-0000-0000-0000000000d1'),
  now(), 'The send time is the re-send');

-- #9 Single use (each group below has its own address, so the rate limit stays out of the way)
select is(public.invite_token_claim(repeat('c', 64), repeat('1', 64)),
  '00000000-0000-0000-0000-0000000000d1'::uuid, 'Claiming the current link returns the account');
select isnt((select used_at from private.invite_tokens
             where profile_id = '00000000-0000-0000-0000-0000000000d1'),
  null, 'The claim marks the link used');
select is(public.invite_token_claim(repeat('c', 64), repeat('1', 64)), null,
  'A second claim of the same link is refused');

-- #10 Replaced and unknown links
select is(public.invite_token_claim(repeat('a', 64), repeat('2', 64)), null,
  'The replaced (first) link is refused');
select is(public.invite_token_claim(repeat('f', 64), repeat('2', 64)), null,
  'An unknown link is refused');

-- #11 Release undoes a claim, so a failed sign-in hop doesn't use up the link
select public.invite_token_release(repeat('c', 64));
select is(public.invite_token_claim(repeat('c', 64), repeat('3', 64)),
  '00000000-0000-0000-0000-0000000000d1'::uuid, 'After a release the link can be claimed again');

-- #12 Releasing a replaced or unknown link changes nothing
create temporary table token_snapshot as
  select profile_id, token_hash, used_at from private.invite_tokens;
select public.invite_token_release(repeat('a', 64));
select public.invite_token_release(repeat('f', 64));
select is((select count(*)::int from private.invite_tokens t
           join token_snapshot s using (profile_id)
           where t.token_hash = s.token_hash and t.used_at is not distinct from s.used_at),
  (select count(*)::int from token_snapshot),
  'Releasing a replaced or unknown link changes no row');

-- #13 Expiry boundary: valid while expires_at > now()
select public.invite_token_store('00000000-0000-0000-0000-0000000000d2', repeat('d', 64));
update private.invite_tokens
   set sent_at = now() - interval '336 hours', expires_at = now()
 where profile_id = '00000000-0000-0000-0000-0000000000d2';
select is(public.invite_token_claim(repeat('d', 64), repeat('4', 64)), null,
  'A link at exactly 336 hours is refused');
update private.invite_tokens
   set sent_at = now() - interval '336 hours' + interval '1 second',
       expires_at = now() + interval '1 second'
 where profile_id = '00000000-0000-0000-0000-0000000000d2';
select is(public.invite_token_claim(repeat('d', 64), repeat('4', 64)),
  '00000000-0000-0000-0000-0000000000d2'::uuid, 'A link with one second left works');

-- #14 Deactivated and joined accounts are refused
select public.invite_token_store('00000000-0000-0000-0000-0000000000d3', repeat('e', 64));
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000d3';
select is(public.invite_token_claim(repeat('e', 64), repeat('5', 64)), null,
  'A deactivated account''s link is refused');
update public.profiles set is_active = true, status = 'active', joined_at = now()
 where id = '00000000-0000-0000-0000-0000000000d3';
select is(public.invite_token_claim(repeat('e', 64), repeat('5', 64)), null,
  'A joined account''s link is refused');
select is((select used_at from private.invite_tokens
           where profile_id = '00000000-0000-0000-0000-0000000000d3'),
  null, 'Neither refusal used up the link');

-- #15 Rate limit: 10 claims per 15 minutes per address
select public.invite_token_claim(repeat('f', 64), repeat('6', 64)) from generate_series(1, 10);
select throws_ok(
  $$ select public.invite_token_claim(repeat('f', 64), repeat('6', 64)) $$,
  'P0001', 'rate_limited', 'The 11th claim from one address in 15 minutes is refused');
select is((select count(*)::int from private.invite_redeem_attempts where ip_hash = repeat('6', 64)),
  10, 'The refused claim wrote no attempt row');
select is(public.invite_token_claim(repeat('f', 64), repeat('7', 64)), null,
  'Another address still gets an answer');
insert into private.invite_redeem_attempts (ip_hash, created_at)
  select repeat('8', 64), now() - interval '16 minutes' from generate_series(1, 10);
select is(public.invite_token_claim(repeat('f', 64), repeat('8', 64)), null,
  'Attempts older than 15 minutes do not count');
select is((select count(*)::int from private.invite_redeem_attempts where ip_hash = repeat('8', 64)),
  1, 'and the next call deletes them');

-- #16 Deleting the account (cancel-invite) removes its link
delete from auth.users where id = '00000000-0000-0000-0000-0000000000d2';
select is((select count(*)::int from private.invite_tokens
           where profile_id = '00000000-0000-0000-0000-0000000000d2'),
  0, 'Deleting an invited account removes its link');

-- #17 The auth.users trigger copies invited_at only when Auth sets a new, non-null value
update public.profiles set invited_at = '2026-01-01' where id = '00000000-0000-0000-0000-0000000000d1';
update auth.users set last_sign_in_at = now() where id = '00000000-0000-0000-0000-0000000000d1';
select is((select invited_at from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  '2026-01-01'::timestamptz, 'A sign-in leaves invited_at alone');
update auth.users set invited_at = '2026-02-02' where id = '00000000-0000-0000-0000-0000000000d1';
select is((select invited_at from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  '2026-02-02'::timestamptz, 'A new Auth invited_at is copied');
update auth.users set invited_at = null where id = '00000000-0000-0000-0000-0000000000d1';
select is((select invited_at from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  '2026-02-02'::timestamptz, 'Auth clearing invited_at does not wipe it');

-- #18 Nothing the shipped mobile build reads was removed (AC 27)
select has_column('public', 'profiles', 'invited_at', 'profiles.invited_at still exists');
select has_column('public', 'profiles', 'status', 'profiles.status still exists');

select * from finish();
rollback;
