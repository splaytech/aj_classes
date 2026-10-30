# 03 Design: "We're hiring" link in the site header

Stage 3 (Solution Designer), 30 Oct 2026. Branch `feature/header-hiring-link`. Input: `01-requirement.md`, `02-architecture.md` (DEC-HL-1 to DEC-HL-5), `review-1.md`, `review-2.md`, and the code as it is on this branch.

Front end only. No backend, data, route, CSP, prerender, sitemap or migration change (`/careers` already exists, DEC-WH-1). No new dependency. Five source files and three docs change.

## 1. Constants (DEC-HL-1)

1. `apps/web/src/constants/careers.constants.ts:12`: rename `footerLink` to `linkLabel`. Value unchanged: `"We're hiring"`. Add a one-line comment above it: shown in the header and the footer through `NAV.careersLink` (DEC-HL-1).
2. `apps/web/src/constants/content.constants.ts`: add `import { CAREERS } from './careers.constants';` (no cycle: careers imports only `business.constants`). In `NAV`, right after `newsLink` (line 52), add:
   - `careersLink: { label: CAREERS.linkLabel, href: ROUTES.careers },`
   - with a one-line comment: a page, outside `links`; always shown, after News (DEC-HL-2, DEC-HL-5).
3. Same file, lines 50-51: the News comment says "Shown last". Change it to "Shown after the section links, before 'We're hiring', and only once at least one post exists (ADR-0001)". Keep the B11 sentence.
4. Usages of the old name (only these exist): `Footer.tsx:81`, `Footer.test.tsx:47` and `:55`. All three switch to `NAV.careersLink` (sections 4 and 5).

## 2. Header JSX (DEC-HL-2), `Header.tsx`

Insert one `<li>` after the `{hasNews && (...)}` block (ends at line 122) and before `</ul>` (line 123), so it is the last child of `.links` and comes before `.actions` in the DOM (that gives the AC-3 and AC-8 order on desktop and in the menu):

```tsx
<li key={NAV.careersLink.href}>
  <a
    href={NAV.careersLink.href}
    onClick={closeMenu}
    aria-current={isCurrentPage(pathname, NAV.careersLink.href) ? 'page' : undefined}
  >
    {NAV.careersLink.label}
  </a>
</li>
```

Rules: no condition around it (no `hasNews`, no `APP_CONFIG`, no route check, AC-4); no `className` on the `<li>` or `<a>` (AC-7); `onClick` is `closeMenu`, never `handleCtaClick` or `trackEvent` (AC-11); no icon (DEC-HL-4). No new imports are needed.

Top comment (lines 1-3) becomes: "Sticky site header: logo, section links, News (only when posts exist), "We're hiring", Sign in (portal flag) and the "Register Interest" button. On small screens the links and actions fold into a menu button (PRP F2 section 1)."

## 3. CSS (DEC-HL-3), `Header.module.css`

_Superseded 30 Oct 2026 (header tidy, `feature/header-tidy`): FAQ and News left the header, so the bar has five links. The 1024–1279px tight-gap band was removed and wider gaps added from 1280px; the 15px text stays._

1. **Inside the existing `@media (min-width: 1024px)` block** (line 174), after the `.links { flex-direction: row; ... }` rule (line 205-208), add:

   ```css
   /* Seven links plus Sign in only fit the bar at 15px (DEC-HL-3). Sub-links keep their size. */
   .links > li > a,
   .signIn {
     font-size: var(--font-size-sm);
   }
   ```

   - `--font-size-sm` is 0.9375rem / 15px (`theme.css:126`). No new token.
   - `.links > li > a` matches the five section links, News and "We're hiring" only. Programme sub-links (`.links > li > ul > li > a`) and the Register Interest `ButtonLink` (in `.actions`) don't match, so they stay as they are.
   - Specificity 0,1,2 beats `.links a` (0,1,1); nothing else sets `font-size` on these.
   - Below 1024px nothing changes: the phone menu stays at body size (18px).
2. **Replace the body of the `@media (min-width: 1024px) and (max-width: 1279px)` block** (lines 255-265):

   ```css
   .nav,
   .navOpen {
     gap: var(--space-3); /* 12px, was --space-4 */
   }

   .links {
     gap: var(--space-2); /* 8px, was --space-3 */
   }

   .actions {
     gap: var(--space-3); /* 12px, unchanged */
   }
   ```

   The value comments are for the diff review only. The Developer can drop them if the file's style is to have none.
3. The comment above that block (lines 252-254) becomes: "Seven links (with News and "We're hiring") plus Sign in. Between 1024px and 1279px the normal gaps push them against the logo, so tighten the gaps there only: links 8px, nav and actions 12px. With the 15px text this leaves about 14px at 1024 (02 DEC-HL-3, measured in the dev notes). Breakpoint unchanged; re-measure before adding or lengthening a link."
4. At `>= 1280px` nothing is added: the base desktop gaps (nav 24, links 16, actions 16) apply.
5. Nothing else changes. No rule names this link, and no `display`, `visibility`, `hidden` or `aria-hidden` is added (AC-7).

## 4. Footer, `Footer.tsx`

Line 81 becomes `<a href={NAV.careersLink.href}>{NAV.careersLink.label}</a>`. Add `NAV` to the `@/constants` import and drop `CAREERS` (no other use in the file). Position and markup are unchanged (AC-12).

## 5. Tests

`Header.test.tsx`:

