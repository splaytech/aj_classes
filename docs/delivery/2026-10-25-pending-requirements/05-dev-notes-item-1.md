# 05 — Developer notes: item 1 (News page)

> **Stage:** 5 of /deliver (Developer) · **Date:** 25 Oct 2026 · **Branch:** `feature/pending-requirements`
> **Input:** [03-design.md](03-design.md) §1, [04-plan.md](04-plan.md) §3 (T1.1–T1.12), ADR-0001.
> **Next:** T1.12: Reviewer (`review-5-item-1.md`), Tester, Security, then `/test-and-ship`.
> Nothing is pushed or merged.

Everything here ran against the **local** Supabase stack only (`http://127.0.0.1:55321`). Every
build was run after the two `export` lines from 03 §1.6. I checked that no built JS file contains
the hosted project ref.

## 1. Tasks done

| Task | Status | Evidence |
|---|---|---|
| T1.1 Share post rows | Done | `post-rows.ts`; admin published a post at `/portal/admin/posts` (dev server, `admin@local.test`) |
| T1.2 Public posts client | Done | `public-posts.client.test.ts`: 14 tests (reject, 500, bad JSON, 5 s timeout, one fetch for two calls, no fetch when unconfigured) |
| T1.3 `/posts` page states | Done | `posts.test.tsx` (11) + `use-public-posts.test.ts` (4); dev server showed the loading line, then the list |
| T1.4 Pre-render + hosting guard | Done | `hosting-config.test.ts` (5); `build/client/posts/index.html` written; `routes.ts:19` comment updated |
| T1.5 Header News link | Done, with deviation D2 | `Header.test.tsx` (+3); measured at 1024 / 1100 / 1279 / 1280 px (§3.1) |
| T1.6 Footer News link | Done | `Footer.test.tsx` (2) |
| T1.7 Sitemap | Done | `sitemap.test.ts` (3); no-Supabase build has 0 `/posts` in `sitemap.xml`; local-stack build has 1 |
| T1.8 Privacy sentence | Done | `privacy.test.tsx` (+1). Wording is the 03 §1.4 draft, for Saurabh to approve with B1 |
| T1.9 Docs | Done | `docs/architecture/arch.md` (one line), `docs/requirements/blog.md` (status note) |
| T1.10 Local production gate | Done, one leg changed (D4) | §3 below |
| T1.11 Full check | Done | §2 below |
| T1.12 Pipeline | **Not started** | Reviewer, Tester, Security and `/test-and-ship` are the next stages, not the Developer's |

## 2. Commits and full check

Commits (oldest first):

1. `2b4057e` refactor(news): share post row mapping between admin and public reads
2. `5d6862a` feat(news): add public posts client with plain fetch
3. `f3ea8c1` feat(news): render /posts without a clientLoader, with separate empty and error states
4. `62b669a` feat(news): pre-render /posts and guard the hosting config
5. `4d20d48` feat(news): show a News link in the header when posts exist
6. `3d67c46` feat(news): show a News link in the footer when posts exist
7. `042f22f` feat(news): list /posts in the sitemap only when Supabase is configured
8. `8b4a766` feat(news): tell visitors about the news check in the Privacy Policy
9. `5fb06bc` docs(news): record public live reads and the /posts status
10. `246dd9d` fix(news): keep the six-link header bar clear of the logo at 1024-1279 px
11. `ba060cd` fix(news): stop the /posts list from shifting the footer when it loads
12. This file and the ticks in 04 (docs commit).

Full check, from the repo root after the two local exports:
`pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build && pnpm db:test`

| Step | Result |
|---|---|
| `format:check` | Pass |
| `lint` | Pass, 0 problems |
| `typecheck` | Pass |
| `test` | **41 files, 304 tests passed** (before item 1: 35 files, 261 tests) |
| `VITE_APP_ENV=production pnpm build` | Pass |
| `db:test` | **12 files, 349 tests, PASS** (`posts.test.sql` unchanged, AC-1.13) |

## 3. Measurements (production build, local stack)

### 3.1 Header fit (AC-1.8)

Measured with Playwright on the production build: all six `.links > li` share one top edge, the
header stays 72 px tall, and the page never scrolls sideways.

