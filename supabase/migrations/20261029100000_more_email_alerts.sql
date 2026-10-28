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

-- Is this kind still worth sending for this student's work? queued_due_on: the Melbourne date of
-- the row's send_before (null while queueing). "Due tomorrow": send_before is the start of the due
-- date, so a changed due date means skipped (AC-8.8).
-- "New assignment": send_before is the start of the day after the due date, so queued_due_on is
-- due + 1. It's skipped only when the due date moved earlier than queued and is now in the past
-- (Melbourne), so it never says "It's due" a past date (AC-8.4, item 8 test plan P3). A row whose
-- unchanged due date simply ran out stays relevant, so the kick fails it as too_late and admins
-- see "Too late to send" (AC-8.7, review-5 item 8 round 3). While queueing, queued_due_on is null
-- and the queue trigger has already checked the deadline. Queued with no due date (deadline 7 days
-- after publishing), queued_due_on is that 7th day, so a due date added later only counts as
-- "moved earlier" when it's 2 or more days before that day.
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
    when 'new_assignment' then
      private.assignment_visible_to(target_student, target_assignment)
      and exists (select 1 from public.assignments a
                  where a.id = target_assignment
                    and (a.due_on is null
                         or a.due_on >= private.melbourne_date(now())
                         or a.due_on + 1 >= queued_due_on))
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
-- Step 5. Queue "new assignment" on publish (AC-8.1, AC-8.3, AC-8.4, AC-8.12)
-- ---------------------------------------------------------------------------

-- Runs in the publisher's transaction: a rolled-back publish queues nothing, and a send failure
-- never reaches the tutor. Students enrolled later get nothing (AC-8.4). Nothing is queued once
-- the deadline has passed (work published after its due date), so there's never a false Failed row.
-- published_at is set by the BEFORE trigger check_assignment_status, so it's there already.
create function private.queue_new_assignment_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  deadline timestamptz;
begin
  if tg_op = 'UPDATE' and old.status = 'published' then
    return null; -- already published before this change
  end if;
  deadline := private.new_assignment_send_before(new.due_on, new.published_at);
  if deadline <= now() then
    return null;
  end if;
  insert into public.email_outbox (kind, assignment_id, student_id, recipient_id, recipient_role, send_before)
  select 'new_assignment', new.id, e.student_id, r.profile_id, r.recipient_role, deadline
  from public.enrolments e
  cross join lateral private.email_recipients('new_assignment', new.id, e.student_id) r
  where e.class_id = new.class_id
  on conflict on constraint email_outbox_once do nothing; -- republishing never notifies (AC-8.3)
  return null;
end;
$$;

-- OLD can't be referenced in WHEN for an INSERT-or-UPDATE trigger, so the old status is checked inside.
create trigger assignments_queue_new_assignment_email
  after insert or update of status on public.assignments
  for each row
  when (new.status = 'published')
  execute function private.queue_new_assignment_emails();

-- ---------------------------------------------------------------------------
-- Step 6. Queue "due tomorrow" from an hourly job (AC-8.5, AC-8.6)
-- ---------------------------------------------------------------------------

-- One day's reminders, for work due the day after `today` (Melbourne). Split from the cron entry
-- so pgTAP can call it for any day. Class active, enrolment, online and not handed in are all
-- inside email_recipients, so the queue and the claim agree.
create function private.queue_due_tomorrow_emails_for(today date)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.email_outbox (kind, assignment_id, student_id, recipient_id, recipient_role, send_before)
  select 'due_tomorrow', a.id, e.student_id, r.profile_id, r.recipient_role,
         private.melbourne_day_start(today + 1)
  from public.assignments a
  join public.enrolments e on e.class_id = a.class_id
  cross join lateral private.email_recipients('due_tomorrow', a.id, e.student_id, today + 1) r
  where a.status = 'published'
    and a.due_on = today + 1
    -- AC-8.6: skip work published on the day before it's due (that's today) or later; its
    -- "new assignment" email covers it. Work published yesterday or earlier gets a reminder.
    and private.melbourne_date(a.published_at) < today
  on conflict on constraint email_outbox_once do nothing
