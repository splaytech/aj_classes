# Review 6b: Security review, header "We're hiring" link

Reviewer, 30 Oct 2026. Reviewed `06-security.md` against 02, 03 and `git diff develop...HEAD` (7 files under `apps/web/src`).

## Verdict: APPROVED

1. XSS: correct — constants, text nodes, no `dangerouslySetInnerHTML`/`target`/`javascript:`; `isCurrentPage` only compares paths.
2. Open redirect: correct — fixed internal `ROUTES.careers`.
3. CSP and hosting: correct — no hosting/header files touched; no `url()`/`@import`; `/careers` already in `e2e/csp/public-csp.spec.ts:29`.
4. Data exposure of `/careers`: correct — no form, no requests; `mailto:` to the public address with an encoded subject; no analytics event.
5. The cited privacy fix is in place (`content.constants.ts:387`, `:417-422`).
6. Proportionate; the retention/MFA follow-on is correctly left to Saurabh.

Findings:
1. **Nit:** the doc opens with a bare `APPROVED` before its title; cosmetic only.
