# AJ Classes — Running Costs Budget

> **Last checked:** 23 Oct 2026 · **Currency:** AUD · **FX assumption:** 1 USD ≈ 1.55 AUD
> **Goal:** stay on free tiers wherever the terms allow.
> Architecture: [architecture/arch.md](architecture/arch.md) · Roadmap: [requirements/README.md](requirements/README.md)
>
> **Corrects the 24 Sep 2026 version**, which costed out infrastructure that was never built:
> Cloudflare Pages, Cloudflare Access (Zero Trust) and Cloudflare DNS for web hosting, an Apple
> Developer Program and Google Play Console for a mobile app. The project actually runs on
> **Vercel** (confirmed: `curl -I https://ajclasses.com.au` returns `server: Vercel`), with DNS at
> the domain registrar (Squarespace), **hosted Supabase** (Sydney, currently Free tier), **Zoho
> CRM Free + Zoho Invoice**, **Resend** for transactional email, and **Cloudflare Turnstile** —
> just the anti-spam widget, not Cloudflare's hosting or DNS products.

---

## 1. Summary

| | Monthly | Yearly |
|---|---|---|
| **Current running cost** | **≈ A$12.65** | **≈ A$152** |
| **After Supabase Pro** (planned, see §3.1 — triggered by real family data going live, owner decision O3) | **≈ A$51.40** | **≈ A$617** |