$$;

-- pg_cron entry: hourly at :10, acts only in the Melbourne 15:00 hour (ADR-0008 decision 4).
-- A missed run has no catch-up (02b §8.3 [ASSUMPTION]).
create function private.queue_due_tomorrow_emails()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_reminder_hour(now()) then
    return;
  end if;
  perform private.queue_due_tomorrow_emails_for(private.melbourne_date(now()));
end;
$$;

revoke execute on function
  private.queue_new_assignment_emails(),
  private.queue_due_tomorrow_emails_for(date),
  private.queue_due_tomorrow_emails()
from public, anon, authenticated;

-- cron.schedule replaces a job of the same name, so re-running this is safe. Kill switch
-- (supabase/README.md): select cron.unschedule('due-tomorrow-reminders');
select cron.schedule('due-tomorrow-reminders', '10 * * * *', $$select private.queue_due_tomorrow_emails()$$);

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

-- ---------------------------------------------------------------------------
-- Step 8. Claim: supported kinds, deadline, order (ADR-0008 decisions 2, 5, 6)
-- ---------------------------------------------------------------------------

drop function public.notify_claim_emails();

-- supported_kinds: the kinds the calling worker can render. Today's worker calls with no argument
-- and keeps claiming only work_returned, so this migration can land before the function deploy
-- (review-2b finding 1). Reminders first (their deadline is hours away), then oldest first. The
-- skip step re-checks every pending row, of every kind, against the date it was queued for.
-- Body copied from 20261025110000_work_returned_email.sql lines 189-239, with the supported
-- kinds, the deadline and the order added, and kind and due_on returned. Every column reference
-- stays table-qualified, because kind and due_on are also output names.
create function public.notify_claim_emails(supported_kinds text[] default array['work_returned'])
returns table (
  id uuid, kind text, recipient_role text, email text, recipient_first_name text,
  child_first_name text, assignment_id uuid, student_id uuid,
  assignment_title text, class_name text, due_on date)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  room int;
begin
  perform pg_advisory_xact_lock(hashtext('email_outbox_claim'));

  update public.email_outbox o set status = 'skipped'
  where o.status = 'pending'
    and not exists (select 1 from private.email_recipients(o.kind, o.assignment_id, o.student_id,
                                                           private.melbourne_date(o.send_before)) r
                    where r.profile_id = o.recipient_id);

  update public.email_outbox o set status = 'failed', reason = 'no_address'
  from public.profiles p
  where o.status = 'pending' and p.id = o.recipient_id and trim(p.email) = '';

  room := private.email_daily_cap() - private.emails_sent_last_day();
  if room <= 0 then
    return;
  end if;

  return query
  with claimed as (
    update public.email_outbox o
    set status = 'sending', claimed_at = now(), attempts = o.attempts + 1, reason = null
    where o.id in (select x.id from public.email_outbox x
                   where x.status = 'pending'
                     and x.kind = any (supported_kinds)
                     and (x.send_before is null or x.send_before > now())
                   order by (x.kind = 'due_tomorrow') desc, x.created_at
                   limit room
                   for update skip locked)
    returning o.*
  )
  select c.id, c.kind, c.recipient_role, p.email,
         split_part(trim(p.full_name), ' ', 1), split_part(trim(s.full_name), ' ', 1),
         c.assignment_id, c.student_id, a.title, cl.name, a.due_on
  from claimed c
  join public.profiles p on p.id = c.recipient_id
  join public.students s on s.id = c.student_id
  join public.assignments a on a.id = c.assignment_id
  join public.classes cl on cl.id = a.class_id
  order by (c.kind = 'due_tomorrow') desc, c.created_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Step 9. The kick sweeps expired rows (AC-8.7)
-- ---------------------------------------------------------------------------

-- Body copied from 20261025110000_work_returned_email.sql lines 299-336, plus, straight after the
-- reclaim and before the first early return, the claim's relevance skip and then the too_late
-- sweep (review-5 item 8, finding 1).
create or replace function private.kick_email_worker()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  worker_url text;
  worker_secret text;
