APPROVED

# Review 5: item 1 (News page), Developer stage

> **Stage:** Reviewer gate after stage 5 (Developer, item 1) · **Date:** 25 Oct 2026
> **Diff:** `git diff c4e9447..HEAD` (2b4057e..553cf27), 30 files.
> **Against:** 01-requirement.md AC-1.1 to AC-1.15, 03-design.md item 1, 04-plan.md T1.1 to T1.11,
> 05-dev-notes-item-1.md, the repo's CLAUDE.md and `apps/web/eslint.config.js`.

## Checks I ran

| Check | Result |
|---|---|
| `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` | Green. 41 files, 304 tests |
| `VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_APP_ENV=production pnpm build` (no database contact) | Builds. `sitemap.xml` has 0 `/posts`. `build/client/posts/index.html` has one `<h1>Latest news`, the loading line, the canonical link, and no `name="robots"` |
| Diff scan for `console.`, `TODO`, `style={{`, `dangerouslySetInnerHTML`, `innerHTML`, `querySelector`, `: any` | Only `container.querySelector('script')` in a test assertion |
| Files outside `apps/web` and `docs` | None. `vercel.json` and `serve.railway.json` are untouched |

## Findings

There are no blocking findings. The three minor ones below can be fixed now or left for a later change.

1. [minor] `apps/web/src/routes/sitemap.ts:25`. The sitemap and the client use different tests
   for "configured". The sitemap only checks `APP_CONFIG.supabase.url !== ''`.
   `public-posts.client.ts:16` (`isConfigured`) needs both the URL and the publishable key.
   - What breaks: a build with `VITE_SUPABASE_URL` set but `VITE_SUPABASE_PUBLISHABLE_KEY` empty.
     The sitemap lists `/posts`, but the page always shows the error line and the links never
     appear.
   - Fix: make the sitemap use the same rule. Either check both values in `loader()`, or export
     one `isPublicSupabaseConfigured()` from the client and use it in both places.
   - It's unlikely: `.env.production` sets both.
2. [minor] `apps/web/src/lib/use-has-news.ts`. No test calls the real hook. Header, Footer and
   posts tests all mock it.
   - The logic is small (start `false`, set on resolve, ignore after unmount), and the memo it
     depends on is tested in `public-posts.client.test.ts`.
   - Optional: add a 3-case `renderHook` test like `use-public-posts.test.ts` (true, false, and
     unmount before resolve).
3. [minor] `apps/web/src/test/setup.ts:19`. The global `afterEach(vi.unstubAllGlobals)` also
   removes any global a test file stubs at module scope or in `beforeAll`, after that file's first
   test.
   - No file does that today. `HeroSlideshow`, `enquiry.service` and `subscription.service` all
     stub in `beforeEach`.
   - Optional: add one line to the setup comment ("stub globals in beforeEach, not beforeAll") so
     the next person doesn't lose an hour on it.

## Risk areas asked about

- **`setup.ts` fetch stub.** It doesn't hide failures. It makes them louder. Any fetch a test
  didn't stub now rejects straight away instead of quietly calling the local database through
  `.env.local`. Code that catches the rejection behaves as it would offline, which is the same as
  before for any test that didn't run against a live stack.
  - A test file's own `vi.stubGlobal('fetch', …)` in `beforeEach` runs after the setup hook, so it
    wins.
  - `public-posts.client.test.ts` passes its own `fetcher`, or stubs the global itself for the
    memo test.
- **Shared post rows (2b4057e).** Pure move. `PostRow`, `POST_COLUMNS` and `toPost` are copied
  from the old file byte for byte. `MAX_ROWS` was renamed `POSTS_MAX_ROWS` with the same value
  (200).
  - `listPosts` is otherwise unchanged. Its only caller is `routes/portal/admin-posts.tsx:33`.
  - Admin behaviour is unchanged.
  - The public client imports `post-rows.ts`, not `posts.service.ts`, so it doesn't pull in
    supabase-js.
- **`/portal` headers.** Neither hosting file changed.
  - `hosting-config.test.ts` checks two things: no rewrite on either host matches `/posts`, and
    the CSP / `X-Robots-Tag` / `Cache-Control` rule exists only for `/portal/:path*` (Vercel) and
    `__spa-fallback.html` (Railway).
  - The matcher self-test (positive cases) means the negative checks are real, not trivially true.
  - Adding `/posts` to the prerender list only writes `posts/index.html`. The portal fallback is
    not affected.
- **XSS.** Title and body are rendered as React text children. There's no `dangerouslySetInnerHTML`
  or `innerHTML` anywhere in the diff.
  - `posts.test.tsx` renders a `<script>` title and body and asserts the text shows and no
    `script` element exists.
  - The developer's manual check with `<img onerror>` matches this.
- **Sitemap condition.** It's correct for the documented builds: verified above for the
  no-Supabase build, and in 05 §1 for the local-stack build. The edge case is finding 1.

## AC coverage

