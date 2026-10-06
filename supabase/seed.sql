-- LOCAL DEVELOPMENT ONLY. Runs on `supabase start` / `supabase db reset`.
-- `supabase db push` never runs this file, so these accounts never reach staging or prod.
--
-- Accounts (all use the password below):
--   admin@local.test     admin, sets up two-step on first sign-in
--   tutor@local.test     tutor
--   inactive@local.test  deactivated tutor
--
-- Local-only password: local-password-123

do $$
declare
  account record;
  new_id uuid;
begin
  for account in
    select * from (values
      ('admin@local.test', 'Local Admin'),
      ('tutor@local.test', 'Local Tutor'),
      ('inactive@local.test', 'Inactive Tutor')
    ) as accounts (email, full_name)
  loop
    new_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    )
    values (
      '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
      account.email, extensions.crypt('local-password-123', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object('full_name', account.full_name), now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
    values (
      gen_random_uuid(), new_id, new_id::text,
      jsonb_build_object('sub', new_id::text, 'email', account.email, 'email_verified', true),
      'email', now(), now()
    );
  end loop;
end;
$$;

update public.profiles set role = 'admin' where email = 'admin@local.test';

-- Deactivated the same way the app does it: profile inactive + auth ban.
update public.profiles set is_active = false where email = 'inactive@local.test';
-- 100 years, matching ban_duration '876000h' used by the staff-admin function.
update auth.users set banned_until = now() + interval '100 years' where email = 'inactive@local.test';
