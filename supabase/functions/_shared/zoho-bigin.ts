// Zoho Bigin (Australian data centre) for website enquiries (leads-and-crm.md §3).
// OAuth: a Self Client refresh token is exchanged for an access token (valid 1 hour, cached here).
// Records: the contact is upserted on Email; a pipeline record is added when a sub-pipeline and
// stage are configured. Zoho reports per-record failures inside a 202, so each status is checked.

const ACCOUNTS_URL = Deno.env.get('ZOHO_ACCOUNTS_URL') ?? 'https://accounts.zoho.com.au';
const API_URL = Deno.env.get('ZOHO_API_URL') ?? 'https://www.zohoapis.com.au';
const CLIENT_ID = Deno.env.get('ZOHO_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('ZOHO_CLIENT_SECRET') ?? '';
const REFRESH_TOKEN = Deno.env.get('ZOHO_REFRESH_TOKEN') ?? '';
const SUB_PIPELINE = Deno.env.get('ZOHO_BIGIN_SUB_PIPELINE') ?? '';
const STAGE = Deno.env.get('ZOHO_BIGIN_STAGE') ?? '';

const TOKEN_REUSE_MS = 55 * 60 * 1000; // Zoho tokens last 60 minutes
const WEBSITE_TAG = 'Website';
const DEAL_NAME_PREFIX = 'Website enquiry: ';
const ERROR_MAX = 500; // enquiries.crm_error limit

export type BiginEnquiry = {
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
};

export type BiginResult =
  | { status: 'off' }
  | { status: 'synced'; contactId: string; dealId: string | null }
  | { status: 'failed'; error: string };

let cachedToken: { value: string; expiresAt: number } | null = null;

export function isBiginConfigured(): boolean {
  return CLIENT_ID !== '' && CLIENT_SECRET !== '' && REFRESH_TOKEN !== '';
}

/** Sends one enquiry to Bigin. Never throws: problems come back as `failed` with a reason. */
export async function sendToBigin(enquiry: BiginEnquiry): Promise<BiginResult> {
  if (!isBiginConfigured()) return { status: 'off' };
  try {
    const token = await accessToken();
    const contactId = await upsertContact(token, enquiry);
    const dealId = SUB_PIPELINE && STAGE ? await createDeal(token, contactId, enquiry) : null;
    return { status: 'synced', contactId, dealId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    return { status: 'failed', error: reason.slice(0, ERROR_MAX) };
  }
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

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
  cachedToken = { value: body.access_token, expiresAt: Date.now() + TOKEN_REUSE_MS };
  return body.access_token;
}

async function upsertContact(token: string, enquiry: BiginEnquiry): Promise<string> {
  const { firstName, lastName } = splitName(enquiry.name);
  return await writeRecord(token, '/bigin/v2/Contacts/upsert', {
    data: [
      {
        First_Name: firstName,
        Last_Name: lastName,
        Email: enquiry.email,
        ...(enquiry.phone ? { Mobile: enquiry.phone } : {}),
        ...(enquiry.message ? { Description: enquiry.message } : {}),
        Tag: [{ name: WEBSITE_TAG }],
      },
    ],
    duplicate_check_fields: ['Email'],
  });
}

async function createDeal(
  token: string,
  contactId: string,
  enquiry: BiginEnquiry,
): Promise<string> {
  return await writeRecord(token, '/bigin/v2/Pipelines', {
    data: [
      {
        Deal_Name: `${DEAL_NAME_PREFIX}${enquiry.name}`,
        Sub_Pipeline: SUB_PIPELINE,
        Stage: STAGE,
        Contact_Name: { id: contactId },
        ...(enquiry.message ? { Description: enquiry.message } : {}),
        Tag: [{ name: WEBSITE_TAG }],
      },
    ],
  });
}

/** Writes one record and returns its id, or throws with Zoho's reason. */
async function writeRecord(token: string, path: string, payload: unknown): Promise<string> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (response.status === 401) cachedToken = null; // expired early: refresh next time
  const body = await response.json().catch(() => ({}));
  const record = Array.isArray(body.data) ? body.data[0] : body;
  const id = record?.details?.id;
  if (record?.status === 'success' && typeof id === 'string') return id;
  throw new Error(
    `Bigin ${path.split('/').pop()}: ${record?.code ?? response.status} ${record?.message ?? ''}`.trim(),
  );
}

/** "Priya Kumar Sharma" → first "Priya Kumar", last "Sharma". Bigin requires a last name. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return { firstName: '', lastName: words[0] };
  return { firstName: words.slice(0, -1).join(' '), lastName: words[words.length - 1] };
}
