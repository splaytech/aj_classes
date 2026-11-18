# 06 — Security review: mock test scoring (stage 6b)

Security, 18 Nov 2026. Pinned to `fe5debc` (diff `0903f06...fe5debc`). Local DB queried read-only.

**Verdict: PASS.** Blocking 0 · Should-fix 2 (both Saurabh's gate before `main`) · Note 3.

## Checked
1. **Authz on `mock_test_results`:** `private.is_admin()` (active admin, aal2, `search_path ''`) is the first statement (migration line 346). The refusal is `42501 not_admin` and carries no data. pgTAP covers admin at aal1, tutor, parent, student, signed-up user, inactive admin and anon. An unknown id gives `raise_mock_not_found`, reachable by admins only. The DB function is the control; the service check is a convenience.
2. **Definer and search_path:** `mock_test_results`, `mock_submit`, `mock_tests_for_me` and `mock_test_open` are `prosecdef=t` with `search_path=""`, and every object is schema-qualified.
3. **Grants:** these functions' ACLs are postgres, service_role and authenticated only (anon=f, public=f). The private helpers and `check_mock_test` are revoked from public, anon and authenticated; postgres and service_role keep execute (default privileges, L-10). service_role is accepted under L-10.
4. **`check_mock_test`:** still `security invoker`, `search_path ''`, revoked from public, anon and authenticated (service_role keeps it, L-10). The pass-mark freeze reads the locked row.
5. **Leaks:** results return attempt id, name, time, score, total, percentage, passed and total_rows: no e-mail, profile id or answers. The name is profile, else roster, else null. `mock_test_open` reveals the key, explanation and marks earned only after submit. Taker functions filter on the caller.
6. **Injection:** no dynamic SQL. The only input is a uuid. No `dangerouslySetInnerHTML`.
7. **Errors:** coded (`not_admin`, `not_found` with P0002 from `raise_mock_not_found`, `mock_released`) with no row data.
8. **Dependencies and secrets:** no package or lockfile change, no secrets.
9. **Numeric safety:** int helpers, exact cross-multiplication, 1–100 checks, `strict`.

## Findings
**Should-fix**
1. **The Privacy Policy line is not in the code yet.** `PRIVACY` in `apps/web/src/constants/content.constants.ts:412` lacks "admins can see your name and mock test scores", and the `TERMS` comment at :445 still says "no mock tests yet". Under L-6 this is Saurabh's to approve, then add in the same release as the merge to `main`.
2. **The hosted DB is production's** (L-11, S-1). The results function is live to admins before the policy line ships. Risk is low (admin at aal2 only). Ship the line with the next production deploy.

**Note**
3. Results are capped by PostgREST's row limit; `total_rows` gives the true count. Fine at this scale.
4. Admin reads aren't logged. Acceptable for v1; a read-audit can come later.
5. service_role execute stays through default privileges (L-10). No action.

No exploit path found.

## Reviewer gate (review-6b) corrections, applied by the team lead
- Line cite 306 → 346; the not-found code is `not_found` (P0002); "postgres-only" → revoked from public, anon and authenticated, with service_role kept (L-10).
- Review-6b said the results function is live on the hosted DB today. That's wrong: `20261121100000` isn't applied to hosted yet (it waits for the gate, S-1). The Privacy line is still Saurabh's gate before `main` (L-6).
