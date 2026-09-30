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

## To Elaborate
- User stories and acceptance criteria
- Role model (roles table vs JWT custom claims) and the RLS policy matrix
- Rules for inviting and provisioning tutors (open sign-up or admin invite only?)
- Admin UI for managing testimonials, inquiries and waitlist entries (RLS: `admin` role)
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
