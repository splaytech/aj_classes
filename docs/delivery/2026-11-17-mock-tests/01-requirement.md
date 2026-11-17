# 01 — Requirement: mock tests (v1)

Stage 1 (Product Owner) of `/deliver`. Branch `feature/mock-tests` (from `develop`). Date 2026-11-17. Revised after `review-1.md` (round 1) and the team-lead rulings L-1 to L-3.

## Saurabh's ask, verbatim

"add feature to set up mock test visible to admin only to create and release mock test, single admin can create but its visible to all admins. once its released, it can be accessed free of cost by all students of aj classes and also for now its free of cost available to all signed up users of the portal even if they are not yet students. consider for now mock tests are only MCQ's"

## What exists today (checked in the repo)

1. **Roles.** `public.app_role` is `tutor | admin | student | parent | user` (`supabase/migrations/20261006004522_staff_accounts.sql`, `20261114100000_user_role.sql`). Admins are the `admin` role; tutors are `tutor`. Admin pages are under `admin-layout` (`apps/web/src/routes.ts`).
2. **Signed-up users** are role `user`, created by public sign-up (ADR-0011, `docs/delivery/2026-11-13-open-sign-up/01-requirement.md`). A `user` starts `status = 'invited'` until the finish step, then becomes `active`. Google is the only way in at release (`00-decisions.md`, 2026-11-17). Parents who staff link to a child are role `parent`, not `user` (`01-requirement.md` AC-35 promotion).
3. **Students** are role `student` with a `students` row, and get their account by staff invite. Access to classes runs through `enrolments` (`supabase/migrations/20261007061232_classes_timetable_assignments.sql`).
4. **Existing assignments** already have MCQ questions: `kind = 'multiple_choice'`, prompt 1–2000 characters, 2–6 options of 1–300 characters, one correct option, optional explanation up to 2000 characters, marks 1–100, auto-marked on submit (`20261007090320_student_parent_portal.sql`, `20261027100000_fair_results.sql`). Titles are 2–150 characters, instructions up to 4000 (`20261007061232_classes_timetable_assignments.sql`). Assignments belong to a class and a due date. Mock tests do not.
5. **Access rules** use `is_active` and `status = 'active'` (`private.my_active_role()`, per the sign-up requirement fact 3).
6. **Portal homes.** A `user` sees only the posts home (`routes/portal/user-home.tsx`, `user-layout.tsx`). Students have `student-layout` (home, assignments, timetable). Parents have `parent-layout`.
7. **Mobile** (`aj_classes_mobile`) has no server surface for this (`docs/delivery` sign-up fact 12; `_agents/product-owner.md`). A new table or RPC is a migration, so mobile is out of v1.

## Assumptions (lead reading, overrulable)

