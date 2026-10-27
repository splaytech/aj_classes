# BUG-2 — E2E "newest-first" spec reads the /posts list before it loads

- **Found:** 2026-10-25, `/test-and-ship` item 1, case N-51 · **Build:** `feature/pending-requirements` @ `ea18539`
- **Repo to fix:** `~/dev/work/aj_classes-e2e` (test code, not the app)
- **Severity:** Medium. The release gate's E2E suite fails every time (2 of 2 runs), so it can't be green until the spec is fixed. The app behaves correctly.

## Steps to reproduce

1. Local stack up (`pnpm db:start`), dev server `pnpm dev --port 5173 --strictPort` with `VITE_LEAD_CAPTURE=on`.
2. `cd ~/dev/work/aj_classes-e2e && pnpm test tests/admin-posts.spec.ts -g "newest-first"`

## Expected

The spec passes: both marker posts are found in `li h2` on `/posts`, newer before older.

## Actual

It fails at `admin-posts.spec.ts:93`: `expect(newerIndex).toBeGreaterThanOrEqual(0)`, received `-1`. It failed in the full run and again on the single re-run.

Cause: the spec waits for the `h1` "Latest news", then calls `postTitles(page).allTextContents()` straight away. Since item 1, `/posts` is pre-rendered. The `h1` is in the static HTML, and the list loads after mount (ADR-0001), so `allTextContents()` doesn't wait and returns `[]`.

Measured on the dev server (5 of 5 loads), the moment the heading is visible:
`li h2` = `[]` while "Loading the latest news…" is shown. Once the list has loaded, `li h2` = `["Term 4 classes start on Monday"]`.

The Playwright failure snapshot (`error-context.md`), taken just after the assertion, already shows the newer marker post listed. That confirms a timing race, not missing data.

## Suggested fix (E2E repo)

Before reading titles, wait for the list itself, for example
`await expect(publicPostsSelectors.postTitles(page).filter({ hasText: newerMarker.value })).toBeVisible()`.
Or use `expect(locator).toContainText([...])`, which retries.

## Evidence

- `docs/test-reports/2026-10-25-feature-pending-requirements/evidence/e2e-newest-first-failed-run1.png`
- The same behaviour checked by hand in N-52 (create, edit and delete all show correctly on `/posts`) and N-06.
- No `e2e-%` rows were left behind (N-53 = 0).

## Retest — round 2 (2026-10-25)

- **Status: Fixed / verified.**
- **Build:** app `4ef23a4`, E2E repo `feature/playwright-e2e-harness` @ `f5b7024`. The fix is `e7020d8`: the spec now waits for both marker posts to be visible before reading the order.
- **Full E2E suite (N-51 / N-75):** **9 passed, 0 failed**. That is the 8 specs from round 1 plus the new "long unbroken titles and URLs wrap" spec.
- **Stability:** `pnpm test tests/admin-posts.spec.ts -g "newest-first" --repeat-each=5` → **5 passed**.
- **Clean-up:** 0 `e2e-%` rows left (N-53).
