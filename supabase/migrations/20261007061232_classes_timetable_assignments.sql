-- R3a Staff dashboard: classes, weekly timetable, student roster, assignments and marking,
-- plus the admin activity list. Design: docs/requirements/release-3/r3a/design.md §3–§4.
-- Builds on 20261006004522_staff_accounts (profiles, roles, private.is_admin, audit_log).
--
-- Security notes (review H1–H7):
--   * Admins (active, two-step session) manage everything; a tutor sees only their own active
--     classes and what belongs to them. Deactivated staff see nothing.
--   * Clients can never write created_by, marked_by or marked_at: column grants leave them out
--     and triggers fill them in.


-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Students are roster records only (no logins until R3). Name and year level only: they are
-- children, so we keep the minimum (review H10).
create table public.students (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (char_length(trim(full_name)) between 2 and 100),
  year_level smallint check (year_level between 2 and 12), -- null: not at school (e.g. UCAT, GAMSAT)
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.students is 'Student roster managed by admins. No contact details by design.';

create table public.classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name)) between 2 and 100),
  subject    text not null check (subject ~ '^[a-z][a-z0-9-]{1,39}$'), -- a key from SUBJECTS
  year_level smallint check (year_level between 2 and 12),
  delivery   text not null default 'in_person' check (delivery in ('in_person', 'online')),
  location   text not null default '' check (char_length(location) <= 100),
  tutor_id   uuid references public.profiles (id) on delete set null,
  starts_on  date,
  ends_on    date,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_term_order check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create index classes_tutor_idx on public.classes (tutor_id);

comment on table public.classes is 'A class (R4 calls these communities). One tutor; archived, never deleted.';

-- Weekly recurring time slots, in Melbourne wall-clock time (design D5).
create table public.class_sessions (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7), -- ISO: 1 = Monday
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  constraint class_sessions_time_order check (end_time > start_time)
);

create index class_sessions_class_idx on public.class_sessions (class_id);

