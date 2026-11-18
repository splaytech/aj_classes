# BUG-1 — The closing date picker overflows a 375 px window with a mouse

- **Row:** BR-1 (AC 26). **Severity:** Minor. **Kind:** app bug.
- **Build:** `feature/mock-test-closing` at `dc516b9` (code as at `1a1260a`), local stack, dev server on :5173, installed Chrome via Playwright.

## Steps
1. Sign in as `admin@local.test` in a 375 × 800 window (fine pointer: desktop Chrome, `isMobile: false`).
2. Open a tagged draft with a question (`t7-<RUN>-k-draft`), press **Release**.
3. In the Release dialog press the calendar button in **Closes (optional)** ("Choose date").

## Expected
`document.documentElement.scrollWidth - clientWidth` → `0` (plan §3.6, BR-1, page 3), light and dark.

## Actual
- Overflow `114` px in light and in dark. The desktop picker popper is `489` px wide in a 375 px viewport, so the time columns and the OK button extend past the right edge and the page scrolls sideways (`run-1/shots/BR-1-release-dialog-375-light.png`, `…-375-dark.png`).
- The same page at 375 px with `isMobile: true, hasTouch: true` (a touch phone): overflow `0`. MUI switches to its mobile picker on a coarse pointer (`run-1/shots/BUG-1-picker-375-touch-true.png`, and `-touch-false.png` for the fine pointer).
- 1280 px: overflow 0. Every other BR-1 page: overflow 0 at all four sizes.

## Notes
On a phone the mobile picker is used and nothing overflows. The bug shows on narrow windows with a mouse or trackpad, for example a resized desktop window or a tablet with a pointer. The same `ClosesField` is used by Set closing date, so it presumably has the same popper, though only Release was measured.

**Round 2 (`0ea0923`): retested, PASS.** BR-1 page 3 overflow 0 at 375 in light and dark; BR-1b: at 375 with a fine pointer, Release and Set closing date open the mobile dialog picker, overflow 0; at 1280 the desktop popper opens (`run-2/shots/BR-1b-*`).
