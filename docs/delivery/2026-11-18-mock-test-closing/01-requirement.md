# Mock tests: deactivate (closing) and categories

Stage 1 (Product Owner) of `/deliver`. Branch `feature/mock-test-closing`. Date 18 Nov 2026. Round 2, after `review-1.md` and rulings S-1 and S-2 (`00-decisions.md`). Builds on the mock tests v1 as built (`docs/delivery/2026-11-17-mock-tests/`).

Numbering: AC numbers in this file are local to it. "AC 19" with no file name means `docs/delivery/2026-11-17-mock-tests/01-requirement.md`.

## Saurabh's words, verbatim

1. "there should be an expiry as well, or way to deactivate test so its not visible to anyone anymore" (earlier in the same thread).
2. "along with deactivate, there should be category as to what subject and which grade and what stream of education as in VCE/NAPLAN etc the test belongs to so its easy for users to filter out based on those tags."

## Scope and release

- **Part A, deactivate (ACs 1 to 9):** closing date and "Close now". Being built now by the Dev Lead. The rule for takers after closing is Saurabh's S-1 (AC 5).
- **Part B, categories (ACs 10 to 29):** subject, stream and year level on each test, and filters on the taker list.
- **v1 is the web portal only.** The mobile app is out (2026-11-17 M1, D-B10).
- **Deferred items** are named at the end of each part. Nothing is silently dropped.

## Part A: deactivate and expiry

### User story

- **US-A8: Close.** As an admin, I want to close a mock test now, or on a set date and time, so that takers who have not submitted it can no longer see it. Outcome: takers with no submitted attempt see nothing; takers who submitted keep their result (AC 5).

### Model

- One nullable column, `mock_tests.closes_at timestamptz`.
- A released test is **open** while `closes_at` is null or in the future, and **closed** from `closes_at` on.
- A closed test is visible to a taker only if that taker has a submitted attempt on it (AC 5). For everyone else it is as if it does not exist.
- "Close now" sets `closes_at` to the server's `now()`. Expiry and deactivation are therefore the same state.

### Acceptance criteria

1. When releasing, an admin can optionally set a closing date and time, which must be in the future. Leaving it empty means the test never closes.
2. On a released test, any admin can set, change or clear the closing date and time. A new date must be in the future.
3. On an open released test, any admin can **Close now** after a confirmation. This works even when attempts have been submitted, unlike take-back.
4. Reopen [ASSUMPTION]: on a closed test, an admin can clear the date or set a future one, and the test is open again. Reopening brings every in-progress attempt back as it was: answers kept, nothing deleted, and the person can carry on.
5. From closing time, Saurabh's rule (S-1, 18 Nov 2026, verbatim: "Yes if someone has submitted they should be able to see, but if someone has not submitted they should not be able to see."):
   1. **A taker who submitted before closing** still sees the test in their list, marked Closed, and can open their result: score, their answers, the correct answers and explanations ([ASSUMPTION, D-2 carried]). They can't start again. The result read is not gated by closing. The filters (AC 20) apply to this test too.
   2. **A taker with no submitted attempt**, never started or still in progress, doesn't see the test in their list. A direct link shows the same "not found" message as now.
   3. An in-progress attempt can't save or submit (`not_found`, HTTP 404). [ASSUMPTION] It is never auto-submitted.
6. Admins still see closed tests. [ASSUMPTION: admins keep seeing closed tests in the admin list so they can reopen them.]
   1. The admin list shows "Closed" and the date;
   2. an open test with a date shows "Closes <date, time>";
   3. the questions stay frozen, exactly as for a released test.
7. Take-back to draft follows L-5 of 2026-11-17 and applies to closed tests too. It is allowed only while no attempt is submitted. It deletes in-progress attempts and their answers, and clears `closes_at`. Once any attempt is submitted, take-back is refused and the admin sees a plain message saying why.
8. A closed test is never shown to a taker without a submitted attempt, even if the page is open across the moment it closes. The database decides on every call (AC 5).
9. Dates show in the app's existing date format and time, `formatDateTime` in `apps/web/src/lib/format.ts` ("8 Oct 2026, 4:05 pm"), in the viewer's local time. No new time-zone setting.

### Limits (Part A)

- New migration only. `20261118100000_mock_tests.sql` is already applied to the hosted database and must not change.
- Writes go only through security-definer functions. `closes_at` is never column-granted to `authenticated`. Same gates as release: admin at aal2, and the test row locked `for update`.
- No e-mail and no scheduled job: closing is decided at read time.
- The closing database tests (`mock_tests_closing.test.sql`) check AC 5 as written (S-1), including the result read for a submitted attempt.

### Deferred (Part A)

- **D-A1** An archive or hide view in the admin list.
- **D-A2** Notifying takers before a test closes.
- **D-A3** An opening date (scheduled release).

## Part B: categories and filters

### User stories

