# Test Summary Report — item 1 (News page, `/posts`)
- Date: 2026-10-25 · Branch: `feature/pending-requirements` @ `ea18539` (descends from `0e03c5c`: `git merge-base --is-ancestor` exits 0) · Environment: local only. P = production build on the `serve` Vercel mirror `http://localhost:4173`, R = Railway mirror `:4174`, D = dev server `http://localhost:5173`, local Supabase API `127.0.0.1:55321`, DB `:55322`, Mailpit `:55324`. Seed data: `supabase/seed.sql` accounts, plus 1 post "Term 4 classes start on Monday". Fixtures F1–F4 were applied and restored as the plan orders them. Every build ran after `export VITE_SUPABASE_URL=http://127.0.0.1:55321` and the local publishable key.
- Full check: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build && pnpm db:test && pnpm test:functions` → **PASS**, exit 0. format clean · lint 0 problems · typecheck clean · `pnpm test` **44 files, 326 tests passed** · production build OK · `db:test` **12 files, 349 tests, PASS** · `test:functions` **79 ok, 0 failed** (account-admin 49, leads 30).
- Test plan: `06-test-plan-item-1.md` (frozen, 62 cases). Run in its phase order (1 → 5) and fixture order. Six cases were added (N-67 to N-72); none were removed or weakened.

**Environment fixture added (read this before the console columns).** On P, every public page logs 2 console errors: Chromium can't load `/_vercel/insights/script.js`. That is the Vercel Web Analytics script (`@vercel/analytics`, `root.tsx`), and only real Vercel serves it, so the `serve` mirror returns its 404 page. It isn't item-1 code, and it isn't an app error the mirror is meant to test. For every console count on P, Playwright answered that one path with an empty `200` script, the way Vercel would. With the stub off, every P page shows exactly those 2 errors and nothing else (measured in N-06 and N-17). Whether Web Analytics is turned on for the hosted project is listed under Not covered.

## Round 1

### Phase 1 — repo checks and safety guards

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| N-01 | Safety | Build and E2E env point at the local stack | URL `http://127.0.0.1:55321`; key = `db:status`; E2E `.env` local; 0 `supabase.co`; no shell overrides | URL exact; key equal; `SUPABASE_REST_URL=http://127.0.0.1:55321`, `PG_HOST=127.0.0.1`, `PG_PORT=55322`, `WEB_BASE_URL=http://localhost:5173`, `MAILPIT_URL=http://127.0.0.1:55324`; `supabase.co` count 0; `env` grep empty | PASS |
| N-02 | Safety | No hosted ref in built JS | 0; ≥ 1 | 0 files with `unzjnxctkyahtmrkinyr`; 1 file with `127.0.0.1:55321`. (`*.supabase.co` appears only as a supabase-js library string in `dist-*.js`) | PASS |
| N-03 | Full check | Repo full check | All exit 0; lint 0; ≥ 44 files / ≥ 326 tests; `db:test` 0 failed; `posts/index.html` exists | All exit 0; lint 0 problems; 44 files / 326 tests; `db:test` 12 files / 349, PASS; `build/client/posts/index.html` present | PASS |
| N-04 | Bundle | No supabase-js / MUI preloads | Output only `done`; `$SB`, `$MUI` non-empty | `SB=dist-DvjAMUvs.js`, `MUI=portal-CaR7k8Iz.js`; output `done` over 13 pages (home, privacy, resources, 9 programmes, posts) | PASS |
| N-05 | Hosting guard | `vercel.json` / `serve.railway.json` untouched | Empty diff | Empty | PASS |