Almost all of the current cost is the domain and Google Workspace. Every platform service in
active use runs on a free tier, including Supabase itself for now. The one cost already on the
horizon is Supabase Pro — see [§3.1](#31-supabase-free-vs-pro) and [§5](#5-upgrade-triggers-when-free-stops-being-enough).

There is no mobile app in scope in current docs, so there are no Apple Developer Program or
Google Play Console costs (these appeared in the previous version of this doc and have been
removed — see §2).

---

## 2. Line Items

### Fixed costs (paid regardless)

| Item | Plan | Cost | Per year | Needed from | Notes |
|---|---|---|---|---|---|
| Domain (`ajclasses.com.au`) | Registrar (Squarespace), 1 year | ~A$20 / yr | **A$20** | R1 | `.com.au` needs an ABN. DNS is managed at the registrar, not Cloudflare |
| Google Workspace | Business Starter, 1 user, annual | A$10.98 / mo (incl. GST) | **A$131.76** | R1 | Flexible monthly plan is A$12.98. Gives `hello@ajclasses.com.au`. Add aliases (e.g. `uat@`, `admin@`) free to the same user; they don't count as extra users |

> **Removed in this revision:** the Apple Developer Program (A$149/yr) and Google Play Console
> (≈A$39 one-off) line items from the previous version. There is no mobile app built or planned
> in current docs — `docs/requirements/README.md` lists a Release 5 "Mobile App" entry as a draft
> only, with no accepted PRP — so these costs are not real and shouldn't be budgeted for. If a
> mobile release is greenlit later, re-add them then.

### Platform services (free tier)

| Service | Used for | Free tier (key limits) | Cost |
|---|---|---|---|
| **Vercel** | Web hosting (production + preview/staging deploys) | Hobby plan: 100 GB bandwidth / mo, 1M edge requests / mo, preview deployments per branch with built-in login protection. See ⚠️ below | A$0 (unconfirmed plan — see note) |
| **Supabase** | DB, Auth, Storage, Edge Functions | Free tier: 500 MB DB, 1 GB storage, 5 GB egress, 50k MAU, 500k function calls. **Pauses after 1 week idle. No backups** | A$0 (planned upgrade to Pro — see §3.1) |
| **Zoho CRM** | Lead capture from the enquiry form, converted to contacts on enrolment | Free edition: API included, 5,000 API credits / day, 5,000 records | A$0 |
| **Zoho Invoice** | Family invoicing, customer portal, connected to Zoho CRM | Free / included with the CRM Free setup; finance integrations (e.g. Connect) may not be in CRM Free — see [leads-and-crm.md §4](requirements/release-2/leads-and-crm.md) | A$0 |
| **Resend** | Auth + transactional email (sign-in, invite, reset, Zoho-adjacent enquiry mail), and the app's portal emails: "work returned", "new assignment" and "due tomorrow" (one app cap for all three: 70 per rolling 24 h, so sign-in always keeps 30; ADR-0008) | 3,000 / mo, **100 / day**, 3 domains | A$0 |
| **Cloudflare Turnstile** | Anti-spam widget on the enquiry/leads form and portal sign-in — the *only* Cloudflare product in use, not Pages, Access or DNS | Free | A$0 |
| **Mux** | Private tutoring video | 10 stored videos, 100k delivery min / mo, signed URLs. Mux badge on the player | A$0 |
| **YouTube (Unlisted)** | Public testimonial videos | Free | A$0 |
| **GitHub** | Private repo + Actions CI/CD | 2,000 Actions min / mo (private repos) | A$0 |
| **Web3Forms** | Enquiry form delivery to `hello@`, parallel to the Zoho leads path | 250 submissions / mo | A$0 |
| **Kit (ConvertKit)** | Footer newsletter sign-up | Up to 10,000 subscribers, unlimited sends | A$0 |
| **Google Search Console** | SEO | Free | A$0 |

> ⚠️ **Vercel plan tier — unconfirmed, please check.** `docs/requirements/release-1/PRP.md` states
> the project was set up on Vercel's **free Hobby tier**. Vercel's Hobby plan is *personal,
> non-commercial use only* per its terms, and AJ Classes is a business — so if the project is
> still on Hobby, that's worth checking against the actual Vercel dashboard/billing page, both for
> accuracy here and for Vercel ToS compliance. If it's already on **Pro**, the cost is **US$20 /
> mo (≈ A$31)** per developer seat; see [§3.2](#32-web-hosting-vercel-hobby-vs-vercel-pro). No
> separate "preprod gate" product (e.g. Cloudflare Access) is in use — Vercel's own preview
> deployment login protection covers that for non-production branches.

---

## 3. Plan Comparison: Supabase and Web Hosting

USD prices exclude GST. Overseas suppliers don't charge GST to a GST-registered business that gives its ABN.

### 3.1 Supabase: Free vs Pro

| | **Free (current)** | **Pro (planned — owner decision O3)** |
|---|---|---|
| **Price** | US$0 | **US$25 / mo per organisation** (includes US$10 compute credit) |
| Projects | 2 active (paused ones don't count) | Unlimited. Each project on Micro compute costs about **US$10 / mo**, and the first is covered by the credit |
| Compute | Shared CPU, 500 MB RAM | Micro: shared CPU, 1 GB RAM |
| Database size | 500 MB | 8 GB, then US$0.125 / GB |
| File storage | 1 GB | 100 GB, then US$0.0213 / GB |
| Egress | 5 GB | 250 GB, then US$0.09 / GB |
| Monthly active users | 50,000 | 100,000 |
| Edge Function calls | 500k | 2M |
| **Backups** | **None** | **Daily, 7 days kept** |
| **Pausing** | **After 1 week idle** | **Never** |
| Log retention | 1 hour | 7 days |
| Support | Community | Email |
| Spend cap | n/a (hard limits) | On by default, so no surprise bills |

**Current state:** the project runs on the **Free** tier (US$0 / A$0). This is a deliberate,
known gap, not an oversight: [go-live.md §6, owner decision O3](requirements/release-2/go-live.md)
records that the project should **move to Pro before real family data** goes live — specifically
to get daily backups and stop the project pausing on idle. As of this revision that move has not
happened yet, so Supabase Pro is a **planned, upcoming cost**, not one currently being paid.

| Setup | How | USD / mo | **≈ AUD / mo** |
|---|---|---|---|
| **Current: Free** | Single free project | $0 | **A$0** |
| **Planned: Pro** | Move the project to Pro (owner decision O3) | $25 | **A$38.75** |

> **Trigger to act:** before real family/student data is stored (student submissions, marks,
> enquiry PII at scale). Moving to Pro adds **≈ A$38.75 / mo** on top of the current A$12.65 / mo
> fixed costs, taking the running total to **≈ A$51.40 / mo (≈ A$617 / yr)**.

### 3.2 Web hosting: Vercel Hobby vs Vercel Pro

| | **Vercel Hobby** | **Vercel Pro** |
|---|---|---|
| **Price** | US$0 | **US$20 / mo** (1 developer seat, includes US$20 usage credit). Extra developer seats US$20 each; viewer seats free |
| **Commercial use** | ⚠️ **Not allowed per Vercel's terms** — see the flag in §2 | ✅ |
| Bandwidth | 100 GB / mo | 1 TB / mo, then US$0.15 / GB |
| Requests | 1M edge requests / mo | 10M, then US$2 per 1M |
| Builds | Basic machines | Pay per build minute (US$0.007–0.105 / min, mostly covered by the credit) |
| Preprod/staging environment | Preview deployments per branch (what the project uses today — `develop` → staging) | **1 custom environment** (e.g. `preprod`) with its own env vars and domain |
| Protecting preview/staging | Vercel's built-in preview login protection (blocks crawlers; team members only) | Vercel login included. **Password protection +US$20 / project / mo** |
| Web Analytics | 50k events / mo | Expandable (US$3 per 100k events) |
| Spend control | Hard caps | Pay as you go, with budget alerts |
| **USD / mo** | $0 | **$20** (**$40** with password protection) |
| **≈ AUD / mo** | A$0 | **A$31** (**A$62** with password) |

> **Action item:** confirm which plan the project is actually on (see the flag in §2). If it's
> Hobby, either move to Pro (A$31/mo) for ToS-compliant commercial hosting, or confirm with Vercel
> that the current usage is acceptable under Hobby. This doc assumes Hobby/A$0 pending that check.

### 3.3 Combined scenarios (web + Supabase + fixed costs)

The fixed costs are the domain and Google Workspace: **A$12.65 / mo** (A$152 / yr).

| Scenario | Web | Supabase | **≈ AUD / mo** | **≈ AUD / yr** |
|---|---|---|---|---|
| **A: Current state** ⭐ | Vercel Hobby (unconfirmed — see §2) | Free | **A$12.65** | **A$152** |
| **B: Supabase Pro** (planned, O3) | Vercel Hobby (unconfirmed) | Pro | **A$51.40** | **A$617** |
| C: Vercel Pro, Supabase free | Vercel Pro | Free | A$43.65 | A$524 |
| D: Vercel Pro, Supabase Pro | Vercel Pro | Pro | A$82.40 | A$989 |

---

## 4. Free-Tier Constraints and How We Handle Them

| Constraint | Impact | Free workaround |
|---|---|---|
| Supabase project **pauses after 7 days idle** | The project may pause before real users arrive or between quiet periods | A daily cron/health check keeps it warm, or restore from the dashboard in about a minute |
| Supabase **no backups** on Free | Losing data (student submissions, marks, enquiries) can't be undone | Until the Pro move (O3), take manual `pg_dump` snapshots periodically; this is the main reason Pro is planned |
| Supabase **1 GB storage** | Submissions (PDF / JPG / DOCX) are the main thing that fills it | 10 MB per-file limit, compress images on the client |
| Resend **100 emails / day** | A busy day (invites, resets, enquiry-adjacent mail) could approach the limit | Portal emails (all three kinds together) are capped at 70 per rolling 24 h; overflow waits and shows as "Daily limit" in Admin → Emails, and "new assignment" / "due tomorrow" emails that would go out after their deadline show as "Too late to send". At item 3's planning volume the three kinds come to ≈ 135 a day, so the cap covers about **30 active portal students** (02b §8.6). Monitor that page; upgrade trigger below |
| Zoho CRM Free **5,000 API credits / day** | Shared across all lead-sync calls | Far above a tutoring business's enquiry volume today (see [leads-and-crm.md G7](requirements/release-2/leads-and-crm.md)) |
| Mux **10 videos** | Caps private tutoring video library | Switch to pay-as-you-go when the library grows (see below) |

---

## 5. Upgrade Triggers (when "free" stops being enough)

| Trigger | Upgrade | Extra cost / mo |
|---|---|---|
| Real family/student data goes live and you want managed backups, no pausing, or storage > 1 GB (**owner decision O3** — planned, not yet done) | Supabase **Pro** (see §3.1) | **≈ A$38.75** (US$25) |
| Vercel Hobby's non-commercial restriction becomes a compliance concern, or usage exceeds Hobby limits | Vercel **Pro** (see §3.2) | **≈ A$31** (US$20), **≈ A$62** with password-protected preview |
| More than 10 private videos, or you want the Mux badge removed | Mux pay-as-you-go (includes US$20 / mo usage credit) | **≈ A$0** at small scale (a card on file is required) |
| More than 100 emails / day | Resend Pro (50k / mo) | **≈ A$31** (US$20) |
| Portal emails outgrow the 70-a-day app cap: active portal students go over about 30, or "Daily limit" rows show up on Admin → Emails in two separate weeks (02b Decision 1's proposed rule, **pending Q27**: Saurabh hasn't approved it yet, and it gates item 8's release only) | Resend Pro (50k / mo), then raise the app cap | **≈ A$31** (US$20) |
| A second developer joins | Google Workspace user #2, additional Vercel seat | Varies |

**Likely first upgrade:** Supabase Pro, once real family data is stored — this is already an
owner decision (O3), just not yet executed. That takes the running cost to about **A$51.40 / mo**
(Scenario B in §3.3).

---

## 6. Account Ownership & Billing

**Decision:** AJ Classes owns every account and pays for it directly, with its own card, ABN and billing email. The developer joins as an invited member. The developer bills only a consulting fee, which covers their own time, AI tools and other overheads. Platform costs are **never** passed through the developer's invoices.

| Service | Owner / payer | Developer access | Notes |
|---|---|---|---|
| Domain (`.com.au`, registered at Squarespace) | AJ Classes (registrant ABN) | Technical contact | Eligibility is tied to the registrant's ABN |
| Google Workspace | AJ Classes (owner is super admin) | None needed, or a delegated admin later | Keep recovery details on the owner's phone |
| Vercel | AJ Classes | Invited member | Confirm plan tier (see §2 flag) |
| Supabase | AJ Classes | Invited member (**Developer** role) | Currently Free tier; move to Pro per O3 before real family data |
| Zoho CRM (Free) + Zoho Invoice | AJ Classes (created by the owner, 23 Oct 2026) | API credentials only (self client); no seat needed for the developer | See [leads-and-crm.md §4](requirements/release-2/leads-and-crm.md) |
| GitHub | AJ Classes organisation (free) | Member / repo admin | Code IP assignment belongs in the consulting agreement |
| Resend, Cloudflare (Turnstile only), Mux | AJ Classes | Invited member | |
| Codemagic | — | — | Not currently in use; no mobile app in scope |

**Housekeeping:**
- Sign up with a role alias (e.g. `tech@ajclasses.com.au`) so the accounts aren't tied to anyone personally.
- Keep all logins, 2FA recovery codes and API keys in a password manager AJ Classes owns.
- Offboarding: AJ Classes removes the developer's membership from every service above and rotates API keys.

---

## 7. Sources

- [Supabase pricing](https://supabase.com/pricing)
- [Vercel pricing](https://vercel.com/pricing) (Hobby is non-commercial — confirm current plan, see §2)
- [Resend pricing](https://resend.com/pricing)
- [Mux pricing](https://www.mux.com/pricing) · [Mux free plan](https://www.mux.com/blog/free-plan)
- [Zoho CRM pricing](https://www.zoho.com/crm/zohocrm-pricing.html) · [Zoho Invoice pricing](https://www.zoho.com/au/invoice/pricing/)
- [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) (widget only — no Pages/Access/DNS in use)
- [Google Workspace pricing in Australia (AUD)](https://synex.com.au/blog/google-workspace-pricing-and-plan-comparison-for-australian-businesses-2026-guide)

Prices change. Check them again before signing up for anything, and at each release.

Mobile-app-specific costs (Apple Developer Program, Google Play Console) were removed from this
doc on 23 Oct 2026 — see §2 — because no mobile app is built or committed in current docs.
