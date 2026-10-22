# Invite onboarding

Replaces "click the invite link → choose a password → you're in" with a closed setup step.
Applies to every invited account: tutors, students and parents.

## Rules

| #   | Rule                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O1  | Invite only. Public sign-up stays off (`config.toml` `enable_signup = false`); accounts are created only by the `account-admin` function, for an active admin.     |
| O2  | The invite link is Supabase Auth's own token: single use, expires after **1 hour** (`otp_expiry`, shared with password-reset links).                               |
| O3  | An expired or used invite link shows: _"This invitation link has expired. Please contact your AJ Classes administrator to request a new invite."_                  |
| O4  | A new account is `invited`. It becomes `active` only when `complete_onboarding()` succeeds. Until then it can read and change nothing (every access rule needs `active`). |
| O5  | The setup form's fields come from the role the server reports (`my_onboarding()`), never from the link or the browser.                                             |
| O6  | The password is saved by the person's own session (`auth.updateUser`); Supabase Auth hashes it. `complete_onboarding()` refuses an account with no password.        |

## Fields

| Field                            | Tutor (staff) | Student | Parent |
| -------------------------------- | :-----------: | :-----: | :----: |
| Full name (2–100)                |       ✓       |    ✓    |   ✓    |
| Phone (Australian, stored `+61…`) |       ✓       |         |        |
| Year level (2–12 or Other)       |               |    ✓    |        |
| Password + confirm (12+)         |       ✓       |    ✓    |   ✓    |
| Terms & Privacy checkbox         |       ✓       |    ✓    |   ✓    |

No date of birth is collected. A student's year level starts from their roster value and is saved
back to the roster (`students.year_level`). Sending a field the role doesn't have is refused.

## Flow

1. Admin invites → account created `invited`, Supabase sends the invite e-mail.
2. Link → `/portal/auth/confirm` → **Continue** (scanners can't use the link up) → Supabase checks
   and uses up the token, signing the person in.
3. `/portal/join`: the only page an invited account can open (`portal-access` area `join`).
4. Submit → `updateUser({ password })` → `complete_onboarding(...)` → `active`, `joined_at`,
   `terms_accepted_at` set, audit entry `account_activated`.
5. If step 4's database call fails after the password is saved, the account stays `invited`;
   signing in returns the person to the form.

## Admin actions

- **Resend** works until the account is active. If the person already opened their invite, Supabase
  won't send another invite, so they get a password-reset e-mail instead; it lands on the same form.
- **Cancel** works until the account is active (an invited account has no history).

## Database

Migration `20261023100000_invite_onboarding.sql`: `profiles.status` (`invited`/`active`, must match
`joined_at`), `phone`, `terms_accepted_at`; `joined_at` no longer copied from
`auth.users.email_confirmed_at`; `private.my_active_role()` and `private.my_student_id()` require
`active`; RPCs `my_onboarding()` and `complete_onboarding()`. Existing joined accounts become
`active`. Tests: `supabase/tests/database/onboarding.test.sql`.

## Open

- **Terms & Conditions page**: none yet. `LEGAL_LINKS.terms` is `null`, so the words show without a
  link. Set it before go-live.
- **Privacy Policy**: mention the phone numbers now collected from staff.
