# Review 2: Architecture (stage 2), header "We're hiring" link

Reviewer, 30 Oct 2026. Branch `feature/header-hiring-link`. Reviewed `02-architecture.md` against `01-requirement.md`, `review-1.md`, `Header.tsx`, `Header.module.css`, `Header.test.tsx`, `content.constants.ts` (NAV and FOOTER), `careers.constants.ts`, `Footer.tsx`, `Footer.test.tsx`, `styles/theme.css`, `release-1/PRP.md:55` and `release-1.1/PRP.md:23`. Measured independently on the dev server (http://localhost:5173, Chromium, read-only, items and CSS injected in the page). No repo files changed.

## Verdict: APPROVED

Logo gap in px (header stays 72px tall in every row):

| Case | 1024 | 1093 | 1180 | 1279 | 1280 | 1440 |
|---|---|---|---|---|---|---|
| Today, 6 links | 12 | 81 | 108 | 108 | 76 | 76 |
| 7 links, no CSS change | 0, icon 0, 47px scroll | 0 | 0, icon 17 | 0, icon 17 | 0, icon 0 | 0, icon 0 |
| Chosen (15px + band gaps) | 14 | 83 | 110 | 110 | 46 | 46 |
| 8px gaps only | 0, 19px scroll | 0, icon 18 | 25 | 25 | 21 | 21 |
| Breakpoint 1280, 18px, gaps 12/8/12 | menu | menu | menu | menu | 25 | 25 |
| Breakpoint 1280, 16px, gaps 16/12/16 | menu | menu | menu | menu | 49 | 49 |

A 7th link at today's sizes overflows at every desktop width; moving the breakpoint alone doesn't fix it. The chosen fix keeps the Sign in icon at 20px everywhere with no sideways scroll. DEC-HL-2 meets AC-7 by construction; DEC-HL-4 answers review-1 finding 5. Shrinking desktop header text 18px→15px is proportionate: keeping 18px means breakpoint 1280, only 25px at 1280+, and iPad landscape / 125%-zoom laptops on the menu button.

## Findings

1. **Non-blocking (before the Tester stage): write the AC-13 exception into the requirement.** The 18→15px change would fail AC-13 ("look as before") as written. Add: "Exception: at ≥1024px the top-level links and Sign in are 15px (`--font-size-sm`), per DEC-HL-3". Name it in the summary for Saurabh.
2. **Non-blocking: note the PRP cap override in the PRPs.** Add "superseded by DEC-HL-5 (2026-10-30-header-hiring-link)" at `release-1/PRP.md:55` and `release-1.1/PRP.md:23`; add to the Developer list.
3. **Non-blocking: options table.** Add the row "breakpoint 1280, keep 18px, tight gaps" (25px at 1280+), and state the gaps behind the 53px figure (17px with 24/16/16, 49px with 16/12/16).
4. **Non-blocking: 14px at 1024 is thin but acceptable** (today's 6-link bar is 12px). System font; Mac SF is the widest likely case (Arial/Helvetica 35px). Tester checks 1024 on a Mac; dev notes record the logo gap at each AC-5 width.
5. **Nit:** the gap drops from 110px at 1279 to 46px at 1280 as normal gaps return. Works; no change required.
6. **Nit: rename usages** of `CAREERS.footerLink`: `careers.constants.ts:12`, `Footer.tsx:81`, `Footer.test.tsx:47` and `:55`. Historical doc mentions stay. No import cycle. Footer may read `CAREERS.linkLabel` directly; either meets AC-2.
7. **Nit:** `content.constants.ts:50-51` says News is "Shown last"; add to the Developer list.

## What's pending

1. PO adds the AC-13 exception; Architect adds the options row and gap note. Wording only, no re-review.
2. Developer list gains the PRP notes and the `content.constants.ts:50-51` comment.
3. Summary to Saurabh names: desktop header text goes to 15px, and the "≤6 nav items" cap is lifted.
