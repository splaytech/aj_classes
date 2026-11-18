# Review — stage 5 (diff 0903f06...fe5debc)

## Round 1

APPROVED

Evidence: migration 20261121100000 is byte-identical to 03 §1.3; only that migration file changed; function bodies were diffed against their last definitions and every change is intended; lint, tsc and vitest (mock suites 54 files / 587 tests) pass on the pinned archive; the 810-line scoring pgTAP file was read. Repo rules hold on added lines; pins were updated, not deleted. Taker wording, %, Pass rule, the results page (ErrorBoundary, not-found, retry, empty, "showing 1000 of N" from rows.length < totalRows), and the freeze are all checked. 05 deviations #1–#6 accepted.

Non-blocking:
1. A decimal pass mark or marks written directly to the DB is rounded (60.5 → 61). Keep as a known limit; mention it in the ADR amendment.
2. "1 of 1 marks" reads wrong (`MOCK_RESULT.score` :284, `MOCK_RESULTS_PAGE.score` :314); pluralise like `QUESTION_BUILDER.marks`, or say the literal wording stays.
3. The total marks show twice on the admin edit view (MockQuestionList header and the Scoring card, admin-mock-test.tsx:255); pick one.
4. Tidy-ups: long lines at MockTestResult.tsx:2 and admin-mock-tests.tsx:2; import order in MockTestStatusChips.tsx:5-6.
5. lib/mock-tests.ts:37 `Number(trimmed)` accepts "1e2" and "0x3C"; use a digits-only check.
6. Gates (not code): the Privacy line before `main` (L-6); S-1 covers the hosted apply.
