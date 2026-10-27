APPROVED

# Review 5: code (round 1)

**Scope:** `289973f...HEAD`, 7 commits, 17 files. Read-only: `pnpm lint` passes, `pnpm typecheck` (web and e2e) passes, and `pnpm --filter web test` runs 63 files / 542 tests, all passing.

**Verified:**
1. The exact AC-10 href is pinned, and the subject is typed once.
2. One h1 and four h2s in order, with no h3–h6. The apply text says what it does, the address is also plain text, there's no new tab, and one Back-to-home link.
3. The footer order (Footer.tsx:81) is tested on the real rendered order, with News on and off.
4. `/careers` is in `ALWAYS_LISTED` (tested with and without Supabase), prerender, `routes.ts` before `*`, both CSP lists and Lighthouse.
5. Repo rules hold: copy in constants, no inline styles, keyed lists, no console, any or TODO, its own ErrorBoundary, co-located tests and conventional commits.
6. There's no owner name, street address or ABN.
7. The deviations in 05 are justified.
8. Nothing on the must-not-change list was touched.

## Blocking

None.

## Non-blocking

1. **`04-plan.md:11`:** the code fence doesn't close (text follows the ```).
2. **`careers.test.tsx:292-295` and `309-313`** check the constants, not the rendered page. That's acceptable for the AC-12 guard, but don't count them as behaviour tests.

**Lead note:** finding 1 fixed in place.
