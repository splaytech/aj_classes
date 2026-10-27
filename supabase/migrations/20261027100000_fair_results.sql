-- Item 7: hold results, and returned work stays readable after leaving a class
-- (01b AC-7.1–7.17, 02b item 7, ADR-0007, 03b §7.2).
--
-- Rule (a), private.assignment_visible_to, is unchanged and still guards every write. Rule (b),
-- private.assignment_readable_by, adds read access to returned work and is used by read paths only.
-- Each rebuilt function names the file and lines its body was copied from; only the noted change
-- is new (03b §0.2, ADR-0007 decision 4).

-- ---------------------------------------------------------------------------
-- 1. The flag
-- ---------------------------------------------------------------------------

alter table public.assignments
  add column hold_results boolean not null default false;

comment on column public.assignments.hold_results is
  'Keep all-multiple-choice work Submitted until staff return it (ADR-0007). Changeable only on drafts.';

-- The assignments RLS (can_manage_assignment: the class tutor or an admin) decides who can set it.
grant insert (hold_results), update (hold_results) on public.assignments to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Guard
-- ---------------------------------------------------------------------------

-- Locked once published (AC-7.1). A permitted back-to-draft unlocks it, because
-- check_assignment_status already allows that only before anyone starts. Setting it needs at least
-- one question: paper homework never auto-returns, and neither does a file hand-in once item 2
-- lands (it can't have questions), so AC-7.2 needs no other rule.
create function private.check_hold_results()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.hold_results is distinct from old.hold_results
     and old.status = 'published' then
    raise exception 'assignment_published';
  end if;
  if new.hold_results and (tg_op = 'INSERT' or not old.hold_results)
     and not exists (select 1 from public.assignment_questions q where q.assignment_id = new.id) then
    raise exception 'hold_needs_questions';
  end if;
  return new;
end;
$$;

create trigger assignments_check_hold_results
  before insert or update of hold_results on public.assignments
  for each row execute function private.check_hold_results();

-- ---------------------------------------------------------------------------
-- 3. The read rule
-- ---------------------------------------------------------------------------

-- Rule (a) or rule (b): enrolled in the active class, or the student's result is returned
-- (ADR-0007). Read paths only; every write keeps assignment_visible_to.
create function private.assignment_readable_by(target_student uuid, target_assignment uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.assignment_visible_to(target_student, target_assignment)
      or exists (
           select 1
           from public.assignments a
           join public.assignment_results r on r.assignment_id = a.id
           where a.id = target_assignment
             and a.status = 'published'
             and r.student_id = target_student
             and r.status = 'returned'
         )
$$;

-- ---------------------------------------------------------------------------
-- 4. student_submit keeps held work Submitted (AC-7.3)
-- ---------------------------------------------------------------------------

-- Body copied from 20261007090321_family_functions.sql lines 463-527, unchanged except for the
-- final branch: with hold_results on, all-multiple-choice work is auto-marked but not returned.
-- The staff Return then passes unmarked_answers at once, and check_assignment_result sets
-- marked_by, so item 3's email is queued (AC-7.4). Auto-returns keep marked_by null (AC-7.5).
create or replace function public.student_submit(target_assignment uuid)
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

  -- Item 7: held work also waits for staff to return it (AC-7.3).
  if exists (
    select 1 from public.assignment_questions q
    where q.assignment_id = target_assignment and q.kind = 'written'
  ) or (select a.hold_results from public.assignments a where a.id = target_assignment) then
    return 'submitted';
  end if;

  update public.assignment_results
  set status = 'returned'
  where assignment_id = target_assignment and student_id = me;
  return 'returned';
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The list builder and its wrappers (drop and recreate: the returned columns change)
-- ---------------------------------------------------------------------------

drop function public.student_assignments();
drop function public.parent_child_assignments(uuid);
drop function private.assignments_for_student(uuid, boolean);

-- Body copied from 20261007090321_family_functions.sql lines 151-202. Changes: enrolment is a
-- left join, so rule (b) rows (returned work after leaving the class or archiving) are kept; the
-- where clause is rule (a) or (b); and a last column, is_past_class (= not rule (a)), for the
-- "Past class" tag. enrolments has one row per class and student, so the join can't duplicate.
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
  comment        text,
  is_past_class  boolean
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
         case when r.status = 'returned' then r.feedback else '' end,
         not (e.student_id is not null and c.is_active) -- is_past_class (AC-7.12)
  from public.assignments a
  join public.classes c on c.id = a.class_id
  left join public.enrolments e on e.class_id = a.class_id and e.student_id = target_student
  left join public.assignment_results r on r.assignment_id = a.id and r.student_id = target_student
  where a.status = 'published'
    and ((e.student_id is not null and c.is_active) or r.status = 'returned') -- rule (a) or (b)
  order by a.due_on nulls last, a.published_at desc
$$;

-- Bodies copied from 20261007090321_family_functions.sql lines 347-371 and 574-598; the only
-- change is the is_past_class column.
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
  comment        text,
  is_past_class  boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.assignments_for_student(private.require_student(), false)
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
  comment        text,
  is_past_class  boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.assignments_for_student(private.require_my_child(target_student), true)
$$;

-- Grants as 20261007090321_family_functions.sql lines 786-831 apply them to these three.
revoke execute on function private.assignments_for_student(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.student_assignments(), public.parent_child_assignments(uuid) from public, anon, authenticated;
grant execute on function public.student_assignments(), public.parent_child_assignments(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. assignment_view gains isPastClass
-- ---------------------------------------------------------------------------

-- Body copied from 20261007090321_family_functions.sql lines 206-267, plus the isPastClass key.
-- It reads the builder, so student_assignment, parent_child_assignment and the email link follow
-- rule (b) too (AC-7.14). The before-return hiding is unchanged (AC-7.3, AC-7.6).
create or replace function private.assignment_view(target_student uuid, target_assignment uuid, for_parent boolean)
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
    'isPastClass', summary.is_past_class,
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

-- ---------------------------------------------------------------------------
-- 7. "Work returned" recipients follow rule (b)
-- ---------------------------------------------------------------------------

-- Body copied from 20261025110000_work_returned_email.sql lines 115-140; both
-- assignment_visible_to calls become assignment_readable_by. Otherwise an email still waiting
-- under the daily cap would be skipped if the student left the class before it was sent, though
-- they can still open the work (02b §7.1 point 6, AC-7.14). Item 8 replaces this function.
create or replace function private.work_returned_recipients(target_assignment uuid, target_student uuid)
returns table (profile_id uuid, recipient_role text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, 'student'
  from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.id = target_student
    and s.is_active
    and p.is_active and p.status = 'active' and p.role = 'student'
    and private.assignment_readable_by(target_student, target_assignment)
    and coalesce((select ns.work_returned from public.notification_settings ns where ns.profile_id = p.id), true)
  union
  select p.id, 'parent'
  from public.student_guardians g
  join public.students s on s.id = g.student_id
  join public.profiles p on p.id = g.parent_id
  where g.student_id = target_student
    and s.is_active
    and p.is_active and p.status = 'active' and p.role = 'parent'
    and private.assignment_readable_by(target_student, target_assignment)
    and coalesce((select ns.work_returned from public.notification_settings ns where ns.profile_id = p.id), true)
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants (the private helpers run only inside the functions above)
-- ---------------------------------------------------------------------------

revoke execute on function
  private.check_hold_results(),
  private.assignment_readable_by(uuid, uuid)
from public, anon, authenticated;
