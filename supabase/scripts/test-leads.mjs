// End-to-end test of the leads edge function against the LOCAL stack, with a fake Zoho
// (leads-and-crm.md §3). Run: pnpm db:start && pnpm test:functions

import { startFakeZoho } from './fake-zoho.mjs';
import {
  SITE_ORIGIN,
  adminTwoStepToken,
  api,
  check,
  finish,
  signIn,
  sql,
} from './local-test-helpers.mjs';

const zoho = await startFakeZoho();
const run = Date.now();
let addressCount = 0;
const newAddress = () => `203.0.113.${(run + addressCount++) % 250}-${run}`; // unique per call site

const leads = (body, { origin = SITE_ORIGIN, address = newAddress(), token } = {}) =>
  api('/functions/v1/leads', {
    body,
    token,
    headers: { ...(origin ? { Origin: origin } : {}), 'x-forwarded-for': address },
  });
const rowFor = (email) =>
  sql(
    `select crm_status || '|' || coalesce(crm_contact_id,'') || '|' || coalesce(crm_deal_id,'') || '|' || coalesce(crm_error,'') from public.enquiries where email = '${email}' order by created_at desc limit 1`,
  );
const countFor = (email) =>
  Number(sql(`select count(*) from public.enquiries where email = '${email}'`));
const enquiry = (email, extra = {}) => ({
  action: 'submit',
  name: '  Priya Kumar Sharma ',
  email,
  phone: '0400 123 456',
  message: 'Year 7, interested in selective entry preparation.',
  wantsUpdates: true,
  botcheck: '',
  ...extra,
});

console.log('leads edge function (local, fake Zoho)\n');

// Who may call it
check('GET → 405', (await api('/functions/v1/leads', { method: 'GET' })).status === 405);
check('Unknown action → 400', (await leads({ action: 'export-all' })).status === 400);
const otherSite = `other-${run}@local.test`;
check(
  'Submit from another website → 403, nothing saved',
  (await leads(enquiry(otherSite), { origin: 'https://evil.example' })).status === 403 &&
    countFor(otherSite) === 0,
);
const noOrigin = `no-origin-${run}@local.test`;
check(
  'Submit with no Origin (a script) → 403',
  (await leads(enquiry(noOrigin), { origin: null })).status === 403 && countFor(noOrigin) === 0,
);

// Checks on the enquiry
const bot = `bot-${run}@local.test`;
const botReply = await leads(enquiry(bot, { botcheck: 'I am a bot' }));
check(
  'Honeypot filled → looks fine to the bot, nothing saved',
  botReply.json?.ok === true && countFor(bot) === 0,
);
check('Bad e-mail → 400', (await leads(enquiry('not-an-email'))).status === 400);
check(
  'One-letter name → 400',
  (await leads(enquiry(`a-${run}@local.test`, { name: 'A' }))).status === 400,
);
check(
  'Message over 2000 characters → 400',
  (await leads(enquiry(`long-${run}@local.test`, { message: 'x'.repeat(2001) }))).status === 400,
);
check(
  'Phone with letters → 400',
  (await leads(enquiry(`ph-${run}@local.test`, { phone: 'call me' }))).status === 400,
);

// A real enquiry: saved, then sent to Bigin
const parent = `priya-${run}@local.test`;
const before = zoho.requests.length;
const sent = await leads(enquiry(parent.toUpperCase()));
check(
  'Valid enquiry → ok',
  sent.status === 200 && sent.json?.ok === true,
  JSON.stringify(sent.json),
);
check(
  'The reply carries no ids',
  JSON.stringify(sent.json) === '{"ok":true,"data":{}}',
  JSON.stringify(sent.json),
);
const [status, contactId, dealId] = rowFor(parent).split('|');
check(
  'Saved with Bigin status "synced", contact and pipeline ids',
  status === 'synced' && contactId !== '' && dealId !== '',
  rowFor(parent),
);
const contactCall = zoho.requests.slice(before).find((r) => r.url === '/bigin/v2/Contacts/upsert');
const contact = contactCall?.json?.data?.[0] ?? {};
check(
  'Bigin called with "Zoho-oauthtoken"',
  contactCall?.headers.authorization === 'Zoho-oauthtoken fake-access-token',
);
check(
  'Contact: name split, e-mail lower-cased, phone in Mobile, message in Description, tag Website',
  contact.First_Name === 'Priya Kumar' &&
    contact.Last_Name === 'Sharma' &&
    contact.Email === parent &&
    contact.Mobile === '0400 123 456' &&
    contact.Description?.startsWith('Year 7') &&
    contact.Tag?.[0]?.name === 'Website',
  JSON.stringify(contact),
);
check(
  'Matched on Email (upsert)',
  JSON.stringify(contactCall?.json?.duplicate_check_fields) === '["Email"]',
);
const deal =
  zoho.requests.slice(before).find((r) => r.url === '/bigin/v2/Pipelines')?.json?.data?.[0] ?? {};
