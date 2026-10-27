APPROVED

# Review 5 — item 5 diff

**Scope:** `develop...HEAD`, the 5 app commits, checked against 01b item 5, ADR-0005, 03b §5 and the dev notes.

**Ran:** 54 files / 457 tests pass, lint clean, hosting tests 23 pass.

**Verdict:** the code matches 03b §5.1–§5.6.

## The policy and headers

- Both files carry the same policy.
- `connect-src` is limited to self, the hosted Supabase origin, Web3Forms and Kit (`app.constants.ts:70,78`). The frame, base, object and form directives are set, and there are no wildcards.
- The Vercel lookahead excludes the `/portal` paths and the fallback.
- Railway uses last-wins: in serve-handler 6.1.7 the fallback gets only the portal CSP.
- The 404 page gets the public CSP.

## Docs

- The PRP annotations are present, and the anchor resolves (AC-5.9).
- `arch.md` covers AC-5.10.
- D1–D6 are reasonable.

## Findings (none blocking)

Fix 1–3 before item 6 relies on these tools.

1. **Minor:** `check-hosted-ref.ts:24-29` passes on an empty folder. Report the number of files scanned, exit 1 when it is 0, and share the check with `serve-mirror.ts:416`.
2. **Minor:** `hosted-ref.ts:127-140` reads only an allow-list of file types, so it skips `.css`, `.svg`, `.xml`, `.webmanifest` and `.data`. Read everything except known binary types, and record this as D7.
3. **Minor:** no test ties the CSP hosts to `APP_CONFIG`'s Web3Forms and Kit origins. Add one.
4. **Nit:** `script-src`, `style-src`, `img-src`, `font-src` and `frame-src` aren't pinned. Pin the public policy as a literal.
5. **Nit:** in `serve-mirror.ts:437-447`, use `code ?? 1` and add a `child.on('error')` handler.
6. **Nit (pre-existing, needs an ADR note):** `/__spa-fallback` has no CSP on Vercel. This is a follow-up.
7. **Nit:** the scripts need Node 22.18 or later. Consider bumping `engines`.

Still to verify on the preview and live: the Vercel lookahead, and analytics under the CSP.
