-- R3b Student & parent portal: family accounts, parent links and consent, and online assignments
-- (draft/published, questions, answers, submit and return). Design: docs/requirements/release-3/r3b/design.md §3–§4.
-- Builds on 20261006004522_staff_accounts and 20261007061232_classes_timetable_assignments.
-- The functions students and parents call are in the next migration.
--
-- Security notes (review F1–F31):
--   * A new account's role comes only from app_metadata.account_role, which only the server can set.
--   * Staff powers (tutor, admin) never extend to students or parents.
--   * Students and parents get no table policies: they read and write through functions only.


-- ---------------------------------------------------------------------------
-- Array checks: a null item is not a valid item (F31)
-- ---------------------------------------------------------------------------

create or replace function private.items_within_length(items text[], max_length int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(coalesce(char_length(trim(item)) between 1 and max_length, false)), true)
  from unnest(items) as item
$$;

create or replace function private.items_are_slugs(items text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(coalesce(item ~ '^[a-z][a-z0-9-]{1,39}$', false)), true)
  from unnest(items) as item
$$;


-- ---------------------------------------------------------------------------
-- Roles for new accounts (F1, F30)
-- ---------------------------------------------------------------------------

comment on table public.profiles is
  'One row per account: staff (tutor, admin) and families (student, parent). Created by a trigger on auth.users.';

-- 'student' or 'parent' from server-only app_metadata; anything else is a staff invite (tutor).
create function private.role_from_app_metadata(app_metadata jsonb)
returns public.app_role
language sql
immutable
set search_path = ''
as $$
  select case app_metadata ->> 'account_role'
           when 'student' then 'student'::public.app_role
           when 'parent' then 'parent'::public.app_role
           else 'tutor'::public.app_role
         end
$$;

-- New auth user → profile. Only full_name is read from user metadata (users can edit it).
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, invited_at, joined_at, last_sign_in_at)
  values (
    new.id,
    coalesce(lower(new.email), ''),
    left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100),
    private.role_from_app_metadata(new.raw_app_meta_data),
    new.invited_at,
    new.email_confirmed_at,
    new.last_sign_in_at
  );
  return new;
end;
$$;

-- Supabase Auth saves app_metadata in a second step after creating the user (spike F30), so the
-- role is applied on update too — but only before the person has joined. An account in use never
-- changes role this way (staff roles change through admin_set_role).
create function private.handle_auth_role_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set role = private.role_from_app_metadata(new.raw_app_meta_data)
  where id = new.id
    and joined_at is null
    and last_sign_in_at is null;
  return new;
end;
$$;

create trigger on_auth_user_role_assigned
  after update of raw_app_meta_data on auth.users
  for each row
  when (old.raw_app_meta_data ->> 'account_role' is distinct from new.raw_app_meta_data ->> 'account_role')
  execute function private.handle_auth_role_assigned();


-- ---------------------------------------------------------------------------
-- Staff powers are for tutors and admins only (F2)
-- ---------------------------------------------------------------------------

create or replace function private.is_active_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.my_active_role() in ('tutor', 'admin'), false)
$$;

-- Everyone with an active account can read their own profile (the portal needs their role and name).
-- Updates stay staff-only: families change nothing directly (D3).
drop policy "Staff read their own profile; admins read all" on public.profiles;

create policy "Members read their own profile; admins read all"
  on public.profiles for select to authenticated
  using (
    (id = (select auth.uid()) and (select private.my_active_role()) is not null)
    or (select private.is_admin())
  );

