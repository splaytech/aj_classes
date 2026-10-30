CHANGES_REQUESTED

# Review 6a: 06-test-plan.md (round 1)

Plan base `0ee9232` (code at `f128e8c`). Read against 01 (AC 1–41), 03 §8, 05 (fix batches 1 and 2) and 06-security, with expected values checked against the source and GoTrue v2.197.0, read-only. Strong: expected values come from the source (the `#token=` link, the AC 9/10/29 strings, `invite_invalid`, `no-store`, 336 h, the `Invited on` format); fixtures use reachable states (F-1, F-4, F-6, F-8; TC-32b matches GoTrue's expiry rule); every gate is fenced with a planted-bad proof; every AC has a case that fails a wrong build; the UI matrix covers 375/1280 × light/dark; security finding 1 is covered on the dev server (TC-8, UI-1a, TC-10a, E-9 with history +1 per re-open).

## Blocking

1. **PROD-1 checks only the first render on the production build** (`:390-422`, E-9 `:872-896`). Both bugs in this family were timing bugs that differed between builds. Add `BASE=http://127.0.0.1:4173 node "$T/pw-reopen.mjs" abc` with the mirror up: `b0`–`b3` and `a1` at `/portal/invite`, `b1`/`a1` show Continue, `b1.historyLength = b0 + 1`, `a0` incomplete. Assert `sameDocument: true` at `b1` and `a1` in both runs (dev and 4173).

## Non-blocking

2. TC-11 and S-5's rate-limit check pass with no limit. After 10 unknown-token redeems from address A, a valid token from A must be refused (`used_at` still null) and the same token from B must succeed; `invite_redeem_attempts` grows by 10, not 11.
3. PROD-1's build line must set `VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA` explicitly (`:398`).
4. §0.1 says 416 (`…/141`); S-5 and 05 say 413 (`92/30/153/138`). Fix §0.1 and cite fix batch 2 in S-5.
5. "Not covered — for Saurabh": add other browser engines (or run `pw-reopen.mjs abc` and `pw-states.mjs` under WebKit and Firefox if installed), the production host's headers on the real domain (a `curl -sI` in release step 1), and the hosted rate-limit key (accepted residual).
6. E-9 `d new tab`: also expect L2's `used_at` unchanged and nothing redeemed.
7. TC-17: write down the expected landing URL from the dry run (probably two-step setup), so landing on `/portal/join` fails clearly.

## Round 2

APPROVED

All 7 round-1 findings are fixed. PROD-1 runs `pw-reopen.mjs abc` on the 4173 mirror in Chromium and WebKit, with `sameDocument: true` at `b1` and `a1` and history +1 at each re-open; E-9 asserts the same on the dev server. TC-11r fails a build with no limit. The Turnstile key is explicit and grepped in the bundle. Counts are 413 functions, 657 web and 57 feature tests, with the re-derive guard keyed on `0e6c200`. "Not covered" lists browser engines, production headers and the hosted rate-limit key. E-9 `d` and TC-17 are exact. E-10 (fix batch 3) can fail: `CONTROL=1` must print `refusedSeen: true`.

Nits (the Tester fixes them in place before freezing): 1. "Not covered" item 5 lists the WebKit cases twice. 2. E-10 covers a late refusal only; say that the late-success path is covered by the `invite.test.tsx` unit case (S-3).
