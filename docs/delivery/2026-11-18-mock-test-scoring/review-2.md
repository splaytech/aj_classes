# Review — stage 2 (02-architecture.md, ADR-0012 Amendment 3)

## Round 1

CHANGES_REQUESTED

1. [BLOCKING] Line 47: the helper's `total > 0` guard returns 0 for NULL score and total, so not_started and in_progress rows in `mock_tests_for_me` would show 0% (against AC 12). Fix: declare `mock_percentage` and `mock_passed` `strict`; pgTAP: not_started and in_progress rows give null percentage and passed.
2. [BLOCKING] Privileges (line 134 R-A1, line 78): `mock_tests_for_me` is dropped and recreated, and a fresh function in public is executable by PUBLIC. Fix: end the migration with revoke from public, anon, authenticated and grant to authenticated for `mock_tests_for_me`, `mock_test_open`, `mock_submit` and `mock_test_results` (pattern 20261120100000:426-434); pgTAP ACL pins.
3. [BLOCKING] Name source (line 76) vs AC 30: the coalesce to `students.full_name` contradicts AC 30. Product ruling needed.
4. [NON-BLOCKING] Lines 102/104: the pass-mark race claim isn't reproduced; keep a must-pass two-session case.
5. [NON-BLOCKING] Lines 135/155: remove the open ask on the marks guard; cite L-7.
6. [NON-BLOCKING] Line 102 vs AC 9: the pass mark is shown read-only when not a draft; only the control is hidden.
7. [NON-BLOCKING] Homes missing for AC 4 (total marks on the admin edit view), AC 2/7 (check_violation → constants via toErrorKey), and AC 50 (no sitemap or public change).
8. [NON-BLOCKING] Line 95/R-A4: 1000-row truncation; add `count(*) over () as total_rows` and "showing 1000 of N".
9. [NON-BLOCKING] Line 119: helper parameters are int; cast at call sites (`pass_mark::int`); 90 × 400 as smallint overflows.
10. [NON-BLOCKING] Line 20: list the web tests pinning "N of M correct" (MockTestResult.test.tsx:41-43; lib/mock-tests.test.ts:162-163; routes/portal/mock-tests.test.tsx:120,135,146; routes/portal/mock-test.test.tsx:195) and name mock_tests_taker.test.sql:80.
11. [NON-BLOCKING] ADR Amendment 3 point 5 and line 109: the invariant is "can change only while a draft".
12. [NON-BLOCKING] Hygiene: don't stage the untracked unrelated files.

Checked and true: all line cites for check_mock_test, check_mock_question, unanswered count, grants, admin list, raise_mock_not_found, FK restrict, attempt check, withdraw, closed check, taker filters, is_admin aal2, assignment marks, QUESTION_LIMITS, MOCK_RESULT.score, max_rows 1000; smallint arithmetic; floor % and Pass rule agree; legacy truth holds; freeze of marks holds.

Lead ruling on #3: L-8 (profile name, else student roster name, else "Name not set"); AC 30 amended.

## Round 2

APPROVED

Round-1 findings 1–12 closed (each checked at its line). New non-blocking nits, fixed in place by the team lead:
13. Line 19 said MockTestDialog is "hidden when not a draft"; now "pass mark shown read-only when not a draft, control hidden".
14. Line 71's return shape lacked `total_rows`; added.
15. Line 3 cited L-1 to L-6; now L-1 to L-8.
