# BUG-5 — BK-2: the edit page's Results control is a link, so Space doesn't open it (claim: case error; minor a11y note)

- **Type:** claim, case error, with a minor accessibility observation for the lead. Not filed as an app bug.
- **Row:** BK-2. **Severity:** none or Trivial.
- **Steps:** as admin@ on `bs`'s edit page, Tab to `Results` (the first header button) and press Space.
- **Expected (frozen):** "`Results` is the first header button and opens by Enter or Space".
- **Actual:** Enter opens it; Space does not (the URL stays on the edit page). Every other part of BK-2 matched: the list's `Results for …` links are reachable with a visible focus; on the Results page the only Tab stop in `main` is `← Back to mock test`; `Results` is the first header button.
- **Cause:** the control is an MUI `Button` rendered as a router link (`component={RouterLink}`, an `<a href>`). Links are activated by Enter, not Space, in every browser (WAI-ARIA link pattern). The plan's "Enter or Space" is the button pattern.
- **Note:** a sighted keyboard user sees a button and may try Space. It is the same pattern as other link-buttons in the portal (for example the closing gate's `View result`), so the build is consistent.
- **Proposed ruling:** plan error; BK-2 PASS on Enter. If Space should work, it is a portal-wide change, not this feature.

- **Round 2: ruled** a plan error (06-test-plan.md §12.5). **PASS.**
