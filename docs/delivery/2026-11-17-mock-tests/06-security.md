# 06 — Security review: mock tests (stage 6b)

Security, 18 Nov 2026. Pinned to `4a402b4` (`git diff develop...4a402b4`, 67 files). Read 02, 03, ADR-0012, the open-sign-up 06 review, `supabase/migrations/20261118100000_mock_tests.sql` and the service, route and e2e code.

**Verdict: PASS. No Blocking findings.** Blocking 0 · Should-fix 2 · Note 4. The answer key cannot reach a taker before their own submit; nothing exposes another person's attempt; admin-only access holds.

## How it was checked (local stack, one transaction, rolled back)
- Catalogue: all 11 functions `security definer` with `search_path=''`; `anon` has no EXECUTE on any; private helpers and trigger functions have no EXECUTE for anon or authenticated; anon has no table grant; authenticated has only SELECT and DELETE on the two admin tables; column INSERT/UPDATE limited to title, instructions and question fields (status, created_by, released_* unwritable). Attempts and answers: no grant, no policy.
- No views or realtime publication include the mock tables.
- Probe as admin at aal2 and as user@local.test: the user's `mock_test_open` after `mock_start` had no correct_option or explanation; direct select on attempts → permission denied.
- `is_admin()` requires active admin at aal2. Taker gate requires an active finished profile (my_active_role) or active student; tutors, admins, invited and deactivated profiles get `not_taker`.
- Attempt IDOR: every taker function resolves the attempt by `(test, auth.uid())`, never by a caller-supplied id. Save checks the question belongs to the test and the option is in range.
- Races: question writes, release and withdraw serialise on the test row lock; start takes `for share`; save and submit lock the attempt row; 100-question cap holds under `for update`; submit is idempotent.
- Injection: no dynamic SQL; web uses only `.rpc` and `.from`. XSS: no dangerouslySetInnerHTML/innerHTML. No package.json change, no secrets (e2e helper reuses the local seed password).

## Findings
1. **Should-fix — any signed-up user can block a take-back.** `mock_withdraw` refuses when any attempt exists (`:318`), and `mock_start` is open to every self sign-up. Repro: stranger signs up, `mock_start(<released id>)`, withdraw raises `mock_has_attempts`. Impact: a wrong answer key can't be fixed (released tests frozen; test_id `on delete restrict`). Fix: allow withdraw while no attempt is submitted, deleting in-progress attempts and answers in the same transaction; or a supersede path; at minimum record as a known limit in ADR-0012.
2. **Should-fix — the answer key is effectively public.** Submitting with zero answers reveals every correct_option and explanation (`:458`). Repro: sign up, mock_start, mock_submit, mock_test_open. By design but unrecorded. Fix: accept in the decision log ("practice only, no credential attached to a score"); later option: require ≥ 1 answer before submit.
3. **Note — silent no-op insert** (`:152-154`). With a non-existent test id, `check_mock_question` does `return old` (NULL on INSERT), the row is dropped and the API replies 201. Repro: admin inserts a question with `test_id = gen_random_uuid()` → `INSERT 0 0`. Fix: `if tg_op = 'DELETE' then return old; else raise exception 'not_found'; end if;`.
4. **Note — privacy.** Attempts hold profile_id, score, timestamps; cascade-delete with the profile; created_by/released_by become null. Admins see counts only. A parent's attempt sits under the parent's own profile. Add a privacy-notice line that scores are kept until the account is deleted.
5. **Note — no cap on tests or attempts per test.** Admin-only creation and one attempt per person per test bound it; largest payload ~100 questions × ~6 KB ≈ 600 KB. Acceptable.
6. **Note — `invalid_option` / `invalid_question`** reveal option count and question membership, never the key. No action.

## Threat model update
| Asset | Attacker | Control | Residual |
|---|---|---|---|
| Answer key and explanations | Taker or stranger | No table grant; revealed only by `mock_test_open` after the caller's own submit | Findings 1, 2 |
| Other people's attempts | Any user | Attempt looked up by `auth.uid()` only | None found |
| Test content integrity | Non-admin, admin without aal2 | RLS, `is_admin()` aal2, freeze triggers, column grants | None found |
