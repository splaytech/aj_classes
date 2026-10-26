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
