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
-- 8. Grants (the private helpers run only inside the functions above)
-- ---------------------------------------------------------------------------

revoke execute on function
  private.check_hold_results(),
  private.assignment_readable_by(uuid, uuid)
from public, anon, authenticated;
