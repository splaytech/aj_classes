# ADR-0008: "New assignment" and "due tomorrow" emails reuse the outbox (extends ADR-0004)

- **Status:** Accepted (2026-10-26, Architect, `/deliver` pending-requirements items 4–8, Stage 2; proposed and accepted the same day, when [review-2b](../delivery/2026-10-25-pending-requirements/review-2b-items-4-8.md) approved the stage, with its findings applied)
- **Source:** `docs/delivery/2026-10-25-pending-requirements/02b-architecture-items-4-8.md` item 8
- **Extends:** [ADR-0004](0004-email-outbox-cron-worker.md). That ADR's accepted text isn't edited; everything it decides still holds unless this ADR says otherwise below.

## Context

Item 8 adds two triggers on ADR-0004's machinery. The machinery is:
- the `email_outbox` table;
- the 5-minute `pg_cron` kick;
- the `notifications` worker;
- the 70-per-rolling-24-hours cap;
- `notification_settings`;
- the admin Emails page.

The two new emails are:
- a "new assignment" email on publish;
- a "due tomorrow" reminder at 3 pm Melbourne the day before, which must never go out late.

Hosted `pg_cron` schedules in UTC. The SQL migration and the worker deploy are separate owner
steps, so they can land in either order. At item 3's planning volume, the three kinds together
exceed the 70-a-day cap.

## Decision

1. **New kinds** `new_assignment` and `due_tomorrow`. The unique key `email_outbox_once` is
   unchanged, so each is at most once per recipient, student and assignment within the 90-day
   retention. Republishing and due-date changes never send a second email.
2. **New nullable column `email_outbox.send_before`**, and the new reason `too_late`.
   - The kick sweeps expired pending rows to `failed` / `too_late` every 5 minutes, before its
     early returns.
   - The claim skips any row past its deadline.
   - Deadlines:
     - `due_tomorrow`: the start of the due date in Melbourne.
     - `new_assignment`: the end of the due date in Melbourne, or 7 days after publishing if
       there's no due date (`[ASSUMPTION — PO to confirm]`). Nothing is queued when
       `send_before <= now()`, so there are no false Failed rows.
     - `work_returned`: none.
3. **Recipients:** one function, `private.email_recipients(kind, assignment, student)`, replaces
   `work_returned_recipients`.
   - Base set: the active student and the active linked parents.
   - Each kind's own switch in `notification_settings`: new `new_assignment` and `due_tomorrow`
     columns, default on.
   - Each kind's condition:
     - `work_returned`: readable (ADR-0007).
     - `new_assignment`: visible (rule (a)).
     - `due_tomorrow`: visible, online or file hand-in (`is_online_assignment`), not handed in, and
       the due date unchanged.

   The queue and the claim both use it.
4. **Queueing:**
   - "New assignment": an AFTER trigger on `assignments` when a row becomes published, in the
     publisher's transaction. It covers the students enrolled at that moment.
   - "Due tomorrow": `cron.schedule('…', '10 * * * *', …)`, hourly. The function acts only when
     the Melbourne hour is 15, so exactly one run a day does work, at 15:10 Melbourne, whatever
     time zone `pg_cron` uses. It skips work published on or after the day before it's due.
5. **Claim order:** `due_tomorrow` first, then everything else by `created_at`.
6. **Deploy order: migration first, then the function.**
   `notify_claim_emails(supported_kinds text[] default array['work_returned'])` lets the current
   worker keep claiming only what it can render once the migration lands. The new worker passes
   all three kinds, and gets `kind` and `due_on` back to pick and fill the template. The reverse
   order isn't safe: a new worker calling the old zero-argument function gets `PGRST202`, and all
   email stops until the migration lands.
   *Amended 26 Oct 2026 (item 8 dev notes D13):* the worker now retries the claim with no
   argument on `PGRST202`, so in the reverse order "work returned" keeps sending and only the new
   kinds wait. Migration first is still the release order.
7. **The admin page** gains a `kind` column and the "Too late to send" label. The empty state is
   unchanged.

## Consequences

- Up to about 2.25× item 3's volume. Free fits up to about 30 active portal students.
  - Beyond that, reminders still go out, "new work" emails may expire visibly, and the upgrade
    trigger in `budget.md` applies.
  - The trigger is Resend Pro, about A$31/month, and Saurabh decides (02b Decision 1).
- One extra cron job, with 24 runs a day, 23 of which return at once. A missed 15:10 run means
  no reminders that day.
- Staging publishes email real families, the same as ADR-0004.

## Alternatives rejected

- A queue per kind: it would split the cap.
- `cron.timezone`: it can't be relied on on hosted Supabase.
- Two UTC slots (`'10 4,5 * * *'`) with the hour-15 guard: correct only while `pg_cron` runs in UTC.
- An hourly catch-up window (15:00–19:00): evening emails.
- Earliest-deadline-first for all kinds: "work returned" would starve.
- Re-notifying on republish: 01b rejects it.
