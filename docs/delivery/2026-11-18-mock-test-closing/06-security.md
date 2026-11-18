# 06 — Security review: mock test closing and categories (stage 6b)

Security, 18 Nov 2026. Pinned to `5cb0810`. Read the closing migration (`20261119100000`), the categories migration (`20261120100000`), the base migration's grants and RLS, `private.is_admin()`, the service and `config.toml`. Nothing was run against any database. No hosted service was touched.

**Verdict: PASS. No blocking findings.** Blocking 0, Should-fix 0, Note 5.

## Answers
1. **Writing the closing time, tags, release or close needs an admin at aal2.**
   - `mock_release`, `mock_set_closing`, `mock_close_now` and `mock_withdraw` each start by checking `private.is_admin()`.
   - `closes_at`, `status` and `released_*` aren't column-granted to anyone.
   - Tag writes go through the admin-only RLS policies.
2. **After close, a taker with no submitted attempt gets nothing.**
   - `mock_test_open` returns 404, the same as for a draft.
   - `mock_tests_for_me` filters the test out.
   - start, save and submit require the test to be open, under `for share`.
   - Questions are readable by admins only. Attempts and answers have no grant.
3. **A submitted taker sees only their own result.** The attempt is found by `auth.uid()`, and the key is shown only after the caller's own submit.
4. **Every new or recreated function and trigger is hardened.** Each is security definer with `search_path=''`, has no dynamic SQL, and has execute revoked and then granted to authenticated only. The trigger functions aren't executable by anyone. Functions that were dropped and recreated are re-revoked.
5. **The tag grants bypass nothing.**
   - The freeze is unchanged.
   - `status` isn't granted.
   - A release is judged on a locked read of the row, by both `mock_release` and the draft→released trigger.
   - Trigger order and the self-lock are sound.
6. **The options table is closed to clients.** It is in `private` with RLS on, no policy and no grant, and it isn't exposed through the API.
7. **The errors and hints leak nothing.** A closed test, a draft and an unknown id all return the same 404.
8. **No new dependency.** No lockfile or env change, no `innerHTML`, no secrets.

## Notes
1. **A non-admin can probe which option values are active.** The guard runs before RLS on insert. The values are already public constants and no row is written. Optional fix: check `is_admin()` at the top of the trigger.
2. **`closes_at` has no upper bound.** Admin-only and harmless.
3. **Reopening re-exposes a closed test, and there is no audit row.** This is by design (AC 4).
4. **Close timing uses `now()`.** Waiters re-check under the lock, which is sound.
5. **The Privacy Policy line is still open for Saurabh,** carried over from the prior review.

## Threat model
| Asset | Attacker | Control | Residual |
|---|---|---|---|
| Closing time and release state | Non-admin, aal1 or anon | Definer functions gated on `is_admin()` (aal2); closing and release columns ungranted | None |
| Tags | Non-admin | Admin-only RLS, guard trigger, release trigger | Note 1 |
| Options table | Any client | `private` schema, no grant or policy | None |
| Answer key | Taker without a submitted attempt | Admin-only questions; 404 when closed unless submitted | L-6 (accepted) |
| Others' results | Signed-in user | Attempt found by `auth.uid()` only | None |
| Existence of a closed test | Non-submitted taker | Identical 404 | None |
| Concurrency | Racing admin and taker calls | Same lock order everywhere; locked reads in both triggers | None |
| Supply chain | n/a | No dependency change | None |
