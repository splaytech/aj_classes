# 01 — Requirement: invites stay valid for 14 days

Stage 1 (Product Owner) of `/deliver`. Branch `feature/invite-14-days` (from `develop` @ 63887f5). Date 2026-10-29. Revised after `review-1.md` (round 1).

Saurabh's ask: "invites stay valid for 14 days". Only invites change. Password-reset and sign-in links keep their current short life.

Approved direction, still to be confirmed by the Architect in stage 2: our own single-use invite token, stored hashed, expiring 14 days after it is sent, emailed through Resend. The link opens a portal page. A server function checks the token, then issues a fresh Supabase link that signs the person in straight away. After that the existing setup flow runs. This document says what must be true. It does not choose how.

## What exists today (checked in the repo)

1. Every invite is sent by the `account-admin` edge function (`supabase/functions/account-admin/index.ts`).
   - The gateway checks for a session token first (`[functions.account-admin] verify_jwt = true`, `supabase/config.toml`). A call with no valid token gets 401 from the gateway, and the function never runs.
   - The function then lets through only an active admin who has two-step on (`requireActiveAdmin`). Any other signed-in caller gets `not_admin` (403), which the web app shows as `You don't have permission to do that.` (`PORTAL_ERRORS.notAllowed`).
2. There are four ways an invite email goes out:
   1. **Staff invite.** Action `invite` (`handlers/invite.ts`) calls `auth.admin.inviteUserByEmail`. It is started from Staff, then `Invite staff` (`components/portal/InviteDialog.tsx`, `routes/portal/admin-staff.tsx`). Audit action `invite_sent`.
   2. **Student invite.** Action `invite-student` (`handlers/invite-student.ts`) creates the account, links it to the roster row, then calls `sendInvite`, which uses `inviteUserByEmail` (`handlers/accounts.ts`). Consent must already be recorded. If any step fails, the account is removed again. It is started from the student page's Student account section (`routes/portal/admin-student.tsx`). Audit action `student_invited`.
   3. **Parent invite.** Action `invite-parent` (`handlers/invite-parent.ts`) works the same way as the student invite. If the e-mail already has a parent account, the parent is linked and **no email is sent**. It is started from `Invite or link a parent` (`ParentInviteDialog.tsx`). Audit action `parent_invited`, or `parent_linked` when no email is sent.
   4. **Re-send.** Action `resend-invite` (`handlers/resend-invite.ts`, `sendSetupLink`) works for any role while the account is still `invited`.
      - If the person never opened the link, it sends the invite email again.
      - If they opened it but didn't finish setup, it sends a **password-reset email** (`resetPasswordForEmail`) instead, because Supabase won't invite a confirmed e-mail.
      - It is started from `Resend invite` on the staff member page, on the student's account section, and on each parent row.
      - If the send fails, it returns `email_failed` and deletes nothing.
      - Audit action `invite_resent`.
3. **Cancel.** Action `cancel-invite` (`handlers/cancel-invite.ts`) deletes an account that is still `invited`. The account's links go with it.
4. **Email.** The template is `supabase/templates/invite.html`, with the subject `You're invited to the AJ Classes portal` (`supabase/config.toml`).
   - The heading `You're invited to AJ Classes` is the same for every role.
   - The brand label next to "AJ Classes" (`Staff`, `Students` or `Parents`) and the first paragraph are worded by role.
   - The button `Accept invite` links to `{SiteURL}/portal/auth/confirm?token_hash=…&type=invite`.
   - Its footer says `This link expires in 1 hour and works once. If it has expired, ask AJ Classes to send you a new one.`
