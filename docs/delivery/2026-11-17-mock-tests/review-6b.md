# Review — stage 6b (06-security.md)

## Round 1

CHANGES_REQUESTED

1. Blocking (doc). Race section wrong after L-5. At 4a402b4 mock_submit (:561-564) and mock_save_answer (:522-525) lock only the attempt row; withdraw was safe only because :318 refused on any attempt. Finding 1 asked for that guard to go; HEAD :326 deletes in-progress attempts without a submitted_at predicate, opening the window found in review-5 round 2. The review checked the pinned state, not the fix it recommended. Rewrite the Races bullet: release, withdraw, question writes and start serialise on the test row lock; submit and save take only the attempt row, safe against withdraw only while withdraw refused on any attempt, which L-5 removed. Fix per the round-2 ruling (submit and save lock the test row FOR SHARE and require released; delete keeps `submitted_at is null`; S8 two-session test). "Submit is idempotent" holds for a repeat submit only (:570-572). Re-pin after fix batch 2 and re-verify.
2. Should-fix. Threat-model "No table grant" is wrong: :619 grants SELECT on mock_tests and mock_test_questions to authenticated; the key is protected by RLS alone via the admin-only select policy (:639). ADR-0012 line 14 ("Takers get no table access at all") has the same error. Correct both; note a future taker-facing select policy would expose correct_option.
3. Nit. 13 security definer functions (9 public, 2 helpers, 2 triggers), not 11; all set search_path=''.
4. Severities sensible. Coverage notes: no rate limit on mock_start / mock_save_answer (bounded; accept in writing); no audit row for release/withdraw beyond released_by.

Verified at source: :318, :458-460, :152-154, :522-541, :613-623, :187-188, :229, is_admin aal2, no package.json change, no key patterns. DB behaviour not reproduced.
