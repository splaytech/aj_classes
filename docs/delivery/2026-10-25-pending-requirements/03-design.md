# 03 — Solution design: build-queue items 1–3

> **Stage:** 3 of /deliver (Solution Designer) · **Date:** 25 Oct 2026 · **Branch:** `feature/pending-requirements`
> **Input:** [01-requirement.md](01-requirement.md) (approved, AC-3.8 updated today),
> [02-architecture.md](02-architecture.md) and ADRs [0001–0004](../../decisions/) (approved in
> [review-2.md](review-2.md) round 2; now **Accepted**).
> **Next stage:** Manager (build plan / todo file), then Developer.
> **Revision:** round 2, after [review-3.md](review-3.md) round 1 (blocking 1–2 and minors 3–14
> fixed; team-lead decisions: 1 → option (a), 2 → update-then-insert).

Each part below is meant to be built without coming back with questions. It names every file,
every SQL object with its exact signature and grants, every service signature, and how each AC
is tested on a laptop.

---

## 0. Read me first

### 0.1 Shipping order and dependencies

| Item | Depends on | Migration | Can ship alone? |
|---|---|---|---|
| 1 News | nothing | none | **Yes.** No backend change |
| 2 File uploads | nothing from 1 or 3 | `20261025100000_assignment_files.sql` | **Yes** |
| 3 Work-returned email | nothing from 1 or 2 | `20261025110000_work_returned_email.sql` | **Yes** |

- **Item 3 does not depend on item 2.** Its trigger sits on `assignment_results`, which paper,
  online and file hand-in work all use. If 3 ships first, the "file hand-in" part of AC-3.1 is
  simply not testable yet. It needs no code change when 2 lands.
- **Migration order rule.** `supabase db push` refuses a migration whose timestamp is older than
  the newest one already applied. Item 2's release waits on B3 (Supabase Pro), so item 3 may go
  live first. **If item 3 is released before item 2, rename item 2's file to a timestamp newer
  than item 3's before merging it** (e.g. `20261026…`). Nothing inside the files refers to the
  other item.
- **Item 2 stays on its own branch, unmerged, until B3 is approved** (review-3 finding 5).
  `deploy.sh` runs `supabase db push`, which applies every migration in the checkout, so item 2's
  file on `develop` would put the bucket and table live with item 3's deploy.
- **`deploy.sh`: each item appends only its own function name** to `FUNCTIONS` (item 2:
  `assignment-files`; item 3: `notifications`), so deploying one item never names the other's
  missing folder (review-3 finding 3).
- Each item ends in its own commit set and its own `/test-and-ship` pass. Item 1 goes first and
  unblocks OD-01 / B1.

### 0.2 Repo rules every file below follows

- HTTP only in `apps/web/src/services/` (ESLint `no-restricted-imports` already enforces
  `@supabase/*`; plain `fetch` lives in `*.client.ts` files there).
- Every word shown to a person comes from `apps/web/src/constants/*` (`react/jsx-no-literals`).
  Limits shared with SQL carry a "must match" comment, as `POST_LIMITS` and `PHOTO_LIMITS` do.
- No `style={{…}}`. Public pages use CSS modules. Portal pages use MUI `sx`, as every portal
  page already does.
- Every `.map()` that renders JSX has a stable `key` (row ids, or a `crypto.randomUUID()` made
  when a file is picked, never the array index).
- New routes sit under an ErrorBoundary. Portal routes inherit `portal-root.tsx`'s
  `ErrorBoundary` (it is the parent layout of every `/portal` route). `/posts` gets its own
  (§1.3).
- No `console.log` in web code. Edge functions keep the existing `console.error(<fixed text>,
  <code>)` style, never logging addresses, names or paths.
- SQL: `set search_path = ''`, `revoke … from public, anon[, authenticated]`, explicit grants,
  RLS on every new table (supabase/README "Rules").

### 0.3 Keeping real families safe while testing (one DB for staging and prod)

1. **All tests run against the local stack only** (`pnpm db:start`). Local accounts are the
   `@local.test` seed accounts; Mailpit captures every local email and never relays it.
2. **The worker has no default transport.** It sends nothing unless `EMAIL_TRANSPORT` is
   exactly `resend` or `mailpit`. Locally `config.toml` sets `mailpit`; hosted, `deploy.sh`
   sets `resend`. A pure unit test proves an unset or unknown value picks nothing (§3.10).
3. **The worker has no default secret.** An unset `NOTIFY_WORKER_SECRET` refuses every call.
   `deploy.sh` refuses the committed local value.
4. Hosted checks (B1, AC-3.11) are Saurabh's release steps, using a seeded fake family with his
   own addresses. Nothing in this design runs against the hosted project.

### 0.4 Review-2 round 2 carry-overs: where each is resolved

| # | Carry-over | Resolved in |
|---|---|---|
| 1 | Email cap counts `sent` + `sending`; `Idempotency-Key`; per-row `sent`; Mailpit equivalent? | §3.2 (`private.emails_sent_last_day`, `notify_claim_emails`), §3.4 (worker loop, transport), §3.4.4 (Mailpit answer). Also written into 02 and ADR-0004 |
| 2 | Tutor submission page: overall mark, file list, service writes `mark` | §2.7 call-site table (rows `submission.tsx`, `submissions.service.ts`). 02's table and its "no other checks" sentence corrected; ADR-0002 list extended |
| 3 | Upload cap race | **Revised after review-3 finding 1** (team lead: option (a)). Storage checks the INSERT policy in a rolled-back permission transaction and writes the row later as superuser, so no lock can hold across parallel uploads. The policy count caps sequential uploads; the **hard cap is on registered files** (the register RPCs lock and count). The parallel case is a known limit (§6). §2.2 step 8, §2.10; 02 §2.2 and ADR-0003 §3 agree |
| 4 | AC-3.8 wording | Edited in 01 (AC-3.8) with a change-log row at the bottom of 01 |
| 5 | Tidy-ups | `config_missing` → "Set-up error" (§3.2, 02, ADR-0004); ADR-0003 renumbered; 02 "Upgrade trigger" split out; ADRs 0001–0004 and `docs/decisions/README.md` now **Accepted** |

---

## Item 1 — News page works on the hosted site, linked only when there's news

ADR-0001. No database change. No new dependency.

### 1.1 Files to touch (21)

| # | Path (under `apps/web/`) | New / changed | Responsibility |
|---|---|---|---|
| 1 | `src/services/post-rows.ts` | New | `PostRow` type, `POST_COLUMNS`, `POSTS_MAX_ROWS = 200` and `toPost()`, moved out of `posts.service.ts` so the public client shares them without importing the supabase-js service |
| 2 | `src/services/posts.service.ts` | Changed | Imports the four items above from `post-rows.ts`. Behaviour unchanged (admin page). Update `listPosts`'s comment ("used by both the admin page and the public page") to "used by the admin page; the public page uses `public-posts.client.ts`" |
| 3 | `src/services/public-posts.client.ts` | New | `hasPublishedPosts()` and `listPublicPosts()` with plain `fetch` (§1.2) |
| 4 | `src/services/public-posts.client.test.ts` | New | Unit tests for both functions (§1.6) |
| 5 | `src/services/index.ts` | Changed | Export `hasPublishedPosts`, `listPublicPosts` |
| 6 | `src/lib/use-has-news.ts` | New | `useHasNews(): boolean`. `false` until the check resolves `true` |
| 7 | `src/lib/use-public-posts.ts` | New | `usePublicPosts(): PublicPostsState` for the page (loading / ready / error) |
| 8 | `src/routes/posts.tsx` | Changed | Drop `clientLoader`. Render the shell plus the four states. Add `ErrorBoundary` |
| 9 | `src/routes/posts.test.tsx` | New | Component tests for the states (§1.6) |
| 10 | `src/routes/posts.module.css` | Changed | `.status` class for the loading, empty and error lines and the two links |
| 11 | `src/constants/posts.constants.ts` | Changed | Replace `empty`; add `loading`, `error`, `emptyLinks`, `errorBoundary` (§1.4) |
| 12 | `src/constants/content.constants.ts` | Changed | `NAV.newsLink`, `FOOTER.newsLink`; one Privacy sentence (§1.4) |
| 13 | `src/components/layout/header/Header.tsx` | Changed | Append the News `<li>` after the mapped `NAV.links` when `useHasNews()` is true |
| 14 | `src/components/layout/header/Header.test.tsx` | Changed | News link tests (§1.6) |
| 15 | `src/components/layout/footer/Footer.tsx` | Changed | News link first in the `.legal` row when `useHasNews()` is true |
| 16 | `src/components/layout/footer/Footer.test.tsx` | New | Footer link tests |
| 17 | `src/routes/sitemap.ts` | Changed | `publicSitemapPaths(supabaseConfigured)`; `/posts` only when configured |
| 18 | `src/routes/sitemap.test.ts` | New | Both branches of `publicSitemapPaths` |
| 19 | `react-router.config.ts` | Changed | Add `ROUTES.posts` to `prerender` (after `ROUTES.resources`) |
| 20 | `src/hosting-config.test.ts` | New | Guards ADR-0001: `/posts` is pre-rendered; no rewrite or portal header rule in `vercel.json` or `serve.railway.json` matches `/posts` |
| 21 | `src/routes.ts` | Changed | Line 19 comment → `// pre-rendered shell; posts load live in the browser (ADR-0001)` |

Conditional (only if the Developer measures an overflow, 02 item 1 risk 1):
`src/components/layout/header/Header.module.css`, set `.links { gap: var(--space-3) }` inside
`@media (min-width: 1024px) and (max-width: 1279px)`. Breakpoint unchanged.

**Not touched:** `vercel.json`, `serve.railway.json` (by design, ADR-0001 §1), the admin posts
page, the `posts` migration and its RLS.

### 1.2 Service contracts (`src/services/public-posts.client.ts`)

```ts
/** True only when at least one post exists. Any failure, timeout or missing config → false.
 *  Memoised per page load, so header and footer share one request. */
export function hasPublishedPosts(): Promise<boolean>;

/** Newest first, at most POSTS_MAX_ROWS. Never throws. */
export function listPublicPosts(): Promise<Result<Post[]>>;
```

Both read `APP_CONFIG.supabase.url` and `.publishableKey`. Internally each delegates to a
config-taking function, exported for tests only through the same module:

```ts
export function checkPublishedPosts(config: PublicSupabaseConfig, fetcher = fetch): Promise<boolean>;
export function fetchPublicPosts(config: PublicSupabaseConfig, fetcher = fetch): Promise<Result<Post[]>>;
type PublicSupabaseConfig = { url: string; publishableKey: string };
```

HTTP, same as `leads.client.ts` (header `apikey` only; the `sb_publishable_` key isn't a JWT, so
no `Authorization`):

| Call | Request | Success | Failure → |
|---|---|---|---|
| check | `GET {url}/rest/v1/posts?select=id&limit=1`, headers `{ apikey }`, `signal: AbortSignal.timeout(5000)`, `cache: 'no-store'` | 200 with a non-empty JSON array → `true` | empty array, non-200, network error, timeout, bad JSON, or `url`/`publishableKey` empty (no request made) → `false` |
| list | `GET {url}/rest/v1/posts?select={POST_COLUMNS without spaces}&order=created_at.desc&limit=200`, same headers and options | 200 → `succeed(rows.map(toPost))` | unconfigured → `fail('notConfigured')`; anything else → `fail('network')` |

`notConfigured` is a new `ErrorKey`: add it to `PORTAL_ERRORS` (`error.constants.ts`) with the
text "News isn't available right now." The page shows `POSTS_PUBLIC_PAGE.error`, not this text,
but `Result` needs a valid key.

