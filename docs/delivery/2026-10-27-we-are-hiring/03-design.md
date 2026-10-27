# 03 — Solution design: "We're hiring" page (web, `feature/we-are-hiring`)

Stage 3 of `/deliver`, Solution Designer. Date: 2026-10-27. Inputs: [01-requirement.md](01-requirement.md) (approved, review-1 round 2) and [02-architecture.md](02-architecture.md) (approved, review-2 round 2).

All paths are relative to the repo root. Every line anchor below was read on `feature/we-are-hiring` on 2026-10-27. The Developer re-checks each one before editing. No API, no data model, no migration, no new dependency, no env var.

## 1. Components

| # | Component | Responsibility |
|---|---|---|
| 1 | `apps/web/src/constants/careers.constants.ts` (new) | All careers wording, the SEO entry, the footer label, the error-boundary copy, and `careersApplyHref()`. This is the only place the subject line lives. |
| 2 | `apps/web/src/routes/careers.tsx` (new) | A presentational page: `meta()`, the default page and `ErrorBoundary`. No HTTP and no hooks of its own. |
| 3 | `apps/web/src/routes/careers.module.css` (new) | Keeps lists at the paragraph width and spaces the apply button. |
| 4 | `Footer.tsx` (edit) | One more anchor in the legal row. |
| 5 | Routing, prerender, sitemap (edit) | `ROUTES.careers`, `route()`, `prerender`, `ALWAYS_LISTED`. |
| 6 | Test lists (edit) | Vercel CSP path list, CSP e2e `PAGES`, Lighthouse URLs. |

**New file vs `content.constants.ts`.** Use a new file. Each recent feature page has its own constants file with `seo` nested inside, plus its footer label: `posts.constants.ts` (`POSTS_PUBLIC_PAGE.seo`, `.errorBoundary`) and `resources.constants.ts` (`RESOURCES.seo`, `RESOURCES.footerLink`). `content.constants.ts` (497 lines) holds the older home, privacy and footer copy. So the SEO entry goes in `CAREERS.seo`, not in `SEO` in `seo.constants.ts`.

## 2. Constants: `apps/web/src/constants/careers.constants.ts` (new)

Header comment: say what the page is, that applications go by email and nothing is stored (DEC-WH-1), and that the wording is draft for the owner to confirm (01 Q1–Q6). Imports: `BUSINESS` from `./business.constants` only.

The file has three parts.

1. **`APPLY_SUBJECT`**: a private module const set to `'Tutor application'`. It is used by both the copy and the href, so it is typed once.
2. **`CAREERS`**: an object `as const` with these keys. The copy is taken word for word from the 01 "Draft copy" table.

| Key | Type | Value |
|---|---|---|
| `footerLink` | string | `We're hiring` |
| `heading` | string | `We're hiring` |
| `intro` | string | `` `AJ Classes is growing, and we're looking for tutors to join our small team. We teach small groups in person in ${BUSINESS.suburbsText}, and online across Australia.` `` |
| `rolesHeading` | string | `Roles` |
| `roles` | `readonly string[]` | `['Tutor (casual)']` |
| `lookingFor.heading` | string | `Who we're looking for` |
| `lookingFor.points` | `readonly string[]` | 4 items, split from the draft: "People who enjoy helping students learn and build confidence." / "Strong in one or more of Maths, Science or English, or in exam preparation (selective entry, scholarship, NAPLAN or ICAS)." / "Comfortable teaching small groups, primary to Year 10." / "Reliable, patient and clear communicators." |
| `needs.heading` | string | `What you'll need` |
| `needs.points` | `readonly string[]` | 3 items: "A current Victorian Working with Children Check (or VIT registration), or a willingness to get one before you start." / "The right to work in Australia." / "Tutoring or teaching experience is a plus but not essential." |
| `apply.heading` | string | `How to apply` |
| `apply.text` | string | `` `Email us at ${BUSINESS.email} with "${APPLY_SUBJECT}" in the subject. Tell us about your subjects, year levels and experience, and attach your CV. We'll only use your details to consider your application.` `` |
| `apply.linkText` | string | `Email your application` |
| `apply.subject` | string | `APPLY_SUBJECT` |
| `backHome` | string | `Back to home` |
| `seo.title` | string | `Careers \| AJ Classes` |
| `seo.description` | string | `` `AJ Classes is looking for tutors in ${BUSINESS.suburbsText}, and online. See who we're looking for and how to apply.` `` (136 characters, checked) |
| `errorBoundary.heading` / `.text` / `.backHome` | string | The same wording as `POSTS_PUBLIC_PAGE.errorBoundary` (`posts.constants.ts:19-23`). Retype it here; don't import it, because careers mustn't depend on the posts constants. |

