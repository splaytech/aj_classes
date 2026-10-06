# R2a — Tutor & Admin Logins: User Stories

> **Status:** Reviewed, ready to build (6 Oct 2026).
> **Design:** [design.md](design.md) · **Gap review:** [review.md](review.md) · **PRP:** [../PRP.md](../PRP.md#r2a--tutor--admin-logins)
>
> Each story lists its acceptance criteria (AC), the design sections it relies on, and how it is tested.
> Test keys: **DB** = pgTAP, **FN** = edge function tests, **UNIT** = Vitest, **E2E** = Playwright (local), **MAN** = manual checklist.
> Tags like **(G32)** point to the gap in [review.md](review.md) that added or changed the criterion.

## People

| Person | Account | Notes |
|---|---|---|
| **Ajay** | `admin` | Runs AJ Classes and also teaches. One account covers both (owner, 6 Oct 2026). |
| **Backup admin** | `admin` | To be named (Q2). Needed so one admin can reset the other's two-step. |
| **Tutor** | `tutor` | Teaching staff, invited by an admin. |

## Epics

| Epic | Stories |
|---|---|
| E1 Getting in and out | US1–US6 |
| E2 Two-step sign-in for admins | US7–US10 |
| E3 Tutor area and profile | US11–US13 |
| E4 Managing staff | US14–US19 |
| E5 Protection and platform | US20–US22, NFR1–NFR8 |

---

## E1 — Getting In and Out

### US1 — Invite a staff member
**As an** admin **I want to** invite someone by name and email **so that** they can get an account, and nobody else can sign up.

- AC1. Given I'm an admin with two-step done, when I enter a name (2–100 chars) and a valid email and confirm, then an invite email is sent and the person appears in the staff list as **Invited**, role **Tutor**.
- AC2. Given the email already belongs to a staff member, when I invite it, then nothing is sent and I see "This email already has an account" with its status and a link to that person.
- AC3. Given a public visitor, when they call the Supabase sign-up API directly, then it fails (sign-up is disabled).
- AC4. An `invite_sent` audit entry records who invited whom. (G37)
- AC5. If the email can't be sent, I see "The invite couldn't be sent. Try again." If the account was still created, it shows as **Invited** and **Resend invite** works (SP1). (G32, V10)
- Design: §8, §10 `invite`, §12.1 · Tests: FN (validation, duplicate, admin-only), E2E (invite → Mailpit; direct sign-up call fails)

### US2 — Accept the invite and set a password
**As an** invited tutor **I want to** set my password from the invite email **so that** I can sign in.

- AC1. The email link opens `/portal/auth/confirm` with a **Continue** button. Opening the page alone doesn't use up the link (an email scanner can't spoil it). (G5)
- AC2. When I click Continue on a valid link, the token is removed from the address bar and I'm taken to **Set your password**. (G12)
- AC3. The password must be at least **12 characters** and typed twice the same. Errors show next to the fields. (G10)
- AC4. When I save, I land on my tutor dashboard, signed in.
- AC5. Given the link is older than 1 hour or already used, I see "This link has expired or has already been used. Ask AJ Classes to resend your invite."
- AC6. If I leave without setting a password, I can use **Forgot password** later to set one.
- Design: §9.1, §11.1, §12.1 · Tests: UNIT (password rules), E2E (accept invite), MAN (link opened in a different browser)

### US3 — Sign in
**As a** tutor or admin **I want to** sign in with email and password **so that** I can reach my private area.

