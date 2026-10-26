-- "New assignment" and "due tomorrow" emails (ADR-0008, extending ADR-0004; delivery 2026-10-25
-- items 4-8, design 03b §8.2). Same outbox, worker, cap and admin page as "work returned":
--   * a publish trigger queues "new assignment" for the students enrolled at that moment;
--   * an hourly pg_cron job queues "due tomorrow" at 15:10 Melbourne for online work not handed in;
--   * rows can carry a send_before deadline, and expire as failed / too_late in the kick;
--   * the claim takes only the kinds the calling worker can render (supported_kinds), so this
--     migration can land before the notifications function deploy, never after it.

-- ---------------------------------------------------------------------------
-- Step 1. Switches (AC-8.10, AC-8.15)
-- ---------------------------------------------------------------------------

alter table public.notification_settings
  add column new_assignment boolean not null default true, -- a missing row still means on
  add column due_tomorrow   boolean not null default true;

-- The three own-row policies (20261025110000 step 2) are table-wide, so they cover these too.
grant insert (new_assignment, due_tomorrow), update (new_assignment, due_tomorrow)
  on public.notification_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Step 2. Outbox: kinds, deadline, reason
-- ---------------------------------------------------------------------------

alter table public.email_outbox
  drop constraint email_outbox_kind_check,
  add constraint email_outbox_kind_check
    check (kind in ('work_returned', 'new_assignment', 'due_tomorrow')),
  drop constraint email_outbox_reason_check,
  add constraint email_outbox_reason_check
    check (reason in ('rejected', 'rate_limited', 'server_error', 'network',
                      'no_address', 'max_attempts', 'config_missing', 'too_late')),
  add column send_before timestamptz; -- null: no deadline (work_returned)

create index email_outbox_deadline_idx on public.email_outbox (send_before)
  where status = 'pending' and send_before is not null;

comment on column public.email_outbox.send_before is
  'Latest moment the email may still go out (ADR-0008). Pending rows past it become failed / too_late.';

-- ---------------------------------------------------------------------------
-- Step 3. Melbourne helpers
-- ---------------------------------------------------------------------------

-- The one place the reminder hour lives (01b assumption 10: 3 pm, after school).
create function private.reminder_hour()
returns int
language sql
immutable
set search_path = ''
as $$ select 15 $$;

create function private.melbourne_date(at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (at at time zone 'Australia/Melbourne')::date
$$;

-- Midnight at the start of a Melbourne day, DST included.
create function private.melbourne_day_start(day date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select day::timestamp at time zone 'Australia/Melbourne'
$$;

-- True in exactly one hourly run a day, whatever time zone pg_cron schedules in (review-2b 4).
create function private.is_reminder_hour(at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select extract(hour from at at time zone 'Australia/Melbourne') = private.reminder_hour()
$$;

-- "New assignment" deadline (ADR-0008 decision 2; PO confirmation in 03b §14): the end of the due
-- date, or 7 days after publishing when there's no due date.
create function private.new_assignment_send_before(due date, published timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case when due is null then published + interval '7 days'
              else private.melbourne_day_start(due + 1) end
$$;

revoke execute on function
  private.reminder_hour(), private.melbourne_date(timestamptz), private.melbourne_day_start(date),
  private.is_reminder_hour(timestamptz), private.new_assignment_send_before(date, timestamptz)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Step 4. One recipient function for every kind (ADR-0008 decision 3)
-- ---------------------------------------------------------------------------

-- Is this kind still worth sending for this student's work? queued_due_on: the due date a
-- reminder was queued for (from its send_before); a changed due date means skipped (AC-8.8).
create function private.email_still_relevant(
  target_kind text, target_assignment uuid, target_student uuid, queued_due_on date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case target_kind
    when 'work_returned' then private.assignment_readable_by(target_student, target_assignment)
    when 'new_assignment' then private.assignment_visible_to(target_student, target_assignment)
    when 'due_tomorrow' then
      private.assignment_visible_to(target_student, target_assignment)
      and private.is_online_assignment(target_assignment)
      and exists (select 1 from public.assignments a
                  where a.id = target_assignment and a.due_on = queued_due_on)
      and coalesce((select r.status from public.assignment_results r
                    where r.assignment_id = target_assignment and r.student_id = target_student),
                   'not_submitted') in ('not_submitted', 'in_progress')
    else false
  end
$$;

-- Who should get this kind of email about this student's work (AC-3.1, AC-8.1, AC-8.11): the
-- active student account and each active linked parent, minus anyone whose switch for this kind
-- is off, while the email is still relevant. The queue and the claim both use it (03 §4 choice 7).
-- The people set is work_returned_recipients' (20261027100000_fair_results.sql lines 360-385),
-- with its readable check moved into email_still_relevant.
create function private.email_recipients(
  target_kind text, target_assignment uuid, target_student uuid, queued_due_on date default null)
returns table (profile_id uuid, recipient_role text)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select p.id, 'student'::text as recipient_role
    from public.students s
    join public.profiles p on p.id = s.profile_id
    where s.id = target_student and s.is_active
      and p.is_active and p.status = 'active' and p.role = 'student'
    union
    select p.id, 'parent'
    from public.student_guardians g
    join public.students s on s.id = g.student_id
    join public.profiles p on p.id = g.parent_id
    where g.student_id = target_student and s.is_active
      and p.is_active and p.status = 'active' and p.role = 'parent'
  )
  select pe.id, pe.recipient_role
  from people pe
  left join public.notification_settings ns on ns.profile_id = pe.id
  where private.email_still_relevant(target_kind, target_assignment, target_student, queued_due_on)
    and coalesce(case target_kind
                   when 'work_returned'  then ns.work_returned
                   when 'new_assignment' then ns.new_assignment
                   when 'due_tomorrow'   then ns.due_tomorrow
                 end, true)
$$;

revoke execute on function
  private.email_still_relevant(text, uuid, uuid, date),
  private.email_recipients(text, uuid, uuid, date)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Step 7. "Work returned" uses the shared function
-- ---------------------------------------------------------------------------

-- Body copied from 20261025110000_work_returned_email.sql lines 149-165; the recipients line now
-- calls email_recipients('work_returned', ...). The trigger assignment_results_queue_email is
-- unchanged.
create or replace function private.queue_work_returned_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'returned' then
    return null; -- already returned before this change
  end if;
  insert into public.email_outbox (kind, assignment_id, student_id, recipient_id, recipient_role)
  select 'work_returned', new.assignment_id, new.student_id, r.profile_id, r.recipient_role
  from private.email_recipients('work_returned', new.assignment_id, new.student_id) r
  on conflict on constraint email_outbox_once do nothing; -- returned again later: no second email
  return null;
end;
$$;
