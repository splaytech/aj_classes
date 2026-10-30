# 01 Requirement: "We're hiring" link in the site header

Stage 1 (Product Owner), 30 Oct 2026. Branch `feature/header-hiring-link`.

## Why

1. The owner asked for a "we are hiring" button. Saurabh pointed out it's in the footer and asked if it should go at the top "in big". The owner said "Yes".
2. Saurabh's brief: "add we are hiring on top of site as well and do not attempt to hide it, it should be visible as per other links".
3. This brings forward deferred item **D1** from `2026-10-27-we-are-hiring/01-requirement.md` ("Header or home-page mention ... needs a nav-cap decision"). The decision now is: it goes in the header.

## User story

**US-1.** As a **possible tutor visiting any public page**, I want to **see a "We're hiring" link in the header next to the other links**, so that **I find the careers page without scrolling to the footer**.

## Acceptance criteria

Header links today: Programmes, Our Approach, About, FAQ, Contact, News (only when posts exist), then Sign in (portal flag) and the Register Interest button.

1. **AC-1** Every public page that uses the site header shows a "We're hiring" link that goes to `/careers` (`ROUTES.careers`).
2. **AC-2** The link text matches the footer link exactly ("We're hiring"). It comes from a typed constant, not a string typed into the component, and the header and footer read the same constant (one edit changes both).
3. **AC-3** Position: after the section links and News (if shown), before Sign in and Register Interest. The order is the same on desktop and in the phone menu.
4. **AC-4** It always shows. No feature flag, no env setting, no news or posts check, no route check. It still shows when the portal flag is off (Sign in hidden) and when there are no posts (News hidden).
5. **AC-5** Desktop, 1024px and wider: it shows in the header bar on one line wherever the other links show. Check at 1024, 1180, 1280 and 1440px, with News showing and the portal flag on (the most crowded case). Nothing wraps, overlaps the logo, or overflows the bar, and the Sign in icon isn't squeezed.
6. **AC-6** Below 1024px (tablet and phone, check 375, 768 and 1023px): it is hidden only while the menu is closed, exactly like the other links. Opening the menu shows it. Tapping it goes to `/careers` and closes the menu. Its tap target is the same height as the other menu links.
7. **AC-7** No CSS rule, media query or `hidden`/`aria-hidden`/`display:none` applies to it that doesn't also apply to the other header links.
8. **AC-8** Keyboard: Tab reaches it in the order from AC-3. It shows the site's usual visible focus style. Enter opens `/careers`.
9. **AC-9** On `/careers` the header link has `aria-current="page"`. On every other page it has no `aria-current`.
10. **AC-10** Emphasis: it looks like a peer link, at the same size and weight as the other links or Sign in. It can have one small extra cue (for example an icon like Sign in has). It is **not** a filled or outlined button and doesn't use the primary or gold fill, so Register Interest is still the only button in the header.
11. **AC-11** Analytics: clicking it does **not** send `cta_click` (that event counts Register Interest conversions). Clicking Register Interest in the header still sends `cta_click` with `location: header`.
12. **AC-12** The footer "We're hiring" link is still there, unchanged.
13. **AC-13** Nothing else changes: the Programmes dropdown, News logic, Sign in, Register Interest, the mobile CTA bar, the WhatsApp button and the `/careers` page itself all work and look as before. The existing header test that says "6 nav items" is updated on purpose, not deleted. Exception: at ≥1024px the top-level links and Sign in are 15px (`--font-size-sm`), per DEC-HL-3.
14. **AC-14** Repo checks pass: format, lint, typecheck, unit tests, build, and the existing e2e suite (there is no header spec; the Tester checks the widths in AC-5 and AC-6 by hand).

## v1 vs deferred

1. **v1:** a single header link (desktop bar and phone menu), aria-current, tests.
2. **Deferred, D1a (later release):** a "We're hiring" mention in the mobile CTA bar, the announcement bar or a home-page section.
3. **Deferred, D1b (later release):** analytics for careers clicks (a separate event, not `cta_click`). Can come back once the owner wants to measure applicants.
4. **Deferred, D1c (later release):** a switch to hide the link and page when they're not hiring (Q2 on the action items, section H). Saurabh's "do not attempt to hide it" settles v1: it always shows.

## Assumptions

1. [ASSUMPTION] "Big" (owner) vs "as per other links" (Saurabh): Saurabh's wording wins. So it's a peer link with at most a small cue, not a second primary button (AC-10). If the owner still wants "big", that's a follow-up, D1d.
2. [ASSUMPTION] "Top of site" means the sticky site header. The announcement bar is out of scope.
3. [ASSUMPTION] It doesn't need to show in the portal (`/portal/*`), which has its own shell. Only the public site header is in scope.
4. [ASSUMPTION] Label stays "We're hiring" and the path stays `/careers`, pending the owner's answer on Q5. Changing it later only means editing constants.
5. [ASSUMPTION] If it can't fit on one line at 1024 to 1279px (AC-5), the Architect picks the fix (tighter gaps, or moving the menu-button breakpoint up). The Architect must not drop or hide the link at those widths, because that would break AC-4 and AC-7.


_Updated after review-1 (findings 1 to 3, wording only), 30 Oct 2026._