- [ASSUMPTION M1] v1 is the web portal in `aj_classes` only. The mobile app is unchanged, and a mobile student, parent or user sees no mock test list.
- [ASSUMPTION M2] "Visible to admin only" means the `admin` role: admins alone can open the management pages and see drafts. Tutors are staff and can't take released tests in v1 either, and can't see mock tests at all. Students, parents and signed-up users can take released tests (M6).
- [ASSUMPTION M3] "Single admin can create, visible to all admins" is read as: every active admin sees every mock test (drafts included), and every active admin can edit a draft and release it. The creator is recorded. Two admins editing the same draft: last save wins (no locking in v1). The "any admin edits or releases" part is a team reading, listed as D-3 for Saurabh to overrule.
- [ASSUMPTION M4] "All students of AJ Classes" means every active `student` account. It is not limited to a class or a current enrolment: a student with no class still gets access.
- [ASSUMPTION M5] "All signed up users ... even if they are not yet students" means every active `user` account (finished sign-up, `status = 'active'`, not deactivated). An unfinished sign-up (status `invited`) gets nothing until the finish step is saved.
- [ASSUMPTION M6] **Lead ruling L-1:** parents are included as signed-up users. Every signed-in, non-staff portal account (student, parent, user) that is active can take released mock tests free. This follows Saurabh's literal words, and he can overrule it (D-1). A parent's attempts are the parent's own; they are not attached to a child (see M18).
- [ASSUMPTION M7] Lifecycle: **draft → released**. A draft can be edited and deleted. A released test is read-only. An admin can take a released test back to draft only while no student has started it (same rule as assignments, `check_assignment_status`). Once someone has started it, a released test can't be edited or withdrawn in v1; a mistake means a new test. *Added by the team, cut if not wanted:* take-back (AC-20, AC-21).
- [ASSUMPTION M8] Attempts: **one attempt per student per test**. A student can leave and come back to an unfinished attempt, and answers are saved as they go. Submit is final. Retakes are deferred (D-B5).
- [ASSUMPTION M9] After submit the person sees the score (correct out of total), and for each question the correct option and the explanation (if the admin wrote one). *Added by the team, cut if not wanted:* the reveal of correct answers and explanations (AC-32, D-2). Each question is worth 1 mark in v1 (no per-question marks). Unanswered counts as incorrect and the person gets a warning before submitting.
- [ASSUMPTION M10] Admins see per test: status, question count, number of submitted attempts, creator and last change. *Added by the team, cut if not wanted:* the attempt count (AC-23, US-A5). Admins do not see individual people's answers or scores in v1 (deferred D-B7). They can read the questions and correct options in the edit view.
- [ASSUMPTION M11] Limits: title 2–150 characters, instructions up to 4000 characters, 1 to 100 questions per test, each question prompt 1–2000 characters, 2–6 options of 1–300 characters, one correct option, explanation up to 2000 characters. Title, instructions, prompt, options and explanation match the assignments limits (fact 4). The 1–100 question cap has no assignment equivalent and is the team's guess.
- [ASSUMPTION M12] Drafts can be deleted by any admin. A released test can't be deleted in v1 (archive is deferred).
- [ASSUMPTION M13] Free means no price, no payment prompt, no paywall, and no "upgrade" text. The access rule is role plus active status only. No public web page (home, programme, SEO) mentions mock tests in v1. The sitemap and `/posts` don't change.
- [ASSUMPTION M14] No e-mail is sent about mock tests in v1 (no "new mock test" alert). The e-mail outbox kinds don't change.
- [ASSUMPTION M15] Portal navigation: a "Mock tests" item for admins (admin area), students (student area), parents (parent area) and users (user area). Each new page is inside an `ErrorBoundary` (CLAUDE.md rule). The page wording goes in the portal constants files.
- [ASSUMPTION M16] No timer. The test runs untimed.
- [ASSUMPTION M17] Dependency: this branch needs the `user` role and the finish step from open sign-up to be on the branch that ships. Signed-up users get nothing before Google sign-up (the `user` role) is live.
- [ASSUMPTION M18] A parent's attempts and results belong to the parent's own account and are not shown beside a child's record. The parent's child pages are unchanged.
- [ASSUMPTION M19] Team choice: the list refreshes on page load only (no live updates).

## User stories

**Admin (US-A)**

- **US-A1: Create.** As an admin, I want to create a mock test with a title, instructions and MCQ questions, so that I can build a practice test. Outcome: a draft exists that no student can see.
- **US-A2: Shared list.** As an admin, I want to see every mock test that any admin has made, so that the team works from one list. Outcome: no test is hidden from another admin.
- **US-A3: Release.** As an admin, I want to release a finished draft, so that students, parents and signed-up users can take it for free (D-3 on who may release). Outcome: the test appears to them on their next page load.
- **US-A4: Correct mistakes.** As an admin, I want to edit a draft, so that I can fix errors before release. *Added by the team, cut if not wanted:* take back a released test while no one has started it (AC-20).
- **US-A5: Track.** *Added by the team, cut if not wanted:* As an admin, I want to see how many people have submitted each test, so that I know it is being used. Outcome: a count, with no individual answers in v1.

**Student (US-S)**

- **US-S1: Find.** As a student, I want to see the released mock tests in my portal, so that I can practise. Outcome: a list with name, number of questions, and my status.
- **US-S2: Take.** As a student, I want to answer the questions one at a time and come back later, so that I can finish in my own time. Outcome: my answers are kept until I submit.
- **US-S3: See result.** As a student, I want to see my score after I submit. *Added by the team, cut if not wanted:* the correct answers and explanations too (AC-32, D-2).

**Signed-up user (US-U)**

- **US-U1: Find.** As a signed-up user, I want to see the released mock tests from my home, so that I can use them for free even though I'm not a student yet.
- **US-U2: Take and see result.** As a signed-up user, I want the same taking and result experience as a student (US-S2, US-S3).
- **US-U3: Nothing else.** As a signed-up user, I want to see only mock tests, and nothing about classes, students, families or staff (sign-up requirement AC-25 to AC-30 still apply).

**Parent (US-P) and tutor (US-T), explicit**

- **US-P1: Parent.** As a parent, I want to take released mock tests free, as signed-up users can (M6, lead ruling L-1). My attempts are my own (M18). Parents do not see a child's mock test results in v1 (D-B1).
- **US-T1: Tutor.** Tutors are staff and can't see or take mock tests in v1 (M2).

## Acceptance criteria

Each one is written so Tester can check it in the browser or with a database test. Who can do what is the rule; how it is built is not.

### Access and visibility

