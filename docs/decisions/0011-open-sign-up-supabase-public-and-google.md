# ADR-0011: Open sign-up uses Supabase public sign-up with Google; new accounts are a `user` role, guarded by a hook and two triggers

- **Status:** Proposed (2026-11-14, Architect at Stage 2, round 3 after `review-2.md` Round 2 and `00-decisions.md` Round 2)
- **Source:** `docs/delivery/2026-11-13-open-sign-up/02-architecture.md`
- **Checked against:** Supabase Auth (GoTrue) v2.197.0, the local image and `supabase/.temp/gotrue-version`

## Context

Saurabh wants parents and guardians to sign up themselves, by e-mail or with Google, live at release. Facebook and Apple are deferred. A signed-up parent is a "user" who sees posts until staff link them to a child.

The schema used to make any account with no role marker a `tutor`. GoTrue links an OAuth identity to any existing user with the same verified e-mail. A repeat `signUp` for an unconfirmed e-mail keeps the first password (`signup.go:194-197`), so a stranger who signs up first holds a password until something removes it.

Saurabh's rule: a provider login never attaches itself to an existing account.

## Decision

1. **Supabase public sign-up** with `enable_confirmations = true` and the native Turnstile. The form sends a throwaway random password; the parent types their real one on `/portal/join` (user variant). Google uses `signInWithOAuth` (PKCE) and `/portal/auth/callback`.
2. **Fail-closed role.** Unknown or missing `app_metadata.account_role` → `user`, and the `profiles.role` default is `'user'`. Staff invites set `account_role = 'tutor'`. Invites are created with `email_confirm: true`, and the migration confirms existing non-`user` accounts.
3. **Release order.** `deploy.sh` runs: gate (sign-ups off, or `sign_up_guard_ready()`) → `db push` → `sign_up_guard_ready()` → functions → secrets → `config push` last. The guard checks behaviour (the role mapping, the column default, the hook and triggers exist, and `postgres` can write the Auth tables the triggers and finish step write to), not migration history. After `config push`, `deploy.sh` checks the hook is on and e-mail confirmations are on, and closes sign-up again if not.
4. **`before-user-created` hook**, under one global advisory lock. It refuses new accounts when `private.sign_up_settings.open` is false (admin toggle, default open). It refuses Google without a verified, non-empty e-mail, and any provider other than `email` or `google`. It refuses the 16th new e-mail sign-up in 24 h.
5. **Linking trigger** (`before insert on auth.identities`). A `google` identity is allowed only for a `user` that is `invited`, active, unconfirmed and has no identity yet, which means a brand-new account. Every other insert from a provider other than `email` is refused.
6. **Confirm-time wipe** (`before update of email_confirmed_at on auth.users`). When an unfinished `user` first proves the mailbox, it sets `encrypted_password = null` and deletes `auth.mfa_factors`. No password stored before the proof ever works.
7. **`complete_sign_up`** needs a session whose `amr` includes one of `otp`, `recovery`, `email/signup`, `magiclink`, `oauth` (fail closed). E-mail accounts also need a password set in that session, plus Terms. It activates the account, deletes factors and other sessions, and audits. `complete_onboarding` refuses users, and `my_onboarding` excludes them.
8. **Promotion** (parent only) is `admin_promote_user` plus `app_metadata.account_role = 'parent'`. There is no credential clearing: every finished account has proven the mailbox, by e-mail link or a Google-verified e-mail.

## Consequences

- Production can't open sign-up before the role hole is closed, and a failed deploy leaves it closed. The kill switch needs no secret or redeploy.
- Only the mailbox owner can hold a session on an unfinished account. A stranger's raw-API password is wiped at confirmation.
- A Google login never takes over a tutor, admin, invitee, family or finished-user account. People with an existing account use e-mail and password; manual linking is deferred.
- Accepted residuals (Saurabh, Round 2):
  - R1: `signUp`'s raw reply reveals whether an e-mail has an account.
  - R2: resends and resets are outside the cap and could use up Resend Free's daily 100.
  - A slot is used even if a sign-up then fails.
- Access tokens already issued stay valid up to `jwt_expiry` after their sessions are deleted. Only the owner can hold one, and a `user` reads only its own profile and posts.
- The design relies on `postgres` being able to put triggers on `auth.users` and `auth.identities`, and to delete from `auth.mfa_factors` and `auth.sessions`. If it can't, the migration fails and sign-up stays closed.
- `user` is effectively permanent in the `app_role` enum.
- Adding Facebook later needs credential clearing at promotion and a `session_id` check for live tokens, because Facebook e-mails are always "verified" (`provider/facebook.go:96`). Apple needs a 6-monthly secret and relay-domain registration.

## Alternatives rejected

- **Our own sign-up function with Supabase sign-up off:** Saurabh chose Supabase public sign-up.
- **Password on the form:** a stranger who signs up first keeps a working password, and a second sign-up's password is ignored.
- **Clearing sessions alone, without the confirm-time wipe:** the stranger knows the password and signs in again.
- **Allowing a link to unconfirmed sign-ups (GoTrue's own takeover):** it breaks "never attaches to an existing account". The person uses the e-mail link or Forgot password instead.
- **An RLS `session_id` check on every policy:** it protects nobody once only the owner can hold a session.
- **An Auth send-email hook for an exact cap:** every Auth e-mail would depend on our code; kept for later if R2 bites.
- **A function-secret kill switch:** `secrets set` copies local values to production.
- **Student/parent role plus a flag:** mobile trusts `account_role` on its own.