-- The staff list shows staff only; family accounts are managed from the student's page.
create or replace function public.admin_list_staff(target uuid default null)
returns table (
  id uuid,
  email text,
  full_name text,
  bio text,
  qualifications text[],
  subjects text[],
  avatar_path text,
  role public.app_role,
  is_active boolean,
  invited_at timestamptz,
  joined_at timestamptz,
  last_sign_in_at timestamptz,
  has_two_step boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
    select p.id, p.email, p.full_name, p.bio, p.qualifications, p.subjects, p.avatar_path,
           p.role, p.is_active, p.invited_at, p.joined_at, p.last_sign_in_at,
           exists (
             select 1 from auth.mfa_factors f
             where f.user_id = p.id and f.status = 'verified'
           )
    from public.profiles p
    where p.role in ('tutor', 'admin')
      and (target is null or p.id = target)
    order by lower(p.full_name), p.email;
end;
$$;

-- Staff roles only: a student or parent can't be made staff, or the other way round.
create or replace function public.admin_set_role(target uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role_value public.app_role;
  has_joined boolean;
begin
  -- Lock first, then check the caller, so a caller demoted a moment ago is refused.
  perform private.lock_admin_changes();
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select p.role, p.joined_at is not null
  into current_role_value, has_joined
  from public.profiles p
  where p.id = target;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if current_role_value not in ('tutor', 'admin') or new_role not in ('tutor', 'admin') then
    raise exception 'not_staff';
  end if;
  if not has_joined then
    raise exception 'not_joined';
  end if;
  if current_role_value = new_role then
    return;
  end if;
  if new_role <> 'admin' and private.is_last_active_admin(target) then
    raise exception 'last_admin';
  end if;

  update public.profiles set role = new_role where id = target;

  insert into public.audit_log (actor_id, action, target_id, details)
  values ((select auth.uid()), 'role_changed', target,
          jsonb_build_object('from', current_role_value, 'to', new_role));
end;
$$;


-- ---------------------------------------------------------------------------
-- Audit: family account actions (F29)
-- ---------------------------------------------------------------------------

alter table public.audit_log
  drop constraint audit_log_action_check,
  add constraint audit_log_action_check check (action in (
    'invite_sent', 'invite_resent', 'invite_cancelled',
    'role_changed', 'deactivated', 'reactivated',
    'two_step_reset', 'profile_edited_by_admin',
    'student_invited', 'parent_invited', 'parent_linked', 'parent_unlinked', 'consent_recorded'));

-- Consent has no account to point at yet, so its entries name the student in the details.
create or replace function public.admin_list_activity(max_rows int default 100)
returns table (
  id bigint,
  created_at timestamptz,
  action text,
  actor_name text,
  target_name text,
  details jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
    select l.id,
           l.created_at,
           l.action,
           coalesce(nullif(actor.full_name, ''), actor.email, ''),
           -- a cancelled invite has no profile any more; its e-mail is kept in details
           coalesce(nullif(target.full_name, ''), target.email, l.details ->> 'email',
                    l.details ->> 'student_name', ''),
           l.details
    from public.audit_log l
    left join public.profiles actor on actor.id = l.actor_id
    left join public.profiles target on target.id = l.target_id
    order by l.created_at desc, l.id desc
    limit least(greatest(coalesce(max_rows, 100), 1), 500);
end;
$$;


-- ---------------------------------------------------------------------------
-- Students: their own account and parental consent (D1, D5, F3, F4)
-- ---------------------------------------------------------------------------

alter table public.students
  add column profile_id uuid unique references public.profiles (id) on delete set null,
  add column consent_recorded_at timestamptz,
  add column consent_recorded_by uuid references public.profiles (id) on delete set null,
  add column consent_source text check (consent_source in ('admin', 'parent')),
  add constraint students_consent_complete
    check ((consent_recorded_at is null) = (consent_source is null));

comment on column public.students.profile_id is
  'The student''s own sign-in account, linked by the account-admin function (R3b).';
comment on column public.students.consent_source is
  'Who recorded parental consent: an admin (e.g. a paper form) or a linked parent in the portal.';

-- A student's account must be a student account, and needs consent first (F3, F4).
create function private.check_student_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = new.profile_id and p.role = 'student'
  ) then
    raise exception 'not_a_student_account';
  end if;
  if new.consent_recorded_at is null then
    raise exception 'consent_needed';
  end if;
  return new;
end;
$$;

create trigger students_check_account
  before insert or update of profile_id on public.students
  for each row execute function private.check_student_account();

-- Which parents can see which students. Many to many: two parents, or siblings (F26).
create table public.student_guardians (
  student_id uuid not null references public.students (id) on delete cascade,
  parent_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, parent_id)
);

create index student_guardians_parent_idx on public.student_guardians (parent_id);

comment on table public.student_guardians is
  'Parent accounts linked to students. Added by the account-admin function; removed by admin_unlink_parent.';

create function private.check_guardian_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = new.parent_id and p.role = 'parent'
  ) then
    raise exception 'not_a_parent_account';
  end if;
  return new;
end;
$$;

create trigger student_guardians_check_account
  before insert or update on public.student_guardians
  for each row execute function private.check_guardian_account();


-- ---------------------------------------------------------------------------
-- Assignments: draft → published (D8, F9)
-- ---------------------------------------------------------------------------

alter table public.assignments
  add column status text not null default 'draft' check (status in ('draft', 'published')),
  add column published_at timestamptz;

