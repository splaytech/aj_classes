// Zoho CRM (Australian data centre) for website enquiries (leads-and-crm.md §3).
// OAuth: a Self Client refresh token is exchanged for an access token (valid 1 hour, cached here).
// Each enquiry becomes a Lead, matched on Email so a family who enquires twice stays one lead.
// Zoho reports per-record failures inside a 202 response, so each record's status is checked.

const ACCOUNTS_URL = Deno.env.get('ZOHO_ACCOUNTS_URL') ?? 'https://accounts.zoho.com.au';
const API_URL = Deno.env.get('ZOHO_API_URL') ?? 'https://www.zohoapis.com.au';
const CLIENT_ID = Deno.env.get('ZOHO_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('ZOHO_CLIENT_SECRET') ?? '';
const REFRESH_TOKEN = Deno.env.get('ZOHO_REFRESH_TOKEN') ?? '';
// Optional: an exact value from the org's Lead Source list (e.g. "Website"). Not sent if unset.
const LEAD_SOURCE = Deno.env.get('ZOHO_LEAD_SOURCE') ?? '';

const LEADS_UPSERT_PATH = '/crm/v8/Leads/upsert';
// Zoho says to call the API domain it returns at sign-in; only a real Zoho API host is accepted.
const ZOHO_API_DOMAIN = /^https:\/\/[a-z.]*zohoapis\.[a-z.]+$/;
const TOKEN_REUSE_MS = 55 * 60 * 1000; // Zoho tokens last 60 minutes
const ERROR_MAX = 500; // enquiries.crm_error limit

export type CrmEnquiry = {
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
};

export type CrmResult =
  { status: 'off' } | { status: 'synced'; leadId: string } | { status: 'failed'; error: string };

let cachedToken: { value: string; apiUrl: string; expiresAt: number } | null = null;

export function isCrmConfigured(): boolean {
  return CLIENT_ID !== '' && CLIENT_SECRET !== '' && REFRESH_TOKEN !== '';
}

/** Sends one enquiry to Zoho CRM as a lead. Never throws: problems come back as `failed`. */
export async function sendToCrm(enquiry: CrmEnquiry): Promise<CrmResult> {
  if (!isCrmConfigured()) return { status: 'off' };
  try {
    const session = await signIn();
    const leadId = await upsertLead(session, enquiry);
    return { status: 'synced', leadId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    return { status: 'failed', error: reason.slice(0, ERROR_MAX) };
  }
}

type ZohoSession = { value: string; apiUrl: string };

async function signIn(): Promise<ZohoSession> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken;

  const response = await fetch(`${ACCOUNTS_URL}/oauth/v2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  // Zoho answers some token errors with 200, so the body decides.
  const body = await response.json().catch(() => ({}));
  if (typeof body.access_token !== 'string') {
    throw new Error(`Zoho sign-in failed: ${body.error ?? response.status}`);
  }
  const apiUrl =
    typeof body.api_domain === 'string' && ZOHO_API_DOMAIN.test(body.api_domain)
      ? body.api_domain
      : API_URL;
  cachedToken = { value: body.access_token, apiUrl, expiresAt: Date.now() + TOKEN_REUSE_MS };
  return cachedToken;
}

async function upsertLead(session: ZohoSession, enquiry: CrmEnquiry): Promise<string> {
  const response = await fetch(`${session.apiUrl}${LEADS_UPSERT_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${session.value}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: [leadRecord(enquiry)], duplicate_check_fields: ['Email'] }),
  });
  if (response.status === 401) cachedToken = null; // expired early: refresh next time
  const body = await response.json().catch(() => ({}));
  const record = Array.isArray(body.data) ? body.data[0] : body;
  const id = record?.details?.id;
  if (record?.status === 'success' && typeof id === 'string') return id;
  throw new Error(`Zoho CRM: ${record?.code ?? response.status} ${record?.message ?? ''}`.trim());
}

/**
 * The Zoho CRM lead for one enquiry. Company is the family's name: some orgs make it mandatory,
 * and it becomes the account name if the lead is converted.
 */
export function leadRecord(enquiry: CrmEnquiry): Record<string, unknown> {
  const { firstName, lastName } = splitName(enquiry.name);
  return {
    First_Name: firstName,
    Last_Name: lastName,
    Company: enquiry.name,
    Email: enquiry.email,
    ...(LEAD_SOURCE ? { Lead_Source: LEAD_SOURCE } : {}),
    ...(enquiry.phone ? { Mobile: enquiry.phone } : {}),
    ...(enquiry.message ? { Description: enquiry.message } : {}),
  };
}

/** "Priya Kumar Sharma" → first "Priya Kumar", last "Sharma". Zoho requires a last name. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return { firstName: '', lastName: words[0] };
  return { firstName: words.slice(0, -1).join(' '), lastName: words[words.length - 1] };
}
