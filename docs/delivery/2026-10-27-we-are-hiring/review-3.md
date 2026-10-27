APPROVED

# Review 3: design (round 1)

**Anchors verified:**
- `index.ts:6`, `routes.constants.ts:14`, `routes.ts:19`/`:79`, `react-router.config.ts:14`, `sitemap.ts:12`
- `Footer.tsx:79-80`, `hosting-csp.test.ts:127`, `public-csp.spec.ts:28`, `lighthouserc.json:12`
- `posts.tsx:77-88`, `structured-data.ts:28-34`

**Supporting anchors:** `posts.constants.ts:19-23`, `theme.css:152`, `seo.ts:50`, `eslint.config.js:31`, `not-found.tsx:3`, `ci.yml:116-124`.

**Also checked:**
- `jsx-no-literals` is off for `src/constants/**`.
- The mailto output is exact.
- `check-lighthouse-report.ts` doesn't depend on the URL count.
- The content-guard regex has no false positive on the intended copy.
- Every AC has a real command.
- There's no PII.

## Blocking

None.

## Non-blocking

1. **§10 order:** a manual `mirror` clashes with lhci's own server on port 4173. Follow CI's order (`ci.yml:139-148`): `lighthouse` → `lighthouse:report` → `test:csp`. Start the mirror by hand only for the manual and curl checks.
2. **Error-boundary copy is duplicated from posts:** accepted, but the two copies can drift.
3. **AC-21:** prefer `grep -c 'name="robots"'` to `grep -c noindex`.

**Lead note:** 1 and 3 go into the Manager's brief and the test plan.
