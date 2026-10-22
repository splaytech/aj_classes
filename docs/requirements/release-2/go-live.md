# Release 2 — Go-Live Checklist (portal for staff, students and parents)

> **Status:** Ready to start (22 Oct 2026). Code: branch `release/r2` (Release 2 + 3 portal merged
> with the live public site, all tests passing). The portal **switches itself off** until its
> three settings are present (§4), so merging the code is safe before any of this is done.
> Design: [R2a design §8, §13–14](r2a/design.md). Runbooks: [supabase/README.md](../../../supabase/README.md).

Two Supabase projects: **staging** (for the Vercel Preview site) and **prod**. Both free to start;
move prod to **Pro before real family data** (no pausing, daily backups; R2a review Q5).

## 1. Accounts to create (owner)

| # | What | Where | Notes |
|---|---|---|---|
| A1 | Supabase account, two projects: `aj-classes-staging`, `aj-classes-prod` | supabase.com | Region **Sydney**. Save each database password in a password manager. |
| A2 | Cloudflare Turnstile widget | dash.cloudflare.com → Turnstile | Hostnames: `ajclasses.com.au`, `staging.ajclasses.com.au`, `localhost`. Gives a **site key** (public) and a **secret** (private). |
| A3 | Resend (sends sign-in, invite and reset emails) | resend.com | Add domain `ajclasses.com.au`; it gives DNS records on the `send.` subdomain plus a DKIM record, so the Zoho mail records don't change. Create an SMTP password. |

## 2. DNS (Squarespace)

Add Resend's records exactly as shown in Resend (MX and TXT on `send`, TXT `resend._domainkey`).
Don't touch the Zoho MX/SPF/DKIM records or the Vercel records. Wait for Resend to show "Verified".

## 3. Supabase setup (developer, per project: staging first, then prod)

```bash
supabase link --project-ref <ref>
supabase db push                     # all migrations; seed.sql is never run here
supabase config push                 # auth settings from config.toml (design §8)
supabase functions deploy account-admin
supabase secrets set ALLOWED_ORIGINS=https://ajclasses.com.au      # staging: https://staging.ajclasses.com.au
```

**Then, straight away, in the Supabase dashboard.** `config push` also copies the *local* values
from `config.toml` (site URL `http://localhost:5173`, Turnstile's always-pass test secret, no SMTP),
so these settings must be set **after** it, and again after any later `config push`:

| Setting | Value |
|---|---|
| Auth → URL configuration → Site URL | `https://ajclasses.com.au` (staging: `https://staging.ajclasses.com.au`) |
| Redirect URLs | the same origin + `/portal/auth/confirm` (exact, no wildcards) |
| Auth → Attack protection → Captcha | Turnstile, **secret** from A2 |
| Auth → SMTP | Resend: host `smtp.resend.com`, port 465, user `resend`, password from A3, sender `AJ Classes <hello@ajclasses.com.au>` |
| Auth → Email templates | Paste each file from `supabase/templates/` (if `config push` didn't) |
| Storage | `avatars` bucket comes from the migrations; check it exists |

## 4. Vercel environment variables

| Name | Production | Preview (staging) |
|---|---|---|
| `VITE_SUPABASE_URL` | prod project URL | staging project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | prod publishable key (`sb_publishable_…`) | staging publishable key |
| `VITE_TURNSTILE_SITE_KEY` | site key (A2) | same site key |

Never put a **secret** key (`sb_secret_…`, service role, Turnstile secret, SMTP password) in Vercel:
they only live in Supabase. Redeploy after setting them. Optional hardening: replace
`https://*.supabase.co` in `apps/web/vercel.json` with the exact project host (design §13.2).

## 5. First admins (owner, on prod)

Follow "First admin on a new environment" in `supabase/README.md`: invite yourself, set the role
to admin, set up two-step sign-in. Repeat for a **second admin** so either can reset the other.

## 6. Owner decisions before families are invited

| # | Item |
|---|---|
| O1 | The Privacy Policy already has a "Student and parent portal accounts" section (R3b review F19), marked for owner review. Read it before inviting families. |
| O2 | WhatsApp: confirm `+61 469 800 685` is the WhatsApp Business number ([whatsapp-button.md](whatsapp-button.md)). |
| O3 | Move prod to Supabase Pro before real family data. |

## 7. Release order

1. Merge `release/r2` into `develop` → staging deploys; portal stays off until §4 Preview values exist.
2. Do §1–4 for **staging**; test §8 on `staging.ajclasses.com.au`.
3. Do §3–5 for **prod**; merge `develop` into `main` (PR) → live.
4. Test §8 on the live site; then invite tutors, then students and parents.

## 8. Smoke test (each environment)

- [ ] Public pages unchanged; WhatsApp button opens a chat; no `/portal` in `sitemap.xml`; `robots.txt` disallows `/portal`
- [ ] Footer "Sign in" appears (portal on)
- [ ] Invite a tutor → email arrives (check spam) → Continue → set password → tutor dashboard
- [ ] Admin sign-in asks for the two-step code
- [ ] Forgot password email works; old link says "expired or already used"
- [ ] Create a class, add a student, invite the parent; publish an online assignment; student submits; tutor returns it; parent sees marks
- [ ] Deactivate a test tutor → their next action fails
- [ ] Refresh on a deep link (e.g. `/portal/classes`) still loads
- [ ] Response headers on `/portal/*`: `Content-Security-Policy`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`
