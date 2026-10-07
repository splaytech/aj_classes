# R3b — Student & Parent Portal: User Stories

> **Status:** Built and tested locally (8 Oct 2026). Every story's acceptance criteria were checked in the browser walkthrough (todo T8.3) and by the tests named below. **Design:** [design.md](design.md) · **Gap review:** [review.md](review.md)
> Test keys: **DB** pgTAP · **FN** edge function script · **UNIT** Vitest · **BR** browser walkthrough.

## Admin

### FA1 — Record consent
**As an** admin **I want** to record that a parent agreed (e.g. paper form) **so that** the student's account can be created.
- AC1. Student page → Consent: "Not recorded" or "Recorded on {date} by {admin / parent portal}"; **Record consent** with a confirm.
- AC2. Audited (`consent_recorded`). Tests: DB, BR

### FA2 — Invite a parent
**As an** admin **I want** to invite a parent by name and e-mail from their child's page, or link a parent who already has an account.
- AC1. New e-mail → parent account created and invite sent; existing parent e-mail → just linked ("Linked to an existing parent account").
- AC2. An e-mail already used by staff or a student is refused.
- AC3. A parent can be linked to several children; a child can have several parents. Removing a link asks first and is audited.
- Tests: DB, FN, BR

### FA3 — Invite a student
**As an** admin **I want** to invite a student by e-mail once consent is recorded.
- AC1. **Send invite** is disabled until consent is recorded, with the reason shown; the server refuses too (`consent_needed`).
- AC2. Status shows No account / Invited / Active / Deactivated; resend, cancel, deactivate, reactivate work as for staff.
- Tests: DB, FN, BR

### FA4 — See family accounts in the roster
- AC1. Students list shows each student's account status and number of parents, and links to the student page. Tests: BR

## Tutor

### FT1 — Build an assignment with questions
**As a** tutor **I want** to add multiple-choice and written questions to a draft assignment.
- AC1. Multiple choice: prompt, 2–6 options, the correct option, marks (1–100), optional explanation. Written: prompt, marks, optional explanation.
- AC2. Edit, delete and reorder questions while in draft. The total marks show as the sum.
- AC3. Assignments without questions still work as paper homework.
- Tests: DB, UNIT, BR

### FT2 — Publish to the class
**As a** tutor **I want** to publish an assignment **so that** every student in the class gets it.
- AC1. **Publish** shows it to all students enrolled in the class (including ones added later). Draft assignments are never visible to students or parents.
- AC2. Questions are locked once published. **Unpublish** is possible only until a student has started.
- Tests: DB, BR

### FT3 — Mark and return online work
**As a** tutor **I want** to see each student's answers, mark written answers, add comments and return the work.
- AC1. Submissions list: status (Not started / In progress / Submitted / Returned), late label, score.
- AC2. Submission page: MCQ answers show right/wrong and their automatic marks; written answers take a mark (0 to the question's marks) and feedback; one overall comment for the student and parents.
- AC3. **Return to student** needs every written answer marked; returned work shows to the student and their parents.
- Tests: DB, BR

## Student

### FS1 — My assignments
- AC1. Home lists To do (soonest due first, with Start/Continue), Submitted (waiting for marking) and Returned (score, comment), plus a progress summary. Tests: DB, UNIT, BR

### FS2 — Solve in the portal
- AC1. Multiple-choice answers save as soon as they're chosen; written answers save a moment after typing stops, with "Saving…/Saved" shown.
- AC2. A progress bar shows answered questions. **Submit** asks for confirmation and says how many are unanswered. After submitting, answers can't be changed (also enforced by the database).
- AC3. Late submissions are allowed and labelled.
- AC4. All-MCQ assignments show the result straight away.
- Tests: DB, UNIT, BR

### FS3 — Learn from the marking
- AC1. Once returned: total and percentage, marks per question, the correct option for MCQs, explanations, tutor feedback and the overall comment.
- AC2. Before return, none of these are visible (database rule). Tests: DB, BR

### FS4 — Light and dark
- AC1. A header button switches light/dark; Account → Appearance offers System / Light / Dark; the choice is remembered on this device. Text stays readable (AA contrast). Tests: UNIT, BR

### FS5 — My timetable
- AC1. My weekly classes, same view as tutors. Tests: DB, BR

## Parent

### FP1 — My children
- AC1. Home lists each linked child with classes, work to do and average mark; a prompt to give consent if not recorded. Tests: DB, BR

### FP2 — A child's progress
- AC1. Assignments with status and due date; marks, per-question feedback and comments once returned; completed vs assigned, average %, on-time rate; the child's timetable.
- AC2. Draft answers stay private to the child until submitted. Other children's data is never visible. Tests: DB, BR

### FP3 — Give consent
- AC1. **Allow {child} to use the portal** records consent (once, audited). Tests: DB, BR

## Everyone

### FE1 — Invite-only sign-in for families
- AC1. Student and parent invites are separate e-mails with their own wording; accepting leads to set password and then the right home page.
- AC2. Sign-in page and footer link say "Sign in" (not "Staff sign in"). Tests: FN, BR
