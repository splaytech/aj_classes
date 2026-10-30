# 05 Dev notes: "We're hiring" link in the site header

Stage 5 (Developer), 30 Oct 2026. Branch `feature/header-hiring-link`. Built from `04-plan.md` slices 1 to 5, with `03-design.md` and review-1 to review-4 folded in.

## Slices

- [x] 1. Constants rename and shared link: `6dd6b82` refactor(careers): share the We're hiring label through NAV.careersLink
- [x] 2. Header link and unit tests: `df22ef8` feat(header): add We're hiring link after News
- [x] 3. Desktop fit CSS and measurements: `b47defa` style(header): fit seven links at 15px with tighter 1024-1279px gaps
- [x] 4. Doc and comment updates: `c9b4b9e` `docs: mark the nav cap and header deferral superseded by DEC-HL-5` (`git show --stat HEAD` listed only the three docs)
- [x] 5. Full check and production build: this file, committed as `docs(delivery): add dev notes for header hiring link`

After slice 1, `grep -rn footerLink apps/web/src` only finds `RESOURCES.footerLink` (unrelated, "Parent guides"). Nothing in `CAREERS` uses the old name.

## How the crowded case was shown (slice 3)

1. **News:** injected in the browser, no DB writes. The local seed has no posts, so the dev server hides News. A Playwright (Chromium 1.64) script loaded `http://localhost:5173/`, waited for `networkidle`, cloned the Contact `<li>`, set its text to "News" and its `href` to `/posts`, and inserted it before the "We're hiring" `<li>`. Item order at every width: Programmes | Our Approach | About | FAQ | Contact | News | We're hiring.
2. **Sign in:** showing at every desktop width (the Sign in link was found in the nav). `apps/web/.env.local` sets `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_TURNSTILE_SITE_KEY`, so `APP_CONFIG.features.portal` is on. `VITE_SUPABASE_URL` points at `http://127.0.0.1` (local stack), not the hosted project.
3. Script: `/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad/measure.cjs` (scratchpad, not in the repo). Logo gap = nav left edge minus logo link right edge.

## Measurements (News on, Sign in on, Chromium on macOS)

| Width | Logo gap (02 expected) | Sign in icon | Header height | One row | Sideways scroll |
|---|---|---|---|---|---|
| 1024 | **14px** (14) | 20px | 72px | yes | 0 |
| 1093 | 83px (83) | 20px | 72px | yes | 0 |
| 1180 | 110px (110) | 20px | 72px | yes | 0 |
| 1279 | 110px (110) | 20px | 72px | yes | 0 |
| 1280 | 46px (46) | 20px | 72px | yes | 0 |
| 1440 | 46px (46) | 20px | 72px | yes | 0 |

- Every figure matches 02. 1024 is above the 10px stop line.
- At every desktop width: top-level links and Sign in are 15px. "We're hiring" is 15px, weight 500 (same as News) and 84px wide. Programme sub-links stay 18px. Register Interest stays 18px.
- Phone menu at 375, 768 and 1023: the link is hidden while the menu is closed and shows when it's open. It's 45px tall at 18px, the same as the other menu links (AC-6 as reworded in review-1). Tapping it lands on `/careers` (h1 "We're hiring"), and it has `aria-current="page"` there.
- Screenshots (scratchpad): `/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad/header-1024-crowded.png` and `/private/tmp/claude-501/-Users-sjain-dev-work-aj-classes/6bed2619-071a-47b8-add8-c0ac7693a7bd/scratchpad/header-375-menu.png`.

## Gate (slice 5)

| Command | Result |
|---|---|
| `pnpm exec prettier --check` on the 7 touched source files | All matched files use Prettier code style! |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 (web and e2e) |
| `pnpm test` | web: Test Files 76 passed (76), Tests 665 passed (665); e2e-unit: tests 6, pass 6, fail 0 |
| `VITE_APP_ENV=production pnpm build` | exit 0; `apps/web/build/client/careers/index.html` exists; prerendered `index.html` has `<li><a href="/careers">We&#x27;re hiring</a></li>` |

Test counts: **before 657 web + 6 e2e-unit** (re-run by me on this branch before any change, matching the Manager's baseline). **After: 665 web + 6 e2e-unit.** The 8 new tests are T1 (2 cases, news off and on) plus T2 to T7. Header and footer files went from 10 to 18. Both News tests were edited, not deleted.

`kinet validate`: none of its findings are in a file this change touches. The ones it lists are older heuristic hits in constants, tests and the build output, plus gitignored local env files (`e2e/.env` and `supabase/.env.deploy` are ignored and untracked).

E2E smoke wasn't run. The Tester owns it (04 slice 5).

## Deviations

1. **T5 and T6 use the `preventDefault` listener.** Review-3 called it optional. I added it as a small `preventNavigation` helper so the test output stays clean. The run prints no "Not implemented: navigation" lines.
2. **Footer test:** besides the label switch, the `/careers` test also checks `NAV.careersLink.href` equals `ROUTES.careers` (03 §5 allowed this).
3. **No per-value comments in the gap rules,** per review-3 finding 2. The block comment gives the values.
4. **Nothing else.** I didn't add new tokens, dependencies, classes on the link, or conditions around it.

## Not verified

1. The Safari or Firefox font width at 1024. I only measured Chromium on macOS. The Tester rechecks on a Mac (review-2 finding 4).
2. Keyboard Tab order and the visible focus ring were checked by DOM order in T3 only. Checking them by hand is the Tester's job (AC-8).
3. Dark mode: the public site has no dark theme, so there was nothing to check.
4. The E2E smoke run (owned by the Tester).
