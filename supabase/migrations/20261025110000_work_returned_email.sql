-- "Work returned" email with an off switch (ADR-0004; delivery 2026-10-25 item 3, design 03 §3.2).
--   * A trigger on assignment_results queues one email_outbox row per eligible recipient when
--     staff return work, in the tutor's own transaction.
--   * pg_cron kicks the `notifications` edge function every 5 minutes through pg_net; the
--     function claims rows, sends them (Resend hosted, Mailpit locally) and records each result.
--   * Families switch the email off in Account → Notifications (notification_settings).
--   * No email address or body is stored; the address is read at send time.

-- ---------------------------------------------------------------------------
-- Step 1. Extensions (the schemas Supabase's dashboard uses, so its fallback toggle matches)
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog; -- objects in schema "cron"
create extension if not exists pg_net with schema extensions;  -- objects in schema "net"

-- ---------------------------------------------------------------------------
-- Step 2. The switch (AC-3.6, AC-3.10)
-- ---------------------------------------------------------------------------

-- A separate table, because family accounts can't write profiles (R3b D3). Item 8 adds columns.
create table public.notification_settings (
  profile_id    uuid primary key references public.profiles (id) on delete cascade,
  work_returned boolean not null default true, -- a missing row also means on
  updated_at    timestamptz not null default now()
);

comment on table public.notification_settings is
  'Email preferences for students and parents (AC-3.6). One row per person; a missing row means every email is on.';

create trigger notification_settings_set_updated_at
  before update on public.notification_settings
  for each row execute function private.set_updated_at();

revoke all on public.notification_settings from anon, authenticated;
grant select, insert (profile_id, work_returned), update (work_returned)
  on public.notification_settings to authenticated;
alter table public.notification_settings enable row level security;

create policy "Families read their own email settings"
  on public.notification_settings for select to authenticated
  using (profile_id = (select auth.uid()) and (select private.my_active_role()) in ('student', 'parent'));
create policy "Families add their own email settings"
  on public.notification_settings for insert to authenticated
  with check (profile_id = (select auth.uid()) and (select private.my_active_role()) in ('student', 'parent'));
create policy "Families change their own email settings"
  on public.notification_settings for update to authenticated
  using (profile_id = (select auth.uid()) and (select private.my_active_role()) in ('student', 'parent'))
  with check (profile_id = (select auth.uid()) and (select private.my_active_role()) in ('student', 'parent'));

-- ---------------------------------------------------------------------------
-- Step 3. The outbox
-- ---------------------------------------------------------------------------

create table public.email_outbox (
  id             uuid primary key default gen_random_uuid(), -- also the Resend Idempotency-Key
  kind           text not null check (kind in ('work_returned')),
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  student_id     uuid not null references public.students (id) on delete cascade,
  recipient_id   uuid not null references public.profiles (id) on delete cascade,
  recipient_role text not null check (recipient_role in ('student', 'parent')),
  status         text not null default 'pending'
                 check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts       smallint not null default 0 check (attempts between 0 and 3),
  -- A fixed code, never the provider's error text (which can echo the address).
  reason         text check (reason in ('rejected', 'rate_limited', 'server_error', 'network',
                                        'no_address', 'max_attempts', 'config_missing')),
  created_at     timestamptz not null default now(),
  claimed_at     timestamptz,
  sent_at        timestamptz,
  constraint email_outbox_once unique (kind, assignment_id, student_id, recipient_id) -- AC-3.5
);

create index email_outbox_due_idx on public.email_outbox (created_at)
  where status in ('pending', 'sending');
create index email_outbox_window_idx on public.email_outbox ((coalesce(sent_at, claimed_at)))
  where status in ('sent', 'sending');

comment on table public.email_outbox is
  'App emails waiting, sent or failed (ADR-0004). No address or body is stored. Service role and definer functions only.';

revoke all on public.email_outbox from anon, authenticated;
alter table public.email_outbox enable row level security; -- no policies: nobody reads it directly

-- ---------------------------------------------------------------------------
-- Step 4. Helpers
-- ---------------------------------------------------------------------------

-- App cap (ADR-0004 §3): 70 in any rolling 24 hours, leaving at least 30 of Resend Free's 100 a
-- day for sign-in email. The only place the number lives.
create function private.email_daily_cap()
returns int
language sql
immutable
set search_path = ''
as $$ select 70 $$;

-- Sent, or claimed by a worker that may still be sending (review-2 round 2, finding 1a).
create function private.emails_sent_last_day()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.email_outbox
  where status in ('sent', 'sending')
    and coalesce(sent_at, claimed_at) > now() - interval '24 hours'
$$;

-- Who should hear about this return (AC-3.1, AC-3.2, AC-3.5): the student's own active account
-- and each active linked parent, minus anyone who turned the switch off, and only while the
-- student can open the work (active student, active class, enrolled, published). The trigger and
-- the worker's claim both use this, so they can never disagree (03 §4 choice 7).
create function private.work_returned_recipients(target_assignment uuid, target_student uuid)
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
    and private.assignment_visible_to(target_student, target_assignment)
    and coalesce((select ns.work_returned from public.notification_settings ns where ns.profile_id = p.id), true)
  union
  select p.id, 'parent'
  from public.student_guardians g
  join public.students s on s.id = g.student_id
  join public.profiles p on p.id = g.parent_id
  where g.student_id = target_student
    and s.is_active
    and p.is_active and p.status = 'active' and p.role = 'parent'
    and private.assignment_visible_to(target_student, target_assignment)
    and coalesce((select ns.work_returned from public.notification_settings ns where ns.profile_id = p.id), true)
$$;

-- ---------------------------------------------------------------------------
-- Step 5. The trigger (staff returns only)
-- ---------------------------------------------------------------------------

-- Runs in the tutor's transaction, so a rolled-back return queues nothing (AC-3.7). Not wrapped
-- in an exception handler: the insert can only fail on a bug, and hiding that would also hide it
-- from admins (AC-3.8).
create function private.queue_work_returned_email()
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
  from private.work_returned_recipients(new.assignment_id, new.student_id) r
  on conflict on constraint email_outbox_once do nothing; -- returned again later: no second email
  return null;
end;
$$;

-- marked_by is null on the automatic return of all-MCQ work (check_assignment_result), so those
-- send nothing (02 item 3, "Staff returns only").
create trigger assignment_results_queue_email
  after insert or update of status on public.assignment_results
  for each row
  when (new.status = 'returned' and new.marked_by is not null)
  execute function private.queue_work_returned_email();

revoke execute on function
  private.email_daily_cap(),
  private.emails_sent_last_day(),
  private.work_returned_recipients(uuid, uuid),
  private.queue_work_returned_email()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Step 6. Worker RPCs (service role only)
-- ---------------------------------------------------------------------------

-- Claims what the cap allows, oldest first. Skips rows whose recipient is no longer eligible and
-- fails rows with no address. One claim at a time (advisory lock), so the cap is exact. Returns no
-- mark or feedback, so the email has nothing to leak (AC-3.3).
create function public.notify_claim_emails()
returns table (
  id uuid, recipient_role text, email text, recipient_first_name text,
  child_first_name text, assignment_id uuid, student_id uuid,
  assignment_title text, class_name text)
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
    and not exists (select 1 from private.work_returned_recipients(o.assignment_id, o.student_id) r
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
                   order by x.created_at
                   limit room
                   for update skip locked)
    returning o.*
  )
  select c.id, c.recipient_role, p.email,
         split_part(trim(p.full_name), ' ', 1), split_part(trim(s.full_name), ' ', 1),
         c.assignment_id, c.student_id, a.title, cl.name
  from claimed c
  join public.profiles p on p.id = c.recipient_id
  join public.students s on s.id = c.student_id
  join public.assignments a on a.id = c.assignment_id
  join public.classes cl on cl.id = a.class_id
  order by c.created_at;