Memo: a module-level `let newsCheck: Promise<boolean> | null`. `hasPublishedPosts()` returns it
or creates it. A full page load is a new module instance, so AC-1.10 ("next page load") holds.
Pre-rendering never calls it (effects don't run at build time).

### 1.3 Components and behaviour

**`lib/use-has-news.ts`**

```ts
export function useHasNews(): boolean; // useState(false); useEffect → hasPublishedPosts().then(setHasNews) with an "ignore after unmount" flag
```

**`lib/use-public-posts.ts`**

```ts
export type PublicPostsState =
  | { status: 'loading' }
  | { status: 'ready'; posts: Post[] } // posts may be []
  | { status: 'error' };
export function usePublicPosts(): PublicPostsState;
```

**`routes/posts.tsx`** (no `clientLoader`, so React Router pre-renders the real component):
- `meta()` unchanged (`buildPageMeta(POSTS_PUBLIC_PAGE.seo, ROUTES.posts)`): title,
  description, canonical, and `noindex` only outside production (AC-1.3, AC-1.4).
- Always renders `SiteLayout` → `Section` → one `h1` (`heading`) → intro. Below it, by state:
  - `loading`: `<p className={styles.status}>{loading}</p>` (this line is in the pre-rendered
    HTML).
  - `ready`, non-empty: the existing `<ul>` list (keys `post.id`, title and body as text).
  - `ready`, empty: `empty` line, then two links: `ROUTES.home` (`emptyLinks.home`) and
    `sectionLink(SECTION_IDS.contact)` (`emptyLinks.registerInterest`).
  - `error`: the `error` line (different text from `empty`), same two links.
- `export function ErrorBoundary()`: `SiteLayout` + `h1` `errorBoundary.heading` + `p`
  `errorBoundary.text` + `ButtonLink` home. Same shape as `not-found.tsx`.

**`Header.tsx`**: `const hasNews = useHasNews();` After the `NAV.links.map(...)` inside
`<ul className={styles.links}>`:

```tsx
{hasNews && (
  <li key={NAV.newsLink.href}>
    <a href={NAV.newsLink.href} onClick={closeMenu}
       aria-current={isCurrentPage(pathname, NAV.newsLink.href) ? 'page' : undefined}>
      {NAV.newsLink.label}
    </a>
  </li>
)}
```

The desktop bar and phone menu share this list, so both get it. With news: 6 `.links > li`;
Sign in and Register Interest stay in `.actions` (AC-1.8 counting, 02 item 1 §4).

**`Footer.tsx`**: `{hasNews && <a href={ROUTES.posts}>{FOOTER.newsLink}</a>}` as the **first**
child of `.legal` (before Resources). The footer is below the fold on every page, so its
position doesn't affect CLS.

**`routes/sitemap.ts`**:

```ts
export function publicSitemapPaths(supabaseConfigured: boolean): string[]; // ROUTES.posts last, only when true
// loader() uses publicSitemapPaths(APP_CONFIG.supabase.url !== '')
```

### 1.4 Constants (exact wording)

`posts.constants.ts` → `POSTS_PUBLIC_PAGE`:

| Key | Text |
|---|---|
| `heading`, `intro`, `seo`, `showByline`, `byline` | unchanged |
| `loading` | `Loading the latest news…` |
| `empty` (replaces "Nothing posted yet. Check back soon.") | `There are no news posts at the moment.` |
| `error` | `We couldn't load the news just now. Please try again later.` |
| `emptyLinks.home` | `Back to the home page` |
| `emptyLinks.registerInterest` | `Register interest` |
| `errorBoundary.heading` | `Something went wrong` |
| `errorBoundary.text` | `This page couldn't be shown. Please try again later.` |
| `errorBoundary.backHome` | `Back to the home page` |

`content.constants.ts`:
- `NAV.newsLink: { label: 'News', href: ROUTES.posts }` (import `ROUTES` from
  `routes.constants`, as `SECTION_IDS` already is).
- `FOOTER.newsLink: 'News'`.
- `PRIVACY`, in the existing section that describes the website (02 item 1 risk 3):
  "When you visit a page, your browser asks our database whether there is any news to show.
  Like any web request, this shares your IP address and browser type with our database provider
  (Supabase, Sydney). We don't store it or use it to identify you."
  Saurabh approves it as part of the **B1 question** in `01-requirement.md` §2.2 (review-3
  finding 12), so he says yes to this wording knowingly before it goes to production.

`error.constants.ts`: `PORTAL_ERRORS.notConfigured` (§1.2).

### 1.5 Data model

None. Re-uses `public.posts` and its "Anyone reads posts" policy. **No `supabase-js` on any
public page, `/posts` included** (02 item 1 §3).

### 1.6 Test approach per AC

Commands: unit `pnpm test`; DB `pnpm db:test`; builds always with the local-stack prefix
below, never against the hosted project (§0.3.1, review-3 finding 7):

```bash
# Once per terminal, before any build. Two exports, because zsh doesn't word-split an unquoted
# variable, so a one-variable prefix would hand the build a broken URL (review-3 R2-2).
export VITE_SUPABASE_URL=http://127.0.0.1:55321
export VITE_SUPABASE_PUBLISHABLE_KEY=<from pnpm db:status>
VITE_APP_ENV=production pnpm build   # "production build"
VITE_APP_ENV=staging pnpm build      # "staging build" (AC-1.4)
```

"Vercel mirror" means the static server in the box below; it reproduces `vercel.json`'s
`cleanUrls`, the `/portal` rewrite and its headers, and the `404.html` fallback.

> **Vercel mirror (Tester, `/test-and-ship`).** Copy `apps/web/serve.railway.json` to your
> scratch dir as `serve-like-vercel.json` and delete the `X-Robots-Tag` entry from its `**/*`
> rule (Railway was a staging host, so it sends `noindex` everywhere; Vercel doesn't). What's
> left matches `vercel.json`: `cleanUrls`, no trailing slash, the `/portal` rewrite with the
> portal CSP / `noindex` / `no-store` on the fallback, `404.html` with HTTP 404. From `apps/web`
> run `pnpm exec serve --config <scratch>/serve-like-vercel.json -l 4173 --no-clipboard` with
> **no positional folder**: the config's `"public": "build/client"` is resolved against it, so
> adding `build/client` would serve an empty `build/client/build/client` (review-3 finding 6).
> Railway mirror: `PORT=4174 pnpm --filter web start:railway` (uses `serve.railway.json` as is;
> expect its global `noindex` header, which AC-1.2 doesn't test).
> **Build against the local stack, not the hosted one.** A production-mode build reads
> `apps/web/.env.production`, which points at the shared hosted project. Shell variables win over
> `.env` files, so every build runs after the two `export` lines above.
> At least 1 post must exist locally (publish one as `admin@local.test` at
> `/portal/admin/posts`) unless the case says otherwise.

| AC | How it's tested | Type |
|---|---|---|
| 1.1 | Build; Vercel mirror; `curl -s -o /dev/null -w '%{http_code}' localhost:4173/posts` = 200; open in a browser, list renders; hard refresh still 200 and renders. `hosting-config.test.ts`: `prerender` contains `ROUTES.posts` | Manual + unit |
| 1.2 | Railway mirror: same curl on :4174 = 200. `hosting-config.test.ts`: neither config has a rewrite whose source matches `/posts` (glob test against `/posts`), so they handle it identically | Manual + unit |
| 1.3 | `curl -s localhost:4173/posts` contains `<title>Latest News \| AJ Classes</title>`, the meta description, `<link rel="canonical" href="https://ajclasses.com.au/posts"`, and `grep -o '<h1' \| wc -l` = 1. `posts.test.tsx`: exactly one `heading` level 1 in every state | Manual + unit |
| 1.4 | Production build: `curl -sI localhost:4173/posts` has no `X-Robots-Tag`, `Content-Security-Policy` or `no-store`; HTML has no `name="robots"`. Staging build (after the two exports, `VITE_APP_ENV=staging pnpm build`): HTML has `content="noindex"`. `hosting-config.test.ts`: in `vercel.json`, the CSP / `X-Robots-Tag` / `no-store` rule's source is only `/portal/:path*` | Manual + unit |
| 1.5 | Vercel mirror: `/posts/anything` and `/postsx` return 404 with the 404 page's `h1` | Manual |
| 1.6 | `posts.test.tsx` (mocks `@/lib/use-public-posts`): `{ status: 'ready', posts: [] }` shows `empty` + both links, not `error`. `Header.test` / `Footer.test`: `useHasNews` mocked `false` → no News link. Guard test in `posts.test.tsx`: no `POSTS_PUBLIC_PAGE` string matches `/coming soon\|check back/i`. Manual: delete every local post, check home, a programme page and `/posts` | Unit + manual |
| 1.7 | `public-posts.client.test.ts`: fetch rejects / 500 / never resolves (fake timers past 5 s) → `checkPublishedPosts` false, `fetchPublicPosts` `ok: false`. `posts.test.tsx`: `{ status: 'error' }` shows `error`, not `empty`; `use-public-posts` maps `fail('network')` to it. Manual: `pnpm db:stop`, reload home (no links) and `/posts` (error line) | Unit + manual |
| 1.8 | `Header.test`: with `useHasNews` → true, the News link is the last `li` of the `links` list, `href="/posts"`, `aria-current="page"` when rendered at `/posts`, not elsewhere, and the list has 6 items. Manual at 1024 px and 1280 px: one row. CLS: Chrome DevTools Performance (or Lighthouse) on `/` at 1024 × 600, record score < 0.1 in the TSR | Unit + manual |
| 1.9 | `Footer.test`: link present when true, absent when false | Unit |
| 1.10 | `public-posts.client.test.ts`: two `hasPublishedPosts()` calls → one fetch. Manual: delete the last post, reload → links gone; publish one, reload → links back. No rebuild | Unit + manual |
| 1.11 | `sitemap.test.ts`: `publicSitemapPaths(false)` excludes `/posts`, `(true)` includes it. `public-posts.client.test.ts`: empty `url` → false and no fetch call. Build with `VITE_SUPABASE_URL= VITE_APP_ENV=production pnpm build` (the one build that deliberately has no Supabase) succeeds and `build/client/sitemap.xml` has no `/posts` | Unit + manual |
| 1.12 | Bundle check after the production build (below). Plus DevTools Network on `/` and `/posts`: no request for a chunk containing supabase-js or MUI | Manual (scripted) |
| 1.13 | `pnpm db:test` (`posts.test.sql`, unchanged, must stay green). Manual: `tutor@local.test` at `/portal/admin/posts` sees "You don't have access to this page" | DB + manual |
| 1.14 | Manual: admin compose refuses empty and over-long title/body (existing behaviour). `posts.test.tsx`: a post titled `<script>alert(1)</script>` renders as text (`getByText`), and `container.querySelector('script')` is null | Manual + unit |
| 1.15 | `pnpm lint` | Lint |

**Bundle check (AC-1.12)**, from `apps/web` after the production build:

```bash
SB=$(grep -l "GoTrueClient\|supabase-js" build/client/assets/*.js | xargs -n1 basename)
MUI=$(grep -l "MuiButtonBase" build/client/assets/*.js | xargs -n1 basename)
for page in build/client/index.html build/client/privacy/index.html build/client/resources/index.html \
            build/client/programmes/*/index.html build/client/posts/index.html; do
  preloads=$(grep -o 'rel="modulepreload" href="[^"]*"' "$page")
  for chunk in $SB $MUI; do echo "$preloads" | grep -q "$chunk" && echo "FAIL $page → $chunk"; done
done; echo done
```

Expected output: only `done`.

**Unit test notes.** `useHasNews` is mocked in Header/Footer tests with
`vi.mock('@/lib/use-has-news', () => ({ useHasNews: () => true }))` (one file per value, or
`vi.mocked(...).mockReturnValue`). `public-posts.client.test.ts` passes a fake `fetcher` and a
config object; memo tests use `vi.resetModules()` and a dynamic import.

### 1.7 Docs to update

- `apps/web/src/routes.ts:19` comment (file 21 above).
- `docs/architecture/arch.md`: one line under the public site: "Public pages read live data
  (news) through plain `fetch` in `services/*.client.ts`, never `supabase-js` (ADR-0001)."
- `docs/requirements/blog.md`: "Status" note: `/posts` pre-rendered, News link shown when posts
  exist (link to this file).
- Item 5 (public CSP), when elaborated: `connect-src` includes the Supabase host (02 cross-item
  notes). No action now.

---

## Item 2 — Homework file uploads

ADR-0002 (flag) and ADR-0003 (storage). One migration, one edge function, no new npm or Deno
dependency.

### 2.1 Files to touch (48)

**Database and functions (`supabase/`)**

| # | Path | New / changed | Responsibility |
|---|---|---|---|
| 1 | `migrations/20261025100000_assignment_files.sql` | New | Everything in §2.2, in that order |
| 2 | `tests/database/assignment_files.test.sql` | New | pgTAP for the flag, submit, RPCs, RLS, storage policies, visibility (§2.10) |
| 3 | `functions/assignment-files/index.ts` | New | `delete-assignment` action (§2.5) |
| 4 | `functions/_shared/auth.ts` | Changed | Add `requireSignedIn(request): Promise<Caller \| null>` (JWT claims only; RLS decides the rest) |
| 5 | `config.toml` | Changed | `[functions.assignment-files] verify_jwt = true`, with a comment like the others |
| 6 | `scripts/test-assignment-files.mjs` | New | Real Storage API and function checks, including the sequential 6th-upload refusal and the parallel-upload registration cap (§2.10) |
| 7 | `scripts/deploy.sh` | Changed | Append `assignment-files` to `FUNCTIONS` (only its own name, §0.1) |
| 8 | `seed.sql` | Changed | One published **file hand-in** assignment in the demo maths class: "Worked solutions: fractions (upload)", `max_mark 20`, due in 5 days, `is_file_handin = true` |
| 9 | `README.md` | Changed | Function list, `pnpm test:functions` line, orphan-object note |
| 10 | `/package.json` (repo root) | Changed | `test:functions` appends `&& node supabase/scripts/test-assignment-files.mjs` |

**Web (`apps/web/src/`)**

| # | Path | New / changed | Responsibility |
|---|---|---|---|
| 11 | `services/assignment-files.service.ts` | New | Upload-then-register, remove, signed download URL, staff list (§2.6) |
| 12 | `services/assignments.service.ts` | Changed | `is_file_handin` in `ASSIGNMENT_COLUMNS`, mapping, `saveAssignment` writes it; `getAssignment` loads files; `deleteAssignment` calls the edge function |
| 13 | `services/submissions.service.ts` | Changed | `getSubmission` returns `isFileHandin` and the student's files; `saveSubmission` gains `overallMark` |
| 14 | `services/family-data.ts` | Changed | Map `is_file_handin`, and the view's `isFileHandin`, `studentId`, `attachments`, `files`, `unfinishedUploads` |
| 15 | `services/types.ts` | Changed | Types in §2.6 |
| 16 | `services/index.ts` | Changed | Export the new service functions and types |
| 17 | `services/database.types.ts` | Regenerated | `pnpm db:types` after the migration |
| 18 | `services/auth-errors.ts` | Changed | New own-keys (§2.8) |
| 19 | `services/auth-errors.test.ts` | Changed | Each new key maps |
| 20 | `lib/assignments.ts` | Changed | `assignmentKind()`, `acceptsStudentWork()` |
| 21 | `lib/assignments.test.ts` | Changed | Tests for both |
| 22 | `lib/work-files.ts` | New | `workFileType()`, `checkWorkFile()`, `prepareWorkFile()`, `formatFileSize()`, `fileExtension()` (§2.6) |
| 23 | `lib/work-files.test.ts` | New | Type/size/count/total checks, DOCX-with-empty-type, names |
| 24 | `lib/photo.ts` | Changed | `fitWithin()`, `prepareWorkPhoto()`; `canvasToBlob(canvas, type, quality)` takes the quality |
| 25 | `lib/photo.test.ts` | New | `fitWithin` cases |
| 26 | `components/portal/FilesCard.tsx` | New | File list + optional add/remove with per-file state (§2.7) |
| 27 | `components/portal/FilesCard.test.tsx` | New | Rendering and refusal tests |
| 28 | `components/portal/FileHandInForm.tsx` | New | Student's file hand-in: `FilesCard` + Submit with confirmation |
| 29 | `components/portal/index.ts` | Changed | Export the two components |
| 30 | `components/portal/AssignmentDialog.tsx` | Changed | File hand-in switch; max mark for paper and file hand-in |
| 31 | `components/portal/SubmissionsTable.tsx` | Changed | "Files" column |
| 32 | `routes/portal/assignment-detail.tsx` | Changed | Kind; attachments card; no question editor for file hand-in |
| 33 | `routes/portal/submission.tsx` | Changed | Files, overall mark, score line (carry-over 2) |
| 34 | `routes/portal/student-home.tsx` | Changed | Kind-based action label and chip |
| 35 | `routes/portal/student-assignment.tsx` | Changed | Attachments; uploads for online and file hand-in; `FileHandInForm` |
| 36 | `routes/portal/parent-child-assignment.tsx` | Changed | Attachments; child's files once submitted |
| 37 | `constants/app.constants.ts` | Changed | `WORK_FILE_LIMITS` (§2.8) |
| 38 | `constants/files.constants.ts` | New | `WORK_FILES` text (§2.8) |
| 39 | `constants/index.ts` | Changed | `export * from './files.constants'` |
| 40 | `constants/error.constants.ts` | Changed | New `PORTAL_ERRORS` keys |
| 41 | `constants/online-assignments.constants.ts` | Changed | `PUBLISHING.confirmPublishText(className, kind)`; submission page and dialog text |
| 42 | `constants/family.constants.ts` | Changed | Student home chip/labels, file hand-in texts |
| 43 | `constants/content.constants.ts` | Changed | `PRIVACY` wording for uploaded work `[TBC: B17 – Saurabh]` |

**Docs**

| # | Path | Change |
|---|---|---|
| 44 | `docs/architecture/arch.md` | §4 Storage (`assignment-files`, private), §4 Edge Functions (`assignment-files`), diagram |
| 45 | `docs/requirements/release-3/r3b/design.md` | D6: "…a third kind, **file hand-in** (`is_file_handin`), has no questions and takes files (ADR-0002)" |
| 46 | `docs/budget.md` | §4 storage note: student uploads exist from item 2; release waits for Pro (B3) |
| 47 | `docs/requirements/release-3/PRP.md` | Mark R3-03/R3-04 "built (pending release)", link here |
| 48 | `apps/web/src/routes/privacy.test.tsx` | Test, listed here with the Privacy change: asserts the uploaded-work sentence exists |

### 2.2 Migration `20261025100000_assignment_files.sql` (in this order)

Header comment: purpose, links to ADR-0002/0003 and this section. Limits below must match
`WORK_FILE_LIMITS` (say so in a comment next to each literal).

**Step 1. The flag**

```sql
alter table public.assignments
  add column is_file_handin boolean not null default false;

comment on column public.assignments.is_file_handin is
  'File hand-in (ADR-0002): online work with no questions; the student''s answer is their files.';

grant insert (is_file_handin), update (is_file_handin) on public.assignments to authenticated;
```

**Step 2. Flag guards**

```sql
-- Set at insert or changed while a draft; never on a draft with questions; locked once published.
create function private.check_file_handin_flag()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.is_file_handin is distinct from old.is_file_handin
     and old.status = 'published' then
    raise exception 'assignment_published';
  end if;
  if new.is_file_handin and (tg_op = 'INSERT' or not old.is_file_handin)
     and exists (select 1 from public.assignment_questions q where q.assignment_id = new.id) then
    raise exception 'file_handin_has_questions';
  end if;
  return new;
end;
$$;

create trigger assignments_check_file_handin
  before insert or update of is_file_handin on public.assignments
  for each row execute function private.check_file_handin_flag();

-- A file hand-in never gets questions. Runs after assignment_questions_check (name order), which
-- has already locked the assignment row, so a concurrent flag change can't slip between them.
create function private.check_question_not_file_handin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.assignments a where a.id = new.assignment_id and a.is_file_handin) then
    raise exception 'file_handin_has_no_questions';
  end if;
  return new;
end;
$$;

create trigger assignment_questions_not_file_handin
  before insert on public.assignment_questions
  for each row execute function private.check_question_not_file_handin();
```

**Step 3. Online = flag or questions**

```sql
create or replace function private.is_online_assignment(target_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.assignments a where a.id = target_assignment and a.is_file_handin)
      or exists (select 1 from public.assignment_questions q where q.assignment_id = target_assignment)
$$;
```

`check_assignment_result` needs no change: it already refuses staff Submitted/Marked on online
work (`invalid_status`) and allows staff submitted → returned. Its `unmarked_answers` check finds
no questions for a file hand-in, so it passes. `mark ≤ max_mark` and `no_marks` already apply
through `assignment_total_marks`.

**Step 4. Metadata table**

```sql
create table public.assignment_files (
  id            uuid primary key, -- the {file_id} in the storage path (set by the register RPCs)
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id    uuid references public.students (id) on delete cascade, -- null: tutor attachment
  storage_path  text not null unique check (char_length(storage_path) <= 200),
  file_name     text not null check (char_length(trim(file_name)) between 1 and 200), -- shown as text
  byte_size     bigint not null check (byte_size between 1 and 10485760),
  mime_type     text not null check (mime_type in (
                  'application/pdf',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'image/jpeg', 'image/png', 'image/webp')),
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  -- A student's file belongs to their result row (MATCH SIMPLE: not checked for attachments).
  foreign key (assignment_id, student_id)
    references public.assignment_results (assignment_id, student_id) on delete cascade
);

create index assignment_files_owner_idx on public.assignment_files (assignment_id, student_id);

comment on table public.assignment_files is
  'Files on assignments (ADR-0003): tutor attachments (student_id null) and students'' hand-ins. Source of truth for what exists.';
```

**Step 5. Path parsing and read rule (helpers)**

```sql
-- '{a}/attachments/{f}.{ext}' or '{a}/submissions/{s}/{f}.{ext}' → its parts; else all null.
create function private.parse_assignment_object(
  object_name text,
  out assignment_id uuid, out student_id uuid, out file_id uuid, out folder text)
language plpgsql immutable set search_path = '' as $$
declare
  uuid_re constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  parts text[] := regexp_match(object_name,
    '^(' || uuid_re || ')/(attachments|submissions/(' || uuid_re || '))/(' || uuid_re || ')\.(pdf|docx|jpg|png|webp)$');
begin
  if parts is null then return; end if;
  assignment_id := parts[1]::uuid;
  student_id := parts[3]::uuid; -- null for attachments
  file_id := parts[4]::uuid;
  folder := parts[1] || '/' || parts[2];
end;
$$;

-- AC-2.7 / AC-2.11 in one place: used by the table policy and the storage SELECT policy.
create function private.can_read_assignment_file(target_assignment uuid, target_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when target_student is null then          -- tutor attachment
      private.can_manage_assignment(target_assignment)
      or coalesce(private.assignment_visible_to(private.my_student_id(), target_assignment), false)
      or exists (
        select 1 from public.student_guardians g
        where g.parent_id = (select auth.uid())
          and private.is_my_child(g.student_id)
          and private.assignment_visible_to(g.student_id, target_assignment))
    else                                      -- a student's hand-in
      (target_student = private.my_student_id()
        and private.assignment_visible_to(target_student, target_assignment))
      or (exists (
            select 1 from public.assignment_results r
            where r.assignment_id = target_assignment and r.student_id = target_student
              and r.status in ('submitted', 'returned'))
          and (private.can_manage_assignment(target_assignment)
               or (private.is_my_child(target_student)
                   and private.assignment_visible_to(target_student, target_assignment))))
  end
$$;

-- Size and type rules shared by both register RPCs. Literals must match WORK_FILE_LIMITS.
create function private.check_work_file(byte_size bigint, mime_type text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if mime_type is null or mime_type not in (
       'application/pdf',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'image/jpeg', 'image/png', 'image/webp') then
    raise exception 'file_type';
  end if;
  if coalesce(byte_size, 0) < 1
     or (mime_type like 'image/%' and byte_size > 2097152)
     or byte_size > 10485760 then
    raise exception 'file_too_large';
  end if;
end;
$$;
```

**Step 6. RLS on the table**

```sql
revoke all on public.assignment_files from anon, authenticated;
grant select on public.assignment_files to authenticated;
alter table public.assignment_files enable row level security;

-- Staff only (families read through assignment_view, R3b D4). Student rows only once submitted.
create policy "Staff read the files they may see"
  on public.assignment_files for select to authenticated
  using ((select private.is_active_staff()) and private.can_read_assignment_file(assignment_id, student_id));
```

No insert/update/delete grants: writes go through the RPCs in step 9.

**Step 7. Bucket**

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assignment-files', 'assignment-files', false, 10485760, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
```

**Step 8. Storage policy functions and policies**

Storage uses `owner_id` (text), confirmed on the local stack (CLI 2.120.0: both `owner` uuid and
`owner_id` text exist; use `owner_id`).

How storage-api v1.80.2 (the local stack) applies these policies (review-3 finding 1):
- **Upload:** the INSERT policy runs only in a permission check that the API always rolls back
  (`testPermission`). The bytes then upload with no transaction open, and the object row is
  written as superuser, with no RLS. So the 5-object count below is a **soft cap**: it holds for
  sequential uploads (the only kind the app makes), but parallel requests can all pass the check
  before any row exists. A lock can't fix that, so there is none.
- **The hard cap is on registered files.** `staff_register_attachment` and
  `student_register_file` lock (assignment row / result row) and count registered files (≤ 5,
  ≤ 20 MB). Anything beyond that stays an unregistered object: listed to the student as an
  unfinished upload, and removed by the Later sweep (§6).
- **Delete and signed URLs** run `DELETE … RETURNING` and a SELECT, so the remover must pass the
  SELECT policy on an unregistered object. That's why the read rule has an "unregistered"
  branch. (The upload itself is a plain `INSERT`, no `RETURNING`.)

```sql
-- INSERT: right folder, caller may add here, and fewer than 5 objects already in the folder.
-- A soft cap: Storage checks this before the upload and writes the row later, so parallel
-- requests can pass together. The hard cap is in the register RPCs (review-3 finding 1).
create function private.can_upload_assignment_object(object_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  target record;
  me uuid;
  result_status text;
begin
  select * into target from private.parse_assignment_object(object_name);
  if target.assignment_id is null then
    return false;
  end if;

  if target.student_id is null then
    if not private.can_manage_assignment(target.assignment_id) then return false; end if;
  else
    me := private.my_student_id();
    if me is null or target.student_id <> me
       or not private.assignment_visible_to(me, target.assignment_id)
       or not private.is_online_assignment(target.assignment_id) then
      return false; -- paper homework: staff-only status, no student uploads (AC-2.3)
    end if;
    select r.status into result_status from public.assignment_results r
    where r.assignment_id = target.assignment_id and r.student_id = me;
    if coalesce(result_status, 'not_submitted') not in ('not_submitted', 'in_progress') then
      return false;
    end if;
  end if;

  return (select count(*) from storage.objects o
          where o.bucket_id = 'assignment-files' and o.name like target.folder || '/%') < 5;
end;
$$;

-- SELECT (signed URLs, and Storage's DELETE … RETURNING): registered → the AC-2.7 rule; unregistered →
-- its uploader, or anyone who manages the assignment for an attachment.
create function private.can_read_assignment_object(object_name text, object_owner text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  registered record;
  target record;
begin
  select f.assignment_id, f.student_id into registered
  from public.assignment_files f where f.storage_path = object_name;
  if found then
    return private.can_read_assignment_file(registered.assignment_id, registered.student_id);
  end if;

  select * into target from private.parse_assignment_object(object_name);
  return private.my_active_role() is not null
     and (object_owner = (select auth.uid())::text
          or (target.assignment_id is not null and target.student_id is null
              and private.can_manage_assignment(target.assignment_id)));
end;
$$;

-- DELETE: only unregistered objects (the remove RPCs delete the row first, so a row never
-- points at a missing object). Attachments: managers. Hand-ins: the student, before submitting.
create function private.can_remove_assignment_object(object_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  target record;
  me uuid;
  result_status text;
begin
  if exists (select 1 from public.assignment_files f where f.storage_path = object_name) then
    return false;
  end if;
  select * into target from private.parse_assignment_object(object_name);
  if target.assignment_id is null then return false; end if;
  if target.student_id is null then
    return private.can_manage_assignment(target.assignment_id);
  end if;
  me := private.my_student_id();
  if me is null or target.student_id <> me then return false; end if;
  select r.status into result_status from public.assignment_results r
  where r.assignment_id = target.assignment_id and r.student_id = me;
  return coalesce(result_status, 'not_submitted') in ('not_submitted', 'in_progress');
end;
$$;

create policy "Assignment files: upload into an allowed folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'assignment-files' and private.can_upload_assignment_object(name));

create policy "Assignment files: read what you may see"
  on storage.objects for select to authenticated
  using (bucket_id = 'assignment-files' and private.can_read_assignment_object(name, owner_id));

create policy "Assignment files: remove unregistered files you may remove"
  on storage.objects for delete to authenticated
  using (bucket_id = 'assignment-files' and private.can_remove_assignment_object(name));
-- No UPDATE policy: nobody replaces a file (AC-2.7). No anon policy: nothing is public.
```

**Step 9. RPCs**

All `language plpgsql`, `security definer`, `set search_path = ''`. Error keys are raised as
`raise exception '<key>'` (mapped in `auth-errors.ts`); `not_found` uses `errcode 'P0002'`.
The block lists signatures; the bodies follow the table under it.

```sql
-- Staff: register an uploaded attachment. Returns the file id.
create function public.staff_register_attachment(target_assignment uuid, object_path text, display_name text)
returns uuid
-- Staff: remove an attachment's row. Returns its storage path for the client to delete.
create function public.staff_remove_attachment(target_file uuid)
returns text
-- Student: register an uploaded hand-in file; first file starts the work. Returns the file id.
create function public.student_register_file(target_assignment uuid, object_path text, display_name text)
returns uuid
-- Student: remove one of their files before submitting. Returns its storage path.
create function public.student_remove_file(target_file uuid)
returns text
-- Edge function only (service role): every object under '{assignment}/', registered or not.
create function public.assignment_storage_objects(target_assignment uuid)
returns setof text language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'assignment-files' and o.name like target_assignment::text || '/%'
$$;
```

Bodies, step by step:

| RPC | Steps (in order) | Errors |
|---|---|---|
| `staff_register_attachment` | 1. `can_manage_assignment(target_assignment)` else `not_found`. 2. `parse_assignment_object(object_path)`: must have `assignment_id = target_assignment` and `student_id is null`, else `invalid_input`. 3. `select … from public.assignments where id = target_assignment for update` (serialises registers on one assignment). 4. Read `storage.objects` where `bucket_id = 'assignment-files' and name = object_path and owner_id = auth.uid()::text`, else `file_missing`. 5. `size := (metadata->>'size')::bigint`, `mime := metadata->>'mimetype'`; `perform private.check_work_file(size, mime)`. 6. Existing attachments: count ≥ 5 → `too_many_files`; sum + size > 20971520 → `files_too_large`. 7. `trim(display_name)` 1–200 chars else `invalid_input`. 8. Insert (`id = file_id` from the path, `uploaded_by = auth.uid()`). Return id | `not_found`, `invalid_input`, `file_missing`, `file_type`, `file_too_large`, `too_many_files`, `files_too_large` |
| `staff_remove_attachment` | Row with `id = target_file and student_id is null`, and `can_manage_assignment(row.assignment_id)`, else `not_found`. Delete it. Return `storage_path` | `not_found` |
| `student_register_file` | 1. `me := private.require_student()`. 2. `assignment_visible_to(me, target_assignment)` else `not_found`. 3. `is_online_assignment(target_assignment)` else `not_online`. 4. Path: `assignment_id = target_assignment and student_id = me`, else `invalid_input`. 5. As `student_save_answer`: `insert into assignment_results (assignment_id, student_id, status) values (…, me, 'in_progress') on conflict do nothing`; `select status … for update`; not in (`not_submitted`, `in_progress`) → `already_submitted`; `not_submitted` → update to `in_progress`. 6–9. As staff steps 4–8 (limits per student per assignment, `uploaded_by = auth.uid()`) | `not_student`, `not_found`, `not_online`, `invalid_input`, `already_submitted`, `file_missing`, `file_type`, `file_too_large`, `too_many_files`, `files_too_large` |
| `student_remove_file` | `me := require_student()`. Row with `id = target_file and student_id = me` else `not_found`. Lock the result row `for update`; status not in (`not_submitted`, `in_progress`) → `already_submitted`. Delete. Return `storage_path`. Status stays `in_progress` (like answers) | `not_student`, `not_found`, `already_submitted` |

**Step 10. `student_submit` (replace)**

Same as `20261007090321_family_functions.sql:463-527` with three changes:
1. `declare handin boolean;` and after the `not_online` check:
   `select a.is_file_handin into handin from public.assignments a where a.id = target_assignment;`
2. After the `already_submitted` check:
   ```sql
   if handin and not exists (
     select 1 from public.assignment_files f
     where f.assignment_id = target_assignment and f.student_id = me) then
     raise exception 'no_files';
   end if;
   ```
3. The final branch: `if handin or exists (… kind = 'written') then return 'submitted'; end if;`
   (a file hand-in never auto-returns; 02 risk 1).

`create or replace` keeps its grants.

**Step 11. Family functions (drop and recreate)**

```sql
drop function public.student_assignments();
drop function public.parent_child_assignments(uuid);
drop function private.assignments_for_student(uuid, boolean);
```

Recreate all three exactly as in `20261007090321_family_functions.sql:151-202, 347-371,
574-598`, with **one column appended last** to each `returns table (…)`:
`is_file_handin boolean`, and `a.is_file_handin` appended last to the private function's select
list. The wrappers stay `select * from private.assignments_for_student(…)`.

Then `create or replace function private.assignment_view(…)` with the existing body
(`:206-267`) plus these keys in its `jsonb_build_object`:

```sql
'isFileHandin', summary.is_file_handin,
'studentId', target_student,
'attachments', coalesce((
  select jsonb_agg(jsonb_build_object('id', f.id, 'path', f.storage_path, 'name', f.file_name,
           'size', f.byte_size, 'mimeType', f.mime_type, 'createdAt', f.created_at) order by f.created_at)
  from public.assignment_files f
  where f.assignment_id = target_assignment and f.student_id is null), '[]'::jsonb),
'files', case when not for_parent or summary.status in ('submitted', 'returned') then coalesce((
  select jsonb_agg(jsonb_build_object('id', f.id, 'path', f.storage_path, 'name', f.file_name,
           'size', f.byte_size, 'mimeType', f.mime_type, 'createdAt', f.created_at) order by f.created_at)
  from public.assignment_files f
  where f.assignment_id = target_assignment and f.student_id = target_student), '[]'::jsonb)
  else '[]'::jsonb end,
-- The student's own uploads that never got registered (tab closed mid-way): shown with Remove so
-- a stuck one can't use up a slot (02 §2.2). Never shown to parents.
'unfinishedUploads', case when for_parent then '[]'::jsonb else coalesce((
  select jsonb_agg(jsonb_build_object('path', o.name, 'size', (o.metadata ->> 'size')::bigint,
           'createdAt', o.created_at) order by o.created_at)
  from storage.objects o
  where o.bucket_id = 'assignment-files'
    and o.name like target_assignment::text || '/submissions/' || target_student::text || '/%'
    and not exists (select 1 from public.assignment_files f where f.storage_path = o.name)), '[]'::jsonb) end
```

The view only runs for an assignment the student can see (it returns null otherwise), so
attachments of drafts never reach families.

**Step 12. Grants**

```sql
revoke execute on function
  private.check_file_handin_flag(), private.check_question_not_file_handin(),
  private.parse_assignment_object(text), private.can_read_assignment_file(uuid, uuid),
  private.check_work_file(bigint, text), private.can_upload_assignment_object(text),
  private.can_read_assignment_object(text, text), private.can_remove_assignment_object(text),
  private.assignments_for_student(uuid, boolean), private.assignment_view(uuid, uuid, boolean)
from public, anon, authenticated;

-- Policies run as the caller, so their functions must be callable by signed-in users.
grant execute on function
  private.can_read_assignment_file(uuid, uuid), private.can_upload_assignment_object(text),
  private.can_read_assignment_object(text, text), private.can_remove_assignment_object(text)
to authenticated;

revoke execute on function
  public.student_assignments(), public.parent_child_assignments(uuid),
  public.staff_register_attachment(uuid, text, text), public.staff_remove_attachment(uuid),
  public.student_register_file(uuid, text, text), public.student_remove_file(uuid),
  public.assignment_storage_objects(uuid)
from public, anon, authenticated;

grant execute on function
  public.student_assignments(), public.parent_child_assignments(uuid),
  public.staff_register_attachment(uuid, text, text), public.staff_remove_attachment(uuid),
  public.student_register_file(uuid, text, text), public.student_remove_file(uuid)
to authenticated;

grant execute on function public.assignment_storage_objects(uuid) to service_role;
```

`is_online_assignment` and `student_submit` keep their grants (`create or replace`). The
`private.parse_assignment_object` etc. are called only inside definer functions owned by
`postgres`, so they need no grant.

### 2.3 RPC and table contracts (web view)

| Call | From | Args | Returns | Who |
|---|---|---|---|---|
| `rpc('staff_register_attachment')` | `assignment-files.service.ts` | `{ target_assignment, object_path, display_name }` | `uuid` | Class tutor, admin (aal2) |
| `rpc('staff_remove_attachment')` | same | `{ target_file }` | `text` (path) | same |
| `rpc('student_register_file')` | same | `{ target_assignment, object_path, display_name }` | `uuid` | The student |
| `rpc('student_remove_file')` | same | `{ target_file }` | `text` | The student |
| `from('assignment_files').select(...)` | same | `.eq('assignment_id', id).order('created_at')` | rows filtered by RLS | Active staff |
| `rpc('student_assignment')` / `rpc('parent_child_assignment')` | existing | unchanged | JSON gains `isFileHandin`, `studentId`, `attachments`, `files`, `unfinishedUploads` | unchanged |
| `rpc('student_assignments')` / `rpc('parent_child_assignments')` | existing | unchanged | rows gain `is_file_handin` | unchanged |
| `rpc('student_submit')` | existing | unchanged | `'submitted' \| 'returned'`; new error `no_files` | unchanged |

Storage calls (all `supabase.storage.from('assignment-files')`):
`upload(path, blob, { contentType, upsert: false })`, `remove([path])`,
`createSignedUrl(path, 60, { download: fileName })`.

Paths are built only in the service:
`${assignmentId}/attachments/${fileId}.${ext}` and
`${assignmentId}/submissions/${studentId}/${fileId}.${ext}`, with
`fileId = crypto.randomUUID()` and `ext` from `fileExtension(type)` (`jpg`, `png`, `webp`,
`pdf`, `docx`).

### 2.4 Status and visibility (one table for the Tester)

| Result status | Student | Class tutor / admin | Linked parent | Add / remove |
|---|---|---|---|---|
| Not started / In progress | own files + unfinished uploads | none (RLS, storage) | none | student only |
| Submitted / Returned | own files | all | all (read only) | nobody |
| Removed from class (R3b F8) | none | as above | none | nobody |

Attachments: managers always; students and parents once published and while the class is
active and the student enrolled.

### 2.5 Edge function `assignment-files`

`supabase/functions/assignment-files/index.ts`, shaped like `account-admin/index.ts`
(CORS → POST only → caller → JSON → action table → `respond`).

- **Auth:** `verify_jwt = true` at the gateway, plus `requireSignedIn(request)` (new in
  `_shared/auth.ts`: Bearer token → `client.auth.getClaims()` → `{ id, client }`, or `null`).
  The database decides who may delete, through RLS on the caller's own client.
- **Secrets:** built-ins only (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`) and the existing `ALLOWED_ORIGINS`. Nothing new to set.
- **Request:** `POST { "action": "delete-assignment", "assignmentId": "<uuid>" }`.

| Status | Body | When |
|---|---|---|
| 200 | `{ ok: true, data: { removedObjects: n, leftoverObjects: m } }` | Assignment deleted (`m` > 0 only if Storage failed twice) |
| 200 | `{ ok: false, code: 'not_found' }` | The caller's RLS can't see the assignment |
| 200 | `{ ok: false, code: 'not_allowed' }` | The RLS delete returned no row |
| 400 | `{ ok: false, code: 'invalid_request' }` | Bad JSON, unknown action, `assignmentId` not a UUID |
| 401 | `{ ok: false, code: 'not_signed_in' }` | No or invalid token |
| 405 | `{ ok: false, code: 'method_not_allowed' }` | Not POST |
| 500 | `{ ok: false, code: 'server_error' }` | Anything thrown (logged as `assignment-files failed`, action) |

Steps:
1. `caller.client.from('assignments').select('id').eq('id', id).maybeSingle()` → none →
   `not_found`.
2. `serviceClient().rpc('assignment_storage_objects', { target_assignment: id })` → paths.
3. `caller.client.from('assignments').delete().eq('id', id).select('id').maybeSingle()` → none →
   `not_allowed` (nothing removed from Storage).
4. `serviceClient().storage.from('assignment-files').remove(batch)` in batches of 100. Retry the
   failed batches once. Log only `console.error('assignment-files: objects left', m)`.

Web: `deleteAssignment(id)` in `assignments.service.ts` becomes
`callEdgeFunction('assignment-files', 'delete-assignment', { assignmentId: id })` (imported from
`account-admin.client.ts`) and returns `succeed()` / the mapped error. Same signature as today
(`Promise<Result>`), so `assignment-detail.tsx`'s delete flow is unchanged.

### 2.6 Web services and types

`services/types.ts` additions:

```ts
/** A file on an assignment (ADR-0003). studentId null = tutor attachment. */
export type AssignmentFile = {
  id: string; path: string; name: string; size: number; mimeType: string; createdAt: string;
  studentId: string | null;
};
/** A student's own upload that never got registered (shown with Remove). */
export type UnfinishedUpload = { path: string; size: number; createdAt: string };
/** A file ready to upload: images already compressed to JPEG. */
export type PreparedFile = { blob: Blob; name: string; type: string };

// Changed:
AssignmentSummary  += { isFileHandin: boolean }
AssignmentDetail   += { attachments: AssignmentFile[]; studentFiles: AssignmentFile[] }
AssignmentInput    += { isFileHandin: boolean }
Submission.assignment += { isFileHandin: boolean };  Submission += { files: AssignmentFile[] }
FamilyAssignment   += { isFileHandin: boolean }
FamilyAssignmentView += { isFileHandin: boolean; studentId: string; attachments: AssignmentFile[];
                          files: AssignmentFile[]; unfinishedUploads: UnfinishedUpload[] }
```

(For family JSON, `studentId` on each file is filled by `family-data.ts`: `null` for
attachments, the view's `studentId` for files.)

`services/assignment-files.service.ts`:

```ts
export async function addAttachment(assignmentId: string, file: PreparedFile): Promise<Result<AssignmentFile>>;
export async function removeAttachment(file: AssignmentFile): Promise<Result>;
export async function addMyWorkFile(assignmentId: string, studentId: string, file: PreparedFile): Promise<Result<AssignmentFile>>;
export async function removeMyWorkFile(file: AssignmentFile): Promise<Result>;
export async function removeMyUnfinishedUpload(upload: UnfinishedUpload): Promise<Result>;
export async function getFileDownloadUrl(path: string, fileName: string): Promise<Result<string>>;
export async function listAssignmentFiles(assignmentId: string): Promise<Result<AssignmentFile[]>>; // staff, RLS-filtered
```

- `add*`: build path → `upload`. On error, map the **`statusCode` in the error body**
  (`StorageApiError.statusCode`; storage-api answers HTTP 400 with `"413"`, `"415"` or `"403"`
  in the JSON, review-3 finding 8): `'413'` → `fileTooLarge`, `'415'` → `fileType`, anything
  else incl. `'403'` (RLS) → `fileNotAllowed` → register RPC → on RPC error, `remove([path])` best
  effort, return the mapped key → on success return the new `AssignmentFile`.
- `remove*`: RPC (gets the path) → `storage.remove([path])`. A failed object removal is not an
  error to the person: the row is gone; for a student the object then shows as an unfinished
  upload they can remove.
- `getFileDownloadUrl`: `createSignedUrl(path, WORK_FILE_LIMITS.downloadLinkSeconds,
  { download: fileName })` → `succeed(signedUrl)`.

`assignments.service.ts`: `ASSIGNMENT_COLUMNS` adds `is_file_handin`; `AssignmentRow` and
`toAssignmentSummary` map it; `saveAssignment` adds `is_file_handin: input.isFileHandin`;
`getAssignment` adds `listAssignmentFiles(assignmentId)` to its `Promise.all` and splits the
result into `attachments` (studentId null) and `studentFiles`.

`submissions.service.ts`:

```ts
export async function saveSubmission(
  assignmentId: string, studentId: string, marks: AnswerMark[], comment: string,
  returnWork: boolean, overallMark?: number | null,
): Promise<Result>;
// The result update adds `mark: overallMark` only when overallMark !== undefined (file hand-in).
// Online work never passes it, so the answers' trigger stays the only source of its mark.
```

`getSubmission` returns `assignment.isFileHandin` and
`files = assignment.studentFiles.filter(f => f.studentId === studentId)`.

`lib/work-files.ts` (pure apart from `prepareWorkFile`, which calls `prepareWorkPhoto`):

```ts
export function workFileType(file: { type: string; name: string }): string | null; // falls back to .pdf/.docx extension when type is ''
export function checkWorkFile(file: { type: string; size: number; name: string },
                              existing: { count: number; totalBytes: number }): string; // '' or a WORK_FILES.errors message
export async function prepareWorkFile(file: File, existing: { count: number; totalBytes: number })
  : Promise<{ ok: true; file: PreparedFile } | { ok: false; message: string }>;
export function formatFileSize(bytes: number): string; // "820 KB", "3.4 MB"
export function fileExtension(type: string): string;   // 'jpg' | 'png' | 'webp' | 'pdf' | 'docx'
```

Order inside `prepareWorkFile`: type check (HEIC/HEIF are accepted *for compression* only) →
5-file check → images: `prepareWorkPhoto(file)`, `null` → `WORK_FILES.errors.photoUnreadable`
(HEIC gets `heicUnsupported`); result > 2 MB → `imageTooLarge`; name becomes `<base>.jpg` →
documents: > 10 MB → `documentTooLarge` → total > 20 MB → `totalTooLarge`.

`lib/photo.ts`:

```ts
export function fitWithin(width: number, height: number, maxLongEdge: number): { width: number; height: number }; // never upscales; rounds
export async function prepareWorkPhoto(file: File): Promise<Blob | null>; // createImageBitmap → fitWithin(…, 2000) → JPEG at 0.8; null if undecodable or not JPEG
```

`lib/assignments.ts`:

```ts
export type AssignmentKind = 'file_handin' | 'online' | 'paper';
export function assignmentKind(work: { isFileHandin: boolean; questionCount: number }): AssignmentKind;
export function acceptsStudentWork(kind: AssignmentKind): boolean; // online or file_handin
```

### 2.7 Components and call sites

**`FilesCard.tsx`** (MUI, in `SectionCard`):

```ts
type FilesCardProps = {
  title: string;
  files: AssignmentFile[];
  emptyText: string;                         // e.g. WORK_FILES.noAttachments
  unfinished?: UnfinishedUpload[];           // student's own only
  existingTotals?: { count: number; totalBytes: number }; // defaults to files' count/size
  onAdd?: (file: PreparedFile) => Promise<Result<AssignmentFile>>; // present = editable
  onRemove?: (file: AssignmentFile) => Promise<Result>;
  onRemoveUnfinished?: (upload: UnfinishedUpload) => Promise<Result>;
  onChanged: () => void;                     // the page revalidates its loader
};
```

- Each row: name (plain text), `formatFileSize`, **Download** (calls `getFileDownloadUrl`, then
  `window.location.assign(url)`; the URL is never rendered), and **Remove** when editable
  (opens `ConfirmDialog`). Unfinished rows show `WORK_FILES.unfinished` and Remove.
- Add: a visually hidden `<input type="file" multiple accept={WORK_FILE_LIMITS.acceptAttribute}>`
  behind a Button (no `capture`, so phones offer camera and library). Each picked file gets a
  `key = crypto.randomUUID()` and goes through `prepareWorkFile` with running totals. A refusal
  shows its message on that row and nothing is uploaded. Accepted files upload **one at a time**:
  "Uploading…" → "Uploaded" (then `onChanged`) or the mapped error with **Try again**.
- Empty: `emptyText`. Limits hint under the button: `WORK_FILES.limitsHint`.

**`FileHandInForm.tsx`**: `FilesCard` (editable, the student's files) + **Hand in** button,
disabled with `WORK_FILES.needsOneFile` when there are no files. Confirm → `submitMyAssignment`
→ `onHandedIn('submitted')`. Same `ConfirmDialog` and `usePortalAction` pattern as `SolveForm`.

**Call-site table** (02 §2.1 plus carry-over 2):

| Call site | Change |
|---|---|
| `routes/portal/assignment-detail.tsx:75` | `const kind = assignmentKind(assignment)`. Progress text: `acceptsStudentWork(kind)` → `SUBMISSIONS.progress`, else `MARKING_PAGE.progress` |
| `assignment-detail.tsx:179` | Question editor when `kind === 'online'` or (draft and `kind !== 'file_handin'`) |
| `assignment-detail.tsx:188,236-240` (`StudentWork`) | `acceptsStudentWork(kind)` → `SubmissionsTable` |
| `assignment-detail.tsx` (new card) | `FilesCard` "Attachments" after Instructions, editable (`addAttachment`/`removeAttachment`), empty `WORK_FILES.noAttachmentsStaff` |
| `assignment-detail.tsx:212` | `PUBLISHING.confirmPublishText(className, kind)` (constant changes from `online: boolean` to `kind`) |
| `components/portal/AssignmentDialog.tsx:43,52,103` | Kind from `existing`. New draft or existing draft with 0 questions: a `Switch` "File hand-in" (`ASSIGNMENT_DIALOG.labels.fileHandin`, hint `hints.fileHandin`). Published: switch disabled with `hints.fileHandinLocked`. Max mark shown for paper and file hand-in; online keeps `hints.onlineMarks`. Sends `isFileHandin` |
| `components/portal/SubmissionsTable.tsx` | New "Files" column: count of `assignment.studentFiles` for that student (RLS already hides draft work, so it's blank until submitted) |
| `routes/portal/submission.tsx:73,98,128,156-158` | `kind = assignmentKind({ isFileHandin, questionCount: questions.length })`. When handed in: `FilesCard` (read only, empty `WORK_FILES.noFilesHandedIn`) above the comment card, for online and file hand-in. For file hand-in with `totalMarks !== null`: a "Mark" `TextField` (`SUBMISSION_PAGE.overallMarkLabel(totalMarks)`) in the comment card, validated with `parseAnswerMark(text, totalMarks)`. The mark is **optional**, as AC-2.9 says ("can enter") and as paper homework is: Return works without one, and the student then sees "no mark" (review-3 finding 12; a missing mark isn't a data-integrity problem, so nothing extra is enforced). Score line: file hand-in shows the typed mark, online keeps `currentScore` |
| `services/submissions.service.ts:83` | Writes `mark` when `overallMark` is passed (above). `submission.tsx` passes it only for file hand-in |
| `routes/portal/student-home.tsx:125-132` | `actionLabel`: paper → `open`; file hand-in and online → `start` / `continue` |
| `student-home.tsx:148-156` | Answered chip for `online` only; `paper` chip for paper; new `fileHandin` chip for file hand-in |
| `routes/portal/student-assignment.tsx:55-56,96,118` | Kind from `view.isFileHandin` + `view.questions.length`. Attachments `FilesCard` (read only, `WORK_FILES.noAttachments`) for every kind. To do + online: editable files card (optional) above `SolveForm`. To do + file hand-in: `FileHandInForm`. Paper note for paper only. Handed in: read-only own files card for online and file hand-in |
| `routes/portal/parent-child-assignment.tsx:90` | Attachments card for every kind. Submitted/returned + online or file hand-in: the child's files (read only, `WORK_FILES.noFilesHandedIn`) |

`SolveForm.tsx` and `QuestionList.tsx` stay as they are (they count questions for display).

### 2.8 Constants

`app.constants.ts`:

```ts
// Homework files (ADR-0003). Must match the checks in the assignment_files migration
// (private.check_work_file, the register RPCs, the bucket and the 5-object folder cap).
export const WORK_FILE_LIMITS = {
  maxFiles: 5,
  maxImageBytes: 2 * 1024 * 1024,
  maxDocumentBytes: 10 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxImageEdge: 2000,
  imageQuality: 0.8,
  storedTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'image/jpeg', 'image/png', 'image/webp'],
  compressibleTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  acceptAttribute: '.pdf,.docx,image/jpeg,image/png,image/webp,image/heic,image/heif',
  fileNameMax: 200,
  downloadLinkSeconds: 60,
} as const;
```

`files.constants.ts` → `WORK_FILES` (wording):

| Key | Text |
|---|---|
| `attachmentsHeading` | `Attachments` |
| `myFilesHeading` / `theirFilesHeading` / `studentFilesHeading` | `Your files` / `Files handed in` / `Files handed in` |
| `noAttachments` | `No files attached` (AC-2.13) |
| `noAttachmentsStaff` | `No files attached. Add a worksheet or notes for your students.` |
| `noFilesHandedIn` | `No files handed in` (AC-2.13) |
| `add` / `download` / `remove` / `tryAgain` | `Add files` / `Download` / `Remove` / `Try again` |
| `uploading` / `uploaded` / `unfinished` | `Uploading…` / `Uploaded` / `Upload didn't finish` |
| `confirmRemoveTitle` / `confirmRemoveText(name)` | `Remove this file?` / `` `"${name}" will be removed. This can't be undone.` `` |
| `limitsHint` | `PDF, Word (.docx) or photos. Up to 5 files, 20 MB in total.` |
| `needsOneFile` | `Add at least one file before you hand it in.` |
| `errors.type` | `This type of file can't be added. Use a PDF, a Word document (.docx) or a photo (JPEG, PNG or WebP).` |
| `errors.tooMany` | `You can add up to 5 files.` |
| `errors.imageTooLarge` | `This photo is still over 2 MB after shrinking. Try a smaller photo.` |
| `errors.documentTooLarge` | `This file is over 10 MB.` |
| `errors.totalTooLarge` | `Files can add up to 20 MB in total.` |
| `errors.photoUnreadable` | `We couldn't read this photo. Try a JPEG or PNG.` |
| `errors.heicUnsupported` | `iPhone HEIC photos aren't supported in this browser. In iPhone Settings → Camera → Formats choose "Most Compatible", or send a screenshot.` |

Also: `ASSIGNMENT_DIALOG.labels.fileHandin` "File hand-in: students upload photos or PDFs of
their work"; `hints.fileHandin` "No questions. Students hand in files, and you mark them with
one overall mark."; `hints.fileHandinLocked` "The type can't change after publishing.";
`PUBLISHING.confirmPublishText(className, kind)` adds the file hand-in sentence
"Every student in ${className} will see it and can upload their work."; `STUDENT_HOME.toDo.fileHandin`
"Upload your work"; `SUBMISSION_PAGE.overallMarkLabel(total)` "Mark (out of ${total})".

`error.constants.ts` (`PORTAL_ERRORS`) and `auth-errors.ts` (`ERROR_KEYS_BY_OWN_KEY`):

| DB key | `ErrorKey` | Text |
|---|---|---|
| `file_type` | `fileType` | `WORK_FILES.errors.type` text |
| `file_too_large` | `fileTooLarge` | `This file is too large.` |
| `files_too_large` | `filesTooLarge` | `WORK_FILES.errors.totalTooLarge` text |
| `too_many_files` | `tooManyFiles` | `WORK_FILES.errors.tooMany` text |
| `file_missing` | `fileMissing` | `The upload didn't finish. Please try again.` |
| (storage 403) | `fileNotAllowed` | `This file can't be added here. The work may already be handed in, or it has 5 files.` |
| `no_files` | `noFiles` | `WORK_FILES.needsOneFile` text |
| `file_handin_has_questions` | `fileHandinHasQuestions` | `Remove the questions first: a file hand-in has none.` |
| `file_handin_has_no_questions` | `fileHandinNoQuestions` | `A file hand-in can't have questions.` |

`content.constants.ts` `PRIVACY` (portal section), draft: "Students can upload photos or PDFs of
their work to an assignment. Only the student can see a file until they hand it in; after that,
their tutors, our admins and their linked parents can too. Photos are shrunk in the browser
before upload, which also removes location data. Files are stored privately with Supabase in
Sydney and are deleted when the assignment is deleted." `[TBC: B17 wording review – Saurabh]`

### 2.9 Seed (`supabase/seed.sql`, local only)

In the R3b family block, after the online assignments: one published file hand-in in the maths
class (`is_file_handin = true`, `max_mark = 20`, title "Worked solutions: fractions (upload)",
due today + 5). No objects are seeded (SQL can't upload bytes); the script test and the browser
pass upload real files.

### 2.10 Test approach per AC

`assignment_files.test.sql` uses the `family_portal.test.sql` fixtures style (fixed UUIDs:
admin aal2, tutor 1 of class 1, tutor 2 of class 2, kid1 with parent1, kid3, kid4 deactivated,
an invited student, a removed student). Storage rows are inserted directly into
`storage.objects (bucket_id, name, owner_id, metadata)` as the acting user (as
`avatars_storage.test.sql` does), with `metadata = '{"size": N, "mimetype": "…"}'`. Delete-policy
tests run `set local storage.allow_delete_query = 'true'` first (the local stack blocks direct
deletes otherwise).

`test-assignment-files.mjs` follows `test-leads.mjs`: `check()`/`finish()`, local seed accounts,
the seeded file hand-in, real Storage REST calls (`/storage/v1/object/assignment-files/<path>`),
service-key clean-up at the end.

| AC | How it's tested | Type |
|---|---|---|
| 2.1 | DB: tutor 1 / admin register 5 attachments on a draft and a published assignment; 6th → `too_many_files`; tutor 2 → `not_found`; remove → row gone. Students/parents: `attachments` in the JSON only once published. Script: real upload + register + remove. Browser: confirm dialog, name/size/Download | DB + script + manual |
| 2.2 | DB: insert with flag; toggle on a draft; toggle on published → `assignment_published`; flag on with questions → `file_handin_has_questions`; add a question to a file hand-in → `file_handin_has_no_questions`. Browser: switch on new/draft, disabled once published; max mark 1–1000 (existing `validateAssignment` test) | DB + unit + manual |
| 2.3 | DB: first `student_register_file` moves not started → in progress; then unpublish → `has_submissions`; paper: storage insert into `…/submissions/<me>/…` refused (42501) and `student_register_file` → `not_online`. `FilesCard.test`: Uploading → Uploaded; failure shows the error and Try again; Try again re-calls `onAdd`. Browser: no upload control on paper | DB + unit + manual |
| 2.4 | `work-files.test`: each type, empty-type `.docx`, 6th file, image > 2 MB after prepare (mocked), doc > 10 MB, total > 20 MB, all refused with the named message and `onAdd` not called (also in `FilesCard.test`). DB: register with fake metadata → `file_type` (`text/html`), `file_too_large` (image 2 MB + 1, pdf 10 MB + 1), `files_too_large` (4 × 5 MB + 1 MB). Script: real API refuses `text/html` (body `statusCode` `"415"`) and an 11 MB PDF (body `statusCode` `"413"`); the HTTP status is 400 for both | Unit + DB + script |
| 2.5 | Browser in `/test-and-ship`: upload 3 real phone photos (12 MP); record the stored sizes from Supabase Studio (`storage.objects.metadata.size`) in the TSR; each ≤ 2 MB. `photo.test`: `fitWithin(4032, 3024, 2000)` → 2000 × 1500; `(1000, 800, 2000)` unchanged; portrait | Manual + unit |
| 2.6 | DB: file hand-in submit with 0 files → `no_files`; with 1 → `'submitted'` and status stays `submitted` (not auto-returned); online submit without files works; after submit, register → `already_submitted`, remove → `already_submitted`, storage insert refused, storage delete refused; late flag via existing `is_late`. Browser: confirmation dialog | DB + manual |
| 2.7 | DB, in progress: tutor/admin `select from assignment_files` returns 0 student rows; parent JSON `files = []`; storage SELECT as tutor and parent returns 0 rows; student sees own. After submit: all see; storage UPDATE as student and tutor affects 0 rows (no policy) | DB |
| 2.8 | DB: staff `update assignment_results set status = 'submitted'` (and `'marked'`) on a file hand-in → `invalid_status`; the student's files stay hidden from tutor and parent | DB |
| 2.9 | DB: staff set `mark = 20` with `max_mark 20` OK; 21 → `mark_too_high`; on a file hand-in with no `max_mark`, any mark → `no_marks`; submitted → returned works; RLS count of files per student for the tutor. Browser: Files column count; file list with Download; mark field only when a max exists; **Return works without a mark, and the student then sees no mark** (the mark is optional, choice 6); online return unchanged | DB + manual |
| 2.10 | DB: `parent_child_assignment` JSON has `files` once submitted, `[]` before; other parent → `not_found`. Browser: parent page lists them, no Remove | DB + manual |
| 2.11 | DB matrix through the API roles: kid3 can't read kid1's rows/objects or upload into kid1's folder; parent2 sees none of kid1's; tutor 2 sees none of class 1's; admin aal2 sees all, aal1 none; kid4 (deactivated) and an invited student get nothing; draft attachments visible to staff only. Script: `GET /storage/v1/object/public/assignment-files/<path>` fails (bucket private); the signed URL's token has `exp - iat = 60` | DB + script |
| 2.12 | `FilesCard.test`: a file named `<img src=x onerror=alert(1)>.pdf` renders as text and no `img` element appears. Script: fetching the signed URL returns `Content-Disposition: attachment; filename=…` | Unit + script |
| 2.13 | `FilesCard.test`: empty `files` shows the passed `emptyText`. Browser: student sees "No files attached"; tutor sees "No files handed in" on a submitted online assignment with none | Unit + manual |
| 2.14 | DB: deleting an assignment cascades its `assignment_files` rows; removing kid1 from the class → kid1 and parent1 lose access (view returns null; storage SELECT 0 rows), files still stored. Script: `delete-assignment` as tutor removes every object under the prefix, **including an unregistered orphan**; tutor 2 → `not_found` and nothing removed; the assignment row is gone | DB + script |
| 2.15 | **Local:** Chrome device mode at 360 px (layout, controls reachable); desktop file picker: pick a JPEG, a PNG and a PDF, and a `.heic` file in Chrome → `heicUnsupported` message. `FilesCard.test`: the input has the `accept` list and **no** `capture` attribute. **Hosted release checklist (phone), added to item 2's release steps for Saurabh:** on a phone against the hosted site, with a test class and a test student account only, check that the picker offers camera and library, and upload an iPhone photo. A phone can't reach the local stack (review-3 finding 13) | Manual + unit + release step |
| 2.16 | Bundle check from §1.6 still passes; `pnpm lint`; full `pnpm check`, `pnpm db:test`, `pnpm test:functions` | Scripted |
| Carry-over 3 (revised) | Script, as `student@local.test` on the seeded file hand-in: (1) **sequential**: 5 uploads succeed, the 6th is refused by Storage (body `statusCode` `"403"`); clean up. (2) **parallel**: fire 6 uploads with `Promise.all`, then register every object that exists → **at most 5 register** (the rest get `too_many_files`), and `student_assignment`'s JSON lists the extras under `unfinishedUploads`. DB (sequential): with 5 objects present the INSERT policy refuses the 6th, registered or not | Script + DB |

Unit tests for `assignmentKind`/`acceptsStudentWork` (all three kinds, a file hand-in with
`questionCount 0`), and `auth-errors.test` for each new key.

### 2.11 Rollback / forward notes

- **Forward-only.** The column has a default, the table and bucket are new; no backfill.
- **If item 2 must be withdrawn before release:** don't merge; nothing hosted changes.
- **If withdrawn after release:** a new migration that (1) drops the three storage policies and
  the item's private functions, (2) recreates `assignments_for_student`, its two wrappers and
  `assignment_view` without the new column/keys (same drop-and-recreate + grants), (3) restores
  `is_online_assignment` and `student_submit` from `20261007090321`, (4) drops
  `assignment_files` and the flag. Storage won't delete a non-empty bucket: empty it through the
  Storage API (service key) first, then `delete from storage.buckets`. That deletes students'
  files, so it's Saurabh's call.

---

## Item 3 — "Work returned" email, with an off switch

ADR-0004. One migration, one edge function, no new dependency (plain `fetch` to Resend).

### 3.1 Files to touch (31)

**Database and functions (`supabase/`)**

| # | Path | New / changed | Responsibility |
|---|---|---|---|
| 1 | `migrations/20261025110000_work_returned_email.sql` | New | §3.2 in order |
| 2 | `tests/database/email_outbox.test.sql` | New | §3.10 |
| 3 | `functions/notifications/index.ts` | New | Auth, config, claim → send → record loop (§3.4) |
| 4 | `functions/notifications/transport.ts` | New | `pickTransport`, request builders, `outcomeForStatus`, `sendEmail`. Pure apart from `fetch`; no Deno globals at import time (so Node can import it in tests) |
| 5 | `functions/notifications/template.ts` | New | `renderWorkReturned(row, siteUrl): EmailMessage`, HTML + text, escaped |
| 6 | `functions/notifications/copy.ts` | New | Typed wording constants and path builders ("must match `routes.constants.ts`") |
| 7 | `config.toml` | Changed | `[functions.notifications] verify_jwt = false`; local `[edge_runtime.secrets]` (§3.6) |
| 8 | `seed.sql` | Changed | Local Vault entries for the worker URL and secret (§3.6) |
| 9 | `scripts/test-notifications.mjs` | New | §3.10 |
| 10 | `scripts/deploy.sh` | Changed | §3.6 (appends only `notifications` to `FUNCTIONS`) |
| 11 | `README.md` | Changed | Local email flow, Vault runbook, kill switch, AC-3.11 release check |
| 12 | `/package.json` | Changed | `test:functions` appends `&& node supabase/scripts/test-notifications.mjs` |

**Web (`apps/web/src/`)**

| # | Path | New / changed | Responsibility |
|---|---|---|---|
| 13 | `services/notifications.service.ts` | New | Settings read/save; admin problems list |
| 14 | `services/types.ts` | Changed | `NotificationSettings`, `EmailProblem`, `EmailProblemReason` |
| 15 | `services/index.ts` | Changed | Exports |
| 16 | `services/database.types.ts` | Regenerated | `pnpm db:types` |
| 17 | `routes/portal/account.tsx` | Changed | `NotificationsSection` (`id="notifications"`), students and parents only; loader adds the settings read |
| 18 | `routes/portal/account.module.css` | Changed (conditional) | Only if the switch row needs spacing; reuse `.section` first |
| 19 | `routes/portal/admin-emails.tsx` | New | Admin "Emails" table (Failed / Waiting) |
| 20 | `routes.ts` | Changed | `route(PORTAL_ROUTES.adminEmails, 'routes/portal/admin-emails.tsx')` inside the admin layout |
| 21 | `routes/portal/admin-dashboard.tsx` | Changed | `SHORTCUTS` gains `{ key: 'emails', to: PORTAL_ROUTES.adminEmails }` |
| 22 | `constants/routes.constants.ts` | Changed | `PORTAL_ROUTES.adminEmails: '/portal/admin/emails'` |
| 23 | `constants/portal.constants.ts` | Changed | `PORTAL_SEO.adminEmails`, `ADMIN_DASHBOARD.shortcuts.emails`, `ACCOUNT_PAGE.notifications`, `EMAILS_PAGE` (§3.8) |
| 24 | `lib/email-problems.ts` | New | `describeEmailProblem(problem): { state: string; reason: string; role: string }` from constants |
| 25 | `lib/email-problems.test.ts` | New | Every state/reason/role maps to a non-empty label |
| 26 | `constants/content.constants.ts` | Changed | `PRIVACY`: one sentence on service emails and the switch `[TBC: B17 – Saurabh]` |

**Docs**

| # | Path | Change |
|---|---|---|
| 27 | `docs/architecture/arch.md` | §4 Edge Functions (`notifications`), §7 Resend (app email, cap 70/24 h), diagram (cron → worker → Resend) |
| 28 | `docs/budget.md` | §2 Resend row: "work returned" emails, app cap 70 per rolling 24 h |
| 29 | `docs/requirements/release-5/PRP.md` | R5-02 (returned) and R5-04 (first switch) built, link here |
| 30 | `docs/requirements/release-2/go-live.md` | Hosted release steps for item 3 (§3.6), once released |
| 31 | `apps/web/src/routes/privacy.test.tsx` | Test, listed with the Privacy change: asserts the service-email sentence |

`supabase/templates/` is **not** changed: the email is rendered in the function, styled to match.

### 3.2 Migration `20261025110000_work_returned_email.sql` (in this order)

**Step 1. Extensions**

```sql
create extension if not exists pg_cron;   -- schema "cron"
create extension if not exists pg_net;    -- schema "net"
```

Both are available on the local image (pg_cron 1.6.4, pg_net 0.20.4, checked) and on hosted
Supabase. `[ASSUMPTION]` hosted accepts them from a migration; if `db push` refuses, Saurabh
enables both in Dashboard → Database → Extensions and re-runs it.

**Step 2. The switch**

```sql
create table public.notification_settings (
  profile_id    uuid primary key references public.profiles (id) on delete cascade,
  work_returned boolean not null default true, -- a missing row also means on
  updated_at    timestamptz not null default now()
);

comment on table public.notification_settings is
  'Email preferences for students and parents (AC-3.6). One row per person; a missing row means every email is on.';

create trigger notification_settings_set_updated_at
  before update on public.notification_settings
  for each row execute function private.set_updated_at();

revoke all on public.notification_settings from anon, authenticated;
grant select, insert (profile_id, work_returned), update (work_returned)
  on public.notification_settings to authenticated;
alter table public.notification_settings enable row level security;

create policy "Families read their own email settings"
  on public.notification_settings for select to authenticated
  using (profile_id = (select auth.uid()) and (select private.my_active_role()) in ('student', 'parent'));
create policy "Families add their own email settings"
  on public.notification_settings for insert to authenticated
  with check (profile_id = (select auth.uid()) and (select private.my_active_role()) in ('student', 'parent'));
create policy "Families change their own email settings"
  on public.notification_settings for update to authenticated
  using (profile_id = (select auth.uid()) and (select private.my_active_role()) in ('student', 'parent'))
  with check (profile_id = (select auth.uid()) and (select private.my_active_role()) in ('student', 'parent'));
```

**Step 3. The outbox**

```sql
create table public.email_outbox (
  id             uuid primary key default gen_random_uuid(), -- also the Resend Idempotency-Key
  kind           text not null check (kind in ('work_returned')),
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  student_id     uuid not null references public.students (id) on delete cascade,
  recipient_id   uuid not null references public.profiles (id) on delete cascade,
  recipient_role text not null check (recipient_role in ('student', 'parent')),
  status         text not null default 'pending'
                 check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts       smallint not null default 0 check (attempts between 0 and 3),
  reason         text check (reason in ('rejected', 'rate_limited', 'server_error', 'network',
                                        'no_address', 'max_attempts', 'config_missing')),
  created_at     timestamptz not null default now(),
  claimed_at     timestamptz,
  sent_at        timestamptz,
  constraint email_outbox_once unique (kind, assignment_id, student_id, recipient_id) -- AC-3.5
);

create index email_outbox_due_idx on public.email_outbox (created_at)
  where status in ('pending', 'sending');
create index email_outbox_window_idx on public.email_outbox ((coalesce(sent_at, claimed_at)))
  where status in ('sent', 'sending');

comment on table public.email_outbox is
  'App emails waiting, sent or failed (ADR-0004). No address or body is stored. Service role and definer functions only.';

revoke all on public.email_outbox from anon, authenticated;
alter table public.email_outbox enable row level security; -- no policies: nobody reads it directly
```

**Step 4. Helpers**

```sql
-- App cap (Decision 2): 70 in any rolling 24 hours. The only place the number lives.
create function private.email_daily_cap()
returns int language sql immutable set search_path = '' as $$ select 70 $$;

-- Sent, or claimed by a worker that may still be sending (review-2 round 2, finding 1a).
create function private.emails_sent_last_day()
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.email_outbox
  where status in ('sent', 'sending')
    and coalesce(sent_at, claimed_at) > now() - interval '24 hours'
$$;

-- Who should hear about this return (AC-3.1, AC-3.2, AC-3.5): the student's own active account
-- and each active linked parent, minus anyone who turned the switch off, and only while the
-- student can open the work (active student, active class, enrolled, published).
create function private.work_returned_recipients(target_assignment uuid, target_student uuid)
returns table (profile_id uuid, recipient_role text)
language sql stable security definer set search_path = '' as $$
  select p.id, 'student'
  from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.id = target_student and s.is_active
    and p.is_active and p.status = 'active' and p.role = 'student'
    and private.assignment_visible_to(target_student, target_assignment)
    and coalesce((select ns.work_returned from public.notification_settings ns where ns.profile_id = p.id), true)
  union
  select p.id, 'parent'
  from public.student_guardians g
  join public.students s on s.id = g.student_id
  join public.profiles p on p.id = g.parent_id
  where g.student_id = target_student and s.is_active
    and p.is_active and p.status = 'active' and p.role = 'parent'
    and private.assignment_visible_to(target_student, target_assignment)
    and coalesce((select ns.work_returned from public.notification_settings ns where ns.profile_id = p.id), true)
$$;
```

**Step 5. The trigger (staff returns only)**

```sql
create function private.queue_work_returned_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.status = 'returned' then
    return null; -- already returned before this change
  end if;
  insert into public.email_outbox (kind, assignment_id, student_id, recipient_id, recipient_role)
  select 'work_returned', new.assignment_id, new.student_id, r.profile_id, r.recipient_role
  from private.work_returned_recipients(new.assignment_id, new.student_id) r
  on conflict on constraint email_outbox_once do nothing;
  return null;
end;
$$;

-- marked_by is null on the automatic return of all-MCQ work (check_assignment_result), so those
-- send nothing (02 item 3, "Staff returns only").
create trigger assignment_results_queue_email
  after insert or update of status on public.assignment_results
  for each row
  when (new.status = 'returned' and new.marked_by is not null)
  execute function private.queue_work_returned_email();
```

The insert runs in the tutor's transaction, so a rolled-back return queues nothing (AC-3.7
atomicity). It isn't wrapped in an exception handler: the insert can only fail on a bug, and
hiding that would break AC-3.8's "visible to admins" intent. The pgTAP suite covers every path.

**Step 6. Worker RPCs (service role only)**

All three are complete contracts; `notify_record_result`'s body follows its comment rules
exactly.

```sql
-- Claims what the cap allows, oldest first. Skips rows whose recipient is no longer eligible and
-- fails rows with no address. One claim at a time (advisory lock), so the cap is exact.
create function public.notify_claim_emails()
returns table (
  id uuid, recipient_role text, email text, recipient_first_name text,
  child_first_name text, assignment_id uuid, student_id uuid,
  assignment_title text, class_name text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  room int;
begin
  perform pg_advisory_xact_lock(hashtext('email_outbox_claim'));

  update public.email_outbox o set status = 'skipped'
  where o.status = 'pending'
    and not exists (select 1 from private.work_returned_recipients(o.assignment_id, o.student_id) r
                    where r.profile_id = o.recipient_id);

  update public.email_outbox o set status = 'failed', reason = 'no_address'
  from public.profiles p
  where o.status = 'pending' and p.id = o.recipient_id and trim(p.email) = '';

  room := private.email_daily_cap() - private.emails_sent_last_day();
  if room <= 0 then
    return;
  end if;

  return query
  with claimed as (
    update public.email_outbox o
    set status = 'sending', claimed_at = now(), attempts = o.attempts + 1, reason = null
    where o.id in (select x.id from public.email_outbox x
                   where x.status = 'pending'
                   order by x.created_at
                   limit room
                   for update skip locked)
    returning o.*
  )
  select c.id, c.recipient_role, p.email,
         split_part(trim(p.full_name), ' ', 1), split_part(trim(s.full_name), ' ', 1),
         c.assignment_id, c.student_id, a.title, cl.name
  from claimed c
  join public.profiles p on p.id = c.recipient_id
  join public.students s on s.id = c.student_id
  join public.assignments a on a.id = c.assignment_id
  join public.classes cl on cl.id = a.class_id;
end;
$$;

-- One row's outcome, written straight after its send (review-2 round 2, finding 1b). Only a row
-- still 'sending' changes, so a reclaimed row can't be overwritten by a late worker.
-- Valid pairs (anything else raises 'invalid_input' and changes nothing):
--   'sent'   + null                                   → sent, sent_at = now(), reason null
--   'retry'  + 'rate_limited' | 'server_error' | 'network'
--                                                     → pending with that reason; at attempts = 3
--                                                       → failed, reason 'max_attempts'
--   'failed' + 'rejected'                             → failed, reason 'rejected'
create function public.notify_record_result(target uuid, outcome text, failure_reason text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not ((outcome = 'sent' and failure_reason is null)
       or (outcome = 'retry' and failure_reason in ('rate_limited', 'server_error', 'network'))
       or (outcome = 'failed' and failure_reason = 'rejected')) then
    raise exception 'invalid_input';
  end if;

  update public.email_outbox o
  set status = case
                 when outcome = 'sent' then 'sent'
                 when outcome = 'failed' or o.attempts >= 3 then 'failed'
                 else 'pending'
               end,
      reason = case
                 when outcome = 'sent' then null
                 when outcome = 'retry' and o.attempts >= 3 then 'max_attempts'
                 else failure_reason
               end,
      sent_at = case when outcome = 'sent' then now() end
  where o.id = target and o.status = 'sending';
end;
$$;

-- The worker has no usable transport or site URL: mark waiting rows so admins see "Set-up error".
-- No attempt is used up.
create function public.notify_flag_config_missing()
returns void language sql volatile security definer set search_path = '' as $$
  update public.email_outbox set reason = 'config_missing'
  where status = 'pending' and reason is distinct from 'config_missing'
$$;
```

**Step 7. Cron kick**

```sql
create function private.kick_email_worker()
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  worker_url text;
  worker_secret text;
begin
  -- Reclaim rows from a worker that died (10 min > the 150 s / 400 s function limit). The attempt
  -- stays counted; the third one ends as failed.
  update public.email_outbox
  set status = case when attempts >= 3 then 'failed' else 'pending' end,
      reason = case when attempts >= 3 then 'max_attempts' else reason end
  where status = 'sending' and claimed_at < now() - interval '10 minutes';

  if not exists (select 1 from public.email_outbox where status = 'pending') then return; end if;
  if private.emails_sent_last_day() >= private.email_daily_cap() then return; end if;

  select decrypted_secret into worker_url from vault.decrypted_secrets where name = 'notify_worker_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name = 'notify_worker_secret';
  if coalesce(worker_url, '') = '' or coalesce(worker_secret, '') = '' then
    return; -- rows wait; after ~2 h admins see "Not attempted" (02 risk 3)
  end if;

  perform net.http_post(
    url := worker_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', worker_secret),
    timeout_milliseconds := 10000);
end;
$$;

select cron.schedule('email-worker-kick', '*/5 * * * *', $$select private.kick_email_worker()$$);
select cron.schedule('cron-history-trim', '30 17 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
```

`cron.schedule(name, …)` replaces a job of the same name, so re-running is safe.

**Step 8. Admin list (AC-3.8)**

```sql
create function public.admin_email_problems(max_rows int default 100)
returns table (
  id uuid, created_at timestamptz, recipient_role text, assignment_title text,
  state text,  -- 'failed' | 'waiting'
  reason text) -- failed: the stored code; waiting: 'config_missing' | 'daily_limit' | 'retrying' | 'not_attempted'
language plpgsql stable security definer set search_path = '' as $$
declare
  cap_reached boolean := private.emails_sent_last_day() >= private.email_daily_cap();
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
    select o.id, o.created_at, o.recipient_role, a.title,
           case when o.status = 'failed' then 'failed' else 'waiting' end,
           case
             when o.status = 'failed' then o.reason
             when o.reason = 'config_missing' then 'config_missing' -- "Set-up error" (carry-over 5)
             when cap_reached then 'daily_limit'
             when o.attempts > 0 then 'retrying'
             else 'not_attempted'
           end
    from public.email_outbox o
    join public.assignments a on a.id = o.assignment_id
    where o.status = 'failed'
       or (o.status in ('pending', 'sending') and o.created_at < now() - interval '2 hours')
    order by o.created_at desc
    limit least(greatest(coalesce(max_rows, 100), 1), 500);
end;
$$;
```

No address, body or recipient name is returned (AC-3.8).

**Step 9. Grants**

```sql
revoke execute on function
  private.email_daily_cap(), private.emails_sent_last_day(),
  private.work_returned_recipients(uuid, uuid), private.queue_work_returned_email(),
  private.kick_email_worker()
from public, anon, authenticated;

revoke execute on function
  public.notify_claim_emails(), public.notify_record_result(uuid, text, text),
  public.notify_flag_config_missing(), public.admin_email_problems(int)
from public, anon, authenticated;

grant execute on function
  public.notify_claim_emails(), public.notify_record_result(uuid, text, text),
  public.notify_flag_config_missing()
to service_role;

grant execute on function public.admin_email_problems(int) to authenticated;
```

### 3.3 Status machine

```
pending ──claim──▶ sending ──record 'sent'──▶ sent
   ▲                 │ record 'retry' (attempts < 3)
   └─────────────────┤ reclaim after 10 min (attempts < 3)
                     ├ record 'retry' at attempts 3 / reclaim at 3 ─▶ failed (max_attempts)
                     └ record 'failed' (rejected …) ─▶ failed
pending ──claim finds recipient ineligible──▶ skipped (not shown to admins)
pending ──claim finds empty address──▶ failed (no_address)
pending + reason config_missing: still pending; shown as Waiting / "Set-up error" after 2 h
```

### 3.4 Edge function `notifications`

**3.4.1 Contract**

- `verify_jwt = false`; called only by `pg_net` from the cron kick (no browser, no CORS).
- **Request:** `POST`, header `x-notify-secret: <NOTIFY_WORKER_SECRET>`, body `{}`.
- **Env:** `NOTIFY_WORKER_SECRET`, `EMAIL_TRANSPORT` (`resend` | `mailpit`), `RESEND_API_KEY`
  (resend), `MAILPIT_URL` (mailpit), `SITE_URL`, plus built-in `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` (via `_shared/clients.ts` `serviceClient()`).

| Status | Body | When |
|---|---|---|
| 200 | `{ ok: true, data: { claimed, sent, retrying, failed } }` | Ran (all zero if nothing was claimable) |
| 401 | `{ ok: false, code: 'not_allowed' }` | Secret header missing or wrong, **or `NOTIFY_WORKER_SECRET` unset/empty** |
| 405 | `{ ok: false, code: 'method_not_allowed' }` | Not POST |
| 503 | `{ ok: false, code: 'config_missing' }` | `pickTransport()` returned null or `SITE_URL` empty; calls `notify_flag_config_missing` first; claims nothing |
| 500 | `{ ok: false, code: 'server_error' }` | Thrown error (logged `notifications failed`, error name) |

Secret check: encode both strings with `TextEncoder`; unequal lengths → refuse; else compare with
`timingSafeEqual` from `node:crypto` (Deno supports it).

**3.4.2 Loop (`index.ts`)**

1. Method, secret, transport, `SITE_URL` checks as above.
2. `rows = await service.rpc('notify_claim_emails')`.
3. For each row, **sequentially**, with a 600 ms gap between sends (Resend's default API limit is
   2 requests/second; 70 × 0.6 s ≈ 42 s, inside the 150 s Free limit):
   `message = renderWorkReturned(row, siteUrl)` →
   `outcome = await sendEmail(transport, message, row.id)` →
   `await service.rpc('notify_record_result', { target: row.id, outcome: outcome.outcome, failure_reason: outcome.reason ?? null })`.
   Each row is recorded before the next send (finding 1b).
   **On a `rate_limited` outcome, stop the batch:** record that row as `retry`, then release the
   rest of the claimed rows unsent with `retry` / `rate_limited` too. They go back to `pending`
   (one attempt each, as for any retry). The next 5-minute kick picks them up. This stops one
   busy minute at Resend from hitting every row in the batch (review-3 finding 9).
4. Log only counts and HTTP statuses.

**3.4.3 `transport.ts`**

```ts
export type EmailMessage = { to: string; subject: string; html: string; text: string };
export type ReasonCode = 'rejected' | 'rate_limited' | 'server_error' | 'network';
export type SendOutcome = { outcome: 'sent' } | { outcome: 'retry' | 'failed'; reason: ReasonCode };
export type Transport =
  | { kind: 'resend'; apiKey: string }
  | { kind: 'mailpit'; baseUrl: string };

/** null unless EMAIL_TRANSPORT is exactly 'resend' (with RESEND_API_KEY) or 'mailpit' (with MAILPIT_URL). */
export function pickTransport(env: (name: string) => string | undefined): Transport | null;

/** POST https://api.resend.com/emails with Authorization: Bearer <key>, Idempotency-Key: <outboxId>. */
export function resendRequest(message: EmailMessage, outboxId: string, apiKey: string): { url: string; init: RequestInit };

/** POST {MAILPIT_URL}/api/v1/send, same message, header Idempotency-Key echoed for tests. */
export function mailpitRequest(message: EmailMessage, outboxId: string, baseUrl: string): { url: string; init: RequestInit };

/** 2xx → sent; 429 → retry rate_limited; 409 or 5xx → retry server_error; other 4xx → failed rejected. */
export function outcomeForStatus(status: number): SendOutcome;

/** True only for a rate_limited outcome: the worker then stops the batch (§3.4.2). */
export function shouldStopBatch(outcome: SendOutcome): boolean;

/** fetch with a 10 s timeout; a thrown fetch → retry network. */
export async function sendEmail(transport: Transport, message: EmailMessage, outboxId: string): Promise<SendOutcome>;
```

Resend body: `{ from: COPY.from, to: [message.to], reply_to: COPY.replyTo, subject, html, text }`.
Mailpit body: `{ From: { Email, Name }, To: [{ Email: message.to }], Subject, HTML, Text, Headers: { 'Idempotency-Key': outboxId } }`.

**3.4.4 Does the Mailpit path need an idempotency equivalent? No.** Mailpit has no
deduplication, and doesn't need one: it never relays, and every local recipient is a seed
account. At-most-once comes from three things that are the same on both paths: the unique key
on the outbox (no second row), the per-row `sent` write straight after each send, and the
`sending` guard in `notify_record_result`. Only the "worker died between send and record"
window depends on Resend's `Idempotency-Key`, and that header is proven by a unit test of
`resendRequest` (§3.10). The Mailpit request carries the same header so the end-to-end test can
check the worker passes the outbox id through.

**3.4.5 `template.ts` and `copy.ts`**

```ts
export type ClaimedRow = { id: string; recipient_role: 'student' | 'parent'; email: string;
  recipient_first_name: string; child_first_name: string; assignment_id: string;
  student_id: string; assignment_title: string; class_name: string };
export function renderWorkReturned(row: ClaimedRow, siteUrl: string): EmailMessage;
export function escapeHtml(text: string): string;
```

`copy.ts` (all wording; HTML styled like `supabase/templates/invite.html`, same colours, the
header label "Students" / "Parents"):

| Key | Student | Parent |
|---|---|---|
| `subject` | `Your work has been marked: ${title}` | `${child}'s work has been marked: ${title}` |
| `greeting` | `Hi ${first},` (or `Hi,` if empty) | same |
| `body` | `Your tutor has marked "${title}" for ${className} and returned it to you.` | `${child}'s tutor has marked "${title}" for ${className} and returned it.` |
| `button` | `View feedback` | `View feedback` |
| `footer` | `You're getting this because you have an AJ Classes portal account. To stop these emails, go to Account → Notifications: ${accountUrl}` | same |
| `from` / `replyTo` | `AJ Classes <hello@ajclasses.com.au>` / `hello@ajclasses.com.au` | |

Links (must match `apps/web/src/constants/routes.constants.ts`):
student `${siteUrl}/portal/student/assignments/${assignment_id}`; parent
`${siteUrl}/portal/parent/children/${student_id}/assignments/${assignment_id}`; account
`${siteUrl}/portal/account#notifications`. A signed-out person lands on sign-in and comes back
through the existing `next` rule (AC-3.4). **No mark, score or feedback text** (AC-3.3). Every
interpolated value is escaped in the HTML version.

### 3.5 Web

`services/types.ts`:

```ts
export type NotificationSettings = { workReturned: boolean };
export type EmailProblemState = 'failed' | 'waiting';
export type EmailProblemReason = 'rejected' | 'rate_limited' | 'server_error' | 'network' | 'no_address'
  | 'max_attempts' | 'config_missing' | 'daily_limit' | 'retrying' | 'not_attempted';
export type EmailProblem = { id: string; at: string; recipientRole: 'student' | 'parent';
  assignmentTitle: string; state: EmailProblemState; reason: EmailProblemReason };
```

`services/notifications.service.ts`:

```ts
export async function getMyNotificationSettings(): Promise<Result<NotificationSettings>>;
// session user id → from('notification_settings').select('work_returned').eq('profile_id', me).maybeSingle();
// no row → { workReturned: true }
export async function saveMyNotificationSettings(settings: NotificationSettings): Promise<Result>;
// Update, then insert, as saveResult does (assignments.service.ts:215-240). No upsert: PostgREST's
// ON CONFLICT DO UPDATE sets every payload column, and profile_id has no UPDATE grant (review-3 finding 2).
//   1. update({ work_returned }).eq('profile_id', me).select('profile_id').maybeSingle()
//      → error: fail(toErrorKey(error)); a row: succeed()
//   2. no row: insert({ profile_id: me, work_returned }).select('profile_id').maybeSingle()
//      → error: fail(toErrorKey(error)); no row: fail('notSaved'); else succeed()
export async function listEmailProblems(maxRows = 100): Promise<Result<EmailProblem[]>>;
// rpc('admin_email_problems', { max_rows })
```

`account.tsx`: `clientLoader` adds `getMyNotificationSettings()` to its `Promise.all`.
`NotificationsSection` renders for `role === 'student' || role === 'parent'`, after
`ChoicesSection`, as `<section id="notifications" aria-labelledby=…>` with a heading, intro, an
MUI `Switch` labelled `workReturned`, Save, `FormStatus` `saved` on success, `FormAlert` on
error. Same structure as `ChoicesSection`.

`admin-emails.tsx`: same shape as `admin-activity.tsx` (`clientLoader` → `listEmailProblems()`,
`LoadError`, `PageHeader`, MUI table, keys `problem.id`). Columns: When, Recipient (Student /
Parent), Assignment, State (chip: Failed = error, Waiting = warning), Reason. Empty row:
`EMAILS_PAGE.empty`. `meta()` → `buildPortalMeta(PORTAL_SEO.adminEmails)`. Access: the admin
layout already guards it; errors fall to `portal-root`'s ErrorBoundary.

### 3.6 Config, secrets and deploy

`config.toml`:

```toml
# notifications (ADR-0004): called only by pg_cron through pg_net with a shared secret header,
# so the gateway doesn't check a token; the function checks the secret itself.
[functions.notifications]
verify_jwt = false

[edge_runtime.secrets]   # add to the existing block
# LOCAL ONLY: emails go to the local Mailpit, never out. `supabase secrets set` copies these to the
# hosted project, so scripts/deploy.sh overrides EMAIL_TRANSPORT, SITE_URL and the secret, and
# unsets MAILPIT_URL. deploy.sh refuses to run with this secret value.
NOTIFY_WORKER_SECRET = "local-notify-secret"
EMAIL_TRANSPORT = "mailpit"
MAILPIT_URL = "http://supabase_inbucket_aj_classes:8025"
SITE_URL = "http://localhost:5173"
```

`seed.sql` (local only, after the accounts):

```sql
select vault.create_secret('http://supabase_kong_aj_classes:8000/functions/v1/notifications', 'notify_worker_url');
select vault.create_secret('local-notify-secret', 'notify_worker_secret');
```

`[ASSUMPTION]` Containers on the CLI's Docker network reach each other by container name
(`supabase_kong_aj_classes:8000`, `supabase_inbucket_aj_classes:8025`). The Developer confirms
with `select net.http_get('http://supabase_kong_aj_classes:8000/functions/v1/notifications')`
and a Mailpit send. Fallback: `host.docker.internal:55321` / `:55324`, as `fake-zoho` uses.

`deploy.sh`:
1. Usage comment and `require NOTIFY_WORKER_SECRET "a long random value; also goes into Vault (README)"`.
   Then `[[ "$NOTIFY_WORKER_SECRET" == "local-notify-secret" ]] && fail "…use a real secret"`.
2. Append `notifications` to `FUNCTIONS` (only its own name; §0.1).
3. Step 6/6 (function settings) becomes, in this order (review-3 finding 4):
   1. **One** `supabase secrets set` carrying every hosted value: the existing
      `ALLOWED_ORIGINS` and Zoho values, plus `EMAIL_TRANSPORT=resend`,
      `SITE_URL=https://ajclasses.com.au`, `NOTIFY_WORKER_SECRET=…`, `RESEND_API_KEY=…`. (The CLI
      also copies `[edge_runtime.secrets]` from `config.toml` on this call; the explicit values
      are on the same call.)
   2. **Then, last of all,** the single `supabase secrets unset` of `local_only`, with
      `MAILPIT_URL` added to that list next to the Zoho fakes. No `secrets set` runs after it, so
      nothing copies the local values back.
   3. **Check** (skipped under `--dry-run`, because `run` only prints there):
      `supabase secrets list --project-ref "$PROJECT_REF" -o json`. Compute expected digests with
      `printf %s <value> | shasum -a 256 | cut -d' ' -f1`. Fail the script if:
      - any `local_only` name is still listed;
      - `NOTIFY_WORKER_SECRET`'s digest equals the digest of `local-notify-secret`;
      - `EMAIL_TRANSPORT` is missing, or its digest isn't the digest of `resend`;
      - `SITE_URL` is missing, or its digest isn't the digest of `https://ajclasses.com.au`.

      This catches the case where the `config.toml` copy beats an explicit value on the same
      call (review-3 R2-3). **Release step: confirm on the first real run that
      `secrets list -o json` gives SHA-256 hex digests.** If the format differs, adjust the
      comparison before relying on it.
4. Print the Vault step for Saurabh (run once in Dashboard → SQL Editor; the secret from his
   password manager, never pasted into chat or git):
   ```sql
   select vault.create_secret('https://unzjnxctkyahtmrkinyr.supabase.co/functions/v1/notifications', 'notify_worker_url');
   select vault.create_secret('<NOTIFY_WORKER_SECRET>', 'notify_worker_secret');
   ```

**Kill switch** (README runbook): `select cron.unschedule('email-worker-kick');` stops all sends
at once; rows wait. Re-enable with the `cron.schedule` line from the migration. Or unset
`EMAIL_TRANSPORT`: rows then show as Waiting / "Set-up error".

### 3.7 AC-3.11 release check (Saurabh, hosted)

README runbook: an admin creates "Test Family" (student "Test Student" with Saurabh's alias
address, parent with a second alias), enrols them in a test class, a test tutor returns one
paper assignment, wait ≤ 5 min, both emails arrive, then check `/portal/admin/emails` is empty.
Delete the test class afterwards. No real family is in that class, so nobody else is emailed.

### 3.8 Constants (`portal.constants.ts`)

| Key | Text |
|---|---|
| `PORTAL_SEO.adminEmails` | `Emails` |
| `ADMIN_DASHBOARD.shortcuts.emails` | `Emails` |
| `ACCOUNT_PAGE.notifications.heading` | `Notifications` |
| `.intro` | `Emails we send about schoolwork.` |
| `.workReturned` | `Email me when work is marked and returned` (AC-3.6) |
| `.save` / `.saving` / `.saved` | `Save` / `Saving…` / `Saved. We'll remember this choice.` |
| `EMAILS_PAGE.heading` / `.intro` | `Emails` / `"Work returned" emails that failed, or haven't gone out about 2 hours after the work was returned. Sent emails aren't listed.` |
| `.columns` | `When`, `Recipient`, `Assignment`, `State`, `Reason` |
| `.roles` | `student: 'Student'`, `parent: 'Parent'` |
| `.states` | `failed: 'Failed'`, `waiting: 'Waiting'` |
| `.reasons` | `rejected: 'Rejected by email service'`, `rate_limited: 'Email service busy'`, `server_error: 'Email service error'`, `network: "Couldn't reach email service"`, `no_address: 'Recipient address missing'`, `max_attempts: 'Gave up after 3 tries'`, `config_missing: 'Set-up error'`, `daily_limit: 'Daily limit'`, `retrying: 'Retrying'`, `not_attempted: 'Not attempted'` |
| `.empty` | `No failed or waiting emails` (AC-3.8) |

`PRIVACY` draft sentence: "When your child's work is marked and returned, we email you and your
child (if they have their own account). These are service emails; you can turn them off in
Account → Notifications." `[TBC: B17 – Saurabh]`

### 3.9 Data lifecycle

- Stored: one outbox row per recipient per student per assignment, with no address or body.
  Deleted with the assignment, student or recipient (cascade).
- Visible: admins only, through `admin_email_problems` (failed and old waiting rows).
- Switch: own row only; deleted with the profile.
- Not audited: an email send isn't a permission or consent change. `[ASSUMPTION]`

### 3.10 Test approach per AC

`email_outbox.test.sql` uses the family fixtures (admin aal2, tutors, kid1 with student account
and parent1 + parent2, kid2 roster-only, an invited student, **a deactivated student account**,
a deactivated parent). It starts with `delete from public.email_outbox` (the seed's returned
work queues rows on `db reset`). Staff returns are made as the tutor (`tests.authenticate_as`)
so `marked_by` is set.

- **Cap tests** don't insert 70 rows: inside the test transaction,
  `create or replace function private.email_daily_cap() … select 2` (rolled back with the test).
- **Vault:** the seed already creates `notify_worker_url` and `notify_worker_secret`, and names
  are unique. Tests that need other values `update vault.secrets set secret = … where name = …`
  (or `delete` them for the "no worker secret" cases); rolled back with the test.

`test-notifications.mjs` runs against the local stack and Mailpit (read with
`GET http://127.0.0.1:55324/api/v1/search?query=to:<addr>`), calling the worker directly with
the local secret instead of waiting for cron. Set-up and tear-down (review-3 finding 10 and
R2-1). The job is **paused, never removed**, so nothing has to be re-created and a missing job
doesn't make the script fail:
0. **At start, print the one-line recovery command** for an interrupted run:
   `docker exec supabase_db_aj_classes psql -U postgres -c "select cron.alter_job(jobid, active := true) from cron.job where jobname = 'email-worker-kick'"`
   (`pnpm db:reset` also restores it; the README says so).
1. **Pause** through the `sql` helper:
   `select cron.alter_job(jobid, active := false) from cron.job where jobname = 'email-worker-kick'`
   (pg_cron 1.6.4 has `alter_job(…, active)`). No SQL passed through the shell helper may
   contain `$$`: the helper wraps the query in double quotes for `/bin/sh`, which expands `$$`
   to its process id.
2. Drain what the seed queued (the tutor's return of Aarav's "patterns" work queues the student
   and the parent on every `db reset`): call the worker once, then
   `DELETE /api/v1/messages`.
3. Run the checks, returning the seeded waiting-for-marking written work (`v_word` in
   `seed.sql`).
4. **Resume** with the same statement and `active := true`:
   - in a `finally` around steps 2–3;
   - in a `process.on('SIGINT')` / `process.on('SIGTERM')` handler, which resumes and then exits
     with code 130 / 143 (Ctrl-C skips a `finally`).
5. `check()` that `select active from cron.job where jobname = 'email-worker-kick'` is `t`.
6. `finish()` (the existing helper) sets `process.exitCode`; it never calls `process.exit`, so
   the `finally` runs on normal failures too. Only the signal handler exits directly.

| AC | How it's tested | Type |
|---|---|---|
| 3.1 | DB: tutor returns kid1's paper work → rows for kid1's account + parent1 + parent2; online (submitted → returned) → same; file hand-in (if item 2 is in) → same. Script: return Aarav's seeded "waiting for marking" written work (`v_word`) as `tutor@local.test` via REST, call the worker → Mailpit has one email to `student@local.test` and one to `parent@local.test` | DB + script |
| 3.2 | DB: kid2 (roster only), invited student, **deactivated student account** (no student row; parents still get theirs), no parent, deactivated parent, all switches off → each return succeeds (`lives_ok`) and adds 0 rows; `admin_email_problems` stays empty | DB |
| 3.3 | DB: `notify_claim_emails` returns no mark or feedback column, so the template has nothing to leak. Node unit (in the script): `renderWorkReturned` subject and body contain the child's first name, the title and the class, and "View feedback". Script: the Mailpit message (text and HTML) contains neither the seeded mark nor the tutor's comment text | DB + script |
| 3.4 | Node unit: the student link is `/portal/student/assignments/<id>`, the parent link `/portal/parent/children/<sid>/assignments/<id>`. Browser: open the Mailpit link signed out → sign in → lands on the page | Script + manual |
| 3.5 | DB: return, then (paper) returned → marked → returned again → still 1 row per recipient; an MCQ auto-return → 0 rows; tutor 2, admin, parent of another child → no rows. Script: calling the worker twice sends nothing the second time | DB + script |
| 3.6 | DB: missing row = on; kid1 inserts/updates own row; kid1 can't read or change parent1's (0 rows / 42501); tutor gets 0 rows on select and is refused insert. Browser: Account → Notifications shows for student and parent, not staff; Save shows "Saved…"; sign out/in keeps it. Node unit: the email footer links to `/portal/account#notifications` | DB + manual + script |
| 3.7 | DB: with the seeded `notify_worker_secret` deleted inside the test, the return succeeds and the kick does nothing (rows `pending`). Script: worker with `EMAIL_TRANSPORT` unusable is covered by `pickTransport` units (below); worker 401 with a wrong secret leaves rows pending. Browser: tutor returns work with the stack's functions stopped (`docker stop supabase_edge_runtime_aj_classes`) → no error shown | DB + script + manual |
| 3.8 | DB: `admin_email_problems` refused (42501) for tutor, student, parent and admin aal1; admin aal2 sees a `failed` row with its code and a 3-hour-old `pending` row as `waiting`, with `config_missing`, `daily_limit` (cap replaced by 2 in the test, 2 `sent` rows), `retrying` (attempts 1) and `not_attempted` each in turn; a 1-hour-old pending row isn't listed; `columns_are`-style check that no email/body column is returned; newest first. `email-problems.test.ts`: every reason has a label. Browser: empty state "No failed or waiting emails" | DB + unit + manual |
| 3.9 | Script: Mailpit message `From` is `hello@ajclasses.com.au`; HTML has the header block and brand colours. Code review: all wording in `copy.ts` | Script + review |
| 3.10 | DB: own-switch rules as 3.6; a tutor of another class updating kid1's result changes 0 rows and queues nothing; `authenticated` has no `execute` on `notify_*` (`function_privs_are` / `throws_ok` 42501) | DB |
| 3.11 | Local: everything above runs on the local stack with Mailpit. Node unit: `pickTransport` returns null for `EMAIL_TRANSPORT` unset, `''`, `'smtp'`, `'Resend'`, and for `resend` without `RESEND_API_KEY`. Hosted: §3.7, Saurabh | Script + release step |
| Claim-time skip (choice 7) | DB: queue a row, then turn that recipient's switch off → `notify_claim_emails()` doesn't return it and it ends `skipped`; queue a row, then deactivate the recipient → same. Neither appears in `admin_email_problems` | DB |
| Cap and reclaim (carry-over 1) | DB (cap replaced by 2 in the test): with 1 `sent` + 1 `sending` (claimed 1 min ago) in 24 h, `notify_claim_emails()` returns 0 rows; with 1 `sent` it returns 1; a 25-hour-old `sent` row doesn't count; `kick_email_worker()` with a `sending` row claimed 11 min ago → `pending`, attempts kept; at attempts 3 → `failed` / `max_attempts`; `notify_record_result` on a row no longer `sending` changes nothing; invalid pairs (`sent` + a reason, `retry` + `rejected`, `failed` + `network`, unknown outcome) → `invalid_input`; kick with pending rows and the seeded Vault secrets (values updated inside the test transaction) adds 1 row to `net.http_request_queue` carrying `x-notify-secret`; no pending → 0; cap reached → 0. Node unit: `shouldStopBatch(outcome)` (pure, in `transport.ts`) is true only for `rate_limited`. Node unit: `resendRequest(msg, id, key).init.headers` has `Idempotency-Key: id` and `Authorization: Bearer key`; `outcomeForStatus` 200/429/409/500/422. Script: the Mailpit message's `Idempotency-Key` header equals the outbox row id; each row is `sent` | DB + script |

The "Node unit" checks live at the top of `test-notifications.mjs` and import the function
modules directly: `import { pickTransport, resendRequest, outcomeForStatus } from
'../functions/notifications/transport.ts'` (Node 24 strips the types; the modules use only
`import type` and relative `.ts` imports, with no Deno global at import time). Deno isn't
installed locally, so this is how the pure logic gets tested.

### 3.11 Rollback / forward notes

- Forward-only, additive. Instant stop without a migration: the kill switch in §3.6.
- Withdrawal migration: `cron.unschedule` both jobs, drop the trigger, the functions, the two
  tables. Leave `pg_cron` / `pg_net` installed (harmless, free).
- Re-running the migration locally (`pnpm db:reset`) is safe: `cron.schedule` replaces by name.

---

## 4. Design choices made here (`[ASSUMPTION]`)

1. **Families read files through `assignment_view`'s JSON** (02 §2.2 now points here) (`attachments`, `files`,
   `unfinishedUploads`) instead of the two list RPCs 02 named (`student_assignment_files`,
   `parent_child_assignment_files`). Same rules, one round trip, and `assignment_view` is being
   recreated anyway. The four write RPCs are as 02 named them.
2. **The file row id is the `{file_id}` in its storage path**, so register can't create a second
   row for one object and paths map 1:1 to rows.
3. **Objects can be deleted only when unregistered**; the remove RPCs delete the row first and
   return the path. A row never points at a missing object.
4. **The unregistered-object read rule includes managers for attachments**, so an admin can
   remove an attachment a tutor uploaded (Storage's `DELETE … RETURNING` needs SELECT).
5. **Tutor attachments use the same limits** as student files (5 files, 2 MB images after
   compression, 10 MB documents, 20 MB total).
6. **The overall mark on a file hand-in is optional at Return** (revised after review-3 finding
   12): AC-2.9 says the tutor "can enter" one, and paper homework works the same way. Not
   enforcing it needs no Product Owner sign-off and no AC change.
7. **The eligibility re-check runs in SQL inside `notify_claim_emails`** (rows become `skipped`),
   using the same `work_returned_recipients` function as the trigger, so both can never disagree.
   Recipients must still be able to open the work (active class, enrolled, published).
8. **A missing transport doesn't claim rows** (02's "Transport" paragraph now points here). The worker flags pending rows `config_missing`
   and returns 503, so no attempts are burnt while set-up is wrong.
9. **Resend throttle: 600 ms between sends** (Resend's default 2 requests/second), and a
   `rate_limited` reply stops the batch (§3.4.2).
10. **Sender `AJ Classes <hello@ajclasses.com.au>`**, matching the auth SMTP sender in
    `config.toml`.
11. **The cap number lives only in SQL** (`private.email_daily_cap()`); the worker gets its
    batch size from the claim, so there's nothing to mirror in TypeScript.
12. **No outbox audit entry**, and the trigger isn't wrapped in an exception handler (§3.2
    step 5).
13. **News link is first in the footer legal row** ("beside Resources" in 02); below the fold,
    so it's a free choice.
14. **One Privacy sentence per item.** Items 2 and 3's sentences go to the B17 wording review.
    Item 1's sentence is in the B1 question in `01-requirement.md` §2.2, so Saurabh approves it
    with the release (review-3 finding 12).
15. **Local container hostnames** for Kong and Mailpit (§3.6), with a fallback.
16. **pg_cron/pg_net enabled by the migration** on hosted (§3.2 step 1), with a dashboard
    fallback.

## 5. Where I disagree with the architecture

**No disagreement with any decision.** Two small deviations in detail, both inside the
architecture's intent and listed above so the Reviewer can check them:

1. Family file reads go through `assignment_view` instead of two new list RPCs (choice 1).
   Same access rules, fewer functions.
2. On a missing transport the worker doesn't claim and then release rows (02 item 3,
   "Transport"); it marks pending rows `config_missing` without claiming (choice 8). Same
   visible result (Waiting / "Set-up error"), without using up attempts.

## 6. Known limits (deferred, named)

- **Parallel uploads can exceed 5 stored objects** (review-3 finding 1, option (a)). A student
  who bypasses the browser and sends parallel requests can store more than 5 unregistered
  objects (≤ 10 MB each) in their folder. Only 5 can ever register, and those are all anyone
  else sees. The student sees the extras as unfinished uploads and can remove them before
  handing in; the Later sweep removes the rest. Security notes this in their sweep.
- Orphan sweep (unregistered objects older than a day; folders with no assignment row): Later
  bucket, as 02 says. Until then a **staff** orphan in an attachments folder is invisible and
  uses one of the 5 slots (students see and can remove theirs). Rare: the service removes the
  object whenever registration fails.
- A deleted student's files stay in Storage until the sweep (the rows cascade).
- An object uploaded in the instant between "Hand in" and its commit is left as an orphan the
  student can't remove (the folder is locked once submitted). Invisible; sweep covers it.

## 7. Questions only Saurabh can answer (none block the build)

1. `[TBC: Privacy Policy wording for items 1–3, batched as B17 – Saurabh]`
2. `[TBC: B3 Supabase Pro before item 2 is released – Saurabh]` (already in 01/02)
3. `[TBC: the item 3 release steps in §3.6 (secrets, Vault SQL) and the §3.7 test family – Saurabh]`

## 8. Self gap review (before handing to the Reviewer)

| Check | Result |
|---|---|
| Every AC 1.1–1.15, 2.1–2.16, 3.1–3.11 has a locally runnable test | Yes (§1.6, §2.10, §3.10); hosted-only parts are named release steps |
| Every new table: RLS on, `revoke all`, minimal grants | `assignment_files`, `notification_settings`, `email_outbox` |
| Every new function: `search_path = ''`, revoke from `public, anon`, explicit grants | §2.2 step 12, §3.2 step 9 |
| Family functions' signature change: drop + recreate + re-grant | §2.2 step 11 (both revoke and grant re-run) |
| No public URL for student work; links short-lived; download only | Private bucket, 60 s signed URLs with `download`, URL never rendered |
| Upload cap | Soft cap on objects (sequential), hard cap on registered files; parallel case is a known limit (§6); script tests both |
| No real family emailed in tests | §0.3 |
| Item independence | §0.1, including the migration-order rule |
| Public pages load no supabase-js / MUI | §1.6 bundle check, re-run in item 2 |