3. **`careersApplyHref(): string`**: an exported function with a JSDoc line, placed after `CAREERS`, following `whatsappChatUrl()` in `business.constants.ts:30-34`. It returns `` `mailto:${BUSINESS.email}?subject=${encodeURIComponent(CAREERS.apply.subject)}` ``, which gives exactly `mailto:hello@ajclasses.com.au?subject=Tutor%20application` (checked with node; AC-10).

**Barrel:** `apps/web/src/constants/index.ts`. Insert `export * from './careers.constants';` after line 6 (`./business.constants`), keeping the list alphabetical.

**Route path:** `apps/web/src/constants/routes.constants.ts`, inside `ROUTES` (lines 4-15). Insert `careers: '/careers', // "We're hiring" page (we-are-hiring 01)` after line 14 (`posts`).

The no-name / no-address / no-ABN rule (AC-12): the file uses only `BUSINESS.email` and `BUSINESS.suburbsText`. No person, no street, no ABN, no pay, no hours, no dates.

## 3. Route: `apps/web/src/routes/careers.tsx` (new)

Follow `routes/privacy.tsx` (1-38) for the page and `routes/posts.tsx` (77-88) for the boundary.

1. **Imports:** `SiteLayout` from `@/components/layout/SiteLayout`; `ButtonLink` and `Section` from `@/components/ui`; `CAREERS`, `ROUTES` and `careersApplyHref` from `@/constants`; `buildPageMeta` from `@/lib/seo`; `styles from './careers.module.css'`. `BUSINESS` isn't needed, because the email is already inside `CAREERS.apply.text`.
2. **`export function meta()`:** returns `buildPageMeta(CAREERS.seo, ROUTES.careers)`. No `noIndex` option, so production indexes the page and other builds get noindex (`seo.ts:50`). Add no JSON-LD.
3. **`export default function CareersPage()`:** renders `SiteLayout` > `Section` (no `heading` prop, as on privacy) and then, in this order:
   1. `<h1>{CAREERS.heading}</h1>`
   2. `<p>{CAREERS.intro}</p>`
   3. `<h2>{CAREERS.rolesHeading}</h2>`, then `<ul className={styles.list}>` with one `<li key={role}>` per role.
   4. `<h2>` for `lookingFor.heading`, then `<ul className={styles.list}>` of points, `key={point}`.
   5. `<h2>` for `needs.heading`, then the same kind of list.
   6. `<h2>` for `apply.heading`, then `<p>{CAREERS.apply.text}</p>`. This shows the address as plain text (AC-11).
   7. `<p className={styles.apply}><ButtonLink href={careersApplyHref()}>{CAREERS.apply.linkText}</ButtonLink></p>`. `ButtonLink` has `min-height: var(--tap-target)` (48 px, `theme.css:152`), so it meets the 44 px target in AC-14. No `target`, because mailto opens the mail app.
   8. `<p><a href={ROUTES.home}>{CAREERS.backHome}</a></p>`
4. **`export function ErrorBoundary()`:** copy `posts.tsx:77-88` (from the comment line to the closing `}`), with `POSTS_PUBLIC_PAGE.errorBoundary.*` swapped for `CAREERS.errorBoundary.*`.

Rules to keep: no inline `style`, no `console.*`, no literals in JSX (`eslint.config.js:31`), and a stable `key` on every `.map()`. The lists use the browser's default bullets. `global.css` doesn't reset `ul`, and the ticked `.points` style of the programme and resource pages must **not** be copied here (AC-14).

## 4. CSS: `apps/web/src/routes/careers.module.css` (new)

