APPROVED

# Review 4: plan (round 1)

**Verified:**
- T1–T5 are thin slices, each with named files and a check.
- Every file and edit in 03 is covered.
- Review 3 items 1 and 3 are folded into T6 (CI order with port 4173 free; `grep -c 'name="robots"'`).
- `CI_ENV` matches `ci.yml:116-124`: placeholders only, no secret or hosted reference.
- The CHROME_PATH guidance matches CI.
- The CSP e2e count goes from 19 to 21.
- There's no PII.

## Blocking

None.

## Non-blocking

1. **`CI_ENV` is shorthand.** Expand it inline, or `export` the variables first.
2. **Before T6.4,** run `pnpm --filter aj-classes-e2e exec playwright install chromium`. Leave out `--no-sandbox` on macOS.
3. **Definition of done:** add "manual ACs (4, 5, 6, 10, 14, 15, 23) pass and the TSR is written".
4. **T6.2's second build is redundant** after `pnpm check`.

**Lead note:** these are folded into the Developer's brief. The Developer applies 1–3 in `04-plan.md` while ticking.