5. **Landing page.** `routes/portal/auth-confirm.tsx` does nothing until the person clicks `Continue`, so an email scanner can't use up the link. It then removes the token from the address bar and goes to `/portal/join`, the setup form (`routes/portal/join.tsx`).
   - If `token_hash` or `type` is missing from the address, it shows `This link has expired or has already been used.` with `This link is incomplete. Please use the button in the email.` and no `Continue` button.
   - If the token is there but garbled (for example, cut short), it shows `Continue`, and the click then fails like an expired link.
   - An expired or used invite shows `This invitation link has expired. Please contact your AJ Classes administrator to request a new invite.` (`PORTAL_ERRORS.inviteExpired`, `constants/error.constants.ts`).
   - Under that message is the link `Already set up your account? Sign in` (`AUTH_CONFIRM_PAGE.alreadySetUp`).
6. **Admin status.** `lib/account-status.ts` shows `Invite expired` once `invitedAt` is more than `AUTH_LIMITS.linkExpiryHours` (1) hour old (`constants/app.constants.ts`, whose comment reads "invite and password-reset links").
   - `invitedAt` is `profiles.invited_at`. A trigger on `auth.users` copies it from `auth.users.invited_at`, and **only Supabase's `inviteUserByEmail` sets that field**.
   - So if invites stop calling it and nothing else sets the date, `Invited on` goes blank, and web and mobile both show `Invite expired` straight away.
   - The dashboard's invites count (`routes/portal/admin-dashboard.tsx`) counts `Invited` and `Invite expired` together, so it doesn't depend on the expiry rule.
   - The warnings shown to admins are:
     - staff member page: `The link has expired. Send a new one.` (`STAFF_MEMBER_PAGE.invite.expired`, `portal.constants.ts`)
     - student account section: `The invite link has expired. Send a new one.` (`ADMIN_STUDENT_PAGE.account.expired`, `family.constants.ts`)
     - status chip: `Invite expired` (`ACCOUNT_STATUS_LABELS.inviteExpired`)
7. **Invite dialog.** The intro says `They'll get an e-mail to set their password. The link works for ${AUTH_LIMITS.linkExpiryHours} hour; you can resend it.` (`INVITE_DIALOG.intro`).
8. **Password reset.** This uses `supabase/templates/recovery.html`, which says `This link expires in 1 hour and works once.`
   - After a request, the Forgot password page says `If that email has an account, we've sent a link. It expires in ${AUTH_LIMITS.linkExpiryHours} hour.` (`FORGOT_PASSWORD_PAGE.sent`, `portal.constants.ts`). That is the same constant the invite dialog uses.
   - The same `otp_expiry = 3600` (`supabase/config.toml`) controls it, and it also controls the magic-link and reauthentication emails.
9. **Resend email.** The notifications function already sends through Resend's HTTP API when hosted, and through Mailpit's send API locally (`supabase/functions/notifications/transport.ts`).
   - It needs `EMAIL_TRANSPORT` set to `resend` or `mailpit`, and sends nothing otherwise.
   - The sender is `AJ Classes <hello@ajclasses.com.au>` (`SENDER`, `notifications/copy.ts`).
   - Hosted Supabase auth emails also go through Resend SMTP. Resend Free allows 100 emails a day, shared by both (ADR-0004).
   - The documented "stop all sends at once" kill switch includes `supabase secrets unset EMAIL_TRANSPORT` (`supabase/README.md`). Today that doesn't touch invites, because they go through Auth SMTP.
10. **Local mail.** Local email lands in Mailpit at `http://localhost:55324` (`[local_smtp]`). The e2e spec `e2e/tests/invite-onboarding.spec.ts` covers the staff invite through to an active tutor. It finds the link with the pattern `/portal/auth/confirm?token_hash=…&type=invite`.
11. **Mobile.** The mobile app (`aj_classes_mobile`) sends no invites. It does show the invite status, with its own 1-hour copy of the rule (`lib/features/admin/domain/account_status.dart`, `inviteLinkExpiry = Duration(hours: 1)`), and reads `profiles.invited_at`.
12. **Deploy.** `supabase/scripts/deploy.sh` sets `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY` and `SITE_URL` on the hosted project. It checks `EMAIL_TRANSPORT` and `SITE_URL` with `supabase secrets list`; `RESEND_API_KEY` is only required before the run and then set.

