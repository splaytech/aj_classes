APPROVED

# Security review: "We're hiring" link in the site header

> **Stage:** 6b · **Date:** 30 Oct 2026 · **Branch:** `feature/header-hiring-link`, diff `develop...HEAD` (code changes in 7 files under `apps/web/src`)
> **Method:** code, config and docs only. No builds or servers run, no Supabase or hosted projects touched, no `.env*` file opened.
> **Inputs:** `02-architecture.md`, `03-design.md`, the diff, `apps/web/src/routes/careers.tsx`, `careers.constants.ts`, the privacy copy in `content.constants.ts`, and `2026-10-27-we-are-hiring/06-security.md`.

## Summary

The change adds one hard-coded internal link. The header `<li><a>` (`Header.tsx:123-131`) points at `NAV.careersLink.href` (the constant `ROUTES.careers`), with text from `CAREERS.linkLabel`. No new network calls, no data collected, no dependency, hosting and CSP config untouched. **No blocking findings.**

## Findings

1. **Injection / XSS: none (Info).** `href` and text come from `as const` constants; React renders a text node. No `dangerouslySetInnerHTML`, `innerHTML`, `target`, `window.open` or `javascript:`. `aria-current` uses `isCurrentPage`, which only compares paths.
2. **Open redirect: none (Info).** Fixed internal path; no user input feeds the URL. Footer reads the same `NAV.careersLink.href` and a test checks it equals `ROUTES.careers` (`Footer.test.tsx:57`).
3. **CSP / hosting: no change (Info).** No change to `vercel.json`, `serve.railway.json`, `index.html` or headers. `/careers` already has the public policy and is in the CSP test lists. CSS change has no `url()`, imports or inline styles.
4. **Secrets / dependencies: none (Info).** No `package.json` or lockfile change; no keys or tokens.
5. **Data exposure from more traffic to /careers: none new (Info).** `/careers` has no form or edge function; applying is a `mailto:` built from `BUSINESS.email` with a fixed, encoded subject. The address was already public. The link sends no analytics event (AC-11).
6. **Earlier privacy finding now fixed (Info).** Finding 7 of the 27 Oct review (job-applications privacy section and retention) is covered at `content.constants.ts:387, 417-422`, including the WWCC/VIT exception and 12-month deletion of unsuccessful applications.

## Non-blocking

1. **Keep the retention promise (Low, process).** More applications will reach the inbox. Set a recurring reminder (or an inbox filter on the "Tutor application" subject) to delete unsuccessful applications after 12 months, and keep MFA on the `hello@` mailbox.
2. **If an application form is ever added (future).** It would need a data store/vendor decision, spam protection, file limits and a fresh privacy review. Not part of this change.

## Pending for Saurabh

- Nothing blocks this change.
- Non-blocking 1 is an operational step only he can take.