### Phase 2 — production build, Vercel mirror, 1 post

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| N-06 | Routing | `/posts` 200, list, hard refresh | 200; 1 `li`/`h2` before and after reload | curl 200; 1 `li`, `h2` "Term 4 classes start on Monday" before and after a no-cache reload; reload 200 | PASS |
| N-07 | Routing | Trailing slash and query | `/posts/` 301 → `/posts`; `?utm` 200 | `301 http://localhost:4173/posts`; `200` | PASS |
| N-08 | Routing | Railway mirror | 200; `X-Robots-Tag` present | 200; `X-Robots-Tag: noindex, nofollow` | PASS |
| N-09 | Crawlable shell | No-JS HTML | title 1; description = constant; canonical 1; `<h1` 1; loading line; no `/posts` link in header/footer | title 1; description "Updates and announcements from AJ Classes." (= `POSTS_PUBLIC_PAGE.seo.description`); canonical 1; `<h1` 1; loading line 1; header 0 / footer 0 `href="/posts"` | PASS |
| N-10 | Indexing | Production headers and meta | No X-Robots-Tag, CSP or no-store; robots meta 0 | None of the three headers; robots meta 0 | PASS |
| N-11 | Invalid input | Unknown `/posts` paths | 404 + "Page not found" on both mirrors; `/POSTS` recorded | `/posts/anything`, `/postsx`, `/posts/1/2` → 404, `<h1>Page not found</h1>` on :4173 and :4174. `/POSTS` → 200 on both (case-insensitive disk), canonical `https://ajclasses.com.au/posts` | PASS |
| N-12 | Header | News link at 1280 | 6 items; last "News" `/posts`, no `aria-current`; Sign in and CTA not in `ul` | 6: Programmes, Our Approach, About, FAQ, Contact, News; `href="/posts"`; `aria-current` null; Sign in and Register Interest not in `ul` | PASS |
| N-13 | Header | One row at 1024 / 1279 / 1280 | One `top`; 72 px; gap ≥ 8; icon ≥ 16; overflow 0 | 1024: top 14, 72 px, gap 11.64, icon 20, overflow 0 · 1279: gap 107.64 · 1280: gap 75.64. All one row, 72 px, icon 20, overflow 0 | PASS |
| N-14 | Header | Phone menu 375 and 1023 | News last; tap loads `/posts` 200 and closes menu; overflow 0 | Both widths: menu open, News last and visible; tap → `/posts` 200, `aria-expanded=false`, overflow 0 | PASS |
| N-15 | Header | `aria-current` only on `/posts` | `/posts`: exactly 1 (News); others: none to `/posts` | `/posts`: 1 (News). `/`, `/privacy`: 0. `/programmes/vce`: 1, the VCE sub-link, 0 to `/posts` | PASS |
| N-16 | Footer | Footer link with posts | 1 per page, "News", first in the legal row | `/`, `/resources`, `/privacy`, `/posts`: 1 each, "News", row order `/posts, /resources, /privacy, /portal/login` | PASS |
| N-17 | CLS | Fast and slow DB | Every CLS < 0.1 | `/` 1024×600 fast **0.0041**, slow **0.0041**; `/` 1280×720 fast **0.0024**; `/posts` slow: 375×812 **0.0000**, 1024×600 **0.0041**, 1280×720 **0.0024** | PASS |
| N-18 | Network | One check per page; no hosted calls; no heavy chunks | 1 `select=id&limit=1` per page, `/posts` +1; 0 `supabase.co`; 0 `$SB`/`$MUI` | `/`, `/programmes/vce`, `/resources`, `/privacy`: 1 check each. `/posts`: 1 check + 1 list. 0 hosted, 0 heavy chunks, 0 console errors | PASS |
| N-19 | XSS | Script payload shows as text | Both strings as text; 0 dialogs; 0 `main script, main img`; count back to 1 | Title and body shown as text; 0 dialogs; 0 elements; count 2 → 1 after delete. Screenshot `posts-xss-as-text-1280.png` | PASS |
| N-20 | UI evidence | Blank space with 1 post | Screenshots saved; gap recorded; **Saurabh judges** | Saved `posts-1-post-1280x720.png`, `posts-1-post-375x812.png`. Gap from last post to footer: **264 px** (1280×720), **285 px** (375×812). Tester's part done; looks are Saurabh's call | PASS |
| N-57 | Page sweep | Every sitemap URL at 375 and 1280 | All 200; 0 console errors; overflow 0; 1 `h1`; robots 0 | **14 URLs** (home, 9 programmes, resources, 1 guide, privacy, posts) × 2 widths = 28 loads, all 200, 0 errors, overflow 0, 1 `h1`, robots meta 0 | PASS |
| N-58 | Robots/sitemap | Production robots and sitemap | Production rules, `Disallow: /portal`, Sitemap line; `xmllint` exit 0 | `User-agent: * / Allow: / / Disallow: /portal / Sitemap: https://ajclasses.com.au/sitemap.xml` (= `ROBOTS.rules`); `xmllint` exit 0 | PASS |
| N-59 | 404, `/subscribed` | One robots meta (BUG-1) | Each 1; 404 is 404; 0 duplicate-key errors | `/does-not-exist`: 1 robots meta, status 404, only console line is the document's own 404 · `/subscribed`: 1, 200, 0 errors. 0 duplicate-key errors | PASS |
| N-60 | Portal headers | CSP, noindex, no-store | Both 200 with CSP byte-equal to `vercel.json`, `X-Robots-Tag`, `no-store` | `/portal/login`, `/portal/admin/posts`: 200, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`, CSP `cmp` byte-equal (388 bytes) | PASS |
| N-62 | Keyboard | News reachable by Tab | Focus reaches News after the 5th link; ring is **human** | Tab order: Programmes, its 9 sub-links, Our Approach, About, FAQ, Contact, **News**. Focus style on News: `outline: solid 3px rgb(37, 99, 235)`. Screenshot `news-link-focus-1280.png` for Saurabh | PASS |
| N-63 | Colour scheme | Public site under dark preference | Same colour as light | News and first link `rgb(23, 37, 84)`, body `rgb(255, 255, 255)` in both light and dark, on `/` and `/posts` (`posts-light-1280.png`, `posts-dark-1280.png`) | PASS |
| N-64 | Network | Public columns only | Query exactly `select=id,created_at,title,body&order=created_at.desc&limit=200`; 200; renders | Exact match; 200; response keys `id, created_at, title, body`; list rendered | PASS |
| N-65 | Privacy | Security's wording | First 1; second 0 | 1; 0 | PASS |

### Phase 3 — portal on the dev server

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| N-40 | Permissions | Anonymous at admin compose | Ends on `/portal/login`; no Publish; no post data | `/portal/login`; 0 Publish; 0 `#post-title`; post title not in DOM | PASS |
| N-41 | Permissions | Anonymous REST writes | POST 401/403; PATCH/DELETE change nothing; count unchanged | POST, PATCH and DELETE all **401** `42501 permission denied`; count, title and `updated_at` unchanged (1) | PASS |
| N-42 | Permissions | Tutor at admin compose | "You don't have access to this page"; 0 Publish; 0 `#post-title` | Text present; 0; 0; 0 console errors | PASS |
| N-43 | Permissions | Student and parent | Same as N-42 | Both: text present, 0 Publish, 0 `#post-title`, no post data | PASS |
| N-44 | Permissions | Admin without two-step | Two-step set-up shown; no working compose form | Lands on `/portal/account/two-step/setup` ("Set up two-step sign-in"); `/portal/admin/posts` stays on set-up, 0 `#post-title`. RLS side: `db:test` green | PASS |
| N-45 | Invalid input | Empty title and body | Inline messages, `aria-invalid`, `aria-describedby`; filled field `false` and no describedby; no page alert; count unchanged | (a) both fields `true` → `post-title-error` / `post-body-error` with the exact `titleLength` / `bodyLength` text. (b) title `false`, no describedby; body message. (c) the reverse. No "Some details aren't valid…" alert; count 1 → 1 | PASS |
| N-46 | Invalid input | Over-long, typed and pasted | 120 / 5000; counter `5000 / 5000 characters`; saved as 120 / 5000; deleted | 121 typed → 120; 5,100 pasted from the clipboard → 5000; counter "5000 / 5000 characters"; saved row `120\|5000`; no inline message; deleted, count 1 | PASS |
| N-47 | Invalid input | DB backstop | Both fail `check constraint` 23514; count unchanged | `posts_title_check` and `posts_body_check`, SQLSTATE 23514; count 1 | PASS |
| N-48 | Invalid input | Boundary lengths | Both saved and shown on P; deleted | Rows `1/1` and `120/5000`; both in the P `/posts` list after reload; deleted, count 1 | PASS |
| N-49 | Invalid input | Spaces only refused; outer spaces trimmed | (a) title message, `true`, none inserted; (b) body message, none inserted; (c) `[e2e-trim x]`, `[y]` | (a) yes, count 1; (b) yes, count 1; (c) stored `[e2e-trim x], [y]`; deleted | PASS |
| N-50 | Duplicate action | Double-click Publish | Exactly 1 row; "Publishing…" and disabled while busy | 1 row, 1 POST request; button states `Publish\|disabled=false` → `Publishing…\|disabled=true`; deleted | PASS |
| N-66 | Invalid input | Edit to a spaces-only title | Inline `titleLength`, `true`; 0 PATCH; same title and `updated_at`; Cancel restores | Message under `post-title-<id>`, `aria-invalid="true"`; 0 PATCH; row identical; Cancel → heading back, edit field gone | PASS |
| N-51 | E2E | Full E2E suite | All specs pass | **7 passed, 1 failed**: `admin-posts.spec.ts` "newest-first" (received index −1). Failed again on the one re-run. Timing race in the spec, measured 5/5: `li h2` is `[]` while the list loads. E2E-repo fix → **BUG-2** | FAIL |
| N-61 | Lead form | Register Interest still posts | Spec passes; manual submit shows success, 1 row, removed | `register-interest.spec.ts` passed in N-51. Manual on D (Web3Forms mocked, local Zoho mock): "Thank you! We've received your details…", 1 `e2e-manual-…` row, removed, 0 left | PASS |
| N-52 | Admin posts | Create, edit, delete → `/posts` | `T-new` first; `T-edited` replaces it (+1 only); gone; count 1 | `[T-new, Term 4…]` → `[T-edited, Term 4…]` (count 2) → `[Term 4…]`; count 1 | PASS |
| N-53 | E2E hygiene | No leftovers | All 0 | posts `e2e-%` 0; enquiries 0; profiles 0 (also `auth.users` 0) | PASS |
| N-54 | Sign-in | Every seeded role + reload | Right landing page; still signed in after reload; 0 console errors | Recorded run: admin → `/portal/admin`, newadmin → `/portal/account/two-step/setup`, tutor → `/portal/tutor`, student → `/portal/student`, parent → `/portal/parent`, all the same after reload, 0 errors. But in **4 of 10** repeat `admin@` sign-ins (plus 2 other sessions in this run), the console logs a **500** from `POST /auth/v1/factors/…/challenge` (GoTrue "deadlock detected"). Dev-only auto-entry double call → **BUG-3** | FAIL |
| N-55 | Sign-in | Inactive account refused | "Email or password is incorrect."; stays on `/portal/login`; no session | Message shown; URL `/portal/login`; 0 auth-token keys in `localStorage` | PASS |
| N-56 | Portal theme | Compose page dark | Message and fields render; **human visual** | Dark (body `rgb(11, 18, 32)`); message "Please enter a title (1–120 characters)." in `rgb(248, 113, 113)`, field text `rgb(226, 232, 240)`. Screenshot `admin-posts-dark.png` for Saurabh. Theme switched back to light afterwards | PASS |

