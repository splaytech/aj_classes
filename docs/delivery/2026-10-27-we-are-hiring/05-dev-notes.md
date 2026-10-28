# 05 — Developer notes: "We're hiring" page (web, `feature/we-are-hiring`)

Stage 5 of `/deliver`, Developer. Date: 2026-10-27. Plan: [04-plan.md](04-plan.md), T1 to T6 ticked. Branch is local only and not pushed.

## What was built

1. **`/careers` page.** It is pre-rendered like `/privacy` and uses `SiteLayout`. It has one h1 and four h2 blocks (Roles, Who we're looking for, What you'll need, How to apply). The lists use default disc bullets. There is an "Email your application" button (`mailto:hello@ajclasses.com.au?subject=Tutor%20application`), the address appears as plain text, and there is a "Back to home" link. The page exports its own `ErrorBoundary`.
2. **Copy.** All wording is in `apps/web/src/constants/careers.constants.ts`: `CAREERS` and `careersApplyHref()`. The subject line is typed once, as the private `APPLY_SUBJECT`. Only `BUSINESS.email` and `BUSINESS.suburbsText` are used. No person, street address, ABN, pay, hours or dates.
3. **Footer.** The legal row now reads News (when there are posts), Parent guides, **We're hiring**, Privacy Policy, then Sign in (when the portal is on).
4. **Sitemap.** `/careers` is in `ALWAYS_LISTED`, so it is listed with or without Supabase.
5. **Checks.** `/careers` was added to the Vercel CSP path test, the CSP e2e `PAGES` list and the Lighthouse URLs. There is no policy or hosting change.

## Check results (2026-10-27, CI placeholder env from `ci.yml:116-124`)

| Check | Result |
|---|---|
| `pnpm check` (format, lint, typecheck, test, build) | Pass. 63 files and 542 tests (baseline was 62 and 527: 11 new in `careers.test.tsx`, 3 in `Footer.test.tsx`, 1 in `sitemap.test.ts`). |
| `check:hosted-ref build/client` | 0 files (of 156 scanned) |
| `check:structured-data` | 19 pages, 0 problems |
| `lighthouse` (7 URLs × 3 runs) | All assertions pass. `/careers`: accessibility 1, SEO 1, best practices 1, performance 0.94 to 0.95. |
| `lighthouse:report` | 21 runs, 0 supabase.co requests. `/careers` JS is 179.7 KB, the lowest of the 7 pages. |
| `test:csp` | 21 of 21 pass (was 19). `/careers` passes at 360 px and 1280 px. |
| Mirror curl | `/careers` returns 200, with `<title>Careers \| AJ Classes</title>` |
| AC-21 | Production: 0 `name="robots"` tags on `/careers`, and `robots.txt` has no `Disallow: /` line. Staging: 1 tag, an exact `Disallow: /` line, and the title `[STAGING] Careers \| AJ Classes`. Rebuilt as production afterwards. |
| AC-25 to AC-30 diff | `git diff develop` touches no `services/`, `sections/contact/`, `supabase/`, `package.json`, lockfile, `.env*`, `vercel.json`, `serve.railway.json` or `content.constants.ts`. No `console.*`, inline style or TODO was added. |

**Smoke check (developer, Playwright measurements on the mirror; not a substitute for the Tester's manual ACs).** At 375 px and 1280 px, `/careers` and `/` have no horizontal scroll. The apply button is 57 × 241 px, so it meets the 44 px target. The page lists use `disc` bullets. The footer link has the same colour and font size as "Parent guides". There were 0 console errors and 0 console warnings on both pages.

## Deviations from 03

1. **Meta test (1h) checks exact tag objects.** It uses `toContainEqual({ title: environmentTitle(CAREERS.seo.title) })` and `{ name: 'description', content: … }` instead of "the title ends with". Reason: `MetaDescriptor` is a union, so reading `.title` or `.content` doesn't typecheck. The exact match is also a stricter test. The length and suburbs checks run on `CAREERS.seo.description` itself.
2. **AC-13 wording test.** I put it in its own `it` next to 1d, not inside 1d.
3. **AC-21 command in 04 T6.6 changed** from `grep -c 'Disallow: /'` to `grep -cx 'Disallow: /'`. The plain grep also matches production's `Disallow: /portal`, so it returned 1 on both builds.
4. **Review 4 folded into 04:** the exported env block (item 1), the Playwright install before Lighthouse (item 2), the extra definition-of-done line (item 3), and no second build in T6.2 (item 4).

Everything else follows §2 to §8 exactly, including the anchor lines, which matched.

## For the Tester

1. Manual ACs still to do: 4, 5, 6, 10 (a real mail client on desktop, iOS Safari and Android Chrome), 14, 15 (axe DevTools and keyboard walk), and 23 (DevTools console). Also write the TSR.
2. Build first, with the placeholder env exported (see 04). Then run `pnpm --filter web mirror` on 4173, and stop it before any `lighthouse` run, because lhci uses the same port.
3. On a 375 px full-page screenshot, the fixed WhatsApp button lands on top of a list item. It does that on every page, so it isn't a careers layout issue.
4. `kinet validate` can't run in this worktree ("KINET not initialised"). The repo rules it checks are covered by ESLint (`jsx-no-literals`, and others) and the diff greps above.
5. No local Supabase was used or touched.

## Not verified by me

1. A real mail client opening the mailto link (AC-10, manual).
2. axe DevTools and the screen reader pass (AC-15, manual). Lighthouse accessibility was 1.
3. The CI run itself. Nothing was pushed.
