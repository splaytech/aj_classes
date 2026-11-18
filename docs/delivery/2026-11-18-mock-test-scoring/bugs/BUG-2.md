# BUG-2 — SC-2: the `stored` line orders two tied rows (claim: case error)

- **Type:** claim, case error in the frozen script (not an app bug). For the lead to rule.
- **Row:** SC-2. **Severity:** none for the build.
- **Steps:** `zsh "$S/dr-score.sh"` (rolled back), block SC-2 (run-1/out-dr-score.sh.txt).
- **Expected (frozen):** `stored|parent@local.test:2/10 student@local.test:8/10 student@local.test:1/2 user@local.test:0/10`.
- **Actual:** `stored|parent@local.test:2/10 student@local.test:1/2 student@local.test:8/10 user@local.test:0/10`.
- **Cause:** the query is `string_agg(… order by p.email)`. student@ has two attempts (8/10 on the 3-2-5 test, 1/2 on the no-pass-mark test), so the two rows tie and Postgres may return them in either order. The planning dry-run happened to give 8/10 first. The four values are identical, and every submit reply above the line matches exactly.
- **Proposed ruling:** plan error; SC-2 PASS as the same set of values. For a later plan, the script should order by `p.email, a.total`.

- **Round 2: ruled** a plan error (06-test-plan.md §12.2). **PASS.**