- AC1. `/portal/login` has email (`autocomplete="username"`), password (`current-password`) with show/hide, the "I am human" check (Turnstile), and **Sign in**. (G8)
- AC2. Wrong email and wrong password both show **"Email or password is incorrect."** (G17)
- AC3. A deactivated account gets the **same** message as AC2. Supabase reports a ban before checking the password, so a different message would reveal which emails belong to deactivated staff (V18). "Your account is not active. Please contact AJ Classes." shows only if sign-in works but the profile is inactive.
- AC4. Too many attempts show "Too many attempts. Please wait a few minutes and try again."
- AC5. After sign-in, a tutor goes to `/portal/tutor` and an admin to `/portal/admin`, unless I came from a private page (`next`), which I return to. A `next` that isn't a `/portal/…` path on this site is ignored. (G7)
- AC6. An admin with two-step goes to the code step first (US8). An admin without it goes to setup (US7).
- AC7. Signed-in users who open `/portal/login` are sent to their home page.
- AC8. A "Staff sign in" link in the public footer opens `/portal/login`.
- Design: §11.3, §11.4 · Tests: UNIT (error mapping, `safeNextPath`, guards), E2E (tutor sign-in, `next` return), MAN (password manager fills both fields)

### US4 — Sign out
**As a** tutor or admin **I want to** sign out **so that** the next person on this computer can't use my account.

- AC1. **Sign out** is in the header of every private page.
- AC2. After signing out I'm on `/portal/login`, and Back doesn't show private content (the guard redirects).
- AC3. Signing out in one tab sends the other open tabs to `/portal/login` too. (G29)
- Design: §11.3 Freshness · Tests: UNIT (guard), E2E (sign out, back button)

### US5 — Forgot password
**As a** tutor or admin **I want to** reset a forgotten password by email **so that** I'm not locked out.

- AC1. `/portal/forgot-password` asks for an email and the "I am human" check. It always says **"If that email has an account, we've sent a link. It expires in 1 hour."** (G17)
- AC2. A second request for the same email within 60 seconds doesn't send another email. (G8)
- AC3. The link works like US2 (Continue button, token removed, set a 12+ character password).
- AC4. After a reset, every other session of mine is signed out, and I get a "Your password has been changed" email. (G25, G19)
- AC5. An account with two-step (admins) must enter its authenticator code on the set-password page before the new password is saved (Supabase requires it, V19), and before any admin page. (G3)
- AC6. A deactivated account can request the email, but still can't sign in after resetting.
- Design: §8, §9 · Tests: E2E (reset → Mailpit → sign in with new password), MAN (deactivated reset)

### US6 — Change password while signed in
**As a** tutor or admin **I want to** change my password from my account page **so that** I can replace a weak or shared one. (G35)

- AC1. `/portal/account` → **Change password**: **Email me a code**, then enter the 6-digit code from the email and the new password twice. (Supabase doesn't check a "current password", so the emailed code proves it's really me, V19.)
- AC2. Same rules and messages as US2 AC3. A new password equal to the old one is refused.
- AC3. On success: "Password changed", other sessions signed out, notification email sent. (G25, G19)
- Design: §11.4 `changePassword`, §19 SP2 · Tests: UNIT, E2E

---

## E2 — Two-Step Sign-In for Admins

### US7 — Set up two-step
**As an** admin **I want to** link an authenticator app **so that** a stolen password alone can't open the admin area.

