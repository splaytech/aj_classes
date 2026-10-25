# 01 — Requirement: deliver what is still pending across all releases

> **Stage:** 1 of /deliver (Product Owner) · **Date:** 25 Oct 2026 · **Branch:** `feature/pending-requirements`
> **Ask (Saurabh):** "checkout requirements in all of the release files and ignore the mobile app
> requirements but from remaining ones figure out what is pending and create a delivery plan and
> start delivering those one by one from the delivery plan"
> **Next stage:** Architect (feasibility and approach for build-queue items 1–3).

## How this was checked

- I read every release file: R1 (PRP plus 5 design notes), R1.1, R2 (PRP, completion-todo,
  go-live, leads-and-crm, whatsapp-button, owner-decisions-reminder, r2a stories, design and
  review), R3 (PRP, r3a, r3b), R4, R5 and R6. I also read the root briefs: dashboard-build-todo,
  family-portal-todo, invite-onboarding, blog and student-journey-assertive-statements.
- I checked each one against the code: `apps/web/src` (routes.ts, constants, services, routes),
  `apps/web/vercel.json`, `serve.railway.json`, `react-router.config.ts`, the `build/client`
  output, 11 migrations, the 2 edge functions, 12 pgTAP files and `.github/workflows/ci.yml`.
  I also checked the git log (`origin/main..origin/develop`), the TSR
  `docs/testing/TSR-2026-10-25-develop-sanity.md`, and the live site with `curl`
  (`ajclasses.com.au`: home, robots, sitemap, 404, www redirect).
