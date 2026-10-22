# R3a — Staff Dashboard: Classes, Timetable, Students, Assignments — Design

> **Status:** Built and tested locally (8 Oct 2026); build findings in [review.md §1.1](review.md). Pulled forward from Release 3/4 at the owner's request: "continue with remaining parts of dashboard … complete everything end to end for both tutor and admin roles", using Material UI.
> **Stories:** [stories.md](stories.md) · **Gap review:** [review.md](review.md) · **Todo:** [../../dashboard-build-todo.md](../../dashboard-build-todo.md)
> **Builds on:** [R2a design](../../release-2/r2a/design.md) (roles, two-step, RLS helpers, portal routes and guards)
> Tags like **(H4)** point to gaps in [review.md](review.md).

## 1. Scope

**In scope (staff side only)**
- **Classes** (admin): create, edit, archive / restore, assign one tutor, term dates, in person or online, location.
- **Timetable**: weekly recurring time slots per class; week view for everyone (tutors see theirs, admins see all with a tutor filter); "next sessions" on the dashboard.
- **Students** (admin): a roster of names and year levels, archive / restore, enrol into classes.
- **Assignments**: the class tutor (or an admin) sets homework for a class with a title, instructions, due date and optional maximum mark; edits or deletes it.
- **Marking**: per enrolled student, status (Not submitted → Submitted → Marked), mark and written feedback.
- **Dashboards**: real content for the tutor and admin dashboards.

**Out of scope (later releases)**
- Student and parent logins, students seeing assignments, file submissions, "Returned" status, Realtime (R3).
- Communities, join requests, community admins (R4).
- One-off session changes (cancellations, extra lessons), attendance, double-booking checks (noted as next ideas).
- Public timetable on the website.

## 2. Decisions (8 Oct 2026, made without the owner per their instruction; reasons recorded)

| # | Decision | Why |
|---|---|---|
| D1 | **Students are roster records, not accounts.** Name and year level only. | Marking needs students, but logins, consent and parent accounts belong to R3. Keeping only name and year level follows data minimisation for children (APP 3). |
| D2 | **Table name `classes`** (as in `arch.md`), not "communities". | R4 can extend `classes` with community features without renaming. |
| D3 | **One tutor per class** (`classes.tutor_id`), any active staff member, so Ajay (admin) can teach. | Matches how AJ Classes runs; simpler rules. Co-tutors can be added later as a join table. |
| D4 | **Weekly recurring slots** (`class_sessions`: day, start, end) plus optional term start / end dates on the class. | "Small groups, twice a week" (site copy) needs several slots per class. One-off changes are out of scope. |
| D5 | **Times are Melbourne wall-clock times** (`time` without zone), shown as stored. | All classes run in Melbourne or online on Melbourne time. Staff in another time zone would see the same clock times (accepted, H12). |
| D6 | **Assignments belong to a class.** The class tutor or an admin may create, edit and delete; marking rows are per enrolled student. | Same shape R4 uses (assignments inside a class); R3 adds student submissions to the same `assignment_results` row. |
| D7 | **Archive, don't delete** classes and students. Assignments can be deleted (with their marks) after a confirm. | Keeps history for reports; an assignment created by mistake should go away. |
| D8 | **Material UI 9 for portal pages** (owner request), MUI X Date Pickers 9 with dayjs (`en-au`). The MUI theme is built at runtime from `theme.css` variables, so `theme.css` stays the single source of colours and fonts. | Owner's choice. Portal pages are client-only, so reading CSS variables in the browser is safe; public pages never load MUI (checked in the build, H18). |
| D9 | Existing portal pages (sign-in, profile, account) keep their current components; new pages use MUI. Both read the same theme variables. | No churn on tested pages; a later pass can move them to MUI. |

## 3. Data Model

New migration `supabase/migrations/<timestamp>_classes_timetable_assignments.sql`.

