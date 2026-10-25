# Supabase (database, auth, storage)

Backend for staff sign-in from Release 2 onwards. Design: [R2a design](../docs/requirements/release-2/r2a/design.md).

## Local development

Needs Docker Desktop running and the Supabase CLI (`brew install supabase/tap/supabase`).

| Command (from the repo root) | What it does                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm db:start`              | Starts the local stack, applies migrations and `seed.sql`                                                   |
| `pnpm db:stop`               | Stops it                                                                                                    |
| `pnpm db:reset`              | Rebuilds the database from migrations + seed (wipes local data)                                             |
| `pnpm db:test`               | Runs the pgTAP tests in `tests/database/`                                                                   |
| `pnpm db:status`             | Shows local URLs and the publishable key for `apps/web/.env.local`                                          |
| `pnpm test:functions`        | End-to-end tests of the `account-admin`, `leads` and `notifications` edge functions (stack must be running) |

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

**Edge functions** (`supabase/functions/`) are served by the local stack at http://127.0.0.1:55321/functions/v1/. `account-admin` (was `staff-admin` before R3b) handles staff, student and parent invites, deactivation and two-step resets; its allowed browser origins are set in `config.toml` (`[edge_runtime.secrets]`). Hosted: `supabase functions deploy account-admin` and `supabase secrets set ALLOWED_ORIGINS=...`.

**"Work returned" emails locally** (ADR-0004): when a tutor returns work, the database queues one email per active student and parent (`email_outbox`). Every 5 minutes `pg_cron` calls the local `notifications` function, which sends them to **Mailpit** (http://127.0.0.1:55324), never out. The seed's returned work queues two on every `pnpm db:reset`. The function's local settings are in `config.toml` (`[edge_runtime.secrets]`: `EMAIL_TRANSPORT=mailpit`, the local-only `NOTIFY_WORKER_SECRET`); its address and secret for the cron job are in local Vault (`seed.sql`). To send without waiting: `curl -X POST http://127.0.0.1:55321/functions/v1/notifications -H 'x-notify-secret: local-notify-secret'`. After changing `config.toml`, restart the stack (`pnpm db:stop && pnpm db:start`) so the function sees it.

**Demo data:** `seed.sql` also creates three classes with weekly times, six fictional students ("… Demo") and a few assignments, so every staff page has something to show.

**Captcha locally** uses Cloudflare Turnstile's always-pass test keys. API calls need `"gotrue_meta_security": {"captcha_token": "XXXX.DUMMY.TOKEN.XXXX"}`.

## Rules

- Never edit a migration that has been applied to staging or prod. Add a new one: `supabase migration new <name>`.
- Every new table: `enable row level security`, `revoke all … from anon, authenticated`, then grant only what's needed (design §7.1).
- Every new function: `set search_path = ''`, revoke `execute` from `public` and `anon`, grant explicitly.
- Roles never come from user metadata.

## Runbooks

### First admin on a new environment

1. Supabase dashboard → Authentication → **Invite user** (their email).
2. After they accept and set a password, in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'their@email';
   ```
3. They set up two-step sign-in the first time they open the portal.
4. Repeat for a **second admin**, so either can reset the other's two-step.

### Only admin has lost every authenticator (break-glass)

1. Confirm who they are by phone.
2. Dashboard → Authentication → the user → delete their MFA factors.
3. Record it:
   ```sql
   insert into public.audit_log (action, target_id, details)
   values ('two_step_reset', '<user id>', '{"via": "break-glass"}');
   ```
4. They set up two-step again on next sign-in.

### Someone leaves

Portal → Admin → Staff → the person → **Deactivate**. Check `public.audit_log`.

### Deploy schema changes

```bash
supabase link --project-ref <staging-ref>
supabase db push
```

Test on staging, then repeat with the prod ref. `db push` does not run `seed.sql`.

### Work returned emails (ADR-0004)

How it works: a staff return queues rows in `public.email_outbox` (no address or body stored); the `email-worker-kick` cron job (every 5 min) calls the `notifications` function, which sends through Resend's HTTP API (hosted) and marks each row sent. App cap: **70 in any rolling 24 hours**, so sign-in emails always keep 30 of Resend Free's 100 a day. Admins see failed sends, and sends still waiting after ~2 hours, at **Portal → Admin → Emails**.

**Set up once on the hosted project** (after `deploy.sh`, which prints these lines). Dashboard → SQL Editor, with `NOTIFY_WORKER_SECRET` from the password manager (never pasted into chat or git):

```sql
select vault.create_secret('https://unzjnxctkyahtmrkinyr.supabase.co/functions/v1/notifications', 'notify_worker_url');
select vault.create_secret('<NOTIFY_WORKER_SECRET>', 'notify_worker_secret');
```

To change the secret later: `select vault.update_secret(id, '<new value>') from vault.secrets where name = 'notify_worker_secret';`, then run `deploy.sh` again with the same new value.

**Release check (AC-3.11), on the hosted project.** Staging and prod share one database, so a return made on staging emails real families. Test only with a fake family that uses your own addresses:

1. Admin: create a student "Test Student" with an alias of your address, invite them, and a parent "Test Parent" with a second alias; accept both invites.
2. Create a class "Test class" with only that student, taught by a test tutor; publish one paper assignment.
3. As the test tutor, return it with a mark.
4. Within 5 minutes both aliases get "… has been marked" from `hello@ajclasses.com.au`; **View feedback** opens the right page.
5. Portal → Admin → Emails says "No failed or waiting emails".
6. Delete the test class (its outbox rows go with it), then the test accounts.

**Stop all sends at once (kill switch):** `select cron.unschedule('email-worker-kick');`. Rows wait; nothing is lost. Turn back on with the `cron.schedule('email-worker-kick', …)` line in `migrations/20261025110000_work_returned_email.sql`. Or unset `EMAIL_TRANSPORT`: rows then show as Waiting / "Set-up error".

**Admin Emails page reasons:** "Not attempted" after 2 hours means the cron job or the Vault entries are missing; "Set-up error" means `EMAIL_TRANSPORT`, `RESEND_API_KEY` or `SITE_URL` is missing on the function; "Daily limit" means 70 were sent in the last 24 hours (they go out as earlier ones age out); "Gave up after 3 tries" means Resend kept failing.

**If `pnpm test:functions` was interrupted** and local emails stop: the notifications script pauses the cron job while it runs and resumes it on exit or Ctrl-C. If that ever didn't happen:

```bash
docker exec supabase_db_aj_classes psql -U postgres -c "select cron.alter_job(jobid, active := true) from cron.job where jobname = 'email-worker-kick'"
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
