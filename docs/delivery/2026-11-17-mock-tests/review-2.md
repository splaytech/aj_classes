# Review — stage 2 (02-architecture.md, ADR-0012)

## Round 1

CHANGES_REQUESTED

Blocking
1. Admin direct writes bypass the release and take-back rules (02 "Access control", mechanics 1; ADR-0012 decision 2). Table-level UPDATE lets an admin set status='released' with zero questions (AC 17), status='draft' with attempts (AC 21, 35), or write created_by / released_*. Fix: `revoke all on` the four tables `from anon, authenticated` (pattern 20261024120000_posts.sql:18, revoke block in 20261007090320_student_parent_portal.sql); grant column-scoped writes only (e.g. update (title, instructions)); status and release fields change only inside functions. ADR's "no table grant" claim holds only after this revoke.
2. Admin functions have no stated gate. mock_tests_admin_list, mock_release, mock_withdraw are security definer so RLS doesn't guard them. Fix: each starts with `if not private.is_admin() then raise` (aal2 included; pattern 20261007090321_family_functions.sql:683). Every new function: revoke execute from public, anon; grant to authenticated only.
3. Freeze/lock gaps (Lifecycle, DEC-MT-4). Not stated how release/withdraw pass the freeze trigger or whether status change is covered. Question insert/update/delete triggers don't lock the parent row: a question committed during mock_release joins a released test (AC 19); the 100-question trigger can overshoot. Fix: question triggers take `for share` on the parent row; doc states status changes only inside the two functions.

Answer keys: no leak found (my_active_role requires is_active and status='active', 20261023100000_invite_onboarding.sql:133-141; keys withheld like private.assignment_view). Holds once finding 1 is fixed.

Non-blocking
4. portal-root.tsx:28 already exports an ErrorBoundary for every portal route; keep per-route export for AC 39, correct the claim.
5. Risk 7 overstates the admin case: portal-access.ts:114-136 sends non-aal2 admins to two-step first; empty list is stale-session only.
6. mock_save_answer must refuse with no attempt; double-tapped Start returns the existing attempt; no save/start return shape carries keys; service maps check-constraint errors to field messages (AC 14).
7. Reorder (AC 13) vs unique (test_id, position): deferrable constraint or two-step renumber — say which.
8. assignment_view is at 20261027100000_fair_results.sql:288; ADR-0012 missing from docs/decisions/README.md index.

Not reproduced on a live database.

## Round 2

CHANGES_REQUESTED

Round-1 findings 2–8 closed (re-verified: family_functions.sql:683, portal-root.tsx:28, portal-access.ts:114-136, fair_results.sql:288, docs/decisions/README.md:21). Finding 1 closed in part.

1. [blocking] Admin grants omit DELETE (ADR-0012 decision 2, 02 DEC-MT-2 item 1: select, insert, update only). Admin can't remove a question (AC 13) or delete a draft (AC 16); "deleting a draft cascades" needs it. Fix: add `delete` on mock_tests and mock_test_questions; RLS and freeze triggers already limit deletes to drafts.
2. [non-blocking] Insert on mock_tests must not list created_by; state its default is auth.uid() and status defaults to draft (M3).

Answer keys still hold.

## Round 3

APPROVED

Both round-2 findings closed in 02-architecture.md line 48 and ADR-0012 decision 2: delete granted on mock_tests and mock_test_questions (freeze trigger limits to drafts, AC 16); created_by absent from insert grant, defaults auth.uid(), status defaults draft. Grant text identical in both docs. Round-1 blocking findings stay closed.
