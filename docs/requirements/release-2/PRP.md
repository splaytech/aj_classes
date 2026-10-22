# PRP — Release 2 (Month 2): Backend, Testimonials, Tutor & Admin Foundations

> **Status:** Draft, not yet elaborated. Split from the [master PRP](../PRP.md).
> **Architecture:** [arch.md](../../architecture/arch.md)
> **Depends on:** [Release 1](../release-1/PRP.md) (static site on Vercel, domain, `theme.css` variables, contact form UI) and [Release 1.1](../release-1.1/PRP.md) (calendar, events, news)

## Objective

Build the secure backend and let educators sign in, set up their profiles, and get used to the admin interface.

## Scope

### Carried Over from Release 1
Release 1 shipped as a static site only, so these items move here:

- **Supabase setup:** staging and prod projects in Sydney (`ap-southeast-2`), with schema managed through `supabase/migrations`.
- **Testimonials:**
  - `testimonials` table with public read of published rows, and a check that consent was obtained (a parent or guardian must consent for minors).
  - Testimonials page or section: YouTube Unlisted video (nocookie, click-to-load) plus a grid of written reviews.
  - Managed through the Admin UI (below).
- **Contact form backend:**
  - Switch the R1 form from the hosted form service to a Supabase Edge Function (`submit-lead`).
  - The function saves to an `inquiries` / `waitlist_signups` table, then emails the owner and submitter via **Resend**. The lead is saved even if email fails.
  - Spam protection: honeypot, Turnstile and rate limiting.