| AC | Covered by | Verdict |
|---|---|---|
| 1.1, 1.2 | `hosting-config.test.ts` (prerender list, no rewrite catches `/posts`) plus 05 §3.4 mirrors | Met (hosted check is B1) |
| 1.3 | `posts.test.tsx` one `h1` in all 4 states; my build check above; 05 §3.4 curl | Met |
| 1.4 | `hosting-config.test.ts`; my build check (no robots meta); 05 §3.4 headers and staging build | Met |
| 1.5 | 05 §3.4 (manual, both mirrors) | Met (manual only, as designed) |
| 1.6 | `posts.test.tsx` empty state and its links, "coming soon / check back" guard; Header/Footer tests with `false` | Met |
| 1.7 | Client tests: reject, 500, bad JSON, 5 s timeout; `use-public-posts.test.ts` maps `network` to `error`; page shows the error line and not the empty one | Met |
| 1.8 | `Header.test.tsx`: last of 6 items, `href`, `aria-current` only on `/posts`; 05 §3.1 widths; 05 §3.2 CLS 0.0041 | Met |
| 1.9 | `Footer.test.tsx` both branches | Met |
| 1.10 | Memo test (two callers, one fetch); `cache: 'no-store'`; 05 §3.4 delete/publish | Met |
| 1.11 | `sitemap.test.ts`; client "no fetch when unconfigured"; my no-Supabase build | Met |
| 1.12 | 05 §3.3 bundle script and network check. The new code imports no supabase-js | Met |
| 1.13 | `posts.test.sql` unchanged, `db:test` green (05 §2); tutor check (05 §3.4) | Met |
| 1.14 | Script-as-text is unit tested. The "inline message" part is existing admin behaviour (05 §5 item 3) | Script part met. **The Tester must decide on the inline-message wording**; this diff doesn't change it |
| 1.15 | Lint green; every new string is in `posts.constants.ts` / `content.constants.ts`; the path and timeout are in `APP_CONFIG` | Met |

The code follows the repo rules:
- HTTP happens only in `src/services/public-posts.client.ts`.
- There are no inline styles.
- The list keys are `post.id`.
- `posts.tsx` exports an `ErrorBoundary`, and it is tested.
- There's no `console.log`, no dead code, and no un-ticketed TODO.

The functions are small: `PostList`, `NoPosts` and `PostsContent` are each under 20 lines. The
comments explain why, not what.

## Rulings on the deviations

- **D1. Reuse the existing `PORTAL_ERRORS.notConfigured`.** Accept. A duplicate key can't exist,
  and visitors never see this text.
- **D2. Header CSS: also tighten the `.nav` and `.actions` gaps between 1024 and 1279 px.**
  Accept.
  - The breakpoint is unchanged.
  - It reuses the existing selectors (`.nav, .navOpen`, `.links`, `.actions`) inside one
    range query at the end of the file, so it correctly overrides the `min-width: 1024px` block.
  - It's backed by measurements: 12 px logo gap at 1024 px, the icon no longer squeezed, one row
    at every width tested.
  - Side effect: it applies with 5 links too (no news), so the bar is slightly tighter in that
    range. That's harmless, and simpler than a class that depends on whether there's news.
- **D3. `min-height` on `/posts`.** Accept. It is the smallest sensible fix.
  - Why: without it, CLS on `/posts` is 0.27 on a phone. That counts as "poor", on the one page
    that loads its content late.
  - Alternatives are worse:
    - Accept the CLS on an indexed page.
    - Reserve space only while loading. When the list turns out shorter, the footer jumps up,
      which is still a layout shift.
    - A fixed-height skeleton. More code, and it still has to guess the height.
  - The fix itself: it's one CSS rule built from existing tokens (`--header-height`,
    `--section-gap`, which is the `Section` padding). It puts the footer exactly at the fold.
  - Older browsers without `svh` ignore the rule, so the worst case is today's behaviour.
  - Trade-off: with 0 or 1 short post there's blank space above the footer (about 350 px at
    1280 x 720 when empty). At launch B1 makes sure at least one post exists, so the empty page is
    an edge case. Saurabh should look at it once at `/test-and-ship`. If he dislikes it, the
    fallback is to delete the `.page` rule and accept the CLS on `/posts` only. That's a 1-rule
    revert, not a redesign.
- **D4. Simulated database outage instead of `pnpm db:stop`.** Accept. The browser sees the same
  result. The Tester runs the literal `pnpm db:stop` leg.
- **D5. Additions outside the 21-file list.** Accept.
  - The `APP_CONFIG` entries keep magic values out of the code.
  - The `setup.ts` stub is the right default (see Risk areas).
  - `use-public-posts.test.ts` was asked for by review-4.
- **D6. Timeout test swaps `AbortSignal.timeout`.** Accept. Production code is unchanged. The test
  checks that the code asks for 5000 ms, and the replacement signal behaves the same way.

## For the next stages

1. Tester: run the literal `pnpm db:stop` leg (D4), and rule on AC-1.14's "inline message"
   (05 §5 item 3).
2. Saurabh, at `/test-and-ship`: look at the blank space on an empty or 1-post `/posts` (D3) and
   approve the Privacy sentence with B1.
3. Developer (optional, non-blocking): findings 1 to 3.
