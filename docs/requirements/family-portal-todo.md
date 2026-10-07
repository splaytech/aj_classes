# Student & Parent Portal Build — Todo

> Started 8 Oct 2026. Owner asked for: student and parent logins (separate invites), assignments with MCQ and written questions published to a class, solving in the portal with light/dark themes, parents seeing assignments, marks, progress and comments.
> Each item is ticked only after it has been tested. Design: [R3b](release-3/r3b/design.md) · stories · [gap review](release-3/r3b/review.md)

## 0. Design

- [x] T0.1 Spikes: create-with-role + invite, template wording, enum migration (found F1)
- [x] T0.2 Design, stories, gap review (29 gaps F1–F29), recommendations for what to add before family logins

## 1. Database

- [x] T1.1 Migration: `student` and `parent` roles
- [x] T1.2 Migration: role from app_metadata, staff-only helpers, links, consent, questions, answers, statuses, triggers, RLS
- [x] T1.3 Migration: student, parent and admin functions (RPCs)
- [x] T1.4 Database tests for all of the above (141 new, 260 in total, all pass)
- [x] T1.5 Local demo data: a parent and a student account, consent, a published quiz with questions; regenerate types

## 2. Accounts edge function

- [x] T2.1 Rename to `account-admin`; add `invite-student` and `invite-parent`
- [x] T2.2 Invite e-mail worded by role; function tests (49 checks pass, wording checked in Mailpit)

## 3. Portal foundations

- [x] T3.1 Roles in access state; guards for member / student / parent areas; layouts and navigation by role (30 access tests)
- [x] T3.2 "Sign in" wording (login page, footer)
- [x] T3.3 Appearance: System / Light / Dark (tokens, provider, header toggle, Account page, captcha); 28 contrast checks

## 4. Admin: families

- [x] T4.1 Family accounts service
- [x] T4.2 Students list: account status and parents columns, link to student page
- [x] T4.3 Student page: consent, student account, parents, classes

## 5. Tutor: online assignments

- [x] T5.1 Questions service and checks (+ unit tests)
- [x] T5.2 Question builder on draft assignments; publish / unpublish
- [x] T5.3 Submissions list on published assignments; paper homework gets "Returned"
- [x] T5.4 Submission page: mark written answers, feedback, comment, return

## 6. Student portal

- [x] T6.1 Student service
- [x] T6.2 Student home: to do, submitted, returned, progress
- [x] T6.3 Solve page: MCQ and written, autosave, progress, submit
- [x] T6.4 Results view after return; student timetable

## 7. Parent portal

- [x] T7.1 Parent service
- [x] T7.2 Parent home: children, consent prompt
- [x] T7.3 Child page: progress, assignments, comments, timetable
- [x] T7.4 Child assignment (read-only)

## 8. Finish

- [x] T8.1 Privacy page section for family accounts
- [x] T8.2 Full check: format, lint, typecheck, unit, database, functions, build, public bundle (167 unit, 260 database, 49 function checks; public pages load no MUI, supabase-js or dayjs; no key values in the build)
- [x] T8.3 End-to-end: admin invites parent + student, parent consents; tutor builds and publishes; student solves (dark, phone) and submits; tutor marks and returns; student and parent see results; a new student accepts the e-mailed invite and lands on their home
- [x] T8.4 Docs updated with build findings (review B7–B15); commit
