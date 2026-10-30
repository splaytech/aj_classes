# Review 5: Development (stage 5), header "We're hiring" link

Reviewer, 30 Oct 2026. Branch `feature/header-hiring-link`. Checked `git diff develop...HEAD` (7 source files, 3 superseded-note docs, `05-dev-notes.md`) against 01–05 and review-1 to review-4. Read all of `Header.tsx` and the ≥1024px and band blocks of `Header.module.css`; grepped `apps/web/src` and `e2e` for `footerLink`, `careersLink`, `linkLabel`; ran the header and footer test files (2 files, 18 tests, all pass). No build run; no repo files changed.

## Verdict: APPROVED

## What holds

1. **DEC-HL-1:** `CAREERS.linkLabel` (`careers.constants.ts:13`) and `NAV.careersLink` (`content.constants.ts:56`), read by header (`Header.tsx:123-131`) and footer (`Footer.tsx:81`). No old-name usages; no import cycle.
2. **DEC-HL-2:** plain `<li><a>` after the `hasNews` block, before `.actions`; `onClick={closeMenu}`, `aria-current` via `isCurrentPage`, stable `key`; no class, icon or `trackEvent`.
3. **AC-4 (code):** nothing wraps the `<li>` — not `hasNews`, the portal flag or a route check.
4. **AC-7 (CSS):** `.links > li > a, .signIn` covers all 7 top-level links and Sign in; band rules only change gaps; nothing hides this link alone. T7 guards against a class being added.
5. **DEC-HL-3:** matches 03 §3; measurements (14/83/110/110/46/46, icon 20px) match 02; sub-links and Register Interest stay 18px.
6. **DEC-HL-4/5:** medium weight, no icon; both News tests edited, not deleted.
7. **Tests meaningful:** T1 (news off/on, count, last, href, News just before), T5 fails without `closeMenu`, T6 checks careers sends nothing and Register Interest still sends `cta_click`, T4 covers the trailing slash and non-current pages.
8. **Stale comments and docs updated** (header comment, band comment, News comment, 2026-10-27 D1/decision 1, both PRP lines).
9. **Repo rules:** no magic strings, inline styles, `console.log`, TODOs or new dependencies; conventional commits with both trailers; `actionItems.md` not staged.

## Findings

1. **Non-blocking:** T3's Sign in check only runs when `APP_CONFIG.features.portal` is on (env-dependent), and no unit test renders with the portal flag off; AC-4's portal-off case rests on code review. A later `it.each` mocking the flag both ways would close it.
2. **Non-blocking:** the 14px gap at 1024 is Chromium-only; the Tester checks Safari/WebKit at 1024 before signing off AC-5. Longer labels must be re-measured.
3. **Nit:** some assertions compare constants to constants (`Footer.test.tsx:57`, T2). Harmless; leave them.

## For the Tester (stage 6)

AC-5, AC-6, AC-8, AC-10 and AC-13 by hand with News and portal on (15px desktop text is intended); e2e smoke; Safari at 1024.
