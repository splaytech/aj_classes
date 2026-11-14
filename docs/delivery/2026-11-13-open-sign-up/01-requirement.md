# 01 — Requirement: open sign-up for everyone

Stage 1 (Product Owner) of `/deliver`. Branch `feature/open-sign-up` (from `develop` @ 090c766). Date 2026-11-13. Revised after `review-1.md` (rounds 1 and 2) and after Saurabh's answers in `00-decisions.md` (2026-11-14).

Saurabh's ask, verbatim: "i want to open sign up for everyone on AJ Classes, any one can register and sign up as a student or as a parent/guardian. but they appear only as a user and not in any class or student or anything, they just appear as a user and they can only see blog posts and we will open more stuff for them later like mock tests when we add mock test feature."

His later answers narrow this. Only parents and guardians sign up. Sign-up opens at release. It uses Supabase public sign-up with e-mail, plus Google. Facebook and Apple are deferred (`00-decisions.md` rounds 1 and 2, which are authoritative).

This document says what must be true. It does not choose how; the Architect is redesigning stage 2 in parallel. Where an AC names a mechanism, the outcome is what counts.

## What exists today (checked in the repo)

1. **Accounts are invite-only.** `supabase/config.toml` has `[auth] enable_signup = false`. `supabase/scripts/deploy.sh` step 2/6 runs `supabase config push`, which writes the `[auth]` settings (sign-up, confirmations, providers, templates, rate limits) to production. Step 3/6 then refuses to go on unless hosted sign-ups are off (`signups_are_off`). Migrations run only at step 4/6. `docs/requirements/release-2/go-live.md` §0 says why: "an account created without an invite would become an **active tutor**".
2. **That risk is still live in the schema.** Every new auth user gets a `profiles` row from `private.handle_new_auth_user()`. Its role comes from `private.role_from_app_metadata()`: `account_role` `student` or `parent`, **otherwise `tutor`**. The row starts `status = 'invited'`, and `complete_onboarding()` turns any invited row active. So switching Supabase sign-ups (or any provider) on as things stand would let a stranger become a tutor.
3. **Roles.** `public.app_role` is `tutor | admin | student | parent`. Family access depends on links as well as the role: a student needs a `students` row (`private.my_student_id()`), a parent needs `student_guardians` rows. Every access rule needs `is_active` and `status = 'active'` (`private.my_active_role()`).
4. **Portal sign-in** is e-mail + password with Cloudflare Turnstile (`[auth.captcha] provider = "turnstile"`; `LOGIN_PAGE`, `portal.constants.ts`). Forgot password (also with Turnstile) sends a 1-hour recovery link. The web app uses no magic-link sign-in, though the template exists. Passwords need at least 12 characters (`AUTH_LIMITS.passwordMin`). Too short shows `PORTAL_VALIDATION.passwordTooShort` in the browser; a weak password the server refuses shows `PORTAL_ERRORS.weakPassword` (`error.constants.ts`).
5. **Email confirmation** is off (`[auth.email] enable_confirmations = false`). It is a global setting. Invited accounts are made with `auth.admin.createUser` without `email_confirm` (`account-admin/handlers/accounts.ts`). There is no branded sign-up confirmation template; `invite`, `recovery`, `reauthentication` and `magic_link` are branded.
6. **Portal home** (`routes/portal/home.tsx`) sends each person to `homeForRole(role)` (`lib/portal-access.ts`). Page areas are `member`, `staff`, `admin`, `student`, `parent`.
7. **Account page** (`routes/portal/account.tsx`) shows Notifications to every non-staff role (`!isStaffRole(role)`), and Your choices when `asksForConsents(role)`.
8. **"Blog posts" are the admin posts** (`public.posts`, Admin → Posts). Anyone can already read them, signed in or not, on `/posts`, headed `Latest news` (`POSTS_PUBLIC_PAGE.heading`, `posts.constants.ts`) and linked as "News" in the footer. There is no separate blog.
9. **Inviting an e-mail that already has an account** (`account-admin`): staff invite and student invite refuse with `already_exists` (`This e-mail already has an account.`). Parent invite links an existing **parent** account with no email (`parent_linked`). Any other role gets `already_exists`.
10. **Consent and privacy copy.** The admin student page says `A parent or guardian must agree before the student gets their own account.` (`ADMIN_STUDENT_PAGE.consent.intro`). The Privacy Policy (`PRIVACY`, `content.constants.ts`) says `Portal accounts are created only by invitation from AJ Classes.`, `A student's account is only created after a parent or guardian agrees, in the portal or on our enrolment form.` and `a child's portal account is only set up with a parent's or guardian's permission.` There is no Terms & Conditions page yet (`LEGAL_LINKS.terms = null`), so the setup form shows the words without a link. The setup form's terms line (`JOIN_PAGE.terms`) mentions "emails, SMS and calls about classes, my account and invoices".
11. **Email volume.** Hosted Auth email (reset, reauthentication codes) and app email share Resend Free: 100 a day. The app caps its own portal email at 70 a day (ADR-0004). Invites go straight through Resend and are outside that cap (DEC-IN-5). `[auth.rate_limit] email_sent = 30` is per hour, for the whole project.
12. **Mobile** (`aj_classes_mobile`, `lib/core/domain/role.dart`, `access_state_service.dart`). It reads `profiles.role` for `tutor`/`admin` and `app_metadata.account_role` for `student`/`parent`. Any other combination returns an `Unresolvable role` error and no data. If the profile can't be read and `my_onboarding` returns a row, it shows an "invited, setup unfinished" state. It has no sign-up, no Google/Facebook/Apple sign-in and no server code.
13. **Role changes after activation are blocked.** `private.handle_auth_role_assigned()` copies a role from `app_metadata` only while `status = 'invited'`. Nothing today changes the role of an active non-staff account. `admin_set_role` refuses non-staff (`Only staff accounts can have staff roles.`).
14. **Storage.** The only bucket is `avatars`, which is `public = true` (`staff_accounts.sql`). There is no work-files bucket.
15. **No sign-in providers.** `config.toml` has only `[auth.external.apple] enabled = false`, and no Google or Facebook section. The public sitemap lists `/privacy` and no Terms page (`routes/sitemap.ts`, `ALWAYS_LISTED`).

