# 01 — Requirement: mock test scoring (marks, pass mark, percentage, admin results)

Stage 1 (Product Owner) of `/deliver`. Branch `feature/mock-test-scoring` (cut from `develop` 0903f06). Date 18 Nov 2026. Round 2, after `review-1.md` and the team-lead rulings L-1 to L-6 (`00-decisions.md`). Builds on mock tests v1 (`docs/delivery/2026-11-17-mock-tests/`) and closing and categories (`docs/delivery/2026-11-18-mock-test-closing/`, merged). Read-only on code; this is the only file written.

Numbering: "AC n" with no file name means `docs/delivery/2026-11-17-mock-tests/01-requirement.md`. "Here AC n" means this file. "Closing AC n" means `docs/delivery/2026-11-18-mock-test-closing/01-requirement.md`. "Q n" is a decision in the list at the end. "D-S n" is a deferred item. "L-n" is a team-lead ruling in `00-decisions.md`.

## Saurabh's words, verbatim

- Question: "how do i set scoring as well in mock tests?"
- Instruction: "do 1-4"

The four options he was asked about, as offered by the Product Owner (quoted exactly):

1. Marks per question: each question gets 1 to 100 marks, the same as assignments already do, and the result shows "34 of 50 marks". This one is small, because the question editor and database already have the pattern from assignments.
2. Pass mark: set a pass percentage per test, so the result shows Pass or Not yet next to the score.
3. Percentage on the result: show "68%" alongside the score. Display only, no settings.
4. Admin sees results: a per-test table of who submitted and their scores. This was deferred in v1 (D-B7). It's the biggest of the four, because it adds a privacy question (whose results tutors and admins can see).

[ASSUMPTION SC1] "do 1-4" means build all four options in this slice. Option 4 is built in the smallest, most private form that still works (here ACs 28 to 39). Anything beyond that form is named under "Deferred".

## What exists today (checked in the repo)

1. **Scoring.** Every mock question is worth 1 mark. `mock_submit` (`supabase/migrations/20261118100000_mock_tests.sql`, around line 611) counts correct answers; unanswered counts as incorrect. The attempt stores `score` and `total` (smallint, question count).
2. **Result wording.** "N of M correct" (`MOCK_RESULT.score`, `apps/web/src/constants/mock-tests.constants.ts`, line 260).
3. **No marks column.** `mock_test_questions` has no marks. Released questions are frozen by trigger (`check_mock_question`), which refuses any change when the test status is not draft.
4. **Admin privacy today.** The admin list returns no taker names, answers or scores; it returns only the creator's name (`created_by_name`) (2026-11-17 AC 24, M10). Admins see counts and the creator's name only (AC 37).
5. **Assignments pattern.** `marks smallint not null default 1 check (marks between 1 and 100)` on assignment questions (`20261007090320_student_parent_portal.sql`, line 404). Limits `QUESTION_LIMITS.marksMin = 1`, `marksMax = 100` and the "Marks" label (`apps/web/src/constants/online-assignments.constants.ts`, lines 9, 10, 98). Totals read "Total 1 mark" / "Total N marks" (line 62). Marks are whole numbers.
6. **No pass mark anywhere.** Nothing in the repo sets or shows a pass mark for assignments or mock tests.
7. **Closing and tags are live.** `closes_at` (closing Part A) and the three tag fields (Part B) can change on released tests. Questions, options, title and instructions cannot (2026-11-17 AC 19, with the Part B tag exception only).

## Assumptions (lead reading, overrulable)

