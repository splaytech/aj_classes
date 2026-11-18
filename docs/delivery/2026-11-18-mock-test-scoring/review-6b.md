# Review — stage 6b (06-security.md)

## Round 1

CHANGES_REQUESTED (doc fixes; no SQL or code findings)

1. The Privacy Policy doesn't disclose admin visibility of names and scores; the TERMS comment at content.constants.ts:445 says "no mock tests yet". Saurabh rules on the wording (L-6) before `main`.
2. Check 1: is_admin is at migration line 346, not 306.
3. Check 7: the not-found code is P0002 `not_found` (20261118100000:110-120), not `mock_not_found`.
4. Checks 3–4: the helpers and check_mock_test are revoked only from public, anon and authenticated; service_role keeps execute.

Checked and sound: is_admin first with 42501 before any query (no row count or existence oracle for non-admins); revoke-then-grant on all four recreated functions; leak claims hold; no dynamic SQL; search_path ''.

Lead: #2–#4 corrected in 06-security.md. #1 goes to Saurabh (asked 2026-11-18). The claim that the function is live on hosted today is wrong: the migration isn't applied yet.
