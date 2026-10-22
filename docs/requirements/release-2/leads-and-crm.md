# Release 2 — Leads, Zoho CRM and Zoho Invoice

> **Status:** Built (22 Oct 2026); moved from Zoho Bigin to **Zoho CRM Free edition** on 23 Oct 2026
> (Bigin charges for backups even on its free plan; the owner created Zoho CRM Free and Zoho Invoice
> accounts). Replaces the planned `submit-lead` function (R2 PRP, "Contact form backend").
> Part of [Release 2](PRP.md); todo: [completion-todo.md](completion-todo.md).

## 1. Flow

```
Enquiry form ──► Web3Forms ──► email to hello@ (unchanged: the parent sees "Message sent" from this)
      └────────► leads function ──► enquiries table (saved first)
                                    └─► Zoho CRM: a Lead (matched by email)
```

- The email path is unchanged and stays the source of truth for the parent's "Message sent".
  The second call runs after it, in the background, and never shows an error to the parent.
- The enquiry is saved even if Zoho is down or not set up; admins can **retry** from the portal.
- Switched on by `VITE_LEAD_CAPTURE=on` (Vercel), after the function is deployed.
- In Zoho CRM the owner works the lead as usual and **converts** it to a contact (and account,
  named after the family) when the family enrols.

## 2. Database: `public.enquiries`

| Column | Notes |
|---|---|
| `name`, `email`, `phone`, `message`, `wants_updates` | Same limits as the form (name 2–100, message ≤ 2000) |
| `crm_status` | `pending` → `synced` / `failed` / `off` (Zoho not configured) |
| `crm_lead_id`, `crm_error`, `crm_synced_at` | For the admin page and retries (renamed from the Bigin columns) |

- RLS: **admins with two-step only** can read and delete. Nobody can insert or update directly;
  only the function (secret key) writes.
- Rate limit: `enquiry_rate_limits` keeps a salted hash of the sender's IP for 1 hour (no other
  data); more than 5 enquiries an hour from one address are refused.

## 3. Edge function `leads`

| Action | Who | What |
|---|---|---|
| `submit` | anyone (the website) | CORS for the site only; honeypot `botcheck` must be empty; same validation as the form; rate limit; insert; send to Zoho CRM; returns `{ ok }` only (no ids) |
| `resync` | active admin with two-step | Retries Zoho CRM for one enquiry |

Zoho CRM API v8 (Australian accounts at `accounts.zoho.com.au`): refresh the access token
(cached ~55 minutes) and use the `api_domain` Zoho returns (only a `https://…zohoapis…` host is
accepted; otherwise `https://www.zohoapis.com.au`). Then
`POST {api_domain}/crm/v8/Leads/upsert` with `duplicate_check_fields: ["Email"]` (Email is Zoho's
own duplicate check for leads): First_Name / Last_Name (split from the name; Last_Name is the only
required field), **Company = the family's name** (some orgs make Company mandatory, and it becomes
the account name on conversion), Email, Mobile, Description = message, and `Lead_Source` only if
`ZOHO_LEAD_SOURCE` is set. Zoho reports per-record results inside 2xx/207 responses, so each
record's `status` is checked. No tags: tagging isn't in the Free edition.

## 4. Owner setup (Zoho, Australia)

1. **Zoho CRM API access** (Free edition: API included, 5,000 credits a day; one enquiry uses a
   fraction of one): go to **api-console.zoho.com.au → Add Client → Self Client**, then
   **Generate Code** with scope `ZohoCRM.modules.leads.ALL`, choose your CRM organisation, and
   copy the code. Within its time limit, exchange it for a refresh token:
   `POST https://accounts.zoho.com.au/oauth/v2/token` with `grant_type=authorization_code`,
   `client_id`, `client_secret`, `code` (the developer can do this step with you).
2. Optional: in Zoho CRM → Setup → Modules → Leads → Lead Source, add a "Website" value and put it in
   `ZOHO_LEAD_SOURCE` (22 Oct 2026: the org's list has no website value, so it isn't sent).
3. Set the function secrets (or pass them to `supabase/scripts/deploy.sh`): `ZOHO_CLIENT_ID`,
   `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, optional `ZOHO_LEAD_SOURCE`.
4. **Zoho Invoice**: Settings → Zoho Apps → **Connect** Zoho CRM (two-way sync of accounts and
   contacts; converted leads then appear as customers). Zoho's comparison table lists finance
   integrations as not included in CRM Free, so if Connect isn't offered, add enrolled families as
   customers in Zoho Invoice directly. Either way: add a payment gateway (Stripe for cards),
   enable the **customer portal** (Settings → Customer Portal; then Enable Portal per customer),
   and send the developer the portal address shown under "Portal Name". It goes in
   `BUSINESS.invoicePortalUrl`; parents then see a "Fees and invoices" card on their portal home.

## 5. Portal: Admin → Enquiries

Newest first: date, name, email, phone, message, Zoho CRM status (In Zoho CRM / Not sent with
reason / Zoho CRM not set up / Sending). **Retry** on failed or pending rows; **Delete** (with
confirmation) for privacy requests. Admin-only, like the activity page.

## 6. Stories

- **L1** As the owner, every website enquiry appears in Zoho CRM as a lead without retyping.
- **L2** As the owner, if Zoho is down or not set up, no enquiry is lost: I can see it in the portal and retry.
- **L3** As a parent, sending an enquiry works exactly as before, whether or not Zoho is working.
- **L4** As the owner, I invoice an enrolled family in Zoho Invoice; parents open their invoices from the portal.

## 7. Gap review

| # | Type | Gap | Fix |
|---|---|---|---|
| G1 | SEC | A public endpoint invites spam and junk leads. | Honeypot, validation, CORS, rate limit per IP (salted hash, 1 hour). |
| G2 | SEC | Zoho credentials must never reach the browser. | Function secrets only; the site sends no key; responses carry no ids. |
| G3 | SEC | The API host comes from Zoho's sign-in reply. | Only `https://…zohoapis…` hosts are used; anything else falls back to the fixed Australian host (tested). |
| G4 | PRIV | Enquiries now stored in a database and Zoho CRM. | Admin-only RLS; delete for privacy requests; Privacy Policy names Zoho CRM. |
| G5 | REQ | The parent must never see a Zoho failure. | Background call after the email; errors only shown to admins. |
| G6 | REQ | Repeat enquirers would duplicate leads. | Upsert on Email. |
| G7 | OPS | Free edition limits (5,000 API credits a day, 5,000 records). | Far above a tutoring business's enquiry volume; token cached ~55 min. |
| G8 | REQ | Lead Source values differ per org. | Optional setting; not sent unless set to an exact value. |
