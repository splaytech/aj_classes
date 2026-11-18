# Review — stage 3 (03-design.md)

## Round 1

CHANGES_REQUESTED

Method: the design's §1.3 migration text was run unchanged on the local DB after legacy fixtures, in one transaction ending in rollback.

1. [BLOCKING] Line 55 (migration header) and line 441 claim nothing writes `mock_test_attempts`; `mock_submit` (line 199) does, as before, and the parity guard (b) at line 693 would fail. Fix: the header says mock_submit keeps its one write at submit while `submitted_at is null`; guard (b) allows exactly one `update public.mock_test_attempts` inside mock_submit; the same correction goes into ADR-0012 Amendment 3 point 2 and 02-architecture line 147.
2. [NON-BLOCKING] The pass-mark race is not run. Use a locked re-read in check_mock_test (`select status … for no key update`); keep the two-session case as the gate.
3. [NON-BLOCKING] Pins are complete; the open_sign_up_access array is at lines 84–98; add the MockTestResult.tsx:1 comment to the wording sweep.
4. [NON-BLOCKING] service_role keeps EXECUTE through default privileges (existing pattern); state it.
5. [NON-BLOCKING] `private.mock_passed(0,0,n)` returns true; add `total > 0`.
6. [NON-BLOCKING] A direct pass_mark of 60.5 is stored as 61; R-D4 should name it.
7. Assumptions: none contradicts an AC; the no-practice-note risk (R-S6) needs a ruling or a constant.
8. [NON-BLOCKING] AC 47: `react/jsx-no-literals` has `ignoreProps: true`; rely on the scope grep too.
9. [NON-BLOCKING] Duplicate literals ("Results" ×2, the pass-mark line ×2); MOCK_VALIDATION.passMark wording form differs from its siblings.

Checked and correct: function bodies, results gate (42501 for aal1/tutor/parent/student/user/inactive admin; anon denied), taker scores, overflow, legacy, freeze, grants, helpers, 50/50 AC rows.

## Round 2

CHANGES_REQUESTED

1. [BLOCKING] check_mock_test was made `security definer` without a valid reason: only an aal2 admin reaches the trigger, and RLS lets that admin read and lock the row. Invoker was tested and works (refused on released, accepted on draft). Reverses the 2026-11-17 decision (06-security line 8). Fix (a), preferred: restore invoker.
2. [NON-BLOCKING] Stale text in the §1.2 table row and the "same body" comment.
3. [NON-BLOCKING] The two-session race is still a gate; run it on the chosen mode.
4. L-10 accepted.

Lead: option (a) applied by the team lead in 03 (lines 33, 119–127, 454).

## Round 3

APPROVED

Findings 1 and 2 closed: check_mock_test is `security invoker`, `search_path=""`, with no stale definer text. The revised §1.3 SQL ran clean in a rolled-back local transaction: prosecdef false, ACL {postgres=X}. As an aal2 admin: pass_mark changed on released → mock_released, same value accepted, draft change accepted. Earlier checks still pass. Non-blocking: the two-session race (§9) is the implementation gate.
