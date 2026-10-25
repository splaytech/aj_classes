# BUG-9 — Signed-in wrong-role email links log refused (403) requests in the console

- **Found:** 2026-10-25, `/test-and-ship` item 3, round 2, case E-22 (team-lead strict reading) · **Build:** `feature/work-returned-email` @ `1dc433c`
- **Severity:** Low. No data leaks, and the page correctly says "You don't have access to this page". But the frozen case E-22 expects 0 console errors on the wrong-role legs too. Item 3 makes these legs common: a forwarded email, a parent who opens the student's email, or staff checking a family link.

## Steps to reproduce
1. Local stack, dev server on :5173.
2. Sign in as `parent@local.test`. Open the student email link `/portal/student/assignments/<MOCK>`.
3. Sign in as `tutor@local.test`. Open the parent email link `/portal/parent/children/<AARAV>/assignments/<MOCK>`.
4. Record the console errors (`console.error` and `pageerror`, as the plan defines them) and the `/rest/v1/rpc/` calls.

## Expected
For both legs: the access message (or a redirect to the person's own home), **0 console errors** (E-22), and no data request the database is bound to refuse.

## Actual
- Parent on the student link: `403 POST /rest/v1/rpc/student_assignment`, logged as a console error.
- Tutor on the parent link: `403` on `rpc/parent_children` and on `rpc/parent_child_assignment`.

## Likely cause
BUG-6 added a signed-out pre-check, but nothing checks the role. The family loaders call their RPC whatever the signed-in person's role is, and only the database refuses it.

## Suggested fix
Use the role the portal layout's access check already knows (`getAccessState`). A student page should call its RPC only for a student, and a parent page only for a parent. Otherwise, return the existing "not allowed" result without a request. The fix must not add an extra network request for the right role.

Add unit tests, for example an `it.each` over the family reads: right role → RPC called once; wrong role → RPC not called, result `notAllowed`.

## Evidence
TSR-item-3 round 2, E-22 and the note under it. The `r2-*` logs are in `docs/test-reports/2026-10-25-feature-work-returned-email/evidence/`.
