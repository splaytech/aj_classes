APPROVED

# Security review — item 5

> **Stage:** 6b · **Date:** 26 Oct 2026 · **Branch:** `feature/public-csp`
> **Scope:** `git diff develop...HEAD -- . ':!docs/delivery'` (15 files, +573/−8).
> **Method:** code and config reading, plus read-only `curl -sI` against the live public website (Vercel, not Supabase). The hosted Supabase project, `.env*` and `.env.deploy` were not touched.

**Verdict:** nothing blocking. S1 is recommended for this item; the rest can come later.

## Held up

| Area | Evidence |
|---|---|
| User-controlled HTML | None. `/posts` renders React text nodes, and there's no `dangerouslySetInnerHTML` or `innerHTML` anywhere in `apps/web/src` |
| `'unsafe-inline'` scripts | Accepted in ADR-0005. Foreign script hosts, beacons, off-site form posts, plugins, `<base>` and framing are all still blocked; the AC-5.8 probe confirmed this |
| `img-src` / `frame-src` / `font-src` | `'self' data:` / `'none'` / `'self'`; no wildcards, and this is enforced by tests |
| `form-action` / `frame-ancestors` / `base-uri` / `object-src` | `'self'` / `'none'` / `'self'` / `'none'` |
| Global headers | HSTS preload, `nosniff`, `DENY` and `strict-origin-when-cross-origin` are unchanged and pinned |
| Can the public CSP weaken the portal's? | No. If two CSPs are sent, both are enforced, so the worst case is a portal outage, which the release `curl` check catches. Railway uses last-wins, and its rule order is pinned |
| Moving from a public page into the portal | The Sign in links are plain `<a href>`, so the portal always loads fresh with its own CSP |
| Could the mirror ship? | No. Its config goes to `tmpdir`, `build/` is gitignored, and Vercel's build never calls the mirror. A test fails on any local origin in the committed policies |
| Mirror process | `spawn` uses an argument array with no shell, and `checkBuild()` always runs |
| Dependencies / secrets | None added; secret grep found 0 |

## Findings

1. **S1: `/__spa-fallback` gets no CSP, no `noindex` and no `no-store` on Vercel.** Severity: Low–Medium. Recommended in this item.
   - **Evidence:** the live site returns `200` with only `x-frame-options` (read-only check). `/portal/login` gets the portal CSP, so Vercel matches header rules on the requested path.
   - **Risk:** the portal shell can be reached with no CSP at all.
   - **Fix:**
     - (a) Add a Vercel rule for `/__spa-fallback` with the identical portal CSP, `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.
     - (b) Update `hosting-config.test.ts` to expect `['/__spa-fallback', '/portal/:path*']`.
     - (c) Add a live `curl` of `/__spa-fallback` to the release checks: it should return exactly one portal CSP.
     - Optional: anchor the lookahead as `__spa-fallback$`.
2. **S2: `connect-src` allows two multi-tenant services that could carry data out (Web3Forms, Kit).** Severity: Low. Later.
   - **Fix:** narrow them by path, using `/submit` and the Kit form-specific path once B5 is done. The real fix is a hash-based `script-src`.
3. **S3: the mirror listens on every network interface.** Severity: Low.
   - **Fix:** use `-l tcp://127.0.0.1:${port}`.
4. **S4: the mirror's temp path is predictable.** Severity: Low.
   - **Fix:** use `mkdtempSync(join(tmpdir(),'aj-classes-mirror-'))`, then write `serve.json` with `{flag:'wx', mode:0o600}`.
5. **S5: the hosted-ref guard only checks an allow-list of file types.** Severity: Low.
   - **Fix:** scan every regular file except known binaries, using `buffer.includes(ref)`. Add a test that a ref inside `.css` or `.svg` is reported.
6. **S6: no `Permissions-Policy` header.** Severity: Low. Later, as its own item.
7. **S7: `replaceAll` treats `$` patterns in the replacement string specially.** Info.
   - **Fix:** pass a function: `replaceAll(HOSTED_SUPABASE_ORIGIN, () => localOrigin)`.

## Residual risks

1. `'unsafe-inline'` remains. The only defence is that no HTML comes from the DB, so a lint rule banning `dangerouslySetInnerHTML`/`innerHTML` is advised until hashes arrive.
2. Vercel's handling of the lookahead and of letter case is unproven. If it fails, it fails stricter. Covered by the preview check and the live `curl`.
3. `check:hosted-ref` isn't wired into CI. That's item 6.
4. Analytics under the CSP is proven live only.
5. `serve.railway.json` is now the mirror's source of truth. Rename it rather than deleting it if Railway goes.
6. Out of scope: `apps/web/.env.production` is tracked. Confirm it holds only publishable values (not opened here).
