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
-- 8. Grants (the private helpers run only inside the functions above)
-- ---------------------------------------------------------------------------

revoke execute on function
  private.check_hold_results()
from public, anon, authenticated;
