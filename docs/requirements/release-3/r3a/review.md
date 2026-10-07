# R3a — Verification and Gap Review

> **Date:** 8 Oct 2026. Same method as the [R2a review](../../release-2/r2a/review.md): requirements, security (OWASP ASVS access-control and data chapters, Supabase traps), design fit, traceability. Gaps were fixed in the design and stories before building.

## 1. Gaps Found and Fixed

| ID | Type | Gap | Fix |
|---|---|---|---|
| H1 | SEC | New tables would get Supabase's broad default grants. | Revoke all, grant only the verbs each role uses (design §4). |
| H2 | SEC | A tutor could move one of their assignments into a class they don't teach, or create one there. | `with check` repeats `teaches_class` on insert and on the updated row. |
| H3 | SEC | A tutor could add marks for a student who isn't in the class (guessing ids). | Trigger refuses `not_enrolled`. |
| H4 | REQ | Marks above the maximum, or marks on feedback-only work, would be accepted. | Trigger refuses `mark_too_high` / `no_marks`; the form checks first. |
| H5 | SEC | `created_by` on assignments could be set to someone else. | Trigger sets it from `auth.uid()`. |
| H6 | SEC | `marked_by` / `marked_at` could be faked, or left stale when status goes back. | Trigger sets them on marking and clears them otherwise. |
| H7 | SEC | A deactivated tutor might still read class data through the new tables. | Every helper requires `is_active_staff()`. |
| H8 | REQ | What does a tutor see for an archived class? | Nothing (hidden like a deactivated class); admins see archives. Documented in AS1. |
| H9 | DES | RLS returns "no row" rather than an error, so pages could show a crash. | Pages show "Not found or you don't have access". |
| H10 | SEC/PRIV | Students are children: collecting more than needed is a privacy risk. | Name and year level only (D1, AS3 AC3). No contacts, birthdays or notes. Fictional names in seed data. |
| H11 | SEC | Instructions and feedback are free text shown on screens. | Rendered as text only (React escaping, `white-space: pre-line`); `react/no-danger` lint already on. |
| H12 | DES | Time zones. | Melbourne wall-clock times (D5); accepted for staff outside Melbourne. |
| H13 | REQ | "Next sessions" would list classes outside their term. | `upcomingSessions` skips dates before `starts_on` and after `ends_on`. |
| H14 | REQ | Reassigning a class to another tutor. | The new tutor sees all past assignments and marks; the old tutor loses access. Marks keep `marked_by`. |
| H15 | REQ | Removing a student from a class with marks. | Marks are kept but hidden from marking pages; re-enrolling shows them again. |
| H16 | REQ | Deleting an assignment deletes all its marks. | Confirm dialog says so. |
| H17 | REQ | Double booking a tutor (overlapping slots in two classes). | Not blocked in R3a; listed as a next idea. |
| H18 | DES | MUI could end up in the public pages' JavaScript. | Only portal routes import it; build check (todo T9.1). |
| H19 | DES | An MUI theme with hex colours in TypeScript would break house rule F1.2. | Theme read from `theme.css` variables at runtime (portal is client-only). |
| H20 | DES | Two people editing the same mark: last save wins. | Accepted (small team). |
| H21 | DES | Unbounded lists. | Activity capped at 500 rows; other lists are small for one tutoring business. |
| H22 | A11Y | Colour-only status, dialogs, tables. | Chips always show text; MUI dialogs trap focus; tables have header cells; tabs and pickers are keyboard-accessible. |
| H23 | DES | Wide tables and the week grid on phones. | Tables scroll inside their container; the timetable switches to day tabs below the `md` breakpoint. |
| H24 | SEC | Admins without two-step. | Same as R2a: `is_admin()` needs `aal2`; the guard sends them to setup. |
| H25 | OPS | Edge functions need the CLI-started runtime; the CLI was broken. | CLI reinstalled; README notes the runtime and `pnpm test:functions`. |
| H26 | REQ | A class can point at a tutor who was later deactivated. | Tutor picker lists active staff only; the classes list flags "Tutor inactive". |
| H27 | REQ | Year level for university courses. | `null` year level, shown as "Other (e.g. UCAT, GAMSAT)". |
| H28 | REQ | Class subjects use the placeholder subject list (R2a Q1). | Same `SUBJECTS` keys; renaming labels needs no migration. |
| H29 | OPS | Demo data must never reach staging or prod. | Only in `seed.sql`, which `db push` never runs. |
| H30 | SEC | Changes to classes, students and assignments aren't in the audit log. | Accepted for R3a (audit log covers access changes); `updated_at`, `created_by`, `marked_by` give a basic trail. Next idea. |

