-- R3b Student & parent portal: the functions students and parents use (they have no table access,
-- design D4), admin consent and parent links, and question reordering for tutors.
-- Design: docs/requirements/release-3/r3b/design.md §4.
--
-- Hiding rules shared by students and parents (review F5, F12):
--   * before the work is returned: no marks, feedback, correct options or explanations;
--   * parents see the child's answers only once the work is submitted.
-- Every function checks the caller first; errors are message keys the web app maps to text.


-- ---------------------------------------------------------------------------
-- Who is calling?
-- ---------------------------------------------------------------------------

-- The caller's roster row: an active student account linked to an active student (F7).
create function private.my_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.profile_id = (select auth.uid())
    and s.is_active
    and p.is_active
    and p.role = 'student'
$$;

-- The caller is an active parent linked to this active student (F6, F7).
create function private.is_my_child(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.my_active_role() = 'parent', false)
     and exists (
       select 1
       from public.student_guardians g
       join public.students s on s.id = g.student_id
       where g.student_id = target_student
         and g.parent_id = (select auth.uid())
         and s.is_active
     )
$$;

create function private.require_student()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := private.my_student_id();
begin
  if me is null then
    raise exception 'not_student' using errcode = '42501';
  end if;
  return me;
end;
$$;

create function private.require_parent()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(private.my_active_role() <> 'parent', true) then
    raise exception 'not_parent' using errcode = '42501';
  end if;
  return (select auth.uid());
end;
$$;

