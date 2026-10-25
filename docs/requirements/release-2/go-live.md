# Release 2 — Go-Live Checklist (portal, leads, Zoho CRM and Invoice)

> **Status (22 Oct 2026): hosted setup DONE.** Done in the owner's browser and by
> `supabase/scripts/deploy.sh`:
> - Supabase: public sign-ups off (checked), sign-in settings pushed (invite only, Turnstile,
>   Resend email, site URL), 7 migrations applied, `account-admin` and `leads` deployed, secrets set.
> - Cloudflare Turnstile widget "AJ Classes portal" (ajclasses.com.au and subdomains).
> - Resend: domain verified (Tokyo region); DNS on Squarespace: `resend._domainkey`, `send`,
>   `rsend` CNAMEs, `_dmarc` (Zoho mail records untouched).
> - Zoho CRM API (Self Client, scope `ZohoCRM.modules.leads.ALL`); a test enquiry arrived as a
>   lead. Lead Source not sent (the org's list has no "Website" value).
> - Zoho Invoice customer portal linked for parents; Zoho Invoice ↔ CRM connected by the owner.
>   Payments: PayID and bank transfer, invoices raised by hand (no Stripe for now).
> - Portal and lead capture switched on in `apps/web/.env.production`.
>
> **Left:** first admins (§5), then merge `develop` into `main` (§7). Until that merge,
> sign-in **emails** (invites, password resets) link to `ajclasses.com.au/portal/…`, which only
> exists after the merge; so create the first admin in the dashboard (§5) and invite everyone
> else after going live. Secrets for the script live in the git-ignored `supabase/.env.deploy`.

## 0. Before anything: public sign-ups must be off

The hosted project currently allows anyone to sign up. Once the tables exist, an account created
without an invite would become an **active tutor**. The setup script (§3) switches sign-ups off
and **refuses to create any table until it has confirmed they are off**. If you'd rather do it by
hand first: Dashboard → Authentication → Sign In / Providers → turn off **Allow new users to sign up**.

## 1. Accounts to create (owner)

| # | What | Where | Notes |
|---|---|---|---|
| A1 | Supabase access token, and the project's database password | supabase.com → Account → Access tokens; the password chosen when creating the project | For the setup script only. Never commit them. |
| A2 | Cloudflare Turnstile widget | dash.cloudflare.com → Turnstile | Hostnames `ajclasses.com.au`, `staging.ajclasses.com.au`, `localhost`. Gives a site key (public) and a secret. |
| A3 | Resend (sign-in, invite and reset emails) | resend.com | Add domain `ajclasses.com.au`; create an API key (used as the SMTP password). |
| A4 | Zoho CRM (Free edition) + Zoho Invoice | zoho.com.au | Created by the owner (23 Oct 2026). API setup in [leads-and-crm.md §4](leads-and-crm.md). |

## 2. DNS (Squarespace)

Add Resend's records exactly as shown (MX and TXT on the `send` subdomain, TXT `resend._domainkey`).
Leave the Zoho mail and Vercel records alone. Wait for Resend to show "Verified".

## 3. Supabase: one command

From the repo root, with the values from §1:

```bash
SUPABASE_ACCESS_TOKEN=… SUPABASE_DB_PASSWORD=… TURNSTILE_SECRET=… RESEND_API_KEY=… \
ZOHO_CLIENT_ID=… ZOHO_CLIENT_SECRET=… ZOHO_REFRESH_TOKEN=… \
  supabase/scripts/deploy.sh
```

It links the project, pushes the sign-in settings (invite only, captcha, Resend email, site URL
`https://ajclasses.com.au`, exact redirect URLs: `[remotes.production]` in `supabase/config.toml`),
**checks sign-ups are off**, applies all migrations, deploys the `account-admin` and `leads`
functions and sets their secrets. Add `--dry-run` to see the steps first. Zoho values are optional
(enquiries are still saved without them). Safe to run again.

Then in the dashboard: Auth → Email templates show the AJ Classes branding (from
`supabase/templates/`); Storage has the `avatars` bucket; Authentication → Users is empty.

## 4. Vercel environment variables (Production and Preview)

| Name | Value | Effect |
|---|---|---|
| `VITE_TURNSTILE_SITE_KEY` | site key (A2) | **Switches the portal on** (footer "Sign in") |
| `VITE_LEAD_CAPTURE` | `on` | Enquiries saved and sent to Zoho CRM as leads (email to hello@ unchanged) |

Already set: `VITE_APP_ENV`. Already in the repo: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
Never put a secret in Vercel. Redeploy after setting them.

## 5. First admins (owner)

Before the merge to `main`, don't use an emailed invite (its link needs the live portal):
Dashboard → Authentication → Users → **Add user → Create new user** with your email and a
password you choose (tick auto-confirm), then in the SQL editor:
`update public.profiles set role = 'admin' where email = 'your@email';`. Sign in at
`https://staging.ajclasses.com.au/portal/login` and set up two-step sign-in. After going live,
add the second admin with a normal invite (`supabase/README.md` → "First admin on a new environment").

## 6. Owner decisions

| # | Item |
|---|---|
| O1 | Read the Privacy Policy's portal and enquiry wording before inviting families. |
| O2 | Confirm `+61 469 800 685` is the WhatsApp Business number ([whatsapp-button.md](whatsapp-button.md)). |
| O3 | Move the Supabase project to **Pro** before real family data (no pausing, daily backups). |
| O4 | Staging and prod share one database: test with clearly fake names, and delete test accounts and enquiries afterwards. |
| O5 | Send the developer the Zoho Invoice customer-portal address; parents then see "Fees and invoices". |

## 7. Release order

1. `develop` deploys to staging automatically (done).
2. §1–4, then §5 on the live address.
3. Merge `develop` into `main` (pull request) → live.
4. Smoke test (§8), then invite tutors, then students and parents.

## 7a. "Work returned" emails (pending-requirements item 3, ADR-0004)

Release steps for Saurabh (04-plan §6.3). Preconditions: Q2 answered; the item 3 Privacy sentence
approved (Q7 / B17); B1 done first, or released together at the same SHA.

- [ ] Step 0, before deploying: in Dashboard → SQL Editor (read only) this returns 0, or the posts migration will fail: `select count(*) from public.posts where btrim(title, E' \t\n\r') = '' or btrim(body, E' \t\n\r') = '' or char_length(title) > 120 or char_length(body) > 5000;`
- [ ] Put a new long random `NOTIFY_WORKER_SECRET` and the Resend key in the password manager and in `supabase/.env.deploy` (git-ignored).
- [ ] `git fetch && git checkout -b release/work-returned-email <item 3 develop merge SHA>`, then from that branch run `supabase/scripts/deploy.sh`. It applies the migration (enables `pg_cron` and `pg_net`; if `db push` refuses, enable both in Dashboard → Database → Extensions and run it again), deploys `notifications` and sets the function settings.
- [ ] Confirm the script printed "Hosted function settings checked". First run only: confirm `supabase secrets list -o json` shows SHA-256 hex digests; if not, fix the check before relying on it.
- [ ] Merge `release/work-returned-email` (the same SHA, not `develop`) into `main` through a PR.
- [ ] Straight after the deploy, run the two Vault lines the script printed, in Dashboard → SQL Editor (supabase/README.md → "Work returned emails"), then delete that query from the editor's snippets and history.
- [ ] Dashboard → Project Settings → API → Exposed schemas is still only `public` and `graphql_public` (never `net`).
- [ ] AC-3.11 test-family check (same README section): both emails arrive within 5 minutes; Admin → Emails is empty; delete the test class.

## 8. Smoke test

- [x] Public pages unchanged; WhatsApp button opens a chat; `/resources` and the guide load; `sitemap.xml` has no `/portal`; `robots.txt` disallows `/portal` — verified via curl (23 Oct 2026): `/` and `/resources` → 200, guide page `/resources/victorian-selective-entry-exam` → 200, `wa.me/61469800685` link present in page source, `sitemap.xml` has zero `/portal` entries, `robots.txt` has `Disallow: /portal`.
- [x] Footer "Sign in" appears (portal on) — verified via curl: home page source contains "Sign in" linking to `/portal/login`.
- [ ] Invite a tutor → email arrives (check spam) → Continue → set password → tutor dashboard — needs a real invited tutor account and inbox access; owner/human action, not run here.
- [ ] Admin sign-in asks for the two-step code — needs a real admin login with 2FA set up; owner/human action, not run here.
- [ ] Forgot password works; an old link says "expired or already used" — partially verified: `/portal/forgot-password` and `/portal/reset-password?token=...` both return 200 (SPA fallback, no 404) with correct `no-store` header, but the page is a client-rendered SPA so the actual "expired or already used" wording could not be confirmed by curl/WebFetch (no JS execution); needs a quick human check in a real browser with a bogus/expired token (no real reset should be triggered).
- [ ] Send a test enquiry: email arrives as before, and it appears in Portal → Admin → Enquiries as "In Zoho CRM" (and under Leads in Zoho CRM); delete it afterwards — needs a real enquiry submission and Zoho CRM/admin access; owner/human action, not run here (explicitly out of scope for this automated pass).
- [ ] Class, student and parent invite; online assignment published, solved, returned; parent sees marks — needs real invited accounts across roles; owner/human action, not run here.
- [ ] Deactivate a test tutor → their next action fails — needs a real test tutor account; owner/human action, not run here.
- [x] Refresh on a deep link (e.g. `/portal/classes`) still loads — verified via curl: `/portal/classes` returns HTTP 200 (SPA fallback), not a 404.
- [x] `/portal/*` responses carry `Content-Security-Policy` (naming `unzjnxctkyahtmrkinyr.supabase.co`), `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store` — verified via curl on `/portal/login` and `/portal/classes`: all three headers present and correct.