- **Subscribers:** move the R1 footer Subscribe form (and the R1 list the owner kept by hand) into a `subscribers` table, with idempotent sign-ups and a one-click unsubscribe link, for compliance with the Spam Act. Optional digest email of new R1.1 news and events.
- **Events / News / Calendar (from R1.1):** optionally move them from repo files to Supabase tables so the Admin UI can edit them without a code push. Only needed if a non-developer will edit this content.
- **Email:** Resend domain with SPF, DKIM and DMARC. The same setup serves auth emails.
- **Design tokens:** promote `theme.css` variables to JSON design tokens with a Style Dictionary build, so the same tokens can generate the Flutter theme in R5.
- **Site hardening:**
  - More content pages for SEO (dedicated About and Testimonials pages; pre-rendering already exists from R1).
  - `Review` / `AggregateRating` structured data once real testimonials exist (following Google's guidelines).
  - GitHub Actions CI: lint, typecheck, Lighthouse CI, Playwright smoke tests.
  - Sentry error tracking.
  - Content security policy.

### Authentication & Authorization
- Secure sign-up and login flow (email/password). The architecture uses **Supabase Auth (GoTrue)**, which issues JWTs.
- Role-based access control (RBAC) foundation, starting with the **Tutor** and **Admin** roles.

### Tutor Dashboard Shell
- Private, authenticated routes in the React web app that use the same configurable theme (design tokens).
- Tutor profile management: name, subjects taught, avatar upload to a Supabase Storage bucket.

### System Architecture
- Database provisioning: `users`/`profiles` and roles tables.
- Secure session management and password reset. Auth emails go through **Resend SMTP**.

### Completion (22 Oct 2026)

Built on top of R2a and R3: lead capture to **Zoho CRM** (as leads; Bigin was dropped on 23 Oct 2026 because it charges for backups) with an admin Enquiries page
([leads-and-crm.md](leads-and-crm.md)), parents' link to **Zoho Invoice**, a WhatsApp chat button
([whatsapp-button.md](whatsapp-button.md)), parent guides and course data for SEO, GitHub Actions
CI, and a one-command Supabase setup ([go-live.md](go-live.md)). The planned `submit-lead`
function became `leads`; enquiry emails stay on Web3Forms for now. Subscribers stay in Kit;
testimonials wait for real testimonials with consent; Sentry needs an account.
Todo: [completion-todo.md](completion-todo.md).

## Service Layer Rule (decided 28 Sep 2026)

There is **no separate BFF server**. The web and Flutter apps talk to Supabase directly (protected by RLS), and anything that needs secrets runs in Supabase Edge Functions.

Inside the web app, **only `apps/web/src/services/` knows about Supabase**:
- `services/supabase.client.ts` is the single place the Supabase client is created.
- Each area gets a plain-function service, e.g. `testimonials.service.ts` → `getPublishedTestimonials()`, `enquiry.service.ts` → `submitEnquiry()` (switched from Web3Forms to the `submit-lead` Edge Function).
- Components import only from `@/services`. ESLint (`no-restricted-imports`) blocks `@supabase/*` imports anywhere else.
- Services return plain app types (never raw Supabase rows or errors), so a backend change never touches the UI.

## Architecture Mapping

| Concern | Component |
|---|---|
| Identity / JWT | Supabase Auth (GoTrue) |
| Authorisation | Postgres RLS policies keyed on role |
| Avatars | Supabase Storage bucket |
| Auth + lead emails | Resend (custom SMTP on Supabase Auth; API from Edge Functions) |
| Lead capture | Supabase Edge Function `submit-lead` → Postgres |
| Testimonials | Postgres `testimonials` + YouTube Unlisted |

---

## R2a — Tutor & Admin Logins

> **Status:** Designed and reviewed, ready to build (6 Oct 2026).
> **Stories:** [r2a/stories.md](r2a/stories.md) · **Design:** [r2a/design.md](r2a/design.md) · **Gap review:** [r2a/review.md](r2a/review.md)

This is the first slice of R2. It covers sign-in, roles, two-step sign-in for admins, the tutor dashboard shell, staff profiles and staff management. The rest of R2 (testimonials, lead backend, subscribers, CI hardening) builds on it.

### Decisions

| # | Decision |
|---|---|
| D1 | **Invite only.** Public sign-up is off. An admin invites staff by email. |
| D2 | **One role per person in `profiles.role`** (`tutor`, `admin`). Admin includes everything a tutor can do. Ajay has one admin account and uses both areas (owner, 6 Oct). |
| D3 | **Local first** with the Supabase CLI. Staging/prod (Sydney) and Resend are linked later. |
| D4 | **Private pages are client-only, all under `/portal`.** Public pages stay pre-rendered. Rewrites on Railway and Vercel. |
| D5 | **Deactivate, don't delete.** The one exception: a never-accepted invite can be cancelled. |
| D6 | **Admins must use two-step sign-in** (authenticator app, TOTP), enforced by the database (owner, 6 Oct). |
| D7 | **Profiles:** full name, subjects, bio, qualifications, photo (owner, 6 Oct). The subject list is still to be confirmed. |

### Summary

- 22 user stories in 5 epics, plus 8 non-functional requirements, each with acceptance criteria and tests.
- The first draft of this section (FA1–FA5) had 44 gaps (requirements, security, design). All are fixed in the stories and design. A second check found 14 more, also fixed. See [r2a/review.md](r2a/review.md).
- Open owner questions (none blocks starting): subject list, backup admin, Cloudflare Pages vs Vercel, link expiry, Supabase Pro before go-live, tutor consent for public profiles.

---

## To Elaborate
- ~~User stories and acceptance criteria~~ (done for logins: see [R2a stories](r2a/stories.md); still needed for testimonials, leads and subscribers)
- ~~Role model and the RLS policy matrix~~ ([R2a design §4, §7](r2a/design.md))
- ~~Rules for inviting and provisioning tutors~~ ([R2a design §10](r2a/design.md))
- Admin UI for managing testimonials, inquiries and waitlist entries (RLS: `admin` role, using `is_admin()` from R2a)
- Cut-over plan from the form service to the Edge Function, with no lost enquiries during the switch
- Timeline: R2 now holds R1's deferred backend work on top of auth, so check whether it still fits in one month

---

## Appendix — Content Placeholders: Testimonials

> **Owner to fill in.** Get written consent for every testimonial. For a student under 18, a parent or guardian must consent.

### Written Reviews (aim for 6+)

| Reviewer display name (e.g. "Priya S.") | Role (Parent / Student) | Context (e.g. "Year 8, 2026 intake") | Quote (≤ 60 words) | Rating (1–5, optional) | Consent obtained (Y/N) |
|---|---|---|---|---|---|
| ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› |
| ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› |
| ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› |

### Video Testimonials (YouTube Unlisted)

> **Update 30 Sep 2026 (Ajay):** videos of some students and their parents are available. Collect a **written parent consent form** for each (not just a WhatsApp message) before publishing. See Release 1 PRP A.11, T20.

| Title | YouTube URL / ID | Person (display name + role) | Consent obtained (Y/N) |
|---|---|---|---|
| ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› |

### Results / Honour Board (future, once outcomes exist)

| Student display name | School offer | Year | Consent obtained (Y/N) |
|---|---|---|---|
| ‹TBD› | ‹TBD› | ‹TBD› | ‹TBD› |