1. `.list`: `max-width: var(--measure);` so lists wrap at the same width as `p` (`global.css`, `p { max-width: var(--measure) }`). Leave margin and list-style at their defaults.
2. `.apply`: `margin-top: var(--space-6);` so the button doesn't sit tight against the paragraph.

Use only tokens that already exist in `styles/theme.css`. Add nothing else.

## 5. Routing, prerender and sitemap (edits)

| File | Anchor (verified) | Change |
|---|---|---|
| `apps/web/src/routes.ts` | line 19 `route(ROUTES.posts, …)`; `route('*', …)` is at line 79 | Insert `route(ROUTES.careers, 'routes/careers.tsx'),` after line 19 (before `ROUTES.sitemap`, line 20). |
| `apps/web/react-router.config.ts` | `prerender` lines 12-23; `ROUTES.privacy` at line 14 | Insert `ROUTES.careers,` after line 14. |
| `apps/web/src/routes/sitemap.ts` | `ALWAYS_LISTED` lines 7-13; `ROUTES.privacy` at line 12 | Insert `ROUTES.careers,` after line 12. Not in the Supabase branch (line 17). |
| `apps/web/vercel.json`, `serve.railway.json`, `robots.ts` | — | **No change** (02 constraints 2 and 4; AC-29). |

## 6. Footer (edit)

`apps/web/src/components/layout/footer/Footer.tsx`:
1. Add `CAREERS,` to the `@/constants` import list (lines 5-17), after `BUSINESS,` (line 8).
2. In the legal row (lines 77-82), insert `<a href={ROUTES.careers}>{CAREERS.footerLink}</a>` between line 79 (Resources) and line 80 (Privacy). That gives the AC-3 order. `.legal` already wraps (`Footer.module.css:58-62`, `flex-wrap: wrap; gap: var(--space-6)`), so the CSS doesn't change.
3. Update the header comment (lines 1-2) only if it lists the links. It currently says "legal links (News only when posts exist)", which is still true, so leave it.

The header, the mobile CTA bar and the WhatsApp button are untouched (AC-26).

## 7. Test-list additions

| File | Anchor (verified) | Change |
|---|---|---|
| `apps/web/src/hosting-csp.test.ts` | public-path list lines 125-133; `'/privacy'` at 127 | Insert `'/careers',` after line 127. |
| `e2e/csp/public-csp.spec.ts` | `PAGES` lines 22-32; `'/privacy'` at 28 | Insert `'/careers',` after line 28. The loop (lines 90-117) already toggles the phone menu and subscribes via the footer on every page, so nothing else changes. |
| `apps/web/lighthouserc.json` | `collect.url` lines 6-13; `/privacy` at line 12 | Add `"http://127.0.0.1:4173/careers"` after line 12 (add the comma on line 12). This gives CI a11y ≥ 0.9, SEO = 1, and the no-Supabase-request check (`lighthouse:report`) on the page. The comment on `PAGES` ("The Lighthouse page set plus …") stays true. |

**Existing tests whose expectations change: none break.** I grepped `'/privacy'`, `ROUTES.privacy` and `ROUTES.subscribed` across `apps/web` and `e2e`. Other hits: `Header.test.tsx:72` (header only), `seo.test.ts:58` (privacy meta), `portal-access.test.ts:227-228` (redirect guard), `lighthouse-report.test.ts:93` (a fixture URL) and `ContactForm.tsx:177`. No test counts footer links. `structured-data.ts:28-34` classes `careers/index.html` as `other`, so no rules change. `check-hosted-ref` scans the whole build, so it needs no change. `e2e/tests/*` has no list of public routes.

## 8. New and extended unit tests (Vitest, co-located)