- [ASSUMPTION SC2] **Marks** are whole numbers from 1 to 100 per question, the same limits as assignments. Default 1, so an existing question keeps today's meaning.
- [ASSUMPTION SC3] **Marks and pass mark freeze at release**, like questions and options (ruled L-3, Q3). A score is worked out once, at submit, from the frozen marks and key. A mistake means a new test (the same rule as R-3 of 2026-11-17). Not part of the Part B tag exception.
- [ASSUMPTION SC4] **Pass mark** is one optional whole percentage per test, from 1 to 100. Blank means no pass mark, and then no Pass or Not yet label appears anywhere. Zero is refused, because it would pass everyone. (Ruled L-4, Q7.)
- [ASSUMPTION SC5] **Percentage is rounded down** to a whole number: 2 of 3 shows 66%. Rounding down makes the shown figure and the Pass decision agree exactly: because the pass mark is a whole number, "shown % is at least the pass mark" is the same as "exact % is at least the pass mark". Nearest-whole rounding would show "60%" for 59.6% and still say Not yet. (Ruled L-4, Q6.)
- [ASSUMPTION SC6] **Wording.** "N of M marks" replaces "N of M correct" for every test, including old tests whose marks are all 1. "Correct" is false once marks differ. The old numbers stay true: each old question is 1 mark. (Ruled L-4, Q4.)
- [ASSUMPTION SC7] **Pass and Not yet** are the labels Saurabh saw in option 2. They are practice-only results: no certificate or credential attaches (same spirit as 2026-11-17 ruling L-6). (Ruled L-4, Q7.)
- [ASSUMPTION SC8] **Admin results view (option 4), privacy-minimum form:** only admins can open it (role `admin`, aal2, the same gate as the other admin pages; here AC 36). Tutors, parents, students and signed-up users can't see anyone else's result. The view lists submitted attempts only, one row per person, with the taker's full name, the submit time, score in marks, percentage and Pass / Not yet. It shows **no answers**, no e-mail address and no in-progress attempts. Names are shown (ruled L-1, Q1).
- [ASSUMPTION SC9] **Per-question marks on the result.** After submit, each question shows the marks earned out of its marks, next to the correct option and explanation already shown (2026-11-17 AC 32). (Ruled L-5, Q5.)
- [ASSUMPTION SC10] **Start page.** Before Start, the test shows its number of questions and total marks, and its pass mark when one is set. None of this shows a score or an answer.
- [ASSUMPTION SC11] **Scores are never recalculated.** No admin action changes a submitted score. There is no regrade and no reset of a submitted attempt in v1.
- [ASSUMPTION SC12] Mobile stays out (2026-11-17 M1, D-B10). No e-mail or push about a result (2026-11-17 M14).
- [ASSUMPTION SC13] **Marks are visible to takers before submit.** Each question on the question page shows its marks, as assignments do. The marks are what the question is worth, not a result. This adds a line to the question page, so it amends 2026-11-17 AC 28 (which lists the prompt and options only). Cut if it conflicts with anything Saurabh wants; nothing else in the approved docs conflicts with it (2026-11-17 AC 33 covers score and answers, not marks).

## User stories

**Admin (US-SA)**

- **US-SA1: Marks.** As an admin, I want to give each question its own marks (1 to 100), so that harder questions count for more. Outcome: a test's total marks is the sum, and the result reads "N of M marks".
- **US-SA2: Pass mark.** As an admin, I want to set an optional pass percentage on a draft, so that takers see whether they passed. Outcome: the pass mark is fixed when the test is released.
- **US-SA3: Results.** As an admin, I want to see who has submitted a test and what they scored, so that I can follow up. Outcome: a per-test table of submitted attempts. No answers, no in-progress attempts, and no changes from this page.

**Student, parent and signed-up user (US-ST)**

- **US-ST1: Know the test.** As a taker, I want to see the marks for each question, the total marks and the pass mark (if any) before I start, so that I know what I am aiming for.
- **US-ST2: Know my result.** As a taker, I want to see my score in marks, my percentage and Pass or Not yet after I submit, so that I know how I did. Outcome: the same result in the list and on the result page.
- **US-ST3: My own result only.** As a taker, I want my result kept private, so that no one else's score is shown to me. Parents see only their own attempts (2026-11-17 M18, D-B1).