## Assumptions

- [ASSUMPTION A1] v1 is the web portal in `aj_classes` only. The shipped mobile app is not changed. A user who signs in on mobile sees no data and the app does not crash (AC-40). This was the lead's reading; I checked it against fact 12 and agree.
- [ASSUMPTION A2] "Blog posts" means the existing admin posts (fact 8). In v1 a user sees the same posts everyone already sees. There are no members-only posts in v1 (D2).
- ~~A3 (student or parent kind)~~ **Removed.** Saurabh's answer is "Parents only" (Decision 2). Every user has said they are a parent or guardian, and that gives no parent access.
- [ASSUMPTION A4] Whatever the mechanism, two outcomes hold. No password entered by someone who hasn't proven the mailbox ever signs in (AC-14). Nobody can use sign-up to learn which e-mails have accounts (AC-12, AC-46).
- [ASSUMPTION A5] Nothing is usable until the mailbox is proven (by the e-mail link, or by a provider that says the e-mail is verified) and the finish step is saved. Without this, someone could sign up with a real parent's e-mail and be linked to their child later (AC-33).
- [ASSUMPTION A6] We collect the minimum: full name, e-mail, password (e-mail sign-ups, set on the finish step), the parent-or-guardian statement and agreement to the Terms and Privacy Policy, and which way they signed up. From Google we keep only the name and e-mail. No phone, year level, school, date of birth or address.
- [ASSUMPTION A7] Admins see users on one list and can deactivate and reactivate them (aligned with 02). Tutors don't see them. No delete, edit or export in v1 (D6).
- [ASSUMPTION A8] When staff later link a finished user's e-mail as a parent, the existing account is promoted and linked. The person keeps their sign-in method and gets no new invite email. This matches how an existing parent is linked today (fact 9). Promotion to **student** or **staff** is refused (AC-34, AC-37).
- A9 **Answered** (Decision 5): the sign-up link is on the Sign in page only.
- A10 **Answered** (Decision 1): sign-up is open at release. [ASSUMPTION, from `00-decisions.md`] A way to close it again is kept for abuse, and it defaults to open (AC-48).
- ~~A11 (students state 15 or older)~~ **Removed** (Decision 2: no student sign-up).
- [ASSUMPTION A12] Sign-ups are not added to Kit, Zoho or any marketing list. The Privacy Policy says portal data is never used for marketing (D5).
- [ASSUMPTION A13, from `00-decisions.md`] Saurabh creates the Google Cloud OAuth client (Facebook and Apple are deferred, D14 and D15). The team builds and documents the setup, and tests with whatever local credentials exist.
- [ASSUMPTION A14] The team drafts the Terms page wording (AC-50) and Saurabh approves it. It is a short page about the portal and these accounts, not a full enrolment contract.

## User stories

**US1 — Sign up.** As a parent or guardian, I want to create an AJ Classes account myself, so that I don't have to wait for an invite.

**US2 — Verify.** As someone who signed up with my e-mail, I want to confirm it before the account works, so that the account is mine and only mine.

**US3 — See posts only.** As a signed-up user, I want a simple home with the latest posts, so that I can follow AJ Classes.

**US4 — Nothing private.** As a family or a staff member, I want signed-up users to see nothing about classes, students or other people.

**US5 — Staff can see them.** As an admin, I want to see who has signed up and switch off a bad account.

**US6 — Later enrolment.** As an admin, I want to link a signed-up user as a parent of their child without making a second account.

**US7 — Nothing else breaks.** As an existing staff member, student or parent, I want sign-in, invites, email and my pages to work as before, and I want production never to be left open.

**US8 — Google.** As a parent or guardian, I want to sign up and sign in with my Google account, so that I don't need another password. (Facebook and Apple are deferred: D14, D15.)

## Acceptance criteria

"User" means an account made through sign-up (e-mail or provider) and not yet promoted. "Finished" means the mailbox is proven and the finish step (AC-17) is saved. "Provider" means Google in v1 (Saurabh, Round 2: "v1 = e-mail + Google only"; Facebook and Apple are deferred, D14 and D15).

### Sign-up form (US1)

