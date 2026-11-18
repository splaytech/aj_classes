# BUG-3 — BA-2: the Results page also loads the admin's own profile (claim: case error)

- **Type:** claim, case error (not an app bug). For the lead to rule.
- **Row:** BA-2. **Severity:** none.
- **Steps:** as admin@, open `/portal/admin/mock-tests`, press `Results for t8-<RUN>-bs`, and record every `/rest/v1/` request.
- **Expected (frozen):** exactly two requests: `GET mock_tests` with `select=id,title,status,closes_at,pass_mark`, and `POST rpc/mock_test_results`.
- **Actual:** three requests: `GET profiles?select=full_name,role,is_active&id=eq.<admin@'s own id>`, then the two expected ones. Every other part of BA-2 matched: h1, intro, back link, meta, headers, both rows with times, no controls, no `@` (run-1/browser-results.tsv).
- **Cause:** the portal layout reads the signed-in person's own profile (name, role, active) on navigation. That is the caller's own row, not taker data, and it happens on every portal page. The plan counted only the page's own loader.
- **Proposed ruling:** plan error; BA-2 PASS. The two page requests are exactly as frozen, and the extra request carries no taker name, score or answer.

- **Round 2: ruled** a plan error (06-test-plan.md §12.3). **PASS.**
