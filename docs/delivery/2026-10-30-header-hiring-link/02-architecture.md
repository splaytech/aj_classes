# 02 Architecture: "We're hiring" link in the site header

Stage 2 (Architect), 30 Oct 2026. Branch `feature/header-hiring-link`. Input: `01-requirement.md`, `review-1.md` (findings 4 and 5).

## Assessment

**No architecture impact.** Front end only: one constant, one `<li>` in `Header.tsx`, one CSS change. No data, service, route, CSP, hosting or vendor change. `/careers` already exists (DEC-WH-1). Nothing here is irreversible or costly.

**The real risk is width, and it isn't only at 1024 to 1279px.** I measured the dev server with a 7th link added (Chromium, News and Sign in showing, 18px medium "We're hiring" = 99px wide). The bar has 960px of content at 1024 and 1056px from 1120 up (`--container-max` 1120 includes the 32px gutters). At today's sizes the 7 links need about 1059px with the tight gaps and 1095px with the normal gaps. So **the bar overflows at every desktop width, 1440 included**: 0px left between the logo and the links, and the Sign in icon squeezed to 0 to 17px (47px of sideways scroll at 1024). Raising the menu-button breakpoint alone doesn't fix this.

## Decisions

1. **DEC-HL-1: one constant, shared by the header and the footer.**
   - Rename `CAREERS.footerLink` to `CAREERS.linkLabel` (`careers.constants.ts:12`). Careers wording stays in the careers file, ready for Q5.
   - Add `NAV.careersLink = { label: CAREERS.linkLabel, href: ROUTES.careers }` next to `NAV.newsLink` (`content.constants.ts:52`). This is not a cycle: `careers.constants` imports only `business.constants`.
   - The header and the footer (`Footer.tsx:81`) both read `NAV.careersLink.label` and `.href`. `Footer.test.tsx:47,55` switch to it too.
2. **DEC-HL-2: the link is a plain `.links` item.**
   - It is an `<li><a>` placed right after the News block (`Header.tsx:112`) and before `.actions` (`:124`).
   - It has `onClick={closeMenu}`, no `trackEvent` (AC-11), and `aria-current` from the existing `isCurrentPage`.
   - No class of its own. It gets `.links a` (`Header.module.css:64`) and the `≥1024px` rules (`:174`) exactly like its siblings, which meets AC-7 by construction.
3. **DEC-HL-3: fit by making the desktop bar text smaller and tightening the 1024 to 1279px gaps. The breakpoint stays at 1024.**
   - At `≥1024px`, the top-level links (`.links > li > a`) and `.signIn` use `--font-size-sm` (15px, an existing token) instead of 18px. Programmes sub-links, the Register Interest button and the phone menu stay as they are.
   - From 1024 to 1279px (`:255`): the `.links` gap goes to `--space-2` (8px) and the `.nav` gap to `--space-3` (12px). `.actions` stays at `--space-3`.
   - At `≥1280px` the normal gaps come back (24/16/16), so the band rule only tightens gaps.
   - Measured logo gap (Sign in icon 20px, one row, header 72px tall, no sideways scroll at every width):

   | Width | 1024 | 1093 | 1180 | 1279 | 1280 | 1440 |
   |---|---|---|---|---|---|---|
   | Logo gap | 14px | 83px | 110px | 110px | 46px | 46px |

   - For comparison, today's 6-link bar has 12px at 1024 and 76px at 1280 (`2026-10-25-pending-requirements/05-dev-notes-item-1.md` §3).
4. **DEC-HL-4: medium weight, no icon** (review-1 finding 5). The link uses `--font-weight-medium` like the links it sits with, not semibold like Sign in. An icon (20px plus an 8px gap) leaves 0px at 1024 and squeezes the Sign in icon to 6px, so it is out. AC-10's "small extra cue" goes unused.

## Options rejected

| Option | 1024 | 1280+ | Tablets inline |
|---|---|---|---|
| Gaps only (8px) | overflows | 21px | yes |
| Breakpoint to 1280, keep 18px, gaps 12/8/12 | menu | 25px | no |
| Breakpoint to 1280, 16px text, gaps 16/12/16 | menu | 49px (17px with normal 24/16/16 gaps) | no |
| **15px text + band gaps (chosen)** | **14px** | **46px** | **yes** |

Raising the breakpoint is still "visible as per other links", but it also needs a new 16px token. It also moves iPad landscape (1024/1180) and 1366px laptops at 125% zoom (1093px) to the menu button, so it changes more for a small gain.

## Flags for Saurabh / PO (none block the build)

1. **This overrides the PRP nav cap.** `release-1/PRP.md:55` and `release-1.1/PRP.md:23` say "at most 6 nav items + 1 CTA". Saurabh's brief replaces that cap. It's recorded as DEC-HL-5 below and is easy to reverse.
2. **AC-13 exception.** Desktop header link text and Sign in go from 18px to 15px on purpose. The Tester should treat this as the intended change, not a regression. AC-13 now carries this exception (review-2 finding 1).
3. **Watch for future growth.** At 1024 only 14px is left. Renaming News to "What's On" (B11) or a longer Q5 label will overflow. Whoever makes that change must measure again; the fallback then is to raise the breakpoint.

## ADR

None needed. No data model, vendor, auth or hosting choice is involved, and it is all reversible CSS and constants. The decisions go to `_knowledge/decisions.md`:

- **DEC-HL-1** to **DEC-HL-4** as above.
- **DEC-HL-5:** The public header can hold 7 nav items (5 sections, News, "We're hiring") plus Sign in and the CTA. This replaces the PRP's "≤6 + 1 CTA" cap, on Saurabh's brief of 30 Oct 2026.

## For the Developer (review-1 finding 4)

Update these comments and docs that will go out of date:

1. The header contents comment at `Header.tsx:1-3`.
2. The "six links" comment at `Header.module.css:252`.
3. The test at `Header.test.tsx:53-57`. It becomes 7 items, with News second to last and "We're hiring" last. Change the "≤ 6" comment too.
4. A one-line "superseded by 2026-10-30-header-hiring-link" note on decision 1 and D1 in `2026-10-27-we-are-hiring/01-requirement.md`.
5. A one-line "superseded by DEC-HL-5 (2026-10-30-header-hiring-link)" note at `release-1/PRP.md:55` and `release-1.1/PRP.md:23` (review-2 finding 2).
6. The "Shown last" comment on News at `content.constants.ts:50-51` (review-2 finding 7).
7. Record the logo gap at each AC-5 width in the dev notes (review-2 finding 4).


_Updated after review-2 (findings 1 to 3 and 7, wording only), 30 Oct 2026._
