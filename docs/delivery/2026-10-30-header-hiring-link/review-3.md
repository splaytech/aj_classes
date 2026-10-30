# Review 3: Design (stage 3), header "We're hiring" link

Reviewer, 30 Oct 2026. Branch `feature/header-hiring-link`. Reviewed `03-design.md` against 01, 02, review-1, review-2 and `Header.tsx`, `Header.module.css`, `Header.test.tsx`, `content.constants.ts`, `careers.constants.ts`, `constants/index.ts`, `Footer.tsx`, `Footer.test.tsx`, `styles/theme.css`, `styles/global.css`, `test/render.tsx`, `test/user.ts`, `test/setup.ts`, `vitest.config.ts`, `lib/analytics.ts`. Checked jsdom 30.1.1 link-click behaviour in a scratchpad script. No repo files changed.

## Verdict: APPROVED

1. The 15px rule (`.links > li > a, .signIn`) hits only the top-level links and Sign in; programme sub-links (inside `ul.subLinks`, sibling of the parent `<a>`) and Register Interest (in `.actions`) stay as they are.
2. Specificity (0,1,2) beats `.links a` (0,1,1); nothing else sets `font-size` on these elements.
3. No leak into the phone menu: the rule is inside `@media (min-width: 1024px)`.
4. Media query order works: the 1024–1279px gap block follows the 1024px block; base 24/16/16 gaps return at 1280px+.
5. No import cycle: business imports nothing; careers imports only business; content adds careers to existing imports.
6. Rename complete: `CAREERS.footerLink` is used only at `Footer.tsx:81`, `Footer.test.tsx:47` and `:55`. `RESOURCES.footerLink` is unrelated.
7. Tests feasible: `vi.mock('@/lib/analytics')`, `setupUser`, `renderAt(ui, path)` exist. jsdom link clicks still bubble to React's `onClick`; "Not implemented: navigation" is console noise only.
8. All doc and comment line references are correct.

## Findings

1. **Non-blocking (Developer fixes at build):** `Header.test.tsx:50` ("is not shown when there is no news") expects `NAV.links.length` items; with the always-shown link it becomes `NAV.links.length + 1`. Edit, with a short comment (DEC-HL-5); don't delete. Add to design §5.2 and §6.3.
2. **Non-blocking:** drop the "was --space-4" comments in §3.2; §3.3's block comment already gives values and reason.
3. **Nit:** the T6 `preventDefault` listener is optional if test output stays clean.
4. **Nit:** AC-8 focus style comes from the site-wide `:focus-visible` rule (`global.css:62`); Tester checks by hand.

## What's pending

1. Developer applies findings 1 and 2 during the build; no new design round.
2. DEC-HL-1 to DEC-HL-5 go to `~/second-brain/Projects/AJClasses/_knowledge/decisions.md` (team lead at close-out).