## Assumptions

- [ASSUMPTION A1] "14 days" means 14 × 24 hours (336 hours) from the moment the email is sent. It is not "until the end of the 14th calendar day". This rule is simple to test and doesn't depend on time zones.
- [ASSUMPTION A2] All three kinds of invite get 14 days: staff, student and parent. So does every re-send. Saurabh didn't single out a role.
- [ASSUMPTION A3] Saurabh's "The invite link has expired. Send a new one." is the admin-side warning. The person-facing message (`PORTAL_ERRORS.inviteExpired`) also stays word for word. Both keep their current text, and only *when* they appear changes.
- [ASSUMPTION A4] Invite links sent before release are refused after release (AC 38). They expire within an hour anyway, and the admin can re-send. Any invited account with no new-style link shows `Invite expired` (AC 25).
- [ASSUMPTION A5] Invites keep being sent at once, when the admin clicks. They don't wait in the 5-minute outbox queue, and they don't count towards the outbox's 70-a-day cap. The Architect confirms whether this fits ADR-0004/0008.
  - **Question for the Architect:** if invites are sent with `EMAIL_TRANSPORT`, then `secrets unset EMAIL_TRANSPORT` stops invites as well as app email. Say whether that's wanted, or whether invites need their own switch. Either way, the README must say what the switch stops.
- [ASSUMPTION A6] The email's subject, heading, role-worded brand label and body, button label and look stay as they are today. Only the expiry line changes.
- [ASSUMPTION A7] Once someone has used their link and is signed in, the existing setup flow is unchanged. If they leave the setup form half-filled, the admin re-sends, as today.
- [ASSUMPTION A8] No hosted Supabase Auth setting changes. Email OTP Expiration stays as it is on hosted, and `otp_expiry` stays `3600` locally.
- [ASSUMPTION A9] A failed re-send changes nothing. The account, its links and the previous invite link all stay as they were. Turning off a working link when no new one went out would leave the person with nothing.

## User stories

**US1 — A link that lasts.** As a parent, student or new staff member, I want my invite link to work for 14 days, so that I can set up my account when it suits me rather than within the hour.

**US2 — One live link.** As an admin, I want a re-send or a cancel to switch off the old link, so that only the newest email works and a forwarded or mistyped one can't be used.

**US3 — Clear outcome.** As someone with an old or used link, I want a clear message and a way forward, so that I know to sign in or ask for a new invite.

**US4 — True status.** As an admin, I want the account status to tell me whether the invite is still usable, so that I only re-send when it's needed.

**US5 — Nothing else changes.** As any portal user, I want password reset and sign-in to behave exactly as before.

## Acceptance criteria

Unless an AC says otherwise, it applies to all three invite types (staff, student, parent) and to a re-sent invite. "Sent" means the moment the admin's invite or re-send succeeded.

### Lifetime (US1)

**Rule:** a link is valid while *now < sent + 336 hours*, and refused from that moment on. AC 1–4 are sample points on this rule.

1. An invite link opened 13 days after it was sent works. Clicking `Continue` signs the person in and opens `/portal/join`.
2. An invite link opened 13 days 23 hours after it was sent still works.
3. An invite link opened 14 days and 1 minute after it was sent is refused, with the expired message in AC 9.
4. An invite link opened 15 days after it was sent is refused, with the expired message in AC 9.
5. Tester can check AC 1–4 on the local stack without waiting, for example by back-dating the stored send time in the **local** database. The test plan names the method. It never runs against hosted.

### Single use and scanners (US2, US3)

6. Opening the link without clicking `Continue` uses nothing up, as today. After 3 page loads, a `Continue` click still works.
7. Once a link has been used, using the same link again is refused with the message in AC 9. This holds in the same browser and in a fresh one.
8. After `Continue`, the address bar and browser history no longer contain the token, as today. The token also never appears in `audit_log` details, the admin Activity page, or the function logs.