### Phase 4 — fixtures (0 posts, 201 posts, DB down)

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| N-30 | Empty state | F1 + F2; links on every public page | Count 0; 0 header/footer News; 5 `li` | Backup taken (`posts-backup.sql`); count 0; all 14 sitemap URLs incl. `/posts` at 1280: 0 / 0 links, 5 `li`, 0 console errors | PASS |
| N-31 | Empty state | `/posts` with 0 posts | 200; header and footer; empty line; 2 working links; 1 `h1`; no error text; 0 console errors | curl 200; at 1280 and 375: header and footer, "There are no news posts at the moment.", "Back to the home page" → `/` (lands on `/`), "Register interest" → `/#contact` (lands with `#contact` at top 72 px, under the sticky header); 1 `h1`; error line absent; 0 errors | PASS |
| N-32 | Empty state | No "coming soon" | Both 0 | Build grep 0 (globs quoted for zsh; same command); `/posts` `innerText` 0 | PASS |
| N-33 | UI evidence | Blank space with 0 posts | Screenshots; gap recorded; **Saurabh judges** | Saved `posts-0-posts-1280x720.png`, `posts-0-posts-375x812.png`. Gap from links to footer: **352 px** (1280×720; 05 said ≈ 350), **457 px** (375×812) | PASS |
| N-34 | Live update | Publish first post, no rebuild | Links back (1 each); listed; 6 `li` | Published on D; P `/` and `/posts`: header 1, footer 1, 6 `li`, list `[Term 4 classes start on Monday]` | PASS |
| N-35 | Live update | Delete last post, then republish | After delete 0 links, 5 `li`; after republish links back; count 1 | Delete → `/`, `/posts`: 0 / 0, 5 `li`. Republish → 1 / 1, 6 `li`. Count 1 | PASS |
| N-36 | Edge | More posts than the cap (F3) | Exactly 200 `li h2`; newest first; CLS < 0.1; 0 errors | 202 rows in DB → **200** shown; order: Term 4 (re-published just before), `cap-1`, `cap-2`, … `cap-199`; `cap-201` absent; CLS 0.0024; 0 errors | PASS |
| N-37 | Clean-up | Remove F3 | Count 1 | `DELETE 201`; count 1 | PASS |
| N-21 | Error state | DB down: links hidden | 0 News links; 5 `li`; renders; only the refused request logged | `pnpm db:stop` (API 000). `/`, `/programmes/vce`, `/privacy`: 200, 0 / 0 links, 5 `li`, 1 `h1`; only console line `net::ERR_CONNECTION_REFUSED` (non-bug 2) | PASS |
| N-22 | Error state | DB down: `/posts` error line | 200; error line; no empty line; links; 1 `h1`; no raw error | curl 200; 1280 and 375, with hard reload: "We couldn't load the news just now. Please try again later.", empty line absent, both links, 1 `h1`, no `TypeError` / `fetch` / stack; only refused-request console lines. `posts-db-down-1280.png` (+ `-375`) | PASS |
| N-23 | Recovery | DB back | Key unchanged; count 1, original title; links back | `pnpm db:start` exit 0; key `sb_publishable_ACJW…` unchanged; `1\|Term 4 classes start on Monday`; `/` and `/posts` 1 / 1, 6 `li` | PASS |