-- "Not found" for anyone who isn't this child's parent, so other children's ids reveal nothing.
create function private.require_my_child(target_student uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_my_child(target_student) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return target_student;
end;
$$;


-- ---------------------------------------------------------------------------
-- What a student (and their parents) can see
-- ---------------------------------------------------------------------------

-- A published assignment in an active class the student is enrolled in (FT2).
create function private.assignment_visible_to(target_student uuid, target_assignment uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments a
    join public.classes c on c.id = a.class_id
    join public.enrolments e on e.class_id = a.class_id
    where a.id = target_assignment
      and a.status = 'published'
      and c.is_active
      and e.student_id = target_student
  )
$$;

-- Families see four steps. Paper homework that is marked but not returned is still "submitted".
create function private.family_status(result_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case coalesce(result_status, 'not_submitted')
           when 'not_submitted' then 'not_started'
           when 'in_progress' then 'in_progress'
           when 'returned' then 'returned'
           else 'submitted'
         end
$$;

-- Handed in after the due date, by the Melbourne calendar (F14).
create function private.is_late(submitted timestamptz, due date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((submitted at time zone 'Australia/Melbourne')::date > due, false)
$$;

-- Every assignment the student can see, with their progress. Marks and the overall comment only
-- once returned; parents don't get the answered count (it describes draft work).
create function private.assignments_for_student(target_student uuid, for_parent boolean)
returns table (
  assignment_id  uuid,
  title          text,
  class_name     text,
  subject        text,
  due_on         date,
  published_at   timestamptz,
  question_count int,
  answered_count int,
  total_marks    int,
  status         text,
  submitted_at   timestamptz,
  returned_at    timestamptz,
  is_late        boolean,
  mark           numeric,
  comment        text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id,
         a.title,
         c.name,
         c.subject,
         a.due_on,
         a.published_at,
         (select count(*)::int from public.assignment_questions q where q.assignment_id = a.id),
         case when not for_parent then (
           select count(*)::int
           from public.assignment_answers ans
           where ans.assignment_id = a.id
             and ans.student_id = target_student
             and (ans.selected_option is not null or trim(ans.response) <> '')
         ) end,
         private.assignment_total_marks(a.id),
         private.family_status(r.status),
         case when r.status in ('submitted', 'marked', 'returned') then r.submitted_at end,
         case when r.status = 'returned' then r.returned_at end,
         private.is_late(r.submitted_at, a.due_on),
         case when r.status = 'returned' then r.mark end,
         case when r.status = 'returned' then r.feedback else '' end
  from public.assignments a
  join public.classes c on c.id = a.class_id
  join public.enrolments e on e.class_id = a.class_id and e.student_id = target_student
  left join public.assignment_results r on r.assignment_id = a.id and r.student_id = target_student
  where a.status = 'published'
    and c.is_active
  order by a.due_on nulls last, a.published_at desc
$$;

-- One assignment with its questions, as JSON for the solve and results pages. Null when the
-- student can't see it.
create function private.assignment_view(target_student uuid, target_assignment uuid, for_parent boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  summary      record;
  is_returned  boolean;
  show_answers boolean;
begin
  select s.* into summary
  from private.assignments_for_student(target_student, for_parent) s
  where s.assignment_id = target_assignment;

  if not found then
    return null;
  end if;

  is_returned := summary.status = 'returned';
  show_answers := not for_parent or summary.status in ('submitted', 'returned');

  return jsonb_build_object(
    'id', summary.assignment_id,
    'title', summary.title,
    'instructions', (select a.instructions from public.assignments a where a.id = target_assignment),
    'className', summary.class_name,
    'subject', summary.subject,
    'dueOn', summary.due_on,
    'status', summary.status,
    'submittedAt', summary.submitted_at,
    'returnedAt', summary.returned_at,
    'isLate', summary.is_late,
    'totalMarks', summary.total_marks,
    'mark', summary.mark,
    'comment', summary.comment,
    'questions', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', q.id,
                 'kind', q.kind,
                 'prompt', q.prompt,
                 'options', to_jsonb(q.options),
                 'marks', q.marks,
                 'selectedOption', case when show_answers then ans.selected_option end,
                 'response', case when show_answers then coalesce(ans.response, '') else '' end,
                 'correctOption', case when is_returned then q.correct_option end,
                 'explanation', case when is_returned then q.explanation else '' end,
                 'awardedMarks', case when is_returned then ans.awarded_marks end,
                 'feedback', case when is_returned then coalesce(ans.feedback, '') else '' end
               )
               order by q.position
             )
      from public.assignment_questions q
      left join public.assignment_answers ans
        on ans.question_id = q.id and ans.student_id = target_student
      where q.assignment_id = target_assignment
    ), '[]'::jsonb)
  );
end;
$$;

-- The student's weekly classes (FS5): active classes they're enrolled in.
create function private.timetable_for_student(target_student uuid)
returns table (
  session_id  uuid,
  class_id    uuid,
  class_name  text,
  subject     text,
  delivery    text,
  location    text,
  tutor_name  text,
  day_of_week smallint,
  start_time  time,
  end_time    time,
  starts_on   date,
  ends_on     date
)
language sql
stable
security definer
set search_path = ''
as $$
  select cs.id, c.id, c.name, c.subject, c.delivery, c.location,
         coalesce(t.full_name, ''),
         cs.day_of_week, cs.start_time, cs.end_time, c.starts_on, c.ends_on
  from public.enrolments e
  join public.classes c on c.id = e.class_id
  join public.class_sessions cs on cs.class_id = c.id
  left join public.profiles t on t.id = c.tutor_id
  where e.student_id = target_student
    and c.is_active
  order by cs.day_of_week, cs.start_time
$$;

-- A parent's linked, active children (FP1). Parents see names and classes only (F18).
create function private.children_of(target_parent uuid)
returns table (
  student_id          uuid,
  full_name           text,
  year_level          smallint,
  consent_recorded_at timestamptz,
  account_status      text,
  class_names         text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,
         s.full_name,
         s.year_level,
         s.consent_recorded_at,
         case
           when p.id is null then 'none'
           when not p.is_active then 'deactivated'
           when p.joined_at is null then 'invited'
           else 'active'
         end,
         coalesce(
           (select array_agg(c.name order by c.name)
            from public.enrolments e
            join public.classes c on c.id = e.class_id
            where e.student_id = s.id and c.is_active),
           '{}'
         )
  from public.student_guardians g
  join public.students s on s.id = g.student_id
  left join public.profiles p on p.id = s.profile_id
  where g.parent_id = target_parent
    and s.is_active
  order by s.full_name
$$;


-- ---------------------------------------------------------------------------
-- Student functions (FS1–FS5)
-- ---------------------------------------------------------------------------

create function public.student_assignments()
returns table (
  assignment_id  uuid,
  title          text,
  class_name     text,
  subject        text,
  due_on         date,
  published_at   timestamptz,
  question_count int,
  answered_count int,
  total_marks    int,
  status         text,
  submitted_at   timestamptz,
  returned_at    timestamptz,
  is_late        boolean,
  mark           numeric,
  comment        text
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.assignments_for_student(private.require_student(), false)
$$;

create function public.student_assignment(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found_view jsonb := private.assignment_view(private.require_student(), target, false);
begin
  if found_view is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return found_view;
end;
$$;

-- Saves one answer while the work is not yet submitted (F10). The first save starts the work.
create function public.student_save_answer(
  target_assignment uuid,
  target_question uuid,
  chosen_option int default null,
  answer_text text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me             uuid := private.require_student();
  question_kind  text;
  option_count   int;
  current_status text;
begin
  if not private.assignment_visible_to(me, target_assignment) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select q.kind, cardinality(q.options)
  into question_kind, option_count
  from public.assignment_questions q
  where q.id = target_question and q.assignment_id = target_assignment;

  if not found then
    raise exception 'invalid_question';
  end if;
  if question_kind = 'multiple_choice' and chosen_option is not null
     and (chosen_option < 0 or chosen_option >= option_count) then
    raise exception 'invalid_option';
  end if;
  if char_length(coalesce(answer_text, '')) > 5000 then
    raise exception 'answer_too_long';
  end if;

  -- Start (or find) the work, locked so a submit from another tab waits for this save.
  insert into public.assignment_results (assignment_id, student_id, status)
  values (target_assignment, me, 'in_progress')
  on conflict (assignment_id, student_id) do nothing;

  select r.status into current_status
  from public.assignment_results r
  where r.assignment_id = target_assignment and r.student_id = me
  for update;

  if current_status not in ('not_submitted', 'in_progress') then
    raise exception 'already_submitted';
  end if;
  if current_status = 'not_submitted' then
    update public.assignment_results
    set status = 'in_progress'
    where assignment_id = target_assignment and student_id = me;
  end if;

  insert into public.assignment_answers (assignment_id, question_id, student_id, selected_option, response)
  values (
    target_assignment,
    target_question,
    me,
    case when question_kind = 'multiple_choice' then chosen_option end,
    case when question_kind = 'written' then coalesce(answer_text, '') else '' end
  )
  on conflict (question_id, student_id) do update
    set selected_option = excluded.selected_option,
        response = excluded.response;
end;
$$;

-- Hands the work in (F27: only once). Multiple choice marks itself and blank written answers get 0
-- (F13); with no written questions the work comes straight back (D8). Returns the new status.
create function public.student_submit(target_assignment uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me             uuid := private.require_student();
  current_status text;
begin
  if not private.assignment_visible_to(me, target_assignment) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.is_online_assignment(target_assignment) then
    raise exception 'not_online';
  end if;

  insert into public.assignment_results (assignment_id, student_id, status)
  values (target_assignment, me, 'in_progress')
  on conflict (assignment_id, student_id) do nothing;

  select r.status into current_status
  from public.assignment_results r
  where r.assignment_id = target_assignment and r.student_id = me
  for update;

  if current_status not in ('not_submitted', 'in_progress') then
    raise exception 'already_submitted';
  end if;

  -- Every question gets an answer row, so unanswered ones can be marked too.
  insert into public.assignment_answers (assignment_id, question_id, student_id)
  select target_assignment, q.id, me
  from public.assignment_questions q
  where q.assignment_id = target_assignment
  on conflict (question_id, student_id) do nothing;

  update public.assignment_results
  set status = 'submitted'
  where assignment_id = target_assignment and student_id = me;

  update public.assignment_answers ans
  set awarded_marks = case
                        when q.kind = 'multiple_choice' and ans.selected_option = q.correct_option then q.marks
                        else 0
                      end
  from public.assignment_questions q
  where q.id = ans.question_id
    and ans.assignment_id = target_assignment
    and ans.student_id = me
    and (q.kind = 'multiple_choice' or trim(ans.response) = '');

  if exists (
    select 1 from public.assignment_questions q
    where q.assignment_id = target_assignment and q.kind = 'written'
  ) then
    return 'submitted';
  end if;

  update public.assignment_results
  set status = 'returned'
  where assignment_id = target_assignment and student_id = me;
  return 'returned';
end;
$$;

create function public.student_timetable()
returns table (
  session_id  uuid,
  class_id    uuid,
  class_name  text,
  subject     text,
  delivery    text,
  location    text,
  tutor_name  text,
  day_of_week smallint,
  start_time  time,
  end_time    time,
  starts_on   date,
  ends_on     date
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.timetable_for_student(private.require_student())
$$;


-- ---------------------------------------------------------------------------
-- Parent functions (FP1–FP3)
-- ---------------------------------------------------------------------------

create function public.parent_children()
returns table (
  student_id          uuid,
  full_name           text,
  year_level          smallint,
  consent_recorded_at timestamptz,
  account_status      text,
  class_names         text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.children_of(private.require_parent())
$$;

create function public.parent_child_assignments(target_student uuid)
returns table (
  assignment_id  uuid,
  title          text,
  class_name     text,
  subject        text,
  due_on         date,
  published_at   timestamptz,
  question_count int,
  answered_count int,
  total_marks    int,
  status         text,
  submitted_at   timestamptz,
  returned_at    timestamptz,
  is_late        boolean,
  mark           numeric,
  comment        text
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.assignments_for_student(private.require_my_child(target_student), true)
$$;

create function public.parent_child_assignment(target_student uuid, target_assignment uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found_view jsonb := private.assignment_view(private.require_my_child(target_student), target_assignment, true);
begin
  if found_view is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return found_view;
end;
$$;

create function public.parent_child_timetable(target_student uuid)
returns table (
  session_id  uuid,
  class_id    uuid,
  class_name  text,
  subject     text,
  delivery    text,
  location    text,
  tutor_name  text,
  day_of_week smallint,
  start_time  time,
  end_time    time,
  starts_on   date,
  ends_on     date
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.timetable_for_student(private.require_my_child(target_student))
$$;

-- A linked parent allows their child to use the portal (FP3, F4). Recorded once; audited.
create function public.parent_give_consent(target_student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_name text;
begin
  perform private.require_my_child(target_student);

  update public.students
  set consent_recorded_at = now(),
      consent_recorded_by = (select auth.uid()),
      consent_source = 'parent'
  where id = target_student and consent_recorded_at is null
  returning full_name into student_name;

  if found then
    insert into public.audit_log (actor_id, action, target_id, details)
    values ((select auth.uid()), 'consent_recorded', null,
            jsonb_build_object('student_id', target_student, 'student_name', student_name,
                               'source', 'parent'));
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- Admin functions (FA1, FA2)
-- ---------------------------------------------------------------------------

-- Consent given outside the portal, e.g. on a paper enrolment form. Recorded once; audited.
create function public.admin_record_consent(target_student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_name text;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if not exists (select 1 from public.students s where s.id = target_student) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.students
  set consent_recorded_at = now(),
      consent_recorded_by = (select auth.uid()),
      consent_source = 'admin'
  where id = target_student and consent_recorded_at is null
  returning full_name into student_name;

  if found then
    insert into public.audit_log (actor_id, action, target_id, details)
    values ((select auth.uid()), 'consent_recorded', null,
            jsonb_build_object('student_id', target_student, 'student_name', student_name,
                               'source', 'admin'));
  end if;
end;
$$;

-- Removes a parent's link to a student, e.g. linked by mistake (F25). Audited.
create function public.admin_unlink_parent(target_student uuid, target_parent uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_name text;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  delete from public.student_guardians g
  where g.student_id = target_student and g.parent_id = target_parent;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select s.full_name into student_name from public.students s where s.id = target_student;

  insert into public.audit_log (actor_id, action, target_id, details)
  values ((select auth.uid()), 'parent_unlinked', target_parent,
          jsonb_build_object('student_id', target_student, 'student_name', student_name));
end;
$$;


-- ---------------------------------------------------------------------------
-- Tutors: move a question up (-1) or down (+1) while the assignment is a draft (FT1)
-- ---------------------------------------------------------------------------

create function public.move_question(target uuid, step int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  moving    record;
  neighbour record;
begin
  if step not in (-1, 1) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  select q.id, q.assignment_id, q.position into moving
  from public.assignment_questions q
  where q.id = target;

  if not found or not private.can_manage_assignment(moving.assignment_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select q.id, q.position into neighbour
  from public.assignment_questions q
  where q.assignment_id = moving.assignment_id
    and (case when step < 0 then q.position < moving.position else q.position > moving.position end)
  order by case when step < 0 then -q.position else q.position end
  limit 1;

  if not found then
    return; -- already first or last
  end if;

  -- One statement, so the unique position check runs after both rows have moved.
  update public.assignment_questions q
  set position = case when q.id = moving.id then neighbour.position else moving.position end
  where q.id in (moving.id, neighbour.id);
end;
$$;


-- ---------------------------------------------------------------------------
-- Grants: private helpers run only inside the functions above; the public functions check the
-- caller themselves, so any signed-in user may call them.
-- ---------------------------------------------------------------------------

revoke execute on function
  private.my_student_id(),
  private.is_my_child(uuid),
  private.require_student(),
  private.require_parent(),
  private.require_my_child(uuid),
  private.assignment_visible_to(uuid, uuid),
  private.family_status(text),
  private.is_late(timestamptz, date),
  private.assignments_for_student(uuid, boolean),
  private.assignment_view(uuid, uuid, boolean),
  private.timetable_for_student(uuid),
  private.children_of(uuid)
from public, anon, authenticated;

revoke execute on function
  public.student_assignments(),
  public.student_assignment(uuid),
  public.student_save_answer(uuid, uuid, int, text),
  public.student_submit(uuid),
  public.student_timetable(),
  public.parent_children(),
  public.parent_child_assignments(uuid),
  public.parent_child_assignment(uuid, uuid),
  public.parent_child_timetable(uuid),
  public.parent_give_consent(uuid),
  public.admin_record_consent(uuid),
  public.admin_unlink_parent(uuid, uuid),
  public.move_question(uuid, int)
from public, anon, authenticated;

grant execute on function
  public.student_assignments(),
  public.student_assignment(uuid),
  public.student_save_answer(uuid, uuid, int, text),
  public.student_submit(uuid),
  public.student_timetable(),
  public.parent_children(),
  public.parent_child_assignments(uuid),
  public.parent_child_assignment(uuid, uuid),
  public.parent_child_timetable(uuid),
  public.parent_give_consent(uuid),
  public.admin_record_consent(uuid),
  public.admin_unlink_parent(uuid, uuid),
  public.move_question(uuid, int)
to authenticated;
