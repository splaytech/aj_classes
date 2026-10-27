APPROVED

# Security review: we're hiring page

> **Stage:** 6b · **Date:** 27 Oct 2026 · **Branch:** `feature/we-are-hiring`, diff `289973f...HEAD` (7 commits, 17 files)
> **Method:** code and config reading only. No builds, servers, Supabase, hosted projects or `.env*`.

## Findings

1. **Mailto / header injection: none (Info).** The href (`careers.constants.ts:54-56`) is built from `BUSINESS.email` and a fixed subject passed through `encodeURIComponent`. There's no user input, so nothing can add `cc`, `bcc` or `body`. The exact href is pinned at `careers.test.tsx:46-49`.
2. **Open redirect / XSS: none (Info).**
   - The links at `careers.tsx:47,51,65` and the footer go to fixed routes. `ButtonLink` (`Button.tsx:42-48`) is a plain anchor.
   - There's no `dangerouslySetInnerHTML`, `target` or `window.open`.
3. **CSP still enforced (Info).**
   - `vercel.json:31-35` covers `/careers` with the public policy (`form-action 'self'`, `frame-ancestors 'none'`, `object-src 'none'`). So does `serve.railway.json:7,26`.
   - Neither file changed.
   - `/careers` is added to `hosting-csp.test.ts`, `e2e/csp/public-csp.spec.ts` and `lighthouserc.json`.
4. **No third-party requests, dependency or secret (Info).** No network calls and no `package.json` or lockfile change.
5. **No owner personal data (Info).** The diff was compared against the owner's private name, street address and ABN: 0 matches. The no-ABN guard is at `careers.test.tsx:78-80`.
6. **Applicant data isn't collected or stored by the site (Info).** Applications go through the visitor's own mail client to the existing inbox. Nothing goes through Web3Forms, Supabase, Zoho or analytics (DEC-WH-1).
7. **The privacy policy doesn't mention job applicants (Low, not blocking).**
   - `content.constants.ts:382-383` lists only interest, contact and subscriptions, and says "We don't ask for sensitive information."
   - Applicants will now email CVs and WWCC/VIT status. WWCC is close to criminal-record information, which is sensitive.
   - The business is likely exempt as a small business, and the staff-records exemption doesn't cover applicants. Even so, an out-of-date policy could be called misleading.
   - **Fix (copy, for Saurabh, under B17/Q7):** add a line such as "If you apply for a job, we collect the details and CV you email us and use them only to consider your application. We delete unsuccessful applications after 12 months." Also reword the "sensitive information" sentence.
8. **The page's usage promise needs a retention habit (Low, process).** `careers.constants.ts:36` says "We'll only use your details to consider your application."
   - Set a retention period and delete unsuccessful applications when it ends.
   - Don't forward CVs to the CRM.
   - Keep MFA on the inbox.

## Pending for Saurabh

Findings 7 and 8: the privacy-policy line and a retention period. These sit alongside 01 Q1–Q6 (copy sign-off).
