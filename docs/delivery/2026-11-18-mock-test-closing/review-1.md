# Review: stage 1 (01-requirement.md)

## Round 1

CHANGES_REQUESTED

Seven blocking findings:
1. US-A8, AC 8 and the Model contradict S-1.
2. AC 21 and AC 25 don't say whether closed tests with a submitted attempt are filtered.
3. AC 6 has no [ASSUMPTION] label for admins still seeing closed tests.
4. Interactions are missing: what reopen does to in-progress answers, take-back of a closed test, and tags on a closed test.
5. AC 15 and US-C2: no AC lets an admin set a missing tag, and "looked at" isn't testable.
6. Removed list values: AC 15, AC 16 and AC 27 disagree. Where the database's copy of the lists lives, and how it is kept in step with the constants.
7. AC 23 doesn't say how an untagged test shows to a taker.

Non-blocking:
8. AC 14 must be enforced in the database.
9. The `YEAR_LEVEL_TEXT` citation is wrong (it is `portal.constants.ts:795`).
10. "AC M13 and M14" are assumptions, not ACs.
11. Say that the class "none = any year" meaning isn't reused, and that "Other" isn't offered.
12. The limits say "only new columns", which conflicts with `closes_at`.
13. AC 22 doesn't separate an empty list from an empty filter result.
14. AC 9 should name the date helper.
15. The build should check that a closed, submitted result read isn't gated, and that `mock_tests_closing.test.sql` follows S-1. This was passed to the Dev Lead.

The verified facts are in the reviewer's hand-back: `SUBJECTS`, `PROGRAMMES` and `YEAR_LEVELS` all match.

## Round 2

APPROVED

All 15 round-1 findings are closed and verified at source. Three new non-blocking findings, all fixed in place by the team lead:
1. Decision 6 moved under "Ruled".
2. S-2 now names the Interview preparation removal.
3. AC 5.1 is labelled [ASSUMPTION, D-2 carried].

The pgTAP and migration check against AC 5 is left to the Dev Lead and the Tester.
