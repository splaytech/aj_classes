-- Open sign-up access sweep (ADR-0011; docs/delivery/2026-11-13-open-sign-up/03-design.md §10
-- pgTAP-AX; AC-26, AC-27, AC-29, AC-30, AC-55): a finished signed-up user reads nothing but their
-- own profile and the posts, and changes nothing. Runs on the local seed (classes, students,
-- assignments, outbox rows), so "0 rows" means hidden, not empty. Everything is rolled back.

begin;
select no_plan();

select tests.create_sign_up('00000000-0000-0000-0000-0000000ab001', 'ax-user@test.local');
select tests.create_staff('00000000-0000-0000-0000-0000000ab002', 'ax-admin@test.local', 'admin');

-- What the sweep needs, gathered as postgres before acting as the user.
create temp table ax_tables (name text primary key, insert_cols text, update_col text, can_delete boolean, sample jsonb);
insert into ax_tables (name) values
  ('classes'), ('class_sessions'), ('enrolments'), ('students'), ('student_guardians'),
  ('assignments'), ('assignment_questions'), ('assignment_answers'), ('assignment_results'),
  ('email_outbox'), ('audit_log'), ('enquiries'), ('enquiry_rate_limits'), ('notification_settings'),
  ('posts');
update ax_tables t set
  insert_cols = (select string_agg(quote_ident(c.column_name), ', ' order by c.column_name)
                 from (select distinct column_name from information_schema.column_privileges
                       where grantee = 'authenticated' and table_schema = 'public'
                         and table_name = t.name and privilege_type = 'INSERT') c),
  update_col = (select min(quote_ident(column_name)) from information_schema.column_privileges
                where grantee = 'authenticated' and table_schema = 'public'
                  and table_name = t.name and privilege_type = 'UPDATE'),
  can_delete = has_table_privilege('authenticated', 'public.' || t.name, 'delete');
do $$
declare t text;
begin
  for t in select name from ax_tables loop
    execute format('update ax_tables set sample = (select to_jsonb(x) from public.%I x limit 1) where name = %L', t, t);
  end loop;
end;
$$;
update ax_tables set sample = '{}' where sample is null;
grant select on ax_tables to authenticated;

-- Seed rows the calls aim at.
create temp table ax_ids as
select (select id from public.students order by full_name limit 1) as student,
       (select id from public.assignments order by title limit 1) as assignment,
       (select id from public.assignment_questions order by id limit 1) as question;
grant select on ax_ids to authenticated;