```sql
students            id, full_name (2–100), year_level smallint null (2–12; null = not at school, e.g. UCAT),
                    is_active, created_at, updated_at
classes             id, name (2–100), subject (slug, see SUBJECTS), year_level null (2–12),
                    delivery ('in_person' | 'online'), location (≤100), tutor_id → profiles (set null),
                    starts_on, ends_on (ends ≥ starts), is_active, created_at, updated_at
class_sessions      id, class_id → classes (cascade), day_of_week (1 = Monday … 7 = Sunday),
                    start_time, end_time (end > start), created_at
enrolments          (class_id, student_id) primary key, enrolled_at
assignments         id, class_id → classes (cascade), title (2–150), instructions (≤4000),
                    due_on date null, max_mark smallint null (1–1000; null = feedback only),
                    created_by → profiles (set null), created_at, updated_at
assignment_results  (assignment_id, student_id) primary key,
                    status ('not_submitted' | 'submitted' | 'marked'), mark numeric(6,1) null (≥ 0),
                    feedback (≤2000), marked_by → profiles (set null), marked_at, updated_at
```

Indexes: `class_sessions(class_id)`, `enrolments(student_id)`, `assignments(class_id, due_on)`, `classes(tutor_id)`.

**Triggers**
| Trigger | Does |
|---|---|
| `set_updated_at` on students, classes, assignments, assignment_results | `updated_at = now()` |
| `assignments_set_creator` (before insert) | `created_by = auth.uid()` when someone is signed in, so it can't be faked (H5) |
| `assignment_results_check` (before insert / update) | Refuses a student who isn't enrolled in the assignment's class (`not_enrolled`, H3); refuses a mark above `max_mark` (`mark_too_high`) or any mark on a feedback-only assignment (`no_marks`); when status becomes or stays `marked` with a change, sets `marked_by = auth.uid()` and `marked_at = now()`; clears them when status is not `marked` (H6) |

## 4. Access Rules

New helpers (`private` schema, `security definer`, `search_path = ''`):

| Helper | True when |
|---|---|
| `private.teaches_class(class uuid)` | The caller is active staff and is the tutor of that **active** class |
| `private.can_manage_assignment(assignment uuid)` | `is_admin()` or `teaches_class(the assignment's class)` |
| `private.can_see_student(student uuid)` | `is_admin()` or the student is enrolled in an active class the caller teaches |

| Table | Read | Create / change | Delete |
|---|---|---|---|
| `students` | admin; tutor if `can_see_student` | admin | — (archive) |
| `classes` | admin; tutor of the class if active | admin | — (archive) |
| `class_sessions` | admin; `teaches_class` | admin | admin |
| `enrolments` | admin; `teaches_class` | admin | admin |
| `assignments` | admin; `teaches_class` | admin or `teaches_class` (both before and after the change) | admin or `teaches_class` |
| `assignment_results` | `can_manage_assignment` | `can_manage_assignment` + trigger checks | `can_manage_assignment` |

"Admin" means `private.is_admin()`: an active admin with a two-step (`aal2`) session, as in R2a. Grants are reset (`revoke all … from anon, authenticated`) and then granted per table only for the verbs above (H1).

**New RPC:** `public.admin_list_activity(max_rows int default 100)` (R2a US19, now with a page). Admin only; returns time, action, actor name, target name (or the e-mail kept in `details` for a cancelled invite), details. `max_rows` capped at 500.

## 5. Web App

### 5.1 Routes (all under `/portal`, client-only)

| Path | Page | Who |
|---|---|---|
| `/portal/tutor` | Tutor dashboard: next sessions, my classes, assignments to mark, profile | all staff |
| `/portal/timetable` | Week view; admins see every class with a tutor filter | all staff |
| `/portal/classes` | Classes list; admins: all classes, **New class**, show archived | all staff |
| `/portal/classes/:classId` | Class page: Schedule · Students · Assignments tabs; admins edit | tutor of the class, admin |
| `/portal/assignments` | My assignments: due dates, marking progress | all staff |
| `/portal/assignments/:assignmentId` | Marking page | tutor of the class, admin |
| `/portal/admin` | Admin dashboard: counts, shortcuts, recent activity | admin |
| `/portal/admin/staff`, `/portal/admin/staff/:userId` | R2a staff management | admin |
| `/portal/admin/students` | Student roster | admin |
| `/portal/admin/activity` | Activity (audit log) | admin |

A class or assignment the person may not see returns no row (RLS); the page then shows "Not found" rather than an error (H9).

### 5.2 Material UI setup

- Packages: `@mui/material`, `@emotion/react`, `@emotion/styled`, `@mui/icons-material`, `@mui/x-date-pickers`, `dayjs`.
- `lib/portal-theme.ts` → `createPortalTheme()` reads `--color-*`, `--font-body`, `--radius-md` from `document.documentElement` and builds the MUI theme (spacing 4 px to match the `--space-*` scale). No colour values in TypeScript (house rule F1.2).
- `components/portal/PortalThemeProvider.tsx` wraps the staff layout: MUI `ThemeProvider` + `LocalizationProvider` (dayjs, `en-au`). No `CssBaseline` (global.css already sets base styles).
- Emotion inserts `<style>` tags; the portal CSP already allows inline styles.