1. Add `vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));` next to the existing `use-has-news` mock, and `vi.mocked(trackEvent).mockClear()` in the `beforeEach`. Import `trackEvent`, `setupUser` from `@/test/user`, and add `ANALYTICS_EVENTS`, `CAREERS`, `CTA_LOCATIONS` to the constants import.
2. Edit, don't delete, the test at lines 53-61: rename to "is second to last of 7 nav items, linking to /posts, when there is news (AC-1.8, DEC-HL-5)". Expect `toHaveLength(7)` with the comment "7 nav items (DEC-HL-5); Sign in and Register Interest are actions". Read the link from `items[items.length - 2]`.
3. Add `describe("header We're hiring link (2026-10-30-header-hiring-link)")` with:

| # | Test | Asserts | AC |
|---|---|---|---|
| T1 | `it.each([false, true])` "is always the last nav item (news %s)" | last top-level item's link has text `NAV.careersLink.label` and `href` `ROUTES.careers`; item count is `NAV.links.length + (hasNews ? 1 : 0) + 1`; with news, the item before it is News | AC-1, AC-3, AC-4 |
| T2 | "uses the shared careers label and path" | `NAV.careersLink.label` equals `CAREERS.linkLabel`; `NAV.careersLink.href` equals `ROUTES.careers`; the rendered link's text equals `CAREERS.linkLabel` | AC-1, AC-2 |
| T3 | "comes before Sign in and Register Interest" | `careersLink.compareDocumentPosition(ctaLink) & Node.DOCUMENT_POSITION_FOLLOWING` is truthy; same for the Sign in link when `APP_CONFIG.features.portal` | AC-3, AC-8 (DOM = tab order) |
| T4 | "is marked as the current page only on /careers" | `aria-current="page"` at `ROUTES.careers` and at `/careers/`; no `aria-current` at `ROUTES.home` and `ROUTES.posts` (news on, so both page links render) | AC-9 |
| T5 | "closes the phone menu when tapped" | click the `A11Y.openMenu` button, then the careers link; the menu button is back to `aria-expanded="false"` with name `A11Y.openMenu` | AC-6 |
| T6 | "does not send cta_click; Register Interest still does" | click the careers link: `trackEvent` not called. Click the `NAV.cta` link: called once with `ANALYTICS_EVENTS.ctaClick, { location: CTA_LOCATIONS.header }` | AC-11 |
| T7 | "has no class of its own" | the careers `<a>` and its `<li>` have no `class` attribute | AC-7 (guard) |

   Note for T5 and T6: jsdom doesn't navigate and may print "Not implemented: navigation" when a link with a path `href` is clicked. If it does, attach a one-off `click` listener to that link in the test that calls `preventDefault()`. React's `onClick` still runs, since it doesn't stop propagation.

`Footer.test.tsx`: lines 4, 47 and 55 switch from `CAREERS.footerLink` to `NAV.careersLink.label` (import `NAV`, drop `CAREERS`). Line 56 can assert `NAV.careersLink.href`. The order test is unchanged otherwise (AC-12).

No e2e change: there is no header spec (AC-14).

## 6. Doc and comment updates (02 "For the Developer")

1. `Header.tsx:1-3` top comment (section 2).
2. `Header.module.css:252-254` band comment (section 3.3).
3. `Header.test.tsx:53-61` test and its "≤ 6" comment (section 5.2).
4. `docs/delivery/2026-10-27-we-are-hiring/01-requirement.md`: append "Superseded by 2026-10-30-header-hiring-link." to decision 1 (line 13) and to D1 (line 118).
5. `docs/requirements/release-1/PRP.md:55` and `docs/requirements/release-1.1/PRP.md:23`: append "(superseded by DEC-HL-5, 2026-10-30-header-hiring-link)" to the nav-cap text.
6. `content.constants.ts:50-51` News comment (section 1.3).
7. Dev notes record the measured logo gap and Sign in icon width at 1024, 1093, 1180, 1279, 1280 and 1440px (News on, portal on).
8. DEC-HL-1 to DEC-HL-5 go into the project's `_knowledge/decisions.md` (`~/second-brain/Projects/AJClasses/_knowledge/decisions.md`). That file is outside the repo, so the Manager decides who writes it.

## 7. Test approach

| AC | How | Who |
|---|---|---|
| AC-1 | T1, T2 | unit |
| AC-2 | T2, Footer test | unit |
| AC-3 | T1, T3; same order in the open menu at 375px | unit + Tester |
| AC-4 | T1 (news off and on); portal off checked by code review (link is outside the `APP_CONFIG.features.portal` block) | unit + Reviewer |
| AC-5 | widths 1024/1180/1280/1440, News on, portal on: one row, no overlap, no sideways scroll, Sign in icon 20px; on a Mac at 1024 (review-2 finding 4) | Tester |
| AC-6 | T5; at 375/768/1023: hidden while closed, shown when open, tap goes to `/careers`, same height as News | unit + Tester |
| AC-7 | T7; diff check that no CSS selector targets only this link | unit + Reviewer |
| AC-8 | T3; Tab order, visible focus ring, Enter opens `/careers` | unit + Tester |
| AC-9 | T4 | unit |
| AC-10 | same 15px medium as News, no icon, no fill or outline | Tester |
| AC-11 | T6 | unit |
| AC-12 | Footer tests; visual check | unit + Tester |
| AC-13 | existing suites pass; visual check of dropdown, mobile CTA bar, WhatsApp, `/careers`; 15px desktop text is intended | unit + Tester |
| AC-14 | `format`, `lint`, `typecheck`, `test`, `build`, e2e | Developer + Tester |
