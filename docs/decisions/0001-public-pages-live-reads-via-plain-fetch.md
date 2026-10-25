# ADR-0001: Public pages read live data with plain `fetch`; `/posts` is pre-rendered

- **Status:** Proposed (2026-10-25, Architect, `/deliver` pending-requirements Stage 2; becomes Accepted when the stage is approved)
- **Source:** `docs/delivery/2026-10-25-pending-requirements/02-architecture.md` item 1

## Context

`/posts` reads posts live through `supabase-js` in a `clientLoader`, and is neither pre-rendered
nor rewritten. On Vercel (static, `ssr: false`) a direct visit would 404. The header and footer
must show a News link only when posts exist, without loading `supabase-js` or MUI on public pages
(AC-1.12), and without layout shift (AC-1.8).

## Decision

1. `/posts` joins the `prerender` list. No rewrite is added to `vercel.json` or
   `serve.railway.json`.
2. The page loads its list in the component after mount (no `clientLoader`), so the pre-rendered
   HTML holds the real layout, `h1` and meta.
3. Public live reads go through plain `fetch` to PostgREST in `src/services/*.client.ts`, with the
   publishable key as `apikey`. This is the same pattern as `leads.client.ts`. `supabase-js`
   stays portal-only.
4. The News link is added after a memoised `hasPublishedPosts()` check. It's appended last in the
   header links (estimated CLS ≈ 0.003) and in the footer legal row. Fallback if it measures
   worse: first position in the right-aligned row (zero shift).

## Consequences

- Every public page view makes one small request to Supabase. A future public CSP must allow
  `connect-src` to the Supabase host. The Privacy Policy gets one sentence (B17).
- `/posts` is crawlable, and its headers match every other public page.
- Railway stays in step without edits.

## Alternatives rejected

- Rewrite to `/__spa-fallback`: no meta or `h1` in the HTML. On Railway it inherits the portal
  CSP, `noindex` and `no-store`.
- Build-time posts: need a rebuild per post.
- `supabase-js` for the check: about 50 KB on every public page.
