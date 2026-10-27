# Test Summary Report — we're hiring page

- **Date:** 2026-10-27 · **Branch:** `feature/we-are-hiring` @ `27963cb` (app code identical to the plan's dry-run build `0aba784`; `git diff 0aba784 27963cb --stat -- apps e2e` is empty)
- **Environment:** local production mirror `http://127.0.0.1:4173` (`pnpm --filter web mirror`), CI placeholder env from `ci.yml:116-124` (`VITE_APP_ENV=production`, empty Supabase URL and key, `VITE_FORM_ACCESS_KEY=local-placeholder`, `VITE_KIT_FORM_ID=0000000`). There was no Supabase, local or hosted, and no hosted calls. macOS, Node 24.15.0, Playwright Chromium 1248. For TC-26b only, `develop` @ `8e2af88` was built in a temporary copy and served on `:4174`, then removed.
- **Plan:** [06-test-plan.md](06-test-plan.md), frozen at `27963cb`. I ran every case exactly as written, with the appendix scripts taken from the plan unchanged.
- **Full check:** `pnpm check` exited 0 with **63 test files / 542 tests passed** (format, lint, typecheck, test, build).

## Round 1

| ID | Area | Case | Expected | Actual | Result |
|---|---|---|---|---|---|
| S-1 | Suite | `pnpm check` (AC-24) | exit 0; 63 files / 542 tests | exit=0; `Test Files 63 passed (63)`, `Tests 542 passed (542)` | PASS |
| S-2 | Build | hosted-ref, structured data | `0 files (of 156 scanned)`; `19 pages, 0 problems` | `check-hosted-ref: 0 files (of 156 scanned)`; `check-structured-data: 19 pages, 0 problems` | PASS |
| S-3 | Unit | careers, sitemap, footer tests | 3 files / 20 tests | `3 passed (3)`, `20 passed (20)` | PASS |
| S-4 | Build | static gates on 18 HTML files | `gates: 0 failures`, no FAIL lines | `gates: 0 failures` (run again after the staging and production rebuild: 0) | PASS |
| S-5 | CSP | `test:csp` | 21 passed, `/careers` at 360 and 1280 | exit 0, `21 passed (33.1s)`; tests 7 (360 px) and 17 (1280 px) for `/careers` passed; port 4173 freed afterwards | PASS |
| S-6 | Lighthouse | lhci and report | exit 0, 7 URLs / 21 runs, all processed, `/careers` listed, 0 supabase.co | exit=0; `Checking assertions against 7 URL(s), 21 total run(s)`, `All results processed!`, 0 failure lines; `/careers` 179.7 KB; `21 runs, 0 supabase.co requests`; `git status` clean | PASS |
| TC-1 | Footer | link on every public page (AC-1) | 1 `href="/careers"` per file; sweep n=1 vis=true on 18 rows | gate 0 failures; 18/18 rows `n=1 vis=true` | PASS |
| TC-2 | Footer | href `/careers`, same tab (AC-2) | exact anchor; `tgt=null` | gate passed; 18/18 `tgt=null`; Footer 2a passed in S-3 | PASS |
| TC-3 | Footer | order (AC-3) | row `Parent guides, We're hiring, Privacy Policy` | gate passed on all 18 files; sweep `legal` = `["Parent guides","We're hiring","Privacy Policy"]` 18/18; Footer 2b passed | PASS |
| TC-4a | Footer | fits, no overlap, same style at 375 and 1280 (AC-4) | `scroll=0`, `same=true`, `footerOverlap:false` | 18/18 `scroll=0 same=true`; style `rgb(248, 250, 252)\|15px\|400\|underline\|Inter…`; overlap false at both widths; box 82 × 24 at both widths | PASS |
| TC-4b | Footer | MANUAL visual (AC-4) | three links on one line, same look, nothing clipped | `footer-1280.png` and `footer-375.png`: one line, evenly spaced, same underline and colour. In `footer-375.png` the sticky site header is painted over the top of the footer. That is how Playwright stitches an element screenshot taller than the viewport, not the page: `careers-375.png` (full page) shows the footer cleanly | PASS |
| TC-5 | Footer | keyboard (AC-5) | focus-visible, 3 px ring, Enter opens `/careers` | `toFooter` focus-visible true, `solid 3px rgb(37, 99, 235)`, 9 presses after apply (both widths); from `/` (53 / 67 presses) Enter went to `http://127.0.0.1:4173/careers`, title `Careers \| AJ Classes` | PASS |
| TC-6 | Footer | portal has no link (AC-6) | 0 / 0 / 0, h1 and title as planned; supporting grep 0 | `hiringLinks 0`, `careersHrefs 0`, `contentinfo 0`, h1 `Sign-in isn't available right now`, title `Sign in \| AJ Classes Portal` (both widths); grep 0 | PASS |
| TC-7 | Page | pre-rendered, 200 (AC-7) | 1; 200 | 1; 200; unit 1j passed | PASS |
| TC-8 | Page | SiteLayout, one h1 (AC-8) | `h1=1`, H1 "We're hiring" | `G-h1` passed; sweep `h1=1`; first heading `H1:We're hiring`; header and footer in screenshots | PASS |
| TC-9 | Page | blocks and order (AC-9) | the 5 headings; lists `[1,4,3]`; WWCC/VIT 1 | exact headings at both widths; `[1,4,3]`; grep 1; lint passed in S-1 | PASS |
| TC-10a | Page | exact mailto (AC-10) | one mailto in main, exact href, no target; 0 typed addresses | `["mailto:hello@ajclasses.com.au?subject=Tutor%20application"]`, `applyTarget null`; grep `careers.tsx:0`, `careers.constants.ts:0`; unit 1c passed | PASS (href only, see Not covered) |
| TC-11 | Page | link text, plain address (AC-11) | "Email your application"; `emailText:true` | both, at both widths | PASS |
| TC-12a | Page | no pay, hours, dates, people, address or ABN (AC-12) | guard passed; only `BUSINESS.email`, `BUSINESS.suburbsText` | `G-content-guard` passed; grep gives exactly those two; unit 1g passed | PASS |
| TC-13 | Page | what to include and data use (AC-13) | 1 each | `1 attach your CV`, `1 only use your details…` | PASS |
| TC-14a | Page | layout at 375 and 1280 (AC-14) | scroll 0, disc ×3, apply ≥ 44 px, sizes equal privacy | scroll 0; `disc,disc,disc`; apply 56.8 × 241; 375: 34.6 / 28.025 / 56 px equal privacy; 1280: 52 / 38 / 80 px equal privacy | PASS |
| TC-14b | Page | MANUAL visual (AC-14) | readable, lists at paragraph width, button clear | `careers-375.png`, `careers-1280.png`, `viewport-375-careers.png`: as expected. The WhatsApp overlap at 375 is the known non-bug (05 note 3) | PASS |
| TC-15a | A11y | focus on every stop (AC-15) | `noRing` only the final BODY wrap; 15 / 29 real stops | `noRing` = `["BODY\|Skip to main contentAJ Classes"]` only, at both widths; 16 / 30 entries including the wrap = 15 / 29 real; skip link first; apply (index 3 / 17) before Back to home (4 / 18) | PASS |
| TC-15b | A11y | skip link and axe (AC-15) | no serious or critical; next Tab after skip lands on apply, in main | `/careers` axe only `moderate:region:1` at both widths (same on `/privacy`); `tabAfterSkip` `Email your application`, `inMain true`; Lighthouse passed (S-6) | PASS |
| TC-16 | Page | back home (AC-16) | `["/"]` | `["/"]` at both widths; unit 1f passed | PASS |
| TC-17a | SEO | production title (AC-17) | `<title>Careers \| AJ Classes</title>` | `G-title` passed | PASS |
| TC-17b | SEO | staging title (AC-17) | `[STAGING] Careers \| AJ Classes` | staging build exit 0; `<title>[STAGING] Careers \| AJ Classes</title>`; production rebuilt: `<title>Careers \| AJ Classes</title>` | PASS |
| TC-18 | SEO | description (AC-18) | length 136; exact text 1; "Melbourne" 0 | 136; 1; 0 | PASS |
| TC-19 | SEO | canonical (AC-19) | `https://ajclasses.com.au/careers` | `G-canonical` passed; unit 1h passed | PASS |
| TC-20 | SEO | sitemap (AC-20) | 14 locs, `/careers` last | 14; last `<loc>https://ajclasses.com.au/careers</loc>`; unit 3 passed | PASS |
| TC-21a | SEO | production indexes (AC-21) | 0 robots tags; no exact `Disallow: /` | 0; `robots.txt` = `User-agent: *` / `Allow: /` / `Disallow: /portal` / `Sitemap: …` | PASS |
| TC-21b | SEO | staging noindex (AC-21) | `<meta name="robots" content="noindex"/>`; `grep -cx` 1 | both as expected; after the production rebuild: 0 tags, `grep -cx` 0 | PASS |
| TC-22 | SEO | no JobPosting, JSON-LD unchanged (AC-22) | counts as planned; JobPosting 0; lib diff 0 | 1 on home, 9 programmes and the guide; 0 on 404, careers, posts, privacy, resources, subscribed; JobPosting 0; diff 0; structured data 0 problems | PASS |
| TC-23 | Quality | no console errors or warnings (AC-23) | `msgs=0` except `/nope` (its own 404) | `msgs=0` on 16/18 rows incl. `/careers` and `/` at both widths. `/nope` has 1 error at each width, `Failed to load resource … 404`. A response probe showed the only ≥ 400 response was `404 http://127.0.0.1:4173/nope document`, so the error is the page's own 404 | PASS |
| TC-24 | Quality | = S-1 | as S-1 | as S-1 | PASS |
| TC-25 | Quality | no new dependency, env var or request (AC-25) | 0; `[ '…/careers' ] 0`; 0 supabase.co | 0; `[ 'http://127.0.0.1:4173/careers' ] 0`; 0 supabase.co | PASS |
| TC-26a | Must not change | header, CTA, WhatsApp (AC-26) | 3 files / 16 tests; diff 0; nav lists; whatsapp 2 | `3 passed (3)`, `16 passed (16)`; diff 0; desktop nav 6 links as planned; phone menu 15, `hiringInMenu 0`; `whatsapp 2` at both widths | PASS |
| TC-26b | Must not change | MANUAL visual, CTA bar and WhatsApp (AC-26) | look as on `develop` | Measured against `develop` @ `8e2af88`. CTA bar: same states (absent at top, shown after the hero at y 719, 81 × 375 px, "Register Interest", absent on `/careers`). Screenshots pixel-identical (SHA-1 `95b024b609a0…` both). Header box and fixed WhatsApp box identical at 375 and 1280 | PASS |
| TC-27 | Must not change | enquiry path (AC-27) | diff 0; form fields as planned | 0; `ask-a-question` with `name,email,phone,message,botcheck`, submit `Register interest` | PASS |
| TC-28 | Must not change | no DB change (AC-28) | 0 | 0 | PASS |
| TC-29 | Must not change | CSP and hosting (AC-29) | 0; S-5; hosting-csp passed | 0; S-5 passed; hosting-csp in TC-26a passed | PASS |
| TC-30 | Must not change | privacy text (AC-30) | 0 | 0 | PASS |
| HYG | Rules | diff hygiene (DoD 5) | 0 | 0 | PASS |
| SM-1 | Smoke | home | 200, h1 1, scroll 0, msgs 0, robots 0 | as expected at both widths | PASS |
| SM-2 | Smoke | nav | desktop 6, phone 15 | 6; 15 | PASS |
| SM-3 | Smoke | footer on several pages | row on 8 listed pages | present and ordered on all | PASS |
| SM-4 | Smoke | portal sign-in | = TC-6 | = TC-6 | PASS |
| SM-5 | Smoke | edge URLs | `/careers/` 301 → `/careers`; `?x=1` 200; `/CAREERS` 200 | as expected; `/PRIVACY` also 200 (case-insensitive disk, as the plan notes) | PASS |
| RG-1 | Regression | header nav | = TC-26a | = TC-26a | PASS |
| RG-2 | Regression | enquiry form renders | = TC-27 | = TC-27 | PASS |
| RG-3 | Regression | privacy page | 200, h1 1, msgs 0, robots 0, axe clean, row | as expected; axe `moderate:region:1` only | PASS |
| RG-4 | Regression | sitemap | 14 locs, `/careers` last, `/posts` absent | 14; last `/careers`; `/posts` count 0 | PASS |
| RG-5 | Regression | 404 | 404; h1 1; robots 1; footer link | 404; `h1=1 robots=1 n=1` at both widths; `/subscribed` robots 1 | PASS |
| RG-6 | Regression | one robots tag per page | never 2 | 0 or 1 on all 18 rows | PASS |

Pass rate: **54/54 = 100%** · Defects open: **none**

**Evidence** (in `evidence/`, PNG and JSON only, no keys or traces): `sweep.json`, `careers.json`, `axe.json`, `walk.json`, `tc26b-cta-whatsapp.json`, `careers-375.png`, `careers-1280.png`, `footer-375.png`, `footer-1280.png`, `viewport-375-home.png`, `viewport-375-careers.png`, `viewport-375-home-cta.png`, `viewport-375-home-cta-develop.png`. Raw logs (check, CSP, Lighthouse, staging build) stay in `/private/tmp/aj-hiring-tsr`.

**Observations (not defects, from the plan, unchanged):**
1. The footer focus ring `#2563eb` on navy `#172554` is 2.84:1, under the 3:1 WCAG 1.4.11 guideline. This is pre-existing and affects every footer link. Low; for the lead to ticket.
2. The footer legal links are 24 px tall, the same as their neighbours.

## Verdict

**APPROVED (auto).** All 54 frozen cases passed (100%), with no defects. The items below are outside the frozen set by the lead's ruling (review-6a) and must be done before production.

## Not covered

1. **AC-10: href verified; device behaviour not verified — Saurabh to check before production.** The steps are TC-10b (desktop mail app), TC-10c (iOS Safari, including copying the plain address) and TC-10d (Android Chrome/Gmail), in 06 "Not covered — for Saurabh" 1-3. The phones need the Vercel preview (behind SSO) or staging, because the mirror only listens on 127.0.0.1.
2. **TC-15c: screen-reader pass** (VoiceOver headings rotor and the apply-link name). For Saurabh, item 4. Automated a11y checks (axe and Lighthouse) passed.
3. **TC-12b: copy sign-off** (01 Q1, Q3, Q5, Q6). For Saurabh, item 5.
4. **CI on GitHub was not run.** Nothing is pushed until the merge. Every CI gate was run locally instead: check, hosted-ref, structured-data, CSP and Lighthouse.
5. **Not covered by this build:** the news-on and portal-on footer orders, and the portal-on sign-in page. These need Supabase config, which this env doesn't have. They are covered by unit tests only (Footer 2b, and TC-6's supporting grep).
6. **Real Vercel behaviour** (headers, case-sensitive paths such as `/CAREERS`). Only the local mirror was tested.
