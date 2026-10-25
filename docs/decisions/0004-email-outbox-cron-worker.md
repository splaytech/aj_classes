# ADR-0004: App email goes through an outbox table, `pg_cron` and an edge function worker

- **Status:** Accepted (2026-10-25, Architect, `/deliver` pending-requirements Stage 2; proposed and accepted the same day, when review-2 round 2 approved the stage)
- **Source:** `docs/delivery/2026-10-25-pending-requirements/02-architecture.md` item 3

## Context

There is no app-sent email today; Resend only serves auth SMTP. The "work returned" email must
never block marking (AC-3.7), must record failures for admins (AC-3.8), must send at most once
(AC-3.5), and must respect an opt-out. It also shares Resend Free's 100/day with sign-in email.
Returns happen from two web code paths (paper and online).

## Decision

1. An AFTER trigger on `assignment_results` runs when the status becomes `returned` and
   `marked_by` is set (staff returns only). It inserts one `email_outbox` row per eligible
   recipient: active student, active linked parents, switch on. A unique key on
   `(kind, assignment, student, recipient)` gives at-most-once.
2. `pg_cron` runs every **5 minutes**. Its job:
   - reclaims `sending` rows claimed more than 10 minutes ago (back to `pending`; the attempt
     stays counted);
   - then, only if rows are pending **and** fewer than 70 were sent in the last 24 hours, calls
     the `notifications` edge function through `pg_net`, with a shared secret read from Vault.

   A daily job deletes `cron.job_run_details` rows older than 7 days.
3. The worker claims at most `70 − sent in the last 24 h` rows with `SKIP LOCKED` and re-checks
   eligibility. It sends through Resend's HTTP API (Mailpit locally).
   - The **app cap is 70 in any rolling 24 hours**: rows `sent` or `sending` with
     `coalesce(sent_at, claimed_at) > now() - interval '24 hours'`. That holds under either Resend
     counting rule (UTC day or rolling 24 h), counts rows a still-running worker holds, and
     leaves ≥ 30 for sign-in email.
   - Each Resend call carries `Idempotency-Key: <outbox id>`, and each row is marked `sent`
     straight after its own send, so a reclaimed row is never delivered twice.
   - Network and 5xx errors go back to `pending`, up to 3 attempts. After that the row is
     `failed`.
   - `reason` stores a fixed short code, never the provider's raw error text.
4. Opt-out lives in `notification_settings` (one row per profile, default on).
5. Admins see `admin_email_problems()`, which lists two kinds of row with a reason:
   - **Failed** rows;
   - **Waiting** rows: pending or sending for more than ~2 hours, with "Set-up error"
     (`config_missing`), "Daily limit", "Retrying" or "Not attempted".

   No email address or body is stored.
6. **No unsafe defaults.** The worker refuses requests when `NOTIFY_WORKER_SECRET` is unset. It
   sends nothing when `EMAIL_TRANSPORT` is unset or unknown. `deploy.sh` requires a non-local
   worker secret, sets `EMAIL_TRANSPORT=resend` and unsets Mailpit values on the hosted project.

## Consequences

- The email is atomic with the return, and durable across outages and free-tier pauses.
- Item 8 adds kinds and triggers or cron queries to the same machinery.
- Hosted release needs `pg_cron` and `pg_net`, function secrets and Vault entries. If any is
  missing, rows show as Waiting / "Not attempted" instead of disappearing silently.
- Up to 5 minutes from return to email. The cron log stays at a few thousand rows.
- Because staging and prod share one database, a return made on staging emails real families.

## Alternatives rejected

- The client calls a function after the return: lost if the tab closes, and not atomic.
- A trigger with `pg_net` straight to the function, or a Database Webhook: fire-and-forget, so
  failures go unrecorded.
- `pg_net` straight to Resend: templating in SQL.
