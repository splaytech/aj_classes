CHANGES_REQUESTED

# Review 6a: test plan (round 1)

**Verified:**
- Every AC from 1 to 30 is traced.
- Nine spot-checked expected values match the build and source: 18 HTML rows; sitemap has 14 locs with `/careers` last; no exact `Disallow: /`; title; canonical; description; mailto scoped to main; footer row string; JSON-LD counts.
- S-3 (20/3) and TC-26a (16/3) counts match, and `axe-core@4.13.0` is present.
- BSD tooling is safe.

## Blocking

1. **:49 S-1:** `${PIPESTATUS[0]}` is bash-only, so in zsh it prints `exit=` with nothing after it. Use `pnpm check > "$T/check.log" 2>&1; echo "exit=$?"`.
2. **:36 / :102:** it says "four" scripts but there are five, and `shots.mjs` never runs, so the TC-4b and TC-14b screenshots don't exist. Say "five" and add `&& node shots.mjs`.

## Non-blocking

1. **Env and `$T` don't carry across tool calls.** Put the `export …; T=…` line at the start of each block, especially TC-17b :219, where a bare `pnpm build` would leave a staging build.
2. **:96 / :319:** "`git status --short` empty" is already false. Commit the plan first and check for no changes outside the delivery folder.
3. **TC-23:** optionally wait 500 ms before reading the console.
4. **TC-6 :134:** the grep is supporting evidence only.

## Lead's ruling

Agreed. TC-12b, TC-15c and TC-10b/c/d leave the frozen set and go to "Not covered, for Saurabh". **Condition:** the TSR reports AC-10 as "href verified; device behaviour not verified, Saurabh to check before production", not a plain PASS. Rename the section at :13-15 to match.

---

## Round 2

APPROVED

B1 (:52), B2 (:37, :117), N1 (every block sets up its own env; TC-17b builds staging then production in one shell), N2 (:104, :350), N3 (:414) and N4 (:146) are fixed. The ruling is applied: TC-10 (:184) gives the exact partial-verification wording, and TC-4b, TC-14b and TC-26b stay in the pass/fail set. `bash -n` on `gates.sh` passes.
