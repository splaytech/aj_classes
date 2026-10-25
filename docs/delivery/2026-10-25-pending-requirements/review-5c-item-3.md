CHANGES_REQUESTED

# Review 5c — item 3, round 3 fixes (BUG-9, review-5b follow-ups)

- **Scope:** `git diff 1dc433c..330b2cc` (`f0ef851`, `39c3154`, `d01f43b`, `330b2cc`), plus E2E `488dde1`.
- **Read against:** BUG-9, `05-dev-notes-item-3.md` §9 "Round 3 fixes", `review-5b-item-3.md`, `CLAUDE.md`.
- **Checks run:** format:check, lint and typecheck are clean; `pnpm test` passes 390 tests. `db:test`, E2E and servers were not run, because the Tester was using the stack.
- **Recorded by:** the team lead, from the Reviewer's hand-back.

**Why the verdict:** the runtime code looks correct. But the two rules that keep the shared access read safe have no test that would fail if they broke:
- keying the shared read on the access token;
- clearing it when the read fails.

## Answers to the brief
1. **Can one user's answer, or a stale answer, leak to another caller?** No.
   - The shared read is keyed on `session.access_token`, so a new sign-in or a token refresh reads afresh.
   - The guard at `auth.service.ts:140` stops a late-finishing read from clearing another session's entry.
   - Invite → join and the two-step admin flow both read fresh.
   - One small window remains: a caller can share a read that started just before a role change on the same token. Accepted.
2. **Is the shared read cleared on both success and failure?** Yes, via `state.then(finished, finished)`. This is untested (finding 2).
3. **Can a right-role person get a wrong `notAllowed`?** No. `getFamilyClient` uses the same role rule as `PAGE_AREAS`.
4. **Are network and other errors still kept apart from `notAllowed`?** Yes, through `attempt()` and `toErrorKey`. This is untested (finding 3).
5. **Are the tests adequate?** `family-access.test.ts` is good. `auth-access.test.ts` has gaps.
6. **Are the review-5b findings resolved?** Findings 1, 2 and 6 are resolved. Finding 3 no longer applies, because the function was removed.

## Findings
1. **Blocking (test only).** `auth-access.test.ts:47-53` makes its two calls one after the other, so it passes even if the token check is removed. Fix:
   - Hold the token-1 read open, switch to token-2, and expect 2 reads.
   - Also cover the `:140` guard: a third call made at the same time on token-2 must share token-2's read, so there are 2 reads in total.
2. **Blocking (test only).** No test checks that a failed read is cleared and not stuck. Fix: make the read fail once, assert that the call rejects, then that the next call reads again and resolves.
3. **Non-blocking.** `family-access.test.ts` has no case where `getAccessState` rejects. Add an `it.each` over the reads: expect `network`, not `notAllowed`, and no RPC.
4. **Non-blocking.** Family RPCs now wait for the access read, which adds one round trip on the right-role path. Record this in the dev notes as a known cost.
5. **Non-blocking.** One-read sharing is verified on the dev server only. In a production build, it could cost one extra profile read, but never a wrong answer.
6. **Nit.** `readAccessState` calls `getSupabase()` again; it could take the client instead. Optional.

## Team-lead disposition
- 1, 2, 3: Developer, test-only changes. Re-review of the test diff only.
- 4: one line in the dev notes.
- 5: accepted. A staging measurement would mean using the shared hosted project, which is Saurabh's to touch. Recorded as follow-up `ITEM3-FU-3`, to measure after the release.
- 6: skipped.

## Re-review (round 2): APPROVED
The team lead re-reviewed the test-only diff `330b2cc..af19de2`, as the Reviewer recommended. Only the 2 test files and the dev notes changed.
- **Finding 1:** the shared read is now tested with two people. The token-1 read is held open while token-2 reads, and the `:140` guard is covered by a third call made at the same time on token-2 (2 reads in total).
- **Finding 2:** a failed read is now shown not to stick.
- **Finding 3:** all 7 family reads now return `network` when the access read rejects.
- **Finding 4:** the dev notes record the extra round trip.

The Developer showed each test fails against the weakened runtime code, and `pnpm test` passes 398 tests.