### Messages (US3)

9. A refused invite link shows the heading `Welcome to AJ Classes` and the message `This invitation link has expired. Please contact your AJ Classes administrator to request a new invite.` This covers links that are expired, used, replaced, cancelled, garbled or in the old format. Below the message is the link `Already set up your account? Sign in`, which goes to `/portal/login`. This matches today's text in `PORTAL_ERRORS.inviteExpired` and `AUTH_CONFIRM_PAGE.alreadySetUp`.
10. In the new link format, if the token or any other parameter the link needs is **missing** from the address, the page shows today's `This link has expired or has already been used.` with `This link is incomplete. Please use the button in the email.` (`PORTAL_ERRORS.linkExpired`, `AUTH_CONFIRM_PAGE.invalidLink`), and no `Continue` button. If the token is **there but garbled** (for example, cut short or with a character changed), the page shows `Continue` as for any link, and the click is refused with AC 9 (see AC 11).
11. The page never says which of the cases applies (expired, used, replaced, cancelled, garbled or old format). It also never shows whether the e-mail has an account. All refused links look the same.

### Re-send and cancel (US2)

12. After a **successful** `Resend invite`, the previous link is refused (AC 9) and the new one works (AC 1). This holds for staff, student and parent re-sends. For a failed re-send, see AC 39.
13. After two successful re-sends in a row, only the newest of the three links works.
14. Someone who opened their link and then left the setup form unfinished gets an **invite** email when re-sent (subject `You're invited to the AJ Classes portal`), not a password-reset email. The new link opens `/portal/join`.
15. After `Cancel invite`, the link from that invite is refused (AC 9).
16. A re-send starts a fresh 14 days. A link re-sent on day 10 still works on day 23 (13 days after the re-send).

### Already-active and inactive accounts (US3)

These are defence-in-depth checks. The normal UI can't get an account into these states with a live link, so Tester sets them up as described in each AC.

