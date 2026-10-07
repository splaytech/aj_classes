# Staff Dashboard Build — Todo

> Started 8 Oct 2026. Owner asked for the rest of the tutor and admin dashboards, end to end, using Material UI.
> Each item is ticked only after it has been tested (unit, database or browser test noted in brackets).
> Designs: [R2a (staff admin, activity)](release-2/r2a/design.md) · [R3a (classes, timetable, students, assignments)](release-3/r3a/design.md)

## 0. Setup

- [x] T0.1 Fix the `supabase` CLI (killed by macOS), restart the stack with the functions runtime (CLI 2.120 reinstalled; stack + edge runtime up; sign-in checked)
- [x] T0.2 Design, stories and gap review: R3a (new) + R2a step 7 updates (activity page, MUI) (30 gaps H1–H30 fixed in docs)
- [x] T0.3 Install Material UI; portal theme built from `theme.css`; public pages still don’t load it (theme unit test; build: 0 public JS files with MUI; rechecked in T9.1)

## 1. Database

- [x] T1.1 Migration: classes, timetable slots, students, enrolments, assignments, results, access rules, triggers (applied by `db reset`; DB tests below)
- [x] T1.2 Migration: activity list for admins (`admin_list_activity`) (activity.test.sql)
- [x] T1.3 Database tests for every new access rule and guard (119 pgTAP tests pass, 49 new)
- [x] T1.4 Local demo data: classes, timetable, students, assignments (3 classes, 4 slots, 6 students, 3 assignments)
- [x] T1.5 Regenerate database types (typecheck clean)

## 2. Staff-admin edge function

- [x] T2.1 `staff-admin`: invite, resend, cancel invite, deactivate / reactivate, reset two-step (served by the local runtime)
- [x] T2.2 Repeatable HTTP test script against the local function (`pnpm test:functions`: 26 checks pass; CORS allowlist to check on staging, R2a V33)

## 3. Admin: staff

- [x] T3.1 Staff service (list, invite, role, active, two-step reset, edit someone's profile and photo) (error-mapping + status unit tests)
- [x] T3.2 Staff list page: table, search, status filter, invite dialog (browser: list, validation, invite sent)
- [x] T3.3 Staff member page: profile, role, deactivate / reactivate, resend / cancel invite, reset two-step (browser: every action + self-protections)
- [x] T3.4 Browser test: invite → email → accept → set password; promote; deactivate; reset two-step (all passed)

## 4. Admin: activity

- [x] T4.1 Activity page (who changed staff access, and when) (browser: every action listed with details)

## 5. Classes and timetable

- [x] T5.1 Timetable logic (grouping, next sessions, summaries) + unit tests (9 tests)
- [x] T5.2 Classes service (classes, timetable slots, enrolments) (queries checked as tutor and admin against the local API)
- [x] T5.3 Classes list (tutor: mine; admin: all, new class, archived) (browser: list, new class dialog incl. validation)
- [x] T5.4 Class page: schedule, students, assignments tabs; admin editing (browser: edit + term dates, add time incl. order check, enrol/remove, archive/restore)
- [x] T5.5 Timetable page: week view (desktop) and day tabs (mobile); admin tutor filter (browser: week view, today highlight, filter; phone width in T9.2)

## 6. Students (admin)

- [x] T6.1 Students page: roster table, add / edit, archive (browser: validation, add, edit, archive, show archived, restore)
- [x] T6.2 Enrol / remove students on the class page (browser: search, add, remove with confirm)

## 7. Assignments and marking

- [x] T7.1 Assignments service and checks (+ unit tests) (7 tests; queries + mark save checked via API as tutor)
- [x] T7.2 Create / edit / delete assignment (date picker) on the class page (browser: create with due date + marks, edit to feedback-only, delete → class tab)
- [x] T7.3 Assignments list (due soon, overdue, marking progress) (browser: order, overdue/soon chips, progress, to-mark count)
- [x] T7.4 Marking page: status, mark, feedback per student (browser: over-max refused, save with marked-by, progress updates; HTML shown as text)

## 8. Dashboards and navigation

- [x] T8.1 Tutor dashboard: next sessions, classes, assignments to mark, profile (unit: summary + relative day; browser: today's class, counts)
- [x] T8.2 Admin dashboard: counts, shortcuts, recent activity (browser: counts match the data)
- [x] T8.3 Navigation for both roles (desktop and phone) (desktop checked; phone in T9.2)

## 9. Finish

- [x] T9.1 Full check: format, lint, typecheck, unit, database tests, build, public bundle check (95 unit, 119 DB, 26 function checks; public pages load no MUI/supabase-js/dayjs; no keys in build)
- [x] T9.2 End-to-end walkthrough as tutor and as admin, desktop and phone width (tutor: dashboard, phone timetable tabs, class page without admin controls, other tutor's class/assignment = Not found, marking, admin pages refused; admin: dashboard, tables scroll inside, dialogs fit)
- [x] T9.3 Docs updated with what building found; commit (R3a review §1.1 B1–B9; R2a review §3.5)
