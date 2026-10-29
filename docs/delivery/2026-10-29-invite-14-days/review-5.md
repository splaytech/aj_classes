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

## Round 2 (fix batch 1, `d35311c..e70d769`)

CHANGES_REQUESTED

Fixed: the `redeem.ts` delete is gone (a mismatch refuses, releases once, warns with no id); `respond()` sends `Cache-Control: no-store` with no CORS change; the README kill switch matches the migration; reading the hash is safe on the production build (Continue shows; closes round 1 #1); nothing else reads the token from the address; the P-1 race fix is sound. Re-ran the four web test files (and the two admin files 5 more times): all green.

### Blocking

1. **`invite.tsx:51-54` strips the token only on the first load.** Opening the link again in the same tab is a fragment-only change: the page stays mounted, the `[]` effect never re-runs, and `#token=…` stays in the address bar and history (reproduced on the gate build: `history.length` 2 → 3 → 4, Continue still shown). This is security finding 1's shared-computer case and AC 8. The e2e at `invite-onboarding.spec.ts:86-88` should fail; the recorded 10/10 looks older than that assertion. Fix: key the effect on `location.hash`; whenever it holds a token, adopt it and clear the address with `navigate(PORTAL_ROUTES.invite, { replace: true })`. Add a unit test (`#token=A`, then `#token=B`: cleared again, Continue sends B), and keep the e2e's three `goto`s as the regression test. The decision to accept the same-tab "incomplete" state is withdrawn: this fix also removes it.

### Should fix (docs)

2. 02 and 03 still describe the query-string, clear-on-Continue design (`03-design.md:53`, `:368`, `:385`, `:562`, `:641-653`, `:788`, `:901`, `:997`; `02-architecture.md:123`, `:174`, `:320`). Describe the fragment, the on-load (and on-hash-change) wipe, `PORTAL_FRAGMENT.inviteToken`, and the e2e `search + hash === ''` check.

### Nits

3. `invite.tsx:5`: a 168-character comment line; reflow it.
4. `admin-student.test.tsx:179-181`: make the reload fixture change only the re-sent row (assert 2 → 1 "Invite expired").
5. `supabase/README.md:392-398`: a redeem in flight during the kill-switch `update` can set one link back to unused; say "run it again after a minute".

## Round 3 (fix batch 2, `2e3c3e1..221f0bc`)

APPROVED

Round 2 #1 is fixed (`invite.tsx:49-65`), checked on the gate build: a same-tab re-open of A, then B, leaves `/portal/invite` each time with history growing by one; going back three times never finds a token; there is no render loop and no double redeem; `?token=` is still ignored and wiped. The new unit test and the reworked e2e (a fresh page per open, plus a same-tab block) are sound; the round-2 expectation that the old e2e failed was wrong, and the Developer's before/after runs hold. The docs (#2) and nits 3–5 are fixed.

### Non-blocking (fixed in this branch)

1. **A late result from the first link can overwrite a re-opened link's screen** (`invite.tsx:57-58`, `:66-74`). Open A and click Continue (hangs); open B in the same tab and click Continue; A answers `invite_invalid`, and the page shows "expired" while valid B is in flight. Not a security issue, but the message is untrue. Fix: remember the token each request started for, drop the result after each `await` if it changed, and add a unit test.
