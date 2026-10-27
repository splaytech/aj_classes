# 01 — Requirement: "We're hiring" link (web, `feature/we-are-hiring`)

Stage 1 of `/deliver`, Product Owner. Date: 2026-10-27.

**Saurabh's ask:** "We are hiring link needs to be created".

## Scope in one paragraph

Add one new public page, **`/careers`**, that says AJ Classes is looking for tutors, who it is looking for, and how to apply. Link to it from the **footer legal row** on every public page. To apply, people **email `BUSINESS.email` (hello@ajclasses.com.au)** using a `mailto:` link with a prefilled subject. There is no form, upload, database table, storage or new vendor. Nothing about applicants is stored by the site.

## Decisions (and why)

1. **A page plus a footer link. No header item in v1.** The header already holds up to 6 nav items when News shows (`Header.test.tsx`: "≤ 6 nav items"). A seventh would crowd the desktop bar and the phone menu, and the main audience for the header is parents. The footer shows on every public page, on desktop and mobile. A header or home-page mention is deferred (D1).
2. **Path `/careers`, link label "We're hiring".** The path stays the same when no role is open. Only the label and copy would change.
3. **Apply by email (mailto), not the enquiry form.** The "Register your interest" form sends to Web3Forms and, when lead capture is on, to Supabase and Zoho CRM as a **lead** (`services/enquiry.service.ts`). Using it would store applicants' personal data in our database and add job seekers to the parent sales pipeline. A mailto link uses the existing public inbox and stores nothing on the site.
4. **No CV upload, no application form, no JobPosting structured data in v1.** Google's JobPosting markup expects things like a posting date, a closing date, an employment type and a street address or region, plus pay is recommended. We don't have those confirmed, and the street address must never be public. Deferred (D3).
5. **The public site is light only** (`styles/theme.css`: only the portal can switch to dark). So there is no dark-mode AC.

> No option chosen here needs a new vendor, a new data store or a paid service. Options that would (an application form with uploads, an applicant table, a jobs board integration) are deferred and need Saurabh's go-ahead first.

## User stories

### US-1 — Find out that AJ Classes is hiring

**As a** prospective tutor visiting ajclasses.com.au, **I want to** see a "We're hiring" link, **so that** I can find out about working at AJ Classes.

### US-2 — Understand the role and apply

**As a** prospective tutor on the careers page, **I want to** read what roles are open, who you're looking for and what I'll need, and then email my application in one click, **so that** I can apply without hunting for a contact address.

### US-3 — Receive applications in the existing inbox

**As** Saurabh, **I want** applications to arrive in the hello@ inbox with a clear subject line, **so that** I can tell them apart from parent enquiries without any new tool or stored data.

## Acceptance criteria

### Footer link (US-1)

- **AC-1** Every public page that uses the site footer (home, each programme page including VCE, resources and each guide, posts, privacy, subscribed, 404 and the new careers page) shows a link with the visible text **"We're hiring"** in the footer legal row (the row that holds "Resources" and "Privacy Policy").
- **AC-2** The link's `href` is exactly `/careers`. It opens in the same tab.
- **AC-3** Order in the legal row: News (only when posts exist, unchanged), Resources, **We're hiring**, Privacy Policy, Sign in (when the portal is on, unchanged).
- **AC-4** At 375 px width (mobile) and 1280 px width (desktop) the link is visible without horizontal scrolling, does not overlap other footer text, and has the same style as the other legal-row links. The text meets the same contrast as its neighbours.
- **AC-5** The link can be reached with Tab, shows a visible focus ring, and opens the page with Enter.
- **AC-6** Portal pages (`/portal/*`) do not show the link. They don't render the public footer, and that doesn't change.

### Careers page (US-2)

- **AC-7** `/careers` loads with HTTP 200 and is pre-rendered at build time like `/privacy`, so the copy is in the HTML before JavaScript runs (check with view-source or `curl`). That means three changes:
  1. `ROUTES.careers = '/careers'` in `apps/web/src/constants/routes.constants.ts`.
  2. A `route(ROUTES.careers, …)` entry in `apps/web/src/routes.ts`, placed before `route('*', …)`.
  3. `ROUTES.careers` in the `prerender` list in `apps/web/react-router.config.ts`.
