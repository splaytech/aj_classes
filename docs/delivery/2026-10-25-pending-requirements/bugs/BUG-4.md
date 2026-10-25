# BUG-4 — A post with a long URL or long word makes /posts scroll sideways

- **Found:** 2026-10-25, `/test-and-ship` item 1, added cases N-70 and N-72 · **Build:** `feature/pending-requirements` @ `ea18539`
- **Severity:** Medium. A normal post that contains one link (an enrolment form, say) makes the whole News page scroll sideways on a phone. The post cards run off the right edge. This breaks the site-wide "no sideways scroll" rule that the public page sweep checks (N-57) as soon as such a post exists. Item 1 is what makes `/posts` visible to every visitor (header, footer and sitemap links). The card CSS itself is older (`69353a5`).

## Steps to reproduce

1. Local stack, production build served on :4173 (Vercel mirror).
2. Publish a post (admin page or SQL), title `Enrolment form for Term 1`, body
   `Enrol here: https://forms.example.com/ajclasses/term-1-2027-enrolment-form?utm_source=website&utm_medium=news&utm_campaign=term1`
3. Open `http://localhost:4173/posts` at 375 × 812.
4. Measure `document.documentElement.scrollWidth - clientWidth`.

## Expected

Overflow **0**. Long words and URLs wrap inside the card, as on every other public page.

## Actual

| Content | 375 px overflow | 1280 px overflow | Card right edge at 375 |
|---|---|---|---|
| Body with the URL above (N-72) | **217 px** | 0 | 592 px (viewport 375) |
| Title of 120 characters with no spaces (N-70, allowed by `maxLength` and the DB check) | **2178 px** | **1369 px** | 2553 px |

Every card in the list gets wider, not only the one with the long text. The `.posts` grid track sizes to the longest unbreakable string.

## Likely cause

`apps/web/src/routes/posts.module.css`: `.post`, `.post h2` and `.body` set no `overflow-wrap`, so an unbreakable string sets the grid track's minimum width. `white-space: pre-wrap` on `.body` keeps line breaks, but it doesn't break long words.

## Suggested fix

Add `overflow-wrap: anywhere;` to `.post`, and `min-width: 0` on the grid item if needed. Then add a test or check with a long URL and a 120-character title at 375 px.

## Evidence

- `docs/test-reports/2026-10-25-feature-pending-requirements/evidence/posts-N-72-375.png` (cards past the right edge, footer narrower than the page)
- `…/evidence/posts-N-70-long-title-375.png`, `…/posts-N-70-long-title-1280.png`
- The test posts were removed afterwards. The post count is back to 1.

## Retest — round 2 (2026-10-25)

- **Status: Fixed / verified.**
- **Build:** `4ef23a4`. The fix is `9ae81a2`:
  - `.posts` gets `grid-template-columns: minmax(0, 1fr)`;
  - `.post` gets `min-width: 0` and `overflow-wrap: anywhere`;
  - the admin list's card text box gets `minWidth: 0` and `overflowWrap: 'anywhere'`.

| Case | Page | 375 px overflow | 1280 px overflow |
|---|---|---|---|
| N-70: 120-character no-space title | `/posts` (production build, :4173) | **0** (was 2178) | **0** (was 1369) |
| N-72: body with the long URL | `/posts` | **0** (was 217) | **0** |
| N-73: both posts together | `/posts` | **0**, card edge 359 / vw 375 | **0**, edge 1168 / vw 1280 |
| N-73: both posts together | `/portal/admin/posts` (dev server) | **0**, edge 359 | **0**, edge 1168 |

- **Checks:**
  - The public page sweep (N-57) is still clean: 28 / 28.
  - Line breaks are still kept (N-71: `pre-wrap`, 4 lines).
  - The new E2E spec "long unbroken titles and URLs wrap" passes.
- **Evidence:** `docs/test-reports/2026-10-25-feature-pending-requirements/evidence/r2-N-73-posts-375.png`, `r2-N-73-posts-1280.png`, `r2-N-73-admin-posts-375.png`, `r2-N-73-admin-posts-1280.png`, `r2-posts-N-70-*.png`, `r2-posts-N-72-*.png`.
- **Clean-up:** the test posts were removed; the post count is back to 1.
