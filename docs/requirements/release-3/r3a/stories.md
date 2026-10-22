# R3a — Staff Dashboard: User Stories

> **Status:** Built and tested locally (8 Oct 2026). Every story's acceptance criteria were checked in the browser walkthrough (todo T9.2). **Design:** [design.md](design.md) · **Gap review:** [review.md](review.md)
> Staff management (invite, roles, deactivate, two-step reset, editing others' profiles) and the activity page are R2a stories US1, US10, US14–US19 ([R2a stories](../../release-2/r2a/stories.md)).
> Test keys: **DB** pgTAP · **UNIT** Vitest · **BR** browser walkthrough.

## Tutor

### TS1 — My timetable
**As a** tutor **I want** to see my weekly timetable **so that** I know when and where I teach.
- AC1. `/portal/timetable` shows Monday–Sunday with my sessions: time, class name, subject, in person (location) or online. Days without sessions say "No classes".
- AC2. On a phone the week becomes day tabs, opening on today.
- AC3. Each session links to its class page.
- AC4. I never see other tutors' classes (database rule).
- Tests: DB, UNIT (grouping, times), BR

### TS2 — My classes
**As a** tutor **I want** a list of my classes and a page for each **so that** I can see the schedule and who is in the class.
- AC1. `/portal/classes` lists my active classes: name, subject, year level, schedule summary (e.g. "Tue 4:00–5:30 pm"), number of students.
- AC2. The class page shows term dates, delivery and location, the schedule, the enrolled students (name, year level) and the assignments.
- AC3. Opening a class I don't teach shows "Not found or you don't have access".
- Tests: DB, BR

### TS3 — Set homework
**As a** tutor **I want** to create, edit and delete assignments for my classes **so that** students know what to do.
- AC1. On my class page, **New assignment**: title (2–150), instructions (≤ 4000, plain text), due date (date picker, optional), maximum mark (optional, 1–1000; empty means feedback only).
- AC2. I can edit it later, and delete it after confirming; deleting also removes its marks.
- AC3. I can't create assignments in classes I don't teach, even through the API.
- Tests: DB, UNIT (checks), BR

### TS4 — Mark homework
**As a** tutor **I want** to record each student's status, mark and feedback **so that** I can track progress.
- AC1. `/portal/assignments/:id` lists every enrolled student with: status (Not submitted / Submitted / Marked), mark (when the assignment has a maximum), feedback, and **Save** per student.
- AC2. A mark above the maximum, or a mark on a feedback-only assignment, is refused with a clear message (also by the database).
- AC3. Who marked it and when is recorded automatically.
- AC4. Progress shows "Marked 3 of 6".
- Tests: DB, UNIT, BR

### TS5 — Assignments overview
**As a** tutor **I want** one list of my assignments **so that** I see what's due and what still needs marking.
- AC1. `/portal/assignments` lists assignments across my classes, soonest due first: title, class, due date with a label (Overdue / Due today / Due soon / no date), marking progress.
- Tests: UNIT (due labels), BR

### TS6 — Tutor dashboard
**As a** tutor **I want** my dashboard to show what matters today.
- AC1. Next sessions in the coming 7 days (up to 5), respecting term dates.
- AC2. My classes (count and link), assignments to mark (count of Submitted results) and due soon.
- AC3. Profile card and the "complete your profile" prompt (R2a US11) stay.
- Tests: UNIT (next sessions), BR

## Admin

### AS1 — Manage classes
**As an** admin **I want** to create and edit classes **so that** the timetable reflects what we run.
- AC1. **New class**: name, subject, year level (optional), delivery (in person / online), location, tutor (any active staff member, or none), term start and end dates (optional, end not before start).
- AC2. Edit any field; archive and restore (archived classes disappear from tutors' views and the timetable; admins can show them).
- AC3. A class whose tutor has been deactivated is flagged "Tutor inactive".
- Tests: DB, UNIT, BR

### AS2 — Timetable slots
**As an** admin **I want** to add and remove weekly slots for a class.
- AC1. **Add time**: day, start and end time (time pickers); end must be after start.
- AC2. Remove a slot after confirming.
- Tests: DB, UNIT, BR

### AS3 — Student roster
**As an** admin **I want** a list of students **so that** classes can be filled.
- AC1. `/portal/admin/students`: name, year level, classes; search by name; show archived.
- AC2. Add / edit (name 2–100, year level 2–12 or "Other (e.g. UCAT, GAMSAT)"); archive and restore.
- AC3. Only name and year level are kept (no contact details or birthdays) until student and parent accounts arrive in R3.
- Tests: DB, BR

### AS4 — Enrolments
**As an** admin **I want** to add students to a class and remove them.
- AC1. On the class page Students tab: search the roster (autocomplete) and add; remove with a confirm.
- AC2. Removing a student keeps their past marks; they no longer appear on marking pages.
- Tests: DB, BR

### AS5 — Whole timetable
**As an** admin **I want** to see every class on the timetable, and filter by tutor.
- Tests: BR

### AS6 — Admin dashboard
**As an** admin **I want** an overview: active staff, pending invites, active classes, active students, the last few access changes, and shortcuts to each admin page.
- Tests: BR

### AS7 — Teach like a tutor
**As an** admin (e.g. Ajay) **I can** do everything a tutor can on any class: set and mark assignments.
- Tests: DB, BR