1. A user with role `admin` and an active account can open the Mock tests page in the admin area. A user with role `tutor` or `parent` who opens its URL sees the existing "not allowed" page, and the data isn't returned to them by the database either.
2. An admin sees every mock test, drafts and released, made by any admin, in one list.
3. A student with an active account sees, in the student area, only the released mock tests. Their drafts are never shown or returned.
4. A signed-up user (role `user`, active) and a parent (role `parent`, active) each see only released mock tests, in their own area (M6).
5. A user whose sign-up is unfinished (status `invited`) cannot see any mock test, and is held on the finish step as today.
6. A deactivated student, parent or user sees no mock tests, and is signed out as today.
7. A tutor (staff) can't open the mock test pages, see their data, or take a test. Any role not listed in AC 1, AC 3, AC 4 gets no mock test data from the database (checked with direct calls under their own session). Parents are covered by AC 4 and are not in this group.
8. Mock tests appear on the student, parent and user homes and nowhere else, not on the tutor home, timetable or class pages.
9. Released mock tests are free: no price, payment, paywall or upgrade text appears on any mock test page.
10. A student's, parent's or signed-up user's access doesn't depend on being in a class, having an enrolment, or being linked to a student (M4, M5, M6).

### Admin: create and edit

11. An admin with the Mock tests page can create a mock test with: title (2–150 characters after trimming), optional instructions (up to 4000 characters). The new test is a draft.
12. An admin can add a question of kind multiple choice with: prompt (1–2000 characters), 2–6 options (1–300 characters each), exactly one correct option, and an optional explanation (up to 2000 characters). *Added by the team, cut if not wanted:* the explanation.
13. A test can hold 1 to 100 questions. Questions can be added, edited, removed and put in order while the test is a draft. *Added by the team, cut if not wanted:* reordering (the order is kept as added if reordering is cut).
14. Saving a question with fewer than 2 options, no correct option, or two correct options is refused with a field-level message, and nothing is saved.
15. Any active admin can edit a draft (M3, D-3). A second admin's edit replaces the first (last save wins). There is no lock.
16. A draft can be deleted by any admin, after a confirmation. Deleting removes its questions. A released test can't be deleted (M12): the delete control is absent or refused.
17. A test with zero questions can't be released; the release control says so. A title can't be saved blank (AC 11), so a released test always has a title.

### Admin: release and withdraw

18. Releasing is a separate action with a confirmation that says students, parents and signed-up users can take it free of cost. Once confirmed, the test is released. A student, parent or user who already has the list open sees it after a page refresh; the list does not update by itself (M19).
19. A released test is read-only. Its questions, options, correct answers, title and instructions can't be changed. The edit control is absent or disabled, and a direct save is refused.
20. *Added by the team, cut if not wanted:* A released test with no attempt started can be taken back to draft by an admin, after a confirmation. After that it can be edited and released again.
21. *Added by the team, cut if not wanted:* Take-back to draft is refused once any attempt exists. The admin sees a plain message saying why, and the test stays released (M7).
22. Only the released state and the draft state exist in v1. There is no scheduled release date and no archive.

### Admin: list

23. The admin list shows, per test: title, status (Draft or Released), number of questions, *added by the team, cut if not wanted:* number of submitted attempts, created by (name), and last changed.
24. The admin list doesn't show taker names, answers or scores (M10). The creator's name (AC 23) is the only name shown.

### Student, parent and signed-up user: take

25. The list shows each released test with: title, number of questions, and the person's status for it: Not started, In progress, or Submitted (with score once submitted).
26. Opening a not-started test shows its title, instructions and number of questions, and a Start button. Pressing Start creates one attempt for that person (M8).
27. An in-progress attempt, when reopened in the same or another browser, shows the answers already chosen.
28. Each question shows one prompt and its options as single choices. Choosing an option saves it without a separate save button. A failed save shows a plain message and keeps the chosen option on screen.
29. A question can be left unanswered. The person can move to the next or previous question at any time (no forced order).
30. Submit asks for confirmation. If any question is unanswered, the confirmation says how many are unanswered and that they count as incorrect (M9). The person can still submit.
31. After submit, the answers can't be changed, and a second submit does nothing and shows the same result.
32. After submit, the person sees the score as "N of M correct" (M9). *Added by the team, cut if not wanted:* for each question, the correct option and the explanation if one was written (D-2).
33. Before submit, the correct answers and score are not shown anywhere (no result leak in the list or on the question page).
34. A student, parent or user can't start a second attempt on a test they have submitted (M8). The result stays visible from the list.
35. Take-back to draft is refused once any attempt exists (AC 21). A test with an attempt can't be taken back, so no one can be mid-attempt when it changes.

### Data and safety

36. Taking a test sends only the chosen option numbers. The correct answers for a test that is not yet submitted are never sent to the browser (checked in the network response).
37. No student, parent, user or admin can see another person's answers or score except their own (AC-26, AC-33). Admins see counts and the creator name only (AC-24).
38. Anyone who takes a test is recorded with their own account only, and never with another person's name or e-mail on the test pages.