1. **`apps/web/src/routes/careers.test.tsx` (new).** Render with `renderAt(<CareersPage />, ROUTES.careers)` (`src/test/render.tsx`). Scope queries to `within(screen.getByRole('main'))`, because the footer also has h2s and mailto links.
   - (a) There is exactly one h1, with the text `CAREERS.heading`.
   - (b) The h2 texts, in order, are `[rolesHeading, lookingFor.heading, needs.heading, apply.heading]`, and there are no h3 to h6.
   - (c) The apply link (by name `CAREERS.apply.linkText`) has `href` equal to the **literal** `'mailto:hello@ajclasses.com.au?subject=Tutor%20application'`, and has no `target`.
   - (d) `main` text contains `BUSINESS.email`.
   - (e) The needs points mention `Working with Children Check` and `VIT`.
   - (f) There is exactly one link named `CAREERS.backHome`, with `href` `ROUTES.home`.
   - (g) Content guard: `JSON.stringify(CAREERS)` doesn't match `/\$|\bABN\b|per hour|hourly|start date|guarantee|Melbourne's west/i`.
   - (h) `meta()`: the title ends with `CAREERS.seo.title`, the description is under 160 characters and contains `BUSINESS.suburbsText`, the canonical `href` equals `absoluteUrl(ROUTES.careers)`, and no entry has `'script:ld+json'`.
   - (i) `ErrorBoundary`: h1 is `CAREERS.errorBoundary.heading`, a back-home link goes to `ROUTES.home`, and `contentinfo` is present (copy `posts.test.tsx:101-112`).
   - (j) `routerConfig.prerender` contains `ROUTES.careers`. Import it from `../../react-router.config`, as `hosting-config.test.ts:10` does.
2. **`Footer.test.tsx` (extend, file is 31 lines).** Add `CAREERS`, `RESOURCES`, `APP_CONFIG` and `FOOTER_PORTAL` to the import on line 4, and add a `describe('footer legal row (we-are-hiring)')`.
   - (a) The link named `CAREERS.footerLink` has `href` `ROUTES.careers` and no `target` attribute.
   - (b) Order, with news off and with news on: the link texts inside the legal row are `[...(news ? [FOOTER.newsLink] : []), RESOURCES.footerLink, CAREERS.footerLink, FOOTER.privacyLink, ...(APP_CONFIG.features.portal ? [FOOTER_PORTAL.signIn] : [])]`. To find the row, use the `parentElement` of the Resources link, then `within(row).getAllByRole('link')`.
3. **`sitemap.test.ts` (extend, file is 25 lines).** Add `it('lists /careers with and without Supabase (AC-20)')`. It asserts that both `publicSitemapPaths(true)` and `publicSitemapPaths(false)` contain `ROUTES.careers`. The existing "last is /posts" test (lines 8-12) still holds, because careers sits inside `ALWAYS_LISTED`.

Run one file with `pnpm --filter web exec vitest run src/routes/careers.test.tsx` (and the same for the others). Run everything with `pnpm check` from the repo root.

## 9. Sequencing

1. Constants: the new file, the barrel line and `ROUTES.careers`.
2. The route file and its CSS, plus `routes.ts` and `react-router.config.ts`.
3. The footer link.
4. The sitemap.
5. Test lists and Lighthouse.
6. The new and extended tests.
7. `pnpm check`.
8. Build as CI does, then the CSP sweep and Lighthouse (§10).

Each step builds on the one before. Steps 3 to 5 are independent of each other.

## 10. Test approach per AC

Shared commands. **U** means unit (§8). **E** is the CSP e2e. **L** is Lighthouse. **M** is manual. The production-like build mirrors CI (`.github/workflows/ci.yml:116-124`):

```
VITE_APP_ENV=production VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_FORM_ACCESS_KEY=local-placeholder VITE_KIT_FORM_ID=0000000 pnpm build
pnpm --filter web mirror          # serves build on http://127.0.0.1:4173
pnpm --filter aj-classes-e2e test:csp   # E
pnpm --filter web lighthouse && pnpm --filter web lighthouse:report   # L
```

| AC | How | Check |
|---|---|---|
| 1 | U + M | Footer test 2a covers every page, because `SiteLayout` renders `Footer` and the 404 uses `SiteLayout` (`not-found.tsx:3`). M: on the mirror, look at the footer on `/`, `/programmes/vce`, `/resources/victorian-selective-entry-exam`, `/posts`, `/privacy`, `/subscribed`, `/nope` and `/careers`. |
| 2 | U | Footer 2a |
| 3 | U | Footer 2b (news on and off, portal flag from config) |
| 4 | M | DevTools at 375 and 1280 px: no horizontal scroll, no overlap, same look as "Parent guides". Contrast is the same as the neighbours (same element and class). |
| 5 | M | Tab to the link: a focus ring shows (`global.css :focus-visible`), and Enter opens `/careers`. |
| 6 | M | `/portal/login` shows no "We're hiring" (the portal has no `Footer`; unchanged). |
| 7 | U + M | U 1j. M: `test -f apps/web/build/client/careers/index.html && grep -c 'Tutor (casual)' apps/web/build/client/careers/index.html` returns ≥ 1, and `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4173/careers` returns `200`. |
| 8 | U | 1a |
| 9 | U | 1b, 1e |
| 10 | U + M | U 1c (exact literal). M: click on desktop with a mail client, and tap on iOS Safari and Android Chrome. A new email to hello@ opens with the subject "Tutor application". |
| 11 | U | 1c (link text), 1d (address as text) |
| 12 | U + M | U 1g. M: read the page. |
| 13 | U | `CAREERS.apply.text` contains "attach your CV" and "only use your details" (add to 1d). |
| 14 | M + L | DevTools at 375 and 1280 px: compare spacing with `/privacy`, check the bullets are default discs, and check the apply button is at least 44 px tall in the box model. |
| 15 | U + L + M | U 1b (heading levels). L: a11y ≥ 0.9 in CI. M: run the axe DevTools extension on `/careers` and find 0 serious or critical issues. Tab through every link, and check the skip link focuses `main`. |
| 16 | U | 1f |
| 17 | U + M | U 1h. M: on the production build the `<title>` is exactly "Careers \| AJ Classes". On a `VITE_APP_ENV=staging pnpm build` it has the `[STAGING]` prefix. |
| 18 | U | 1h |
| 19 | U | 1h |
| 20 | U + M | U 3. M: `grep -c '/careers' apps/web/build/client/sitemap.xml` returns 1 on the no-Supabase build. |
| 21 | M | Production build: `grep -c noindex apps/web/build/client/careers/index.html` returns 0. Staging build: it returns ≥ 1, and `robots.txt` contains `Disallow: /`. |
| 22 | U + M | U 1h. M: `pnpm --filter web check:structured-data` passes. |
| 23 | M | On the mirror, the DevTools console on `/careers` and `/` shows 0 errors and 0 warnings. |
| 24 | Command | `pnpm check` from the repo root passes. |
| 25 | M + L | `git diff develop -- '**/package.json' pnpm-lock.yaml` is empty, and so is `git diff develop -- '**/.env*'`. Network tab: `/careers` makes the same requests as `/privacy`, both of which run the footer news check. L: `lighthouse:report` reports 0 supabase.co requests. |
| 26 | M + suite | `Header.test.tsx`, `WhatsAppButton.test.tsx` and the existing footer News tests pass unchanged. Visual check of the header, the CTA bar and WhatsApp at 375 px. |
| 27 | M | `git diff develop --stat` doesn't touch `services/`, `sections/contact/` or `supabase/`. |
| 28 | M | `git diff develop --stat -- supabase/` is empty. |
| 29 | U + E | `hosting-csp.test.ts` (with the new path) passes. `git diff develop -- apps/web/vercel.json apps/web/serve.railway.json` is empty. E: `/careers` at both widths shows 0 violations. |
| 30 | M | `git diff develop -- apps/web/src/constants/content.constants.ts` is empty. |

## 11. Open items

1. `[TBC: role, must-haves, WWCC timing, label, path and subject line (01 Q1, Q3, Q5, Q6) – Saurabh]`. These are copy-only changes in `careers.constants.ts` and need no design change. The path is the one thing that's costly to change after indexing.
2. `[TBC: hide when not hiring (01 Q2 / D2) – Saurabh]`. If yes, the later design adds a `null`-hides-it flag that gates the footer link, the route, the prerender entry and the sitemap entry together.
3. `[TBC: a privacy policy line about job applications (01 Q4) – Saurabh]`. Out of v1 (AC-30).
4. Recording DEC-WH-1 in `_knowledge/decisions.md` belongs to the lead or Architect after stage 2, not to this design.
