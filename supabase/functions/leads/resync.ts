// An admin retries Zoho CRM for one enquiry (portal → Admin → Enquiries).

import { requireActiveAdmin } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/clients.ts';
import { fail, succeed } from '../_shared/responses.ts';
import type { ActionResult } from '../_shared/responses.ts';
import { isUuid } from '../_shared/validation.ts';

import { syncEnquiry } from './crm.ts';

type Outcome = { result: ActionResult; status: number };

export async function resync(input: Record<string, unknown>, request: Request): Promise<Outcome> {
  const caller = await requireActiveAdmin(request);
  if (!caller) return { result: fail('not_admin'), status: 403 };
  if (!isUuid(input.enquiryId)) return { result: fail('invalid_request'), status: 400 };

  const { data: row, error } = await serviceClient()
    .from('enquiries')
    .select('id, name, email, phone, message')
    .eq('id', input.enquiryId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return { result: fail('not_found'), status: 200 };

  const outcome = await syncEnquiry(row.id, row);
  return {
    result: succeed({
      crmStatus: outcome.status,
      crmError: outcome.status === 'failed' ? outcome.error : null,
    }),
    status: 200,
  };
}