end;
$$;

-- One row's outcome, written straight after its send (review-2 round 2, finding 1b). Only a row
-- still 'sending' changes, so a reclaimed row can't be overwritten by a late worker.
-- Valid pairs (anything else raises 'invalid_input' and changes nothing):
--   'sent'   + null                                   → sent, sent_at = now(), reason null
--   'retry'  + 'rate_limited' | 'server_error' | 'network'
--                                                     → pending with that reason; at attempts = 3
--                                                       → failed, reason 'max_attempts'
--   'failed' + 'rejected'                             → failed, reason 'rejected'
create function public.notify_record_result(target uuid, outcome text, failure_reason text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- coalesce: a null reason makes the comparisons null, and "not null" would let it through.
  if not coalesce((outcome = 'sent' and failure_reason is null)
                  or (outcome = 'retry' and failure_reason in ('rate_limited', 'server_error', 'network'))
                  or (outcome = 'failed' and failure_reason = 'rejected'), false) then
    raise exception 'invalid_input';
  end if;

  update public.email_outbox o
  set status = case
                 when outcome = 'sent' then 'sent'
                 when outcome = 'failed' or o.attempts >= 3 then 'failed'
                 else 'pending'
               end,
      reason = case
                 when outcome = 'sent' then null
                 when outcome = 'retry' and o.attempts >= 3 then 'max_attempts'
                 else failure_reason
               end,
      sent_at = case when outcome = 'sent' then now() end
  where o.id = target and o.status = 'sending';
end;
$$;

-- The worker has no usable transport or site URL: mark waiting rows so admins see "Set-up error".
-- No attempt is used up (03 §4 choice 8).
create function public.notify_flag_config_missing()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.email_outbox set reason = 'config_missing'
  where status = 'pending' and reason is distinct from 'config_missing'
$$;

-- ---------------------------------------------------------------------------
-- Step 7. Cron kick (every 5 minutes) and history trim (daily)
-- ---------------------------------------------------------------------------

-- The worker URL and secret live in Vault, never in a migration: seed.sql adds local values, and
-- the hosted values are a release step (supabase/README.md, "Work returned emails").
create function private.kick_email_worker()
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

-- Daily, 04:30 Melbourne: keeps the cron log to 7 days, and drops finished emails (sent, skipped,
-- failed) after 90 days, so the outbox doesn't grow for ever (Security item 3, finding 7). Waiting
-- rows are kept: they still have to go out, and admins see them.
-- Accepted limit (01 change log, review-5 R2-2): the unique key gives AC-3.5's "at most once" only
-- while the row exists, so a re-return more than 90 days later may send one more email.
create function private.trim_history()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  delete from public.email_outbox
  where status in ('sent', 'skipped', 'failed') and created_at < now() - interval '90 days';
$$;

-- cron.schedule replaces a job of the same name, so re-running this is safe. Kill switch:
-- select cron.unschedule('email-worker-kick');  (supabase/README.md)
select cron.schedule('email-worker-kick', '*/5 * * * *', $$select private.kick_email_worker()$$);
select cron.schedule('daily-history-trim', '30 17 * * *', $$select private.trim_history()$$);

-- ---------------------------------------------------------------------------
-- Step 8. Admin list of Failed and Waiting emails (AC-3.8)
-- ---------------------------------------------------------------------------

-- No address, body or recipient name is returned.
create function public.admin_email_problems(max_rows int default 100)
returns table (
  id uuid, created_at timestamptz, recipient_role text, assignment_title text,
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
    select o.id, o.created_at, o.recipient_role, a.title,
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
-- Step 9. Grants
-- ---------------------------------------------------------------------------

revoke execute on function private.kick_email_worker(), private.trim_history()
from public, anon, authenticated;

revoke execute on function
  public.notify_claim_emails(),
  public.notify_record_result(uuid, text, text),
  public.notify_flag_config_missing(),
  public.admin_email_problems(int)
from public, anon, authenticated;

grant execute on function
  public.notify_claim_emails(),
  public.notify_record_result(uuid, text, text),
  public.notify_flag_config_missing()
to service_role;

grant execute on function public.admin_email_problems(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Step 10. Older functions that the emails expose (delivery item 3, bugs 5 and 7)
-- ---------------------------------------------------------------------------

-- BUG-5: the email trigger treats marked_by as "returned by staff". A marked -> returned change
-- kept a null marked_by, so those returns sent nothing. The body below is the one from
-- 20261007090320_student_parent_portal.sql, unchanged except for the last elsif branch.
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
  elsif by_staff and status_changed and new.status = 'returned' and new.marked_by is null then
    -- Item 3, BUG-5: staff return work nobody is recorded as marking (seeded or imported rows,
    -- or the marker's account was removed). Record the returner, so the email goes.
    new.marked_by := (select auth.uid());
    new.marked_at := coalesce(new.marked_at, now());
  end if;
  return new;
end;
$$;

-- BUG-7: someone who isn't this child's parent (a tutor, or another parent following a forwarded
-- email link) got P0002, which PostgREST answers as HTTP 500. Refuse with 42501 (403), as the
-- other family functions do for "not yours". The message stays 'not_found', so the app shows the
-- same page as before. The work-not-visible case answers the same way.
create or replace function public.parent_child_assignment(target_student uuid, target_assignment uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found_view jsonb;
begin
  if not private.is_my_child(target_student) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  found_view := private.assignment_view(target_student, target_assignment, true);
  if found_view is null then
    raise exception 'not_found' using errcode = '42501';
  end if;
  return found_view;
end;
$$;
