# R3b — Student & Parent Portal, Online Assignments, Light/Dark — Design

> **Status:** Built and tested locally (8 Oct 2026); build decisions and findings are in [review.md](review.md) §3 and §5. Owner request: students and parents sign in (invite only, separate links), tutors publish assignments with multiple-choice and written questions to a whole class, students solve them in the portal with light and dark themes, parents see what's assigned, marks, progress and tutor comments.
> **Stories:** [stories.md](stories.md) · **Gap review:** [review.md](review.md) · **Todo:** [../../family-portal-todo.md](../../family-portal-todo.md)
> **Builds on:** [R2a](../../release-2/r2a/design.md) (accounts, roles, invites, two-step, RLS helpers) and [R3a](../r3a/design.md) (classes, timetable, roster, assignments, marking).
> Tags like **(F7)** point to gaps in [review.md](review.md).

## 1. What Else We Add Before Family Logins (recommendations, all built here)

Family logins only work well if a few things exist first. Each of these is in scope:

| Addition | Why it matters before students and parents sign in |
|---|---|
| **Draft → Published** assignments | Students must never see half-written work. Questions are locked once published so everyone answers the same thing (F9). |
| **Auto-marking** of multiple-choice | Instant marks for MCQs, less tutor time. All-MCQ assignments are returned straight away. |
| **"Returned" step** | Marks and comments reach students and parents only when the tutor returns the work, never mid-marking (F12). |
| **Per-question feedback and explanations** | Students learn from mistakes; parents see why a mark was given. |
| **Autosave and late flag** | No lost answers on a flaky connection; late submissions are allowed but labelled. |
| **Parent links and consent** | A child's account needs a parent's (or the business's recorded) consent before it is created (APP / minors, F4). Parents can be linked to several children. |
| **Family timetable** | Students and parents see the child's weekly classes. |
| **Light / dark / system appearance** | Easier on the eyes for students working at night; remembered per device. |

**Later (not in R3b):** e-mail notifications (published / returned), file uploads, question bank and reuse, timed tests, attendance, announcements and messaging, printable progress reports, student self-practice.

## 2. Decisions (8 Oct 2026, made without the owner per their instruction)

| # | Decision | Why |
|---|---|---|
| D1 | **One `profiles` row per account for everyone**, roles `tutor`, `admin`, `student`, `parent`. Students' roster row links to their account (`students.profile_id`); parents link to children through `student_guardians`. | One set of account machinery (invites, status, last sign-in, deactivate, ban) for all four roles. |
| D2 | **Roles for new accounts come only from `app_metadata.account_role`**, which only the server (secret key) can set. Missing → `tutor` (staff invites and the dashboard bootstrap keep working). User metadata is never used (R2a G2). | Fixes the spike finding that every new account became a tutor (F1). |
| D3 | **Staff powers are `tutor`/`admin` only.** `private.is_active_staff()` now checks the role; family accounts can read their own profile row but change nothing directly. | Prevents a student or parent inheriting staff rights (F2). |
| D4 | **Families use the database only through functions** (`student_*`, `parent_*` RPCs, `security definer`), never direct table access. | Lets us hide correct answers, draft marks and other children's data precisely; one place to test (F5). |
| D5 | **Invites:** admins invite each student and parent separately from the student's page. A parent e-mail that already has a parent account is linked, not re-invited. A **student account needs consent recorded first**, by a linked parent in the portal or by an admin (e.g. paper form). | Invite-only like staff; consent for minors (F4). |
| D6 | **Assignments have optional questions.** With questions: students answer in the portal; total = sum of question marks. Without: "paper" homework as in R3a (tutor records the mark). | Keeps R3a working and covers worksheets handed in on paper. |
| D7 | **Question types:** multiple choice (2–6 options, one correct) and written (free text). Each has marks (1–100) and an optional explanation shown after return. | Owner asked for MCQ + descriptive; single-answer MCQ keeps marking simple. |
| D8 | **Status flow:** not started → in progress (autosaved) → submitted → returned. Paper homework: not submitted → submitted (handed in) → marked → returned. Families see marks and comments only when **returned**. All-MCQ assignments are returned automatically on submit. | Clear, matches R3's Submitted → Marked → Returned. |
| D9 | **Comments:** an overall comment per student per assignment and optional per-question feedback, both visible to the student and their parents after return. | Owner: comments visible to both. |
| D10 | **Appearance:** System / Light / Dark for the whole portal, remembered in the browser (per device). Dark colours are defined in `theme.css` under `[data-portal-theme='dark']`; the public site is unaffected. | Single source of colours; works for MUI and CSS-module pages alike. |

## 3. Data Model

Three migrations: `20261007090319_family_roles.sql` (adds `student` and `parent` to `app_role`; Postgres needs the new enum values committed before use), `20261007090320_student_parent_portal.sql` (tables, triggers, RLS) and `20261007090321_family_functions.sql` (student, parent and admin functions).

```sql
profiles            role now tutor | admin | student | parent (unchanged columns)
students            + profile_id → profiles (unique, set null), consent_recorded_at,
                      consent_recorded_by → profiles, consent_source ('admin' | 'parent')
student_guardians   (student_id → students, parent_id → profiles) primary key, created_at
assignments         + status ('draft' | 'published'), published_at
assignment_questions id, assignment_id → assignments (cascade), position (set by the database), kind
                    ('multiple_choice' | 'written'), prompt (1–2000), options text[] (MCQ: 2–6, ≤300 each;
                    written: none), correct_option (MCQ: 0..n-1; written: null), marks (1–100),
                    explanation (≤2000), created_at, updated_at
assignment_answers  (question_id, student_id) primary key, assignment_id, selected_option, response (≤5000),
                    awarded_marks numeric(5,1) ≥ 0, feedback (≤1000), updated_at;
                    (assignment_id, student_id) → assignment_results (cascade)
assignment_results  status + 'in_progress', 'returned'; + submitted_at, returned_at
```

Existing R3a assignments become `published` (they were already in use).

**Triggers and checks**
| Rule | Where |
|---|---|
| New auth user → profile role from `app_metadata.account_role` (`student`/`parent`), else `tutor` (F1). Supabase Auth saves `app_metadata` just after the insert, so it's also applied on update while the account hasn't joined (F30) | `handle_new_auth_user`, `handle_auth_role_assigned` |
| A student's `profile_id` must be a `student` profile; a guardian link's parent must be a `parent` profile (F3) | triggers on `students`, `student_guardians` |
| Questions can only be added, changed or removed while the assignment is a draft (`assignment_published`) (F9); new ones go last; at most 50 (`too_many_questions`) | trigger on `assignment_questions` |
| A student account needs consent recorded before it's linked (`consent_needed`) (F4) | trigger on `students` |
| Results only on published assignments (`not_published`); online work: staff may only return submitted work (`invalid_status`) | `check_assignment_result` |
| Back to draft only if no student has started (`has_submissions`) | trigger on `assignments` |
| `awarded_marks` ≤ the question's marks (`mark_too_high`) | trigger on `assignment_answers` |
| Result `mark` = sum of awarded marks, recalculated whenever answers change | trigger on `assignment_answers` |
| Total possible = sum of question marks, or `max_mark` for paper homework | `private.assignment_total_marks()` |
| `submitted_at` / `returned_at` set on those status changes; returning online work needs every written answer marked (`unmarked_answers`) and a submission (`not_submitted`) | `check_assignment_result` |
| `marked_by` only records **staff**; automatic returns leave it empty (F11) | `check_assignment_result` |

## 4. Access

| Who | How | What |
|---|---|---|
| Staff (tutor/admin) | RLS as in R3a, extended to questions and answers (`can_manage_assignment`) | Build questions, see answers, mark, return |
| Student | RPCs, keyed on `private.my_student_id()` (active student account + active roster row) | Own published assignments in active classes they're enrolled in; save/submit own answers; own timetable |
| Parent | RPCs, keyed on `private.is_my_child(student)` (active parent + link) | Linked children's assignments (status always; answers once submitted; marks/comments once returned), timetable, consent |
| Admin | RLS + `account-admin` edge function + `admin_record_consent`, `admin_unlink_parent` | Invites, links, consent, account status |

**Family RPCs** (all `security definer`, `search_path = ''`, `execute` granted to `authenticated`, each checks the caller):
`student_assignments()`, `student_assignment(id)`, `student_save_answer(assignment, question, option, text)`, `student_submit(assignment)`, `student_timetable()`, `parent_children()`, `parent_child_assignments(student)`, `parent_child_assignment(student, assignment)`, `parent_child_timetable(student)`, `parent_give_consent(student)`.

They share private builders (`assignments_for_student`, `assignment_view`, `timetable_for_student`) so students and parents see the same data with the same hiding rules:
- **Before return:** no marks, no feedback, no correct options, no explanations.
- **Parents before submission:** status only, not the child's draft answers.

## 5. Edge Function `account-admin` (renamed from `staff-admin`)

Existing actions unchanged (`invite`, `resend-invite`, `cancel-invite`, `set-active`, `reset-two-step`). New:

| Action | Input | Steps | Errors |
|---|---|---|---|
| `invite-student` | `studentId`, `email` | Student active, no account yet, **consent recorded**; e-mail unused. `auth.admin.createUser` with `app_metadata.account_role = 'student'` → link `students.profile_id` (undo on failure) → `inviteUserByEmail` → audit `student_invited`. | `consent_needed`, `already_has_account`, `already_exists`, `invalid_email`, `email_failed` |
| `invite-parent` | `studentId`, `email`, `fullName` | E-mail belongs to a parent → link only (`parent_linked`). Belongs to anyone else → `already_exists`. Otherwise create parent account → link → invite → audit `parent_invited`. | `already_linked`, `already_exists`, `invalid_email`, `invalid_name`, `email_failed` |

The invite e-mail template words itself by `user_metadata.account_role` (staff / student / parent).

## 6. Web App

### 6.1 Routes and layouts

```
portal-root (appearance provider)          login, verify, forgot, confirm, set-password, two-step setup
└─ member-layout (any active account; header + nav by role)
   ├─ /portal (→ home for role), /portal/account (password, appearance, two-step for admins)
   ├─ staff-area  (tutor/admin): dashboard, timetable, classes, assignments, marking, profile
   │  └─ admin-layout: admin home, staff, students (+ /admin/students/:id), activity
   ├─ student-area: /portal/student, /portal/student/assignments/:id, /portal/student/timetable
   └─ parent-area:  /portal/parent, /portal/parent/children/:studentId,
                     /portal/parent/children/:studentId/assignments/:assignmentId
```

Guards (`decidePortalAccess`) gain areas `member`, `student`, `parent`; a wrong-role page shows "You don't have access". Home pages: tutor → `/portal/tutor`, admin → `/portal/admin`, student → `/portal/student`, parent → `/portal/parent`. Two-step stays admin-only.

As built: `member-layout.tsx` guards `member` and draws the header and navigation; `staff-layout`, `admin-layout`, `student-layout` and `parent-layout` each guard their own area and show "You don't have access" to other roles (`AreaOutlet`). Staff pages added: `/portal/assignments/:assignmentId/students/:studentId` (marking one submission) and `/portal/admin/students/:studentId` (the student page). Family timetables reuse the staff week view without class links.

### 6.2 Staff pages (changed / new)

- **Assignment page:** Draft/Published chip; **Publish** / **Unpublish**; **Questions** builder (add, edit, delete, move up/down; MCQ options with the correct one marked; marks; explanation) while in draft; submissions list once published (status, late, score, **Mark** link).
- **Submission page** `/portal/assignments/:assignmentId/students/:studentId`: each question with the student's answer; MCQ right/wrong with auto marks; written answers get marks and feedback; overall comment; **Save** and **Return to student**.
- **Paper homework:** the R3a result cards gain **Returned**.
- **Students (admin):** account and parent columns; **student page** with consent, the student's account (invite / resend / cancel / deactivate), parents (invite or link, remove), classes.

### 6.3 Student pages

- **Home:** To do (start/continue, due chips), Submitted (waiting for marking), Returned (score, comment), progress (completed, average %).
- **Assignment:** instructions, progress bar, one card per question (MCQ radio cards, written text box with counter), autosave per answer ("Saving…" / "Saved"), **Submit** with a confirm that counts unanswered questions; after return: score, per-question marks, correct option, explanation, feedback, overall comment. Paper homework shows "Hand this in to your tutor".
- **Timetable:** the R3a week view with the student's classes.

### 6.4 Parent pages

- **Home:** each child: classes, to-do count, average %, consent prompt if needed.
- **Child page:** progress (completed / assigned, average %, on time), assignments (status, due, mark when returned, comment), timetable.
- **Child assignment:** read-only view of what the child sees (answers once submitted; marks and comments once returned).

### 6.5 Appearance

`lib/theme-mode.ts` (System / Light / Dark, stored in `localStorage` with safe fallbacks) and `PortalThemeProvider` at the portal root: sets `data-portal-theme` on `<html>` while in the portal, builds the MUI theme from that theme's CSS variables (read from a hidden probe element), toggle in the header, choice on the Account page. Dark tokens meet WCAG AA (checked).

As built: the colour tokens in `theme.css` sit under `:root, [data-portal-theme='light']` and `[data-portal-theme='dark']` (plus a new `--color-surface` for cards and dialogs); `theme-contrast.test.ts` checks 14 text/background pairs in both themes from the file itself. The appearance context lives in `lib/appearance-context.ts`; the sign-in captcha follows the theme too. The public site never sets the attribute, and leaving the portal removes it.

## 7. Testing

| Layer | What |
|---|---|
| pgTAP | Role from app_metadata only; family can't act as staff; family has no direct table access; student RPCs (own, published, enrolled, save before submit only, auto-mark, auto-return, nothing hidden leaks before return); parent RPCs (linked children only, status-only before submit, consent); question lock; answer mark limits; totals; return guards; `admin_set_role` refuses family accounts |
| Edge function | invite-student (consent, link), invite-parent (new, link existing, wrong role) |
| Unit | Theme mode, guards for new areas, question checks, solving progress, family progress stats |
| Browser | Admin invites parent and student (Mailpit), parent consents; tutor builds and publishes; student solves in dark mode on a phone and submits; tutor marks and returns; student and parent see results |