1. The sign-up page is a portal page. While sign-up is open (AC-48) and the portal is configured (`APP_CONFIG.features.portal`), the Sign in page (`/portal/login`) links to it, for example `New to AJ Classes? Create an account`. That link is on the Sign in page only (Decision 5). The sign-up page links back to Sign in.
2. The sign-up page is headed for parents and guardians, with a line such as `For parents and guardians. Students get their accounts from AJ Classes.` It asks for full name, e-mail, the Turnstile check, and a submit button. Under the button is a short collection notice, for example `We use your name and e-mail to run your account. See our Privacy Policy.` Above or below the form it shows `Continue with Google` (AC-51). It has **no password field**. The password, the parent-or-guardian statement and the Terms tick are all given on the finish step (AC-17), by the person who has proven the mailbox. All wording lives in the portal constants files.
3. ~~Kind is required.~~ **Removed** (Decision 2, parents only: there is no kind to choose).
4. Full name: 2–100 characters after trimming, with no control or text-direction characters. These are the same rules as `complete_onboarding()` today.
5. E-mail: the same check and message as the portal's other e-mail fields (`Please enter a valid e-mail address, like name@example.com.`). Stored lower-case.
6. **Password** (e-mail sign-ups only, always on the finish step, AC-17; it replaces anything stored before; provider sign-ups never set one there). Any password stored before the mailbox was proven is wiped when it is proven (02 Q4), so the finish-step password is the first one that works. At least 12 characters. Too short shows `PORTAL_VALIDATION.passwordTooShort` in the browser. A password the server refuses shows `PORTAL_ERRORS.weakPassword`. The field uses `autocomplete="new-password"` and has show/hide.
7. **Terms (on the finish step, AC-17, for e-mail and provider sign-ups alike):** a required checkbox with its own wording, not `JOIN_PAGE.terms`, for example `I'm a parent or guardian, and I agree to the Terms & Conditions and Privacy Policy.` Both are links (`LEGAL_LINKS`; the Terms link goes to the new page, AC-50). It says nothing about classes, SMS or invoices. Saving without it shows an error. The time the step is saved is stored as `terms_accepted_at`. The wording is cross-checked against the Privacy text (AC-43) and the Terms page (AC-50).
8. Submitting the e-mail form without the Turnstile check shows today's `PORTAL_ERRORS.captchaFailed`. The widget resets after any failed submit.
9. ~~Age statement for students.~~ **Removed** (Decision 2: no student self sign-up, so no age tick).
10. After a successful e-mail submit, the page shows one message, whatever the e-mail: for example `Check your e-mail. We've sent a link to confirm your address. It expires in 1 hour.` Under it: `Already have an account? Sign in or reset your password.`, linking to `/portal/login` and `/portal/forgot-password`. The hours come from a constant.
11. The sign-up page is covered by an `ErrorBoundary` (the portal root's, `portal-root.tsx`, is enough), has a `noindex` tag, and is not in the sitemap.

### Existing e-mails and enumeration (US1, US4)

12. E-mail sign-up with an e-mail that already has a **finished or invited** account (admin, tutor, student, parent, invited, finished user, deactivated) shows the same message as AC-10: what the page shows and does is the same as for a new e-mail. It creates nothing and changes nothing (name, role, status, password), and it sends no email. A **deactivated** sign-up, finished or not, always follows this AC, never AC-14: nothing is sent. "The same" applies to the page; any difference in Supabase's raw reply (its status, or `identities: []` in its quiet reply) is R1 (lead ruling, stage 6). **Residual risk R1 (Decision 6, accepted):** Supabase's raw sign-up reply, seen by anyone calling the API directly (with a Turnstile token each time), shows whether **any** e-mail already has an account here. Saurabh accepted this (Decision 6).
13. An invited account that hasn't finished setup keeps its invite link working after someone signs up with its e-mail.
14. **No password before mailbox proof (outcome).** A password stored before the mailbox was proven is wiped the moment it is proven (by the confirmation link or a Forgot-password link). Before that, no password can sign in, because confirmations are on. So before the finish step, only the mailbox owner can hold a session. Saving the finish step deletes every other session. An access token already issued to another of the owner's own sessions keeps working until it expires (at most 1 hour), and reads only the user's own profile and posts. Tester checks these cases, with A as a stranger using B's e-mail and B as the mailbox owner:
    1. A signs up; B finishes from the link and types P2: only P2 signs in.
    2. A signs up; B uses Google with that e-mail: refused with message M (AC-54). B finishes from the link or Forgot password: only B's password signs in.
    3. A then B sign up; B finishes from the newest link: only B's password signs in.
    4. B then A sign up; B finishes from the newest link: only B's password signs in.
    5. A signs up through the raw API with P1; B clicks the link but doesn't finish; A tries P1: `Email or password is incorrect.` A never gets a session. When B finishes, only B's password signs in.
    6. An authenticator row present before confirmation is gone after it, and one enrolled before finishing is gone after the save.

    A repeat sign-up for an active **unfinished** e-mail sends a fresh confirmation link, and the old link stops working. No Terms tick or parent statement from an earlier sign-up counts; they are given only on the finish step.

### Verification and the finish step (US2)

15. The confirmation email is sent from `AJ Classes <hello@ajclasses.com.au>` and branded like the other portal emails, with a plain-text part that holds the full link.
16. The link opens a page on the site (`SITE_URL`), not a Supabase URL. As with `auth-confirm` today, opening the page uses nothing up until the person clicks a button, so an email scanner can't spend the link. After the click, the token is gone from the address bar and history.
17. **Finish step.** After the mailbox is proven (by the e-mail link, or by a provider sign-in for a new account, AC-52), the person sees a finish step. It shows the e-mail and the name, with a way to change the name. It asks for the Terms tick (AC-7), and, for an e-mail sign-up, always for a password (AC-6). A provider sign-up is asked for no password. Until the step is saved, the session can do nothing else: every other portal page redirects back to it, as `/portal/join` works for invited accounts today. **The server saves the step only from a session made by an e-mail link (confirmation or Forgot password) or a Google sign-in, never from a password-only session; unknown session types are refused (02 Q4). Saving also deletes any authenticator.** Saving deletes every other session for the account (AC-14). Only after it is saved does the account become active and the person land on the user home (AC-21).
18. An expired, used or garbled link shows one message (`This link has expired or has already been used.`, `PORTAL_ERRORS.linkExpired`) and a way to get a new one (AC-19). It never says which case applies.
19. `Send the link again` (on the sign-up success message and the expired-link page) asks for the e-mail and Turnstile. It always shows the AC-10 message. For an active, still-unconfirmed sign-up, it sends a fresh confirmation link (Auth's own resend, at most one per e-mail per 60 seconds). For an account that is confirmed but not finished, it sends nothing. The message then also says `To finish signing up, use the link we e-mailed you, or Forgot password.`, the same text as AC-20, shown to everyone, whatever the e-mail. Resends are neither counted nor stopped by the daily cap (AC-46, R2).
20. A password sign-in to an unfinished sign-up never reaches a usable finish step and reads nothing. The person is signed out and sees, for example, `To finish signing up, use the link we e-mailed you, or Forgot password.` This only shows to someone who typed that account's password, so it gives away nothing more than today's `Email or password is incorrect.` does. Forgot password for an active unfinished sign-up shows today's neutral message and sends a link that leads to the finish step. As today, Forgot password is neither counted nor stopped by the daily cap (AC-46, R2).

### What a user sees (US3)

21. After sign-in (e-mail or provider), a finished user lands on the user home page. It shows the posts newest first, using the same list component and text as `/posts` (`POSTS_PUBLIC_PAGE.heading`, `.empty`, `.error`).
22. The portal navigation for a user has only that home page, Account and Sign out.
23. Account shows the e-mail, the role `User`, and Appearance. Change password shows for accounts that have a password. It does **not** show Notifications, Your choices or Two-step sign-in.
24. Forgot password and Change password work for a finished user who has a password, as they do for everyone else. A user who signed up with a provider can set a password through Forgot password; that link leads only to setting a password for the same account.

### What a user must never see (US4)

25. Opening any staff, admin, student or parent URL as a user shows the existing "not allowed" page. This covers every route under `staff-layout`, `admin-layout`, `student-layout` and `parent-layout` in `routes.ts`.
26. A user calling the database directly with their own session (PostgREST and RPC) gets no rows from `classes`, `class_sessions`, `enrolments`, `students`, `student_guardians`, `assignments`, `assignment_questions`, `assignment_answers`, `assignment_results`, `email_outbox`, `audit_log`, `enquiries`, `notification_settings`, or other people's `profiles`. Writes to any of them are refused. They can't list or write storage objects; public avatar URLs stay public, as today. Tester checks every table and every `public` function granted to `authenticated`.
27. A user can read their own profile row and nobody else's. **This is a permission rule, not a screen** (lead ruling, stage 6): the only profile column a user may change is their full name (and their password, through Auth). They can't change their role, status, `is_active`, terms time, sign-up method, verified state or any other column. v1 has no screen for editing the name after the finish step, and none is needed.
28. Nothing a user can do through e-mail sign-up, provider sign-in, the finish step, `/portal/join`, `complete_onboarding`, user metadata or provider metadata gives them a staff, student or parent role. In particular, no sign-up path ever creates a `tutor` profile (fact 2). A database test covers this.
29. Users get no portal emails (new work, due tomorrow, returned work). The only emails they get are confirmation and password reset.
30. Users don't appear on Staff, Students, class rosters, the parent picker, the admin dashboard's staff/student/invite counts, or the Emails list.

### Staff view (US5)

31. Admins (two-step) have a `Users` page in the admin area. It lists each user newest first, with:
    - name and e-mail;
    - `Signed up <date>`, and how they signed up (`E-mail` or `Google`);
    - finished or not;
    - status (Active / Deactivated).

    The page also holds the open/closed control for sign-up (AC-48). Tutors can't open the page (the AC-25 rule) and can't read its data (the AC-26 rule).
32. An admin can deactivate and reactivate a user. A deactivated user is signed out. On their next sign-in, by any method, they see today's `Your account is not active. Please contact hello@ajclasses.com.au.` Both actions write today's `deactivated` / `reactivated` audit entries.

### Later invite or enrolment (US6)

33. `Invite or link a parent` with a **finished** user's e-mail first tells the admin, for example `This e-mail belongs to a signed-up user. They'll become a parent of <child>.` For an account made with Google it adds `Signed up with Google. To use the mobile app, they'll first set a password with Forgot password.` (Google sign-in isn't on mobile, D4.) When the admin confirms, the user becomes a parent linked to that student. No email is sent. The audit says `parent_linked` and notes that it was a promotion.
34. **Changed** (Decision 2): `Send invite` on a student's account section with a **finished** user's e-mail is refused with today's `This e-mail already has an account.` Next to that, a hint says `Signed-up accounts are for parents and guardians. Use a different e-mail for the student's account.` Signed-up accounts never become student accounts. An **unfinished** sign-up is replaced by a student invite, as in AC-36.
35. A promoted account keeps its password and its Google sign-in, and its sessions. Its role is set to `parent` everywhere the web and the shipped mobile build read it, including `app_metadata.account_role`, so both route it as a parent on the next sign-in. It leaves the Users list and shows on the student's parent rows, with today's chips and labels.
36. A staff, student or parent invite to an e-mail whose only account is an active **unfinished** sign-up works exactly like a normal invite does today. The unfinished sign-up is replaced, and its confirmation link stops working. An invite to a **deactivated** sign-up, finished or not, is refused with today's `This e-mail already has an account.`; the admin finds it on the Users page.
37. `Invite staff` with a finished user's e-mail is refused with today's `This e-mail already has an account.` (D7).

### Abuse basics (US1, US4, US7)

38. E-mail sign-up and `Send the link again` need Turnstile, checked on the server. Regression check: Forgot password still needs it, as today. Google sign-in relies on Google's own checks and sends no email from us.
39. Sign-up attempts per network are limited by Auth's own per-IP limit (`[auth.rate_limit] sign_in_sign_ups = 30` per 5 minutes, shared with sign-in; `02-architecture.md`). Over the limit shows today's `Too many attempts. Please wait a few minutes and try again.`

### Mobile (US7)

40. A user who signs in on the shipped mobile build sees no class, student, parent or staff data, and the app does not crash. The acceptable screen is today's error state for `Unresolvable role`, or signed out. The mobile build never shows its "invited, setup unfinished" state for a user, finished or not. Provider sign-in isn't on mobile (D4).
41. Nothing the shipped mobile build reads is removed or renamed (`profiles.role`, `full_name`, `is_active`, `invited_at`, `my_onboarding`). A user is never stored with `app_metadata.account_role = parent` (or `student`) until promotion (AC-35).

### Nothing else changes (US7)

42. Staff, student and parent invites, the setup form, sign-in, two-step, Forgot password, and the existing e2e and unit tests work and pass as before. The 14-day invite rules (DEC-IN-*) don't change. E-mail confirmation is turned on (fact 5): existing accounts are confirmed by the migration, and new invites are created confirmed. The tests also show that seed accounts, a pending invite, and a Studio-created admin (the `supabase/README.md` runbook) still sign in or redeem with it on.
43. The Privacy Policy drops `Portal accounts are created only by invitation from AJ Classes.` The new text is true whether sign-up is open or closed, for example `Portal accounts are created by invitation from AJ Classes, or by parents and guardians signing up themselves when sign-up is open.` It says:
    - what sign-up collects (A6);
    - that users see only posts;
    - that people can sign in with Google, and we get only their name and e-mail from Google.

    The student sentences stay, because they are still true. The text doesn't contradict the finish-step tick (AC-7), the Terms page (AC-50) or `ADMIN_STUDENT_PAGE.consent.intro`. Saurabh approves the wording before release.
44. Tests, all on the local stack only:
    - database tests for AC-26 to AC-28;
    - function or integration tests for AC-12 to AC-14, AC-20, AC-33 to AC-39, AC-46 and AC-52 to AC-55;
    - AC-14 cases 1–6;
    - each row of the Q3 linking table in `02-architecture.md`;
    - the sign-up hook's three refusals (closed, cap, unverified Google);
    - a promoted Google user still signs in with Google as a parent;
    - the `deploy.sh` dry-run order and `sign_up_guard_ready()`;
    - each stage-5 spike's test (S1–S7);
    - a test that calls the Auth API directly, skipping the form, and one that saves the finish step without its tick (AC-45);
    - a test that, once the cap is reached, the sign-up page shows the same busy message for a new e-mail and an existing account's e-mail (AC-46);
    - a test that a student invite replaces an unfinished sign-up and is refused for a finished one (AC-34);
    - one e2e from e-mail sign-up, through Mailpit confirmation and the finish step, to the user home.

    Provider testing is Google only: with local credentials where they exist, otherwise at the Auth boundary with a stand-in Google response. Saurabh does one real Google sign-in after he sets up the credentials (A13).

### Added in round 1

45. **Server-side rules.** The server checks every rule in AC-4, AC-5, AC-7 and AC-8 itself, on the sign-up request, on provider sign-ups and on the finish step. A sign-up request that skips or breaks a rule creates no usable account and sends no email. A finish-step save that skips or breaks one leaves the account unfinished. The role, the terms time, the parent statement and the sign-up method are never read from user-editable `user_metadata` or from provider metadata. The display name may start there (as `full_name` does today, or from the provider) but is checked against AC-4.
46. **Site-wide daily email cap.** New e-mail sign-ups are capped at 15 in any rolling 24 hours, set in one constant (Decision 3). Once the cap is reached, the sign-up page shows **everyone** the same neutral message, for example `Sign-up is busy right now. Please try again tomorrow.`, whatever the e-mail (new, existing or unfinished), and nothing is sent. This keeps AC-12's rule on the page. The cap itself never blocks existing users' resets, codes or invites (but see R2 below). Provider sign-ups send no email and are not counted.

    **Residual risk R2 (Decision 6, accepted):** confirmation resends and Forgot password are **outside** the 15: they are neither counted nor stopped by it, and they never get the busy message. Resends are limited only by 60 seconds per address and Auth's project-wide 30 e-mails an hour. So a script with many unconfirmed addresses could send 30 an hour and use up Resend Free's 100 a day in about 4 hours. After that, password resets, e-mailed sign-in codes, invites and portal e-mails (new work, due tomorrow, returned work) fail for everyone until the next day. **Accepted by Saurabh** (Decision 6: "Accept both"). A sign-up whose slot was taken but then failed still uses that slot. Also outside the cap: at the cap, a script calling the raw API gets a different reply for new and existing e-mails (part of R1).
47. **Release safety.** Production never accepts a sign-up, by e-mail or by Google, while any database rule that lets sign-up create a `tutor` (fact 2) is still in place. Concretely:
    - `deploy.sh` must not open sign-up or enable a provider (by `config push` or anything else) before the migrations that close that hole are applied;
    - if a step fails part-way, production is left with sign-up closed;
    - the old "sign-ups are off" check is replaced by an equal check that runs before any auth setting opens sign-up;
    - a dry-run test (`deploy.sh --dry-run`, or the script's own test) shows the order.
48. **Closing sign-up again (changed: was "switch off means off").** Sign-up is open at release (Decision 1). There is still one way to close it for abuse, and it defaults to open. While it is closed:
    - the sign-up page and the Sign in link are hidden;
    - `Continue with Google` signs in only accounts made with Google;
    - any request that would create a new account, by any path, is refused and sends no email;
    - existing users still sign in.

    An admin closes and reopens it with a control on the Users page (AC-31). This needs no code change or database migration. A Google sign-in never attaches to an existing account, open or closed (AC-54). Emergency fallback: Dashboard → Allow new users to sign up. The next deploy turns it back on, so close the admin control too.
49. ~~On/off switch, off by default.~~ **Removed** (Decision 1, "Live at release"). The way to close sign-up is in AC-48.

### Added after Saurabh's decisions

50. **Terms & Conditions page (in scope).** A short static public page at a new route, linked from `LEGAL_LINKS.terms`, so the sign-up tick and the existing setup form both link to it. It therefore covers **every** portal account: staff, students, parents and users. It is listed in the sitemap next to `/privacy` and has its own `ErrorBoundary`. Its route is added to the CSP e2e and `hosting-csp.test.ts` path lists, as `/careers` was (DEC-WH-1). The team drafts the wording [ASSUMPTION A14]: who we are, what a portal account is for, acceptable use, that we may deactivate accounts, and that the Privacy Policy covers personal data. Saurabh approves it. Sign-up does not open in production until it is live (Decision 4).
51. **Google button.** `Continue with Google` shows on the sign-up page and on the Sign in page, only when Google is set up for the environment. If it isn't, the button is hidden, never broken. Facebook and Apple are not shown in v1 (D14, D15). While sign-up is closed, AC-48 applies.
52. **New account from Google.** A Google sign-in whose e-mail has no account here, where Google says the e-mail is verified, creates a `user` account and opens the finish step (AC-17: name, Terms tick, no password). Nothing is usable until that step is saved. Then the person lands on the user home (AC-21), and later Google sign-ins go straight there. It never creates a staff, student or parent role (AC-28).
53. **Google e-mail missing or unverified.** If Google gives no e-mail or doesn't say it is verified, no account is created and no e-mail is sent (the hook refuses). The page says `We couldn't get a verified e-mail address from Google. Please sign up with your e-mail instead.`
54. **Google e-mail matching an existing account** (Saurabh: a provider login never attaches itself to an existing account).
    - A Google sign-in for an account made with Google signs in as normal.
    - Matching **any** existing account that wasn't made with Google (including an unfinished sign-up and a deactivated account): no sign-in and no link. It shows one message, M: `This e-mail already has an AJ Classes account. Sign in with your e-mail and password, use Forgot password, or use the link we e-mailed you.` This is not enumeration: Google has just proven the person controls the e-mail. Two-step for admins can never be skipped this way. Linking Google to an existing account by hand is deferred (D13).
55. **After a Google sign-in.** The session follows the same rules as an e-mail sign-in: AC-21 to AC-32 and AC-40 apply unchanged. Sign out works as today.

### Added at stage 6 (lead ruling)

56. **Unconfirmed sign-ups are deleted after 7 days** (security 06 finding 8; was D8). An active signed-up account whose e-mail was never confirmed, still `invited`, is deleted 7 days after it was created, with its profile and identity, by a daily job. Staff, students, parents, invitees and every confirmed account are never touched. A sign-up an admin deactivated is kept (its audit entry keeps pointing at it) and blocks a later invite to that address until it is reactivated and linked as a parent (review-5 round 3). The person can simply sign up again.

## Scope

**v1 (this branch):**

1. Sign-up page for parents and guardians (name, e-mail, Turnstile; no password on the form), open at release, with a way to close it again.
2. `Continue with Google` on the sign-up and Sign in pages, for new accounts and accounts made with Google.
3. E-mail verification, the finish step (parent statement and Terms), resend, the no-enumeration rules and the daily email cap.
4. User home with posts; the account page trimmed for users.
5. Database rules so users see nothing else and can never become staff; every rule checked on the server.
6. Admin Users page with deactivate, reactivate and the open/closed control.
7. Promotion to parent when staff link a finished user.
8. Terms & Conditions page, Privacy Policy update, and a release order that never leaves production open.
9. Unconfirmed sign-ups deleted after 7 days (AC-56; moved from D8).

**Deferred (later release bucket):**

1. D1 — Mock tests and any other user features ("we will open more stuff for them later").
2. D2 — Posts for signed-in users only.
3. D3 — Magic-link sign-in, and Google sign-in for invited staff, student and parent accounts.
4. D4 — Mobile: a friendly "use the website for now" screen for users, then user features and provider sign-in on mobile. Needs a store release.
5. D5 — Optional marketing consent at sign-up, and sending sign-ups to Kit or Zoho as leads.
6. D6 — Admin delete, edit, search and export of users; self-service account deletion (in v1, by e-mail to hello@ajclasses.com.au). Reactivate moved into v1 (AC-32).
7. D7 — Promoting a user to staff.
8. D8 — Moved into v1 as AC-56 (unconfirmed sign-ups deleted after 7 days; lead ruling, stage 6). Clean-up of confirmed but unfinished sign-ups stays deferred.
9. D9 — A "you already have an account" email when someone signs up with an existing e-mail.
10. D10 — Showing admins when the daily sign-up email cap is reached.
11. D11 — Student self sign-up (Decision 2 said parents only), with whatever age rule applies then (the Children's Online Privacy Code).
12. D12 — Moved under D15 (Apple relay addresses).
13. D13 — "Connected accounts": linking Google to an existing account by hand (02's D11).
14. D14 — Facebook sign-in (Saurabh, Round 2: left out of v1), with 02's Facebook safeguard.
15. D15 — Apple sign-in (Saurabh: "No, skip Apple for now"), including how staff find users with Apple's "Hide My Email" relay addresses (was D12).

## Questions for the Architect (stage 2)

1. **Answered** by Saurabh (Decision 3 in `00-decisions.md`): Supabase public sign-up plus Google (Facebook and Apple deferred in Round 2). AC-14, AC-28, AC-45, AC-47 and AC-54 must still hold.
2. How verification and the finish step work with `otp_expiry = 3600`, which is shared with password reset. This includes how `Send the link again` and Forgot password reach the finish step for an account that is verified but not finished (AC-19, AC-20), and how AC-14 is met with Supabase's own sign-up.
3. How a user is stored. The product rule: a user is never treated as a parent or student by RLS, the family functions or mobile (fact 12, AC-41) until promoted. My lean is a new role, because `parent` already means "linked to a real student".
4. The promotion path (AC-33, AC-35) changes an **active** account's role, which `handle_auth_role_assigned()` blocks today (fact 13). It needs a new, audited, admin-only server path that also sets `app_metadata.account_role`.
5. Where the daily cap (AC-46) and the per-network limit (AC-39) are counted, and how "close sign-up" (AC-48) works on both the page and the server.
6. Supabase may link a Google identity to an existing account with the same e-mail by itself. Confirm how AC-54 (never attach to an existing account) and AC-53 (verified e-mail only) are enforced. Also confirm what the CSP and hosting config need for the provider redirects (DEC-PR-6).

## Decisions for Saurabh

All are answered (`00-decisions.md`, 2026-11-14, rounds 1 and 2), with his words in quotes. Nothing is open for Saurabh. 02's cap strictness and the `user` enum value are the Architect's calls.

1. **Launch now, or hold until mock tests?** **Answered: "Live at release".** Sign-up opens when this is deployed. The off-by-default switch is gone (AC-49 removed). A way to close sign-up stays, open by default (AC-48).
2. **Minors / who can sign up.** **Answered: "Parents only".** No student self sign-up, so no age tick (AC-3 and AC-9 removed, AC-34 changed). Students still get accounts only through staff invites, with a parent's consent, as today.
3. **How sign-up is built, and email volume.** **Answered: "use public sign up with sign up with google and fb options and apple as well"** (narrowed in Round 2 to e-mail + Google, Decision 7), and on the recommendations, **"Accept all three"**: Resend Free with the 15-a-day cap (AC-46). Move to Resend Pro (about A$31 a month) only if "busy" shows on real days. New sign-ups use at most 15 of the 30 emails left after the app's 70. Resends do **not** count towards the 15 (R2, accepted in Decision 6), so the 15 left for resets, codes and invites is not guaranteed.
4. **Privacy Policy and Terms.** **Answered (within "Accept all three"):** a Terms page must exist before sign-up is open. Since sign-up is live at release, the Terms page is **in scope for this release** (AC-50), as a short static page whose wording Saurabh approves. If it isn't approved in time, the release waits; it doesn't ship without it. The Privacy text (AC-43) also needs his approval.
5. **Where the sign-up link shows.** **Answered (within "Accept all three"): the Sign in page only.** `Continue with Google` is on both the sign-up and the Sign in pages (AC-51).

6. **Residual risks R1 and R2.** **Answered: "Accept both (Recommended)". Move to Resend Pro (~A$31/month) if e-mail ever runs out.**
   1. **R1, e-mail lookup:** anyone calling the sign-up API directly can tell whether an e-mail already has an AJ Classes account. The page itself never shows this (AC-12).
   2. **R2, email quota:** confirmation resends sit outside the 15-a-day cap. A script could send 30 an hour and use up Resend Free's 100 a day in about 4 hours. That would stop password resets, e-mailed sign-in codes, invites and portal e-mails for everyone until the next day (AC-46).
   3. **R3, Google-only promotion** (from `review-2.md`, Round 3 note 1; same class as R1 and R2, recorded rather than asked): promoting an account made with Google rests on Google's past check of the e-mail. That check can be stale, for example a recycled address or a lapsed domain. The AC-33 message shows `Signed up with Google` so the admin can check with the parent first.
7. **Sign-up options and Apple.** **Answered: "Email + Google + Apple (Recommended)", then on Apple membership "No, skip Apple for now".** So v1 = e-mail + Google only. Facebook (D14) and Apple (D15) are deferred, and 02's Facebook safeguard question is moot.
8. **Custom Auth domain (~US$10/month).** **Answered: "Not now (Recommended)".**
9. **Linking policy.** Stated in the question and not objected to: a provider login never attaches itself to an existing account (AC-54).

## For Saurabh at release (production is yours)

1. **Release is blocked until** you approve the Terms page (AC-50) and the Privacy text (AC-43), and until the release order in AC-47 is in `deploy.sh`.
2. Hosted Auth settings are not set by hand. They come from `supabase/config.toml` through `deploy.sh` (`config push`), which you run. Stage 2 lists exactly which `[auth]` settings change (sign-up on, confirmations, the confirmation template, providers, rate limits, redirect URLs) and the new deploy order.
3. **The Google credentials are yours to create** (A13): a Google Cloud OAuth client with the callback URL stage 2 gives you. If it isn't set up by release day, the button stays hidden (AC-51). After setup, do one real Google sign-in.
4. Keep the "close sign-up" steps (AC-48) to hand for the first weeks, including the Dashboard fallback.

## Review round 1 responses

All 13 findings are accepted. Where each is fixed:

1. Password before mailbox proof → A4; AC-2, 6, 14, 17, 20; test in AC-44.
2. Email quota → new AC-46; AC-19; Decision 3 restated. I chose 15 a day rather than the suggested 20. Invites also use Resend outside the app's cap (DEC-IN-5), so the 30 left for Auth has to cover resets, codes and invites too.
3. Release safety → new AC-47; release note 2 corrected.
4. Server-side rules → new AC-45; test in AC-44.
5. Mobile → AC-35, AC-40, AC-41.
6. Promotion guard → fact 13; Architect Q4.
7. Confirmation lock-out → fact 5; AC-42. This applies only if stage 2 turns on global confirmations.
8. Terms line → AC-7; AC-43 (and fact 10).
9. Decision owners → old Decision 1 is now Architect Q3; old Decision 5 is dropped; A9 is now Decision 5; the launch question is new Decision 1, with its switch as AC-48 and AC-49.
10. Ambiguous ACs → AC-12 (timing claim dropped; same status and body instead), AC-26 (storage), AC-6, AC-39, AC-38.
11. Dead end → AC-10.
12. Admin sees the kind → AC-33, AC-34.
13. Trim → reactivate moved to D6 (AC-32); AC-21 reuses the `/posts` component; release note 1. Old D10 (a header or footer link) is now Decision 5.

## Review round 2 responses

All 6 findings are accepted, using the reviewer's simpler options. AC numbers are unchanged, and no new states were added.

1. Age gate and consent owner → the Terms tick and the age statement move to the choose-password step (A4, AC-2, 7, 9, 14, 17). Switching to Student there needs the tick. AC-45 also enforces the rules on that step. AC-44 adds tests for a save without ticks and for a Parent → Student switch.
2. Cap enumeration → AC-46: once the cap is reached, every sign-up and resend request gets the busy message, whatever the e-mail. A test is added in AC-44.
3. Decision 3 → reworded: sign-up uses at most 15 of the 30; resets, codes and invites share the other 15, as today.
4. Forgot password → AC-20: for an active unfinished sign-up, it sends a link to the same choose-password step, counted in the cap. AC-19: resend sends a choose-password link even when the e-mail is already verified. The mechanism is Architect Q2.
5. Overlap → AC-12: a deactivated sign-up always gets "nothing sent". AC-36: an invite to a deactivated sign-up is refused with today's message, and the admin finds it on Users.
6. Privacy with the switch off → AC-43: the wording holds in both switch states. Release note 1 says it can ship with the deploy.

## Saurabh's decisions — changes

From `00-decisions.md` (2026-11-14). AC numbers 1–49 are kept; dropped ones are marked **Removed** in place.

1. **"Live at release"** → AC-49 removed. AC-48 is now "close sign-up again", open by default. A10 answered. Release notes rewritten.
2. **"Parents only"** → AC-3 (kind) and AC-9 (age tick) removed. A3 and A11 removed. AC-34 changed: a student invite to a user's e-mail is refused. AC-33 and AC-35 now cover promotion to parent only. The finish-step tick now includes "I'm a parent or guardian" (AC-7). The Privacy student sentences stay (AC-43). Student self sign-up is deferred as D11.
3. **Public sign-up + Google, Facebook, Apple** → US8 and AC-51 to AC-55 are new. AC-2, 6, 14, 17, 20, 23, 24, 28, 31, 45 and 47 are updated for providers. The "choose-password step" is now the "finish step", which providers use too, so their users also see and tick the Terms (AC-7, AC-52). AC-14 and AC-12 are now stated as outcomes, not mechanisms. Architect Q1 is answered and Q6 is new. A13 (provider credentials are Saurabh's) is new, D3 is narrowed, and D12 is new.
4. **"Accept all three"** → the 15-a-day cap stays on Resend Free (AC-46). The Terms page is **in scope** (new AC-50, A14) and is a release blocker until approved. The sign-up link is on the Sign in page only (AC-1).

## Review round 4 and alignment with 02

Round 4 (`review-1.md`):

1. Password before mailbox proof → AC-6, AC-14 and AC-17. The password is always typed on the finish step and replaces anything stored before. "Confirmed" is gone: only a password typed after the mailbox is proven counts. AC-14 adds the "B finishes from A's link" and "B finishes by provider" cases. AC-2 has no password field (this matches 02's throwaway form password).
2. Student invite blocked → AC-34 refuses only **finished** users; AC-36 lets a student invite replace an unfinished sign-up. A test is added in AC-44.
3. AC-54 message → one message for all non-matching accounts, including invited ones.
4. Terms scope → AC-50 covers every portal account and adds the CSP path lists.
5. Linking while closed → AC-48. It is moot under 02's "block" policy, which I've followed in AC-54. If Saurabh picks linking later, it is allowed while sign-up is closed.
6. A finished user who is really a student → the AC-34 hint tells the admin to use a different e-mail.
7. Facebook verification → left to the Architect (Q6 and 02's Decision 1).

From 02's "Changes to 01":

1. Item 1 (password after the link) → AC-2, AC-6, AC-17.
2. Item 2 (raw-API residual) → AC-12.
3. Item 3 (the cap counts new sign-ups only) → AC-46, AC-19, AC-20.
4. Item 4 (Auth's per-IP limit) → AC-39.
5. Item 5 (resend) → AC-19.
6. Item 6 (admin toggle) → AC-48, AC-31.
7. Item 7 (no linking to existing non-user accounts) → AC-54.
8. Item 8 (promotion removes Facebook and sessions) → AC-33, AC-35.
9. Item 9 (confirmations on) → AC-42.
10. Item 10 (reactivate, collection notice, inherited `ErrorBoundary`, Forgot password outside the cap) → AC-32, AC-2, AC-11, AC-20.
11. Item 11 (connected accounts) → deferred as **D13**, because D11 is already student self sign-up here.

Where I differ from 02 (none conflicts with Saurabh's decisions):

1. **AC-34 isn't dropped.** It stays as "refuse a student invite to a finished user; replace an unfinished one", because round 4 item 2 showed that dropping it lets anyone block a student invite.
2. **AC-54's message** uses round 4's single wording rather than 02's "Sign in with your e-mail and password", because invited accounts have no password yet.
3. **The two accepted residuals need Saurabh to see them.** The raw-API enumeration (AC-12) and resends outside the cap (AC-46) go further than his "15-a-day cap" answer. I accept them as 02 recommends, but they should be put to him with 02's Decisions 4 and 6, not just assumed.

## Review round 5 responses

1. A password sign-in reaching the finish step (blocking) → AC-17: the step saves only from a confirmation-link, Forgot-password-link or provider session, and saving deletes every other session. AC-14: an earlier password may give a session, but it can't save the step or read anything, and it is replaced on finish. AC-20: a password sign-in to an unfinished account is signed out with a "finish from the link" message. AC-14 adds the fifth (raw-API) case, which AC-44 tests.
2. Residual risks in plain words → R1 (AC-12) and R2 (AC-46), put to Saurabh as the new Decision 6, which also blocks release. Decision 3's "never more than 15" line is corrected. "Where I differ from 02", item 3, is now covered by Decision 6.
3. AC-54 dead end → the message adds "reset your password", linked to Forgot password.
4. Facebook-only promotion → the AC-33 message and AC-35 say they'll use Forgot password; a test is added in AC-44.

## Alignment with 02 round 3

I applied all 18 items of 02's "Changes to 01" as written:

1. Item 1 → Scope 1.
2. Item 2 → AC-2, AC-51, Scope 2, A13; new D14 (Facebook) and D15 (Apple).
3. Item 3 → AC-6.
4. Item 4 → AC-14 opening, cases 1–6, and the session wording.
5. Item 5 → AC-17.
6. Item 6 → AC-19, so AC-19 and AC-20 show the same hint (Round 6 note 3).
7. Item 7 → AC-31.
8. Item 8 → AC-33.
9. Item 9 → AC-35.
10. Item 10 → AC-43.
11. Item 11 → AC-44.
12. Item 12 → AC-46.
13. Item 13 → AC-48.
14. Item 14 → AC-52.
15. Item 15 → AC-53; D12 moved under D15.
16. Item 16 → AC-54.
17. Item 17 → the "Provider" definition and US8. AC-28, AC-45, AC-55, D3 and D13 read as Google.
18. Item 18 → the Decisions list.

From Round 6 (`review-1.md`):

- **R2 wording:** AC-46 and Decision 6 now say it stops "password resets, e-mailed sign-in codes, invites and portal e-mails".
- **Note 1 (live tokens):** AC-14 uses 02's chosen wording. A live access token lasts up to 1 hour and reads only the user's own profile and posts. Promotion keeps sessions (AC-35), as 02 chose.
- **Note 3:** done, as item 6 above.

Saurabh's Round 2 answers are reflected:

- v1 is e-mail + Google only.
- R1 and R2 are accepted.
- There is no custom domain.
- A provider login never attaches to an existing account.

Conflicts with Saurabh's words: none found. I didn't apply anything differently from 02's list.

## Stage 6 rulings (lead, 14 Nov 2026) — changes

Edited in place on the lead's rulings in `00-decisions.md` ("Lead rulings on stage 6a ambiguous ACs"):

1. AC-12: "the same HTTP status and response body" now reads as what the page shows and does; raw-API differences are R1.
2. AC-27: made explicit that it is a permission rule; no name-edit screen in v1.
3. D8 moved into v1 as the new AC-56 (unconfirmed sign-ups deleted after 7 days, security finding 8), and Scope v1 item 9 added. Clean-up of confirmed but unfinished sign-ups stays deferred.
4. AC-40 unchanged: the ruling records that the mobile app's "Something went wrong" sign-in screen is today's `Unresolvable role` state.
