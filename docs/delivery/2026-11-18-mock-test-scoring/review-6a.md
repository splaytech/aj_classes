# Review — stage 6a (06-test-plan.md, pinned bedbffe)

## Round 1

CHANGES_REQUESTED

Checked about 30 rows against the code and migration (SC-1 all 14 pass and 11 % inputs, SC-2–4, SH-1/3, SU-1, CS-1/4, RS-1/3, AZ-1/2, PV-1, GR-1–3, MK-1–5, TS-1–6, H-2/5, LG-1, BA/BT/R strings): all match. Counts 113 (36/15/24/33/4/1) are correct; all 50 ACs have rows.

1. [BLOCKING] R-14 (line 980): the student list omits `bp1b` (released in BP-4, no pass mark); a correct build shows nine cards.
2. [BLOCKING] Sitting 2 order (line 161): S-6 pgTAP runs before CL-1 removes the TS/H fixtures and the 1003 `t8-bulk` users; pgTAP asserts empty tables (mock_tests_admin.test.sql:68, :458; mock_tests_closing.test.sql:337). Run rm_t8, the bulk delete and S-0 before S-6; align §0.4 and §2.9/§2.10.
3. [NON-BLOCKING] S-1 (line 181) expects exit 1: PARTIAL unless a clean tree gives 0.
4. [NON-BLOCKING] BP-1: state bp1b's tags.
5. [NON-BLOCKING] BK-1: "type 5, 0" is ambiguous.
6. [NON-BLOCKING] List the superseded v1 frozen rows (TK-6, TK-8, "N of M correct", shape rows) as superseded by AC 12, AC 15 and L-4.
7. [NON-BLOCKING] Header: add L-13; mark §6 as ruled.
8. [NON-BLOCKING] Commit the plan and L-13 at freeze.
9. [NON-BLOCKING] Secrets hygiene: delete status.json; send the tok() body from a 0600 file.
10. [NON-BLOCKING] Coverage: V-2 screenshots for bcl Results and the BA-7 page; AC 12 in-progress card on bs; LG-1 compares two attempts (say so in the TSR).
11. [NON-BLOCKING] F-2 contradicts 03 §2.2 case 11: write the deviation into 03 and the ADR.
12. [NON-BLOCKING] Stale comment above MOCK_CLOSING (mock-tests.constants.ts:220-221) says "results included".

Lead: #3: S-1's expected value is "exit 1, listing only actionItems.md and supabase/.temp/*" (the accepted 2026-11-17 L-4 rule), which is an exact expected value, so PASS when it matches. #8: the team lead commits at freeze. #11: written into 03 and the ADR by the team lead. #12: Dev Lead comment fix; the plan re-pins to that commit.