create table public.enrolments (
  class_id    uuid not null references public.classes (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create index enrolments_student_idx on public.enrolments (student_id);

create table public.assignments (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes (id) on delete cascade,
  title        text not null check (char_length(trim(title)) between 2 and 150),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  due_on       date,
  max_mark     smallint check (max_mark between 1 and 1000), -- null: feedback only
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index assignments_class_due_idx on public.assignments (class_id, due_on);

-- One row per student per assignment, created when a tutor first records something.
create table public.assignment_results (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id    uuid not null references public.students (id) on delete cascade,
  status        text not null default 'not_submitted'
                check (status in ('not_submitted', 'submitted', 'marked')),
  mark          numeric(6, 1) check (mark >= 0),
  feedback      text not null default '' check (char_length(feedback) <= 2000),
  marked_by     uuid references public.profiles (id) on delete set null,
  marked_at     timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (assignment_id, student_id)
);


-- ---------------------------------------------------------------------------
-- Who may see what (used by the policies below)
-- ---------------------------------------------------------------------------

-- The caller is active staff and the tutor of this active class.
create function private.teaches_class(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_staff()
     and exists (
       select 1 from public.classes c
       where c.id = target_class and c.tutor_id = (select auth.uid()) and c.is_active
     )
$$;

-- An admin, or the tutor of the assignment's class.
create function private.can_manage_assignment(target_assignment uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
      or exists (
        select 1 from public.assignments a
        where a.id = target_assignment and private.teaches_class(a.class_id)
      )
$$;

-- An admin, or a tutor who teaches the student in one of their active classes.
create function private.can_see_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
      or (
        private.is_active_staff()
        and exists (
          select 1
          from public.enrolments e
          join public.classes c on c.id = e.class_id
          where e.student_id = target_student and c.tutor_id = (select auth.uid()) and c.is_active
        )
      )
$$;


-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger students_set_updated_at
  before update on public.students
  for each row execute function private.set_updated_at();

create trigger classes_set_updated_at
  before update on public.classes
  for each row execute function private.set_updated_at();

create trigger assignments_set_updated_at
  before update on public.assignments
  for each row execute function private.set_updated_at();

create trigger assignment_results_set_updated_at
  before update on public.assignment_results
  for each row execute function private.set_updated_at();

-- created_by always comes from the session, never from the client (review H5).
create function private.set_assignment_creator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger assignments_set_creator
  before insert on public.assignments
  for each row execute function private.set_assignment_creator();

-- Marking rules (review H3, H4, H6):
--   * the student must be enrolled in the assignment's class;
--   * a mark needs a maximum, and can't be above it;
--   * marked_by / marked_at are set when something is marked, and cleared otherwise.
create function private.check_assignment_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_class uuid;
  allowed_max  smallint;
begin
  select a.class_id, a.max_mark
  into result_class, allowed_max
  from public.assignments a
  where a.id = new.assignment_id;

  if not exists (
    select 1 from public.enrolments e
    where e.class_id = result_class and e.student_id = new.student_id
  ) then
    raise exception 'not_enrolled';
  end if;

  if new.mark is not null and allowed_max is null then
    raise exception 'no_marks';
  end if;
  if new.mark is not null and new.mark > allowed_max then
    raise exception 'mark_too_high';
  end if;

  if new.status <> 'marked' then
    new.marked_by := null;
    new.marked_at := null;
  elsif tg_op = 'INSERT'
     or old.status <> 'marked'
     or old.mark is distinct from new.mark
     or old.feedback <> new.feedback then
    new.marked_by := (select auth.uid());
    new.marked_at := now();
  end if;
  return new;
end;
$$;

create trigger assignment_results_check
  before insert or update on public.assignment_results
  for each row execute function private.check_assignment_result();


-- ---------------------------------------------------------------------------
-- Activity list for admins (R2a story US19, page added with R3a)
-- ---------------------------------------------------------------------------

create function public.admin_list_activity(max_rows int default 100)
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
           coalesce(nullif(target.full_name, ''), target.email, l.details ->> 'email', ''),
           l.details
    from public.audit_log l
    left join public.profiles actor on actor.id = l.actor_id
    left join public.profiles target on target.id = l.target_id
    order by l.created_at desc, l.id desc
    limit least(greatest(coalesce(max_rows, 100), 1), 500);
end;
$$;


-- ---------------------------------------------------------------------------
-- Grants (review H1): reset Supabase's defaults, then allow only what the app uses.
-- ---------------------------------------------------------------------------

revoke all on public.students, public.classes, public.class_sessions, public.enrolments,
              public.assignments, public.assignment_results
  from anon, authenticated;

grant select on public.students, public.classes, public.class_sessions, public.enrolments,
                public.assignments, public.assignment_results
  to authenticated;

grant insert (full_name, year_level, is_active),
      update (full_name, year_level, is_active)
  on public.students to authenticated;

grant insert (name, subject, year_level, delivery, location, tutor_id, starts_on, ends_on, is_active),
      update (name, subject, year_level, delivery, location, tutor_id, starts_on, ends_on, is_active)
  on public.classes to authenticated;

grant insert (class_id, day_of_week, start_time, end_time), delete
  on public.class_sessions to authenticated;

grant insert (class_id, student_id), delete
  on public.enrolments to authenticated;

grant insert (class_id, title, instructions, due_on, max_mark),
      update (class_id, title, instructions, due_on, max_mark),
      delete
  on public.assignments to authenticated;

grant insert (assignment_id, student_id, status, mark, feedback),
      update (status, mark, feedback)
  on public.assignment_results to authenticated;

revoke execute on function
  private.teaches_class(uuid),
  private.can_manage_assignment(uuid),
  private.can_see_student(uuid),
  private.set_assignment_creator(),
  private.check_assignment_result()
from public, anon, authenticated;

grant execute on function
  private.teaches_class(uuid),
  private.can_manage_assignment(uuid),
  private.can_see_student(uuid)
to authenticated;

revoke execute on function public.admin_list_activity(int) from public, anon;
grant execute on function public.admin_list_activity(int) to authenticated;


-- ---------------------------------------------------------------------------
-- Row level security (design §4)
-- ---------------------------------------------------------------------------

alter table public.students enable row level security;
alter table public.classes enable row level security;
alter table public.class_sessions enable row level security;
alter table public.enrolments enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_results enable row level security;

-- Students
create policy "Admins, and tutors of the student's classes, read students"
  on public.students for select to authenticated
  using (private.can_see_student(id));

create policy "Admins add students"
  on public.students for insert to authenticated
  with check ((select private.is_admin()));

create policy "Admins change students"
  on public.students for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Classes
create policy "Admins, and the class tutor, read classes"
  on public.classes for select to authenticated
  using (
    (select private.is_admin())
    or (tutor_id = (select auth.uid()) and is_active and (select private.is_active_staff()))
  );

create policy "Admins add classes"
  on public.classes for insert to authenticated
  with check ((select private.is_admin()));

create policy "Admins change classes"
  on public.classes for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Timetable slots
create policy "Admins, and the class tutor, read timetable slots"
  on public.class_sessions for select to authenticated
  using ((select private.is_admin()) or private.teaches_class(class_id));

create policy "Admins add timetable slots"
  on public.class_sessions for insert to authenticated
  with check ((select private.is_admin()));

create policy "Admins remove timetable slots"
  on public.class_sessions for delete to authenticated
  using ((select private.is_admin()));

-- Enrolments
create policy "Admins, and the class tutor, read enrolments"
  on public.enrolments for select to authenticated
  using ((select private.is_admin()) or private.teaches_class(class_id));

create policy "Admins enrol students"
  on public.enrolments for insert to authenticated
  with check ((select private.is_admin()));

create policy "Admins remove enrolments"
  on public.enrolments for delete to authenticated
  using ((select private.is_admin()));

-- Assignments: the class tutor or an admin, both before and after a change (review H2)
create policy "Admins, and the class tutor, read assignments"
  on public.assignments for select to authenticated
  using ((select private.is_admin()) or private.teaches_class(class_id));

create policy "Admins, and the class tutor, add assignments"
  on public.assignments for insert to authenticated
  with check ((select private.is_admin()) or private.teaches_class(class_id));

create policy "Admins, and the class tutor, change assignments"
  on public.assignments for update to authenticated
  using ((select private.is_admin()) or private.teaches_class(class_id))
  with check ((select private.is_admin()) or private.teaches_class(class_id));

create policy "Admins, and the class tutor, delete assignments"
  on public.assignments for delete to authenticated
  using ((select private.is_admin()) or private.teaches_class(class_id));

-- Marks
create policy "Admins, and the class tutor, read marks"
  on public.assignment_results for select to authenticated
  using (private.can_manage_assignment(assignment_id));

create policy "Admins, and the class tutor, record marks"
  on public.assignment_results for insert to authenticated
  with check (private.can_manage_assignment(assignment_id));

create policy "Admins, and the class tutor, change marks"
  on public.assignment_results for update to authenticated
  using (private.can_manage_assignment(assignment_id))
  with check (private.can_manage_assignment(assignment_id));
