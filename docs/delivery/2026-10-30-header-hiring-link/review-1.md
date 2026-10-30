# Review 1: Requirement (stage 1), header "We're hiring" link

Reviewer, 30 Oct 2026. Branch `feature/header-hiring-link`. Reviewed `01-requirement.md` against:
- Saurabh's one-liner and the owner's "big" request
- `apps/web/src/components/layout/header/Header.tsx`, `Header.module.css` and `Header.test.tsx`
- `NAV` in `apps/web/src/constants/content.constants.ts`
- `apps/web/src/constants/careers.constants.ts`
- `apps/web/src/components/layout/footer/Footer.tsx`
- `docs/delivery/2026-10-27-we-are-hiring/01-requirement.md` (decision 1 and D1)
- `actionItems.md` section H (item 49, Q2 and Q5)

## Verdict: APPROVED

The requirement matches the ask. The link always shows, has no flag, and is hidden only the way the other links are, while the phone menu is closed (AC-4, AC-6, AC-7). It's a peer link, not a second button (AC-10), and this follows Saurabh's "as per other links" wording, which is the right reading. Scope is one link, with the extras deferred by name (D1a to D1d). The ACs are numbered and testable, and the stated header order matches `Header.tsx` today. Assumption 5 rightly stops the Architect from fixing the 1024 to 1279px crowding by hiding the link.

## Findings

1. **Non-blocking (fix in the doc before stage 2): AC-6 asks more of this link than the other menu links get, and that clashes with AC-7 and AC-13.**
   - In the phone menu, the section links and News use `.links a { padding: var(--space-2) 0 }` at 18px with line-height 1.6. That makes them about 45px tall, under `--tap-target` (48px). Only `.signIn` has `min-height: var(--tap-target)`.
   - If the Developer reuses `.links a`, AC-6 fails at about 45px.
   - To pass AC-6 they would need either a rule only this link gets (breaks AC-7 as written), or taller menu links everywhere (breaks AC-13's "look as before").
   - Fix, one of:
     - (a) AC-6: "its tap target is the same height as the other menu links".
     - (b) Keep 48px, and have AC-7 cover only rules that hide or show the link.
   - Recommended: (a). Raising every menu link to 48px is a separate polish item.

2. **Non-blocking: AC-14 points to e2e specs that don't exist.** There is no header or nav spec; `e2e/tests/` only has admin-posts, invite-onboarding, our-approach, register-interest and staff-login, plus `e2e/csp/public-csp.spec.ts`. Fix, one of:
   - (a) "the existing e2e suite passes".
   - (b) Make a new header e2e spec in scope on purpose.

   (a) keeps the slice small; the Tester can do the width checks by hand.

3. **Non-blocking: AC-2 should name one source for the label.** Add to AC-2: "the header and footer read the same constant (one edit changes both)", so a later Q5 answer can't update one link and not the other.

4. **Nit: earlier docs and comments that will go stale.** For the Developer to update:
   - The `Header.tsx` top comment, which lists the header contents.
   - The `Header.module.css` comment at the 1024 to 1279px block ("With the News link there are six links").
   - The `Header.test.tsx` case "is the last of 6 nav items", which is now 7, and News is no longer last.
   - `2026-10-27-we-are-hiring/01-requirement.md` decision 1 and D1: a one-line "superseded by 2026-10-30-header-hiring-link" note.

5. **Nit: AC-10 wording.** "Same size and weight as the other links or Sign in" allows medium or semibold. The Architect should pick one so the Tester has a single answer.

## Assumptions check

1. "As per other links" winning over "big", with "big" parked as D1d: sensible. The owner should hear this in the stage summary.
2. Header only, not the announcement bar: sensible.
3. Portal out of scope: right, because `Header` is only rendered through `SiteLayout`.
4. Label and path stay pending Q5: right. A header link makes a later path change more visible. No change needed.
5. The crowding fix belongs to the Architect, with no hiding: right, and needed. A seventh link at 1024px with News and Sign in showing is the real design risk for stage 2.

## What's pending

1. The PO updates `01-requirement.md` for findings 1 to 3 (wording only). No further review round needed.
2. Findings 4 and 5 go to the Architect and Developer at their stages.