| Width | Before the CSS fix | After the CSS fix |
|---|---|---|
| 1024 px | One row, but **0 px** between logo and links, and the Sign in icon squeezed to 0 px wide | One row, **12 px** logo gap, icon 20 px |
| 1100 px | — | One row, 88 px gap |
| 1279 px | — | One row, 108 px gap |
| 1280 px | One row, 76 px gap (rule doesn't apply) | Same |
| 390 px (phone menu) | News is the last item in the open menu | Same |

Six top-level items in `.links`; Sign in and Register Interest stay in `.actions`.

### 3.2 Layout shift (AC-1.8 and `/posts` itself)

CLS from a `layout-shift` PerformanceObserver. The "slow" runs delay the database reply by 1.5 s
so the link or list arrives well after first paint.

| Page | Viewport | Database reply | CLS |
|---|---|---|---|
| `/` | 1024 × 600 | fast / slow | **0.0041** / 0.0041 (the News link; the architecture estimated ≈ 0.003) |
| `/` | 1280 × 720 | fast | 0.0024 |
| `/programmes/vce` | 1024 × 600 | slow | 0.0041 |
| `/posts`, list | 1024 × 600 / 1280 × 720 / 390 × 844 | fast / slow / slow | Before D3: **0.125 / 0.122 / 0.269**. After D3: **0.0041 / 0.0024 / 0.0000** |
| `/posts`, empty | 1280 × 720 | slow | After D3: 0.0024 |

### 3.3 Bundle check (AC-1.12)

- The 03 §1.6 script, run over 13 pages (home, privacy, resources, the 9 programme pages,
  `/posts`), printed only `done`. The supabase-js chunk is `dist-*.js` and the MUI chunk is
  `portal-*.js`; neither is preloaded by any public page.
- Network check in a real browser on `/`, `/posts`, `/programmes/vce`, `/resources`, `/privacy`:
  0 requests for either chunk. Each page makes one database request
  (`/rest/v1/posts?select=id&limit=1`); `/posts` makes one more for the list. The two links share
  one request, as designed.

### 3.4 Other T1.10 results

| Step | Result |
|---|---|
| Vercel mirror (:4173) | `/posts` 200; list renders; after a reload still 200 with the list (AC-1.1). `/posts/` 301 to `/posts` |
| No-JS HTML (AC-1.3) | `<title>Latest News \| AJ Classes</title>`, the meta description, `<link rel="canonical" href="https://ajclasses.com.au/posts"`, exactly 1 `<h1`, the loading line, no News link |
| Headers (AC-1.4) | `/posts`: no `X-Robots-Tag`, CSP or `Cache-Control: no-store`; no `name="robots"` in the HTML. `/portal/login` still gets all three |
| 404s (AC-1.5) | `/posts/anything` and `/postsx`: 404 with "Page not found" `h1` (both mirrors) |
| Railway mirror (:4174) (AC-1.2) | `/posts` 200; it sends the global `noindex`, as 03 §1.6 expects |
| Staging build (AC-1.4) | `/posts/index.html` has `<meta name="robots" content="noindex"` |
| Empty (AC-1.6, AC-1.10) | Deleted every local post: no News link on `/`, `/programmes/vce`, `/privacy`, `/posts`; `/posts` shows "There are no news posts at the moment." and the two links. Published one again: both links back on reload, no rebuild |
| Error (AC-1.7) | Database refused and database 500 (D4): no links anywhere; `/posts` shows "We couldn't load the news just now. Please try again later." and the two links |
| XSS (AC-1.14) | A post titled `<script>alert(1)</script>`, body `<img src=x onerror=alert(2)>`, published through the admin page, shows as plain text on `/posts`; no dialog fired, no `script` in `main` |
| Tutor (AC-1.13) | `tutor@local.test` at `/portal/admin/posts`: "You don't have access to this page", no Publish button |
| Admin compose (AC-1.14) | Empty title and body: refused with "Some details aren't valid. Please check them and try again." Over-long: the fields stop typing at 120 / 5000 characters (`maxLength`), so an over-long value can't be entered (see §5, item 3) |

## 4. Deviations and `[ASSUMPTION]`s

- **D1. `PORTAL_ERRORS.notConfigured` already existed**, with the text "Sign-in isn't available right now."
  (used by `auth.service.ts`). 03 §1.2 asked to add the key with new text, but a second key of the
  same name can't exist. `[ASSUMPTION]` I reused the existing key and left its text alone. `/posts`
  never shows this text (it shows `POSTS_PUBLIC_PAGE.error`), so nothing a visitor sees changes.
  `error.constants.ts` is untouched.
- **D2. Header CSS: the planned fix wasn't enough.** With only `.links { gap: var(--space-3) }`
  (03 §1.1, conditional), the 1024 px bar still had 0 px between logo and links. The same media
  query (1024–1279 px, breakpoint unchanged) now also sets `.nav` gap to `--space-4` (from
  `--space-6`) and `.actions` gap to `--space-3` (from `--space-4`). Result: 12 px logo gap at
  1024 px, nothing squeezed. I also tried an 8 px link gap: it gave 32 px of room, but the links
  read as one sentence, so I rejected it.
- **D3. `/posts` reserves the first screen.** Not in the design: the list arrives after first paint
  and pushed the visible footer down (CLS up to 0.27 on a phone, which counts as "poor"). The page
  content now has `min-height: calc(100svh - header - 2 × section gap)`, so the footer starts at
  the fold. Trade-off: with 0 or 1 short post there is blank space above the footer (about 350 px
  on a 1280 × 720 screen in the empty state). If Saurabh prefers no blank space, the alternative
  is to accept the CLS on `/posts` only.
- **D4. T1.10 step 6 without `pnpm db:stop`.** The local stack was already running when I
  started, so I didn't stop it. I made the database unreachable in the browser instead: refused
  connections, then HTTP 500, on every `/rest/v1/` request. The browser sees the same thing as a
  stopped database. The Tester can still run the literal `pnpm db:stop` leg.
- **D5. Small additions outside the 21-file list:**
  - `APP_CONFIG.supabase.postsRestPath` and `.publicReadTimeoutMs` in `app.constants.ts`, so the
    path and the 5 s timeout aren't magic values. Same place as `leadsFunctionPath`.
  - `src/test/setup.ts` stubs `fetch` before every test to reject. The test environment reads the
    local Supabase URL from `.env.local`, so without the stub every test that renders the header
    would call the local database.
  - `lib/use-public-posts.test.ts`, added by review-4.
- **D6. Timeout test.** Vitest's fake timers don't reach the browser's own `AbortSignal.timeout`.
  The two timeout tests swap it for an equivalent built on `setTimeout` and check that the code
  asks for 5000 ms. The production code is unchanged.

## 5. Not verified, and notes for the next stages

1. **Hosted site.** No build was served against, or wrote to, the hosted project. The hosted `curl`
   for `/posts` and the posts migration on hosted are Saurabh's B1 release steps (04 §6.1).
2. **Real Vercel.** Checked with the `serve` mirror from 03 §1.6, not with `vercel dev`.
3. **Admin compose messages (AC-1.14).** This is existing behaviour, not changed by item 1.
   - Empty values get a page-level message from the server, not an inline field message.
   - Over-long values are blocked by `maxLength`, not refused with a message.

   The Tester should decide whether this meets AC-1.14's "inline message" wording. If it doesn't,
   it's a small separate fix to the admin page.
4. **Privacy sentence facts.** "Supabase, Sydney" comes from `docs/budget.md` and
   `docs/architecture/arch.md`. I couldn't check the region from outside (the API sits behind
   Cloudflare). "We don't store it" describes AJ Classes. Supabase's own API logs keep request
   metadata for a short time. Saurabh and Security should confirm the wording with B1.
