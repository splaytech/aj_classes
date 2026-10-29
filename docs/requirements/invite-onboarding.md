# Invite onboarding

> The invite link itself changed in [ADR-0010](../decisions/0010-own-invite-token-with-supabase-sign-in-hop.md) (14 days, `/portal/invite`); the setup form is unchanged.

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
| O6  | The password is saved by the person's own session (`auth.updateUser`); Supabase Auth hashes it. A trigger records `password_set_at`; `complete_onboarding()` refuses an account without it (a password Auth made up at creation doesn't count). |

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

After setup, staff can change their phone on **My profile**, and an admin (with two-step) can
correct it on **Admin → Staff → person**. Both use the same Australian rule and store `+61…`. A
saved number can be changed but not removed, and families can never hold one. An admin's change is
recorded in Admin → Activity by field name only, never the number. See item 4 in
[01b-requirement-items-4-9.md](../delivery/2026-10-25-pending-requirements/01b-requirement-items-4-9.md)
and the migration `20261026100000_staff_phone_edit.sql`.

## Flow

1. Admin invites → account created `invited`, Supabase sends the invite e-mail.
2. Link → `/portal/auth/confirm` → **Continue** (scanners can't use the link up) → Supabase checks
   and uses up the token, signing the person in.
3. `/portal/join`: the only page an invited account can open (`portal-access` area `join`).
4. Submit → `updateUser({ password })` → `complete_onboarding(...)` → `active`, `joined_at`,
   `terms_accepted_at` set, audit entry `account_activated`.
5. If step 4's database call fails after the password is saved, the account stays `invited`; the
   form can be sent again (the same password counts as saved).
6. A setup tab left open over a day: Supabase asks for an emailed code before saving the password;
   the form sends it and shows a code field. The form also has "Not you? Sign out".

## Admin actions

- **Resend** works until the account is active. If the person already opened their invite, Supabase
  won't send another invite, so they get a password-reset e-mail instead; it lands on the same form.
- **Cancel** works until the account is active (an invited account has no history). It first
  switches the account off in one statement, so it can't race with the person finishing setup.

## Database

Migration `20261023100000_invite_onboarding.sql`: `profiles.status` (`invited`/`active`, must match
`joined_at`), `phone`, `terms_accepted_at`, `password_set_at`; `joined_at` no longer copied from
`auth.users.email_confirmed_at`; `private.my_active_role()` and `private.my_student_id()` require
`active`; RPCs `my_onboarding()` and `complete_onboarding()`. Existing joined accounts become
`active`. Tests: `supabase/tests/database/onboarding.test.sql`.

## Deploy

Deploy the migration, the `account-admin` function and the web app together. Invites opened on the
old web app would land on the old set-password page and then be signed out as inactive.

## Open

- **Forgot password while invited**: an invited person can use "Forgot password" to get a fresh
  link that also lands on the setup form, without asking an admin. It still needs their mailbox, and
  admin Resend relies on the same path once the invite was opened. Decide whether that's acceptable.

- **Terms & Conditions page**: none yet. `LEGAL_LINKS.terms` is `null`, so the words show without a
  link. Set it before go-live.
- **Privacy Policy**: mention the phone numbers now collected from staff.

## Consents (added 23 Oct 2026)

Owner request: on the setup form, capture consent for online communication by email and phone,
and for using a family's information online: the child's name with their selective school or
scholarship result, and a testimonial video if the family provides one.

### Why not one checkbox

Folding these into the required Terms checkbox would make them invalid:

- **Privacy Act (APP 6, OAIC consent guidance):** using personal information for a second purpose,
  such as publicising a child's name, result or video, needs consent that is voluntary, informed,
  specific and current. A box people must tick to use the portal isn't voluntary (bundled consent).
- **Spam Act 2003:** marketing emails and SMS need express consent. Messages about classes, the
  account and invoices don't (factual messages about an existing relationship), so those stay with
  the Terms, and the Terms wording says so.
- **Children:** students are mostly minors, so publicity about a child is agreed by a **parent**.

### Design

| Box | Who sees it | Required | Saved as |
| --- | --- | :-: | --- |
| I agree to the Terms & Conditions and Privacy Policy, **including emails, SMS and calls about classes, my account and invoices** | everyone | ✓ | `terms_accepted_at` (existing) |
| Send me news, offers and enrolment updates by email and SMS | parents | – | `marketing_consent_at` |
| AJ Classes may share my child's name and their selective school or scholarship result on its website and social media | parents | – | `results_publicity_consent_at` |
| If we provide a testimonial video, AJ Classes may publish it on its website and social media | parents | – | `video_publicity_consent_at` |

- Optional boxes start **unticked**; nothing is assumed. A timestamp means "agreed at"; `null` means no.
- `complete_onboarding()` gains three optional booleans (default false). Sending `true` for a role
  that isn't offered the box is refused (`invalid_input`), like the other role-specific fields.
- **Changing your mind:** parents see the same three choices on **Account → Your choices**
  (`set_my_consents()`). Withdrawing clears the timestamp. Every change is in the activity log
  (`consent_changed`, with which choices changed).
- **Admins** see each parent's choices on the student's page (Admin → Students → student →
  Parents), so nobody publishes a result or video without checking. Choices apply to all of that
  parent's children; if two parents differ, ask the family before publishing.
- Students and tutors don't get the optional boxes. Tutors' and students' service messages are
  covered by the Terms. (A student who is an adult, e.g. UCAT/GAMSAT, can be asked directly later.)
- Privacy Policy gets an "Optional permissions" paragraph describing the three choices and how to
  change them.

### Gap review

| # | Type | Gap | Fix |
| --- | --- | --- | --- |
| C1 | LEGAL | Bundled consent isn't valid. | Separate, optional, unticked boxes; the Terms box covers only service messages. |
| C2 | LEGAL | Consent must be withdrawable. | Account → Your choices; withdrawal is immediate and logged. |
| C3 | LEGAL | Proof of consent. | Timestamp per choice plus an audit entry for every change. |
| C4 | PRIV | A minor can't give publicity consent. | Only parents see the publicity boxes. |
| C5 | SEC | A browser could set consents for someone else, or for a role that isn't offered them. | Only through `complete_onboarding()` / `set_my_consents()` for the caller's own active parent account; columns aren't writable directly; tests cover it. |
| C6 | REQ | Two parents may disagree. | Admin page shows each parent's choices; the guide says to ask the family. |
| C7 | OPS | Marketing consent isn't yet synced to Kit (the newsletter list). | Admins see it; syncing to Kit is a later step. |

### Todo

- [x] T1 Migration: consent columns, `complete_onboarding()` with the three choices, `set_my_consents()`; database tests
- [x] T2 Setup form: Terms wording; three optional boxes for parents; validation and service
- [x] T3 Account → Your choices (parents): load and save
- [x] T4 Admin student page: each parent's choices
- [x] T5 Activity label, Privacy Policy paragraph, types; full check; browser check; commit

## Sign-in link (added 23 Oct 2026)

Owner request: one sign-in link, and after signing in each person sees the screen for their role.

- The site header has a **Sign in** link (desktop bar and phone menu) to `/portal/login`, shown
  only when the portal is switched on (`APP_CONFIG.features.portal`). There's one link for everyone;
  public pages don't load Supabase, so they can't know who is signed in.
- After sign-in, `/portal` sends each role to its own home (`homeForRole`): admin → Admin,
  tutor → Tutor, student → Student, parent → My children; an invited account goes to the setup form.
  Someone already signed in who clicks the link goes straight to their home.
- The header switches to the full desktop layout at 1024px (it was 900px) so the extra link fits;
  the phone call bar and WhatsApp button use the same breakpoint.

## Admin view (added 23 Oct 2026)

What a person gave at setup is visible to admins:

| Where | Shows |
| --- | --- |
| Admin → Staff (list) | Phone column |
| Admin → Staff → person | Phone (tap to call) and "Accepted the Terms {date}" |
| Admin → Students → student | "Accepted the Terms {date}" for the student account and each parent, plus each parent's optional permissions |

Proof of agreement is the `profiles` timestamp plus the `account_activated` audit entry (which
records the optional choices), and a `consent_changed` entry for every later change. Migration
`20261023120000_admin_staff_phone_and_terms.sql` adds `phone` and `terms_accepted_at` to
`admin_list_staff()`.

Admin → Activity shows a parent's choices in the Details column: all three at setup ("Finished
account setup") and the changed ones on each "Changed their permissions" entry.

An invite link that's expired or already used also offers "Already set up your account? Sign in",
so someone who clicks the email again after finishing setup isn't stuck.

Open: nobody can change a staff phone number after setup yet (it isn't on the profile form).