## 1.1 Found While Building and Testing (8 Oct)

Everything below was found by the database tests, the HTTP test script or the browser walkthrough (tutor and admin, desktop and phone width), and fixed or recorded before ticking the todo item.

| ID | Finding | Fix |
|---|---|---|
| B1 | The column grants deliberately leave out `id`, so clients can't choose ids. The first database tests inserted explicit ids and failed. | Kept the grants; tests insert without ids, plus a new test that choosing an id is refused. |
| B2 | Rows left in the local audit log by manual testing broke two database tests that assumed it was empty. | The test helper clears the audit log (and accounts) inside each test's rolled-back transaction. |
| B3 | The invite dialog said "Please enter **your** e-mail" for someone else's address. | Its own wording ("their e-mail"). |
| B4 | The student search showed "Mia Demo (Other (e.g. UCAT, GAMSAT))". | "Name · year" format. |
| B5 | On phones the sideways-scrolling nav could hide the current page's link. | The active link scrolls into view on each page. |
| B6 | The Material UI code for staff pages is one 530 KB chunk (about 150 KB compressed). | Accepted: only staff pages load it, once; public pages load none of it (checked). Splitting it is a later optimisation. |
| B7 | In development, the first visit to a page that uses a new Material UI part makes Vite reload once while it prepares the package. | Development only; noted in the README. |
| B8 | When a tutor opens an admin address, the admin page's data request still runs and is refused (a red 403 in the browser console) while the page correctly shows "You don't have access". | Accepted: harmless, the database refuses it. Could skip the request when the role is known (later tidy-up). |
| B9 | Automated typing into the date and time pickers needs real key presses; a script inserting text doesn't fill them. | Testing note only: people typing or using the calendar popup work (checked with key presses). |

## 2. Traceability

| Story | Design | Tests |
|---|---|---|
| TS1 Timetable | §3 `class_sessions`, §4, §5.1, §5.5 | DB, UNIT, BR |
| TS2 My classes | §4, §5.1 | DB, BR |
| TS3 Set homework | §3 assignments, §4 (H2, H5) | DB, UNIT, BR |
| TS4 Mark homework | §3 results + trigger (H3, H4, H6) | DB, UNIT, BR |
| TS5 Assignments overview | §5.5 `dueState`, `markingProgress` | UNIT, BR |
| TS6 Tutor dashboard | §5.5 `upcomingSessions` (H13) | UNIT, BR |
| AS1–AS2 Classes and slots | §3, §4, §5.3 dialogs | DB, UNIT, BR |
| AS3–AS4 Students and enrolments | §3, §4 (H10, H15) | DB, BR |
| AS5–AS6 Admin timetable and dashboard | §5.1 | BR |
| AS7 Admin teaches | §4 (`is_admin`) | DB, BR |

## 3. Next Ideas (not in R3a)

- One-off session changes (cancel, reschedule, extra lesson) and attendance.
- Double-booking warning when adding a slot (H17).
- Audit trail for class, roster and marking changes (H30).
- Student and parent accounts, submissions with files, "Returned" status (R3).
- Communities and join requests on top of `classes` (R4).
