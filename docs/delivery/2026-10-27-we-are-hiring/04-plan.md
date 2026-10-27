# 04 — Delivery plan: "We're hiring" page (web, `feature/we-are-hiring`)

Stage 4 of `/deliver`, Manager. Date: 2026-10-27. Inputs: [01](01-requirement.md), [02](02-architecture.md), [03](03-design.md), reviews 1-3 (all approved). Design section numbers (§) refer to 03.

Every check below was run once on this branch on 2026-10-27 (baseline: 62 files / 527 tests pass, prettier clean, `/careers` returns 404 as expected). Run commands from the worktree root. `CI_ENV` means: `VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000`. The worktree has no `.env.local`, so a bare `pnpm build` (and so `pnpm check`) fails with `VITE_APP_ENV must be one of ...`; always prefix `CI_ENV`.

`CI_ENV` is shorthand (review-4 item 1). Export the placeholders once per shell before the build or check, exactly as in `ci.yml:116-124` (no real keys, no hosted reference):

```
export VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000
``` Prettier is clean repo-wide, so `pnpm format` is safe. One commit per task, Conventional Commits.

## Tasks

- [x] **T1 — Constants, route, page renders.** New `apps/web/src/constants/careers.constants.ts` (§2), barrel line in `constants/index.ts`, `ROUTES.careers` in `routes.constants.ts`, new `routes/careers.tsx` + `careers.module.css` (§3-4, incl. `ErrorBoundary`), `route()` in `src/routes.ts`, `ROUTES.careers` in `react-router.config.ts` prerender (§5). **Check:** `CI_ENV pnpm build`, then `grep -c 'Tutor (casual)' apps/web/build/client/careers/index.html` ≥ 1 (AC-7).
- [x] **T2 — Footer link.** `components/layout/footer/Footer.tsx` (§6). **Check:** rebuild, `grep -c 'href="/careers"' apps/web/build/client/privacy/index.html` ≥ 1.
- [x] **T3 — Sitemap.** `ROUTES.careers` in `ALWAYS_LISTED`, `src/routes/sitemap.ts` (§5). **Check:** rebuild, `grep -c '/careers' apps/web/build/client/sitemap.xml` returns 1 (AC-20).
- [x] **T4 — CSP and Lighthouse lists.** `/careers` in `apps/web/src/hosting-csp.test.ts`, `e2e/csp/public-csp.spec.ts` `PAGES`, `apps/web/lighthouserc.json` `collect.url` (§7). No change to `vercel.json`, `serve.railway.json`, `robots.ts`. **Check:** `pnpm --filter web exec vitest run src/hosting-csp.test.ts`.
- [x] **T5 — Unit tests.** New `routes/careers.test.tsx` (1a-1j), extend `Footer.test.tsx` (2a-2b) and `sitemap.test.ts` (3), per §8, incl. AC-13 wording in 1d. **Check:** `pnpm --filter web exec vitest run src/routes/careers.test.tsx src/routes/sitemap.test.ts src/components/layout/footer/Footer.test.tsx`.
- [x] **T6 — Full gate (CI order, review-3 item 1).** Nothing may listen on 4173 (`lsof -i :4173 -sTCP:LISTEN` empty), because lhci starts its own server there.
  1. `CI_ENV pnpm check`
  2. `pnpm --filter web check:hosted-ref build/client` ("0 files") on the build `pnpm check` just made; no second build needed (review-4 item 4).
  3. `pnpm --filter web check:structured-data` (0 problems)
  4. First `pnpm --filter aj-classes-e2e exec playwright install chromium` (review-4 item 2; no `--no-sandbox` on macOS, CI only needs it on Ubuntu). Then `export CHROME_PATH="$(cd e2e && node -e "import('@playwright/test').then(({chromium})=>console.log(chromium.executablePath()))")"`, then `pnpm --filter web lighthouse` → `pnpm --filter web lighthouse:report` (0 supabase.co requests, `/careers` listed) → `pnpm --filter aj-classes-e2e test:csp` (`/careers` passes at both widths; 21 tests, was 19).
  5. Only then, for manual/curl checks: `pnpm --filter web mirror`; `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4173/careers` → 200; manual ACs 4, 5, 6, 10, 14, 15 (axe), 23 per §10. Stop the mirror after.
  6. AC-21 (review-3 item 3): production build `grep -c 'name="robots"' apps/web/build/client/careers/index.html` → 0. Then `VITE_APP_ENV=staging` + rest of `CI_ENV`, `pnpm build`: same grep ≥ 1, `grep -cx 'Disallow: /' apps/web/build/client/robots.txt` → 1 (exact line: a plain `grep -c` also matches production's `Disallow: /portal`, so it can't tell the builds apart; production gives 0), title has `[STAGING]`. Rebuild with `CI_ENV` afterwards so `build/` isn't left as staging.
  7. Must-not-change: `git diff develop --stat` touches no `services/`, `sections/contact/`, `supabase/`, `package.json`, `pnpm-lock.yaml`, `.env*`, `vercel.json`, `serve.railway.json`, `content.constants.ts` (AC-25-30).
- **T7 — Docs** (split by owner):
  - [x] Developer: plan ticked, [05-dev-notes.md](05-dev-notes.md) written.
  - [ ] Tester: manual ACs and TSR under this folder.
  - [ ] Lead: record DEC-WH-1 in `_knowledge/decisions.md`.

## Risks (small)

1. Footer order test (2b) depends on the portal flag and news state; build the expected list from `APP_CONFIG`, don't hard-code it.
2. Local Lighthouse needs `CHROME_PATH` (T6.4) and a free port 4173; a stray mirror gives a false failure.
3. The error-boundary copy duplicates posts' and can drift (review-3 item 2, accepted).
4. `/careers` is costly to rename once indexed (Q5); confirm before the production release.

## Deferred (from 01)

D1 header/home mention · D2 on/off switch · D3 JobPosting data, more roles · D4 application form/CV upload (needs Saurabh) · D5 careers social preview · D6 apply-click analytics.

## Open questions for Saurabh (non-blocking, copy-only in `careers.constants.ts`)

1. Q1 Role and subjects right? Add VCE, UCAT/GAMSAT or admin?
2. Q2 Hide page and link when not hiring?
3. Q3 WWCC/VIT before applying, or "before you start"? Other must-haves?
4. Q4 Add a job-applications line to the privacy policy?
5. Q5 Label "We're hiring" and path `/careers` OK?
6. Q6 Subject "Tutor application" OK for inbox filtering?

## Definition of done

1. `CI_ENV pnpm check` green.
2. `CI_ENV pnpm build` + `check:hosted-ref build/client` reports 0 files.
3. CSP e2e and Lighthouse (a11y ≥ 0.9, SEO = 1, 0 supabase.co) pass with `/careers` included.
4. Conventional commits, one per task; this plan ticked.
5. No PII anywhere in the diff: no owner personal name, no street address, no ABN (`careers.test.tsx` 1g guard plus a read of the diff).
6. Manual ACs (4, 5, 6, 10, 14, 15, 23) pass and the TSR is written (review-4 item 3; Tester).
