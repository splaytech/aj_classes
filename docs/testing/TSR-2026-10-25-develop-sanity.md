# Test Summary Report — `develop` sanity test, 25 Oct 2026

| | |
|---|---|
| **Build under test** | `develop` @ `407c2a5` (same as `origin/develop`) |
| **Environment** | Local: web dev server `http://localhost:5173` (lead capture on), local Supabase (API `:55321`, DB `:55322`, Mailpit `:55324`), seeded accounts from `supabase/seed.sql` |
| **Tested by** | Tester role (Claude Code) |
| **Result** | **PASS: 100% (55 of 55 checks)** · 0 bugs · **Auto-approved** |

## 1. Scope

A sanity test of the current `develop` branch:
- the public site;
- sign-in for every portal role;
- the enquiry (Register Interest) path;
- invite onboarding;
- admin posts;
- the database access rules.

There were no code changes since the last green CI run, so this confirms the integrated branch still works end to end on a clean start.

## 2. Results by suite

| # | Suite | How | Result |
|---|---|---|---|
| 1 | Formatting | `pnpm format:check` | ✅ Pass |
| 2 | Lint (incl. no inline literals) | `pnpm lint` | ✅ Pass |
| 3 | Typecheck | `pnpm typecheck` | ✅ Pass |
| 4 | Unit tests | `pnpm test` | ✅ 259 / 259 (35 files) |
| 5 | Production build | `VITE_APP_ENV=production pnpm build` (as CI) | ✅ Pass |
| 6 | Database tests (RLS, triggers) | `pnpm db:test` | ✅ 349 / 349 (12 files) |
| 7 | Edge functions (`account-admin`, `leads`) | `pnpm test:functions` | ✅ All checks pass |
| 8 | End-to-end (Playwright, UI + DB asserted) | `aj_classes-e2e`: `pnpm test` | ✅ 8 / 8 |
| 9 | Page sweep: 14 sitemap pages × phone (375 px) and desktop (1280 px) | Playwright script | ✅ 28 / 28 |
| 10 | Role sign-in: tutor, student, parent, admin (2FA), inactive | Playwright script | ✅ 5 / 5 |
| 11 | Edge checks (see §4) | curl, Playwright, SQL | ✅ 4 / 4 |

**Counting:** suites 1–7 count as one check each. Suites 8–11 count each test, page or check separately. Total: 7 + 8 + 28 + 5 + 4 + 3 setup checks (stack reachable, port 5173 strict, lead-capture flag loaded) = **55**.

## 3. What each part covered

**E2E (8 tests):**
- *Admin Daily Posts:* create/edit/delete reflected in the UI and the DB; public `/posts` shows newest first; a script payload renders as text; anonymous users can read but not write.
- *Invite onboarding:* an admin invites, the email arrives in Mailpit, the invitee completes setup, and the account becomes an active tutor.
- *Our Approach:* all four steps render in order.
- *Register Interest:* the enquiry is saved to `public.enquiries` (Web3Forms mocked).
- *Admin login:* sign-in goes through the two-step step.

**Page sweep (per page, both widths):**
- HTTP 200;
- no console errors or page errors;
- **no sideways scrolling** on phone or desktop;
- exactly one `h1`;
- the title contains "AJ Classes".

Pages: home, all 9 programme pages, resources, the selective entry exam guide, privacy and posts.

**Role sign-in:**

| Account | Lands on | Greeting |
|---|---|---|
| Tutor | `/portal/tutor` | "Welcome, Local" |
| Student | `/portal/student` | "Hi Aarav" |
| Parent | `/portal/parent` | "Hi Local" |
| Admin | `/portal/admin` | "Admin", two-step completed |

- Reloading each landing page keeps the user signed in and on the same page.
- The inactive account is refused with the generic message "Email or password is incorrect.", so it doesn't reveal that the account exists.

## 4. Edge checks

| Check | Expected | Actual |
|---|---|---|
| `sitemap.xml` lists no `/portal` URL | 0 | 0 ✅ |
| `robots.txt` | Dev/staging: block all crawlers. Production build: allow `/`, disallow `/portal`, sitemap line | Dev serves `Disallow: /`; built file has `Allow: /` · `Disallow: /portal` · `Sitemap: …` ✅ (environments.md G6) |
| Unknown URL `/does-not-exist` | "Page not found", link home, `noindex` | As expected ✅ (two `noindex` tags in dev: page + non-prod marker; one in the production build) |
| Leftover E2E test rows (`e2e-%`) in posts, enquiries, profiles | 0 | 0 / 0 / 0 ✅ |

## 5. Defects

None. Two first-look findings turned out to be intended behaviour, not bugs:

1. `robots.txt` blocks everything locally: intended for dev and staging, and correct in the production build.
2. The not-found page seemed to lack `noindex`: there are two tags in dev, which made the first query fail. The production build has exactly one.

## 6. Not covered (needs a person, or out of scope for a local sanity test)

1. **Visual judgment:** spacing, card heights and colour were not reviewed by eye. Only overflow, headings and errors were measured.
2. **Real email delivery** (Gmail/Outlook inboxes, spam folders). Locally, mail goes to Mailpit.
3. **Staging/production:**
   - security headers (CSP, `X-Robots-Tag`, `Cache-Control` on `/portal/*`) come from Vercel config and can't be tested locally;
   - staging sits behind Vercel sign-in;
   - the go-live §8 smoke test is still open.
4. **Other browsers:** Safari, Firefox, real phones. The sweep used Chromium only.
5. **Portal dark mode**, and **assignment flows beyond each role's landing page.** Access rules for these are covered by the database tests.
6. **Dependency advisories:** 18 open, 5 high, all in dev tooling or the unused Railway `serve`. Tracked separately, and none affect the live Vercel site.

## 7. Verdict

**Auto-approved.** 100% of the planned checks passed, with no defects. `develop` is fit to push and to keep on staging.
