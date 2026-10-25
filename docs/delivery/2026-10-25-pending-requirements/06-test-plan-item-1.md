# 06 — Test plan: item 1 (News page)

> **Stage:** 6a of /deliver (Tester) · **Date:** 25 Oct 2026 · **Branch:** `feature/pending-requirements`
> **Input:** [01-requirement.md](01-requirement.md) item 1 (AC-1.1 to AC-1.15),
> [03-design.md](03-design.md) §1 (incl. §1.6), [04-plan.md](04-plan.md) §3 and §8,
> [05-dev-notes-item-1.md](05-dev-notes-item-1.md), [review-5-item-1.md](review-5-item-1.md),
> `~/second-brain/Projects/AJClasses/_agents/tester.md`.
> **Next:** `/test-and-ship docs/delivery/2026-10-25-pending-requirements/06-test-plan-item-1.md`
> freezes this list and runs it. IDs are stable: add new cases at the end, never renumber.

**Build under test:** the `feature/pending-requirements` HEAD at freeze time, which must include
the 3 review-5 fixes (`1143859`, `a8eb395`, `54b3058` at the time of writing). Record the SHA in
the TSR.

**Hard rule: local stack only.** Every build runs after the two `export` lines in §1. The hosted
Supabase project is never read or written. N-01 and N-02 enforce this before anything else runs.

---

## 1. Set-up (once per terminal, before any build)

```bash
cd ~/dev/work/aj_classes
pnpm db:start && pnpm db:status            # note the Publishable key
export VITE_SUPABASE_URL=http://127.0.0.1:55321
export VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key from pnpm db:status>
export SCR=<session scratch dir>
export EVD=$PWD/docs/test-reports/2026-10-25-feature-pending-requirements/evidence
mkdir -p "$EVD"
alias q='docker exec supabase_db_aj_classes psql -U postgres -At -c'

# Vercel mirror config (03 §1.6): serve.railway.json minus the global X-Robots-Tag.
jq '(.headers[] | select(.source=="**/*") | .headers) |= map(select(.key!="X-Robots-Tag"))' \
  apps/web/serve.railway.json > "$SCR/serve-like-vercel.json"

# Playwright for the browser measurements: reuse the E2E repo's install.
ln -sfn ~/dev/work/aj_classes-e2e/node_modules "$SCR/node_modules"
```

Servers (names used in the **Environment** column):

| Name | What | Start |
|---|---|---|
| **P** | Production build, Vercel mirror, `http://localhost:4173` | `VITE_APP_ENV=production pnpm build`, then from `apps/web`: `pnpm exec serve --config "$SCR/serve-like-vercel.json" -l 4173 --no-clipboard` (**no** positional folder) |
| **R** | Same build, Railway mirror, `http://localhost:4174` | `PORT=4174 pnpm --filter web start:railway` |
| **S** | Staging build (served on :4173 after a rebuild) | `VITE_APP_ENV=staging pnpm build` |
| **N** | No-Supabase production build (served on :4173 after a rebuild) | `VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_APP_ENV=production pnpm build` |
| **K** | Production build with URL set but key empty (review-5 finding 1) | `VITE_SUPABASE_PUBLISHABLE_KEY= VITE_APP_ENV=production pnpm build` |
| **D** | Dev server `http://localhost:5173` (portal flows, E2E) | `pnpm dev --port 5173 --strictPort`, with `VITE_LEAD_CAPTURE=on` in `apps/web/.env.development.local` |
| **DB** | Local Supabase (`:55321` API, `:55322` DB, `:55324` Mailpit) | `pnpm db:start` |

**Browser measurements** (CLS, console, h1, scroll, element boxes, network) use a throwaway
Playwright script in `$SCR`, Chromium, console cleared before each page. "Console errors" means
`console.error` messages plus `pageerror` events.

