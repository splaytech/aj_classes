# Review — stage 5 (diff develop...4a402b4)

## Round 1

CHANGES_REQUESTED

Pinned to 4a402b4. Read-only (lead's test runs taken as given).

1. BLOCKING. AC 8 conflicts with the top-bar nav. PortalLayout.tsx:40-58 adds "Mock tests" for student, parent and user; member-layout.tsx wraps every member page, so the link shows on the student timetable, which AC 8 says it must not. The admin dashboard tile (admin-dashboard.tsx:67) is also outside "homes only". Fix: remove the three nav items, or amend AC 8 and get Saurabh's OK.
   - **Lead ruling L-7:** AC 8 contradicts M15 and 03 §1 #4 / §4.5 in the same approved docs; M15 and the design govern. AC 8 is read as "the mock-tests link *card* appears on the student, parent and user homes only"; the top-bar item (student, parent, user) and the admin dashboard tile stay. Appended to 01 and 00-decisions.md. Closed by ruling, no code change.
2. Non-blocking. Shared copy changed (error.constants.ts:82, :85 invalidStatus, alreadySubmitted). 03 §3.1 permitted it; no test pins the text. Assignment pages change too; "This has already been submitted" drops "work". Keep it; tell Saurabh in the release notes.
3. Non-blocking. Migration lines 111, 140: check_mock_test and check_mock_question are SECURITY DEFINER; revoked from clients (187-188), harmless but unneeded. Drop it or note why.
4. Nit. Migration 159-161: test_id-change branch unreachable (test_id not in update grant, line 622).
5. Nit. mock-tests.service.ts:49: getMockTestForEdit maps "no row" to notFound; under RLS also covers non-admin / aal1. Consider a neutral message.
6. Nit. open-sign-up.spec.ts:84 says AC-21, PortalLayout.tsx comment says AC-22; superseded AC not annotated in the open-sign-up 01.
7. Non-blocking. Files outside the plan's list: open_sign_up_access.test.sql, e2e/src/auth/login.ts, e2e/tests/open-sign-up.spec.ts (justified), plus undisclosed parent-home.test.tsx, student-home.test.tsx, MockTestStatusChips.tsx. Add to dev notes.

Verified from source: no key before submit (only key path mock_test_open gated on revealed, 458-460; taker suite checks each stage 93/113/149/178); server-side marking in mock_submit (576-579; blanks wrong); all 13 definer functions set search_path=''; 9 public functions gate on is_admin or require_mock_taker; execute revoked from public/anon/authenticated then granted to authenticated; status changes only via mock_release/mock_withdraw (column grants 617-620); taker tables no grant/policy; freeze, lock, cap, reorder gap covered; role gate per role incl. inactive roster, invited, deactivated, tutor; services only Supabase callers; no inline style/console/TODO/DOM; stable keys; ErrorBoundary on all four routes; no secrets; price-word scan present. AC 13, 19, 21, 27 and real-browser AC 5, 6 need S8.
