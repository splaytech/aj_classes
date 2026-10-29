# ADR-0010: Invites use our own 14-day token, then a one-time Supabase sign-in hop

- **Status:** Proposed (2026-10-29, Architect, `/deliver` invite-14-days, Stage 2; revised after review-2)
- **Source:** `docs/delivery/2026-10-29-invite-14-days/02-architecture.md` §2–§6

## Context

Saurabh wants invites to stay valid for 14 days. Password-reset and sign-in links must keep their 1-hour life.

- Supabase Auth has one expiry for every email link (`otp_expiry`, `config.toml:235`). An Auth invite can't outlive a reset link.
- Supabase also refuses to invite a confirmed e-mail. That is why a re-send to someone who opened their link sends a password-reset email today (`account-admin/handlers/accounts.ts:91-105`).
- Saurabh approved the direction: our own single-use token, stored hashed, valid for 336 hours from the send, emailed through Resend. A server function then issues a fresh Supabase link that signs the person in.

## Decision

1. **Storage.** `private.invite_tokens` holds one row per account:
   - the primary key is `profile_id`, which cascades from `profiles`;
   - `token_hash` (SHA-256 hex, unique), `sent_at`, `expires_at` and `used_at`.

   It is in a schema PostgREST doesn't expose. All privileges are revoked from `public, anon, authenticated, service_role`, and RLS is on with no policies. The only way in is three `security definer` functions that only `service_role` can execute:
   - `invite_token_store`: upserts the token and sets `profiles.invited_at`, only while the account is `invited`;
   - `invite_token_claim`: rate limit, then a single-use claim, only while the account is `invited` and active;
   - `invite_token_release`: undoes a claim when the sign-in hop fails.
2. **Token.** 32 random bytes as base64url (43 characters, 256 bits). Only the hash is stored. The link is `${SITE_URL}/portal/invite?token=…`. A re-send replaces the row, so only the newest link works.
3. **Send.** `account-admin` sends the invite directly through the Resend/Mailpit transport that `notifications` already uses (moved to `_shared/email/`). It does not go through the outbox, and the 70-a-day cap doesn't apply.
   - The token is stored, and the old one replaced, only **after the transport has accepted the email**.
   - A failed send changes nothing.
   - Unsetting `EMAIL_TRANSPORT` stops invites as well as app email, but not Auth's own emails.
4. **Redeem.** A new function, `invite-redeem`:
   - `verify_jwt = false`, allowed origins only;
   - 10 attempts per 15 minutes per salted IP hash;
   - the same `invite_invalid` reply for every refusal.

   It claims the token while holding a `for share` lock on the profile, then calls `auth.admin.generateLink({ type: 'recovery' })`.
   - `recovery`, not `magiclink`: for an unknown e-mail, `magiclink` silently signs the user up (GoTrue v2.197.0 `mail.go:76-84`), while `recovery` returns 404 (`:85-86`). For an existing user the two behave identically.
   - The function requires the reply's `user.id` to equal the claimed profile and `verification_type` to be `recovery`. Otherwise it deletes any stray new user, releases the claim and refuses.
   - It returns only `hashed_token`. The browser calls `verifyOtp({ token_hash, type: 'recovery' })` straight away (one automatic retry, then `Try again`), and then opens the existing setup form.
   - There is no `type: 'email'` fallback. `account-admin` keeps `verify_jwt = true`.
5. **`invited_at`.** It is set only by `invite_token_store`. The `auth.users` update trigger copies Auth's `invited_at` only when it changes to a non-null value, so the sign-in hop can't wipe it.
6. **Old links.** Old-format `/portal/auth/confirm?…&type=invite` links are refused on the page, which never calls `verifyOtp` for them. No Auth setting or template changes.

## Consequences

- Invites last 14 days. A re-send always sends an invite, never a reset email. Password reset, sign-in and MFA are untouched.
- Invite email now goes through the Resend API instead of Auth SMTP. It is the same account and the same Free-plan daily total, so ADR-0004's budget is unchanged.
- Invite delivery now depends on `EMAIL_TRANSPORT`, `RESEND_API_KEY` and `SITE_URL`, which `deploy.sh` already sets and checks. The kill switch covers invites, and the README must say so.
- One more public-facing function (`invite-redeem`) to deploy and keep in `deploy.sh`.
- The release goes production web (`main`) first, then the migration and functions. A rollback moves web and functions back together. Staging shares the project, so invites aren't tested there until the functions are deployed.
- A link whose redeem succeeded but whose browser never signed in (tab closed) is used up, and the admin re-sends. This is accepted.
- An old-format token can still be used directly against Auth for up to an hour after release. It only reaches the setup form of the account it was sent to. This is accepted.
- The Dashboard "Invite user" path no longer gives a working link. The "First admin" runbook moves to Add user plus password recovery.
- Mobile reads the correct `invited_at`, but keeps its 1-hour rule until the deferred D1 ships.

## Alternatives rejected

- **Raising `otp_expiry` to 14 days:** it would make reset and magic links last 14 days too, against the requirement.
- **Queueing invites in the outbox:** the admin needs a synchronous result to roll back a first-time invite, and the cap and the 5-minute delay don't fit.
- **A redeem action inside `account-admin`:** it would mean turning off the gateway token check for every admin action.
- **`generateLink` type `invite`:** it fails for confirmed e-mails and re-stamps `invited_at`.
- **`generateLink` type `magiclink`:** it creates a user for an unknown e-mail, so a redeem racing a cancel could leave an orphan account. An identity check afterwards would only be clean-up.
- **Returning `action_link` or `email_otp` to the browser:** the first puts the token in a Supabase redirect URL, and the second exposes the e-mail.
- **Storing the token on `profiles`, or in a `public` table:** either is one grant away from being readable.