**Tutor (US-T)**

- **US-T1.** Tutors still have no access to mock tests and no results view (2026-11-17 M2, AC 7). This feature adds nothing for tutors (ruled L-2, Q2).

## Answers to the questions Saurabh's ask raised

**How existing tests and submitted attempts behave.** Existing questions become 1 mark each. Released tests keep their questions, have no pass mark, and show "N of M marks" with the same numbers. Submitted attempts keep their stored score and total untouched (here ACs 41 to 43). Nothing is re-scored.

**Whether marks and the pass mark can change after release.** No (SC3, ruled L-3). Marks, like the correct option, are frozen by the release. The pass mark is frozen too. Closing and the Part B tags keep their own rules and don't touch marks or pass mark.

**What the taker sees before submitting.** The total marks, number of questions and the pass mark if one is set (here AC 11). Each question shows its own marks (here AC 10, SC13). No score, percentage, Pass or Not yet, and no correct option before submit (here AC 12).

**How a closed test, an in-progress attempt and a legacy attempt appear in the admin results table.**
- **Closed test:** its results table still opens for admins, with the closed label and its rows unchanged (here AC 32). Closing never removes a row (closing Part A, S-1).
- **In-progress attempt:** not listed. It has no score yet, and the table is for submitted work only (here AC 33).
- **Legacy attempt** (submitted before this feature): listed like any other row, with its stored score and total, its percentage, and no Pass label, because legacy tests have no pass mark (here AC 31).

**How a closed test looks to a taker** (the closing ruling S-1, which this file had left out in round 1): a submitted taker keeps the result (here AC 25); a taker with no submitted attempt sees nothing (here AC 26).

