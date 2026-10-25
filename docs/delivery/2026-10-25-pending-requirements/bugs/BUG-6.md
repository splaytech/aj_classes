# BUG-6 — Opening an email's "View feedback" link signed out logs a 401 console error

- **Found:** 2026-10-25, `/test-and-ship` item 3, round 1, case E-22 · **Build:** `feature/work-returned-email` @ `4af50eb`
- **Severity:** Low. The person still reaches the sign-in page, and then the right assignment page, with no data shown before sign-in. But the browser console logs `Failed to load resource: 401 (Unauthorized)` on every signed-out open. The page code is older (R3b family pages). Item 3 makes this path common: every email link is opened by someone who is usually signed out.

## Steps to reproduce

1. Local stack, dev server on :5173, signed out (fresh browser context).
2. Open the student email's link: `http://localhost:5173/portal/student/assignments/<assignment id>`.
3. Watch the console and network before the redirect to `/portal/login?next=…`.
4. Repeat with the parent link: `/portal/parent/children/<student id>/assignments/<assignment id>`.

## Expected

The redirect to sign-in, with 0 console errors (plan E-22). No data request is made for a signed-out visitor.

## Actual

- Student link: `401 POST /rest/v1/rpc/student_assignment`, logged as a console error.
- Parent link: `401 POST /rest/v1/rpc/parent_children` and `401 POST /rest/v1/rpc/parent_child_assignment`.

The redirect and the post-sign-in landing are correct: `/portal/student/assignments/<id>` and `/portal/parent/children/<sid>/assignments/<id>`, `h1` = the assignment title.

## Likely cause

The route's `clientLoader` calls its RPC before (or in parallel with) the member layout's session check. The anonymous call is refused, and the layout then redirects.

## Suggested fix

Have the loaders return early, without calling the RPC, when there's no session. Or make the layout's guard resolve first, as the admin layout does for its pages. Add a check that a signed-out deep link makes 0 `/rest/v1/rpc/` calls.

## Evidence

TSR-item-3 E-22: Playwright `page.log.failed` for both links.
