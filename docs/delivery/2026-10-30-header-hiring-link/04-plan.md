# 04 Plan: "We're hiring" link in the site header

Stage 4 (Manager), 30 Oct 2026. Branch `feature/header-hiring-link` (already cut; don't switch). Input: `01-requirement.md`, `02-architecture.md` (DEC-HL-1 to DEC-HL-5), `03-design.md`, `review-1.md`, `review-2.md`, `review-3.md` (APPROVED; its findings 1 and 2 are folded into slices 2 and 3), `review-4.md`.

Owner for every slice: **Developer**. One commit per slice. Write `05-dev-notes.md` in this folder as you go.

## Baseline (run by the Manager on this branch, 30 Oct, before any change)

| Command | Result |
|---|---|
| `pnpm exec prettier --check <touched files>` (list below) | clean |
| `pnpm lint` | pass |
| `pnpm typecheck` | pass |
| `pnpm test` | 657 web + 6 e2e-unit pass |
| `pnpm --filter web exec vitest run src/components/layout/header src/components/layout/footer` | 10 pass |
| `VITE_APP_ENV=production pnpm build` | pass, `apps/web/build/client/careers/index.html` exists |
| `pnpm build` (no env) | **fails by design**: `VITE_APP_ENV must be one of ...`. Always set `VITE_APP_ENV=production`. |
| `pnpm format:check` / `pnpm check` | **fails before any change** on untracked `actionItems.md` and gitignored `supabase/.temp/linked-project.json`. Don't use `pnpm check` as the gate and don't run `pnpm format` (it would rewrite `actionItems.md`). `docs/` is in `.prettierignore`, so doc edits need no formatting. |

Touched source files (the scoped Prettier list):

```
apps/web/src/constants/careers.constants.ts
apps/web/src/constants/content.constants.ts
apps/web/src/components/layout/header/Header.tsx
apps/web/src/components/layout/header/Header.module.css
apps/web/src/components/layout/header/Header.test.tsx
apps/web/src/components/layout/footer/Footer.tsx
apps/web/src/components/layout/footer/Footer.test.tsx
```

Fix formatting with `pnpm exec prettier --write <those files>` only.

## Slices

1. **Constants rename and shared link (03 §1, §4, Footer half of §5).**
   - `CAREERS.footerLink` becomes `CAREERS.linkLabel`; add `NAV.careersLink`; update the News comment at `content.constants.ts:50-51`; `Footer.tsx` and `Footer.test.tsx` read `NAV.careersLink`.
   - Visible after: footer unchanged on screen; `grep -rn footerLink apps/web/src` returns nothing; footer tests pass; `pnpm typecheck` passes.
   - Commit: `refactor(careers): share the We're hiring label through NAV.careersLink`

2. **Header link and unit tests (03 §2, header half of §5).**
   - Add the `<li>` after the News block with no condition and no class; update the top comment; add T1 to T7 with the analytics mock.
   - Edit, don't delete, both existing News tests:
     - `Header.test.tsx:50` ("is not shown when there is no news"): expect `NAV.links.length + 1`, with a short comment that "We're hiring" always shows (DEC-HL-5) (review-3 finding 1).
     - `Header.test.tsx:53-61` ("is the last of 6 nav items"): 7 items, News second to last, new name and comment per 03 §5.2.
   - Visible after: the link appears in the dev server header and phone menu (desktop will look crowded until slice 3, which is expected); header and footer vitest run passes; no jsdom "Not implemented: navigation" noise (use the `preventDefault` listener from 03 §5 if it shows).
   - Commit: `feat(header): add We're hiring link after News`

3. **Desktop fit CSS and measurements (03 §3).**
   - Add the 15px rule inside `@media (min-width: 1024px)`; replace the 1024 to 1279px band body with gaps 12/8/12; update the band comment.
   - No per-value comments in the gap rules (no "12px, was --space-4"); the block comment from 03 §3.3 already gives values and reason (review-3 finding 2).
   - How to get the crowded case (no DB writes): `supabase/seed.sql` has no posts, so plain `pnpm dev` hides News and shows six links, not the crowded seven. Either inject the News `<li>` in the browser on the dev server (copy of a section `<li>` with News text and `/posts` href, as review-2 did), or use the local Supabase stack only if it already has a published post (never point the dev server at the hosted project). Don't insert a post. Confirm Sign in is showing; `APP_CONFIG.features.portal` is on only when the Supabase and Turnstile `VITE_*` values are set in the local env. Record both the News method and the Sign in check in `05-dev-notes.md`.
   - Visible after: at 1024, 1093, 1180, 1279, 1280 and 1440px with News on and portal on, the header is one row, 72px tall, no sideways scroll, Sign in icon 20px. Record the logo gap and Sign in icon width per width in `05-dev-notes.md`, next to 02's expected figures (14/83/110/110/46/46). Anything under 10px at 1024, stop and tell the team lead, don't improvise a fix. Below 1024 nothing changes.
   - Commit: `style(header): fit seven links at 15px with tighter 1024-1279px gaps`

4. **Doc and comment updates (03 §6 items 4 and 5).**
   - Append "Superseded by 2026-10-30-header-hiring-link." to decision 1 (line 13) and D1 (line 118) of `docs/delivery/2026-10-27-we-are-hiring/01-requirement.md`.
   - Append "(superseded by DEC-HL-5, 2026-10-30-header-hiring-link)" at `docs/requirements/release-1/PRP.md:55` and `docs/requirements/release-1.1/PRP.md:23`.
   - Visible after: `git show --stat HEAD` after the commit shows only those three docs (plus `05-dev-notes.md` if committed here).
   - Commit: `docs: mark the nav cap and header deferral superseded by DEC-HL-5`

5. **Full check and production build.**
   - Run, in order: scoped `pnpm exec prettier --check <touched files>`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `VITE_APP_ENV=production pnpm build`. Paste the pass lines into `05-dev-notes.md`, with exact test counts before (baseline: 657 web, 6 e2e-unit) and after.
   - Visible after: all five pass; test count is baseline plus the new header tests; `apps/web/build/client/careers/index.html` exists.
   - E2E (`pnpm --filter aj-classes-e2e test:smoke`) is **not** run by the Developer. It needs the local Supabase stack and dev server and writes to the local DB, so the Tester is its single owner at stage 6 (aj_classes item 8 lesson). The Manager did not run it for this plan.
   - Commit: `docs(delivery): add dev notes for header hiring link` (if notes weren't already committed with slice 3/4).

Commit rules for every slice: Conventional Commits, ending with these two trailers:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A1DbV4TiejKYcjmQovB56Z
```

Stage files by name. Never stage `actionItems.md` or any `run/` folder. No `git add -A` / `git add .`.

## Risks

1. **14px logo gap at 1024 is thin.** Mac system font (SF) is the widest likely case. Mitigation: slice 3 measures, Tester rechecks 1024 on a Mac. Any later longer label (Q5, B11 "What's On") must re-measure; fallback is raising the breakpoint.
2. **Desktop text drops from 18px to 15px on every page.** Intended (DEC-HL-3, AC-13 exception) but visible. Saurabh must hear it in the stage summary so it isn't reported as a regression.
3. **Owner asked for "big".** v1 is a peer link per Saurabh's wording. If the owner pushes back, that's D1d, not a bug.
4. **Measuring the wrong case.** Without posts and portal env the dev server shows the uncrowded header and the gaps look fine. Mitigation: slice 3 names how to show News and check Sign in.

## Deferred (from 01, not dropped)

1. **D1a:** "We're hiring" in the mobile CTA bar, announcement bar or a home-page section.
2. **D1b:** careers-click analytics as its own event (not `cta_click`).
3. **D1c:** a switch to hide the link and page when not hiring (Q2, action items section H).
4. **D1d:** a bigger or button-styled treatment if the owner still wants "big".

## Decisions record

DEC-HL-1 to DEC-HL-5 go into `/Users/sjain/second-brain/Projects/AJClasses/_knowledge/decisions.md`. **The team lead writes this at close-out**, not the Developer (the file is outside the repo).

## Definition of done

1. Slices 1 to 5 committed on `feature/header-hiring-link`, each with the trailers, none touching `actionItems.md` or `run/`.
2. Header shows "We're hiring" after News and before Sign in / Register Interest on every public page, desktop and phone menu, with no flag or condition; footer link unchanged; both read `NAV.careersLink`.
3. T1 to T7 pass; both News tests are edited, not deleted: `Header.test.tsx:50` expects `NAV.links.length + 1`, and `:53-61` expects 7 items with News second to last. Slice 5 commands all pass, with before/after test counts in the dev notes.
4. `05-dev-notes.md` has the measured logo gap and Sign in icon width at all six widths, plus how News was shown and that Sign in was on.
5. Stale comments and docs from 03 §6 items 1 to 6 updated.
6. Tester signs off AC-5, AC-6, AC-8, AC-10, AC-13 by hand and runs e2e smoke; Security has no open finding on the flow; Reviewer approves the diff.
7. Team lead records DEC-HL-1 to DEC-HL-5 and tells Saurabh about the 15px text and the lifted nav cap.
