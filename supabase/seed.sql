-- LOCAL DEVELOPMENT ONLY. Runs on `supabase start` / `supabase db reset`.
-- `supabase db push` never runs this file, so these accounts never reach staging or prod.
--
-- Accounts (all use the password below):
--   admin@local.test     admin; two-step is entered automatically by the dev server (design §16.1)
--   newadmin@local.test  admin with no authenticator yet: shows the two-step setup screen
--   tutor@local.test     tutor
--   inactive@local.test  deactivated tutor
--   parent@local.test    parent of Aarav Demo and Noah Demo (R3b)
--   student@local.test   Aarav Demo's student account (R3b)
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
  -- account_role goes in app_metadata, as the account-admin function does it (R3b design D2).
  for account in
    select * from (values
      ('admin@local.test', 'Local Admin', null),
      ('newadmin@local.test', 'New Admin', null),
      ('tutor@local.test', 'Local Tutor', null),
      ('inactive@local.test', 'Inactive Tutor', null),
      ('parent@local.test', 'Local Parent', 'parent'),
      ('student@local.test', 'Aarav Demo', 'student')
    ) as accounts (email, full_name, account_role)
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
      '{"provider": "email", "providers": ["email"]}'::jsonb
        || case when account.account_role is null then '{}'::jsonb
                else jsonb_build_object('account_role', account.account_role) end,
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
-- 100 years, matching ban_duration '876000h' used by the account-admin function.
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

  -- Paper homework (R3a). Published, so students and parents see it (R3b).
  insert into public.assignments (class_id, title, instructions, due_on, max_mark, status) values
    (v_maths, 'Fractions practice set 3',
     'Questions 1–20 from the fractions booklet. Show your working.', current_date + 3, 20, 'published'),
    (v_english, 'Persuasive writing draft',
     'Write a 300-word persuasive piece: "Should homework be banned?"', current_date + 5, null, 'published');

  insert into public.assignments (class_id, title, instructions, due_on, max_mark, status)
  values (v_maths, 'Reasoning mock test 1', 'Timed: 40 minutes, no calculator.', current_date - 2, 50, 'published')
  returning id into v_mock;

  insert into public.assignment_results (assignment_id, student_id, status, mark, feedback) values
    (v_mock, v_aarav, 'marked', 42, 'Strong on patterns; check units in question 7.'),
    (v_mock, v_isla, 'submitted', null, ''),
    (v_mock, v_leo, 'not_submitted', null, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- Family accounts and online assignments (R3b design §3). LOCAL ONLY.
--   * parent@local.test is linked to Aarav Demo and Noah Demo. Aarav has consent (given by the
--     parent) and a student account (student@local.test). Noah has neither, so the parent sees
--     the consent prompt and admins can try the student invite.
--   * Online assignments in the maths class, one in each state: returned, waiting for marking,
--     to do, all multiple choice (comes back as soon as it's submitted) and a draft.
--   * Aarav's work goes through the same functions the portal uses, signed in as Aarav and then
--     as the tutor.
-- ---------------------------------------------------------------------------
do $$
declare
  v_tutor     uuid := (select id from public.profiles where email = 'tutor@local.test');
  v_parent    uuid := (select id from public.profiles where email = 'parent@local.test');
  v_account   uuid := (select id from public.profiles where email = 'student@local.test');
  v_maths     uuid := (select id from public.classes where name = 'Selective Entry Maths & Reasoning');
  v_aarav     uuid := (select id from public.students where full_name = 'Aarav Demo');
  v_noah      uuid := (select id from public.students where full_name = 'Noah Demo');
  v_patterns  uuid;
  v_word      uuid;
  v_fractions uuid;
  v_tables    uuid;
  v_ratio     uuid;
begin
  update public.students
  set profile_id = v_account,
      consent_recorded_at = now() - interval '3 days',
      consent_recorded_by = v_parent,
      consent_source = 'parent'
  where id = v_aarav;

  insert into public.student_guardians (student_id, parent_id)
  values (v_aarav, v_parent), (v_noah, v_parent);

  -- Questions can only be added to drafts, so each assignment is built first, then published.
  insert into public.assignments (class_id, title, instructions, due_on)
  values (v_maths, 'Number patterns check',
          'Find each rule, then the next number. Explain your thinking in question 3.', current_date - 3)
  returning id into v_patterns;

  insert into public.assignment_questions (assignment_id, kind, prompt, options, correct_option, marks, explanation) values
    (v_patterns, 'multiple_choice', 'What comes next: 3, 6, 12, 24, …?', '{36,48,30,42}', 1, 2,
     'Each number is double the one before: 24 × 2 = 48.'),
    (v_patterns, 'multiple_choice', 'What comes next: 1, 4, 9, 16, …?', '{20,24,25,32}', 2, 2,
     'These are square numbers: 5 × 5 = 25.'),
    (v_patterns, 'written', 'Describe the rule for 2, 5, 10, 17, 26, … and find the next number.', '{}', null, 4,
     'The gaps are the odd numbers 3, 5, 7, 9, so the next gap is 11 and the next number is 37 (each number is n² + 1).');

  insert into public.assignments (class_id, title, instructions, due_on)
  values (v_maths, 'Word problems set 1', 'Show your working for the written questions.', current_date + 1)
  returning id into v_word;

  insert into public.assignment_questions (assignment_id, kind, prompt, options, correct_option, marks, explanation) values
    (v_word, 'multiple_choice', 'A pen costs $3 and a book costs $12. How much do 2 pens and 1 book cost?',
     '{$15,$18,$24,$21}', 1, 1, '2 × $3 + $12 = $18.'),
    (v_word, 'written', 'Sam reads 15 pages a day. How many days will a 210-page book take? Show your working.',
     '{}', null, 3, '210 ÷ 15 = 14 days.'),
    (v_word, 'written', 'A recipe uses 3 eggs for 12 cupcakes. How many eggs are needed for 30 cupcakes? Explain.',
     '{}', null, 3, 'Each egg makes 4 cupcakes. 30 ÷ 4 = 7.5, so you need 8 eggs.');

  insert into public.assignments (class_id, title, instructions, due_on)
  values (v_maths, 'Fractions quick quiz', 'Four quick questions, then explain your method in question 5.',
          current_date + 4)
  returning id into v_fractions;

  insert into public.assignment_questions (assignment_id, kind, prompt, options, correct_option, marks, explanation) values
    (v_fractions, 'multiple_choice', 'Which fraction is equal to 3/4?', '{6/8,4/6,9/16,3/8}', 0, 1,
     'Multiply the top and bottom by 2: 3/4 = 6/8.'),
    (v_fractions, 'multiple_choice', 'What is 2/5 + 1/5?', '{3/10,3/5,2/25,1/5}', 1, 1,
     'The denominators are the same, so add the numerators: 3/5.'),
    (v_fractions, 'multiple_choice', 'Which is the largest?', '{1/2,2/3,3/5,5/9}', 1, 1,
     'As decimals: 0.5, 0.67, 0.6 and 0.56, so 2/3 is the largest.'),
    (v_fractions, 'multiple_choice', 'What is 1/2 of 3/4?', '{3/8,4/6,1/4,3/2}', 0, 1,
     '1/2 × 3/4 = 3/8.'),
    (v_fractions, 'written', 'Explain how you would compare 5/8 and 3/5 without a calculator.', '{}', null, 3,
     'Use a common denominator of 40: 5/8 = 25/40 and 3/5 = 24/40, so 5/8 is larger.');

  insert into public.assignments (class_id, title, instructions, due_on)
  values (v_maths, 'Times tables warm-up', 'Three quick questions. Your result shows as soon as you submit.',
          current_date + 6)
  returning id into v_tables;

  insert into public.assignment_questions (assignment_id, kind, prompt, options, correct_option, marks, explanation) values
    (v_tables, 'multiple_choice', '7 × 8 = ?', '{54,56,64,48}', 1, 1, ''),
    (v_tables, 'multiple_choice', '9 × 6 = ?', '{54,45,63,56}', 0, 1, ''),
    (v_tables, 'multiple_choice', '12 × 11 = ?', '{121,122,132,144}', 2, 1, '');

  insert into public.assignments (class_id, title, instructions, due_on)
  values (v_maths, 'Ratio worksheet', 'Simplify first, then share.', current_date + 10)
  returning id into v_ratio;

  insert into public.assignment_questions (assignment_id, kind, prompt, options, correct_option, marks, explanation) values
    (v_ratio, 'multiple_choice', 'Simplify the ratio 12 : 18.', '{2 : 3,3 : 2,6 : 9,4 : 6}', 0, 1,
     'Divide both parts by 6.'),
    (v_ratio, 'written', 'Share $40 in the ratio 3 : 5. Show your working.', '{}', null, 2,
     '3 + 5 = 8 parts, and $40 ÷ 8 = $5 a part, so $15 and $25.');

  update public.assignments set status = 'published' where id in (v_patterns, v_word, v_fractions, v_tables);
  update public.assignments set published_at = now() - interval '7 days' where id = v_patterns;
  update public.assignments set published_at = now() - interval '2 days' where id = v_word;

  -- Aarav answers and hands in two of them...
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_account, 'role', 'authenticated')::text, true);

  perform public.student_save_answer(v_patterns,
    (select id from public.assignment_questions where assignment_id = v_patterns and position = 1), 1);
  perform public.student_save_answer(v_patterns,
    (select id from public.assignment_questions where assignment_id = v_patterns and position = 2), 0);
  perform public.student_save_answer(v_patterns,
    (select id from public.assignment_questions where assignment_id = v_patterns and position = 3), null,
    'The gaps go up by 2 each time (3, 5, 7, 9), so the next gap is 11 and the next number is 37.');
  perform public.student_submit(v_patterns);

  perform public.student_save_answer(v_word,
    (select id from public.assignment_questions where assignment_id = v_word and position = 1), 1);
  perform public.student_save_answer(v_word,
    (select id from public.assignment_questions where assignment_id = v_word and position = 2), null,
    '210 ÷ 15 = 14, so it takes 14 days.');
  perform public.student_save_answer(v_word,
    (select id from public.assignment_questions where assignment_id = v_word and position = 3), null,
    '12 cupcakes need 3 eggs, so 1 egg makes 4 cupcakes. 30 ÷ 4 = 7.5, so 8 eggs.');
  perform public.student_submit(v_word);

  -- ...and the tutor marks and returns the first one.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_tutor, 'role', 'authenticated')::text, true);

  update public.assignment_answers
  set awarded_marks = 4, feedback = 'Clear explanation of the gaps.'
  where assignment_id = v_patterns
    and student_id = v_aarav
    and question_id = (select id from public.assignment_questions where assignment_id = v_patterns and position = 3);

  update public.assignment_results
  set status = 'returned',
      feedback = 'Great reasoning in the written question, Aarav. Revise square numbers: 16 is 4 × 4, so the next one is 5 × 5.'
  where assignment_id = v_patterns and student_id = v_aarav;

  perform set_config('request.jwt.claims', '', true);

  -- Back-date the hand-in so the demo reads naturally (handed in a day before it was due).
  update public.assignment_results
  set submitted_at = now() - interval '4 days'
  where assignment_id = v_patterns and student_id = v_aarav;
end;
$$;
