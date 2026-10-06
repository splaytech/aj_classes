-- Profile photo storage rules (design §7.3, story US13).
-- Size and file-type limits are enforced by the Storage API, not SQL; they are checked in E2E.

begin;
select no_plan();
select tests.remove_all_accounts();

select tests.create_staff('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'admin');
select tests.create_staff('00000000-0000-0000-0000-0000000000b1', 'tutor1@test.local');
select tests.create_staff('00000000-0000-0000-0000-0000000000c1', 'gone@test.local', p_active => false);
select tests.add_verified_factor('00000000-0000-0000-0000-0000000000a1');

select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars' $$,
  $$ values (true, 2097152::bigint, array['image/jpeg', 'image/png', 'image/webp']) $$,
  'The avatars bucket is public-read, 2 MB, JPEG/PNG/WebP only (no SVG)'
);

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000b1/1.webp') $$,
  'A tutor can upload into their own folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000a1/1.webp') $$,
  '42501', null, 'A tutor cannot upload into someone else''s folder'
);
select isnt_empty(
  $$ update storage.objects set metadata = '{}'
     where name = '00000000-0000-0000-0000-0000000000b1/1.webp' returning id $$,
  'A tutor can change their own photo (delete goes through the Storage API, checked in E2E)'
);
select is_empty(
  $$ update storage.objects set metadata = '{}'
     where name = '00000000-0000-0000-0000-0000000000b1/2.webp' returning id $$,
  'A tutor cannot touch photos outside their folder'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000c1/1.webp') $$,
  '42501', null, 'A deactivated tutor cannot upload'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal1');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000b1/2.webp') $$,
  '42501', null, 'An admin without two-step cannot upload into someone else''s folder'
);
reset role;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1', 'aal2');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-0000000000b1/2.webp') $$,
  'An admin with two-step can upload a photo for a staff member'
);
reset role;

select tests.authenticate_as_anon();
select is_empty(
  $$ select id from storage.objects where bucket_id = 'avatars' $$,
  'Visitors cannot list photos (they need the exact public URL)'
);
reset role;

select * from finish();
rollback;
