# Release 2 Completion — Todo

> Started 22 Oct 2026. Owner asked for: Zoho Bigin (leads) and Zoho Invoice, student and parent
> logins with dashboards ("add all missing pieces"), every recommendation applied, then push to
> `develop`. Supabase: one hosted project (`unzjnxctkyahtmrkinyr`) for both staging and prod.
> Each item is ticked only after it has been tested.

## 0. Findings before building

- Student and parent logins, invites and dashboards already exist and are tested
  ([family-portal-todo.md](../family-portal-todo.md), all ticked). Nothing to add there beyond the
  invoices link (§4).
- The hosted Supabase project is empty (no tables, no functions) and **public sign-ups are on**.
  An account created without an invite becomes an active tutor, so sign-ups must be off before the
  schema is applied. This machine has no Supabase or Vercel login, so the schema, functions and
  secrets are applied by the setup script (§2) with the owner's access token.
- Remaining Release 2 plan items: lead backend (`submit-lead`), testimonials, subscribers, CI,
  Sentry, CSP, design tokens. Subscribers stay in Kit (decided in Release 1). Testimonials wait for
  real testimonials with consent (PRP: "once real testimonials exist"). Sentry needs an account.

## 1. Configuration

- [ ] T1.1 Hosted Supabase URL and publishable key for every build (`.env.production`)
- [ ] T1.2 Portal security policy names the exact Supabase host (Vercel and Railway)
- [ ] T1.3 Supabase config for the hosted project (`[remotes]`): site URL, redirect URLs, captcha and SMTP from secrets

## 2. Setup script

- [ ] T2.1 `supabase/scripts/deploy.sh`: checks, sign-ups off **before** schema, config, migrations, functions, secrets; prints what's left

## 3. Leads → Zoho Bigin

- [ ] T3.1 Design note (`leads-and-crm.md`) with gap review
- [ ] T3.2 Migration: `enquiries` table (admins only), rate limit, sync status; database tests
- [ ] T3.3 Edge function `leads`: public `submit` (checks, honeypot, rate limit, save, push to Bigin) and admin `resync`; Zoho client; tests
- [ ] T3.4 Website: enquiry form also sends to `leads` when switched on (never blocks or changes the email)
- [ ] T3.5 Portal: Admin → Enquiries (list, Bigin status, retry); tests

## 4. Zoho Invoice

- [ ] T4.1 Parent home: "Fees and invoices" card linking to the Zoho Invoice customer portal (hidden until the address is set)
- [ ] T4.2 Setup guide: Bigin ↔ Zoho Invoice, payments

## 5. SEO

- [ ] T5.1 Course and breadcrumb structured data on programme pages
- [ ] T5.2 Suburbs in page descriptions where natural
- [ ] T5.3 Resources section and first guide (selective entry exam), facts from official sources

## 6. Quality

- [ ] T6.1 GitHub Actions CI: format, lint, typecheck, unit tests, build, database tests

## 7. Finish

- [ ] T7.1 Go-live checklist updated; PRP updated
- [ ] T7.2 Full check (web, database, functions, build, bundle); browser check
- [ ] T7.3 Merge into `develop`, push; CI and Vercel green