check(
  'Pipeline record linked to the contact, with the configured sub-pipeline and stage',
  deal.Contact_Name?.id === contactId &&
    deal.Sub_Pipeline === 'Sales Pipeline Standard' &&
    deal.Stage === 'Qualification' &&
    deal.Deal_Name === 'Website enquiry: Priya Kumar Sharma',
  JSON.stringify(deal),
);

// Bigin fails: the enquiry is still saved, the parent still gets ok
const failing = `fails-${run}@local.test`;
zoho.setFailContacts(true);
const failedReply = await leads(enquiry(failing, { phone: '', message: '' }));
check('Bigin error → the parent still gets ok', failedReply.json?.ok === true);
const failedRow = rowFor(failing).split('|');
check(
  'Saved with status "failed" and Zoho\'s reason',
  failedRow[0] === 'failed' && failedRow[3].includes('INVALID_DATA'),
  rowFor(failing),
);
check(
  'Empty phone and message saved as empty',
  sql(
    `select (phone is null and message is null)::text from public.enquiries where email = '${failing}'`,
  ) === 'true',
);

// Retry from the portal
const failedId = sql(`select id from public.enquiries where email = '${failing}'`);
const tutor = await signIn('tutor@local.test');
const admin = await adminTwoStepToken();
check(
  'Retry with no sign-in → 403',
  (await leads({ action: 'resync', enquiryId: failedId })).status === 403,
);
check(
  'Retry as a tutor → 403',
  (await leads({ action: 'resync', enquiryId: failedId }, { token: tutor.access_token })).status ===
    403,
);
check(
  'Retry as an admin without two-step → 403',
  (await leads({ action: 'resync', enquiryId: failedId }, { token: admin.aal1 })).status === 403,
);
const stillFailing = await leads({ action: 'resync', enquiryId: failedId }, { token: admin.aal2 });
check(
  'Retry while Bigin still fails → failed with reason',
  stillFailing.json?.data?.crmStatus === 'failed' &&
    stillFailing.json.data.crmError.includes('INVALID_DATA'),
  JSON.stringify(stillFailing.json),
);
zoho.setFailContacts(false);
const retried = await leads({ action: 'resync', enquiryId: failedId }, { token: admin.aal2 });
check(
  'Retry after Bigin recovers → synced',
  retried.json?.data?.crmStatus === 'synced' && rowFor(failing).startsWith('synced|'),
  JSON.stringify(retried.json),
);
check(
  'Retry of an unknown enquiry → not_found',
  (
    await leads(
      { action: 'resync', enquiryId: '00000000-0000-0000-0000-000000000000' },
      { token: admin.aal2 },
    )
  ).json?.code === 'not_found',
);

// Rate limit: 5 an hour from one address
const address = newAddress();
const burst = [];
for (let i = 1; i <= 6; i += 1) {
  burst.push((await leads(enquiry(`burst${i}-${run}@local.test`), { address })).status);
}
check(
  '5 enquiries an hour from one address, the 6th → 429',
  burst.slice(0, 5).every((s) => s === 200) && burst[5] === 429,
  burst.join(','),
);
check(
  'Another address is not affected',
  (await leads(enquiry(`other-addr-${run}@local.test`))).status === 200,
);
check(
  'Only hashes are kept for the rate limit',
  sql(`select count(*) from public.enquiry_rate_limits where ip_hash !~ '^[0-9a-f]{64}$'`) === '0',
);

check(
  'The Zoho access token is reused within the hour (at most one sign-in per run)',
  zoho.requests.filter((r) => r.url === '/oauth/v2/token').length <= 1,
);

// Tidy up this run's rows
sql(`delete from public.enquiries where email like '%-${run}@local.test'`);
await zoho.close();
finish();
