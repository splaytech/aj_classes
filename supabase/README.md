# Supabase (database, auth, storage)

Backend for staff sign-in from Release 2 onwards. Design: [R2a design](../docs/requirements/release-2/r2a/design.md).

## Local development

Needs Docker Desktop running and the Supabase CLI (`brew install supabase/tap/supabase`).

| Command (from the repo root) | What it does                                                       |
| ---------------------------- | ------------------------------------------------------------------ |
| `pnpm db:start`              | Starts the local stack, applies migrations and `seed.sql`          |
| `pnpm db:stop`               | Stops it                                                           |
| `pnpm db:reset`              | Rebuilds the database from migrations + seed (wipes local data)    |
| `pnpm db:test`               | Runs the pgTAP tests in `tests/database/`                          |
| `pnpm db:status`             | Shows local URLs and the publishable key for `apps/web/.env.local` |

Local addresses use the **553xx** ports, so this project can run next to other local Supabase projects:

|                            | URL                                                       |
| -------------------------- | --------------------------------------------------------- |
| API                        | http://127.0.0.1:55321                                    |
| Studio                     | http://127.0.0.1:55323                                    |
| Mailpit (all local emails) | http://127.0.0.1:55324                                    |
| Database                   | `postgresql://postgres:postgres@127.0.0.1:55322/postgres` |

**Local accounts** are created by [`seed.sql`](seed.sql) (`admin@`, `tutor@`, `inactive@local.test`; the local-only password is in that file). The seed never runs on staging or prod.

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

### Project paused (free plan)

A free project pauses after a week without use, and nobody can sign in. Dashboard → the project → **Restore**. See the R2a review, question Q5 (move to Pro before real use).

## Known local issues

- **Postgres crash on a denied function call in `psql`.** In the local image (Postgres 17.6, CLI 2.99), calling a function you have no `EXECUTE` right on from a `psql` session crashes the server (signal 11). The same call through the API correctly returns `42501 permission denied`. Tests therefore check function rights with `has_function_privilege` instead of calling. If the local stack stops responding, run `pnpm db:stop && pnpm db:start`.
- `banned_until = 'infinity'` breaks sign-in for that user. Use a finite ban (the app uses 100 years).