- AC1. An admin without a verified authenticator who opens any private page is sent to **Set up two-step sign-in**. Only that page and Sign out work until it's done. (G3, G31)
- AC2. The page shows a QR code, the secret key as text (for people who can't scan), and a name field (e.g. "Phone"). I enter the 6-digit code to confirm.
- AC3. A wrong code shows "That code didn't work. Check your phone's time is correct and try again." The QR stays.
- AC4. On success my session is upgraded and I continue to where I was going. I get a "Verification method added" email. (G19)
- AC5. Then the page suggests adding a **backup authenticator** (US9). (G6)
- AC6. A tutor promoted to admin gets the same setup on their next private page. (G31)
- AC7. Admin powers are refused **by the database** for an admin whose session isn't two-step verified, even if the UI is bypassed. (G3)
- Design: §4.2, §11.3 rows 3–4, §12.2 · Tests: DB (admin aal1 can't read others), UNIT (guards), E2E (setup with generated TOTP)

### US8 — Sign in with an authenticator code
**As an** admin **I want to** enter my authenticator code after my password **so that** I can use admin tools.

- AC1. After the password, `/portal/login/verify` asks for the 6-digit code (`one-time-code`, numeric keyboard).
- AC2. If I have two authenticators, I choose which one (by the name I gave it). (V30)
- AC3. A wrong code shows the US7 AC3 message. Supabase limits code checks to 15 a minute per network address on hosted projects (V20); when hit, I see "Too many attempts. Please wait a minute and try again."
- AC4. **Cancel / Sign out** is available on this page.
- AC5. On success I go to `next` or `/portal/admin`.
- Design: §12.2 · Tests: UNIT, E2E

### US9 — Manage my authenticators
**As an** admin **I want to** add a backup authenticator and remove an old one **so that** losing my phone doesn't lock me out. (G6)

- AC1. `/portal/account` lists my authenticators (name, date added).
- AC2. I can add one more (maximum **2**). Adding one uses the US7 steps.
- AC3. I can remove one **only if another remains**. The last one can't be removed by an admin (the button is disabled with a reason). (V29)
- AC4. Each add or remove sends me a notification email. (G19)
- Design: §4.2, §11.4 `two-step.service` · Tests: UNIT, E2E (add second, remove first)

### US10 — Reset another admin's two-step
**As an** admin **I want to** reset someone's two-step when they've lost every authenticator **so that** they can set it up again.

- AC1. On a staff member's page, **Reset two-step sign-in** (with confirm) removes all their authenticators. It isn't offered for my own account.
- AC2. They get a "Verification method removed" email, and an audit entry `two_step_reset` is written. (G19, G37)
- AC3. Their next private page sends them to setup (US7).
- AC4. If the **only** admin is locked out, the developer follows the break-glass runbook (design §16.3).
- Design: §10 `reset-two-step`, §16.3 · Tests: FN, E2E

---

## E3 — Tutor Area and Profile

### US11 — Tutor dashboard
**As a** tutor **I want** a home page after signing in **so that** I have a place for the tools that arrive in R3.

- AC1. `/portal/tutor` shows "Welcome, {first name}", a link to **My profile**, a prompt to complete the profile if bio or subjects are empty, and placeholder cards ("Classes", "Assignments": "Coming soon").
- AC2. Admins can open it too (Ajay teaches).
- AC3. The page uses the site's theme (`theme.css`), works at phone width with no sideways scroll, and isn't indexed (`noindex`).
- Design: §11.1, §11.5 · Tests: UNIT (render), E2E (lands here after sign-in)

### US12 — Edit my profile
**As a** tutor or admin **I want to** keep my name, subjects, bio and qualifications up to date **so that** my profile is correct (and ready for the website later). (G38)

- AC1. `/portal/profile` shows email (read-only), **Full name** (required, 2–100), **Subjects I teach** (checkboxes from the fixed list), **Bio** (optional, up to 1000 chars, with a live counter), **Qualifications** (up to 10 lines, each up to 150 chars, add/remove).
- AC2. **Save** validates first. Errors show next to fields, and nothing is saved until all are fixed.
- AC3. Success shows "Profile saved". The header shows the new name straight away.
- AC4. Bio and qualifications show exactly as typed, as plain text. Typed HTML shows as text and never runs. (G16)
- AC5. I can't change my own role, status or email through this page **or** the API. (G1, G2)
- AC6. The subject list comes from constants. Until the owner confirms it, it's a placeholder list (Q1). A saved subject that is later removed from the list is kept but not shown. (G9)
- Design: §5, §7.1–7.2, §11.5 · Tests: DB (role update denied, length checks), UNIT (validation), E2E (save and reload)

### US13 — Profile photo
**As a** tutor or admin **I want to** upload a photo **so that** students and families can recognise me later.

- AC1. **Upload photo** accepts JPEG, PNG or WebP. The browser resizes it to at most 512 px and re-encodes it, which also removes location data from phone photos (V16). The stored file must be under **2 MB**. Other types or bigger files are refused before upload, with a clear message. The server refuses them too (SVG included). (G18)
- AC2. A preview shows before saving. The page notes: "Your photo may be shown on the AJ Classes website."
- AC3. After saving, the new photo shows everywhere straight away (no old cached image). The old file is deleted. (G34)
- AC4. I can **Remove photo**.
- AC5. I can't upload into another person's folder, even through the API. (G18)
- AC6. Images have alt text with the person's name.
- Design: §7.3 · Tests: DB (storage policies), UNIT (file checks), E2E (upload, replace)

---

## E4 — Managing Staff

### US14 — Staff list
**As an** admin **I want to** see everyone with access **so that** I know who can sign in. (G39)

- AC1. `/portal/admin/staff` lists name, email, role, **status** (Invited / Invite expired / Active / Deactivated), two-step (admins: on / not set up), invited date, last sign-in. (G32)
- AC2. Sorted by name. A text filter matches name or email. Status filter: All / Active / Invited / Deactivated.
- AC3. Each row links to the staff member's page. **Invite staff** is at the top.
- AC4. A tutor opening this URL sees "You don't have access to this page". (US20)
- AC5. `/portal/admin` shows counts (active tutors, admins, pending invites) and links to Staff.
- Design: §5 derived status, §6.3 `admin_list_staff` · Tests: DB, UNIT (status rules), E2E

### US15 — Resend or cancel an invite
**As an** admin **I want to** resend an expired invite or cancel one sent to a wrong address **so that** mistakes and delays are easy to fix. (G32, G33)

- AC1. For someone who hasn't joined: **Resend invite** sends a fresh link (old link stops working). Audit `invite_resent`.
- AC2. **Cancel invite** (with confirm) removes the pending account completely. Audit `invite_cancelled` with the email. (G33)
- AC3. Neither action is offered once the person has joined. Cancel is refused by the server if they ever signed in. (G24)
- AC4. Deactivate and role change are offered for joined staff; pending invites use cancel instead. (V21)
- Design: §10 · Tests: FN, E2E (resend, cancel)

### US16 — Change someone's role
**As an** admin **I want to** make someone an admin or remove admin **so that** the business isn't tied to one person.

- AC1. On the staff member's page, **Role**: Tutor / Admin with a confirm step that explains the change.
- AC2. Making someone admin means they must set up two-step on their next private page (US7 AC6).
- AC3. Removing admin from the **last active admin** is refused: "There must be at least one active admin." This holds even when two admins try it at the same moment. (G4)
- AC4. I can remove my own admin role only if another active admin exists. After that I'm sent to my tutor home.
- AC5. Audit `role_changed` with from/to.
- Design: §6.3 `admin_set_role` · Tests: DB (last admin, concurrent), E2E

### US17 — Deactivate or reactivate
**As an** admin **I want to** deactivate someone who leaves, and reactivate them if they return **so that** access matches who works here. (D5)

- AC1. **Deactivate** (confirm: "They will be signed out and lose access straight away").
- AC2. From that moment the person can't read or change any data (database check), and their sessions end within the access-token lifetime (≤ 1 hour) at most. Their open pages fail and send them to sign-in. (G11, SP3)
- AC3. They can't sign in again. They see the normal "Email or password is incorrect" message (US3 AC3).
- AC4. I can't deactivate myself, or the last active admin. (G4)
- AC5. **Reactivate** restores access. They sign in with their old password (and two-step, if admin).
- AC6. Audit `deactivated` / `reactivated`. Data and photo are kept.
- Design: §6.3, §10 `set-active`, §12.3 · Tests: DB, FN (order of steps), E2E (deactivate signed-in tutor)

### US18 — Edit a staff member's profile
**As an** admin **I want to** fix a tutor's name, bio or qualifications **so that** profiles are correct before they appear on the website. (G36)

- AC1. The staff member's page has the same form as US12 (and photo as US13), editing their profile.
- AC2. Audit `profile_edited_by_admin` with the changed field names (not values).
- Design: §6.2, §7.2 · Tests: DB (trigger), E2E

### US19 — Audit trail
**As the** business owner **I want** a record of who changed access and when **so that** I can check what happened after a problem. (G37)

- AC1. Every action in US1, US10, US15–US18 writes an audit entry: actor, action, target, details, time.
- AC2. Only admins can read it. Nobody can change or delete entries through the API.
- AC3. R2a has no viewer page. Admins (or the developer) read it in the Supabase dashboard.
- Design: §5 `audit_log`, §6.3 · Tests: DB

---

## E5 — Protection and Platform

### US20 — Private pages stay private
**As** anyone **I want** private pages to show only to the right people.

- AC1. Opening any `/portal/…` page signed out goes to `/portal/login?next=…`, and after sign-in returns there. (G27)
- AC2. A tutor opening an admin page sees "You don't have access to this page" with a link home.
- AC3. Refreshing on any deep private URL works on **Railway and Vercel** (no 404). (G21, SP6)
- AC4. Private pages are `noindex`, not in the sitemap, disallowed in `robots.txt`, and have no analytics. (G20)
- Design: §11.3, §13 · Tests: UNIT (every guard row), E2E (deep-link refresh on the production build served with the Railway `serve` config), MAN (Vercel and Railway after deploy) (V8)

### US21 — Portal switched off when not configured
**As the** developer **I want** the site to work without Supabase settings **so that** a missing env var never breaks the public site. (G30)

- AC1. Without `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY`, the footer link is hidden and `/portal/*` shows "Staff sign-in isn't available right now."
- AC2. The public build and pre-rendering succeed without those variables.
- Tests: UNIT, build without env

### US22 — Emails look like AJ Classes
**As a** tutor **I want** invite and reset emails that clearly come from AJ Classes **so that** I trust them.

- AC1. Invite, reset, re-authentication and security-notification emails use AJ Classes branding, plain wording, one button, the expiry time, and "If you didn't expect this, ignore this email".
- AC2. On staging/prod they come from the AJ Classes domain through Resend (SPF, DKIM and DMARC pass) and land in the inbox, not spam.
- Design: §9.2, §8 · Tests: MAN (Gmail and Outlook on staging)

### Non-Functional Requirements

| ID | Requirement | Test |
|---|---|---|
| NFR1 Security | Every rule in design §4.3 is enforced in the database or edge function, not only in the UI. All tables have RLS on and explicit grants. | DB |
| NFR2 Secrets | No secret key in the web bundle or the repo. Build fails if one appears. (G14) | Build check |
| NFR3 Public performance | Public pages don't load `supabase-js`. Public JS size and Lighthouse scores stay within 2% of the R1 baseline. (G23) | Build check, Lighthouse |
| NFR4 Accessibility | WCAG 2.2 AA on portal pages: labels, error summary, focus to `<h1>` on page change, focus-trapped dialogs, keyboard-only use, 4.5:1 contrast. | E2E (axe scan per page, V9), MAN (screen reader) |
| NFR5 Mobile | Every portal page works at 360 px wide with no sideways scroll. | MAN, E2E (mobile viewport) |
| NFR6 House rules | No text, paths or limits outside `src/constants/`. Only `src/services/` imports `@supabase/*`. | Lint |
| NFR7 Headers | `/portal/*` sends CSP, `noindex`, `no-store`, plus the existing security headers. (G22) | E2E (preview), MAN (both hosts) |
| NFR8 Operations | Runbooks for first admin, break-glass, deploying schema and a paused project are in `supabase/README.md`. (G40) | Review |

## Manual Checklist (staging, before sign-off)

- [ ] Invite a real Gmail and a real Outlook address; both land in the inbox; links work after the mail provider has scanned them.
- [ ] Accept an invite in a different browser from the one the admin used.
- [ ] Set up two-step with Google Authenticator and with 1Password; sign in with each.
- [ ] Deactivate a tutor who is signed in on a phone; their next action fails and they end up at sign-in.
- [ ] Refresh `/portal/admin/staff` on Railway and on Vercel.
- [ ] Response headers on `/portal/login` include CSP and `noindex`.
- [ ] VoiceOver pass on login, two-step setup and profile.
