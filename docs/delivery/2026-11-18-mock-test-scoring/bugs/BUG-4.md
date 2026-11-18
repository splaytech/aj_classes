# BUG-4 — BA-9: an admin with no authenticator lands on two-step setup, not `/portal/login/verify` (claim: case error)

- **Type:** claim, case error (not an app bug). For the lead to rule.
- **Row:** BA-9. **Severity:** none.
- **Steps:** sign in as `newadmin@local.test` (admin, no authenticator), then open `/portal/admin/mock-tests/<BS>/results`.
- **Expected (frozen):** "stays on a `/portal/login/verify` page, no `rpc/mock_test_results` request".
- **Actual:** the page is `/portal/account/two-step/setup` (screenshot run-1/shots/BA-9-newadmin.png), and there was no `rpc/mock_test_results` request. Every other part of BA-9 matched: tutor@, parent@, student@ and user@ got "You don't have access to this page" with no results or `mock_tests` request; signed out went to the login page with `next`; inactive@ got "Email or password is incorrect.".
- **Cause:** `/portal/login/verify` is for an admin who already has an authenticator. An admin with none is sent to set one up (the seed comment says newadmin@ "shows the two-step setup screen"). The plan named the wrong page. The behaviour that matters, that the admin never reaches the page or the function without aal2, holds.
- **Proposed ruling:** plan error; BA-9 PASS with the expected page `/portal/account/two-step/setup`.

- **Round 2: ruled** a plan error (06-test-plan.md §12.4). **PASS.**
