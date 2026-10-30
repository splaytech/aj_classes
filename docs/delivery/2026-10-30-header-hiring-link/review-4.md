# Review 4: Plan (stage 4), header "We're hiring" link

Reviewer, 30 Oct 2026. Branch `feature/header-hiring-link`. Checked `04-plan.md` against 01, 02, 03 and review-1 to review-3, plus root and `apps/web` `package.json`, `e2e/package.json`, `.prettierignore`, `supabase/.gitignore`, `Header.test.tsx:46-61`, `use-has-news`, `app.constants.ts` features, `supabase/seed.sql` and the four cited doc lines. Ran `pnpm exec prettier --check .` (read-only). No repo files changed.

## Verdict: CHANGES_REQUESTED

The plan is sound and the right size. Three one-line edits are needed before the Developer starts; no re-plan.

## What holds

1. Order works: constants/footer → header link → CSS measured → docs → gate.
2. Gate commands are right: `lint`, `typecheck`, `test`, `build` (with `VITE_APP_ENV`), Prettier on touched files; e2e smoke owned by the Tester.
3. `pnpm check` claim confirmed: `prettier --check .` warns on `actionItems.md` and `supabase/.temp/linked-project.json` (ignored only by `supabase/.gitignore`, which Prettier doesn't read).
4. Doc line references are correct.
5. Design coverage complete apart from findings 1 and 2.
6. Nothing over-scoped; staging by name, never `actionItems.md` or `run/`.

## Findings

1. **Blocking:** review-3 finding 1 isn't in any slice. `Header.test.tsx:50` must become `NAV.links.length + 1` with a short DEC-HL-5 comment (edit, don't delete); add to slice 2 and DoD 3. Also list `review-3.md` as an input (review 3 has finished).
2. **Blocking:** review-3 finding 2 isn't in slice 3: no "was --space-N" / value comments in the gap rules.
3. **Blocking:** slice 3's "News on" measurement doesn't say how. `supabase/seed.sql` has no posts, so plain `pnpm dev` shows six links. Inject the News `<li>` in the browser (as review-2 did) or read an existing published post — no DB writes. Record the method, and confirm Sign in is showing (`APP_CONFIG.features.portal` needs the Supabase and Turnstile env vars), in `05-dev-notes.md`.
4. **Non-blocking:** slice 4's check should be `git show --stat HEAD` after the commit, not `git diff --stat`.
5. **Non-blocking:** DoD 3 should name both edited News tests (line 50 and lines 53-61).
6. **Nit:** record exact before/after test counts in the dev notes.

## Round 2

APPROVED

1. Findings 1 to 6 are all fixed: both News tests edited (line 50 → `NAV.links.length + 1` with a DEC-HL-5 comment; lines 53-61 → 7 items), no "was --space-N" comments, crowded case via browser injection with no DB writes, Sign in check, `git show --stat HEAD`, exact before/after test counts.
2. **Non-blocking (new), fixed in place by the team lead:** slice 3 allowed "a source that already has a published post". The hosted Supabase project serves staging and production, so this now reads "the local Supabase stack only if it already has a published post (never point the dev server at the hosted project)".
