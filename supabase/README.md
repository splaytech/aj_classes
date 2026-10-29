# Supabase (database, auth, storage)

Backend for staff sign-in from Release 2 onwards. Design: [R2a design](../docs/requirements/release-2/r2a/design.md).

## Local development

Needs Docker Desktop running and the Supabase CLI (`brew install supabase/tap/supabase`).

| Command (from the repo root) | What it does                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:start`              | Starts the local stack, applies migrations and `seed.sql`                                                                    |
| `pnpm db:stop`               | Stops it                                                                                                                     |
| `pnpm db:reset`              | Rebuilds the database from migrations + seed (wipes local data)                                                              |
| `pnpm db:test`               | Runs the pgTAP tests in `tests/database/`                                                                                    |
| `pnpm db:status`             | Shows local URLs and the publishable key for `apps/web/.env.local`                                                           |
| `pnpm test:functions`        | End-to-end tests of the `account-admin`, `invite-redeem`, `leads` and `notifications` edge functions (stack must be running) |

Local addresses use the **553xx** ports, so this project can run next to other local Supabase projects:

|                            | URL                                                       |
| -------------------------- | --------------------------------------------------------- |
| API                        | http://127.0.0.1:55321                                    |
| Studio                     | http://127.0.0.1:55323                                    |
| Mailpit (all local emails) | http://127.0.0.1:55324                                    |
| Database                   | `postgresql://postgres:postgres@127.0.0.1:55322/postgres` |

