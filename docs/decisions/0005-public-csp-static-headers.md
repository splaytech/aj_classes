# ADR-0005: Public pages send an enforcing CSP from static headers, with rules that never overlap the portal's

- **Status:** Accepted (2026-10-26, Architect, `/deliver` pending-requirements items 4–8, Stage 2; proposed and accepted the same day, when [review-2b](../delivery/2026-10-25-pending-requirements/review-2b-items-4-8.md) approved the stage, with its findings applied)
- **Source:** `docs/delivery/2026-10-25-pending-requirements/02b-architecture-items-4-8.md` item 5

## Context

Only `/portal/*` sends a `Content-Security-Policy` today. The public pages are pre-rendered static
HTML on Vercel (`ssr: false`). Each one carries about 7 inline scripts from React Router and React
streaming, and the module import differs per page and per build. The home page also has inline
`style` attributes. Public pages talk to only three hosts besides our own: Supabase, Web3Forms and
Kit.

Two more facts shape the decision:
- Vercel doesn't document what happens when two matching header rules set the same key.
- Local gates and CI must enforce the committed policy without ever building against, or calling,
  the hosted Supabase project.

## Decision

1. **The public policy:**
   - `default-src 'self'`;
   - `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline'`;
   - `img-src 'self' data:` and `font-src 'self'`;
   - `connect-src 'self' https://unzjnxctkyahtmrkinyr.supabase.co https://api.web3forms.com https://app.convertkit.com`;
   - `frame-src 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` and
     `frame-ancestors 'none'`.

   There are no wildcards. Inline `on*` handlers run, as a consequence of `'unsafe-inline'`.
2. **Why `'unsafe-inline'`:**
   - Nonces need a per-request server.
   - Hashes change every build, and static `vercel.json` can't carry them without moving to
     generated headers.

   The policy still blocks foreign scripts, exfiltration through fetch or images, off-site form
   posts, plugins, `<base>` hijacking and framing.
3. **The rules never overlap.**
   - In `vercel.json`, the public CSP goes on `source: "/((?!portal(?:/|$)|__spa-fallback).*)"`.
     The portal rule is unchanged.
   - In `serve.railway.json`, the public CSP goes on `**/*`, placed before the
     `__spa-fallback.html` rule. `serve` takes the last value for a key, so portal files get only
     the portal CSP.
4. **Local and CI mirror:**
   - A committed script builds the `serve` config from `serve.railway.json`. It drops Railway's
     global `X-Robots-Tag`, and replaces the hosted Supabase origin with the local one
     (`http://127.0.0.1:55321`). It fails if the hosted origin is missing.
   - A Vitest test asserts:
     - both files carry identical public and portal policies;
     - the hosted host is present and no local origin is;
     - every required directive is present;
     - the rule order and the lookahead are in place.
5. Gate builds use local Supabase or none, and are grepped for the hosted ref before serving. A
   local-Supabase gate build overrides the full set: the local URL, the local publishable key and
   Cloudflare's Turnstile test site key.

## Consequences

- Adding a third-party service means editing both header files on purpose (`arch.md` says so).
- Portal behaviour is unchanged. Its single CSP header is checked by `curl` locally, on the preview
  (Saurabh, behind Vercel's login) and on the live site.
- The lookahead `source` is the one unproven piece on real Vercel. The fallback is an explicit list
  of public paths. The live checks also `curl` the 404 page (`/nope`) for the public CSP.
- On Vercel previews, the injected `vercel.live` toolbar is blocked by the CSP. Those violations are
  expected, and that host is never added to the policy.
- Violation reporting, `upgrade-insecure-requests`, Trusted Types and removing `'unsafe-inline'`
  stay in the Later bucket. Removing `'unsafe-inline'` would most likely use the build-time meta
  CSP rejected below.

## Alternatives rejected

- Per-page hashes in headers, or nonces: not possible with static headers.
- A build-time `<meta http-equiv="Content-Security-Policy">` per page with that page's script
  hashes: rejected for v1. It needs a post-build step that rewrites every pre-rendered page in step
  with React Router's inline scripts, and a meta CSP can't carry `frame-ancestors`. It's the likely
  route for the Later hash-based `script-src`.
- Report-only first: AC-5.1 asks for an enforcing policy, and reporting needs Sentry (B14).
- One global rule with the portal rule "overriding" it: undocumented on Vercel, and the risk is
  breaking portal sign-in in production.
- A public policy that's a superset of the portal's: it would loosen public pages.
- Building gates with the committed `.env.production`: they would read prod data and could send
  real enquiries.