begin
  -- Reclaim rows from a worker that died (10 min > the 150 s / 400 s function limit). The attempt
  -- stays counted; the third one ends as failed.
  update public.email_outbox
  set status = case when attempts >= 3 then 'failed' else 'pending' end,
      reason = case when attempts >= 3 then 'max_attempts' else reason end
  where status = 'sending' and claimed_at < now() - interval '10 minutes';

  -- No longer relevant (handed in, back to draft, left the class, switch off): skipped, as the
  -- claim does. It runs here first because the claim doesn't run while the cap is full or the
  -- worker is set up wrongly, and without it the sweep below would fail these as "too late".
  update public.email_outbox o set status = 'skipped'
  where o.status = 'pending'
    and not exists (select 1 from private.email_recipients(o.kind, o.assignment_id, o.student_id,
                                                           private.melbourne_date(o.send_before)) r
                    where r.profile_id = o.recipient_id);

  -- Past their deadline: failed, shown to admins as "Too late to send". Here, not in the worker,
  -- because the kick never calls the worker while the cap is full (02b §8.4).
  update public.email_outbox
  set status = 'failed', reason = 'too_late'
  where status = 'pending' and send_before <= now();

  if not exists (select 1 from public.email_outbox where status = 'pending') then
    return;
  end if;
  if private.emails_sent_last_day() >= private.email_daily_cap() then
    return;
  end if;

  select decrypted_secret into worker_url from vault.decrypted_secrets where name = 'notify_worker_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name = 'notify_worker_secret';
  if coalesce(worker_url, '') = '' or coalesce(worker_secret, '') = '' then
    return; -- rows wait; after ~2 h admins see "Not attempted" (02 item 3, risk 3)
  end if;

  perform net.http_post(
    url := worker_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', worker_secret),
    timeout_milliseconds := 10000);
end;
$$;

-- ---------------------------------------------------------------------------
-- Step 10. Admin list gains the kind (AC-8.13)
-- ---------------------------------------------------------------------------

drop function public.admin_email_problems(int);

-- Body copied from 20261025110000_work_returned_email.sql lines 365-399; the select list gains
-- o.kind after o.created_at. too_late comes through as a stored failed reason.
create function public.admin_email_problems(max_rows int default 100)
returns table (
  id uuid, created_at timestamptz, kind text, recipient_role text, assignment_title text,
  state text,  -- 'failed' | 'waiting'
  reason text) -- failed: the stored code; waiting: 'config_missing' | 'daily_limit' | 'retrying' | 'not_attempted'
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cap_reached boolean;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  cap_reached := private.emails_sent_last_day() >= private.email_daily_cap();
  return query
    select o.id, o.created_at, o.kind, o.recipient_role, a.title,
           case when o.status = 'failed' then 'failed' else 'waiting' end,
           case
             when o.status = 'failed' then o.reason
             when o.reason = 'config_missing' then 'config_missing' -- "Set-up error"
             when cap_reached then 'daily_limit'
             when o.attempts > 0 then 'retrying'
             else 'not_attempted' -- what a missing cron job or Vault secret looks like
           end
    from public.email_outbox o
    join public.assignments a on a.id = o.assignment_id
    where o.status = 'failed'
       or (o.status in ('pending', 'sending') and o.created_at < now() - interval '2 hours')
    order by o.created_at desc
    limit least(greatest(coalesce(max_rows, 100), 1), 500);
end;
$$;

-- ---------------------------------------------------------------------------
-- Step 11. Drop the old helper, and grants for the recreated functions
-- ---------------------------------------------------------------------------

drop function private.work_returned_recipients(uuid, uuid);

revoke execute on function
  public.notify_claim_emails(text[]), public.admin_email_problems(int)
from public, anon, authenticated;
grant execute on function public.notify_claim_emails(text[]) to service_role;
grant execute on function public.admin_email_problems(int) to authenticated;
