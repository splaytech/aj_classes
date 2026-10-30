# 02 — Architecture impact: "We're hiring" page (web, `feature/we-are-hiring`)

Stage 2 of `/deliver`, Architect. Date: 2026-10-27. Input: [01-requirement.md](01-requirement.md), approved in [review-1.md](review-1.md) round 2.

## Recommendation: no meaningful architecture impact

`/careers` is one more pre-rendered static page, built the same way as `/privacy`. It uses the existing pieces: `SiteLayout`, `Section`, `buildPageMeta`, the constants files and the sitemap's `ALWAYS_LISTED`. The footer gets one more anchor in the legal row. Applying is a `mailto:` link to `BUSINESS.email`, and the footer and privacy page already use that pattern. Nothing changes in the runtime model: no server, no new data flow, no Supabase read or write, no new third-party origin, no new dependency and no hosting change. So there is no component boundary to redraw, no ADR is needed, and nothing here is irreversible or costly. Undoing it means removing one route, one prerender entry, one sitemap entry and one footer link.

## Constraints the design must respect

1. **Pre-rendering.** `ROUTES.careers` goes into `routes.constants.ts`, into a `route()` before `route('*')` in `src/routes.ts`, and into `prerender` in `react-router.config.ts`. The page must render fully at build time. That means no loader that touches Supabase, no browser-only APIs during render, and no live-data gate like the one News uses (ADR-0001 does not apply here).
2. **CSP stays unchanged (ADR-0005).** `vercel.json` matches `/careers` with the public rule (`/((?!portal…|__spa-fallback$).*)`), so the page gets the enforcing public CSP automatically. A `mailto:` anchor is a navigation, and CSP doesn't govern navigations (`form-action` only covers form submissions). So the policy in `vercel.json` and `serve.railway.json` doesn't change (only the test path lists gain `/careers`, constraint 3). The page must not load external images, fonts, frames or scripts, because those are what the policy blocks (`img-src 'self' data:`, `font-src 'self'`, `frame-src 'none'`). Inline `style=` attributes are allowed by the CSP (`style-src` has `'unsafe-inline'`). They are banned by the repo rule `react/no-inline-styles`, so use a CSS module (see constraint 8).
3. **CSP e2e coverage.** Add `/careers` to `PAGES` in `e2e/csp/public-csp.spec.ts`, so the enforcing policy is shown to hold on the new page with no violations. Also add `/careers` to the public-path list in `hosting-csp.test.ts` (line ~127), so the Vercel lookahead is shown to apply the public CSP to it. Both additions are required. Neither one touches the policy.
4. **Sitemap.** Add `ROUTES.careers` to `ALWAYS_LISTED` in `src/routes/sitemap.ts`, not to the Supabase-gated branch. `sitemap.test.ts` must check that it is listed both with and without Supabase (AC-20). `robots.ts` and the noindex rule outside production stay as they are.
5. **No applicant data stored.** Applications go from the applicant's own mail client to the existing hello@ inbox. The page doesn't call `enquiry.service`, Web3Forms, Supabase, Zoho or `trackEvent`, and it makes no network request beyond what `/privacy` makes (AC-25, AC-27).
6. **No new dependency, vendor or env var.** Build the mailto href from `BUSINESS.email`, with the subject run through `encodeURIComponent`. Copy lives in a constants file (no magic strings). Wording and email address are never repeated in a component.
7. **Public-repo PII rule.** Never put the owner's personal name, the street address or the ABN in code, copy, tests or docs. The only business facts allowed are the ones already in `business.constants.ts` (name, email, `suburbsText`, city, state). This is also why JobPosting structured data is out: Google expects an address. _(30 Oct 2026: the street address is now public and allowed; the owner's name and the ABN still never go in the repo.)_
8. **Repo rules.** The page component stays presentational (no HTTP). It needs no inline styles (`react/no-inline-styles`) and no `console.*`, and every `.map()` needs a stable `key`.
9. **Error boundary (rule `react/error-boundaries-on-routes`).** There is no root error boundary: `root.tsx` exports only `Layout` and `App`, and `/privacy` has none. So `routes/careers.tsx` must export its own `ErrorBoundary`, following `routes/posts.tsx` (lines 77-88). It renders `SiteLayout` with an h1 heading, a short text and a link back to `ROUTES.home`, so the visitor never sees a blank page. Its copy (`errorBoundary.heading`, `.text`, `.backHome`) lives in the careers constants, not inline.

## Alternatives considered

1. **Application form that feeds the leads pipeline (Web3Forms, Supabase `leads`, Zoho CRM).** Rejected. It would store applicants' personal data in our database and add job seekers to the parent sales pipeline, which needs a privacy-policy change. A CV upload would also need a new storage bucket with its own retention and RLS. That is a data-model and privacy decision for Saurabh, and it is already deferred as D4.
2. **Third-party job board or ATS (Seek, LinkedIn Jobs, Workable embed).** Rejected for v1. It adds a vendor, possibly a cost and an account to manage. An embed would need CSP changes (`frame-src` or `script-src` origins) under ADR-0005, and it would send applicant data to a third party. Linking out to a listing later is a copy-only change and needs no architecture work.
3. **A bare `mailto:` in the footer with no page.** Rejected. It gives no role information and no SEO landing page (A1).

## Irreversible or costly decisions

None. There is no data model, vendor, auth or hosting change. Path `/careers` is the only choice that gets awkward to change once it is indexed. If it ever moves, it would need a redirect, so it is worth confirming now (Q5 in the requirement).

## Decisions (for `_knowledge/decisions.md`)

1. **DEC-WH-1:** `/careers` is a static pre-rendered page with no data reads. It is listed in `ALWAYS_LISTED` in the sitemap. Applications go by `mailto:` to `BUSINESS.email` and nothing is stored. No ADR is needed. The public CSP (ADR-0005) and hosting config don't change, and `/careers` is added to the CSP e2e page list and to the path list in `hosting-csp.test.ts`. `routes/careers.tsx` exports its own `ErrorBoundary`, in the same pattern as `posts.tsx`.