- **AC-8** The page uses the normal site header and footer (`SiteLayout`) and has exactly one `<h1>`. The h1 text is **"We're hiring"** [ASSUMPTION].
- **AC-9** The page shows these blocks in this order, using the copy in "Draft copy" below. All wording lives in a constants file, not inline in the component.
  1. A short intro (one or two sentences).
  2. "Roles" with one role: **Tutor (casual)** [ASSUMPTION].
  3. "Who we're looking for": a short bulleted list.
  4. "What you'll need": a bulleted list that **includes a current Victorian Working with Children Check (WWCC), or VIT registration**.
  5. "How to apply": a sentence plus an apply link.
- **AC-10** The apply link's `href` is exactly `mailto:hello@ajclasses.com.au?subject=Tutor%20application`. The address is built from `BUSINESS.email` (never typed out again in code), and the subject is **"Tutor application"** [ASSUMPTION], URL-encoded. Clicking it on a desktop with a mail client, and tapping it on iOS Safari and Android Chrome, opens a new email to hello@ajclasses.com.au with that subject already filled in.
- **AC-11** The apply link's text says what it does (for example "Email your application"), and the email address is also shown as plain visible text, so someone without a mail app can copy it.
- **AC-12** The page shows no pay figure, no hours, no start date and no promise of work. It names no person and shows no street address or ABN. The only business facts used are ones already in `business.constants.ts` (name, email, suburbs text, city, state).
- **AC-13** The page tells people what to include and how their details are used. For example: "Tell us about your subjects, year levels and experience, and attach your CV. We'll only use your details to consider your application." [ASSUMPTION]
- **AC-14** At 375 px and 1280 px: no horizontal scroll, text is readable, spacing and headings match the privacy page, bullet lists use the site's default list style, and the apply link is at least a 44 × 44 px tap target on mobile.
- **AC-15** Keyboard and screen reader: all links can be reached with Tab and have a visible focus ring. Headings go h1 → h2 with no skipped level. The skip link still jumps to the main content. axe (or Lighthouse accessibility) reports no serious or critical issues.
- **AC-16** The page shows one "Back to home" link to `/`, like the privacy page [ASSUMPTION].

### SEO (US-1, US-2)

- **AC-17** `<title>` is **"Careers | AJ Classes"** [ASSUMPTION]. In non-production builds the title gets the usual environment prefix from `buildPageMeta`.
- **AC-18** The meta description is under 160 characters and matches the draft copy. It names places only through `BUSINESS.suburbsText`, never a region like "Melbourne's west". Draft, about 135 characters: "AJ Classes is looking for tutors in Williams Landing, Truganina and Craigieburn, and online. See who we're looking for and how to apply." [ASSUMPTION]
- **AC-19** The canonical link is the absolute `/careers` URL, made the same way as the other pages' canonical links (`buildPageMeta`).
- **AC-20** `/sitemap.xml` lists `/careers` on every build, whether or not Supabase is configured. `sitemap.test.ts` is updated to cover it.
- **AC-21** Production builds index the page (no `noindex`). Staging and dev builds keep `noindex` and `Disallow: /` exactly as today.
- **AC-22** No JobPosting structured data is added. Existing JSON-LD on other pages is unchanged.

### Quality bar