-- R3a assignments were already in use.
update public.assignments set status = 'published', published_at = created_at;

-- published_at follows the status. Back to draft, or into another class, only while no student
-- has work on it.
create function private.check_assignment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_work boolean := tg_op = 'UPDATE' and exists (
    select 1 from public.assignment_results r
    where r.assignment_id = new.id and r.status <> 'not_submitted'
  );
begin
  if tg_op = 'UPDATE' and new.class_id <> old.class_id and has_work then
    raise exception 'has_submissions';
  end if;

  if new.status = 'draft' then
    if tg_op = 'UPDATE' and old.status = 'published' and has_work then
      raise exception 'has_submissions';
    end if;
    new.published_at := null;
  elsif tg_op = 'INSERT' or old.status <> 'published' then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger assignments_check_status
  before insert or update of status, class_id on public.assignments
  for each row execute function private.check_assignment_status();


-- ---------------------------------------------------------------------------
-- Questions (D6, D7, F9, F15)
-- ---------------------------------------------------------------------------

create table public.assignment_questions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  position       int not null default 1 check (position >= 1), -- the trigger puts new questions last
  kind           text not null check (kind in ('multiple_choice', 'written')),
  prompt         text not null check (char_length(trim(prompt)) between 1 and 2000),
  options        text[] not null default '{}',
  correct_option smallint, -- 0-based index into options
  marks          smallint not null default 1 check (marks between 1 and 100),
  explanation    text not null default '' check (char_length(explanation) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Checked at the end of each statement, so two questions can swap places in one update.
  constraint assignment_questions_position_key
    unique (assignment_id, position) deferrable initially immediate,
  constraint assignment_questions_id_assignment_key unique (id, assignment_id),
  -- Multiple choice: 2–6 options of 1–300 characters and one correct option. Written: neither.
  constraint assignment_questions_shape check (
    (kind = 'multiple_choice'
      and cardinality(options) between 2 and 6
      and private.items_within_length(options, 300)
      and correct_option between 0 and cardinality(options) - 1)
    or (kind = 'written' and cardinality(options) = 0 and correct_option is null)
  )
);

comment on table public.assignment_questions is
  'Questions of an online assignment. Changeable only while the assignment is a draft.';

-- Questions change only while the assignment is a draft. New questions go last; at most 50.
create function private.check_assignment_question()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_assignment uuid := case when tg_op = 'DELETE' then old.assignment_id else new.assignment_id end;
  assignment_status text;
begin
  -- Locking the assignment row serialises question changes with publishing.
  select a.status into assignment_status
  from public.assignments a
  where a.id = target_assignment
  for update;

  -- The assignment itself is being deleted (cascade): nothing left to protect.
  if not found then
    return old;
  end if;
  if assignment_status <> 'draft' then
    raise exception 'assignment_published';
  end if;
  if tg_op = 'UPDATE' and new.assignment_id <> old.assignment_id then
    raise exception 'invalid_input';
  end if;

  if tg_op = 'INSERT' then
    if (select count(*) from public.assignment_questions q where q.assignment_id = target_assignment) >= 50 then
      raise exception 'too_many_questions';
    end if;
    new.position := coalesce(
      (select max(q.position) from public.assignment_questions q where q.assignment_id = target_assignment),
      0
    ) + 1;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger assignment_questions_check
  before insert or update or delete on public.assignment_questions
  for each row execute function private.check_assignment_question();

create trigger assignment_questions_set_updated_at
  before update on public.assignment_questions
  for each row execute function private.set_updated_at();

-- Total possible: the sum of the question marks, or max_mark for paper homework (null: feedback only).
create function private.assignment_total_marks(target_assignment uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select sum(q.marks)::int from public.assignment_questions q where q.assignment_id = target_assignment),
    (select a.max_mark::int from public.assignments a where a.id = target_assignment)
  )
$$;

-- Online work has questions; paper homework doesn't (D6).
create function private.is_online_assignment(target_assignment uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assignment_questions q where q.assignment_id = target_assignment
  )
$$;


-- ---------------------------------------------------------------------------
-- Results: new statuses and times (D8, F11–F14)
-- ---------------------------------------------------------------------------

alter table public.assignment_results
  drop constraint assignment_results_status_check,
  add constraint assignment_results_status_check
    check (status in ('not_submitted', 'in_progress', 'submitted', 'marked', 'returned')),
  add column submitted_at timestamptz,
  add column returned_at timestamptz;

