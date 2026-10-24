# BUG-1 — Duplicate `robots` meta tag on 404 and newsletter-confirmed pages outside production

- **Status:** Fixed in c85ac2f (round 2: S4, S5, S6 pass)
- **Severity:** Low (console error in dev/staging; production unaffected; pre-existing on `develop`, not introduced by this branch)
- **Found:** Round 1, case S4 · local dev server `http://localhost:5191`

## Steps to reproduce
1. Run the web app locally (`VITE_APP_ENV` = development or staging).
2. Open any unknown URL, e.g. `/signin`, or open `/subscribed`.
3. Open the browser console.

## Expected
No console errors. The page head has exactly one `<meta name="robots" content="noindex">`.

## Actual
React logs: "Encountered two children with the same key … {"name":"robots","content":"noindex"}".
The page head has two identical `robots` tags.

## Cause
Outside production, `buildPageMeta` (`apps/web/src/lib/seo.ts`) already adds `noIndexMeta()`.
`routes/not-found.tsx` and `routes/subscribed.tsx` append a second `noIndexMeta()` on top.

## Evidence
Console capture, Claude in Chrome tab on `/signin` → 404 page, 2026-10-25 10:48:51.
