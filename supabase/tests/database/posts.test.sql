-- Admin daily posts (posts.md): anyone may read, only an admin with two-step may write.

begin;
select no_plan();
select tests.remove_all_accounts();
delete from public.posts;

select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor@test.local');
select tests.create_family_account('00000000-0000-0000-0000-0000000000c1', 'parent@test.local', 'parent');

insert into public.posts (id, created_at, title, body) values
  ('00000000-0000-0000-0000-00000000f001', '2026-01-01 00:00:00+00', 'First day back', 'Welcome to term 4!'),
  ('00000000-0000-0000-0000-00000000f002', '2026-01-02 00:00:00+00', 'Exam tips', 'Get a good night''s sleep.');

-- Checks on the data itself
select throws_ok(
  $$ insert into public.posts (title, body) values ('', 'Body') $$,
  '23514', null, 'An empty title is refused');
select throws_ok(
  $$ insert into public.posts (title, body) values (repeat('x', 121), 'Body') $$,
  '23514', null, 'A title over 120 characters is refused');
select throws_ok(
  $$ insert into public.posts (title, body) values ('Title', '') $$,
  '23514', null, 'An empty body is refused');
select throws_ok(
  $$ insert into public.posts (title, body) values ('Title', repeat('x', 5001)) $$,
  '23514', null, 'A body over 5000 characters is refused');
select throws_ok(
  $$ insert into public.posts (title, body) values ('   ', 'Body') $$,
  '23514', null, 'A title of only spaces is refused');
select throws_ok(
  $$ insert into public.posts (title, body) values ('Title', E'  \n\t\r\n ') $$,
  '23514', null, 'A body of only spaces and line breaks is refused');
select throws_ok(
  $$ insert into public.posts (title, body) values (' ' || repeat('x', 120), 'Body') $$,
  '23514', null, 'Padding can''t take a title past 120 characters');
select lives_ok(
  $$ insert into public.posts (id, title, body) values
       ('00000000-0000-0000-0000-00000000f009', repeat('x', 120), E'Line one\n\nLine two') $$,
  'A 120-character title and a body with inner line breaks are fine');
delete from public.posts where id = '00000000-0000-0000-0000-00000000f009';

-- Visitors: can read, cannot write
select tests.authenticate_as_anon();
select is((select count(*)::int from public.posts), 2, 'Visitors can read every post');
select results_eq(
  $$ select title from public.posts order by created_at $$,
  $$ values ('First day back'), ('Exam tips') $$,
  'Visitors read the public columns');
select lives_ok($$ select id, created_at, updated_at, title, body from public.posts $$,
  'Visitors can read id, created_at, updated_at, title and body');
select throws_ok($$ select author_id from public.posts $$, '42501', null,
  'Visitors can''t read who wrote a post');
select throws_ok($$ select * from public.posts $$, '42501', null,
  'Visitors can''t read every column with select *');
select throws_ok(
  $$ insert into public.posts (title, body) values ('Spam', 'Buy now') $$,
  '42501', null, 'Visitors cannot add posts');
select throws_ok(
  $$ update public.posts set title = 'Hacked' $$,
  '42501', null, 'Visitors cannot edit posts');
select throws_ok(
  $$ delete from public.posts $$,
  '42501', null, 'Visitors cannot delete posts');
reset role;

-- Non-admin authenticated: can read (public policy), cannot write
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.posts), 2, 'A tutor can read every post');
select lives_ok($$ select author_id from public.posts $$, 'Signed-in staff still read every column');
select throws_ok(
  $$ insert into public.posts (title, body) values ('Spam', 'Buy now') $$,
  '42501', null, 'A tutor cannot add posts');
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.posts), 2, 'A parent can read every post');
select throws_ok(
  $$ insert into public.posts (title, body) values ('Spam', 'Buy now') $$,
  '42501', null, 'A parent cannot add posts');
reset role;

-- Admin without two-step: blocked from writing, same as any other authenticated user
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal1');
select throws_ok(
  $$ insert into public.posts (title, body) values ('Spam', 'Buy now') $$,
  '42501', null, 'An admin without two-step cannot add posts');
select is_empty(
  $$ update public.posts set title = 'Hacked' returning id $$,
  'An admin without two-step cannot edit posts');
select is_empty(
  $$ delete from public.posts returning id $$,
  'An admin without two-step cannot delete posts');
reset role;

-- Admin with two-step: full CRUD
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
insert into public.posts (id, title, body) values
  ('00000000-0000-0000-0000-00000000f003', 'Admin post', 'Written by an admin.');
select is((select count(*)::int from public.posts), 3, 'An admin with two-step can add a post');

-- now() is fixed for the whole test transaction, so advance explicitly to prove the column moves
update public.posts set title = 'Exam tips (updated)', updated_at = created_at + interval '1 minute'
  where id = '00000000-0000-0000-0000-00000000f002';
select ok(
  (select updated_at > created_at from public.posts where id = '00000000-0000-0000-0000-00000000f002'),
  'Editing a post advances updated_at');

delete from public.posts where id = '00000000-0000-0000-0000-00000000f003';
select is((select count(*)::int from public.posts), 2, 'An admin with two-step can delete a post');

select is(
  (select array_agg(id order by created_at desc) from public.posts),
  array['00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f001']::uuid[],
  'Posts list newest-first');
reset role;

select * from finish();
rollback;