### Quality bar

39. Every new route (`mock-tests` for admin, student, parent and user) is wrapped in an error boundary. A failed load shows a plain message and a Try again control. No raw error text appears.
40. Every word on the new pages comes from the portal constants files (house rule 2). Nothing is written inline in components.
41. Labels and wording use "mock test" for the feature and "question", "option", "attempt" elsewhere. "Test" alone is not used for the feature name.
42. Existing pages keep working: sign-in, the assignments flow for students and parents, the admin student list, and the user home showing posts (sign-up requirement AC-21).
43. Keyboard can reach every control on the new pages, and each option is a labelled radio group.
44. The new pages work at 375 px wide and at 1280 px wide, in light and dark appearance.

## v1 scope vs deferred

**In v1 (web portal):**
- Admin: create, edit and delete drafts; release; shared list. *Added by the team, cut if not wanted:* take back before any start, and attempt counts (US-A4, US-A5).
- Student, parent and signed-up user: list released tests, take once, see score after submit (US-S1 to US-S3, US-P1, US-U1, US-U2). *Added by the team, cut if not wanted:* the correct answers and explanations after submit.
- MCQ only, one attempt, no timer, no price.

**Deferred (named, not dropped):**

- **D-B1 Parent view of a child's mock test results**, and any link between a parent's attempts and a child (M18).
- **D-B2 Pricing and payments**: paid tests, subscriptions, a free-for-now flag that can switch to paid. Money: Saurabh's and Sales' call. Not started.
- **D-B3 Non-MCQ questions**: written, short answer, file upload, match, ordering. Later release.
- **D-B4 Timers and time limits.**
- **D-B5 Retakes and multiple attempts**, and best-score rules.
- **D-B6 Per-question marks** and weighted scoring.
- **D-B7 Admin results view**: individual people's attempts, answers and scores, and CSV export.
- **D-B8 Scheduled release dates**, archive, and deleting released tests.
- **D-B9 Mock test e-mails** ("new mock test" alerts) and reminders.
- **D-B10 Mobile app** support, including showing the list and results.
- **D-B11 Admin preview** (see the test as a student, without recording an attempt).
- **D-B12 Question bank** reuse, duplicating a test, and importing questions.
- **D-B13 Images or media** in questions.
- **D-B14 Class-specific tests** (linking a test to a class or to assignments).
- **D-B15 Public mention** of mock tests on the website, its SEO pages and sitemap.
- **D-B16 Tutor access** to take or see mock tests (M2).

## Decisions needed (Saurabh's)

1. **D-1 Parents and the free group (lead ruling L-1 in place).** Parents are included as signed-up users (M6), following your literal words. Reply "parents yes" to confirm before build, or "parents no" to move them out. Parents are included until you say otherwise.
2. **D-2 Reveal after submit.** Students, parents and users see the correct answers and explanations after submit (M9, AC-32). This is a team addition, kept as yes. Reply "yes" or "score only".
3. **D-3 Who may edit and release.** Your words say "single admin can create but its visible to all admins". The team reads that as every admin can also edit a draft and release it (M3, AC-15, US-A3). Reply "any admin" or "creator only". Any admin is kept until you say otherwise.

No money, account, identity or production decision is needed for v1. Nothing goes to production from this stage.

## Risks

- **R-1 Privacy.** Mock attempts are a new kind of portal data for signed-up users and parents, who signed up under Privacy wording that covers "your name and e-mail to run your account". Before release, check the Privacy Policy wording still covers stored answers and scores (Saurabh's approval; drafted by the team, not published by this stage).
- **R-2 Dependency.** The `user` role and finish step must be live before this feature gives value to signed-up users (M17). If sign-up is closed, students and parents still see mock tests.
- **R-3 Content.** The admin has to write every question and correct option. Wrong keys can't be fixed after release (AC-19, AC-21). The admin edit view and a release confirmation are the only safeguard.
- **R-4 Unfinished attempts.** A person who stops halfway keeps an unfinished attempt; it never auto-submits in v1 (no timer). It stays "In progress" indefinitely.
- **R-5 Shared drafts.** Last-save-wins between admins (M3, AC-15) can lose an edit. Accepted for a small admin team; revisit if more admins join.
- **R-6 Scope creep toward assignments.** Mock tests reuse the MCQ rules but have no class, due date or hand-in. Keep them separate so assignment flows don't change.

## Hand-off

- Tester gets the 44 ACs above; the test plan is written by the Test Manager and frozen before the first sitting.
- Tests need accounts with role `user`, `student`, `parent`, `admin`, `tutor`, and an unfinished `user`. Those accounts are local-only.
- No production or hosted-service change in this stage.
