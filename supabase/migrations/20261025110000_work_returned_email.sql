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
-- Step 7. Cron kick (every 5 minutes) and cron history trim (daily)
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

-- cron.schedule replaces a job of the same name, so re-running this is safe. Kill switch:
-- select cron.unschedule('email-worker-kick');  (supabase/README.md)
select cron.schedule('email-worker-kick', '*/5 * * * *', $$select private.kick_email_worker()$$);
select cron.schedule('cron-history-trim', '30 17 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);

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

revoke execute on function private.kick_email_worker() from public, anon, authenticated;

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