**Known non-bugs for this run** (don't raise):
1. `/portal/*` on **P** can't reach the local API: the portal CSP's `connect-src` names only the
   hosted Supabase host. That's correct production behaviour. All portal flows therefore run on
   **D**, which reads the same local database.
2. In the DB-down cases (N-21, N-22) the browser logs `Failed to load resource:
   net::ERR_CONNECTION_REFUSED` for the news request. That's the outage itself, not an app error.
   Any *other* console error still fails the case.
3. Dev/staging `robots.txt` is `Disallow: /` on purpose. Production rules are checked in
   `apps/web/build/client/robots.txt` (N-58).
4. Hot reload logs `[react-router:hmr] No module update found` after source edits. Clear the
   console first.
5. On `/posts` the News link has `aria-current="page"` but no visual current-page style. No
   top-level link has one (05 §5 item 6).

**Seed-data order.** The run starts with exactly 1 local post ("Term 4 classes start on Monday",
05 §5 item 7). Cases that change post counts are grouped in §3 phase 4, applied only right before
the case that needs them, and restored right after:

| Fixture | Applied right before | Restored by |
|---|---|---|
| F1 back-up of `public.posts` | N-30 | — (`$SCR/posts-backup.sql`) |
| F2 delete every post (0 posts) | N-30 | N-34 (publish one) |
| F3 201 posts | N-36 | N-37 |
| F4 `pnpm db:stop` | N-21 | N-23 (`pnpm db:start`) |
| Staging / no-Supabase / key-empty builds overwrite `build/client` | N-24, N-25, N-26 | N-27 (rebuild production) |

---

## 2. Cases

Phases run in this order: **1** repo checks, **2** production build with 1 post, **3** portal on
the dev server, **4** fixtures (0 posts, 201 posts, DB down), **5** other builds. Within a phase,
run in table order (not ID order). The smoke and regression table runs inside phase 2 (after
N-20), except N-61, which runs in phase 3.

### Phase 1 — repo checks and safety guards

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| N-01 | §0.3 | Safety | Build env points at local stack | `echo $VITE_SUPABASE_URL; pnpm db:status \| grep -i publishable` | URL is exactly `http://127.0.0.1:55321`; exported key equals the `db:status` key | DB |
| N-02 | §0.3 | Safety | No hosted ref in built JS | After N-03's build: `grep -l unzjnxctkyahtmrkinyr apps/web/build/client/assets/*.js \| wc -l`; `grep -c 127.0.0.1:55321 -r apps/web/build/client/assets \| grep -v ':0' \| wc -l` | First = **0**; second ≥ 1 | P |
| N-03 | 1.1, 1.15 | Full check | Repo full check | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && VITE_APP_ENV=production pnpm build && pnpm db:test` | Every step exit 0; lint 0 problems; `pnpm test` 0 failed, ≥ 41 files / ≥ 304 tests (record counts); `db:test` 0 failed (`posts.test.sql` included); `apps/web/build/client/posts/index.html` exists | DB |
| N-04 | 1.12 | Bundle | Public pages preload no supabase-js / MUI | From `apps/web`, run the 03 §1.6 bundle script verbatim | Output is exactly `done`; `$SB` and `$MUI` each non-empty (else the grep found nothing and the check is void) | P |
| N-05 | 1.1, 1.2, 1.4 | Hosting guard | `vercel.json` / `serve.railway.json` untouched | `git diff c4e9447..HEAD --stat -- apps/web/vercel.json apps/web/serve.railway.json` | Empty output | — |

### Phase 2 — production build, Vercel mirror, 1 post

Precondition: `q "select count(*) from public.posts"` = 1. Start **P**, **R** and **D** (N-19 publishes through **D**).

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| N-06 | 1.1 | Routing | `/posts` 200, list renders, hard refresh | `curl -s -o /dev/null -w '%{http_code}' localhost:4173/posts`; browser open `/posts`, wait for list; hard reload (Cmd-Shift-R / `page.reload()` with cache disabled) | `200`; list has 1 `li` with an `h2` "Term 4 classes start on Monday" before and after reload; reload status 200 | P |
| N-07 | 1.1 | Routing | Trailing slash and query | `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' localhost:4173/posts/`; same for `/posts?utm_source=x` | `/posts/` → `301` to `/posts`; `?utm…` → `200` | P |
| N-08 | 1.2 | Routing | Railway mirror | `curl -s -o /dev/null -w '%{http_code}' localhost:4174/posts`; `curl -sI localhost:4174/posts \| grep -i x-robots` | `200`; `X-Robots-Tag: noindex, nofollow` present (expected on Railway, 03 §1.6) | R |
| N-09 | 1.3 | Crawlable shell | No-JS HTML | `curl -s localhost:4173/posts > $SCR/posts.html`; `grep -c '<title>Latest News \| AJ Classes</title>'`; `grep -o '<meta name="description"[^>]*>'`; `grep -c '<link rel="canonical" href="https://ajclasses.com.au/posts"'`; `grep -o '<h1' \| wc -l` | title 1; description equals `POSTS_PUBLIC_PAGE.seo.description`; canonical 1; `<h1` **1**; contains `Loading the latest news…`; no `href="/posts"` inside `<header` or `<footer` (links are client-only) | P |
| N-10 | 1.4 | Indexing | Production `/posts` headers and meta | `curl -sI localhost:4173/posts`; `grep -c 'name="robots"' $SCR/posts.html` | No `X-Robots-Tag`, no `Content-Security-Policy`, no `Cache-Control: no-store`; robots meta count **0** | P |
| N-11 | 1.5 | Invalid input | Unknown `/posts` paths | `for p in /posts/anything /postsx /posts/1/2 /POSTS; do curl -s -o $SCR/404.html -w "$p %{http_code}\n" localhost:4173$p; grep -o '<h1[^<]*<[^<]*' $SCR/404.html; done`; repeat on :4174 | `/posts/anything`, `/postsx`, `/posts/1/2` → **404** with the "Page not found" `h1` on both mirrors. `/POSTS`: record result (404 or 200); a 200 is not a fail unless the canonical differs from `/posts` | P, R |
| N-12 | 1.8 | Header | News link, desktop 1280 | Browser 1280×800 on `/`; count `header nav > ul > li`; read the last `li a` | 6 items; last is "News", `href="/posts"`, no `aria-current`; Sign in and Register Interest not in that `ul` | P |
| N-13 | 1.8 | Header | One row at 1024 / 1279 / 1280 | For widths 1024, 1279, 1280 (height 800) on `/`: `top` of each `header nav > ul > li`; header height; gap = first `li` left − logo right; Sign in icon `svg` width; `scrollWidth − clientWidth` | All 6 `li` share one `top`; header 72 px; gap ≥ 8 px (05 measured 12 at 1024); icon width ≥ 16 px; sideways overflow 0 | P |
| N-14 | 1.8 | Header | Phone menu at 375 and 1023 | 375×812 and 1023×800 on `/`: tap the menu button, read the open menu's link list | News is the last item of `header nav > ul`; tapping it loads `/posts` (200) and closes the menu; overflow 0 | P |
| N-15 | 1.8 | Header | `aria-current` only on `/posts` | On `/posts`, `/`, `/privacy`, `/programmes/vce`: `document.querySelectorAll('header [aria-current="page"]')` | On `/posts`: exactly 1, the News link. On the other 3: no element with `aria-current` pointing at `/posts` | P |
| N-16 | 1.9 | Footer | Footer link with posts | On `/`, `/resources`, `/privacy`, `/posts` at 1280: `footer a[href="/posts"]` | Exactly 1 on each, text "News", first link in the legal row (before Resources) | P |
| N-17 | 1.8 | CLS | Layout shift with fast and slow DB | Playwright, `layout-shift` PerformanceObserver (exclude `hadRecentInput`), 5 s after load. Slow = `page.route('**/rest/v1/posts**')` delayed 1500 ms. Runs: `/` 1024×600 fast + slow; `/` 1280×720 fast; `/posts` 375×812, 1024×600, 1280×720 slow | Every CLS **< 0.1** (05 baseline: 0.0041 / 0.0024 / 0.0000). Record each value in the TSR | P |
| N-18 | 1.10, 1.12 | Network | One news check per page, no hosted calls, no heavy chunks | Record requests on `/`, `/posts`, `/programmes/vce`, `/resources`, `/privacy` | `/rest/v1/posts?select=id&limit=1`: exactly **1** per page; `/posts` has 1 more (list). 0 requests to `*.supabase.co`. 0 requests for the `$SB` / `$MUI` chunks from N-04 | P |
| N-19 | 1.14 | XSS | Script payload shows as text | On **D** as `admin@`, publish title `<script>alert(1)</script>`, body `<img src=x onerror=alert(2)>`. Open `localhost:4173/posts` with a `dialog` listener | Both strings visible as text; 0 dialogs; `document.querySelectorAll('main script, main img').length` = 0. Delete the post afterwards (count back to 1) | P + D |
| N-20 | 1.6 (D3) | UI evidence | `/posts` blank space with **1** post | Full-page screenshots at 1280×720 and 375×812; measure px between the last post's bottom and the footer's top | Saved: `$EVD/posts-1-post-1280x720.png`, `$EVD/posts-1-post-375x812.png`; gap px recorded. **Saurabh judges** (not pass/fail for the Tester) | P |

### Phase 3 — portal on the dev server (each case that adds a post deletes it again)

**D** is already running. Sign-in page is `/portal/login`. Password for every seeded account: `supabase/seed.sql`.

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| N-40 | 1.13 | Permissions | Anonymous at admin compose | Signed out, open `localhost:5173/portal/admin/posts` | Ends on `/portal/login`; no Publish button; no post data in the DOM | D |
| N-41 | 1.13 | Permissions | Anonymous REST writes refused | `curl -s -o /dev/null -w '%{http_code}' -X POST "$VITE_SUPABASE_URL/rest/v1/posts" -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" -H 'Content-Type: application/json' -d '{"title":"anon","body":"x"}'`; also PATCH and DELETE on `?id=eq.<the post id>` | POST status 401 or 403; PATCH/DELETE change nothing; `q "select count(*), max(title) from public.posts"` unchanged | DB |
| N-42 | 1.13 | Permissions | Tutor at admin compose | Sign in `tutor@`, open `/portal/admin/posts` | Text "You don't have access to this page"; 0 Publish buttons; 0 `#post-title` | D |
| N-43 | 1.13 | Permissions | Student and parent at admin compose | As `student@`, then `parent@`, open `/portal/admin/posts` | Same as N-42 for both (no compose form, no post list) | D |
| N-44 | 1.13 | Permissions | Admin without two-step can't write | Sign in `newadmin@` | Two-step set-up screen shown; `/portal/admin/posts` not reachable with a working form; `pnpm db:test` (N-03) covers the RLS side | D |
| N-45 | 1.14 | Invalid input | Empty title and body | As `admin@` on `/portal/admin/posts`: Publish with both empty; then title only; then body only | Nothing inserted (count unchanged each time). **Per AC-1.14 as worded:** an inline message next to the empty field. See ruling §4: today's page-level "Some details aren't valid…" **fails** this case | D |
| N-46 | 1.14 | Invalid input | Over-long title and body (typed and pasted) | Type 121 chars in title; paste 5,100 chars into body; Publish | Field length stops at 120 / 5000 and the saved row has exactly 120 / 5000 chars (`q "select char_length(title), char_length(body) …"`). **Per AC-1.14 as worded:** an inline message tells the admin. See §4: no message today, so this **fails** the message half | D |
| N-47 | 1.14 | Invalid input | DB backstop for over-long | `q "insert into public.posts(title,body) values (repeat('a',121),'x')"`; same with `repeat('a',5001)` body | Both fail with `check constraint` (SQLSTATE 23514); count unchanged | DB |
| N-48 | 1.14 | Invalid input | Boundary lengths accepted | Publish title of exactly 1 char + body 1 char; then title 120 + body 5000 | Both saved; both show on `localhost:4173/posts` after reload; delete both afterwards | D + P |
| N-49 | — | Observation | Whitespace-only title | Publish title `   ` (3 spaces), body `x` | Record result. DB allows it (`char_length` = 3, no trim). If saved, raise as a separate **Low** bug against the admin page (not item 1's diff); does not gate item 1. Delete it afterwards | D |
| N-50 | 3 (N3) | Duplicate action | Double-click Publish | Fill a valid post, double-click Publish quickly | Exactly 1 new row; button shows "Publishing…" and is disabled while busy. Delete afterwards | D |
| N-51 | Regr. | E2E | Full E2E suite | `cd ~/dev/work/aj_classes-e2e && pnpm test` | All specs pass (admin posts, invite onboarding, Our Approach, Register Interest, admin 2FA). **Watch:** `admin-posts.spec.ts` "newest-first" reads `li h2` without waiting, and `/posts` now loads its list after mount. If it fails with titles `[]`, re-run once and check manually (N-52). A timing failure is an E2E-repo fix, not an app bug, but must be written up | D |
| N-52 | Regr. | Admin posts | Create, edit, delete → `/posts` | As `admin@`: publish `T-new`; reload `localhost:4173/posts`; edit to `T-edited`; reload; delete; reload | `T-new` first in the list; then `T-edited` replaces it (count +1 only); then gone; DB count back to 1 | D + P |
| N-53 | Regr. | E2E hygiene | No leftovers | `q "select count(*) from public.posts where title like 'e2e-%'"`; same for `public.enquiries` (email) and `public.profiles` (name/email) | All **0** | DB |
| N-54 | Smoke | Sign-in | Every seeded role + reload | For `admin@`, `newadmin@`, `tutor@`, `student@`, `parent@`: sign in at `/portal/login`, then reload | Each lands on a `/portal…` page that isn't `/portal/login` (`admin@` → `/portal/admin`; `newadmin@` → two-step set-up); after reload still signed in on the same URL; 0 console errors | D |
| N-55 | Smoke | Sign-in | Inactive account refused | Sign in `inactive@local.test` with the seed password | Message "Email or password is incorrect."; URL stays `/portal/login`; no session in `localStorage` | D |
| N-56 | UI | Portal theme | Compose page in dark mode | As `admin@`, toggle the portal theme to dark; trigger N-45's message | Message and fields render; text readable. **Human visual judgement** (screenshot `$EVD/admin-posts-dark.png`) | D |

### Phase 4 — fixtures: 0 posts, 201 posts, DB down (P running throughout)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| N-30 | 1.6 | Empty state | Apply F1 + F2, then header/footer on every public page | `docker exec supabase_db_aj_classes pg_dump -U postgres --data-only -t public.posts > $SCR/posts-backup.sql`; `q "delete from public.posts"`; `q "select count(*) from public.posts"`; open every sitemap URL (N-57's list) + `/posts` at 1280 | Count 0. On every page: 0 `header a[href="/posts"]`, 0 `footer a[href="/posts"]`, `header nav > ul > li` count **5** | P |
| N-31 | 1.6 | Empty state | `/posts` with 0 posts | Open `/posts` (1280 and 375); `curl -s -o /dev/null -w '%{http_code}' localhost:4173/posts` | `200`; header and footer present; text "There are no news posts at the moment."; links "Back to the home page" → `/` and "Register interest" → `/#<contact id>` (both resolve, the second scrolls to the form); 1 `h1`; error text absent; 0 console errors | P |
| N-32 | 1.6 | Empty state | No "coming soon" anywhere | `grep -riE 'coming soon\|check back' apps/web/build/client --include=*.html --include=*.js \| wc -l`; plus `document.body.innerText` on `/posts` | Both **0** matches | P |
| N-33 | 1.6 (D3) | UI evidence | `/posts` blank space with **0** posts | Full-page screenshots at 1280×720 and 375×812; measure px between the empty-state links and the footer top | Saved: `$EVD/posts-0-posts-1280x720.png`, `$EVD/posts-0-posts-375x812.png`; gap px recorded (05 says ≈ 350 px at 1280×720). **Saurabh judges** | P |
| N-34 | 1.10 | Live update | Publish first post shows links, no rebuild | On **D** as `admin@`, publish "Term 4 classes start on Monday" (the original text); reload `localhost:4173/` and `/posts` (no rebuild, same server) | Header and footer News links back (1 each); `/posts` lists it; `header nav > ul > li` = 6 | P + D |
| N-35 | 1.10 | Live update | Delete last post hides links, no rebuild | Delete it on **D**; reload `localhost:4173/`; then publish it again (count 1) | After delete: 0 links, 5 `li`. After re-publish: links back. Final count 1 | P + D |
| N-36 | — | Edge | More posts than the cap (F3) | `q "insert into public.posts(title,body,created_at) select 'cap-'\|\|g, 'x', now() - (g \|\| ' minutes')::interval from generate_series(1,201) g"`; open `/posts` | List shows exactly **200** `li h2` (`POSTS_MAX_ROWS`); newest first (`cap-1` before `cap-2`); CLS < 0.1; 0 console errors | P |
| N-37 | — | Clean-up | Remove F3 | `q "delete from public.posts where title like 'cap-%'"` | Count back to 1 | DB |
| N-21 | 1.7 | Error state | DB down (F4): links hidden | `pnpm db:stop` (literal, from repo root). Reload `localhost:4173/`, `/programmes/vce`, `/privacy` | 0 News links in header and footer; 5 nav `li`; pages otherwise render; only console error is the refused news request (non-bug 2) | P |
| N-22 | 1.7 | Error state | DB down: `/posts` error line | Open `/posts` (1280 and 375), hard reload | `200` (static HTML); text "We couldn't load the news just now. Please try again later."; "There are no news posts…" absent; both links present; 1 `h1`; no raw error text (no `TypeError`, `fetch`, stack). Screenshot `$EVD/posts-db-down-1280.png` | P |
| N-23 | 1.7 | Recovery | DB back | `pnpm db:start`; `pnpm db:status` key; `q "select count(*), max(title) from public.posts"`; reload `/` | Key unchanged from N-01 (else rebuild before more P cases); count 1 with the original title; links back | P, DB |

### Phase 5 — other builds (each overwrites `build/client`; restart P after each build)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| N-24 | 1.4 | Indexing | Staging build has `noindex` | `VITE_APP_ENV=staging pnpm build`; `grep -c '<meta name="robots" content="noindex"' apps/web/build/client/posts/index.html`; same for `index.html`, `privacy/index.html` | Each **1** (exactly one robots meta, BUG-1 guard) | S |
| N-25 | 1.11 | No Supabase | Build without Supabase | `VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_APP_ENV=production pnpm build`; `grep -c '/posts' apps/web/build/client/sitemap.xml`; serve on :4173, open `/` and `/posts`, record requests | Build exit 0; sitemap `/posts` count **0**; 0 News links; 0 requests to `/rest/v1/`; `/posts` still 200 and shows the error line (not blank, not the empty line) | N |
| N-26 | 1.11 (review-5 #1) | No Supabase | URL set, key empty | `VITE_SUPABASE_PUBLISHABLE_KEY= VITE_APP_ENV=production pnpm build`; same checks as N-25 | Sitemap `/posts` count **0**; 0 News links; 0 `/rest/v1/` requests | K |
| N-27 | 1.11 | Sitemap | Configured build lists `/posts` | Rebuild production (`VITE_APP_ENV=production pnpm build`, exports set); `grep -c '<loc>https://ajclasses.com.au/posts</loc>' apps/web/build/client/sitemap.xml` | **1**. P is now back to the production build for any re-runs | P |

### Smoke and regression (run inside phase 2 after N-20; N-61 in phase 3)

| ID | AC | Area | Case | Steps | Expected (measurable) | Env |
|---|---|---|---|---|---|---|
| N-57 | Smoke | Page sweep | Every sitemap URL at 375 and 1280 | `curl -s localhost:4173/sitemap.xml \| grep -o '<loc>[^<]*' \| sed 's#<loc>https://ajclasses.com.au##'`; for each path at 375×812 and 1280×800: status, console errors, `scrollWidth − clientWidth`, `h1` count, robots meta count | Every URL **200**; 0 console errors; overflow **0**; exactly 1 `h1`; robots meta **0** on every production public page. Record URL count (expect home + 9 programmes + resources + guides + privacy + posts) | P |
| N-58 | Regr. | Robots/sitemap | Production robots and sitemap | `cat apps/web/build/client/robots.txt`; `curl -s localhost:4173/sitemap.xml \| xmllint --noout - ; echo $?` | robots has the production `ROBOTS.rules`, a `Disallow` for `/portal`, and `Sitemap: https://ajclasses.com.au/sitemap.xml`; sitemap is well-formed XML (exit 0) | P |
| N-59 | Regr. | 404 and `/subscribed` | One robots meta (BUG-1) | `curl -s localhost:4173/does-not-exist \| grep -c 'name="robots"'`; same for `/subscribed`; open both and check console | Each **1**; 404 status 404; 0 duplicate-key console errors | P |
| N-60 | Regr. | Portal headers | `/portal` CSP, noindex, no-store unchanged | `curl -sI localhost:4173/portal/login`; `curl -sI localhost:4173/portal/admin/posts` | Both 200 with `Content-Security-Policy` (byte-equal to `vercel.json`'s value), `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store` | P |
| N-61 | Regr. | Lead form | Home Register Interest form still posts | Covered by N-51 (`register-interest.spec.ts`, Web3Forms mocked, `public.enquiries` polled). Plus on **D**: submit once manually with an `e2e-manual-…` name, check the success message, then `q "delete from public.enquiries where …"` | Spec passes; manual submit shows the success message and 1 row, removed afterwards | D |
| N-62 | 1.8 | Keyboard | News link reachable by keyboard | 1280 on `/`: Tab from the logo through the nav | Focus reaches News right after the 5th nav link, with a visible focus ring. Ring visibility is **human judgement** | P |
| N-63 | UI | Colour scheme | Public site under dark preference | `page.emulateMedia({ colorScheme: 'dark' })` on `/` and `/posts` at 1280; compare computed `color` of the News link and the first nav link | Same colour as in light; the public site has one colour scheme (05 §5 item 5), so nothing changes. Not a fail if both schemes look identical | P |

---

## 3. Case count

| Area | Cases |
|---|---|
| Safety and full check (N-01 to N-05) | 5 |
| Routing, crawlable shell, indexing (N-06 to N-11, N-24) | 7 |
| Header, footer, CLS, network (N-12 to N-18, N-62) | 8 |
| Empty, live update, error, recovery, cap (N-21 to N-23, N-30 to N-32, N-34 to N-37) | 10 |
| No-Supabase and sitemap builds (N-25 to N-27) | 3 |
| Permissions (N-40 to N-44) | 5 |
| Invalid input and duplicate action (N-19, N-45 to N-50) | 7 |
| UI evidence for Saurabh and theme (N-20, N-33, N-56, N-63) | 4 |
| Smoke (N-54, N-55, N-57) | 3 |
| Regression (N-51 to N-53, N-58 to N-61) | 7 |
| **Total** | **59** |

AC coverage: 1.1 N-03/06/07 · 1.2 N-05/08 · 1.3 N-09 · 1.4 N-05/10/24 · 1.5 N-11 · 1.6 N-30–33 ·
1.7 N-21–23 · 1.8 N-12–15/17/62 · 1.9 N-16 · 1.10 N-18/34/35 · 1.11 N-25–27 · 1.12 N-04/18 ·
1.13 N-03/40–44 · 1.14 N-19/45–48 · 1.15 N-03.

---

## 4. Ruling on AC-1.14 ("refused with an inline message")

**Ruling: does not meet the AC as worded. Not PASS-as-is.**

| Part | Today (`routes/portal/admin-posts.tsx`) | Meets AC-1.14? |
|---|---|---|
| Empty title or body | The insert goes to the DB, the check constraint fails, and a page-level `Alert` at the top shows "Some details aren't valid. Please check them and try again." It doesn't say which field. | **No.** It's refused, but the message isn't inline and doesn't name the field |
| Over-long title or body | `maxLength` stops typing at 120 / 5000. A longer paste is cut off with no message. No `counter` is passed to the body field. | **Half.** It's refused (the value can't be entered, DB check is the backstop, N-47), but there's no message, so a cut paste goes unnoticed |
| `<script>` in title/body | Shows as text | Yes (N-19, unit test) |

Other portal forms already show inline field errors (e.g. `ASSIGNMENT_LIMITS` / `titleLength`), so
the house pattern exists. The admin posts page just doesn't use it.

**What would need to change (small, admin page only, not in item 1's 21 files):**
1. In `publish()` and `saveEdit()`, check the trimmed title (1–120) and body (1–5000) before calling
   the service, and pass `error` to `TextInput` / `TextAreaInput`, with new `POSTS_PAGE` constants
   (e.g. `titleLength`, `bodyLength`) built from `POST_LIMITS`.
2. Pass `counter` to the body `TextAreaInput` ("n / 5000 characters") so a cut paste is visible.
   Keep `maxLength`.
3. One `admin-posts` test for each message.

A trim check would also close N-49 (whitespace-only title).

**Or** the Product Owner rewrites AC-1.14 to match today's behaviour ("empty is refused with an
on-page message; over-long can't be entered"). Then N-45 and N-46 pass as-is. One of the two must
happen before freeze, or N-45/N-46 fail and the gate can't reach 100%.

---

## 5. Not testable locally

| # | What | Why | Who / when |
|---|---|---|---|
| 1 | Hosted `/posts` returns 200, also after hard refresh, on `ajclasses.com.au` | Needs the real Vercel deployment and the hosted DB | Saurabh, B1 / 04 §6.1 step 5 |
| 2 | Posts migration applied on the hosted project; at least 1 hosted post exists | Hosted DB is off-limits to the team | Saurabh, B1 steps 2–3 |
| 3 | Real Vercel behaviour (`cleanUrls`, header matching, `404.html` fallback, edge caching) | Tested only with the `serve` mirror (05 §5 item 2). `vercel dev` not used | Saurabh's hosted curl after release |
| 4 | Staging on Vercel | 302 to Vercel SSO (known non-bug) | — |
| 5 | Hosted Supabase CORS for `ajclasses.com.au` → REST, and the region in the Privacy sentence ("Supabase, Sydney") | Hosted-only facts | Saurabh + Security, with B1 |
| 6 | Safari (macOS/iOS), Firefox, real Android/iPhone; `svh` support in older browsers (D3 falls back to no `min-height`) | Only Playwright Chromium here | Saurabh, quick phone check after release |
| 7 | Google indexing `/posts` (Search Console) | Needs the live site and time | Later |
| 8 | Visual/UX judgement: D3 blank space (N-20, N-33), focus ring (N-62), dark portal (N-56) | Taste, not measurable | Saurabh at `/test-and-ship` |

---

## 6. ACs I think are untestable as written

1. **AC-1.14 "inline message"**: testable, but fails today (§4). The AC needs either the small
   fix or new wording.
2. **AC-1.1 step 2 "the same rewrite and header rules as `vercel.json`"**: the mirror is a
   `serve` config that copies Railway's rules. Equivalence to Vercel is argued, not proven
   (`hosting-config.test.ts` checks the configs, not Vercel's runtime). The real proof is the
   hosted check (B1).
3. **AC-1.8 "CLS < 0.1"**: measurable, but only under the conditions we pick (viewport, delay).
   Field CLS on real phones and networks isn't measured. The plan uses 05's fixed conditions so
   runs can be compared.
4. **AC-1.11 assumption "B1 makes sure at least 1 post exists"**: a release-process promise, not
   something a local test can check.