- **Production lags develop by 19 commits.** `origin/main` was last merged on 24 Oct (PR #16).
  The admin daily posts (`69353a5`) and the assertive Approach statements (`414eff3`) exist on
  `develop` only.
- Mobile is out of scope: the Flutter app, push notifications, and design tokens that exist only
  to feed Flutter. The sibling repo `aj_classes_mobile` was not looked at.

Status key: **Done**, **Partial**, **Pending**, **Blocked (owner)**, **Out of scope**.
"Unverified" means I couldn't prove it from code or the live site.

---

## 1. Inventory

### Release 1: public site

| ID | Requirement | Status | Evidence / what's missing |
|---|---|---|---|
| R1-01 | F1 Theme as CSS variables, no hex colours elsewhere | Done | `src/styles/theme.css`; a grep found 0 hex colours in any other CSS file |
| R1-02 | F2 Landing page sections (hero and slideshow, why us, results, programmes, approach, about, CTA banner, FAQ, contact, footer) | Done | `src/sections/*`; live home page has exactly one `h1`; TSR page sweep 28/28 |
| R1-03 | F2.6 mobile sticky CTA, F2.11 announcement pill | Done | `components/layout/MobileCtaBar.tsx`; `APP_CONFIG.features.announcement = true` |
| R1-04 | F3 Enquiry form (simplified per design-refresh), Web3Forms, 4 states | Done | `sections/contact/ContactForm.tsx`, `services/web3forms.client.ts`; TSR E2E "Register Interest" |
| R1-05 | F3.6 Footer Subscribe via Kit (double opt-in, `/subscribed`) | **Blocked (owner)** | Code exists (`services/kit.client.ts`, `footer/SubscribeForm.tsx`) but is hidden until `VITE_KIT_FORM_ID` is set. It isn't in `.env.production`, and there is no subscribe form on the live home page |
| R1-06 | F3.7 Spam: hidden trap; Turnstile only if spam appears | Done (by decision) | `botcheck` honeypot. The `leads` function adds a rate limit (`leads/rate-limit.ts`) |
| R1-07 | F4 Privacy page | Done | `routes/privacy.tsx`, `PRIVACY` constants. Two open points are tracked elsewhere, not counted twice here: the missing staff-phone mention is **INV-05**, and the owner's wording review is **OD-03** |
| R1-08 | F4a VCE page | Done | `routes/vce.tsx`; `/programmes/vce` is in the live sitemap |
| R1-09 | F4b Programme pages ×9 | Done | `routes/programme.tsx`, `programmes.constants.ts`; all 9 are in the live sitemap |
| R1-10 | F4c Environment markers | Done | `EnvironmentMarker.tsx`, `lib/environment.test.ts` |
| R1-11 | F4d UI polish (results, approach, menu, badge) | Done | `sections/ui-polish.test.tsx` |
| R1-12 | F5 Hosting, domain, HTTPS, security headers, canonical host | Done | `vercel.json` headers; `www` returns 308 to the apex (curl) |
| R1-13 | F6.1 Pre-rendered HTML | Done | `react-router.config.ts` prerender list; live HTML has the body copy and JSON-LD |
| R1-14 | F6.3 Full head-tag set | Partial | Present: canonical, OG, Twitter, manifest, apple-touch-icon. **Never built:** `hreflang` and `geo.*` (`git log -S hreflang` finds only the first commit). Search Console verification meta is absent (may be done by DNS TXT: unverified). Includes the R1 launch-checklist line "every F6.3 tag present in production HTML" (`release-1/PRP.md` §6) |
| R1-15 | F6.4 JSON-LD from constants | Done | Live `@graph`. `sameAs` = Facebook + WhatsApp only; Instagram and YouTube are `null` in `SOCIAL_LINKS` (content, see R1-21) |
| R1-16 | F6.5 robots, sitemap, real 404, noindex outside production | Done | Live `robots.txt` disallows `/portal`; `/nope` returns 404 |
| R1-17 | F6.7 Search Console, Bing, Google Business Profile, citations | **Blocked (owner)**, unverified | Owner actions; nothing in the repo shows they're done |
| R1-18 | F7 Analytics, `form_submit_success` | Done | `analytics.constants.ts`; `features.analytics = isProduction` |
| R1-19 | F8 Constants only, lint-enforced | Done | `eslint.config.js`: `react/jsx-no-literals`, `import.meta.env` rule |
| R1-20 | Success criteria and launch checklist: Lighthouse ≥ 90 on mobile, SEO 100, Rich Results Test with no errors | Pending (unverified) | No Lighthouse or Rich Results run recorded in the TSRs or CI. The Search Console and Bing parts of the launch checklist are under B18 |
| R1-22 | F6.2 On-page signals (brand in the `h1` and copy, keywords, NAP in the footer) and F6.6 domain (`.com.au`) | Done | Live: `ajclasses.com.au` over HTTPS, one `h1` containing "AJ Classes", NAP in the footer and JSON-LD |
| R1-21 | Content still owed by Ajay (T15, T17–T20, D2–D5, class hours, Instagram/YouTube URLs) | **Blocked (owner)** | `BUSINESS.classHours = null`; R1 PRP A.11 "still open" list |

### Release 1.1: calendar, events, news

| ID | Requirement | Status | Evidence / what's missing |
|---|---|---|---|
| R1.1-01 | F1 Term dates (home grid and `/term-dates`) | **Blocked (owner)** | No route or constants. The appendix is all ‹TBD›; only "Term 1 2027 starts 11 Jan" is known (R1 A.11 T10) |
| R1.1-02 | F2 Events (`/events`, `.ics`, Event JSON-LD) | **Blocked (owner)** | Nothing built and no events supplied. The hidden-when-empty rule means building it now would show nothing |
| R1.1-03 | F3 News & Updates | Partial | Admin posts cover the "news" need: `/posts`, `routes/posts.tsx`, migration `20261024120000_posts.sql`, `posts.test.sql`. **Missing:** (a) `/posts` isn't pre-rendered (`react-router.config.ts`) and the only SPA rewrite is `/portal` (`vercel.json`, `serve.railway.json`). `build/client` has no posts page, so once `develop` is released as it is, a direct visit or refresh on the hosted site would return **404** while the sitemap lists `/posts`. Today the live site (`main`) doesn't have `/posts` and its sitemap doesn't list it. The TSR tested it on the Vite dev server only. (b) No home-page preview, per-post pages or NewsArticle JSON-LD. (c) It is on `develop` only |
| R1.1-04 | F4 Nav and footer links to news/events | Pending | `NAV.links` has 5 items with no news link; the footer has none |

### Release 2: backend, logins, leads

| ID | Requirement | Status | Evidence / what's missing |
|---|---|---|---|
| R2-01 | Hosted Supabase (Sydney), migrations | Done | 11 files in `supabase/migrations`; go-live.md "hosted setup DONE". Unverified: whether the posts migration (24 Oct) has been applied to the hosted project |
| R2-02 | Testimonials (table, section, admin) | **Blocked (owner)** | Not built. Needs real testimonials with signed consent (R1 T20). The consent field exists (`video_publicity_consent_at`, migration `20261023110000`) |
| R2-03 | Lead backend: `leads` function → `enquiries` → Zoho CRM, admin Enquiries page | Done | `supabase/functions/leads/*`, `20261022090000_enquiries.sql`, `20261023090000_enquiries_zoho_crm.sql`, `routes/portal/admin-enquiries.tsx`, `enquiries.test.sql`. The hosted end-to-end test enquiry is still unticked (R2-18) |
| R2-04 | Subscribers list and unsubscribe | **Blocked (owner)** | Only *where* subscribers live was decided (Kit, completion-todo §0). No Kit form ID is configured (`app.constants.ts` reads `VITE_KIT_FORM_ID`; it's absent from `.env.production`), so nobody can subscribe or unsubscribe today. Under B5 with R1-05 |
| R2-05 | Resend domain, SPF/DKIM/DMARC | Done | go-live.md status block |
| R2-06 | JSON design tokens / Style Dictionary | Out of scope | Its stated purpose is the Flutter theme (mobile) `[ASSUMPTION]` |
| R2-07 | Separate About page for SEO | Pending (put in Later bucket) | Not built. Low value: the home page has an About section, and the guides in `/resources` cover SEO content |
| R2-08 | Review / AggregateRating markup | **Blocked (owner)** | Depends on R2-02 |
| R2-09 | CI: lint, typecheck, Lighthouse CI, Playwright smoke | Partial | `.github/workflows/ci.yml` runs format, lint, typecheck, unit tests, build and DB tests. **Missing:** Lighthouse CI and Playwright. The E2E suite lives in the separate `aj_classes-e2e` repo and is run by hand (TSR) |
| R2-10 | Sentry | **Blocked (owner)** | Needs a Sentry account; not in the code |
| R2-11 | Content security policy | Partial | CSP only on `/portal/:path*` (`vercel.json`). Public pages send none |
| R2-12 | R2a logins: invite-only, roles, admin 2FA, staff management, profiles, photo, audit (US1–US22) | Done | `20261006004522_staff_accounts.sql`, `functions/account-admin`, portal routes, `profiles_rls`/`admin_functions`/`avatars_storage`/`activity` tests; TSR role sign-in 5/5 |
| R2-13 | R2a open questions: subject list (Q1), backup admin (Q2), Supabase Pro (Q5) | **Blocked (owner)** | `subjects.constants.ts` is still marked "PLACEHOLDER LIST"; owner reminder #3 |
| R2-14 | Public tutor profiles on the website | **Blocked (owner)** | R2a review Q6 (does a tutor need to give written OK?) |
| R2-15 | Zoho Invoice "Fees and invoices" card for parents | Done | `BUSINESS.invoicePortalUrl` is set (owner reminder #5 is resolved) |
| R2-16 | WhatsApp chat button | Done | `WhatsAppButton.tsx` + test; live `wa.me/61469800685`. Owner still to confirm the number (reminder #2) |
| R2-17 | Parent guides, Course/Breadcrumb JSON-LD | Done | `routes/resources.tsx`, `routes/resource.tsx`; live sitemap |
| R2-18 | Hosted release checks that need real accounts, inboxes or devices | **Blocked (owner)** | go-live.md §8: 6 unticked boxes (invite a tutor, admin 2FA, reset link wording, test enquiry to Zoho, family flow, deactivate). R2a manual checklist (`r2a/stories.md` "Manual Checklist"): real Gmail and Outlook inboxes, accepting in a second browser, 2FA with Google Authenticator and 1Password, deactivating a tutor signed in on a phone, a VoiceOver pass |
| R2-19 | Enquiry emails to owner and submitter via Resend (R2 PRP "Contact form backend") | Done (by decision) | R2 PRP "Completion": "enquiry emails stay on Web3Forms for now". The owner email works through Web3Forms (R1-04). No submitter copy, by the same decision |
| R2-20 | R2a manual checks the team can do: CSP and `noindex` on `/portal/login`, deep-link refresh of a portal page | Done | go-live.md §8 (23 Oct, curl): `/portal/login` and `/portal/classes` return 200 with CSP, `X-Robots-Tag: noindex, nofollow` and `no-store`. Railway refresh not checked: `[ASSUMPTION]` Railway is no longer a live host (`docs/budget.md` lists Vercel only) |

### Invite onboarding (root brief)

| ID | Requirement | Status | Evidence / what's missing |
|---|---|---|---|
| INV-01 | Closed setup form, optional parent consents, one Sign in link, admin view | Done | Migrations `20261023100000`, `…110000`, `…120000`; `routes/portal/join.tsx`; `onboarding*.test.sql`; TSR E2E invite onboarding |
| INV-02 | Terms & Conditions page | **Blocked (owner)** | `LEGAL_LINKS.terms = null` (`routes.constants.ts`); needs wording |
| INV-03 | Is "forgot password while invited" acceptable? | **Blocked (owner)** | Open decision in invite-onboarding.md |
| INV-04 | Staff can change their phone number after setup | Pending | `routes/portal/profile.tsx` has no phone field |
| INV-05 | Privacy Policy mentions staff phone numbers | Pending | The portal section of `PRIVACY` doesn't mention them, though `20261023120000_admin_staff_phone_and_terms.sql` stores them. Also referenced from R1-07 |
| INV-06 | Sync parents' marketing consent to Kit (C7) | **Blocked (owner)** | Depends on R1-05 |

### Release 3: learning loop

| ID | Requirement | Status | Evidence / what's missing |
|---|---|---|---|
| R3-01 | R3a staff side: timetable, classes, assignments, marking, roster, enrolments, dashboards (TS1–6, AS1–7) | Done | `20261007061232_classes_timetable_assignments.sql`; staff routes; `classes_rls.test.sql`; `dashboard-build-todo.md` all ticked |
| R3-02 | R3b family side: consent, invites, MCQ/written questions, solve, return, parent progress, light/dark (FA1–FE1) | Done | `2026100709032x_*` migrations; student/parent routes; `family_portal.test.sql`; `family-portal-todo.md` all ticked |
| R3-03 | Tutors attach files to assignments | Pending | The only storage bucket is `avatars` (`staff_accounts.sql` line 492); no attachment code in `services/` |
| R3-04 | Students upload files (PDF/JPG/DOCX) as a submission | Pending | Same as R3-03. The R3 PRP has this in scope; the R3b design pushed it to "Later" |
| R3-05 | Status updates show live (Realtime) | Pending (put in Later bucket) | No realtime use in `services/` |
| R3-06 | Known R3b gaps: F8 (a student removed from a class loses sight of returned marks) and F28 (a "hold results" switch for all-MCQ quizzes) | Pending | `r3b/review.md` says "accepted for R3b … later" |

Not counted: the other R3b "later" ideas (question bank, timed tests, attendance, messaging,
printable reports, self-practice). They are ideas, not committed requirements, and stay in the
Later bucket.

### Release 4: communities

| ID | Requirement | Status | Evidence / what's missing |
|---|---|---|---|
| R4-01 | Communities with cover image, community admins | **Blocked (owner)** | Not built. The PRP's "To elaborate" (community vs class) was never settled |
| R4-02 | Public directory and "Request to join" | **Blocked (owner)** | Same decision |
| R4-03 | Approval queue and member management | **Blocked (owner)** | Same decision |
| R4-04 | Assignments go to every member automatically | Done (through classes) | R3b FT2: publishing reaches every enrolled student, including students added later |

### Release 5: non-mobile parts only

| ID | Requirement | Status | Evidence / what's missing |
|---|---|---|---|
| R5-01 | Flutter app, push notifications | Out of scope | Mobile |
| R5-02 | Email alerts (web): new assignment, feedback returned, due date approaching `[ASSUMPTION: in scope]` | Pending | No notification code. Resend is used only for auth emails; no `pg_cron` in the migrations |
| R5-03 | "Join request approved" alert | **Blocked (owner)** | Depends on R4 |
| R5-04 | Preference centre for alert types (web) `[ASSUMPTION: in scope]` | Pending | Not built |

### Release 6: recorded lectures and AI tutor

| ID | Requirement | Status | Evidence / what's missing |
|---|---|---|---|
| R6-01 | 6A lecture library (Mux upload, signed playback, progress) | **Blocked (owner)** | Not built. Needs a new Mux account and a pilot scope (Q1) |
| R6-02 | 6B AI tutor (RAG, chat, timestamps, moderation) | **Blocked (owner)** | Not built. Needs LLM and embeddings vendors, a budget and a retention decision (Q2–Q7) |

### Root briefs and owner items

| ID | Requirement | Status | Evidence / what's missing |
|---|---|---|---|
| BLOG-01 | Admin daily post page (`blog.md`) | Partial | Built and tested locally (`routes/portal/admin-posts.tsx`, `/posts`, TSR E2E). Same hosted-404 risk and missing nav link as R1.1-03; on `develop` only |
| SJ-01 | Assertive statements, student's journey | Done (awaiting release) | `414eff3 feat(approach)`: an assertive headline per Approach step. On `develop` only. `[ASSUMPTION]` "student's journey" = the 4-step Approach section |
| OD-01 | Release `develop` → `main` (posts, approach statements, KINET fixes) and apply the posts migration to the hosted DB | **Blocked (owner)** | A production action. Do it after build item 1 |
| OD-02 | Vercel Hobby plan vs commercial-use terms | **Blocked (owner)** | `docs/budget.md` ⚠️ "unconfirmed plan" |
| OD-03 | Owner reminders #1 (read the privacy wording) and #2 (confirm the WhatsApp number) | **Blocked (owner)** | `owner-decisions-reminder.md` |

### Counts

| Status | Count |
|---|---|
| Done | 31 |
| Partial | 5 |
| Pending | 11 |
| Blocked (owner) | 24 |
| Out of scope (mobile) | 2 |
| **Total** | **73** |

---

## 2. Pending backlog

### 2.1 Build queue (no owner input needed to build)

Every item here can be built and tested locally without Saurabh. One Supabase project serves
staging and prod, so **any item with a migration is deployed by Saurabh**. Items whose release
needs him say so in a **Release gate (owner)** line.

| # | Item | Covers | Why this rank | Needs Saurabh? |
|---|---|---|---|---|
| 1 | **News page works on the hosted site, linked only when there's news** | BLOG-01, R1.1-03 (a), R1.1-04 (news part) | A defect in work that's already built. Released as-is, `/posts` would 404 on the hosted site while our own sitemap lists it, so it blocks the `develop` → `main` release (OD-01). Smallest item with high value | **Release gate (owner):** B1 (posts migration on the hosted DB, at least 1 post published, merge to `main`, hosted curl check) |
| 2 | **Homework file uploads** (tutor attachments; students hand in photos and PDFs for online work) | R3-03, R3-04 | Highest value for a live tutoring business: tutors can't see students' worked answers in the portal today. In scope in the R3 PRP | **Release gate (owner):** B3 (Supabase Pro approved before release: photos of students' work are new family data, and owner reminder #3 says no live family data on Free) **plus** a privacy wording review (B17), batched with item 4's wording. Hosted migration deploy |
| 3 | **"Work returned" email to student and parents, with an off switch** | R5-02 (returned trigger), R5-04 (first preference) | Parents engage when they hear their child's work is marked. Resend's domain is already verified. Thin slice of R5 | **Release gate (owner):** set the Resend API key as a hosted Supabase **function secret** (today it only feeds the auth SMTP, `supabase/config.toml`). Hosted deploy. Resend free is 100 emails/day; the Architect confirms the volume fits |
| 4 | Staff phone on the profile page, plus a Privacy Policy update | INV-04, INV-05 | Small privacy/accuracy fix. Lower value than 1–3. Its privacy wording goes to Saurabh in the same review as item 2's | **Release gate (owner):** wording review (B17) |
| 5 | Content security policy on public pages | R2-11 | Security hardening for the live site; no UI change | No |
| 6 | CI quality gates: E2E smoke, Lighthouse budget and a structured-data check on pull requests | R2-09, R1-20 | Guards everything above against regressions; proves the R1 Lighthouse and Rich Results targets | No (Architect decides how the separate `aj_classes-e2e` repo is wired in) |
| 7 | Fair results: a "hold results until returned" switch, and returned marks stay visible after a student leaves a class | R3-06 | Academic integrity and parent trust; known accepted gaps | Deploy only |
| 8 | More alerts: "new assignment" and "due tomorrow" emails | R5-02 (rest), R5-04 (rest) | Builds on item 3. "Due tomorrow" needs a scheduler | Deploy only; email volume as in item 3 |
| 9 | Missing SEO head tags (`hreflang`, `geo.*`) | R1-14 | Tiny, but low value: Google ignores `geo.*` and `hreflang` does little for a site in one language. Do it with item 5 or drop it | No |

**Later bucket** (named, not dropped):
- Realtime status updates (R3-05).
- Separate About page (R2-07).
- News extras: a home-page "latest 3" preview, per-post pages, NewsArticle JSON-LD.
- R3b "later" ideas.
- Splitting the MUI chunk (r3a B6).

### 2.2 Blocked on owner (not in the build queue)

Each entry ends with the exact question for Saurabh.

1. **B1 — Release to production (OD-01).** After item 1 passes its local gate: "OK to apply the
   posts migration to the hosted Supabase, publish at least one post, and merge `develop` into
   `main`? This release also adds this to the Privacy Policy (Security's wording, `06-security-item-1.md` finding 6): 'When you visit a page, your browser asks our database provider (Supabase, Sydney) whether there is any news to show. Like any web request, this sends your IP address and browser type. Supabase keeps these in short-lived technical logs for security and troubleshooting. We don't save them in our own records or use them to identify you.' OK to publish that wording?" **Release check (Saurabh, or the team watching):** on the live site,
   `curl -s -o /dev/null -w '%{http_code}' https://ajclasses.com.au/posts` returns 200 after a hard
   refresh, the News link shows in the header and footer, and `sitemap.xml` lists `/posts`.
2. **B2 — Hosted release checks (R2-18).** "Can you run the 6 unticked checks in go-live.md §8
   and the R2a manual checklist (real Gmail and Outlook inboxes, a second browser, Google
   Authenticator and 1Password, a tutor signed in on a phone, VoiceOver) with real accounts? Or
   should we pick a time when you can do them while I watch?"
3. **B3 — Supabase Pro (R2-13 Q5, reminder #3).** "Have any real families been invited yet? Do
   you approve upgrading to Pro (≈ A$39/month) before they are?" This is also the **release gate for item 2** (uploads), and it lifts storage from 1 GB to 100 GB.
4. **B4 — Vercel plan (OD-02).** "Is the project on Vercel Hobby or Pro? Hobby doesn't allow
   commercial use. Upgrade to Pro (≈ A$31/month)?"
5. **B5 — Kit newsletter and subscriber list (R1-05, R2-04, INV-06).** "Do you still want the footer newsletter? If
   so, please create the Kit account (hello@), turn on double opt-in, and send me the form ID."
6. **B6 — Terms & Conditions (INV-02).** "Will you provide T&C wording? Or should we draft one
   for you or a lawyer to approve?"
7. **B7 — Forgot password while invited (INV-03).** "An invited person can use Forgot password to
   reach the setup form without an admin. Is that acceptable? Yes or no."
8. **B8 — Testimonials (R2-02, R2-08).** "Do you have at least 3 written reviews or videos with
   signed parent consent? Without them the section stays hidden."
9. **B9 — Public tutor profiles (R2-14).** "Should tutors' names, photos and bios appear on the
   website? If yes, do we need each tutor's written OK?"
10. **B10 — Term dates (R1.1-01).** "Do AJ Classes terms follow the Victorian school terms? If
    yes, I'll use the official 2027 dates. If not, please send the four term ranges."
11. **B11 — Events (R1.1-02).** "Are any events planned (info night, mock exam)? If none in the
    next 2 months, I'll move Events to the Later bucket."
12. **B12 — Communities (R4).** "Classes are already run by admins. Do you want a self-serve
    community directory with 'request to join'? Recommendation: no, move R4 to Later."
13. **B13 — Recorded lectures and AI tutor (R6).** "Do you want to start R6? It needs a Mux
    account, an LLM and embeddings vendor, a monthly AI budget and a pilot course (R6 PRP Q1–Q7)."
14. **B14 — Sentry (R2-10).** "Do you want error tracking? It needs a free Sentry account in the
    business's name."
15. **B15 — Ajay's content (R1-21, R2-13 Q1).** "Can you collect from Ajay: class hours,
    Instagram and YouTube URLs, VCE counselling details (T15), SEAL year levels (T17), UCAT/GAMSAT
    details (T18), and the final tutor subject list?"
16. **B16 — Backup admin (R2-13 Q2).** "Who is the second admin? Recommendation: your own
    account."
17. **B17 — Quick checks (OD-03).** "Have you read the privacy wording for the portal and
    enquiries? Is +61 469 800 685 the WhatsApp Business number?" When items 2 and 4 are built,
    this also covers one batched review of their new Privacy Policy wording (uploaded work and
    staff phone numbers).
18. **B18 — Off-site SEO (R1-17).** "Are Search Console, Bing and the Google Business Profile set
    up and verified? (I can't see this from the repo.)"

---

## 3. Elaboration: top 3 buildable items

### Item 1 — News page works on the hosted site, linked only when there's news

**Rules this follows:**
- R1.1 F4: one nav item, plus footer links.
- R1.1 acceptance: with no news content, the section and its nav link are hidden.
- R1 F2.1: no "coming soon".

`[ASSUMPTION]` **The label is "News", not R1.1's "What's On".** "What's On" promises events, and
Events are blocked (B11). R1.1 F4.1 itself allows a variant ("News & Events"). When Events ship,
the label becomes "What's On".

`[ASSUMPTION]` **A client-side check decides whether the links show.** The header and footer are
pre-rendered, so the HTML can't know whether posts exist. The links therefore start hidden, and a
check after the page loads shows them when at least one post exists. This is acceptable because:
- the link is secondary navigation;
- crawlers reach `/posts` through the sitemap.

The check must not load `supabase-js` or MUI on public pages (AC-1.12). The Architect picks how.

**Stories**
- **N1.** As a parent, I can open `/posts` from a link, a bookmark, Google, or a refresh, and see
  the latest posts.
- **N2.** As a parent, when AJ Classes has posted news, I can find "News" in the header (desktop
  bar and phone menu) and the footer of every public page. When there is none, I never see a link
  to an empty page.
- **N3.** As an admin, a post I publish appears on `/posts` straight away, with no rebuild. This
  already works and must not break.

**Acceptance criteria**
- AC-1.1 **Local production gate.**
  1. `VITE_APP_ENV=production pnpm build` succeeds.
  2. Serve `build/client` with the same rewrite and header rules as `apps/web/vercel.json`, e.g. a
     local static server configured to mirror them, or `vercel build` + `vercel dev` where
     available.
  3. Check that `/posts` returns **HTTP 200**, the list renders, and a hard refresh still works.

  The hosted check is Saurabh's release step (B1), not this gate.
- AC-1.2 The same build served with `serve.railway.json` also returns 200 for `/posts`.
  `vercel.json` and `serve.railway.json` handle `/posts` the same way.
- AC-1.3 The first HTML response for `/posts` (curl, no JavaScript) contains:
  - the `<title>` and meta description from `POSTS_PUBLIC_PAGE.seo`;
  - `<link rel="canonical" href="https://ajclasses.com.au/posts">`;
  - exactly one `h1`.
- AC-1.4 On a production build, `/posts` has no `noindex` (meta or `X-Robots-Tag`) and no portal
  CSP or `no-store` header. On a staging build it has `noindex`, like every staging page.
- AC-1.5 `/posts/anything` and `/postsx` return the site's 404 page with HTTP 404.
- AC-1.6 **Empty state** (zero posts):
  - The header and footer show **no** News link on any public page.
  - Opening `/posts` directly returns 200 with header and footer, and one neutral line from
    constants stating there are no news posts at the moment, with links to the home page and
    Register Interest.
  - No page says "coming soon" or "check back soon". The current
    `POSTS_PUBLIC_PAGE.empty` ("Nothing posted yet. Check back soon.") is replaced.
- AC-1.7 **Error state** (database unreachable):
  - The News links stay hidden.
  - `/posts` shows a message, distinct from the empty-state line, telling the visitor to try
    again later. No blank page and no raw error.
  - Today a failed load shows the empty text, which is wrong.
- AC-1.8 **With at least 1 post:**
  - The header shows a "News" link to `/posts` in the desktop bar and the phone menu.
  - The desktop bar stays on one row at 1024 px and 1280 px.
  - Nav items stay ≤ 6 plus the CTA (R1 F2.5).
  - On `/posts` the link has `aria-current="page"`.
  - Once the check resolves, the link's appearance doesn't shift the layout (CLS < 0.1).
- AC-1.9 With at least 1 post, the footer shows a "News" link to `/posts`. With zero posts, or on
  error, it doesn't.
- AC-1.10 Deleting the last post hides both links on the next page load. Publishing the first post
  shows them on the next page load. No rebuild is needed either way.
- AC-1.11 When Supabase isn't configured (`VITE_SUPABASE_URL` empty):
  - no News links show;
  - `/posts` is left out of `sitemap.xml`;
  - the public build still succeeds.

  When Supabase is configured, `/posts` stays in the sitemap. `[ASSUMPTION]` The B1 release gate
  makes sure at least 1 post exists before release, so the empty page is an edge case, not the
  launch state.
- AC-1.12 The bundle check shows the home, programme, resources and privacy pages load no
  `supabase-js` and no MUI, including the link check. Only `/posts` may load `supabase-js`.
- AC-1.13 **Permissions** (re-run the existing tests, no regression):
  - A signed-out visitor can read posts but can't insert, update or delete them (`posts.test.sql`).
  - A tutor opening `/portal/admin/posts` sees "You don't have access to this page".
  - An admin who hasn't passed two-step can't write.
- AC-1.14 **Invalid input** (admin compose, existing rules):
  - Title is 1–120 characters and body 1–5000; an empty or over-long value is refused with an
    inline message.
  - A `<script>` in the title or body shows on `/posts` as plain text.
- AC-1.15 All labels come from `src/constants/`, and `pnpm lint` passes.

**v1 scope:** hosted routing fix, crawlable shell, links shown only when news exists, separate
empty and error states.
**Deferred (Later bucket):** home-page "latest 3" preview, per-post pages (`/posts/<slug>`),
NewsArticle JSON-LD, post images and tags, email digest.

---

### Item 2 — Homework file uploads

**Release gate (owner):**
- B3: Supabase Pro approved before release, because photos of students' work are new family
  data (owner reminder #3).
- Saurabh reviews the new Privacy Policy wording for uploaded work (B17, together with item 4).
- Hosted migration deploy.

Build and local tests don't wait for any of these.

**Rule kept:** the database's rule for paper homework stays as it is: its status is set **by
staff only**, and students don't hand it in
(`supabase/migrations/20261007090320_student_parent_portal.sql`, `check_assignment_result`).

So students upload only to **online** work. That covers two kinds:
- an online assignment with questions, where files sit alongside the answers;
- a new **file hand-in** assignment: online work with no questions, where the student's answer
  is the files.

`[ASSUMPTION]` A file hand-in follows the existing online status flow:
- not started → in progress → submitted, set by the student;
- then → returned, set by staff.

The Architect decides how it is represented.

**Stories**
- **U1.** As a tutor, I can attach files (e.g. a worksheet PDF) to any assignment, so students
  have the material in the portal.
- **U2.** As a tutor, I can create a **file hand-in** assignment, so students hand in photos or
  PDFs of their worked answers.
- **U3.** As a student, I can download an assignment's attachments. On online work I can upload my
  files and submit them.
- **U4.** As a tutor, I can open each student's submitted files when marking, then mark and return
  as today.
- **U5.** As a parent, I can see (read only) the files my child submitted.

**Acceptance criteria**
- AC-2.1 **Tutor attachments.** On any assignment (paper, online or file hand-in; draft or
  published), a tutor of the class or an admin can:
  - add up to **5** files;
  - remove any of them, after confirming.

  Each file shows its name, size and Download. Students and parents of enrolled students see the
  attachments only once the assignment is published.
- AC-2.2 **Assignment type.** When creating a draft, a tutor can choose **File hand-in**. Like
  questions, the type is locked once the assignment is published. A file hand-in has an optional
  maximum mark (1–1000, as in R3a TS3).
- AC-2.3 **Where students can upload:**
  - On a published **file hand-in** or **online** assignment that isn't yet submitted, the student
    can add up to **5** files and remove any of them.
  - Each file shows its name, size and upload state: "Uploading…", "Uploaded", or a failure with
    **Try again**.
  - Adding the first file moves the status from Not started to **In progress**.
  - `[ASSUMPTION]` That means the tutor can no longer unpublish (R3b FT2: only "until a student
    has started").
  - On **paper homework** the student sees attachments only, with no upload control. The server
    refuses a student upload there too.
- AC-2.4 **Allowed files and size:**
  - Types: PDF, DOCX, and images (JPEG, PNG or WebP).
  - **Images are compressed in the browser before upload.** They're resized to at most 2000 px
    on the long edge and re-encoded as JPEG, which also strips location data, as with avatars
    (R2a US13). An image still over **2 MB** after that is refused.
  - PDF and DOCX files are stored as they are, up to **10 MB** each.
  - A student's files on one assignment total at most **20 MB**.
  - A wrong type, an over-size file, a 6th file, or going over the total is refused **before
    upload**, with a message naming the limit, and nothing is stored. The server refuses the same
    files when the browser checks are bypassed (tested through the API).
- AC-2.5 **Storage budget check** (`docs/budget.md` §4: 1 GB on Free, "compress images on the
  client"):
  - A typical phone photo (12 MP, 3–5 MB as taken) is stored at ≤ 2 MB.
  - The test report records the stored size of three real sample photos.
  - With the limits above, a 3-photo submission is ≈ 3–6 MB, so the Free plan would hold only
    a few hundred submissions. That's why B3 is the release gate.
- AC-2.6 **Submit:**
  - On online and file hand-in work, **Submit** asks for confirmation. For file hand-in it needs
    at least 1 file; for online work, files are optional.
  - Submitting locks the files together with any answers.
  - Late submissions are labelled late, as today.
- AC-2.7 **Visibility and locking by status.** One rule, whoever set the status:
  - **Not started / In progress:** only the student sees their files, and can add or remove
    them. Tutors, admins and parents see none (R3b: drafts are private to the child).
  - **Submitted or Returned:** the student, the class's tutors, admins and the linked parents all
    see the files. Nobody can add, remove or replace them (enforced by database or storage rules).
- AC-2.8 **Staff set the status first:**
  - *Paper homework.* Staff set every status, and students can't upload, so no student files exist
    to lock or show. Tutor attachments are unaffected.
  - *Online and file hand-in.* The database already refuses a staff change to Submitted or Marked
    (only submitted → returned is allowed). A tutor can't close out a student who never submits;
    that student's files stay private draft files. A test proves the staff change is refused and
    the files stay hidden from the tutor and parents. Staff close-out is deferred.
- AC-2.9 **Tutor view:**
  - The submissions list shows a file count for submitted students.
  - The submission page lists the files with Download.
  - On a file hand-in, the tutor can enter one overall mark (≤ the maximum, if one is set) and
    feedback, then **Return**.
  - Return works as today for online work.
- AC-2.10 **Parent view:** a linked parent sees the files once the status is Submitted or Returned
  (AC-2.7), read only, on the child-assignment page.
- AC-2.11 **Permissions** (each tested through the API, not only in the UI):
  - A student can't list, download or upload into another student's files.
  - A parent sees only their own children's files.
  - A tutor sees only files for classes they teach.
  - An admin sees all.
  - A deactivated or still-invited account sees nothing.
  - Nobody but staff sees a draft assignment's attachments.
  - No file has a public URL. Links expire; the Architect sets the lifetime.
- AC-2.12 **Safe display.** A file name containing HTML shows as text. Files are offered as
  downloads, never opened as a web page on our site.
- AC-2.13 **Empty states:**
  - The assignment shows "No files attached" to students when it has no attachments.
  - The submission page shows "No files handed in" to the tutor when a submitted online
    assignment has none.
- AC-2.14 **Clean-up:**
  - Deleting an assignment deletes its attachments and every student file for it.
  - Removing a student from a class follows R3b F8: their files stay stored but hidden until item 7
    changes that rule.
- AC-2.15 **Phone:**
  - Works at 360 px wide.
  - On a phone, the upload control offers the camera.
  - `[ASSUMPTION]` iPhone photos (HEIC) are converted to JPEG by the browser or the compressor. If
    testing shows a HEIC still arrives, it's refused with a clear message, and HEIC support goes to
    Later.
- AC-2.16 Public pages still load no MUI or `supabase-js`. All text comes from constants. DB, unit
  and browser tests are added per the repo conventions.

**v1 scope:** tutor attachments, the file hand-in type, student uploads on online work, browser
compression, status-based visibility, tutor and parent views, limits, access rules.
**Deferred:**
- student uploads on paper homework, which would need the staff-only rule changed (owner
  decision);
- staff close-out of an unsubmitted online assignment;
- the tutor uploading a marked-up copy;
- previews and thumbnails;
- annotation;
- virus scanning (`[ASSUMPTION]` v1 relies on the type allowlist, size caps, re-encoded images and
  download-only serving; Security to review);
- a storage-usage view for admins.

---

### Item 3 — "Work returned" email, with an off switch

**Release gate (owner):**
- Saurabh sets the Resend API key as a hosted Supabase **function secret**. Today it only feeds
  the auth SMTP (`supabase/config.toml`).
- Hosted deploy.

Build and local tests use Mailpit and don't wait for this.

**Stories**
- **E1.** As a parent, I get an email when my child's work has been marked and returned, so I know
  to look.
- **E2.** As a student, I get the same email for my own work.
- **E3.** As a parent or student, I can turn these emails off (and on again) on my Account page.

**Acceptance criteria**
- AC-3.1 When staff return a student's work (paper, online or file hand-in), one email goes to:
  - the student, if they have an **active** account and their switch is on;
  - each **active** linked parent whose switch is on.
- AC-3.2 **No-recipient cases.** In each case below, the return succeeds, no email is sent, and
  **nothing is recorded as a failure**:
  - the student has no portal account (roster only);
  - the student's account is invited, not active;
  - the student has no linked parent, or no active parent;
  - every recipient has turned the switch off.
- AC-3.3 The email says:
  - the child's first name, the assignment title and the class name;
  - that the work was marked;
  - a **View feedback** button.

  **No marks or feedback text are in the email.** `[ASSUMPTION]` Keeping them out protects
  privacy if an email is forwarded.
- AC-3.4 **View feedback** goes to the student's assignment page, or the parent's child-assignment
  page. A signed-out person goes to sign-in and then back there (existing `next` rule).
- AC-3.5 Each person gets **at most one** email per student per assignment.
  - If the work is returned again later, no second email is sent. `[ASSUMPTION]`
  - Parents of other children, tutors and admins get nothing.
  - Deactivated accounts get nothing.
- AC-3.6 **Off switch:**
  - Account → **Notifications** has "Email me when work is marked and returned".
  - Shown to students and parents only.
  - On by default. `[ASSUMPTION — Security to confirm]` These are service messages about an
    existing relationship, which the Terms already cover, so under the Spam Act no new consent is
    needed (invite-onboarding "Consents").
  - Saving shows a confirmation, and the choice survives sign-out.
  - Every email has a link to this page.
- AC-3.7 **Never blocks marking.** If sending fails (Resend down, the daily cap reached, or a
  missing secret), the return still succeeds and the tutor sees no error.
- AC-3.8 **Failed and waiting sends are visible to admins.**
  - An admin can see a list of **Failed** sends and of **Waiting** sends (not sent ~2 hours after
    the return), newest first, each showing: time, recipient role (student or parent),
    assignment title, state (Failed or Waiting) and reason.
  - The list shows no email body.
  - Tutors, students and parents can't see it (DB test).
  - With none, the list shows "No failed or waiting emails".
- AC-3.9 The email uses the AJ Classes branding and wording style of `supabase/templates/`, comes
  from the verified `ajclasses.com.au` domain, and all wording lives in constants or templates.
  Locally, emails land in Mailpit.
- AC-3.10 **Permissions:** a person can read and change only their own switch (DB test). Nobody
  can trigger an email for a submission they can't return.
- AC-3.11 **Test data:** staging and prod share one database. Tests use Mailpit locally, and the
  release check uses a seeded fake family with Saurabh's own addresses only. No email goes to a
  real family during testing.

**v1 scope:** the "returned" trigger, students and parents, one switch, failed-send list.
**Deferred:**
- "new assignment" and "due tomorrow" emails (item 8);
- a daily digest (the fallback if volume nears Resend's 100/day cap);
- SMS;
- push notifications (mobile, out of scope);
- tutor-side alerts.

---

## 4. Assumptions

1. `[ASSUMPTION]` "Ignore the mobile app" excludes: the Flutter app, push notifications, app
   store work, and design tokens that exist only to feed Flutter (R2-06). Web email alerts and a
   web preference centre from R5 are **in** scope.
2. `[ASSUMPTION]` Admin daily posts (`/posts`) serve as R1.1's "News & Updates". Separate news
   pages built from Markdown files are not needed.
3. `[ASSUMPTION]` "Student's journey" (SJ-01) means the 4-step Our Approach section, as built in
   `414eff3`. If Ajay meant something else (e.g. the portal), it reopens.
4. `[ASSUMPTION]` The `/posts` 404 is inferred from the build output and the rewrite rules. It
   would appear once `develop` is released as it is; the live site doesn't have `/posts` yet.
   Staging sits behind Vercel's login (302), so the team's gate is the local production-build
   check (AC-1.1), and the hosted curl is Saurabh's release check (B1).
5. `[ASSUMPTION]` Whether the posts migration is on the hosted DB is unverified. B1 covers it.
6. `[ASSUMPTION]` R4 communities would duplicate admin-managed classes for a small business. I
   recommend Later unless Saurabh says otherwise (B12).
7. `[ASSUMPTION]` These are product defaults: easy to change, and the Architect may tighten them.
   - File limits: 5 files, images compressed to ≤ 2 MB, PDF and DOCX up to 10 MB, 20 MB per
     student per assignment.
   - No marks in emails.
8. `[ASSUMPTION]` Email volume for item 3 stays under Resend's free 100/day. Classes are small
   and only one trigger is in v1. If it doesn't, the digest fallback or a paid Resend plan becomes
   an owner money question.
9. `[ASSUMPTION]` Owner reminder #5 (Zoho Invoice address) is resolved, because
   `BUSINESS.invoicePortalUrl` is set.
10. `[ASSUMPTION]` Not reviewed, because they aren't release requirement files:
    `docs/legacy-erp/`, `docs/social-media/` and the sibling `aj_classes_admin` repo.
11. `[ASSUMPTION]` The News link is labelled "News", not "What's On", while Events are blocked.
    It shows through a client-side check once at least 1 post exists (item 1).
12. `[ASSUMPTION]` Paper homework stays staff-only, as the database enforces. Students upload only
    to online work and the new **file hand-in** type, which follows the online status flow. Letting
    students hand in paper homework would change a documented R3b rule, so it's deferred as an
    owner decision (item 2).
13. `[ASSUMPTION — Security to confirm]` "Work returned" emails are Spam Act service messages
    covered by the Terms, so they can be on by default with an off switch (item 3).
14. `[ASSUMPTION]` Railway is no longer a live host (`docs/budget.md` lists Vercel only), so the
    R2a "refresh on Railway" check is dropped. `serve.railway.json` is still kept in step (AC-1.2).

---

## Change log

| Date | Change | Why |
|---|---|---|
| 25 Oct 2026 | B1's question now includes item 1's Privacy Policy sentence, so it's approved with the release (team lead for the PO) | Review-3 finding 12: Privacy wording shouldn't reach production without Saurabh's explicit yes |
| 25 Oct 2026 | AC-3.8 now lists **Failed and Waiting** sends, with a state column, and the empty state "No failed or waiting emails" | Architecture stage (02 item 3, ADR-0004) added Waiting rows so a missing cron job, secret or daily-cap backlog is visible; carried over by review-2 round 2, finding 4 |
| 25 Oct 2026 | B1's Privacy wording replaced with Security's suggested text (item 1 security review, finding 6) | "We don't store it" wasn't accurate: Supabase keeps short-lived request logs |