5. **Browsers.** Only Chromium (Playwright). Not tested in Safari or Firefox, or with a real
   phone. The public site has one colour scheme, so there was no dark-mode pass.
6. **No visual "current page" style.** On `/posts` the News link has `aria-current="page"` but
   looks the same as the other top-level links. Top-level links had no current-page style before
   either.
7. **Local data.** I left one realistic post ("Term 4 classes start on Monday") in the local DB,
   so the Tester starts with news. I deleted the test posts I created (the over-long one and the
   `<script>` one).

## 6. Review fixes (review-5-item-1.md, all 3 minors)

| Finding | Fix | Commits |
|---|---|---|
| 1. The sitemap and the client disagree on "configured" | New `services/public-supabase-config.ts` holds one rule, URL **and** key (`hasPublicSupabaseConfig`, `isPublicSupabaseConfigured`). The news reads and `sitemap.ts` both use it. New tests: URL only → not configured, and no request | `1143859`, `de58c40` |
| 2. No test of the real `useHasNews` | `lib/use-has-news.test.ts`, 3 `renderHook` cases: false then true, stays false, answer after unmount ignored | `a8eb395` |
| 3. Setup comment | `src/test/setup.ts`: "Stub globals in beforeEach, not beforeAll or at module scope" | `54b3058` |

- **Build break found and fixed.** In `1143859` the rule lived in `public-posts.client.ts`.
  React Router empties `.client` modules in the server build, so the sitemap's build-time loader
  got `undefined` and the prerender failed with a 500. `de58c40` moves the rule into the
  non-`.client` file above.
- **Gotcha for later work:** server or build-time code (loaders, the sitemap, robots) must never
  import from a `*.client.ts` file.
- **Not bisect-safe:** don't check out `1143859` on its own, because the build fails there.

**Checks after the fixes** (local exports):

| Check | Result |
|---|---|
| Full check | Green |
| `test` | 42 files, 309 tests |
| `db:test` | 12 files, 349 tests, PASS |
| Production build | Lists `/posts` in the sitemap; no hosted ref in the built JS |
| Build with the URL set and the key empty | Succeeds, 0 `/posts` in the sitemap |
| AC-1.12 bundle check | `done` over 13 pages |