- **AC-23** No console errors or warnings in the browser on `/careers`, or on the home page after the footer change, in a production build.
- **AC-24** `pnpm check` passes when run from the repo root. It runs format:check, lint (including the no-magic-strings rule), typecheck, test and build. New tests cover AC-2, AC-3, AC-10 and AC-20 at least.
- **AC-25** No new production dependency, no new environment variable, no new third-party request (check in the network tab: `/careers` makes no request that the privacy page doesn't make).

### Must NOT change

- **AC-26** The header nav, the Register Interest button, the Sign in link, the News link logic, the mobile CTA bar and the WhatsApp button behave and look exactly as before.
- **AC-27** The "Register your interest" form, Web3Forms, Supabase leads and Zoho CRM are untouched. No applicant data reaches them from this feature.
- **AC-28** No database migration, no new table, no new storage bucket, no edge function change.
- **AC-29** The CSP and hosting config only change if the build needs it for the new page. A `mailto:` link needs no CSP change.
- **AC-30** The privacy policy text is unchanged in v1 (see Q4).

## Draft copy (all [ASSUMPTION], for Saurabh to confirm)

| Where | Draft |
|---|---|
| Footer link | We're hiring |
| Page h1 | We're hiring |
| Intro | AJ Classes is growing, and we're looking for tutors to join our small team. We teach small groups in person in Williams Landing, Truganina and Craigieburn, and online across Australia. *(suburbs from `BUSINESS.suburbsText`)* |
| Role | Tutor (casual) |
| Who we're looking for | People who enjoy helping students learn and build confidence. Strong in one or more of Maths, Science or English, or in exam preparation (selective entry, scholarship, NAPLAN or ICAS). Comfortable teaching small groups, primary to Year 10. Reliable, patient and clear communicators. |
| What you'll need | A current Victorian Working with Children Check (or VIT registration), or a willingness to get one before you start. The right to work in Australia. Tutoring or teaching experience is a plus but not essential. |
| How to apply | Email us at hello@ajclasses.com.au with "Tutor application" in the subject. Tell us about your subjects, year levels and experience, and attach your CV. We'll only use your details to consider your application. |
| Apply link text | Email your application |
| Email subject | Tutor application |
| SEO title | Careers \| AJ Classes |
| SEO description | AJ Classes is looking for tutors in Williams Landing, Truganina and Craigieburn, and online. See who we're looking for and how to apply. *(suburbs from `BUSINESS.suburbsText`)* |

Note on WWCC: in Victoria, a WWCC is required for paid child-related work such as tutoring. Teachers registered with VIT are exempt, which is why VIT registration is listed as an alternative. "Or a willingness to get one before you start" keeps it accurate without promising anything. Saurabh should confirm whether he wants the WWCC in hand before applying.

## Assumptions

1. A1. "Link" means a page plus a footer link to it. A bare mailto in the footer would not tell people what the role is.
2. A2. The open role is a casual tutor, in the subjects, exams and year levels the site already advertises: Maths, Science and English, plus exam preparation (selective entry, scholarship, NAPLAN, ICAS), primary to Year 10. VCE, UCAT and GAMSAT tutors are left out until Saurabh says otherwise (Q1).
3. A3. Applications by email to the existing public inbox are acceptable. Saurabh handles them by hand.
4. A4. The page is always on. There is no on/off switch in v1 (see Q2).
5. A5. The shared social preview text (`SOCIAL_PREVIEW.shortDescription`, "Register your interest today") is used for og:description as on every other page. A careers-specific preview is deferred (D5).

## Deferred (Later bucket)

1. **D1. Header or home-page mention** (for example under About, or in the phone menu). Needs a nav-cap decision. Later release.
2. **D2. An on/off switch** (a `null`-hides-it constant, like other TBC business facts) so the link and page disappear when not hiring. Later, or sooner if Q2 says so.
3. **D3. JobPosting structured data**, more than one role, and per-role pages. Later, once role details are confirmed.
4. **D4. An application form, CV upload or applicant tracking.** Needs a new data store or vendor and a privacy policy update. **This is a pause for Saurabh.** Not planned.
5. **D5. A careers-specific social preview** (og:description and image). Later.
6. **D6. An analytics event for apply clicks.** It could use the existing `trackEvent` with no new vendor, but it isn't needed to ship. Later.

## Open questions for Saurabh (none block v1)

1. Q1. Is the role right: casual tutor for Maths, Science or English, plus exam preparation (selective entry, scholarship, NAPLAN, ICAS), primary to Year 10? Do you also want VCE, UCAT/GAMSAT or admin roles listed?
2. Q2. Should the page and link be hideable when you're not hiring (D2), or stay up all the time?
3. Q3. Do applicants need a WWCC (or VIT registration, which exempts registered teachers) before they apply, or is "before you start" fine? Any other must-haves (a teaching degree, ATAR or study results, police check)?
4. Q4. Applicants will email you personal information. Should the privacy policy get a line about job applications? Copy only, no code risk. Kept out of v1 so the privacy text doesn't change without your review.
5. Q5. Are you happy with the link label "We're hiring" and the path `/careers`?
6. Q6. Is "Tutor application" the subject line you want to filter on in your inbox?
