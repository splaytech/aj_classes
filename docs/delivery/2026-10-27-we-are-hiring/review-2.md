CHANGES_REQUESTED

# Review 2: architecture (round 1)

**Verified:**
- The public CSP rule in `apps/web/vercel.json` covers `/careers`.
- `form-action 'self'` is set and there's no `navigate-to`, so a `mailto:` link needs no hosting change.
- `e2e/csp/public-csp.spec.ts` `PAGES` (lines 22-32) and the `hosting-csp.test.ts` path list (~line 127) exist.
- The prerender and sitemap claims are right, nothing irreversible is missed, and there's no PII.

## Blocking

1. **Constraint 8 is wrong: there is no root error boundary.** `root.tsx` exports only `Layout` and `App`, and `/privacy` has no boundary either. The only one is `routes/posts.tsx:77-88`. Without one, a render error shows React Router's default screen, and the repo rule "Error Boundaries on Routes" is broken. **Fix:** `routes/careers.tsx` exports its own `ErrorBoundary`, following `posts.tsx` (`SiteLayout`, a heading, short text and a home link, with the copy in constants).

## Non-blocking

2. **Constraint 2:** inline styles don't break the CSP (`style-src 'unsafe-inline'`). The ban comes from the repo rule `react/no-inline-styles`. External images, fonts and frames do break the CSP.
3. **Constraint 3:** adding `/careers` to the `hosting-csp.test.ts` list should be required ("add"), not optional ("may also add").

---

## Round 2

APPROVED

All three round 1 findings are fixed:
- Constraint 9 requires `careers.tsx` to export its own `ErrorBoundary`, following `posts.tsx:77-88`.
- Constraint 2 now gives the right reasons.
- Constraint 3 requires both test-list additions.

**Non-blocking:** constraint 2 still said `hosting-csp.test.ts` doesn't change, which clashed with constraint 3. **Lead note:** fixed in place. It now says "the policy in `vercel.json` and `serve.railway.json` doesn't change".