**Local accounts** are created by [`seed.sql`](seed.sql) (`admin@`, `newadmin@`, `tutor@`, `inactive@local.test`; since R3b also `parent@local.test`, the parent of Aarav Demo and Noah Demo, and `student@local.test`, Aarav Demo's own account; the local-only password is in that file). The seed also adds demo classes and online assignments in every state (returned, waiting for marking, to do, all multiple choice, draft). It never runs on staging or prod. `pnpm db:reset` recreates every account, so sign in again afterwards.

**Two-step locally:** `admin@local.test` has a local-only authenticator, and with `VITE_LOCAL_ADMIN_TWO_STEP_KEY` in `apps/web/.env.development.local` the dev server enters its code for you (design §16.1). Use `newadmin@local.test` to see the two-step setup screen.

**Staff portal locally:** with the stack running, `pnpm dev` and open http://localhost:5173/portal/login. `apps/web/.env.local` needs `VITE_SUPABASE_URL=http://127.0.0.1:55321`, the publishable key from `pnpm db:status`, and `VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA` (see `apps/web/.env.example`). Use `pnpm dev`, not a production build: the production security policy only allows `*.supabase.co`, so a local build can't reach the local stack.

**Edge functions** (`supabase/functions/`) are served by the local stack at http://127.0.0.1:55321/functions/v1/. `account-admin` (was `staff-admin` before R3b) handles staff, student and parent invites, deactivation and two-step resets, and emails invites itself through `EMAIL_TRANSPORT` (Mailpit locally; ADR-0010). `invite-redeem` is the signed-out redeem of an invite link (`verify_jwt = false`). Allowed browser origins are set in `config.toml` (`[edge_runtime.secrets]`). The local stack serves functions from the folder it was **started in**, so start it from the worktree you are testing, and check with `docker inspect supabase_edge_runtime_aj_classes --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}'`. It also doesn't reload edited function code: after changing anything under `supabase/functions/`, run `docker restart supabase_edge_runtime_aj_classes` before testing. Hosted: run `supabase/scripts/deploy.sh`. **Hosted function secrets change only through `deploy.sh`**: never run `supabase secrets set` by hand, because it also copies the local values in `[edge_runtime.secrets]` (the Mailpit transport, `localhost` site URL and the public local worker secret) to the hosted project.

**Portal emails locally** (ADR-0004, ADR-0008): when a tutor returns work or publishes new work, the database queues one email per active student and parent (`email_outbox`); at 15:10 Melbourne time the `due-tomorrow-reminders` job queues a reminder for online work due the next day that isn't handed in. Every 5 minutes `pg_cron` calls the local `notifications` function, which sends them to **Mailpit** (http://127.0.0.1:55324), never out. The seed's returned and published work queues eight on every `pnpm db:reset` (two "work returned", six "new assignment"). The function's local settings are in `config.toml` (`[edge_runtime.secrets]`: `EMAIL_TRANSPORT=mailpit`, the local-only `NOTIFY_WORKER_SECRET`); its address and secret for the cron job are in local Vault (`seed.sql`). To send without waiting: `curl -X POST http://127.0.0.1:55321/functions/v1/notifications -H 'x-notify-secret: local-notify-secret'`. After changing `config.toml`, restart the stack (`pnpm db:stop && pnpm db:start`) so the function sees it.

**Demo data:** `seed.sql` also creates three classes with weekly times, six fictional students ("… Demo") and a few assignments, so every staff page has something to show. The Maths class is hybrid and for Years 7–9 (ADR-0009), so the multi-year label and `Hybrid · <location>` show on the class pages and on the staff, student and parent timetables; the other two classes are single-year (Year 5 in person, Year 8 online).

**Captcha locally** uses Cloudflare Turnstile's always-pass test keys. API calls need `"gotrue_meta_security": {"captcha_token": "XXXX.DUMMY.TOKEN.XXXX"}`.

## Rules

- Never edit a migration that has been applied to staging or prod. Add a new one: `supabase migration new <name>`.
- Every new table: `enable row level security`, `revoke all … from anon, authenticated`, then grant only what's needed (design §7.1).
- Every new function: `set search_path = ''`, revoke `execute` from `public` and `anon`, grant explicitly.
- Roles never come from user metadata.

## Runbooks

### First admin on a new environment

1. Supabase dashboard → Authentication → Users → **Add user** → **Create new user**: their **Email address**, and any long random **User Password** (it is required; they choose their own on the setup form, so don't keep it). Leave **Auto confirm user?** ticked, then **Create user**.
   Then click their row → **Reset password** → **Send password recovery**. The 1-hour link opens `/portal/auth/confirm?…&type=recovery`, then the set-password page, and the portal sends an invited account on to the setup form (`/portal/join`). Don't use **Send invitation**: Supabase invite links are refused since ADR-0010.
2. After they finish the setup form, in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'their@email';
   ```
3. They set up two-step sign-in the first time they open the portal.
4. Repeat for a **second admin**, so either can reset the other's two-step.

### Only admin has lost every authenticator (break-glass)

1. Confirm who they are by calling a number held outside the portal (for example, your own
   contacts). Never use the phone on their portal profile: the account itself can change it.
2. Dashboard → Authentication → the user → delete their MFA factors.
3. Record it:
   ```sql
   insert into public.audit_log (action, target_id, details)
   values ('two_step_reset', '<user id>', '{"via": "break-glass"}');
   ```
4. They set up two-step again on next sign-in.

### Someone leaves

Portal → Admin → Staff → the person → **Deactivate**. Check `public.audit_log`.

### A student leaves a class, or was enrolled by mistake (ADR-0007)

**Removing a student from a class, or archiving the class, doesn't hide their returned work.**
The student and every linked parent can still read it, read-only and tagged "Past class":
questions, options, correct answers, explanations, marks, feedback and the instructions. Work
that wasn't returned is hidden. This is the accepted residual from security review S1 (item 7).
An all-multiple-choice quiz without "hold results" is returned the moment it's handed in, so a
mistakenly enrolled child who submits one keeps it too.

To cut access, pick the narrowest step. None of them works per class:

1. **(a) Archive the student's roster row:** Portal → Admin → Students → **Archive**
   (`students.is_active = false`). This cuts the student and all their parents off from
   everything. Results are kept, and **Restore** brings them back.
2. **(b) Deactivate the student's login:** Admin → Students → the student → Student account →
   **Deactivate**. The student only. Parents still see the work.
3. **(c) Delete the roster row:** this can't be undone, so do (a) or (b) first and use this only
   if the work must be gone. There's no portal button. In the SQL editor, check you have the
   right student first:
   `select full_name from public.students where id = '<student id>';`
   then:
   `delete from public.students where id = '<student id>';`
   Everything linked to the row goes with it, in every class: enrolments, parent links, results,
   answers, the consent recorded on the row, and their "work returned" email rows.
4. **(d) Unlink a parent:** Admin → Students → the student → the parent → **Remove**. That parent
   only.
5. **(e) Delete the assignment:** the assignment page → **Delete**. It's removed for every student.

Staff can't "un-return" online work. A per-class "revoke past-class access" action is in the
Later bucket (ADR-0007).

**Guidance for tutors (security review S2):** students who have left still see later edits to a
returned assignment's title and instructions. Don't put class-only links, meeting details or
anything meant only for current students in an old assignment's instructions. Put them in a new
assignment instead.

### Deploy schema changes

```bash
supabase link --project-ref <staging-ref>
supabase db push
```

Test on staging, then repeat with the prod ref. `db push` does not run `seed.sql`.

### Invites (ADR-0010)

- **Lifetime:** 14 days (336 hours) from each send, and single use. Only the newest link works: a re-send or a cancel switches the old one off, and a failed re-send changes nothing (the previous link keeps working).
- **Where it lives:** `private.invite_tokens` (one row per account, the SHA-256 of the token only, never the token) and `private.invite_redeem_attempts` (salted address hashes for the rate limit, 10 redeems per 15 minutes). Neither is reachable through the API; only the `invite_token_store` / `_claim` / `_release` functions (secret key) touch them.
- **Local flow:** invite from the portal (Staff → Invite staff, or a student's page), open Mailpit (http://127.0.0.1:55324), open the link on `http://localhost:5173/portal/invite#token=…`, then **Continue** → `/portal/join`.
- **Clear the local rate limit** before browser testing: every local request shares one address, so 10 redeems in 15 minutes is easy to hit:

  ```bash
  docker exec supabase_db_aj_classes psql -U postgres -c "delete from private.invite_redeem_attempts;"
  ```

- **Troubleshooting:**
  - "This invitation link has expired…" covers expired, used, replaced, cancelled, garbled and old-format links, an account that already joined, and the rate limit. They all look the same on purpose. Fix: **Resend invite**.
  - **Closed the tab after Continue:** the link is used up, so re-send.
  - **Hosted Auth logs** show each redeem as `user_recovery_requested` followed by a login for that account. That is the sign-in hop, not the person asking for a password reset.
  - **After a rollback** (or to undo the migration's clean-up of pending invites), restore pending invite dates from Auth's own record:

    ```sql
    update public.profiles p set invited_at = u.invited_at from auth.users u where u.id = p.id and p.status = 'invited' and p.invited_at is null;
    ```

### Portal emails (ADR-0004, ADR-0008)

(Called "Work returned emails" before item 8; `deploy.sh` and the item 3 migration still point here by that name.)

Three kinds, one outbox, one worker, one cap. Each person can turn each kind off in Account → Notifications (on by default):

| Kind (Admin → Emails "Type") | Queued by                                                                                                                                                            | Deadline (`send_before`)                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Work returned                | a staff return (trigger on `assignment_results`)                                                                                                                     | none                                                                                                               |
| New assignment               | work becoming published (trigger on `assignments`), for the students enrolled then                                                                                   | end of the due date (Melbourne), or 7 days after publishing with no due date; nothing is queued once it has passed |
| Due tomorrow                 | the `due-tomorrow-reminders` cron job: hourly at `:10`, acting only at 15:10 Melbourne; online work due the next day, not handed in, published before the day before | start of the due date (Melbourne)                                                                                  |

How it works: rows go into `public.email_outbox` (no address or body stored); the `email-worker-kick` cron job (every 5 min) first fails pending rows past their deadline as "Too late to send", then calls the `notifications` function, which claims reminders first and everything else oldest first, sends through Resend's HTTP API (hosted) and marks each row sent. App cap: **70 in any rolling 24 hours, shared by all three kinds**, so sign-in emails always keep 30 of Resend Free's 100 a day. Admins see failed sends, and sends still waiting after ~2 hours, at **Portal → Admin → Emails**.

**Deploy order: migration first, then the function.** `deploy.sh` pushes migrations and then deploys functions, so one run is safe. By hand: `supabase db push`, then `supabase functions deploy notifications`. Don't deploy the function first: the new worker calls `notify_claim_emails(supported_kinds)`, which the old database doesn't have (`PGRST202`). It then falls back to the old claim, so "work returned" keeps sending, but "new assignment" and "due tomorrow" don't exist until the migration lands; the function log shows `notifications claim: old database, work returned only`. The other way round is safe: today's worker calls it with no argument and keeps claiming only "work returned"; new-kind rows wait (Waiting / "Not attempted" after 2 hours, then "Too late to send") until the function is deployed.

**Set up once on the hosted project** (after `deploy.sh`, which prints these lines). Dashboard → SQL Editor, with `NOTIFY_WORKER_SECRET` from the password manager (never pasted into chat or git):

```sql
select vault.create_secret('https://unzjnxctkyahtmrkinyr.supabase.co/functions/v1/notifications', 'notify_worker_url');
select vault.create_secret('<NOTIFY_WORKER_SECRET>', 'notify_worker_secret');
```

Then delete that query from the SQL Editor's saved snippets and history, so the secret is only in Vault and the password manager.

To change the secret later: `select vault.update_secret(id, '<new value>') from vault.secrets where name = 'notify_worker_secret';`, then run `deploy.sh` again with the same new value.

**Keep `net` out of the exposed API schemas** (Dashboard → Project Settings → API → Exposed schemas: only `public` and `graphql_public`). The migration enables `pg_net`, and Supabase lets signed-in users run `net.http_post`; exposing `net` would let anyone signed in make the server send web requests.

**Retention:** the `daily-history-trim` cron job keeps the cron log to 7 days and deletes sent, skipped and failed emails after 90 days. Waiting emails are kept until they go out.

**Release check (AC-3.11), on the hosted project.** Staging and prod share one database, so a return made on staging emails real families. Test only with a fake family that uses your own addresses:

1. Admin: create a student "Test Student" with an alias of your address, invite them, and a parent "Test Parent" with a second alias; accept both invites.
2. Create a class "Test class" with only that student, taught by a test tutor; publish one paper assignment.
3. As the test tutor, return it with a mark.
4. Within 5 minutes both aliases get "… has been marked" from `hello@ajclasses.com.au`; **View feedback** opens the right page.
5. Portal → Admin → Emails says "No failed or waiting emails".
6. New assignment: in the same test class, publish one paper assignment. Within 5 minutes both aliases get "New work set" / "New work for …" (03b §8.11).
7. Due tomorrow: set up one online assignment in the test class due tomorrow, published 2 or more days earlier. After 15:10 Melbourne both aliases get "Due tomorrow" / "… is due tomorrow".
8. Delete the test class (its outbox rows go with it), then the test accounts.

**On the first 15:10 run after item 8's deploy**, already-published online work due the next day sends reminders to real families. That's by design (04b Q31).

**Stop the "due tomorrow" reminders only:** `select cron.unschedule('due-tomorrow-reminders');`. Nothing new is queued; reminders already queued still go out (or expire). Turn back on with the `cron.schedule('due-tomorrow-reminders', …)` line in `migrations/20261029100000_more_email_alerts.sql`.

**Kill switches** (three, and they stop different things):

- `select cron.unschedule('email-worker-kick');` stops **only queued app email**. Rows wait; nothing is lost. Invites don't use the outbox, so they keep sending. Turn back on with the `cron.schedule('email-worker-kick', …)` line in `migrations/20261025110000_work_returned_email.sql`.
- `supabase secrets unset EMAIL_TRANSPORT --project-ref unzjnxctkyahtmrkinyr` stops **app emails and invites** (an `unset` copies nothing from `config.toml`; only `set` does). From the next kick the worker sends nothing, flags waiting rows, and returns 503 before it even checks the secret, so they show as Waiting / "Set-up error" (after the usual ~2 hours), never "Not attempted". Every invite and re-send fails with "The invite e-mail couldn't be sent", no account is left behind, a re-send changes nothing, and linking an existing parent still works. It **doesn't** stop password-reset or sign-in emails, which go through Auth SMTP. Turn it back on by running `deploy.sh` again.
- **Stop invite links that were already sent** (06-security finding 4). Unsetting `EMAIL_TRANSPORT` stops new invites, but links already emailed stay valid for 14 days. In the Dashboard SQL editor, mark every unused link as used:

  ```sql
  update private.invite_tokens set used_at = now() where used_at is null;
  ```

  Every outstanding link then shows "This invitation link has expired…". Re-send to the people who should still join. Hard stop, which refuses every redeem until `deploy.sh` runs again: `supabase functions delete invite-redeem --project-ref unzjnxctkyahtmrkinyr`.

**Admin Emails page reasons:** "Too late to send" means a "new assignment" or "due tomorrow" email was still waiting at its deadline (usually the daily limit, or an outage), so it was never sent; if these recur, it's 02b Decision 1's Resend upgrade trigger (`docs/budget.md` §5). "Not attempted" after 2 hours means the cron job or the Vault entries are missing (or, for the new kinds only, the `notifications` function hasn't been deployed since the migration); "Set-up error" means `EMAIL_TRANSPORT`, `RESEND_API_KEY` or `SITE_URL` is missing on the function, or the hosted function has local-only values (`EMAIL_TRANSPORT=mailpit`, the local worker secret or a non-https `SITE_URL`: run `deploy.sh` again); "Daily limit" means 70 were sent in the last 24 hours (they go out as earlier ones age out); "Gave up after 3 tries" means Resend kept failing. When Resend is busy (429) or can't be reached, the worker stops the batch and puts the unsent rows back; each of those still uses one of its 3 attempts, so a long outage can end rows as "Gave up after 3 tries" even though Resend never accepted them.

**If `pnpm test:functions` was interrupted** and local emails stop: the notifications script pauses the `email-worker-kick` and `due-tomorrow-reminders` cron jobs while it runs and resumes them on exit or Ctrl-C. If that ever didn't happen:

```bash
docker exec supabase_db_aj_classes psql -U postgres -c "select cron.alter_job(jobid, active := true) from cron.job where jobname in ('email-worker-kick', 'due-tomorrow-reminders')"
```

`pnpm db:reset` also restores it.

### Project paused (free plan)

A free project pauses after a week without use, and nobody can sign in. Dashboard → the project → **Restore**. See the R2a review, question Q5 (move to Pro before real use).

## Known local issues

- **Postgres crash on a denied function call in `psql`.** In the local image (Postgres 17.6, CLI 2.99), calling a function you have no `EXECUTE` right on from a `psql` session crashes the server (signal 11). The same call through the API correctly returns `42501 permission denied`. Tests therefore check function rights with `has_function_privilege` instead of calling. If the local stack stops responding, run `pnpm db:stop && pnpm db:start`.
- `banned_until = 'infinity'` breaks sign-in for that user. Use a finite ban (the app uses 100 years).
- **`supabase` killed with exit 137 after a macOS update:** macOS reports the Homebrew binary's signature as invalid. Reinstall it: `brew reinstall supabase`. Running containers keep working meanwhile.
- **`supabase migration new` hangs in scripts.** It waits for input when there is no terminal. Run it as `supabase migration new <name> < /dev/null`, or create the file by hand with a timestamp prefix.
- **Supabase Auth saves `app_metadata` in a second step** after creating a user, so an insert trigger never sees it (R3b review F30). The profile role is also applied when `app_metadata` changes, but only before the person joins.
- **Vite dev server: "Failed to load url … Does the file exist?"** for a file created after the file that imports it. Save (or `touch`) the importing file and reload.
