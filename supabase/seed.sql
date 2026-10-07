-- LOCAL DEVELOPMENT ONLY. Runs on `supabase start` / `supabase db reset`.
-- `supabase db push` never runs this file, so these accounts never reach staging or prod.
--
-- Accounts (all use the password below):
--   admin@local.test     admin; two-step is entered automatically by the dev server (design §16.1)
--   newadmin@local.test  admin with no authenticator yet: shows the two-step setup screen
--   tutor@local.test     tutor
--   inactive@local.test  deactivated tutor
--
-- Local-only password: local-password-123
--
-- Local-only authenticator key for admin@local.test (also in apps/web/.env.development.local as
-- VITE_LOCAL_ADMIN_TWO_STEP_KEY). It exists only in local databases; never use it anywhere else.
--   LOCALDEVADMINKEYLOCALDEVADMINKEY

do $$
declare
  account record;
  new_id uuid;
begin
  for account in
    select * from (values
      ('admin@local.test', 'Local Admin'),
      ('newadmin@local.test', 'New Admin'),
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

update public.profiles set role = 'admin' where email in ('admin@local.test', 'newadmin@local.test');

-- A confirmed authenticator for admin@local.test, so the dev server can enter its code.
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
select gen_random_uuid(), id, 'Local dev (automatic)', 'totp', 'verified', now(), now(),
       'LOCALDEVADMINKEYLOCALDEVADMINKEY'
from auth.users
where email = 'admin@local.test';

-- Deactivated the same way the app does it: profile inactive + auth ban.
update public.profiles set is_active = false where email = 'inactive@local.test';
-- 100 years, matching ban_duration '876000h' used by the staff-admin function.
update auth.users set banned_until = now() + interval '100 years' where email = 'inactive@local.test';

-- ---------------------------------------------------------------------------
-- Demo classes, timetable, students and assignments (R3a design §6). LOCAL ONLY.
-- Students are fictional ("… Demo"). Dates are relative to today so the timetable and
-- due dates always look current after `pnpm db:reset`.
-- ---------------------------------------------------------------------------
do $$
declare
  v_tutor uuid := (select id from auth.users where email = 'tutor@local.test');
  v_admin uuid := (select id from auth.users where email = 'admin@local.test');
  v_maths uuid;
  v_english uuid;
  v_interview uuid;
  v_aarav uuid;
  v_isla uuid;
  v_noah uuid;
  v_zara uuid;
  v_leo uuid;
  v_mia uuid;
  v_mock uuid;
begin
  insert into public.classes (name, subject, year_level, delivery, location, tutor_id, starts_on, ends_on)
  values ('Selective Entry Maths & Reasoning', 'maths', 8, 'in_person', 'Truganina, Room 1',
          v_tutor, current_date - 14, current_date + 70)
  returning id into v_maths;

  insert into public.classes (name, subject, year_level, delivery, location, tutor_id, starts_on, ends_on)
  values ('NAPLAN Reading & Writing', 'english', 5, 'in_person', 'Truganina, Room 2',
          v_admin, current_date - 14, current_date + 70)
  returning id into v_english;

  insert into public.classes (name, subject, year_level, delivery, location, tutor_id)
  values ('Selective Interview Preparation', 'interview-preparation', 8, 'online', 'Zoom', v_tutor)
  returning id into v_interview;

  insert into public.class_sessions (class_id, day_of_week, start_time, end_time) values
    (v_maths, 2, '16:00', '17:30'),
    (v_maths, 6, '10:00', '11:30'),
    (v_english, 3, '17:00', '18:00'),
    (v_interview, 4, '18:30', '19:30');

  insert into public.students (full_name, year_level) values ('Aarav Demo', 8) returning id into v_aarav;
  insert into public.students (full_name, year_level) values ('Isla Demo', 8) returning id into v_isla;
  insert into public.students (full_name, year_level) values ('Noah Demo', 5) returning id into v_noah;
  insert into public.students (full_name, year_level) values ('Zara Demo', 5) returning id into v_zara;
  insert into public.students (full_name, year_level) values ('Leo Demo', 8) returning id into v_leo;
  insert into public.students (full_name, year_level) values ('Mia Demo', null) returning id into v_mia;

  insert into public.enrolments (class_id, student_id) values
    (v_maths, v_aarav), (v_maths, v_isla), (v_maths, v_leo),
    (v_english, v_noah), (v_english, v_zara),
    (v_interview, v_aarav), (v_interview, v_isla);

  insert into public.assignments (class_id, title, instructions, due_on, max_mark) values
    (v_maths, 'Fractions practice set 3',
     'Questions 1–20 from the fractions booklet. Show your working.', current_date + 3, 20),
    (v_english, 'Persuasive writing draft',
     'Write a 300-word persuasive piece: "Should homework be banned?"', current_date + 5, null);

  insert into public.assignments (class_id, title, instructions, due_on, max_mark)
  values (v_maths, 'Reasoning mock test 1', 'Timed: 40 minutes, no calculator.', current_date - 2, 50)
  returning id into v_mock;

  insert into public.assignment_results (assignment_id, student_id, status, mark, feedback) values
    (v_mock, v_aarav, 'marked', 42, 'Strong on patterns; check units in question 7.'),
    (v_mock, v_isla, 'submitted', null, ''),
    (v_mock, v_leo, 'not_submitted', null, '');
end;
$$;
