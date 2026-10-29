APPROVED

# Review 5: code for "invites stay valid for 14 days" (round 1)

Read `git diff 6a7d861..d35311c` in full (10 commits, 64 files) against 01–05, ADR-0010, the repo `CLAUDE.md` and the developer addendum. Read-only runs: Vitest on the 7 new or changed web test files (47/47); catalog reads (three `security definer` RPCs with `search_path=""`, EXECUTE only for `postgres`/`service_role`, both `private` tables RLS on with a `postgres`-only ACL, trigger columns as designed); a rolled-back temp-table reproduction of the guarded `invited_at` CASE and of `rate_limited` (`P0001`). The migration is byte-identical to the 03 §2 SQL.

Confirmed: the redeem identity check never deletes on `recovery`; refusals are uniform; the rate limit writes nothing and never claims when limited; claim and release are correct on every path; logs hold reason names only. `issueInvite` stores only on `sent`; first-time invites delete only the id they created; a re-send writes nothing on failure; the kill switch returns before anything is created. Locks can't deadlock. Deviation 1 (`797a25f`) is sound and small. `/portal/invite` clears the address bar before any request. `auth-confirm` refuses `type=invite` with no service call. Constants and house rules are met. The `_shared/email` move is behaviour-neutral. Fixtures use reachable states.

## Findings (all non-blocking)

1. `invite.tsx:47` reads the token in a `useState` initialiser. That's correct given `HydrateFallback`, but it was only checked on the dev server. Tester: open `/portal/invite` with a token once on a `VITE_APP_ENV=production pnpm build` preview and confirm Continue shows; record it in the TSR.
2. Deviation 1 is unit-tested only on the staff page. Add `admin-student.test.tsx` (success reloads, failure doesn't) for the student account section and parent rows, or list both in the TSR.
3. `redeem.ts:51`: if `release` throws after a refusal the client gets a 500; add one unit case (`recoveryLink` null and `release` rejects → rejects, no `deleteUser`).
4. `test-invite-redeem.mjs` `rateLimitChecks`: rename "10 redeems from one address are answered" to say it only fills the bucket.
5. Close-out (team lead): ADR-0010 to Accepted, DEC-IN-1..8 into `_knowledge/decisions.md`, smoke count 9 → 10 in `_agents/tester.md`.
