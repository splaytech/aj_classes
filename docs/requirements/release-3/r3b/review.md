# R3b — Verification and Gap Review

> **Date:** 8 Oct 2026. Method as in [R2a](../../release-2/r2a/review.md) and [R3a](../r3a/review.md): spikes first, then requirements, security (OWASP ASVS access control, data protection; children's data), design fit and traceability. Fixes are in the design and stories.

## 1. Spikes (run before designing)

| Spike | Result |
|---|---|
| Create a user with `app_metadata` and invite them | Works: `createUser` stores `app_metadata`; `inviteUserByEmail` then sends the invite to that unconfirmed user. **But the existing trigger made the new user a `tutor`** (F1). |
| Role-specific invite wording | Go template `with` on `.Data.account_role` (verified when the template is built). |
| New enum values | Must be in their own migration file (Postgres can't use a new enum value in the transaction that adds it). |
| Does the insert trigger see `app_metadata`? (run while building) | **No.** Supabase Auth inserts the user with only the provider in `app_metadata`, then saves the given `app_metadata` in an update in the same transaction (F30). |

## 2. Gaps Found and Fixed

| ID | Type | Gap | Fix |
|---|---|---|---|
| F1 | SEC | Every new auth user got a **tutor** profile, so any family invite would have created a tutor. | Role from `app_metadata.account_role` (server-only), default `tutor` (D2). Test: a user-metadata role is ignored. |
| F2 | SEC | `is_active_staff()` was "has an active profile", so students and parents would have staff rights (own-profile edits, photo uploads, class helpers). | Checks `tutor`/`admin` (D3). Tests for each staff helper. |
| F3 | SEC | A staff or parent profile could be linked as a student (or vice versa) by mistake. | Triggers check the linked profile's role. |
| F4 | PRIV | Children's accounts without parental consent. | Consent recorded (parent in portal or admin) before a student invite; audited (D5). |
| F5 | SEC | Direct table reads would leak correct options, draft marks and comments, and RLS can't hide columns per role. | Families use RPCs only; no table policies for them (D4). |
| F6 | SEC | A parent must see only their own children. | `is_my_child()` in every parent RPC; tests with two families. |
| F7 | SEC | Deactivated or archived family accounts keep access. | `my_student_id()` needs an active student profile **and** an active roster row; parents need an active profile; deactivation also bans (R2a). |
| F8 | REQ | A student removed from a class loses sight of that class's assignments, including returned marks. | Accepted for R3b (visibility follows enrolment); listed as a later improvement. |
| F9 | REQ | Editing questions after students answered would make marks unfair. | Questions locked on publish; unpublish only before anyone starts. |
| F10 | SEC | Changing answers after submitting or after return. | `student_save_answer` refuses unless the work is not yet submitted. |
| F11 | REQ | Automatic returns would record the **student** as the marker. | `marked_by` is recorded only for staff. |
| F12 | REQ | Families seeing marks mid-marking. | Marks, feedback, correct options and explanations only after **returned**. |
| F13 | REQ | Unanswered written questions would block returning. | On submit, every question gets an answer row; blank written answers get 0 marks, which the tutor can change. |
| F14 | REQ | Late work. | Allowed; "Late" when submitted after the due date (Melbourne date). |
| F15 | SEC | MCQ answers are stored as an option number; reordering options would change answers. | Options can't change after publish (F9). |
| F16 | SEC | Prompts, answers and comments are free text. | Shown as text only (React escaping, `pre-line`); `react/no-danger` lint. |
| F17 | SEC | Very long answers or rapid autosaves. | Length limits in the database; autosave is debounced; each save is one small update. |
| F18 | PRIV | Parents seeing other people's contact details. | Parents see only their children's names and work; no e-mails or other parents. Students see tutor names only. |
| F19 | PRIV | The public privacy policy doesn't cover family accounts. | New section added to the Privacy page (owner to review wording). |
| F20 | REQ | One invite e-mail for everyone would say "staff portal". | Template words itself by role (staff / student / parent). |
| F21 | REQ | "Staff sign in" on the login page and footer. | "Sign in", for staff, students and parents. |
| F22 | A11Y | Dark colours must stay readable for MUI and CSS-module pages. | Dark tokens in `theme.css`, contrast checked; both kinds of pages read the same variables. |
| F23 | DES | `localStorage` can be unavailable (private mode, blocked). | Wrapped in try/catch; falls back to System. |
| F24 | SEC | Students could self-register. | Sign-ups stay disabled; accounts only via `account-admin` (R2a D1). |
| F25 | REQ | A parent linked to the wrong child by mistake. | Admins can remove links (audited). |
| F26 | REQ | Two parents, or a parent with siblings. | Many-to-many links; an existing parent e-mail is linked, not re-invited. |
| F27 | SEC | Double submit (two tabs). | Submit is refused when already submitted; the second click gets a clear message. |
| F28 | REQ | All-MCQ instant results let students share answers before others finish. | Accepted for R3b; tutors can add a written question to hold results until return. Later: a "hold results" switch. |
| F29 | DES | Several new admin actions. | Added to the audit log (`student_invited`, `parent_invited`, `parent_linked`, `parent_unlinked`, `consent_recorded`). |
| F30 | SEC | Found while building: the profile trigger runs on insert, before Supabase Auth saves `app_metadata`, so D2 alone would still make every family account a tutor. | A second trigger applies `app_metadata.account_role` on update, **only while the account hasn't joined** (never for accounts in use). The edge function also checks the new profile's role and undoes the account if it's wrong. Tests for both paths. |
| F31 | SEC | Found while building: the array checks (`items_within_length`, `items_are_slugs`) ignored null items, so `{null}` passed. | Null items now fail. Test with a null MCQ option. |

## 3. Build Decisions (made while writing the migrations)

| # | Decision |
|---|---|
| B1 | Question positions are set by the database (new questions go last; `move_question` swaps with the neighbour in one statement against a deferrable unique key). At most **50 questions** per assignment (`too_many_questions`). |
| B2 | Results can only be recorded on **published** assignments (`not_published`), and a published assignment can't move to another class once students have work on it (`has_submissions`). New assignments start as drafts, so the R3a tests and seed now publish theirs. |
| B3 | Online work status changes by staff are limited to submitted → returned (`invalid_status`); "marked" is for paper homework only, and paper homework has no "in progress". |
| B4 | The database also refuses to link a student account before consent is recorded (`consent_needed`), not just the edge function. |
| B5 | Locks: changing questions locks the assignment row (serialised with publishing); recording a result takes a share lock on it, so a student's first save and an unpublish can't both succeed. |
| B6 | The local seed creates the family demo data through the real student functions (signed in as Aarav, then as the tutor), so `pnpm db:reset` exercises them too. |

## 5. Build Findings (found and fixed while building and testing)

| # | Finding | Fix |
|---|---|---|
| B7 | The invite e-mail's subject still said "staff portal" for students and parents. | Subject is now "You're invited to the AJ Classes portal" (`supabase/config.toml`); the body is worded by role. **Hosted:** set the same subject when the auth config is pushed. |
| B8 | Students saw "Not started" in the header while answering, and handed-in work still showed "Due soon"/"Overdue". | While answering, the progress bar replaces the status chip; due chips show only for work still to do. |
| B9 | On the student timetable both "My work" and "Timetable" were highlighted (one path is inside the other). | Navigation items can exclude a sub-path that has its own link; `aria-current` is set by the portal, not by prefix matching. |
| B10 | Paper homework a tutor marked without "handed in" has no hand-in time, so "Handed in" showed no date. | The date shows only when there is one. |
| B11 | Dev only: the appearance hook and the provider component were in one module, so a hot reload could create a second React context (the toggle showed the wrong icon until a reload). | The context and hook moved to `lib/appearance-context.ts`. |
| B12 | Dev only: Vitest doesn't load CSS files (they come back empty). | The contrast test reads `theme.css` with `fs` and runs in the Node environment. |
| B13 | Dev only: a file created after the file importing it left a stale "Failed to load url" in the running dev server. | Touching the importing file makes Vite resolve it again (noted in supabase/README.md). |
| B14 | `pnpm db:reset` recreates every local account, so open browser sessions end. | Expected; sign in again (noted in supabase/README.md). |
| B15 | The parent's invite dialog closed before showing which of "invited" or "linked" happened; the student-account message disappeared when the view changed. | Messages are kept by the section, which stays on screen (`announce()` in `usePortalAction`). |

## 4. Traceability

| Story | Design | Tests |
|---|---|---|
| FA1 Consent | §3 students, §4 `admin_record_consent` | DB, BR |
| FA2 Invite parent | §5 `invite-parent`, §4 links | DB, FN, BR |
| FA3 Invite student | §5 `invite-student` (F4) | DB, FN, BR |
| FA4 Roster accounts | §6.2 | BR |
| FT1 Questions | §3 questions (F9, F15) | DB, UNIT, BR |
| FT2 Publish | §3 assignments status | DB, BR |
| FT3 Mark and return | §3 answers/results (F11–F13) | DB, BR |
| FS1–FS3 Student | §4 student RPCs, §6.3 (F5, F10, F12) | DB, UNIT, BR |
| FS4 Appearance | §6.5 (F22, F23) | UNIT, BR |
| FS5, FP1–FP3 | §4 RPCs, §6.4 (F6, F7) | DB, BR |
| FE1 Sign-in | §5 template, §6.1 (F20, F21) | FN, BR |