**Who can see results (option 4's privacy question).** Admins only, names shown, no answers (SC8, ruled L-1 and L-2). Tutors, parents, students and users see only their own result (here AC 38). Tutors have no route in (here AC 37).

## Scope

### In v1 (web portal)

- Marks per question, on create and edit of drafts (option 1).
- Optional pass mark per test, set on drafts, frozen at release (option 2).
- Percentage on the result and in the list after submit (option 3).
- Admin results view: submitted attempts only, admins only, names, scores, no answers (option 4, privacy-minimum form).
- Per-question marks on the question page and on the result (SC13, SC9), start-page totals and pass mark (SC10).
- **Moved into v1 from 2026-11-17 D-B6** (per-question marks and weighted scoring). This amends 2026-11-17 M9 ("each question is worth 1 mark") and 2026-11-17 AC 32 (the "N of M correct" wording). See R-S2.
- The submitted-taker view of closed tests (here ACs 25 to 27), because closing S-1 makes it part of the closed-test rule.

### Deferred (named, not dropped)

- **D-S1 Results export (CSV)**, part of 2026-11-17 D-B7.
- **D-S2 Individual answers for admins** (which option each person chose), 2026-11-17 D-B7 and privacy.
- **D-S3 Changing a score, regrading or resetting** a submitted attempt.
- **D-S4 Changing marks or pass mark after release**, with recalculated labels. Needs a rule for old results first (ruled L-3 freezes them for now).
- **D-S5 More than one pass level** (distinction, credit) and letter grades.
- **D-S6 Results to parents of a student** (2026-11-17 D-B1). Parents see their own attempts only.
- **D-S7 Results or pass alerts by e-mail** (2026-11-17 D-B9).
- **D-S8 Admin results filter** by subject, stream or year (2026-11-18 D-C3).
- **D-S9 Mobile results** (2026-11-17 D-B10).
- **D-S10 Retake and best-score rules** (2026-11-17 D-B5).
- **D-S11 Tutor access to results** (ruled L-2: no for now; widen later on request).

## Acceptance criteria

Each one is written so Tester can check it in the browser or with a database test. "Here AC n" refers to this file.

### A. Marks (admin)

1. Each question has marks: a whole number from 1 to 100. A new question defaults to 1 mark (SC2). Limits come from `QUESTION_LIMITS.marksMin` and `marksMax` (1 and 100).
2. The question editor has a "Marks" field. A blank, zero, negative, decimal or above-100 value is refused with a field-level message from the constants, and nothing is saved.
3. Marks can be set and changed only while the test is a draft. On a released or closed test the marks control is **not shown** in the editor, and a direct write is refused by the database (SC3).
4. The admin edit view shows the test's total marks, the sum of its questions' marks, next to the question count.
5. A test can still be released only with at least one question (2026-11-17 AC 17). Marks add no other release rule.

### B. Pass mark (admin)

6. On a draft, an admin can set a pass mark: a whole percentage from 1 to 100, or leave it blank for no pass mark (SC4). The control sits in the create and edit dialogs.
7. A pass mark of 0, a decimal, a negative value, or a value above 100 is refused with a field-level message from the constants, and nothing is saved.
8. Releasing does not require a pass mark. A released test with no pass mark shows no Pass or Not yet label anywhere (here AC 20).
9. On a released or closed test, the pass mark is shown in the edit view but is **not editable**: the control is not shown, and a direct write is refused by the database (SC3).

### C. Taker: question page and start page

10. On the question page, each question shows its marks: "1 mark" or "N marks", with the same wording the assignments use (SC13). This is shown before submit.
11. Before Start, the start page shows the number of questions, the total marks, and the pass mark when one is set, for example "Pass mark: 60%" (SC10). It shows no score, answer or result.
12. Before submit, no score, percentage, Pass or Not yet label, or correct option is shown anywhere (2026-11-17 AC 33 still holds). The marks in here AC 10 are what a question is worth, not a result.

### D. Score and percentage (taker)

13. The score is the sum of the marks of the questions answered correctly. An unanswered question adds 0 marks (2026-11-17 M9, unanswered counts as incorrect). The score is stored at submit.
14. The percentage is the score divided by the total marks, times 100, rounded down to a whole number (SC5). Examples: 2 of 3 is 66%; 0 of 5 is 0%; 5 of 5 is 100%.
15. After submit, the result reads "N of M marks" (SC6, which replaces 2026-11-17 AC 32's "N of M correct"), with the percentage next to it, in the list and on the result page.
16. The percentage is shown with no grade, band or colour that implies a grade (SC7, D-S5).
17. A released test always has total marks above zero, because it has at least one question of at least 1 mark. The percentage is always defined.

### E. Pass result (taker)

18. For a submitted attempt on a test with a pass mark, the result is **Pass** when the score times 100 is at least the pass mark times the total marks (exact comparison). Otherwise it is **Not yet** (SC4, SC5). Both words come from the constants.
19. The Pass or Not yet label appears next to the score, on the result page and in the list after submit.
20. On a test with no pass mark, no Pass or Not yet label appears anywhere (here AC 8). The percentage still shows (here AC 15).
21. Boundary check: 3 of 5 against a pass mark of 60 shows Pass (60%). 59 of 100 against a pass mark of 60 shows Not yet (59%).

### F. Result detail (taker)

22. Each question on the result shows the marks earned out of its marks, for example "2 of 3 marks", alongside the correct option and explanation (2026-11-17 AC 32, SC9).
23. For every submitted attempt, old and new, the per-question marks earned add up to the score shown in the list (here AC 15).
24. While a test is open, a second submit does nothing and shows the same score, percentage and label (2026-11-17 AC 31). A closed test's rule is in here AC 27.

### G. Closed tests (taker)

25. **Submitted taker, test closed (closing AC 5.1, S-1).** The test stays in the taker's list, marked Closed, with score in marks, percentage and the Pass or Not yet label. The person can open the result and see the score, the per-question marks, the correct options and explanations (closing AC 5.1, SC9). They can't start again.
26. **Taker with no submitted attempt, test closed (closing AC 5.2 and 5.3).** The test is not in their list. A direct link shows the existing not-found message. Save and submit are refused with not-found, so an in-progress attempt can't be finished after closing.
27. **Repeat submit after closing (closing ruling L-2).** A submitter's repeat submit on a closed test returns not-found, and their result still opens. This overrides here AC 24 for closed tests only.

### H. Admin results view

28. An admin can open a Results view for any test from the admin list, including a draft (which shows the empty message in here AC 34) and a closed test (here AC 32). Access is the gate in here AC 36.
29. The view shows only submitted attempts, one row per person (SC8). Columns, in this order: taker's full name, submitted (date and time, `formatDateTime`), score in marks, percentage, and Pass, Not yet or no label (here AC 20).
30. If a person has no full name on their profile, the name cell shows a fallback from the constants, for example "Name not set". It never shows an e-mail address in its place.
31. A legacy attempt (submitted before this feature) appears like any other row, with its stored score and total, and its percentage computed as in here AC 14. Its label is blank, because its test has no pass mark (here AC 20).
32. A closed test's Results view still opens for admins, and its rows are the same as before closing. The closed label shows on the test in the admin list (closing Part A AC 6).
33. The view lists no in-progress attempts. For each test, the submitted count in the admin list (2026-11-17 AC 23) equals the number of rows in the view.
34. Rows are ordered by submit time, newest first. A test with no submitted attempt shows "No one has submitted this test yet." from the constants.
35. The view shows no answers per question, no e-mail addresses, and no write controls. An admin can't change, reset, delete or regrade any row from it (SC11).
36. **Mechanism for staging (ruled L-6, Q8).** There is no feature flag and no dark launch. The Results view and its database function go live with staging, and access is the admin gate: role `admin` at aal2, the same check as every admin function (`private.is_admin()`). A signed-in admin without aal2 is refused. Admin-only access on the shared hosted database is accepted for staging in writing (L-6). The merge to `main` is gated by the Privacy Policy line in Q8.
37. **Negative checks.** A tutor, parent, student or signed-up user (role `tutor`, `parent`, `student` or `user`, all active) who opens the Results view's URL sees the existing "not allowed" page. A direct call to the Results function from any of those four roles is refused with the same not-allowed error as the other admin functions, and returns no data. Tester checks each role separately.
38. Each taker sees only their own score, percentage and label. No taker sees another person's result on any page, in any list or in any response (2026-11-17 AC 37 for takers). A parent sees only their own attempts, not a child's (2026-11-17 M18).
39. The admin list (2026-11-17 AC 23 and AC 24) still shows no taker name and no score. Names and scores appear only in the Results view. This amends 2026-11-17 AC 24 and AC 37 for admins, and moves D-B7 into this release in the limited form in SC8 (Q1).

### I. Existing tests and attempts

40. The migration gives every existing mock question 1 mark. It changes no other data, and it does not edit any already-applied mock migration.
41. Every submitted attempt that exists before the migration keeps its stored score and total unchanged. Checked by a before-and-after comparison of every attempt's score and total: no difference.
42. Every existing submitted attempt shows the same numbers after the change: its score and total read as "N of M marks", with the same N and M that "N of M correct" showed before (SC6).
43. No submitted attempt is recalculated after this change, even when its test is later closed, reopened or tagged.
44. An attempt in progress on an existing released test keeps its answers, and its score is worked out at submit from the frozen marks (1 each) and the frozen key.
45. Released tests that exist before the change have no pass mark and show no Pass or Not yet label (here AC 8).

### J. Quality and access

46. The Results view is wrapped in an error boundary. A failed load shows a plain message and a Try again control (2026-11-17 AC 39).
47. Every new word, label, limit message, fallback and error text comes from the constants files (2026-11-17 AC 40). Nothing is written inline in a component.
48. Keyboard reaches every new control. Each new input has a visible label. The Results view table has column headings a screen reader can read (2026-11-17 AC 43).
49. The new controls and pages work at 375 px and 1280 px wide, in light and dark appearance (2026-11-17 AC 44).
50. No price, payment or upgrade text appears on any new page (2026-11-17 AC 9). Pass, Not yet, percentage and results appear on no public page, sitemap entry or e-mail (2026-11-17 M13 and M14).

**Release gate (not a build AC, ruled L-6, Q8):** the Privacy Policy line "admins can see your name and mock test scores" is approved by Saurabh before the merge to `main` (production). Staging may ship before that, under the admin-only gate in here AC 36. The 06-security finding 4 stays open until then.

## Decisions needed (Saurabh's)

All eight are ruled in `00-decisions.md`. Each is a cheap default that Saurabh may overrule.

1. **Q1 Names in the Results view (ruled L-1).** Names with scores (SC8). Anonymous scores would be a small change to the table.
2. **Q2 Who may see results (ruled L-2).** Admins only (SC8). Tutors can be added later on request (D-S11).
3. **Q3 Pass mark after release (ruled L-3).** Frozen with the test (SC3). Changing it later is D-S4.
4. **Q4 Wording (ruled L-4).** "N of M marks" for every test (SC6).
5. **Q5 Per-question marks on the result (ruled L-5).** Kept (SC9, here AC 22).
6. **Q6 Rounding (ruled L-4).** Rounded down (SC5, here AC 14).
7. **Q7 Labels (ruled L-4).** "Pass" and "Not yet" (SC4, SC7).
8. **Q8 Privacy (ruled L-6).** Staging ships with the admin-only gate (here AC 36). Saurabh approves the Privacy Policy line "admins can see your name and mock test scores" before the merge to `main`.

No money, account, identity or production decision is needed for this stage. Nothing goes to production from this stage.

## Risks

- **R-S1 Privacy.** Names next to scores widen what the portal holds about signed-up users and students (2026-11-17 R-1). Mitigation (ruled L-6): staging is admin-only at aal2, and the merge to `main` waits for Saurabh's approval of the Privacy Policy line (Q8). Until that approval, production stays unchanged.
- **R-S2 Reversing earlier decisions.** Option 4 reverses 2026-11-17 AC 24 and AC 37 for admins, and moves D-B7 into this release in a limited form. It also moves 2026-11-17 D-B6 (per-question marks and weighted scoring) into v1, which amends 2026-11-17 M9 ("each question is worth 1 mark") and AC 32 (the "N of M correct" wording). Recorded here, not silently; the decisions log entry is written by the Team Lead when the feature ships.
- **R-S3 Frozen marks.** A wrong mark on a released test can't be fixed. Same as R-3 of 2026-11-17: make a new test. Admins need the edit view to show marks clearly before release.
- **R-S4 Old results read differently.** "N of M correct" becomes "N of M marks" on every old result (SC6). The numbers don't change; the word does.
- **R-S5 Rounding down** shows 59% for 59.9 (SC5). Copy must not imply the rounded figure is exact.
- **R-S6 Pass label read as a result that counts.** It's practice only (SC7). Copy must not suggest a certificate.
- **R-S7 Size of stored numbers (for the Architect to confirm).** The largest total is 100 questions at 100 marks, which is 10,000. The attempt's `score` and `total` columns are smallint (range up to 32,767), so they fit. Confirmation sits with the Architect; no change is asked here.
- **R-S8 Limits carried.** The migration is new only; it must not edit the applied mock migrations (`20261118100000`, `20261119100000`, `20261120100000`).

## Hand-off

- Tester gets ACs 1 to 50 (plus the release gate). The test plan is written by the Test Manager and frozen before the first sitting.
- Accounts needed: `admin`, `tutor`, `parent`, `student`, `user`, and a submitted pre-change attempt for the legacy checks (local only). For the closed-test checks, a submitted and an unsubmitted taker on a closed test.
- No production or hosted-service change in this stage.