comment on column public.assignment_results.feedback is
  'The tutor''s overall comment. Students and their parents see it once the work is returned.';

-- Marking rules (R3a review H3, H4, H6; R3b F11–F13):
--   * only published assignments, and only students enrolled in the class;
--   * a mark needs a total (question marks or max_mark) and can't be above it;
--   * online work: not started → in progress → submitted (by the student, through the student
--     functions) → returned (by staff, once every answer has a mark). Staff can't make any other
--     status change, and "marked" isn't used.
--   * paper homework: not submitted → submitted → marked → returned, all by staff;
--   * submitted_at / returned_at follow the status; marked_by records staff only, so an automatic
--     return is marked by nobody.
create or replace function private.check_assignment_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_class     uuid;
  assignment_state text;
  total_marks      int;
  is_online        boolean;
  by_staff         boolean := private.is_active_staff();
  status_changed   boolean := tg_op = 'INSERT' or new.status <> old.status;
begin
  -- A share lock waits for a publish/unpublish in progress, so work never lands on a draft.
  select a.class_id, a.status
  into result_class, assignment_state
  from public.assignments a
  where a.id = new.assignment_id
  for share;

  if assignment_state <> 'published' then
    raise exception 'not_published';
  end if;
  if not exists (
    select 1 from public.enrolments e
    where e.class_id = result_class and e.student_id = new.student_id
  ) then
    raise exception 'not_enrolled';
  end if;

  total_marks := private.assignment_total_marks(new.assignment_id);
  is_online := private.is_online_assignment(new.assignment_id);

  if new.mark is not null and total_marks is null then
    raise exception 'no_marks';
  end if;
  if new.mark is not null and new.mark > total_marks then
    raise exception 'mark_too_high';
  end if;

  if status_changed then
    if is_online and (
         new.status = 'marked'
         or (by_staff and not (tg_op = 'UPDATE' and old.status = 'submitted' and new.status = 'returned'))
       ) then
      raise exception 'invalid_status';
    end if;
    if not is_online and new.status = 'in_progress' then
      raise exception 'invalid_status';
    end if;

    -- Handed in: keeps the first hand-in time. Marked or returned paper homework that was
    -- never marked as handed in has no hand-in time (so it is never "late").
    if new.status in ('not_submitted', 'in_progress') then
      new.submitted_at := null;
    elsif new.status = 'submitted' then
      new.submitted_at := coalesce(new.submitted_at, now());
    end if;
    new.returned_at := case when new.status = 'returned' then now() end;
  end if;

  if is_online and new.status = 'returned' and status_changed then
    if new.submitted_at is null then
      raise exception 'not_submitted';
    end if;
    if exists (
      select 1
      from public.assignment_questions q
      left join public.assignment_answers ans
        on ans.question_id = q.id and ans.student_id = new.student_id
      where q.assignment_id = new.assignment_id and ans.awarded_marks is null
    ) then
      raise exception 'unmarked_answers';
    end if;
  end if;

  if new.status not in ('marked', 'returned') then
    new.marked_by := null;
    new.marked_at := null;
  elsif tg_op = 'INSERT'
     or old.status not in ('marked', 'returned')
     or old.mark is distinct from new.mark
     or old.feedback <> new.feedback then
    new.marked_by := case when by_staff then (select auth.uid()) end;
    new.marked_at := now();
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- Answers (FS2, FT3, F10, F13, F17)
-- ---------------------------------------------------------------------------

create table public.assignment_answers (
  assignment_id   uuid not null,
  question_id     uuid not null,
  student_id      uuid not null references public.students (id) on delete cascade,
  selected_option smallint check (selected_option between 0 and 5), -- multiple choice
  response        text not null default '' check (char_length(response) <= 5000), -- written
  awarded_marks   numeric(5, 1) check (awarded_marks >= 0),
  feedback        text not null default '' check (char_length(feedback) <= 1000),
  updated_at      timestamptz not null default now(),
  primary key (question_id, student_id),
  foreign key (question_id, assignment_id)
    references public.assignment_questions (id, assignment_id) on delete cascade,
  foreign key (assignment_id, student_id)
    references public.assignment_results (assignment_id, student_id) on delete cascade
);

create index assignment_answers_result_idx on public.assignment_answers (assignment_id, student_id);

comment on table public.assignment_answers is
  'A student''s answer to one question, with the tutor''s marks and feedback. Written by the student functions.';

-- An option must exist; marks can't be above the question's marks; marks and feedback only
-- once the work has been submitted.
create function private.check_assignment_answer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  question_kind  text;
  question_marks smallint;
  option_count   int;
  result_status  text;
