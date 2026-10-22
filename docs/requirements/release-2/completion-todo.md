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

## Results

- Full check: format, lint, typecheck clean; 228 web unit tests (17 new); 274 database tests (14 new); account-admin and leads function checks (leads: 30, against a fake Zoho, run repeatedly); production build with no secret values; public pages don't load supabase-js (only a deferred import).
- Browser: guide page; Admin → Enquiries showing a failed enquiry, Retry → "In Bigin"; parent "Fees and invoices" card (shown with a placeholder address, then hidden again).
- Found and fixed on the way: the Privacy Policy had a section duplicated by the earlier merge (now a test).

## 1. Configuration

- [x] T1.1 Hosted Supabase URL and publishable key for every build (`.env.production`)
- [x] T1.2 Portal security policy names the exact Supabase host (Vercel and Railway)
- [x] T1.3 Supabase config for the hosted project (`[remotes]`): site URL, redirect URLs, captcha and SMTP from secrets

## 2. Setup script

- [x] T2.1 `supabase/scripts/deploy.sh`: checks, sign-ups off **before** schema, config, migrations, functions, secrets; prints what's left

## 3. Leads → Zoho Bigin

- [x] T3.1 Design note (`leads-and-crm.md`) with gap review
- [x] T3.2 Migration: `enquiries` table (admins only), rate limit, sync status; database tests
- [x] T3.3 Edge function `leads`: public `submit` (checks, honeypot, rate limit, save, push to Bigin) and admin `resync`; Zoho client; tests
- [x] T3.4 Website: enquiry form also sends to `leads` when switched on (never blocks or changes the email)
- [x] T3.5 Portal: Admin → Enquiries (list, Bigin status, retry); tests

## 4. Zoho Invoice

- [x] T4.1 Parent home: "Fees and invoices" card linking to the Zoho Invoice customer portal (hidden until the address is set)
- [x] T4.2 Setup guide: Bigin ↔ Zoho Invoice, payments

## 5. SEO

- [x] T5.1 Course and breadcrumb structured data on programme pages
- [x] T5.2 Suburbs in page descriptions where natural
- [x] T5.3 Resources section and first guide (selective entry exam), facts from official sources

## 6. Quality

- [x] T6.1 GitHub Actions CI: format, lint, typecheck, unit tests, build, database tests

## 7. Finish

- [x] T7.1 Go-live checklist updated; PRP updated
- [x] T7.2 Full check (web, database, functions, build, bundle); browser check
- [ ] T7.3 Merge into `develop`, push; CI and Vercel green