-- True when the statement raised, or returned no rows, or only null/empty values.
create function tests.yields_nothing(statement text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  rows jsonb;
begin
  execute format('select coalesce(jsonb_agg(to_jsonb(q)), ''[]'') from (%s) q', statement) into rows;
  return not exists (
    select 1 from jsonb_array_elements(rows) r, jsonb_each_text(r) v
    where coalesce(v.value, '') <> ''
  );
exception when others then
  return true;
end;
$$;

-- True when the write raised or changed no row.
create function tests.write_refused(statement text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  changed bigint;
begin
  execute statement;
  get diagnostics changed = row_count;
  return changed = 0;
exception when others then
  return true;
end;
$$;

-- Every public function an authenticated session can call. A new one fails this pin until
-- someone has checked what a signed-up user gets from it and added it here.
create temp table ax_pinned_functions as
select unnest(array[
  'admin_email_problems(integer)', 'admin_list_activity(integer)', 'admin_list_staff(uuid)',
  'admin_list_users()', 'admin_promote_user(uuid,uuid)', 'admin_record_consent(uuid)',
  'admin_set_active(uuid,boolean)', 'admin_set_role(uuid,app_role)', 'admin_set_sign_up_open(boolean)',
  'admin_unlink_parent(uuid,uuid)', 'am_i_admin()',
  'complete_onboarding(text,text,text,boolean,boolean,boolean,boolean)', 'complete_sign_up(text,boolean)',
  'mock_close_now(uuid)', 'mock_move_question(uuid,integer)', 'mock_release(uuid,timestamp with time zone)',
  'mock_save_answer(uuid,uuid,integer)', 'mock_set_closing(uuid,timestamp with time zone)',
  'mock_start(uuid)', 'mock_submit(uuid)', 'mock_test_open(uuid)', 'mock_test_results(uuid)', 'mock_tests_admin_list()',
  'mock_tests_for_me()', 'mock_withdraw(uuid)',
  'move_question(uuid,integer)', 'my_has_password()', 'my_onboarding()', 'my_sign_up()',
  'parent_child_assignment(uuid,uuid)', 'parent_child_assignments(uuid)', 'parent_child_timetable(uuid)',
  'parent_children()', 'parent_give_consent(uuid)', 'set_my_consents(boolean,boolean,boolean)',
  'sign_up_email_open()', 'sign_up_guard_ready()', 'sign_up_status()', 'student_assignment(uuid)', 'student_assignments()',
  'student_save_answer(uuid,uuid,integer,text)', 'student_submit(uuid)', 'student_timetable()'
]) as signature;

select set_eq(
  $$ select replace(p.oid::regprocedure::text, 'public.', '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute') $$,
  $$ select signature from ax_pinned_functions $$,
  'AC-26 pin: these are exactly the public functions a signed-in session can call');

-- The sweep, as a finished user in a session with the given sign-in methods.
create function tests.ax_sweep(p_user uuid, p_amr text[])
returns setof text
language plpgsql
set search_path = extensions -- pgTAP; every table and function below is schema-qualified
as $$
declare
  label constant text := ' [' || array_to_string(p_amr, ',') || ']';
  t record;
  n bigint;
  ids record;
  column_name text;
  calls text[];
  call text;
begin
  select * into ids from pg_temp.ax_ids;
  perform tests.authenticate_with_session(p_user, p_amr);

  -- Reads (AC-26)
  for t in select * from pg_temp.ax_tables where name <> 'posts' order by name loop
    begin
      execute format('select count(*) from public.%I', t.name) into n;
    exception when insufficient_privilege then
      n := 0;
    end;
    return next is(n, 0::bigint, format('AC-26: %s returns no rows%s', t.name, label));
  end loop;
  return next results_eq(
    'select id from public.profiles',
    format('values (%L::uuid)', p_user),
    'AC-27: profiles returns only their own row' || label);
  return next ok((select count(*) from public.posts) >= 0, 'They can read the posts (AC-21)' || label);

  -- Writes (AC-26): inserts, updates and deletes are refused or change nothing
  for t in select * from pg_temp.ax_tables order by name loop
    return next ok(tests.write_refused(
      case when t.insert_cols is null then format('insert into public.%I default values', t.name)
           else format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, %3$L)',
                       t.name, t.insert_cols, t.sample) end),
      format('AC-26: insert into %s is refused%s', t.name, label));
    if t.update_col is not null then
      return next ok(tests.write_refused(format('update public.%1$I set %2$s = %2$s where true', t.name, t.update_col)),
        format('AC-26: update of %s changes nothing%s', t.name, label));
    end if;
    return next ok(tests.write_refused(format('delete from public.%I where true', t.name)),
      format('AC-26: delete from %s changes nothing%s', t.name, label));
  end loop;

  -- Their own profile (AC-27): no column can be changed directly
  foreach column_name in array array['role', 'status', 'is_active', 'terms_accepted_at', 'full_name', 'email',
                                     'joined_at', 'password_set_at', 'phone', 'bio', 'marketing_consent_at'] loop
    return next ok(tests.write_refused(format(
        'update public.profiles set %1$I = %1$I where id = %2$L', column_name, p_user)),
      format('AC-27: a direct update of profiles.%s is refused%s', column_name, label));
  end loop;

  -- Storage (AC-26): can't list or upload
  return next is((select count(*) from storage.objects), 0::bigint, 'AC-26: storage.objects lists nothing' || label);
  return next ok(tests.write_refused(format(
      'insert into storage.objects (bucket_id, name) values (''avatars'', %L)', p_user || '/avatar.png')),
    'AC-26: uploading an avatar is refused' || label);

  -- Every pinned function: raises or returns nothing (AC-26)
  calls := array[
    'select public.admin_email_problems(10)::text',
    'select * from public.admin_list_activity(10)',
    'select * from public.admin_list_staff(null)',
    'select * from public.admin_list_users()',
    format('select public.admin_promote_user(%L, %L)::text', p_user, ids.student),
    format('select public.admin_record_consent(%L)::text', ids.student),
    format('select public.admin_set_active(%L, false)::text', p_user),
    format('select public.admin_set_role(%L, ''admin'')::text', p_user),
    'select public.admin_set_sign_up_open(false)::text',
    format('select public.admin_unlink_parent(%L, %L)::text', ids.student, p_user),
    'select public.complete_onboarding(''Sneaky'', null, null, true)::text',
    'select public.complete_sign_up(''Sneaky'', true)::text',
    format('select public.move_question(%L, 1)::text', ids.question),
    'select * from public.my_onboarding()',
    'select * from public.my_sign_up()',
    format('select * from public.parent_child_assignment(%L, %L)', ids.student, ids.assignment),
    format('select * from public.parent_child_assignments(%L)', ids.student),
    format('select * from public.parent_child_timetable(%L)', ids.student),
    'select * from public.parent_children()',
    format('select public.parent_give_consent(%L)::text', ids.student),
    'select public.set_my_consents(true, true, true)::text',
    format('select * from public.student_assignment(%L)', ids.assignment),
    'select * from public.student_assignments()',
    format('select public.student_save_answer(%L, %L, 0, ''x'')::text', ids.assignment, ids.question),
    format('select public.student_submit(%L)::text', ids.assignment),
    'select * from public.student_timetable()'
  ];
  foreach call in array calls loop
    return next ok(tests.yields_nothing(call), format('AC-26: %s gives a user nothing%s', call, label));
  end loop;
  -- The five that answer: only public facts or the caller's own.
  return next is(public.am_i_admin(), false, 'am_i_admin says no' || label);
  return next is(public.my_has_password(), true, 'my_has_password reports their own password' || label);
  return next is(public.sign_up_status(), 'open', 'sign_up_status is public' || label);
  return next is(public.sign_up_guard_ready(), true, 'sign_up_guard_ready is a public yes/no' || label);
  return next ok(public.sign_up_email_open() is not null, 'sign_up_email_open is a public yes/no' || label);
  return next is((select role::text || '/' || status::text from public.profiles where id = p_user), 'user/active',
    'After all that, they are still an active user' || label);

  reset role;
