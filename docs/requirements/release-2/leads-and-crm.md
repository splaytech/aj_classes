# Release 2 — Leads, Zoho Bigin and Zoho Invoice

> **Status:** Built (22 Oct 2026). Owner decision: use Zoho Bigin for leads and Zoho Invoice for
> invoices rather than building a CRM. Replaces the planned `submit-lead` function (R2 PRP,
> "Contact form backend"). Part of [Release 2](PRP.md); todo: [completion-todo.md](completion-todo.md).

## 1. Flow

```
Enquiry form ──► Web3Forms ──► email to hello@ (unchanged: the parent sees "Message sent" from this)
      └────────► leads function ──► enquiries table (saved first)
                                    └─► Zoho Bigin: contact (matched by email) + optional pipeline record
```

- The email path is unchanged and stays the source of truth for the parent's "Message sent".
  The second call runs after it, in the background, and never shows an error to the parent.
- The enquiry is saved even if Bigin is down or not set up; admins can **retry** from the portal.
- Switched on by `VITE_LEAD_CAPTURE=on` (Vercel), after the function is deployed.

## 2. Database: `public.enquiries`

| Column | Notes |
|---|---|
| `name`, `email`, `phone`, `message`, `wants_updates` | Same limits as the form (name 2–100, message ≤ 2000) |
| `crm_status` | `pending` → `synced` / `failed` / `off` (Bigin not configured) |
| `crm_contact_id`, `crm_deal_id`, `crm_error`, `crm_synced_at` | For the admin page and retries |

- RLS: **admins with two-step only** can read and delete. Nobody can insert or update directly;
  only the function (secret key) writes.
- Rate limit: `enquiry_rate_limits` keeps a salted hash of the sender's IP for 1 hour (no other
  data); more than 5 enquiries an hour from one address are refused.

## 3. Edge function `leads`

| Action | Who | What |
|---|---|---|
| `submit` | anyone (the website) | CORS for the site only; honeypot `botcheck` must be empty; same validation as the form; rate limit; insert; push to Bigin; returns `{ ok }` only (no ids) |
| `resync` | active admin with two-step | Retries Bigin for one enquiry |

Bigin (Australian data centre): refresh the access token at `accounts.zoho.com.au` (cached ~55
minutes), then `POST www.zohoapis.com.au/bigin/v2/Contacts/upsert` matched on `Email`
(First/Last name, Email, Mobile, Description = message, tag "Website"). If
`ZOHO_BIGIN_SUB_PIPELINE` and `ZOHO_BIGIN_STAGE` are set, also create a `Pipelines` record
("Website enquiry: {name}") linked to the contact. Zoho reports per-record failures inside a
202 response, so every record's `status` is checked.

## 4. Owner setup (Zoho, Australia)

1. Sign up for **Bigin** and **Zoho Invoice** at the `.com.au` sites (data stays in Australia).
2. In Bigin → Settings → Customization → Contacts → **Email** field → turn on
   **"Do not allow duplicate values"** (needed to match repeat enquirers).
3. **api-console.zoho.com.au → Self Client → Generate Code**: scope
   `ZohoBigin.modules.ALL,ZohoBigin.settings.layouts.READ`, portal **Bigin**, your organisation.
   Exchange the code for a refresh token within its time limit
   (`POST https://accounts.zoho.com.au/oauth/v2/token` with `grant_type=authorization_code`).
4. Set the function secrets (or pass them to `supabase/scripts/deploy.sh`):
   `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`; optional
   `ZOHO_BIGIN_SUB_PIPELINE` and `ZOHO_BIGIN_STAGE` (exact names from your Bigin pipeline, e.g.
   "Sales Pipeline Standard" and "Qualification").
5. **Zoho Invoice**: connect it to Bigin (Bigin → Marketplace → Zoho Invoice, two-way sync), add a
   payment gateway (Stripe for cards), enable the **customer portal**, and send the portal address
   to the developer. It goes in `BUSINESS.invoicePortalUrl`; parents then see a "Fees and invoices"
   card on their portal home.

## 5. Portal: Admin → Enquiries

Newest first: date, name, email, phone, message, Bigin status (Synced / Failed with reason /
Not set up / Pending). **Retry** on failed or pending rows; **Delete** (with confirmation) for
privacy requests. Admin-only, like the activity page.

## 6. Stories

- **L1** As the owner, every website enquiry appears in Bigin as a contact (and pipeline record) without retyping.
- **L2** As the owner, if Bigin is down or not set up, no enquiry is lost: I can see it in the portal and retry.
- **L3** As a parent, sending an enquiry works exactly as before, whether or not Bigin is working.
- **L4** As the owner, I invoice a family from Bigin/Zoho Invoice using the same contact; parents open their invoices from the portal.

## 7. Gap review

| # | Type | Gap | Fix |
|---|---|---|---|
| G1 | SEC | A public endpoint invites spam and junk leads. | Honeypot, validation, CORS, rate limit per IP (salted hash, 1 hour). Turnstile could be added later; not on the public form today (owner chose the low-friction form). |
| G2 | SEC | Zoho credentials must never reach the browser. | Function secrets only; the site sends no key; responses carry no ids. |
| G3 | PRIV | Enquiries now stored in a database. | Admin-only RLS; delete for privacy requests; Privacy Policy updated (stored with Supabase in Sydney and Zoho in Australia). IPs kept only as salted hashes for 1 hour. |
| G4 | REQ | The parent must never see a failure from Bigin. | Background call after the email succeeds; errors are only logged and shown to admins. |
| G5 | REQ | Repeat enquirers would duplicate contacts. | Upsert on Email (owner turns on unique Email in Bigin, §4.2); the error is shown if not. |
| G6 | OPS | Pipeline and stage names differ per account. | Optional secrets; without them only the contact is created. |
| G7 | OPS | Zoho token limits. | Access token cached ~55 min per function instance. |