### 5.3 Shared portal components (new)

| Component | Use |
|---|---|
| `PageHeader` | Page title, optional subtitle, back link and action buttons |
| `ConfirmDialog` | MUI `Dialog` for destructive actions (archive, delete, deactivate, cancel invite, reset two-step) |
| `NotFoundPanel` | "Not found or you don't have access" inside the portal frame |
| `LoadError` | A service error inside a page, with a retry link |
| `StatusChip` | Staff status, assignment due state, result status |
| `WeekTimetable` | Week grid (≥ md) / day tabs (< md) of session cards |
| `ClassDialog`, `SessionDialog`, `StudentDialog`, `AssignmentDialog`, `InviteDialog` | Create / edit forms in MUI dialogs |

### 5.4 Services (only `src/services/` talks to Supabase)

| File | Functions |
|---|---|
| `classes.service.ts` | `listClasses(includeArchived)`, `getClass(id)`, `saveClass(input)`, `setClassActive(id, active)`, `addSession`, `removeSession`, `enrolStudent`, `removeEnrolment`, `listTimetable()` |
| `students.service.ts` | `listStudents(includeArchived)`, `saveStudent(input)`, `setStudentActive(id, active)` |
| `assignments.service.ts` | `listAssignments()`, `getAssignment(id)` (with roster + results), `saveAssignment(input)`, `deleteAssignment(id)`, `saveResult(input)` |
| `staff.service.ts` | R2a §11.4 list (`listStaff`, `getStaffMember`, `inviteStaff`, `resendInvite`, `cancelInvite`, `setStaffRole`, `setStaffActive`, `resetStaffTwoStep`) |
| `activity.service.ts` | `listActivity()` |
| `profile.service.ts` | Generalised to any profile id (`getProfile`, `updateProfile`, `uploadPhoto`, `removePhoto`) with the existing "my" functions as wrappers, so admins reuse the same form (US18) |

Errors: Postgres check failures (`23514`) map to `invalidInput`; permission errors (`42501`) to `notAllowed`; our own raised keys (`not_enrolled`, `mark_too_high`, `no_marks`, `last_admin`, `cannot_deactivate_self`, `not_joined`, `not_found`) map one-to-one. `AUTH_ERRORS` is renamed `PORTAL_ERRORS` since it now covers the whole portal.

### 5.5 Pure logic (unit tested)

| File | Functions |
|---|---|
| `lib/timetable.ts` | `sessionsByDay`, `formatClock('16:00:00') → '4:00 pm'`, `formatTimeRange`, `scheduleSummary`, `upcomingSessions(sessions, now, days)` (respects term dates) |
| `lib/assignments.ts` | `dueState(dueOn, today)` → overdue / today / soon (≤ 3 days) / later / none, `markingProgress(results, enrolled)` |
| `lib/staff-status.ts` | `staffStatus(member, now)` → invited / inviteExpired / active / deactivated (R2a §5) |
| `lib/class-validation.ts`, `lib/student-validation.ts`, `lib/assignment-validation.ts` | Form checks mirroring the database limits |

## 6. Local Demo Data (`seed.sql`, local only)

Three classes (one taught by `tutor@local.test`, one by `admin@local.test`, one online), five weekly slots, six fictional students ("… Demo" surnames), enrolments, two assignments with a few results. Lets every page be tried straight after `pnpm db:reset`.

## 7. Testing

| Layer | What |
|---|---|
| Database (pgTAP, `classes_rls.test.sql`, `activity.test.sql`) | Every row of the §4 table as tutor / other tutor / deactivated tutor / admin aal1 / admin aal2 / visitor; triggers (not enrolled, mark too high, feedback-only, marked_by, created_by); activity RPC access |
| Unit (Vitest) | §5.5 functions; error mapping for new keys |
| Edge function (`pnpm test:functions`) | R2a staff-admin actions over HTTP against the local runtime |
| Browser | Walkthrough as tutor and admin at desktop and phone width (todo T9.2) |
| Build | Public pages don't load MUI or supabase-js; no secrets in `build/` |