- **US-C1: Tag.** As an admin, I want to tag each mock test with its subject, stream and year level, so that takers can find it. Outcome: every released test carries all three tags.
- **US-C2: Tag older tests.** As an admin, I want to tag released tests made before this feature when I next edit them, so that they can be filtered too. Outcome: an old test gets tags only when an admin saves them. Nothing tags it automatically.
- **US-F1: Filter.** As a student, parent or signed-up user, I want to filter the mock test list by stream, subject and year level, so that I can quickly find the tests for me. Outcome: a shorter list, and a clear message when nothing matches.

### Choice lists

10. **Subject.** One choice from `SUBJECTS` in `apps/web/src/constants/subjects.constants.ts`, labels as written there: Maths, English, Science, Reading, Writing, Numerical reasoning, Verbal reasoning. "Interview preparation" is not offered for mock tests. [ASSUMPTION C1, decided S-2]
11. **Stream.** One choice from six programmes in `apps/web/src/constants/programmes.constants.ts`, shown with the programme's `menuLabel`: VCE Tutoring, NAPLAN, Selective Entry Exam, SEAL and Scholarships, ICAS, Maths, Science and English. The stored value is the programme's slug (`vce`, `naplan`, `selective-entry`, `seal-and-scholarships`, `icas`, `maths-science-english`). Not offered: Interviews and VCE Subject Selection (not MCQ tests), and UCAT and GAMSAT (see D-C5). [ASSUMPTION C3, decided S-2]
12. **Year level.** One or more of Year 2 to Year 12 (`YEAR_LEVELS` in `apps/web/src/constants/app.constants.ts`, labels from `YEAR_LEVEL_TEXT.label` in `apps/web/src/constants/portal.constants.ts`), or **Any year** (`YEAR_LEVEL_TEXT.any`). Choosing Any year clears the other years, and choosing a year clears Any year. The "none means any year" rule of the class form (`CLASS_DIALOG.hints.yearLevel`) is not reused: a test always has an explicit Any year. The "Other (e.g. UCAT, GAMSAT)" option (`YEAR_LEVEL_TEXT.other`) is not offered. [ASSUMPTION C4]

### Setting tags

13. While a test is a draft, an admin can set, change or clear each tag in the create and edit dialogs. A draft can be saved with no tags.
14. Release is refused until the test has a subject, a stream and a year level (Any year counts as set). The database enforces this rule. The release control says which tag is missing, the same way it does for zero questions (AC 17 of 2026-11-17). [ASSUMPTION C5, decided S-2]
15. On a draft, a released test, or a closed test, an admin can set a tag that is missing, or change a tag to another valid choice. A tag on a released or closed test can't be cleared. Changing tags does not change the title, instructions, questions or options, which stay frozen (an exception to AC 19 of 2026-11-17, for the three tag fields only). Changing tags never changes or resets an attempt or its answers. Untagged old tests stay untagged until an admin sets their tags (AC 18). [ASSUMPTION C6, decided S-2]
16. A tag write is accepted only when the value is in the current lists in ACs 10 to 12: a subject from the list, a stream from the list, or years 2 to 12 or Any year. Any other value is refused with a field-level message, and nothing is saved. The database must refuse values outside the current lists. Where the database holds its copy of the lists is for the Architect to decide. A value already stored and later removed from a list is handled by AC 27.
17. Take-back to draft keeps the tags. Closing and reopening (Part A) do not change them.

### Released tests made before this feature

18. A released test made before this feature has no tags. Until an admin sets them (AC 15), it stays in the taker's unfiltered list (it is never hidden for lacking tags), shows "Not set" for each missing tag in the admin list and the taker list (AC 23), and is shown only when no filter is set. Any filter that is set leaves it out. [ASSUMPTION C7]

### Taker filter

19. The taker list has three filter controls, labelled **Stream**, **Subject** and **Year level**. The Subject and Year level labels are those already used in `CLASS_DIALOG.labels` (`portal.constants.ts`). Each control is a single choice with **All** first. Stream and Subject offer the choices from ACs 10 and 11. Year level offers Year 2 to Year 12 only. [ASSUMPTION C8]
20. Filters combine with AND. A test is shown only if it matches every filter that is set. A Year level filter matches a test tagged with that year, and also a test tagged Any year. These rules apply equally to a closed test the person has submitted (AC 5, item 1).
21. With all three filters on All, every test the person can see is shown: every open released test they can take, every closed test they have submitted (AC 5), and including untagged tests (AC 18).
22. Two empty states, kept apart:
    1. (a) When the person has no test to see at all, the list shows "No mock tests yet." (`MOCK_TESTS_LIST.empty` in `mock-tests.constants.ts`). No filter control is needed for this state.
    2. (b) When one or more filters are set and match nothing, the list shows "No mock tests match these filters." and a **Clear filters** control that sets all three back to All. This is not an error and shows no raw text.
