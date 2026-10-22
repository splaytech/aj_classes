// The website's enquiry form. Saved first, then sent to Zoho CRM; the reply never reveals ids or
// whether Zoho worked (the parent already saw "Message sent" from the email path).

import { serviceClient } from '../_shared/clients.ts';
import { fail, succeed } from '../_shared/responses.ts';
import type { ActionResult } from '../_shared/responses.ts';

import { syncEnquiry } from './crm.ts';
import { readEnquiry } from './enquiry.ts';
import { allowEnquiry } from './rate-limit.ts';

type Outcome = { result: ActionResult; status: number };

export async function submit(input: Record<string, unknown>, request: Request): Promise<Outcome> {
  // Honeypot: people never fill the hidden field. Pretend it worked so bots learn nothing.
  if (typeof input.botcheck === 'string' && input.botcheck !== '') {
    return { result: succeed(), status: 200 };
  }

  const enquiry = readEnquiry(input);
  if (!enquiry) return { result: fail('invalid_request'), status: 400 };

  if (!(await allowEnquiry(request))) return { result: fail('rate_limited'), status: 429 };

  const { data, error } = await serviceClient()
    .from('enquiries')
    .insert({
      name: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone,
      message: enquiry.message,
      wants_updates: enquiry.wantsUpdates,
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('insert failed');

  await syncEnquiry(data.id, enquiry);
  return { result: succeed(), status: 200 };
}
