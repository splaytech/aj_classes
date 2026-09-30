# AJ Classes — Running Costs Budget

> **Last checked:** 24 Sep 2026 · **Currency:** AUD · **FX assumption:** 1 USD ≈ 1.55 AUD
> **Goal:** stay on free tiers wherever the terms allow, for **both preprod and prod**.
> Architecture: [architecture/arch.md](architecture/arch.md) · Roadmap: [requirements/README.md](requirements/README.md)

---

## 1. Summary

| | Monthly | Yearly |
|---|---|---|
| **Release 1–4** (web only) | **≈ A$12.65** | **≈ A$152** |
| **Release 5 onwards** (plus mobile stores) | **≈ A$25** | **≈ A$301** + A$39 one-off |
| **Year 1 total** (if R5 ships in year 1) | — | **≈ A$340** |

Almost all of this is the domain and Google Workspace. Every platform service runs on a free tier. For paid Supabase and Vercel options, see [§3 Plan Comparison](#3-plan-comparison-supabase-and-web-hosting).

---

## 2. Line Items

### Fixed costs (paid regardless)

| Item | Plan | Cost | Per year | Needed from | Notes |
|---|---|---|---|---|---|
| Domain (`ajclasses.com.au`) | Registrar, 1 year | ~A$20 / yr | **A$20** | R1 | `.com.au` needs an ABN. `preprod.` subdomain is free |
| Google Workspace | Business Starter, 1 user, annual | A$10.98 / mo (incl. GST) | **A$131.76** | R1 | Flexible monthly plan is A$12.98. Gives `hello@ajclasses.com.au`. Add aliases (e.g. `uat@`, `admin@`) free to the same user; they don't count as extra users |
| Apple Developer Program | Individual or Organisation | A$149 / yr | **A$149** | R5 | An Organisation account (store listing shows "AJ Classes") needs a free D-U-N-S number. It takes 1–2 weeks, so start it in R4 |
| Google Play Console | One-off registration | US$25 | **≈ A$39 once** | R5 | New personal accounts must run a closed test (12+ testers for 14 days) before production. An Organisation account avoids that |

### Platform services (free tier)

| Service | Used for | Free tier (key limits) | Preprod + prod on free? | Cost |
|---|---|---|---|---|
| **Cloudflare Pages** | Web hosting (preprod + prod projects) | Unlimited bandwidth, 500 builds / mo, **commercial use allowed** | ✅ Two projects | A$0 |
| **Cloudflare DNS** | DNS for the domain | Free | ✅ | A$0 |
| **Cloudflare Access** (Zero Trust) | Login gate on `preprod.` for UAT | Up to 50 users | ✅ | A$0 |
| **Cloudflare Turnstile** | Spam protection on forms | Free | ✅ Preprod uses test keys | A$0 |
| **Cloudflare Web Analytics** | Cookieless analytics | Free | ✅ | A$0 |
| **Supabase** | DB, Auth, Storage, Edge Functions | **2 active projects**, 500 MB DB, 1 GB storage, 5 GB egress, 50k MAU, 500k function calls. **Pauses after 1 week idle. No backups** | ✅ Uses both free slots exactly | A$0 |
| **Resend** | Auth + transactional email | 3,000 / mo, **100 / day**, 3 domains | ✅ One account, quota shared by both environments | A$0 |
| **Mux** | Private tutoring video | 10 stored videos, 100k delivery min / mo, signed URLs. Mux badge on the player | ⚠️ 10-video limit covers both environments. See upgrade triggers | A$0 |
| **YouTube (Unlisted)** | Public testimonial videos | Free | ✅ | A$0 |
| **GitHub** | Private repo + Actions CI/CD | 2,000 Actions min / mo (private repos) | ✅ | A$0 |
| **Codemagic** | iOS + Android builds | 500 macOS M2 min / mo, 1 concurrent build (single-user plan) | ✅ About 20 builds / mo | A$0 |
| **Firebase Cloud Messaging** | Push notifications (R5) | Free | ✅ Separate preprod Firebase project | A$0 |
| **Sentry** | Error tracking | Developer plan: 1 user, 5k errors / mo | ✅ Tag errors by `environment` | A$0 |
| **Web3Forms** | R1 contact form (until R2) | 250 submissions / mo | Prod only | A$0 |
| **Google Search Console** | SEO | Free | Prod only | A$0 |

> **Why Cloudflare Pages instead of Vercel:** Vercel's Hobby plan is *personal, non-commercial use only*, and AJ Classes is a business. Staying on Vercel would mean Pro at US$20 / mo (≈ A$31). Password-protecting preprod on Vercel would add another US$20 per project each month. Cloudflare Pages is free for commercial use, and Cloudflare Access gives the UAT login gate at no cost. `arch.md` already lists "Cloudflare Pages / Vercel" as the web host.

---

## 3. Plan Comparison: Supabase and Web Hosting

USD prices exclude GST. Overseas suppliers don't charge GST to a GST-registered business that gives its ABN.

### 3.1 Supabase: Free vs Pro

| | **Free** | **Pro** |
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
| Branching (a DB per PR) | ❌ | US$0.01344 per branch per hour (≈ US$10 / mo if one runs all month) |

**Supabase setups for preprod + prod:**

| Setup | How | USD / mo | **≈ AUD / mo** |
|---|---|---|---|
| **S-1: Both free** | Two free projects in one org | $0 | **A$0** |
| **S-2: Hybrid** ⭐ | Prod in a **Pro org**, preprod in a **separate free org** (the free-project limit counts across orgs, so this is allowed) | $25 | **A$38.75** |
| **S-3: Both Pro** | Both projects in one Pro org (US$25 + US$10 + US$10 − US$10 credit) | $35 | **A$54.25** |

> **Recommendation:** Start on **S-1**. Move to **S-2** when real student data reaches prod (R3). Prod then gets backups, no pausing and 100 GB storage. Preprod can pause and lose its data, because its data is only seed content and can be rebuilt.

### 3.2 Web hosting: Vercel Hobby vs Vercel Pro (vs Cloudflare Pages)

| | **Vercel Hobby** | **Vercel Pro** | **Cloudflare Pages (Free)** |
|---|---|---|---|
| **Price** | US$0 | **US$20 / mo** (1 developer seat, includes US$20 usage credit). Extra developer seats US$20 each; viewer seats free | US$0 |
| **Commercial use** | ❌ **Not allowed** | ✅ | ✅ |
| Bandwidth | 100 GB / mo | 1 TB / mo, then US$0.15 / GB | Unlimited |
| Requests | 1M edge requests / mo | 10M, then US$2 per 1M | Unlimited static requests |
| Builds | Basic machines | Pay per build minute (US$0.007–0.105 / min, mostly covered by the credit) | 500 builds / mo |
| Preprod environment | Preview deployments only | **1 custom environment** (e.g. `preprod`) with its own env vars and domain | Separate project per environment, or branch deploys |
| Protecting preprod | Vercel login only (team members) | Vercel login included. **Password protection +US$20 / project / mo** | **Cloudflare Access**: email one-time code, free for up to 50 users |
| Web Analytics | 50k events / mo | Expandable (US$3 per 100k events) | Cloudflare Web Analytics, free |
| Spend control | Hard caps | Pay as you go, with budget alerts | n/a (free) |
| **USD / mo** | $0, *but not allowed for AJ Classes* | **$20** (**$40** with password protection) | **$0** |
| **≈ AUD / mo** | — | **A$31** (**A$62** with password) | **A$0** |

> **Recommendation:** Use **Cloudflare Pages** to stay at A$0. Choose **Vercel Pro (A$31 / mo)** if you want the Vercel developer experience (preview comments, custom environments). Giving the tutor access through a free viewer seat plus Vercel login avoids the A$31 / mo password add-on.

### 3.3 Combined scenarios (web + Supabase + fixed costs)

The fixed costs are the domain and Google Workspace: **A$12.65 / mo** (A$152 / yr). R5 adds Apple and Google Play on top of every scenario.

| Scenario | Web | Supabase | **≈ AUD / mo** | **≈ AUD / yr** |
|---|---|---|---|---|
| **A: All free** ⭐ (start here) | Cloudflare Pages | S-1 Both free | **A$12.65** | **A$152** |
| **B: Free web, hybrid Supabase** ⭐ (from R3) | Cloudflare Pages | S-2 Hybrid | **A$51.40** | **A$617** |
| C: Free web, both Supabase Pro | Cloudflare Pages | S-3 Both Pro | A$66.90 | A$803 |
| D: Vercel Pro, Supabase free | Vercel Pro | S-1 Both free | A$43.65 | A$524 |
| E: Vercel Pro, hybrid Supabase | Vercel Pro | S-2 Hybrid | A$82.40 | A$989 |
| F: Everything paid | Vercel Pro | S-3 Both Pro | A$97.90 | A$1,175 |

---

## 4. Free-Tier Constraints and How We Handle Them

| Constraint | Impact | Free workaround |
|---|---|---|
| Supabase projects **pause after 7 days idle** | Preprod may pause between UAT rounds. Prod may pause before real users arrive | A daily GitHub Actions cron runs a tiny query against both projects. A paused project can also be restored from the dashboard in about a minute |
| Supabase **no backups** on Free | Losing prod data (student submissions, marks) can't be undone | Nightly GitHub Action: `pg_dump` of prod, encrypted, saved to Google Drive (Workspace, 30 GB). Test a restore into preprod once a term |
| Supabase **1 GB storage** | R3 submissions (PDF / JPG / DOCX) are the main thing that fills it | 10 MB per-file limit, compress images on the client, and keep preprod seed files small |
| Resend **100 emails / day** shared across envs | A busy preprod test day could use prod's quota | Preprod only sends to allow-listed `+uat` addresses. Everything else goes to the UAT inbox |
| Mux **10 videos** | Prod and preprod share the limit | Preprod uses 1–2 short test clips. Switch to pay-as-you-go when the library grows (see below) |
| Codemagic **1 concurrent build, 500 min** | Preprod and prod builds queue behind each other | Build iOS preprod only when mobile code changed (path filters) |

---

## 5. Upgrade Triggers (when "free" stops being enough)

| Trigger | Upgrade | Extra cost / mo |
|---|---|---|
| Real student data in prod and you want managed backups, **or** storage > 1 GB, **or** pausing becomes a problem | Supabase **S-2 Hybrid**: prod on Pro, preprod stays free (see §3.1). Or S-3 with both on Pro | **≈ A$38.75** (US$25), or A$54.25 for both |
| More than 10 private videos, or you want the Mux badge removed | Mux pay-as-you-go (includes US$20 / mo usage credit) | **≈ A$0** at small scale (a card on file is required) |
| More than 100 emails / day (e.g. R5 due-date reminders to many students) | Resend Pro (50k / mo) | **≈ A$31** (US$20) |
| A second developer joins | Codemagic Team, Sentry Team, Google Workspace user #2 | Varies |

**Likely first upgrade:** Supabase Pro around **R3**, once students upload real work that you can't afford to lose. Using the S-2 hybrid, that takes the running cost to about **A$51 / mo** (Scenario B in §3.3).

---

## 6. Account Ownership & Billing

**Decision:** AJ Classes owns every account and pays for it directly, with its own card, ABN and billing email. The developer joins as an invited member. The developer bills only a consulting fee, which covers their own time, AI tools and other overheads. Platform costs are **never** passed through the developer's invoices.

| Service | Owner / payer | Developer access | Notes |
|---|---|---|---|
| Domain (`.com.au`) | AJ Classes (registrant ABN) | Technical contact | Eligibility is tied to the registrant's ABN |
| Google Workspace | AJ Classes (owner is super admin) | None needed, or a delegated admin later | Keep recovery details on the owner's phone |
| Cloudflare (Pages, DNS, Access, Turnstile) | AJ Classes | Invited member (Administrator) | |
| Supabase (prod org + preprod org) | AJ Classes | Invited member (**Developer** role) | The 2-free-project limit may count against Owners/Admins. As Developer, their projects shouldn't use up your own free slots |
| GitHub | AJ Classes organisation (free) | Member / repo admin | Code IP assignment belongs in the consulting agreement |
| Resend, Mux, Sentry | AJ Classes | Invited member | |
| Apple Developer (Organisation) | AJ Classes (Account Holder, D-U-N-S) | Admin / App Manager | |
| Google Play Console | AJ Classes | Invited user with release permissions | |
| Codemagic | Developer's free personal account (a tool, owns no assets) | — | Holds signing credentials from AJ Classes' Apple/Google accounts. Hand over or rotate them at exit |

**Housekeeping:**
- Sign up with a role alias (e.g. `tech@ajclasses.com.au`) so the accounts aren't tied to anyone personally.
- Keep all logins, 2FA recovery codes and API keys in a password manager AJ Classes owns. The Bitwarden free organisation allows 2 users.
- Offboarding: AJ Classes removes the developer's membership from every service above and rotates API keys.

---

## 7. Sources

- [Supabase pricing](https://supabase.com/pricing)
- [Vercel pricing](https://vercel.com/pricing) (Hobby is non-commercial)
- [Resend pricing](https://resend.com/pricing)
- [Mux pricing](https://www.mux.com/pricing) · [Mux free plan](https://www.mux.com/blog/free-plan)
- [Codemagic pricing](https://codemagic.io/pricing/)
- [Google Workspace pricing in Australia (AUD)](https://synex.com.au/blog/google-workspace-pricing-and-plan-comparison-for-australian-businesses-2026-guide)
- [Apple Developer Program membership](https://developer.apple.com/programs/whats-included/)
- [Cloudflare Zero Trust plans](https://www.cloudflare.com/plans/zero-trust-services/)

Prices change. Check them again before signing up for anything, and at each release.