### Phase 5 — other builds

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| N-24 | Indexing | Staging build `noindex` | Each 1 (exactly one robots meta) | `posts/index.html`, `index.html`, `privacy/index.html`: 1 each, 1 robots tag in total each | PASS |
| N-25 | No Supabase | Build without Supabase | Exit 0; sitemap `/posts` 0; 0 links; 0 `/rest/v1/`; `/posts` 200 with error line | Exit 0; bundle has no hosted or local URL; sitemap 0; `/` and `/posts`: 0 links, 5 `li`, 0 REST requests; `/posts` 200, error line, not empty or loading; 0 errors | PASS |
| N-26 | No Supabase | URL set, key empty | Sitemap 0; 0 links; 0 `/rest/v1/` | Exit 0; sitemap 0; 0 links; 0 REST requests; `/posts` shows the error line. (`sb_publishable_` in the bundle is only supabase-js's prefix check, not a key) | PASS |
| N-27 | Sitemap | Configured build lists `/posts` | 1 | 1. P restarted on the production build: `/` and `/posts` links back | PASS |

### Added cases (not in the frozen plan)

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| N-67 | Error state | REST returns HTTP 500 | No links; `/posts` error line, no raw text | 0 / 0 links, 5 `li`; error line; no raw error; only the 500 resource lines | PASS |
| N-68 | Error state | DB reply slower than the 5 s timeout | Loading line, then the error line after about 5 s; no links | Loading shown at start; error line **5.35 s** after load; 0 links; 0 console errors | PASS |
| N-69 | Error state | Malformed JSON (`200`, `{not json`) | No links; error line; no `SyntaxError` text | 0 links; error line; no raw text; 0 console errors | PASS |
| N-70 | Layout | Post title of 120 characters with no spaces | No sideways scroll at 375 or 1280 | Overflow **2178 px** at 375, **1369 px** at 1280; cards up to 2553 px wide → **BUG-4** | FAIL |
| N-71 | Layout | Line breaks in the body are kept | Multi-line body shows its lines | `white-space: pre-wrap`; 4 lines shown, as entered | PASS |
| N-72 | Layout | Normal title, body with one long URL, at 375 | Overflow 0 | Overflow **217 px** at 375 (0 at 1280); every card past the right edge → **BUG-4** (same cause as N-70) | FAIL |

Pass rate: **64/68 = 94.1%** overall (frozen plan: **60/62 = 96.8%**; added cases 4/6) · Defects open: **BUG-2** (E2E repo, Medium), **BUG-3** (dev-only, older code, Low), **BUG-4** (`/posts` sideways scroll, Medium)

Failed: N-51 (BUG-2), N-54 (BUG-3), N-70 and N-72 (BUG-4). Blocked: none.

## Round 2

- Date: 2026-10-25 · Branch: `feature/pending-requirements` @ `4ef23a4` (fixes `9ae81a2` BUG-4 and `f64518c` BUG-3; still descends from `0e03c5c`) · E2E repo: `feature/playwright-e2e-harness` @ `f5b7024` (`e7020d8` BUG-2, `f5b7024` new BUG-4 spec) · Environment and seed: same as round 1 (local only, P :4173, R :4174, D :5173, 1 post "Term 4 classes start on Monday", id `88427aca…`). Fixtures F1–F4 in the plan's order; the F1 backup was retaken for this round (`posts-backup-r2.sql`).
- Full check: same command → **PASS**, exit 0. format clean · lint 0 problems · typecheck clean · `pnpm test` **45 files, 327 tests passed** (+1 file / +1 test: `TwoStepCodeForm.test.tsx`) · production build OK · `db:test` **12 files, 349 tests, PASS** · `test:functions` **79 ok, 0 failed** (both scripts "All checks passed").
- Scope: **every** case again. All 62 frozen cases, the 6 round-1 additions (N-67 to N-72), and 3 new regression cases, one per fixed bug (N-73 to N-75). None were removed or weakened. N-01 ran first.
- **Vercel Analytics stand-in:** kept as in round 1. Playwright answers `/_vercel/insights/*` with an empty `200` script on P. **The team lead has accepted this stand-in** for the console-error counts.
- Chunk names after the rebuild: `SB=dist-DvjAMUvs.js` (unchanged), `MUI=portal-BBidKo_s.js` (new hash, because `admin-posts.tsx` changed). N-04 and N-18 used the new names.

| ID | Area | Case | Expected | Actual | Result |
|----|------|------|----------|--------|--------|
| N-01 | Safety | Local stack only | As round 1 | URL exact, key = `db:status`, E2E `.env` all local, `supabase.co` 0, no shell overrides | PASS |
| N-02 | Safety | No hosted ref in JS | 0; ≥ 1 | 0; 1 | PASS |
| N-03 | Full check | Repo full check | All exit 0; ≥ 44 / ≥ 326 | All exit 0; lint 0; 45 / 327; `db:test` 349 PASS; `posts/index.html` present | PASS |
| N-04 | Bundle | No supabase-js / MUI preloads | `done` only | `done` (13 pages); `$SB`, `$MUI` non-empty | PASS |
| N-05 | Hosting guard | Configs untouched | Empty | Empty | PASS |
| N-06 | Routing | `/posts` 200 + hard refresh | 200; 1 `li h2` before and after | 200 / 200; `[Term 4…]` before and after; 0 console errors | PASS |
| N-07 | Routing | Slash and query | 301 → `/posts`; 200 | 301 → `http://localhost:4173/posts`; 200 | PASS |
| N-08 | Routing | Railway mirror | 200 + `X-Robots-Tag` | 200; `noindex, nofollow` | PASS |
| N-09 | Crawlable shell | No-JS HTML | title, description, canonical, 1 `h1`, loading, no links | All as expected; header 0 / footer 0 `/posts` links | PASS |
| N-10 | Indexing | Production headers | None of the 3; robots 0 | None; 0 | PASS |
| N-11 | Invalid input | Unknown paths | 404 + "Page not found" (both mirrors) | Same as round 1; `/POSTS` 200 with `/posts` canonical | PASS |
| N-12 | Header | News link 1280 | 6, last News, no `aria-current` | Same as round 1 | PASS |
| N-13 | Header | One row 1024 / 1279 / 1280 | one `top`, 72, gap ≥ 8, icon ≥ 16, overflow 0 | gaps 11.64 / 107.64 / 75.64; top 14; 72 px; icon 20; overflow 0 | PASS |
| N-14 | Header | Phone menu 375 / 1023 | News last; tap → `/posts`, menu closed | Both: News last; 200; `aria-expanded=false`; overflow 0 | PASS |
| N-15 | Header | `aria-current` | 1 on `/posts`, none elsewhere | `/posts` 1 (News); others 0 to `/posts` | PASS |
| N-16 | Footer | Footer link | 1, "News", first in row | All 4 pages: 1, first before `/resources` | PASS |
| N-17 | CLS | Fast and slow DB | All < 0.1 | 0.0041 / 0.0041 / 0.0024 / 0.0000 / 0.0041 / 0.0024 | PASS |
| N-18 | Network | One check per page | 1 per page, `/posts` +1; 0 hosted; 0 heavy | Exactly that; 0 hosted; 0 heavy; 0 errors | PASS |
| N-19 | XSS | Payload as text | text; 0 dialogs; 0 elements | Yes; 0; 0; count 2 → 1 | PASS |
| N-20 | UI evidence | Blank space, 1 post | Screenshots, gap; Saurabh judges | Re-saved; 264 px (1280×720), 285 px (375×812) | PASS |
| N-57 | Page sweep | 14 URLs × 2 widths | 200, 0 errors, overflow 0, 1 `h1`, robots 0 | 28 / 28 clean | PASS |
| N-58 | Robots/sitemap | Production rules | rules + `Disallow: /portal` + Sitemap; `xmllint` 0 | Yes; 0 | PASS |
| N-59 | 404, `/subscribed` | One robots meta | 1 each; 404; 0 duplicate-key | 1 / 1; 404; 0 duplicate-key | PASS |
| N-60 | Portal headers | CSP, noindex, no-store | Byte-equal CSP + both headers | Both URLs 200, CSP byte-equal (388), both headers | PASS |
| N-62 | Keyboard | News by Tab | After the 5th top link | After Contact; outline `solid 3px rgb(37, 99, 235)` (ring: human) | PASS |
| N-63 | Colour scheme | Dark preference | Same as light | Identical colours | PASS |
| N-64 | Network | Public columns only | Exact query; 200 | Exact; 200; keys `id, created_at, title, body` | PASS |
| N-65 | Privacy | Security wording | 1; 0 | 1; 0 | PASS |
| N-40 | Permissions | Anonymous compose | → login; nothing shown | `/portal/login`; 0 Publish, 0 field, no post data | PASS |
| N-41 | Permissions | Anonymous REST writes | 401/403; nothing changes | POST, PATCH, DELETE 401; row unchanged | PASS |
| N-42 | Permissions | Tutor | No access | Text shown; 0 Publish; 0 field | PASS |
| N-43 | Permissions | Student, parent | No access | Both: text shown; 0; 0 | PASS |
| N-44 | Permissions | Admin without two-step | Set-up screen | `/portal/account/two-step/setup`; no compose form | PASS |
| N-45 | Invalid input | Empty fields | Inline messages, aria, no alert, count same | Same as round 1; count 1 → 1 | PASS |
| N-46 | Invalid input | Over-long, typed and pasted | 120 / 5000, counter, row 120/5000 | 120; 5000; "5000 / 5000 characters"; `120\|5000`; deleted | PASS |
| N-47 | Invalid input | DB backstop | 23514 ×2 | `posts_title_check`, `posts_body_check`, 23514; count 1 | PASS |
| N-48 | Invalid input | Boundary lengths | Saved and shown | `1/1`, `120/5000`; both on P; deleted | PASS |
| N-49 | Invalid input | Spaces, trim | (a)(b) refused; (c) trimmed | Same as round 1; `[e2e-trim x], [y]`; deleted | PASS |
| N-50 | Duplicate action | Double-click | 1 row; busy state | 1 row, 1 POST; `Publishing…\|disabled=true` | PASS |
| N-66 | Invalid input | Edit to spaces | Inline, 0 PATCH, row same, Cancel | Same as round 1 | PASS |
| N-51 | E2E | Full suite | All pass | **9 passed, 0 failed** (8 from round 1 + new "long unbroken titles and URLs wrap") | PASS |
| N-61 | Lead form | Register Interest | Spec passes; manual success, row removed | Spec passed; manual success message, 1 row, removed, 0 left | PASS |
| N-52 | Admin posts | Create, edit, delete | As round 1 | `T-new` → `T-edited` (count 2) → gone; count 1 | PASS |
| N-53 | E2E hygiene | No leftovers | All 0 | posts 0, enquiries 0, profiles 0, `auth.users` 0 | PASS |
| N-54 | Sign-in | Every role + reload, 0 console errors | As round 1 | All 5 roles land right and survive reload; **0 console errors, 0 failed responses** for every role. Backed by N-74 (30 `admin@` sign-ins, 0 errors) | PASS |
| N-55 | Sign-in | Inactive refused | Message; stays; no session | Yes; `/portal/login`; 0 session keys | PASS |
| N-56 | Portal theme | Dark compose | Renders (human visual) | Dark bg `rgb(11, 18, 32)`; message `rgb(248, 113, 113)`; screenshot re-saved; switched back to light | PASS |
| N-30 | Empty state | 0 posts, every page | 0 / 0 links, 5 `li` | 14 / 14 pages: 0 / 0, 5 `li`, 0 errors | PASS |
| N-31 | Empty state | `/posts` 0 posts | 200, empty line, links work, 0 errors | Yes at 1280 and 375; `/` and `/#contact` both land | PASS |
| N-32 | Empty state | No "coming soon" | 0; 0 | 0; 0 | PASS |
| N-33 | UI evidence | Blank space, 0 posts | Screenshots, gap | Re-saved; 352 px (1280×720), 457 px (375×812) | PASS |
| N-34 | Live update | First post, no rebuild | Links back; listed; 6 `li` | 1 / 1; listed; 6 | PASS |
| N-35 | Live update | Delete last, republish | 0 → back; count 1 | 0 / 0, 5 `li` → 1 / 1; count 1 | PASS |
| N-36 | Edge | 201 posts (F3) | 200 shown, newest first, CLS < 0.1 | 200; Term 4 (newest), `cap-1`, `cap-2`, …; `cap-201` absent; CLS 0.0024; 0 errors | PASS |
| N-37 | Clean-up | Remove F3 | Count 1 | `DELETE 201`; 1 | PASS |
| N-21 | Error state | DB down, links hidden | 0 links, 5 `li`, only refused request | 3 pages: 0 / 0, 5 `li`; only `ERR_CONNECTION_REFUSED` | PASS |
| N-22 | Error state | DB down, `/posts` | 200, error line, links, no raw text | 200; error line at 1280 and 375; 4 console lines, all `ERR_CONNECTION_REFUSED` (0 others) | PASS |
| N-23 | Recovery | DB back | Key same; count 1; links back | Key unchanged; `1\|Term 4…`; 1 / 1, 6 `li` | PASS |
| N-24 | Indexing | Staging `noindex` | 1 each | 1 / 1 / 1, one robots tag each | PASS |
| N-25 | No Supabase | No-config build | Sitemap 0; 0 links; 0 REST; error line | Exit 0; no hosted or local URL; 0; 0; 0; error line; 0 errors | PASS |
| N-26 | No Supabase | URL set, key empty | Sitemap 0; 0 links; 0 REST | Exit 0; 0; 0; 0; error line | PASS |
| N-27 | Sitemap | Configured build | 1 | 1; P back on the production build, links back | PASS |
| N-67 | Error state | REST 500 | No links; error line | Same as round 1 | PASS |
| N-68 | Error state | Reply slower than 5 s | Error line after about 5 s | 5.34 s; 0 links; 0 errors | PASS |
| N-69 | Error state | Malformed JSON | No links; error line; no raw text | Same as round 1 | PASS |
| N-70 | Layout | 120-character no-space title | Overflow 0 at 375 and 1280 | **0 / 0**; card right edge 359 (vw 375), 1168 (vw 1280). Was 2178 / 1369 | PASS |
| N-71 | Layout | Line breaks kept | 4 lines | `pre-wrap`; 4 lines; overflow 0 | PASS |
| N-72 | Layout | Long URL in the body at 375 | Overflow 0 | **0** at 375 and 1280; card edge 359. Was 217 | PASS |
| N-73 | Regression BUG-4 | Long title **and** long-URL post on `/posts` (P) **and** `/portal/admin/posts` (D), 375 and 1280 | Overflow 0 on both pages at both widths; cards inside the viewport | `/posts`: 0 / 0, both posts found, max card edge 359 / 1168. Admin list: 0 / 0, both found, max edge 359 / 1168, 0 console errors. Screenshots `r2-N-73-posts-{375,1280}.png`, `r2-N-73-admin-posts-{375,1280}.png` | PASS |
| N-74 | Regression BUG-3 | 10 repeated `admin@` sign-ins on D | 10 / 10 land on `/portal/admin`; 0 challenge 500s; 0 console errors | 3 batches of 10 (30 sign-ins): all `/portal/admin`, **0** challenge 500s, **0** console errors. Last batch counted `POST /auth/v1/factors/<id>/challenge`: **1** per sign-in (was 2, racing) | PASS |
| N-75 | Regression BUG-2 | E2E suite at 9/9, plus the fixed spec repeated | 9 / 9; newest-first stable | Full suite **9 passed**; `-g "newest-first" --repeat-each=5` → **5 passed** | PASS |

Pass rate: **71/71 = 100%** (frozen plan 62/62; round-1 additions 6/6; new regression cases 3/3) · Defects open: none (BUG-2, BUG-3, BUG-4 fixed and verified)

Failed: none. Blocked: none.

Observation, not raised: on the **dev** portal at 375 px, the red "DEV" environment marker covers the start of "Local Admin" in the portal header (see `r2-N-73-admin-posts-375.png`). The marker exists only on dev and staging, it isn't item-1 code, and it doesn't appear in production. Left for a human to judge.

## Verdict
APPROVED (auto) — round 2: 71/71 = 100%, full check green, BUG-2/3/4 fixed and verified.

## Not covered
1. **Human visual judgement:** D3 blank space (N-20: 264 / 285 px; N-33: 352 / 457 px), the News focus ring (N-62), and the dark portal compose page (N-56). The screenshots are in `docs/test-reports/2026-10-25-feature-pending-requirements/evidence/`. Saurabh decides.
2. **Hosted and Vercel-only behaviour** (plan §5 items 1–5): hosted `/posts` 200 and hard refresh, the hosted migration and a hosted post, real Vercel `cleanUrls` / header matching / `404.html` / edge caching, staging (Vercel SSO), hosted CORS, and the "Supabase, Sydney" region. Also **whether Vercel Web Analytics is enabled on the hosted project**. If it isn't, `/_vercel/insights/script.js` would 404 on live too and log 2 console errors per public page. That is older behaviour, not item 1. A quick check after release: `curl -sI https://ajclasses.com.au/_vercel/insights/script.js`.
3. **Browsers:** Chromium (Playwright) only. Safari, Firefox, real phones and older-browser `svh` fallback were not tested.
4. **Google indexing** of `/posts` (Search Console): needs the live site.
5. **The DB accepts a spaces-only post** sent straight to the API by a two-step admin: a known limit, the migration is deferred (05 §7). Not raised.
6. The original post row was put back from the F1 backup at the end of each round (same id `88427aca…` and `created_at`), so the local DB ends as it started.
7. Round 2 adds nothing new to this list. BUG-3's fix only affects dev StrictMode, and production never auto-enters the code, so the hosted admin sign-in is still Saurabh's real-authenticator check (R2-18).
