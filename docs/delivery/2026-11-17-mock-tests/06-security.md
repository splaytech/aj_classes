# 06 — Security review: mock tests (stage 6b), revised

Security, 18 Nov 2026. Round 1 pinned to `4a402b4`; re-pinned to `3e20c19` (fix batches `736f987`, `893bba1`, `3e20c19`). Re-verified at source (`git show 3e20c19:supabase/migrations/20261118100000_mock_tests.sql`) and against the local catalogue, read-only.

**Verdict: PASS, no Blocking findings.** Blocking 0 · Should-fix 2 (both closed) · Note 4. Round 1 of this review was wrong on the race section (below); review-6b round 1 was right on items 1 to 4.

## What was checked
- **Functions:** 13 mock functions, 12 `security definer`, all with `search_path=''`: 9 public, 2 private helpers (`can_take_mock_tests`, `require_mock_taker`), 1 trigger function (`check_mock_question`). `check_mock_test` became invoker at `3e20c19` (reads no other table). Local catalogue shows 12 of 13 definer.
- **Execute grants:** `anon` has none; helpers and triggers have none for `anon` or `authenticated`; the 9 public functions go to `authenticated` only.
- **Table grants:** `authenticated` has SELECT and DELETE on `mock_tests` and `mock_test_questions`, plus column-scoped INSERT/UPDATE (title, instructions, question content columns). `status`, `created_by`, `released_*` not writable. Attempts and answers: no grant, no policy.
- **Answer key:** protected by RLS alone. The `mock_test_questions` admin-only select policy (`private.is_admin()`, aal2) keeps `correct_option` from takers. A future taker-facing select policy on that table would expose the key; ADR-0012 decision 3 says so and a pgTAP case pins that only admin policies exist.
- **Probe (rolled back):** a user after `mock_start` sees no `correct_option` or explanation in `mock_test_open`; direct select on attempts denied.
- Attempt IDOR: every taker function resolves the attempt by `(test, auth.uid())`, never a caller-supplied id. Injection: no dynamic SQL. XSS: no `dangerouslySetInnerHTML`/`innerHTML`. No dependency change, no secrets.

## Races (rewritten)
The first version said submit and save were safe because they locked the attempt row, and that "submit is idempotent". Both were true only of `4a402b4`, which was safe against take-back only because withdraw refused when any attempt existed. Finding 1 asked for that guard to go, and the fix removed it: **the first version missed the window its own finding 1 opened.** At `736f987` submit and save took only the attempt row while withdraw deleted in-progress attempts, so a submit could commit between withdraw's check and its delete (found in review-5 round 2).

At `3e20c19` (verified at source):
- **Lock order everywhere:** test row first, then attempt row. Release, withdraw (`:280`, `:310`) and question writes (`:150`, `:360`) take the test row `for update`; start (`:500`), save (`:526`) and submit (`:574`) take it `for share` and require `status = 'released'`.
- **Withdraw** checks for a submitted attempt, then deletes only `submitted_at is null` rows (`:327`); answers cascade. No submit can land between check and delete; a save or submit that waited finds the test not released and raises `not_found`.
- **100-question cap** holds under the `for update` lock.
- **"Idempotent"** holds for a repeat submit only (returns the stored score).
- No deadlock: same lock order on every path. Two-session test is S8 (`mock_tests_admin.test.sql`); read, not run.

## Threat model
| Asset | Attacker | Control | Residual |
|---|---|---|---|
| Answer key and explanations | Taker or stranger | Attempts/answers no grant; on the question table the admin-only select policy is the only protection; revealed only by `mock_test_open` after the caller's own submit | L-6; a future taker select policy would leak the key |
| Other people's attempts | Any user | Attempt looked up by `auth.uid()` only | None found |
| Test integrity | Non-admin, admin without aal2 | RLS, aal2, freeze triggers, column grants, test-row locks | None found |

## Findings and status
1. **Take-back blocked by any attempt (was Should-fix): fixed in `736f987`, race closed in `3e20c19`.** Only a submitted attempt blocks; in-progress attempts are deleted. Known limit (ADR-0012): after a submit, a wrong key is fixed by releasing a new corrected test. A taker mid-test loses progress on take-back.
2. **Key effectively public (was Should-fix): accepted as L-6**, recorded in ADR-0012. Requiring ≥ 1 answer before submit deferred.
3. **Silent no-op insert for a missing test: fixed in `736f987`** — raises `not_found` (P0002).
4. **Privacy: Note, open.** Scores kept until the account is deleted; attempts cascade with the profile; `created_by`/`released_by` go null. Add a privacy-notice line (Saurabh).
5. **Unbounded tests and attempts: Note, no action.** Bounded by admins and one attempt per person per test; largest payload ≈ 600 KB.
6. **Error codes** `invalid_option` / `invalid_question` leak no key. No action.
7. **Coverage note A: accepted.** No rate limit on `mock_start` / `mock_save_answer`; bounded by one attempt per test and 100 answers per attempt.
8. **Coverage note B: accepted.** Release and take-back write no audit row; `released_by`/`released_at` are the only trace.
9. **Note, new:** taker `for share` locks make an admin's `for update` wait for current takers' transactions; short, acceptable; watch with many concurrent takers.
