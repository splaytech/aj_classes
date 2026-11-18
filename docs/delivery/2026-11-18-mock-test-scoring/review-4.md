# Review — stage 4 (04-plan.md)

## Round 1

CHANGES_REQUESTED

Checked and correct: migration source ranges; check_mock_test invoker; one attempts update; total > 0; package scripts and `supabase test db`; 15 pgTAP cases cover 03 §2.2; deferred list D-S1–D-S11; disjoint worktree paths; the two-session race is a must-pass gate.

1. [BLOCKING] Slices 4 and 5 fail typecheck: 4.3 makes fields required before their producers (services/mock-tests-data.ts 115, 129, 140, 153) change in 5.1; 5.3 changes arities whose callers (MockTestResult.tsx:34, routes/portal/mock-tests.tsx:109, MockTestDialog.tsx:35, MockQuestionDialog.tsx:85) change only in 6–7. Each slice must land every producer and caller, or keep params optional until then. 4.4's grep misses MockTakeQuestion.
2. [BLOCKING] No slice covers services/mock-tests.service.test.ts (getMockTestResults; marks and pass_mark payloads). Add to 5.7.
3. [BLOCKING] ACs 41–42: capture attempts before applying 20261121100000, after, and byte-compare in slice 1; output to the TSR.
4. [BLOCKING] The hosted DB is production's: an explicit Saurabh go before `db push`; put L-6 to him.
5. [NON-BLOCKING] Line cites in 1.2: taker regex 113, keys 116, "shows the score" 182.
6. [NON-BLOCKING] Guard 5.6(b): scope "no alter table" to mock_test_attempts.
7. [NON-BLOCKING] Race mirror: a pass_mark write blocks behind a submit's FOR SHARE, then is refused ("blocks, then refused"; also fix 03 §9.3).
8. [NON-BLOCKING] 9.2: name the Playwright spec filter.
9. [NON-BLOCKING] Add an AC→slice table; name ACs 5, 8, 17, 37, 47.
10. [NON-BLOCKING] DoD: the decisions-log entry (R-S2); unrelated untracked files stay unstaged.

Lead on #4: ruled L-11 (go asked in chat; release stops before db push until Saurabh answers).

## Round 2

CHANGES_REQUESTED

Closed: 1, 2, 4, 5, 6, 7, 9, 10. Partly closed: 3 and 8.

1. [BLOCKING] The slice-5 pins contradict 5.4/5.5: the callers pass two arguments, so they print "N of M marks" without the %. The slice-5 pins expect no %; the % pins move to 7.4/7.5.
2. [BLOCKING] Optional fields: undefined fails Number.isInteger, so saves are refused until slice 6. Check only when present; add both dialog tests to slice 5's command.
3. [NON-BLOCKING] Name the owner and slice that make `passMark` required (types.ts is lead-owned).
4. [NON-BLOCKING] 1.4: say how the before-run excludes the new migration from `db:reset`.
5. [NON-BLOCKING] Evidence isn't gitignored. Lead: it is excluded via `.git/info/exclude` (`docs/delivery/2026-11-18-mock-test-scoring/run-*/`, added at setup); the plan should cite that.
6. [NON-BLOCKING] Line 212 still runs `test:smoke` unfiltered.
7. [NON-BLOCKING] Line 5 says L-1 to L-10; 5.9's "Pass wording" belongs to the chip.

## Round 3

APPROVED

Round-2 findings 1–7 closed (slice-5 pins without %, optional fields checked only when present, lead flips the required fields at the slice-6 merge, move-aside steps in 1.4, `.git/info/exclude` line 13, no unfiltered smoke in slice 9, L-1–L-11). S-1 recorded; the deploy step and DoD 8 record the approved db push.

Non-blocking: `.git/info/exclude` is local to this clone (acceptable for a solo repo; noted in the TSR). The full check intentionally runs the whole `test:smoke` and `test:csp`.