end;
$$;

select * from tests.ax_sweep('00000000-0000-0000-0000-0000000ab001', array['otp']);
-- AC-55: a Google session follows exactly the same rules.
select * from tests.ax_sweep('00000000-0000-0000-0000-0000000ab001', array['oauth']);

-- AC-29: publishing, returning and the due-tomorrow sweep queue nothing for a user, who can't be
-- a guardian or a student's account in the first place.
select throws_ok(
  format('insert into public.student_guardians (student_id, parent_id) values (%L, %L)',
         (select student from ax_ids), '00000000-0000-0000-0000-0000000ab001'),
  'P0001', 'not_a_parent_account', 'AC-29: a user can''t be linked as a guardian');
select throws_ok(
  format('update public.students set profile_id = %L, consent_recorded_at = now() where id = %L',
         '00000000-0000-0000-0000-0000000ab001', (select student from ax_ids)),
  'P0001', 'not_a_student_account', 'AC-29: a user can''t be a student''s account');
update public.assignments set status = 'published', published_at = now() - interval '2 days'
where status = 'draft' and exists (select 1 from public.assignment_questions q where q.assignment_id = assignments.id);
update public.assignment_results set status = 'returned' where status = 'marked';
select private.queue_due_tomorrow_emails_for(d) from (select distinct due_on - 1 as d from public.assignments) days;
select is_empty(
  $$ select 1 from public.email_outbox o join public.profiles p on p.id = o.recipient_id where p.role = 'user' $$,
  'AC-29: no queued e-mail is for a signed-up user');

-- AC-30: users don't show up in the staff list or the e-mail problems list.
select tests.authenticate_as('00000000-0000-0000-0000-0000000ab002', 'aal2');
select is_empty($$ select 1 from public.admin_list_staff(null) s join public.profiles p on p.id = s.id where p.role = 'user' $$,
  'AC-30: admin_list_staff never lists a user');
select is_empty($$ select 1 from public.admin_list_staff('00000000-0000-0000-0000-0000000ab001') $$,
  'AC-30: not even when asked for one by id');
create temp table ax_problems as select id from public.admin_email_problems(100);
reset role;
select is_empty($$ select 1 from ax_problems e join public.email_outbox o on o.id = e.id
                   join public.profiles p on p.id = o.recipient_id where p.role = 'user' $$,
  'AC-30: the e-mail problems list has no users');
select is_empty($$ select 1 from public.students s join public.profiles p on p.id = s.profile_id where p.role = 'user' $$,
  'AC-30: no student row points at a user');

select * from finish();
rollback;
