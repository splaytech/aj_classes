# BUG-2 — R-3 expects contiguous question positions; v1 keeps gaps (claim: plan error)

- **Row:** R-3 (regression). **Severity:** none if the claim holds. **Kind:** case error (plan), filed as a claim for the lead, not an app bug.

## Steps
On a fresh empty draft (`t7-<RUN>-ui1r`), add two questions, move question 2 up, edit it, and delete the first question.

## Expected (frozen R-3)
`1 of 100 questions`, and positions `db "select string_agg(position::text, ',' …)"` → `1`.

## Actual
`1 of 100 questions` ✓, the move and the edit ✓, console 0. Positions → `2`: the surviving question keeps position 2.

## Why this looks like a plan error
The v1 gate froze the opposite rule: 2026-11-17 `06-test-plan.md` BM-7 expects "positions `1` and `3` (gap kept)" after deleting question 2. The UI numbers questions by order, not by position. R-3 copied "contiguous" without checking BM-7. The rest of R-3 matches.

Ruling needed: correct R-3's expected value to the remaining question's old position (`2` here), and record R-3 as PASS.

**Round 2:** R-3 retested with the §11.1 value: PASS (position 2).