23. Each row in the taker list shows its subject, stream and year level (Any year is shown as such), so the person can see why a test matched. A missing tag shows "Not set" in its place.
24. Filter settings belong to the page. They are not saved, and they reset on a page reload. [ASSUMPTION C9]
25. Filters change only what the list shows. They don't change who can see or take a test. The access rules of 2026-11-17 (AC 3 to 6) and Part A (AC 5 and 8) still decide that.
26. The filter controls and tags have visible labels, can be reached and used with a keyboard, and work at 375 px and 1280 px wide in light and dark appearance. This mirrors AC 43 and 44 of 2026-11-17.
27. Every new label comes from the portal constants files (house rule, AC 40 of 2026-11-17). A value removed from a list later is hidden from the choices. A test that already holds it keeps it and shows it by its saved label, or by its key if it has no label. The admin must pick a current value the next time that field is edited. The taker filters offer only current values. This matches how `SUBJECTS` already treats removed entries for tutor profiles.

### Admin list

28. The admin list shows the three tags for each test, and "Not set" for any missing tag. The admin list has no filter in v1 (see D-C3). [ASSUMPTION C10]

### Public and messages

29. Tags and filters appear on no public page, in no sitemap entry and in no e-mail. This follows assumptions M13 and M14 of 2026-11-17.

### Assumptions (Part B, each one cheap to flip)

- **C1 Fixed lists in constants, not admin-managed.** Decided S-2 (decision 1): the subject list is the existing `SUBJECTS` constant with "Interview preparation" removed, as the working answer stated. A new table or an admin-managed list is more than the smallest slice needs. The `subjects.constants.ts` note says that list is a placeholder pending owner review; if it changes, the mock test choices change with it.
- **C2 One subject and one stream per test.** Saurabh wrote "what subject ... the test belongs to" and "what stream". A test that spans two subjects or streams is a later release (D-C2).
- **C3 Streams come from the programmes.** Decided S-2 (decision 3). Saurabh's examples map to the programme menu labels: "Scholarship" becomes "SEAL and Scholarships" and "General" becomes "Maths, Science and English", because those are the names the site already uses.
- **C4 One or more years, with an explicit Any year.** A test may fit several year levels. "Any year" is a choice, not an empty field, so "not set" and "any year" never look the same.
- **C5 Required at release, optional in draft.** Decided S-2 (decision 4): subject, stream and year level must all be set before release. This keeps a released test always findable by the filters.
- **C6 Tags editable on released and closed tests.** Decided S-2 (decision 5). Tags only decide where a test is listed, not what it asks, so they can be corrected after release. This is an exception to 2026-11-17 AC 19, for the three tag fields only.
- **C7 Old released tests.** They are not hidden and not re-dated. They appear only with no filter set, until an admin tags them.
- **C8 Filter controls are single-choice selects.** The filters are AND across the three controls. Year level matches a test that has that year or Any year. An empty filter (All) shows everything the person can see.
- **C9 Filters are not remembered.** A reload resets them. This keeps v1 small; remembering them is a later release (D-C6).
- **C10 Admin list shows the tags and no filter.** An admin list of tests is short in v1; filtering it is a later release (D-C3).

### Limits (Part B)

- New migration only, after the existing ones. Do not edit `20261118100000_mock_tests.sql` or any other migration already applied to the hosted database.
- Tags are written only through the same security-definer write path and gates as release (admin, aal2).
- The three tag fields are the only new columns in Part B. `closes_at` belongs to Part A. Tests are not linked to classes, enrolments, assignments or due dates (2026-11-17 R-6, D-B14).

### Deferred (Part B)

- **D-C1** Pre-filter the list by the student's own year level. `students.year_level` exists, but parents and signed-up users have no year level.
- **D-C2** More than one subject or stream on a test.
- **D-C3** A filter on the admin list.
- **D-C4** VCE subject names as subject choices (Chemistry, General Mathematics, Mathematical Methods, Psychology, Business Management). Decided S-2 (decision 2): not in v1. VCE tests use the general subjects in AC 10.
- **D-C5** UCAT and GAMSAT as a stream. They are not school year levels, and no mock test exists for them yet.
- **D-C6** Choosing more than one value in a filter (for example Year 5 or Year 6), and remembering filter settings.
- **D-C7** Tags and filters in the mobile app (D-B10).
- **D-C8** Tags on classes or assignments.

## Decisions

### Decided by S-2 (moved into the assumptions above)

- Former decision 1, subject list: C1.
- Former decision 2, VCE subjects: D-C4 (general subjects only in v1).
- Former decision 3, stream labels: C3.
- Former decision 4, required at release: C5.
- Former decision 5, tags on released tests: C6.

### Answered

- Former decision 7, closing and the taker's own result: S-1, AC 5.

### Ruled by the team lead

6. **Hosted data, ruled:** nobody needs to look. AC 18 handles old untagged tests whether any exist or not.
