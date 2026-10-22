# Release 2 — Go-Live Checklist (portal, leads, Zoho CRM and Invoice)

> **Status:** Code complete and on `develop` (22 Oct 2026). One hosted Supabase project serves
> staging and prod (`unzjnxctkyahtmrkinyr`, owner decision). Its public URL and key are already in
> `apps/web/.env.production`. The **portal stays switched off** until the Turnstile site key is set
> in Vercel (§4), and **lead capture stays off** until `VITE_LEAD_CAPTURE=on`, so the live site is
> safe at every step. Todo: [completion-todo.md](completion-todo.md).

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

`supabase/README.md` → "First admin on a new environment": invite yourself, set the role to admin,
set up two-step sign-in. Repeat for a **second admin**.

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

## 8. Smoke test

- [ ] Public pages unchanged; WhatsApp button opens a chat; `/resources` and the guide load; `sitemap.xml` has no `/portal`; `robots.txt` disallows `/portal`
- [ ] Footer "Sign in" appears (portal on)
- [ ] Invite a tutor → email arrives (check spam) → Continue → set password → tutor dashboard
- [ ] Admin sign-in asks for the two-step code
- [ ] Forgot password works; an old link says "expired or already used"
- [ ] Send a test enquiry: email arrives as before, and it appears in Portal → Admin → Enquiries as "In Zoho CRM" (and under Leads in Zoho CRM); delete it afterwards
- [ ] Class, student and parent invite; online assignment published, solved, returned; parent sees marks
- [ ] Deactivate a test tutor → their next action fails
- [ ] Refresh on a deep link (e.g. `/portal/classes`) still loads
- [ ] `/portal/*` responses carry `Content-Security-Policy` (naming `unzjnxctkyahtmrkinyr.supabase.co`), `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`