begin
  select q.kind, q.marks, cardinality(q.options)
  into question_kind, question_marks, option_count
  from public.assignment_questions q
  where q.id = new.question_id;

  if new.selected_option is not null
     and (question_kind <> 'multiple_choice' or new.selected_option >= option_count) then
    raise exception 'invalid_option';
  end if;
  if new.awarded_marks is not null and new.awarded_marks > question_marks then
    raise exception 'mark_too_high';
  end if;

  if (tg_op = 'INSERT' and (new.awarded_marks is not null or new.feedback <> ''))
     or (tg_op = 'UPDATE' and (new.awarded_marks is distinct from old.awarded_marks
                               or new.feedback <> old.feedback)) then
    select r.status into result_status
    from public.assignment_results r
    where r.assignment_id = new.assignment_id and r.student_id = new.student_id;

    if result_status not in ('submitted', 'returned') then
      raise exception 'not_submitted';
    end if;
  end if;
  return new;
end;
$$;

create trigger assignment_answers_check
  before insert or update on public.assignment_answers
  for each row execute function private.check_assignment_answer();

create trigger assignment_answers_set_updated_at
  before update on public.assignment_answers
  for each row execute function private.set_updated_at();

-- The result's mark is the sum of the awarded marks (null until something has a mark).
create function private.update_result_mark()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  total numeric;
begin
  select sum(ans.awarded_marks) into total
  from public.assignment_answers ans
  where ans.assignment_id = new.assignment_id and ans.student_id = new.student_id;

  update public.assignment_results r
  set mark = total
  where r.assignment_id = new.assignment_id
    and r.student_id = new.student_id
    and r.mark is distinct from total;
  return null;
end;
$$;

create trigger assignment_answers_update_mark
  after insert or update of awarded_marks on public.assignment_answers
  for each row execute function private.update_result_mark();


-- ---------------------------------------------------------------------------
-- Grants: reset Supabase's defaults, then allow only what staff pages use. Students and parents
-- use the functions in the next migration (D4).
-- ---------------------------------------------------------------------------

revoke all on public.student_guardians, public.assignment_questions, public.assignment_answers
  from anon, authenticated;

grant select on public.student_guardians to authenticated; -- RLS: admins only

grant insert (status), update (status) on public.assignments to authenticated;

grant select, delete on public.assignment_questions to authenticated;
grant insert (assignment_id, kind, prompt, options, correct_option, marks, explanation),
      update (kind, prompt, options, correct_option, marks, explanation)
  on public.assignment_questions to authenticated;

grant select, update (awarded_marks, feedback) on public.assignment_answers to authenticated;

-- New private functions are callable by nobody by default; policies need only these.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.my_active_role(),
  private.is_active_staff(),
  private.is_admin(),
  private.items_within_length(text[], int),
  private.items_are_slugs(text[]),
  private.teaches_class(uuid),
  private.can_manage_assignment(uuid),
  private.can_see_student(uuid)
to authenticated;

revoke execute on function
  public.admin_list_staff(uuid),
  public.admin_set_role(uuid, public.app_role),
  public.admin_list_activity(int)
from public, anon;


-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.student_guardians enable row level security;
alter table public.assignment_questions enable row level security;
alter table public.assignment_answers enable row level security;

create policy "Admins read parent links"
  on public.student_guardians for select to authenticated
  using ((select private.is_admin()));

create policy "Admins, and the class tutor, read questions"
  on public.assignment_questions for select to authenticated
  using (private.can_manage_assignment(assignment_id));

create policy "Admins, and the class tutor, add questions"
  on public.assignment_questions for insert to authenticated
  with check (private.can_manage_assignment(assignment_id));

create policy "Admins, and the class tutor, change questions"
  on public.assignment_questions for update to authenticated
  using (private.can_manage_assignment(assignment_id))
  with check (private.can_manage_assignment(assignment_id));

create policy "Admins, and the class tutor, delete questions"
  on public.assignment_questions for delete to authenticated
  using (private.can_manage_assignment(assignment_id));

create policy "Admins, and the class tutor, read answers"
  on public.assignment_answers for select to authenticated
  using (private.can_manage_assignment(assignment_id));

create policy "Admins, and the class tutor, mark answers"
  on public.assignment_answers for update to authenticated
  using (private.can_manage_assignment(assignment_id))
  with check (private.can_manage_assignment(assignment_id));
