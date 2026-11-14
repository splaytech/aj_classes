# Release notes: open sign-up for parents and guardians

For Saurabh. Branch `feature/open-sign-up`, built and tested on the local stack only (nothing hosted was touched). [ADR-0011](../../decisions/0011-open-sign-up-supabase-public-and-google.md), [05-dev-notes.md](05-dev-notes.md).

## What changes for people

- On the Sign in page, "New to AJ Classes? Create an account" opens a sign-up page for parents and guardians: name and e-mail only. A confirmation link arrives by e-mail; it leads to a short finish step (a password and the Terms tick). They then see **Latest news** and their Account page, nothing else.
- "Continue with Google" is built but **stays off** in this release. The button only appears once Google is switched on (step 4).
- Admin → **Users** lists everyone who signed up (how, when, finished or not), with Close / Open sign-up and Deactivate / Reactivate.
- On a student's page, **Invite or link a parent** with a signed-up user's e-mail asks you to confirm, then makes them a parent of that child. No e-mail is sent.
- New pages: `/terms` (Terms & Conditions). The Privacy Policy now says parents and guardians can sign up.

## What you need to do

1. **Before merging: approve the wording.** The release waits for this (Decision 4).
   - The Terms draft: `/terms` (`TERMS` in `apps/web/src/constants/content.constants.ts`).
   - The Privacy changes (`PRIVACY`, same file): "What we collect", the start of "Portal accounts", and "Optional permissions". Two sentences differ from the design's draft so they stay true; please check them: Google also gives us a link to your profile picture (we use only the name and e-mail), and a signed-up account's e-mails include security notices such as "Your password was changed".
2. **Hook check (read-only, yours).** Supabase Dashboard → Authentication → **Hooks**: confirm that "Before User Created" is offered on this plan. I asked for this at the start of the build; **no answer yet**. If it isn't offered, **don't run `deploy.sh`**: sign-up can't open safely, and the Architect re-plans the switch and the daily cap.
3. **Order on release day.** No staff, student or parent invites while you do this.
   1. Merge to `develop`, check staging, then merge to `main`. Production web goes live; the "Create an account" link stays hidden until `deploy.sh` has run, because the hosted database has no sign-up status check yet (the page reads that as "closed").
   2. Run `supabase/scripts/deploy.sh` as usual (it reads `supabase/.env.deploy`; Google is off, so no Google values are needed). The order is new: it checks the sign-up guard, runs the migrations, checks the guard again, deploys functions and secrets, and pushes the Auth settings that open sign-up **last**, then checks the hook is on. If anything fails after sign-up was opened, it closes sign-up again and says so.
   3. Do one real e-mail sign-up on `https://ajclasses.com.au/portal/sign-up` with an address of your own, through to Latest news. Then deactivate it in Admin → Users (or keep it as a test user).
4. **Google, when you're ready** (e-mail can go live first; lead assumption Q3).
   1. Google Cloud: create a project. OAuth consent screen: External, In production, scopes `openid email profile` (non-sensitive, so no app verification).
   2. Create a **Web client**. Authorised redirect URI: `https://unzjnxctkyahtmrkinyr.supabase.co/auth/v1/callback`. Authorised JavaScript origin: `https://ajclasses.com.au`. The consent screen will show the Supabase domain (no custom domain, Decision 8).
   3. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `supabase/.env.deploy` and save them under a password-manager item name. Never in chat or git.
   4. On a new branch, change `[remotes.production.auth.external.google] enabled` to `true` in `supabase/config.toml`. That one line is the whole change.
   5. Merge it, run `deploy.sh` (it now asks for the two Google values), and do one real Google sign-up.
5. **Closing sign-up.** Admin → Users → **Close sign-up**. Emergency fallback if the portal is down: Dashboard → Authentication → Sign In / Providers → "Allow new users to sign up" off. The next `deploy.sh` turns that back on, so close the admin switch too. Details: `supabase/README.md` → "Close sign-up".
6. **Watch.** If "Sign-up is busy right now" shows on real days (15 e-mail sign-ups a day), or Auth e-mails stop because Resend Free's 100 a day ran out (R2), move to Resend Pro (about A$31 a month).
7. **Rollback.** Set `[auth] enable_signup = false` in `supabase/config.toml` and run `deploy.sh`. The migration stays; signed-up users keep their accounts.
8. **Residual risks** (accepted or recorded):
   - **R1:** Supabase's raw sign-up reply shows whether an e-mail has an account (the page never does). Locally the raw reply for any confirmed address is `422 user_already_exists`; setting `[auth.sms] enable_confirmations = true` would make Supabase send its quiet 200 instead (an option, not done).
   - **R2:** resends and Forgot password aren't counted by the 15-a-day cap and could use up Resend Free's daily allowance.
   - **R3:** promoting a Google-only account rests on Google's past check of that address. The confirm message says "Signed up with Google".