17. An unused, unexpired link for an account that is now `active` is refused (AC 9). It does not sign the person in or reopen the setup form. Using `Already set up your account? Sign in` with their password works. Set-up: issue a link, then mark the account as set up in the **local** database without using the link.
18. An unused, unexpired link for an account that has been deactivated is refused (AC 9) and signs nobody in. Set-up: issue a link, then set `is_active = false` in the **local** database. (`admin_set_active` refuses accounts that haven't joined with `not_joined`, so there is no app route. The real window this guards is inside `cancel-invite`, which switches the account off just before deleting it.)
19. These existing rules stay as they are:
    - `Invite staff` with an e-mail that already has an account shows `This e-mail already has an account.`
    - `Resend invite` on a joined account shows `They have already joined.`
    - Inviting a student who has an account shows `This student already has an account.`
    - `Invite or link a parent` with an existing parent e-mail links them and sends no email (AC 41).

### Who can send (all stories)

20. Only an active admin who has two-step on can invite, re-send or cancel. Tester checks this by calling the function directly as each caller below.
    - A signed-out caller (no `Authorization` header, or an invalid token) gets 401 from the gateway. A `not_admin` 403 is also acceptable if the gateway setting changes.
    - A signed-in tutor, student, parent, or an admin without two-step gets `not_admin` (403).
    - In every refused case, no email is sent, no token is created, and no account, link or audit entry changes.
21. Student invites still need consent recorded first (`consent_needed`). If a **first-time** invite (staff, student or parent) can't send its email, it leaves no account behind and shows `The invite e-mail couldn't be sent. Please try again.`, as today. Re-sends are in AC 39.
22. The audit actions stay the same: `invite_sent`, `student_invited`, `parent_invited`, `invite_resent`, `invite_cancelled`, `parent_linked`.

### Admin status (US4)

23. An invited account shows the `Invited` chip, and no expired warning, for 14 days after the latest send. After that it shows `Invite expired`. The staff member page adds the warning `The link has expired. Send a new one.`, and the student account section adds `The invite link has expired. Send a new one.` This applies on Staff, the staff member page, Students, and the student page (account section and parent rows). The dashboard invites count stays as it is: it already counts both statuses.
24. After a successful re-send, the chip goes back to `Invited`, and `Invited on <date>` shows the re-send date.
25. An account invited before release, with no new-style link, shows `Invite expired` (A4).
26. The `Invite staff` dialog intro says the link works for 14 days, for example `They'll get an e-mail to set their password. The link works for 14 days; you can resend it.` The number comes from an invite-lifetime constant, not hard-coded text.
27. Nothing the shipped mobile build reads is removed or renamed (`profiles.invited_at` and the status columns). Mobile keeps working without a new release (see D1, and AC 40).

### Email content

28. The invite email is sent from `AJ Classes <hello@ajclasses.com.au>`. It keeps today's subject `You're invited to the AJ Classes portal`, the heading `You're invited to AJ Classes`, the role-worded brand label and body, the `Accept invite` button, and the line `If you didn't expect this email, you can ignore it.`
29. Its expiry line reads: `This link expires in 14 days and works once. If it has expired, ask AJ Classes to send you a new one.`
30. The email has a plain-text part that contains the full link, so that the e2e Mailpit helper can find it.
31. The link points to the site's own portal page on `SITE_URL`: `http://localhost:5173` locally and `https://ajclasses.com.au` hosted. It does not point to a Supabase URL.

### Password reset and sign-in unchanged (US5)

32. Forgot password still sends `Reset your AJ Classes password`, which still says `This link expires in 1 hour and works once.` Its link is refused after 1 hour.
    - After the request, the Forgot password page still reads `If that email has an account, we've sent a link. It expires in 1 hour.`
    - The invite lifetime lives in its own constant, separate from the password-reset one, so changing one never changes the other.
33. `supabase/config.toml` `otp_expiry` stays `3600`. The recovery, magic-link and reauthentication templates are unchanged.
34. Password sign-in, two-step and the emailed code work as before. The existing auth e2e and unit tests pass unchanged.

### Local Mailpit

35. On the local stack with `EMAIL_TRANSPORT=mailpit`, each of the four sends (staff, student, parent, re-send) puts one email in Mailpit (`http://localhost:55324`), and its link works on `http://localhost:5173`.
36. With `EMAIL_TRANSPORT` unset, nothing is emailed and nothing falls back to a real send. Each invite action fails with `The invite e-mail couldn't be sent. Please try again.`
    - A first-time staff, student or parent invite leaves no account behind (AC 21).
    - A re-send keeps everything as it was (AC 39).
    - Linking an existing parent is not affected (AC 41).
37. `e2e/tests/invite-onboarding.spec.ts` is updated to the new link format and passes. At least one e2e or integration test covers each of these: re-send cancels the old link, a used link is refused, an expired link is refused, and a failed re-send keeps the previous link working.

### Added in round 1

38. **Old-format links.** A link in today's format (`/portal/auth/confirm?token_hash=…&type=invite`), issued before release, is refused after release with AC 9. It signs nobody in, even if it is less than an hour old. Set-up: locally, get a `token_hash` from `auth.admin.generateLink({ type: 'invite' })` and build the URL by hand (or create the invite on `develop` before switching to the branch).
39. **Failed re-send.** If `Resend invite` can't send its email (for example, `EMAIL_TRANSPORT` unset, or the provider refuses):
    - the admin sees `The invite e-mail couldn't be sent. Please try again.`;
    - the account stays, and so do its roster or parent links;
    - the **previous** link keeps working until its own 14 days are up;
    - the status chip and `Invited on <date>` don't change;
    - no `invite_resent` audit entry is written.
40. **Send time is stored.** After every successful invite (staff, student, parent) and every successful re-send, `profiles.invited_at` holds the time of that send. Web `Invited on <date>` shows it, and the shipped mobile build reads it unchanged. How it is set is stage 2's decision.
41. **Linking an existing parent.** `Invite or link a parent` with an e-mail that already has a parent account links them, sends no email, and creates no invite link. It works the same whether `EMAIL_TRANSPORT` is set or not, and writes `parent_linked`.

## Scope

**v1 (this branch):**

1. A 14-day, single-use invite link for staff, student and parent invites and for re-sends.
2. Re-send and cancel switch off the old link, and a failed re-send changes nothing.
3. Re-send always sends the invite email, not a password-reset email (AC 14).
4. Admin status, warnings and dialog copy follow 14 days, with `invited_at` kept current.
5. The invite email is sent through the existing Resend/Mailpit transport, with the updated expiry line.
6. Tests: unit, function and e2e, as in AC 37.

**Deferred (later release bucket):**

1. D1 — Mobile status rule. The mobile app still computes `Invite expired` after 1 hour, so it will show valid invites as expired until it is updated to 14 days (`account_status.dart`). This needs a mobile repo change and a store release.
2. D2 — Showing the exact expiry date and time in the email and on the admin page (for example "expires Thursday 12 November, 3:40 pm").
3. D3 — Showing failed or undelivered invite emails on the admin Emails list (`admin-emails.tsx`). Today the admin sees the failure straight away in the dialog.
4. D4 — Telling a refused link apart in the message ("already used" vs "expired"). This is held back on purpose (AC 11).
5. D5 — A reminder email to people who haven't accepted after N days.
6. D6 — Removing the now-unused Supabase invite template (`supabase/templates/invite.html`, `[auth.email.template.invite]`) if the Architect retires that path. Clean-up only.

## For Saurabh at release (production is yours)

1. **Function settings.** `deploy.sh` already sets `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY` and `SITE_URL` on the hosted project and checks them. After deploy, run `supabase secrets list` to confirm they are there for `account-admin`. Stage 2 will list any new secret.
2. **Resend sender.** Confirm that `hello@ajclasses.com.au` is still a verified sender domain in Resend. Invites now use Resend's API instead of Supabase's SMTP, and both still share the Free plan's 100 a day.
3. **Kill switch.** Depending on stage 2's answer to the A5 question, `supabase secrets unset EMAIL_TRANSPORT` may now also stop invites. Keep that in mind before you use it.
4. **Hosted Auth settings.** Leave Email OTP Expiration and the hosted email templates as they are, because password reset depends on them. If stage 2 needs a new redirect URL in the hosted Auth allow-list, it will be listed there, and you add it.
5. **Deploy order.** This is the usual order for this repo, and stage 4 confirms it: database migration, then `account-admin`, then the web app. Between the function deploy and the web deploy, new-format links would reach the old landing page, so stage 2/4 must either deploy the web app first or make the new page accept both.
6. **Pending invites at release.** Old-format links stop working at release (AC 38), so re-send any invite that is still pending.
7. **Mobile.** Until D1 ships, the mobile admin screens show `Invite expired` for invites more than an hour old. Decide whether that's acceptable for now or whether D1 should follow straight away.

## Revision map (round 1)

AC 1–37 keep their numbers. AC 38–41 are new. Findings → where fixed:

1. Failed re-send → AC 21, AC 36, new AC 39 and AC 41, A9.
2. Signed-out caller → fact 1, AC 20.
3. Cut URL → fact 5, AC 10.
4. `invited_at` source → fact 6, new AC 40.
5. Forgot-password copy → fact 8, AC 32.
6. Old-format links → new AC 38, AC 9, A4.
7. Secrets evidence → fact 12, "For Saurabh" item 1.
8. Kill switch → fact 9, A5 question, "For Saurabh" item 3.
9. Hard-to-reach states → note above AC 17, set-up steps in AC 17 and AC 18.
10. Dashboard count → fact 6, AC 23.
11. Email heading wording → fact 4, AC 28, A6.
12. Boundary rule → rule line above AC 1.