9. **What wasn't verified** (local stack only):
   - The hosted plan offers "Before User Created" (step 2).
   - Hosted `postgres` can create the two triggers on `auth.identities` and `auth.users` (it can locally). If it can't, the migration fails at step 3/7 and sign-up stays closed.
   - Hosted `postgres` DML on the Auth tables the guard writes to: DELETE on `auth.mfa_factors` and `auth.sessions`, UPDATE on `auth.users` (granted locally by `supabase_auth_admin`). `sign_up_guard_ready()` now checks these, so if they're missing `deploy.sh` stops at the guard check and sign-up stays closed (review-5 finding 4).
   - A real Google sign-in (no Google client exists). The callback page is tested against the error shapes read from GoTrue's source, and the button against a stubbed settings answer.
   - Auth's per-IP limit of 30 sign-ins and sign-ups per 5 minutes (AC-39): the local Auth doesn't enforce IP limits at all, so only the setting is checked.
   - Mobile with a signed-up account (AC-40): the Tester's manual check. No mobile code changed.
   - Whether `config push` with Google `enabled = false` really needs no Google values on the hosted project (read from the CLI source; `deploy.sh` doesn't ask for them).

## For `_knowledge/decisions.md`

The lead copies these into `~/second-brain/Projects/AJClasses/_knowledge/decisions.md` at close-out.

- **DEC-OS-1 (ADR-0011):** Supabase public sign-up (e-mail, confirmations on, native Turnstile) plus Google only. The form sends a throwaway password; the real one is set on the finish step. Facebook and Apple are deferred.
- **DEC-OS-2 (ADR-0011):** No marker → `user` (mapping and column default). Staff invites set `account_role = 'tutor'`. Invites are created confirmed, and the migration confirms existing non-user accounts.
- **DEC-OS-3 (ADR-0011):** `deploy.sh`: gate (off, or `sign_up_guard_ready()`) → `db push` → guard check → functions → secrets → `config push` last, then a check that the hook is on, confirmations are on and sign-up is on; a failed push or check closes sign-up again.
- **DEC-OS-4 (ADR-0011):** The before-user-created hook enforces the kill switch (`private.sign_up_settings.open`, admin toggle, default open), a verified non-empty Google e-mail, fail-closed providers, and 15 new e-mail sign-ups per rolling 24 h under one advisory lock.
- **DEC-OS-5 (ADR-0011):** One linking rule: a `google` identity is inserted only for a `user` that is `invited`, active, unconfirmed and has no identity. Everything else is refused.
- **DEC-OS-6 (ADR-0011):** At first mailbox proof, the `auth.users` trigger clears `encrypted_password` and deletes `auth.mfa_factors` for an unfinished `user`. `complete_sign_up` needs an e-mail-link or Google `amr`, a password set in that session (e-mail accounts) and Terms. It deletes factors and other sessions.
- **DEC-OS-7:** Promotion (parent only) is `admin_promote_user` plus `app_metadata.account_role`, with no credential clearing while only e-mail and Google exist. Reactivate is in v1.
- **Where the design differed from 02:** `admin_list_users()` returns the sign-up method for every row (no N+1); `my_has_password()` decides whether Change password shows; deactivating an unconfirmed user also confirms it (S4(b) showed Auth would keep mailing a banned, unconfirmed address); the hook also refuses a bad name and any incoming `account_role`; `deploy.sh` checks after `config push` that the hosted hook is on, and closes sign-up if not; the local Google redirect is `:55321`.
- **Review-3 changes:** Google ships off in production (`enabled = false`; `deploy.sh` needs the Google values only when it says `true`); `deploy.sh` fails closed ((a) a failed guard check on a re-deploy closes sign-up, (b) a failed close says so loudly, (c) the guard check retries 5 times, (d) the token sits in a 0600 header file, never in argv); `grant usage on schema public to supabase_auth_admin`, checked by `sign_up_guard_ready()`; every `amr` entry must be a link or Google method (`[otp, unknown]` is refused).
- **Found in the build (05-dev-notes):** link sessions are `[otp]` (recovery too) and keep it across refreshes; PKCE e-mail links carry `pkce_` hashes and still verify with `token_hash`; GoTrue answers a sign-up for any confirmed address with `422 user_already_exists`, which the page shows as the normal "check your e-mail" card; API sessions refuse an UPDATE with no WHERE (`pg-safeupdate`).
- **R3:** promoting a Google-only account rests on Google's past verification of that address (`email_verified` means "verified once"). The admin sees "Signed up with Google" before confirming.
